import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import { env } from '../config/env.js';
import { HttpError } from '../utils/httpError.js';
import { canAccessPost } from './accessPolicy.js';

const configured = env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET;
const allowed = {
  avatar: ['image/jpeg', 'image/png', 'image/webp'],
  cover: ['image/jpeg', 'image/png', 'image/webp'],
  post: ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm'],
  chat: ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'application/pdf', 'text/plain'],
};

function resourceType(mimeType) {
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('image/')) return 'image';
  return 'raw';
}

function sign(params) {
  const payload = Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== '').sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => `${key}=${value}`).join('&');
  return createHash('sha1').update(`${payload}${env.CLOUDINARY_API_SECRET}`).digest('hex');
}

function privateDownloadUrl(media, format, expiresIn = 300) {
  const timestamp = Math.floor(Date.now() / 1000);
  const params = { attachment: false, expires_at: timestamp + expiresIn, format, public_id: media.key, timestamp, type: 'private' };
  const url = new URL(`https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/${media.resourceType}/download`);
  for (const [key, value] of Object.entries({ ...params, api_key: env.CLOUDINARY_API_KEY, signature: sign(params) })) url.searchParams.set(key, String(value));
  return url.toString();
}

function verifyUploadResponse(publicId, version, signature) {
  if (!publicId || !version || !signature) return false;
  const expected = Buffer.from(sign({ public_id: publicId, version: String(version) }), 'hex');
  let actual;
  try { actual = Buffer.from(signature, 'hex'); } catch { return false; }
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export async function createUpload(req, res) {
  if (!configured) throw new HttpError(503, 'Cloudinary media storage is not configured.');
  const { mimeType, size, purpose } = req.body;
  if (!allowed[purpose]?.includes(mimeType) || !Number.isSafeInteger(size) || size < 1 || size > (mimeType.startsWith('video/') ? 100 : 20) * 1024 * 1024) throw new HttpError(400, 'Unsupported media type or size.');

  const type = resourceType(mimeType);
  const timestamp = Math.floor(Date.now() / 1000);
  const extension = mimeType === 'application/pdf' ? '.pdf' : mimeType === 'text/plain' ? '.txt' : '';
  const key = `circles/${purpose}/${req.auth.user.id}/${randomUUID()}${extension}`;
  const fields = { public_id: key, timestamp, type: 'private' };
  const media = await (await import('../models/Media.js')).Media.create({ owner: req.auth.user.id, key, mimeType, size, purpose, visibility: purpose === 'chat' ? 'private' : 'public', resourceType: type, status: 'pending' });
  res.status(201).json({ uploadUrl: `https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/${type}/upload`, apiKey: env.CLOUDINARY_API_KEY, ...fields, signature: sign(fields), resourceType: type, key, mediaId: media.id, expiresIn: 300 });
}

export async function completeUpload(req, res) {
  if (!configured) throw new HttpError(503, 'Cloudinary media storage is not configured.');
  const Media = (await import('../models/Media.js')).Media;
  const media = await Media.findOne({ key: req.body.public_id, owner: req.auth.user.id });
  if (!media || !verifyUploadResponse(req.body.public_id, req.body.version, req.body.signature)) throw new HttpError(400, 'Cloudinary upload could not be verified.');

  const url = new URL(`https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/resources/${media.resourceType || resourceType(media.mimeType)}/private`);
  url.searchParams.set('public_ids[]', media.key);
  url.searchParams.set('max_results', '1');
  const response = await fetch(url, { headers: { Authorization: `Basic ${Buffer.from(`${env.CLOUDINARY_API_KEY}:${env.CLOUDINARY_API_SECRET}`).toString('base64')}` } });
  if (!response.ok) throw new HttpError(502, 'Could not verify the uploaded Cloudinary asset.');
  const { resources = [] } = await response.json();
  const asset = resources.find((item) => item.public_id === media.key);
  if (!asset || asset.bytes !== media.size || asset.resource_type !== (media.resourceType || resourceType(media.mimeType))) throw new HttpError(400, 'Uploaded file did not match its authorization.');

  if (asset.type !== 'private') throw new HttpError(400, 'Cloudinary asset access type did not match its authorization.');
  media.format = asset.format;
  media.status = 'complete';
  await media.save();
  res.json({ media: { key: media.key, mimeType: media.mimeType, size: media.size }, url: privateDownloadUrl(media, media.format) });
}

export async function resolveMedia(req, res) {
  const key = String(req.query.key || '');
  if (!key || key.includes('..')) throw new HttpError(400, 'Invalid media key.');
  const Media = (await import('../models/Media.js')).Media;
  const media = await Media.findOne({ key, status: 'complete' });
  if (!media || !media.format) throw new HttpError(404, 'Media not found.');
  let allowed = String(media.owner) === String(req.auth.user.id);
  if (!allowed && ['avatar', 'cover'].includes(media.purpose)) {
    const { User } = await import('../models/User.js');
    const { Follow } = await import('../models/Follow.js');
    const { Block } = await import('../models/Block.js');
    const owner = await User.findById(media.owner).select('isPrivate status');
    const blocked = await Block.exists({ $or: [{ blocker: req.auth.user.id, blocked: media.owner }, { blocker: media.owner, blocked: req.auth.user.id }] });
    const follows = owner?.isPrivate ? await Follow.exists({ follower: req.auth.user.id, following: media.owner }) : true;
    allowed = Boolean(owner && owner.status === 'active' && !blocked && follows);
  }
  if (!allowed && media.purpose === 'post') {
    const { Post } = await import('../models/Post.js');
    const { Follow } = await import('../models/Follow.js');
    const { Block } = await import('../models/Block.js');
    const { User } = await import('../models/User.js');
    const post = await Post.findOne({ 'media.key': key });
    allowed = await canAccessPost(req.auth.user.id, post, { Follow, Block, User });
  }
  if (!allowed && media.purpose === 'chat') {
    const { Conversation } = await import('../models/Conversation.js');
    const { Message } = await import('../models/Message.js');
    const message = await Message.findOne({ 'attachments.key': key });
    allowed = Boolean(message && await Conversation.exists({ _id: message.conversation, participants: req.auth.user.id }));
  }
  if (!allowed) throw new HttpError(403, 'You cannot access this media.');
  res.json({ url: privateDownloadUrl(media, media.format), expiresIn: 300 });
}
