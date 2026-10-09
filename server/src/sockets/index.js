import mongoose from 'mongoose';
import { Server } from 'socket.io';
import { supabase } from '../config/supabase.js';
import { User } from '../models/User.js';
import { Conversation } from '../models/Conversation.js';
import { Message } from '../models/Message.js';
import { Media } from '../models/Media.js';
import { createNotification } from '../services/notificationService.js';
import { z } from 'zod';
import { Block } from '../models/Block.js';
import { canAccessConversation } from '../services/accessPolicy.js';
import { HttpError } from '../utils/httpError.js';

export function attachSockets(server, clientUrl) {
  const io = new Server(server, { cors: { origin: clientUrl, credentials: true }, maxHttpBufferSize: 1e6 }); const online = new Map();
  io.use(async (socket, next) => { try { const token = socket.handshake.auth?.token; if (!token) throw new Error('Authentication required.'); const { data, error } = await supabase.auth.getUser(token); if (error || !data.user) throw new Error('Invalid session.'); const user = await User.findOne({ supabaseId: data.user.id, status: 'active' }); if (!user) throw new Error('Profile unavailable.'); socket.user = user; next(); } catch { next(new Error('Unauthorized')); } });
  io.on('connection', (socket) => { const uid = String(socket.user.id); online.set(uid, (online.get(uid) || 0) + 1); socket.join(`user:${uid}`); socket.broadcast.emit('presence:update', { userId: uid, online: true });
    socket.on('conversation:join', async ({ conversationId } = {}, ack = () => {}) => { try { if (!await canAccessConversation(socket.user.id, conversationId, { Conversation, Block })) throw new HttpError(403, 'Conversation access denied.'); socket.join(`conversation:${conversationId}`); ack({ ok: true }); } catch (error) { ack({ ok: false, error: error.message }); } });
    socket.on('message:send', async (payload = {}, ack = () => {}) => {
      try {
        const parsed = z.object({
          conversationId: z.string().regex(/^[a-f\d]{24}$/i),
          body: z.string().trim().max(5000).default(''),
          attachments: z.array(z.object({ key: z.string().min(8).max(300), type: z.enum(['image', 'video', 'file']), name: z.string().trim().min(1).max(255), size: z.number().int().positive().max(100 * 1024 * 1024) })).max(5).default([]),
        }).refine((value) => value.body.length > 0 || value.attachments.length > 0, 'Write a message or attach a file.').parse(payload);
        const conversation = await Conversation.findOne({ _id: parsed.conversationId, participants: socket.user.id });
        if (!conversation) throw new HttpError(403, 'Conversation access denied.');
        if (await Block.exists({ $or: [{ blocker: socket.user.id, blocked: mongoose.trusted({ $in: conversation.participants }) }, { blocked: socket.user.id, blocker: mongoose.trusted({ $in: conversation.participants }) }] })) throw new HttpError(403, 'Conversation is unavailable.');
        if (parsed.attachments.length) {
          const keys = parsed.attachments.map((attachment) => attachment.key);
          const media = await Media.find({ key: mongoose.trusted({ $in: keys }), owner: socket.user.id, purpose: 'chat', status: 'complete' }).select('key mimeType size');
          if (media.length !== keys.length || parsed.attachments.some((attachment) => { const file = media.find((item) => item.key === attachment.key); const type = file?.mimeType.startsWith('image/') ? 'image' : file?.mimeType.startsWith('video/') ? 'video' : 'file'; return !file || type !== attachment.type || file.size !== attachment.size; })) throw new HttpError(400, 'Every attachment must be a completed upload owned by your account.');
        }
        const message = await Message.create({ conversation: conversation.id, sender: socket.user.id, body: parsed.body, attachments: parsed.attachments });
        await Conversation.updateOne({ _id: conversation.id }, { lastMessage: message.id, lastActivityAt: message.createdAt });
        await message.populate('sender', 'username displayName avatar');
        io.to(`conversation:${conversation.id}`).emit('message:new', { message });
        await Promise.allSettled(conversation.participants.filter((member) => String(member) !== uid).map((member) => createNotification({ recipient: member, actor: socket.user.id, type: 'message', target: conversation.id, summary: parsed.body ? 'sent you a message' : 'shared an attachment' })));
        ack({ ok: true, message });
      } catch (error) { ack({ ok: false, error: error.message }); }
    });    socket.on('message:delivered', async ({ messageId } = {}, ack = () => {}) => { const message = await Message.findById(messageId); if (!message || !await canAccessConversation(socket.user.id, message.conversation, { Conversation, Block })) return ack({ ok: false }); await Message.updateOne({ _id: messageId }, { $addToSet: { deliveredTo: socket.user.id } }); io.to(`user:${String(message.sender)}`).emit('message:delivered', { messageId, userId: uid }); ack({ ok: true }); });
    socket.on('message:read', async ({ messageId } = {}, ack = () => {}) => { const message = await Message.findById(messageId); if (!message || !await canAccessConversation(socket.user.id, message.conversation, { Conversation, Block })) return ack({ ok: false }); await Message.updateOne({ _id: messageId }, { $addToSet: { readBy: socket.user.id, deliveredTo: socket.user.id } }); io.to(`conversation:${message.conversation}`).emit('message:read', { messageId, userId: uid }); ack({ ok: true }); });
    socket.on('typing:start', async ({ conversationId } = {}) => { if (await canAccessConversation(socket.user.id, conversationId, { Conversation, Block })) socket.to(`conversation:${conversationId}`).emit('typing:update', { conversationId, userId: uid, typing: true }); });
    socket.on('typing:stop', async ({ conversationId } = {}) => { if (await canAccessConversation(socket.user.id, conversationId, { Conversation, Block })) socket.to(`conversation:${conversationId}`).emit('typing:update', { conversationId, userId: uid, typing: false }); });
    socket.on('message:edit', async (payload = {}, ack = () => {}) => { try { const { messageId, body } = z.object({ messageId: z.string().regex(/^[a-f\d]{24}$/i), body: z.string().trim().min(1).max(5000) }).parse(payload); const message = await Message.findOne({ _id: messageId, sender: socket.user.id, deletedAt: null }); if (!message) throw new HttpError(404, 'Message not found or cannot be edited.'); const conversation = await Conversation.exists({ _id: message.conversation, participants: socket.user.id }); if (!conversation) throw new HttpError(403, 'Conversation access denied.'); message.body = body; message.editedAt = new Date(); await message.save(); io.to(`conversation:${message.conversation}`).emit('message:updated', { messageId, body, editedAt: message.editedAt }); ack({ ok: true }); } catch (error) { ack({ ok: false, error: error.message }); } });
    socket.on('message:delete', async (payload = {}, ack = () => {}) => { try { const { messageId } = z.object({ messageId: z.string().regex(/^[a-f\d]{24}$/i) }).parse(payload); const message = await Message.findById(messageId); if (!message || !await Conversation.exists({ _id: message.conversation, participants: socket.user.id })) throw new HttpError(404, 'Message not found.'); const conversation = await Conversation.findById(message.conversation).select('admins'); if (String(message.sender) !== uid && !conversation.admins.some((id) => String(id) === uid)) throw new HttpError(403, 'You cannot delete this message.'); message.body = ''; message.deletedAt = new Date(); await message.save(); io.to(`conversation:${message.conversation}`).emit('message:deleted', { messageId, deletedAt: message.deletedAt }); ack({ ok: true }); } catch (error) { ack({ ok: false, error: error.message }); } });
    socket.on('message:react', async (payload = {}, ack = () => {}) => { try { const { messageId, emoji } = z.object({ messageId: z.string().regex(/^[a-f\d]{24}$/i), emoji: z.string().min(1).max(12) }).parse(payload); const message = await Message.findById(messageId); if (!message || !await Conversation.exists({ _id: message.conversation, participants: socket.user.id })) throw new HttpError(404, 'Message not found.'); const prior = message.reactions.find((reaction) => String(reaction.user) === uid && reaction.emoji === emoji); if (prior) message.reactions = message.reactions.filter((reaction) => !(String(reaction.user) === uid && reaction.emoji === emoji)); else message.reactions.push({ user: socket.user.id, emoji }); await message.save(); io.to(`conversation:${message.conversation}`).emit('message:updated', { messageId, reactions: message.reactions }); ack({ ok: true }); } catch (error) { ack({ ok: false, error: error.message }); } });
    const authorizeCall = async (conversationId, toUserId) => {
      const conversation = await Conversation.findOne({ _id: conversationId, type: 'direct', participants: socket.user.id }).select('participants');
      if (!conversation || !await canAccessConversation(socket.user.id, conversationId, { Conversation, Block })) throw new HttpError(403, 'Voice call is unavailable.');
      const target = conversation.participants.find((member) => String(member) === String(toUserId) && String(member) !== uid);
      if (!target) throw new HttpError(403, 'Call recipient is not in this conversation.');
      return target;
    };
    socket.on('call:invite', async (payload = {}, ack = () => {}) => {
      try {
        const data = z.object({ conversationId: z.string().regex(/^[a-f\d]{24}$/i), toUserId: z.string().regex(/^[a-f\d]{24}$/i), offer: z.object({ type: z.literal('offer'), sdp: z.string() }) }).parse(payload);
        const target = await authorizeCall(data.conversationId, data.toUserId);
        io.to(`user:${String(target)}`).emit('call:incoming', { conversationId: data.conversationId, caller: { _id: uid, username: socket.user.username, displayName: socket.user.displayName, avatar: socket.user.avatar }, offer: data.offer });
        ack({ ok: true });
      } catch (error) { ack({ ok: false, error: error.message }); }
    });
    socket.on('call:accept', async (payload = {}) => {
      try {
        const data = z.object({ conversationId: z.string().regex(/^[a-f\d]{24}$/i), toUserId: z.string().regex(/^[a-f\d]{24}$/i), answer: z.object({ type: z.literal('answer'), sdp: z.string() }) }).parse(payload);
        const target = await authorizeCall(data.conversationId, data.toUserId);
        io.to(`user:${String(target)}`).emit('call:accepted', { conversationId: data.conversationId, fromUserId: uid, answer: data.answer });
      } catch { /* recipient may have disconnected */ }
    });
    socket.on('call:ice', async (payload = {}) => {
      try {
        const data = z.object({ conversationId: z.string().regex(/^[a-f\d]{24}$/i), toUserId: z.string().regex(/^[a-f\d]{24}$/i), candidate: z.any() }).parse(payload);
        const target = await authorizeCall(data.conversationId, data.toUserId);
        io.to(`user:${String(target)}`).emit('call:ice', { conversationId: data.conversationId, fromUserId: uid, candidate: data.candidate });
      } catch { /* ignore invalid or stale ICE candidates */ }
    });
    socket.on('call:end', async (payload = {}) => {
      try {
        const data = z.object({ conversationId: z.string().regex(/^[a-f\d]{24}$/i), toUserId: z.string().regex(/^[a-f\d]{24}$/i) }).parse(payload);
        const target = await authorizeCall(data.conversationId, data.toUserId);
        io.to(`user:${String(target)}`).emit('call:ended', { conversationId: data.conversationId, fromUserId: uid });
      } catch { /* call already ended or recipient disconnected */ }
    });
    socket.on('disconnect', () => { const count = (online.get(uid) || 1) - 1; if (count <= 0) { online.delete(uid); socket.broadcast.emit('presence:update', { userId: uid, online: false }); } else online.set(uid, count); });
  }); return io;
}
