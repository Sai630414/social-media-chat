import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Bell, FileText, MessageCircle, Paperclip, Phone, PhoneOff, Plus, Send, Users, X } from 'lucide-react';
import { api } from '../services/api.js';
import { uploadMedia } from '../services/media.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useSocket } from '../socket/SocketContext.jsx';
import Avatar from '../components/Avatar.jsx';

function MessageAttachment({ attachment }) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    let active = true;
    api.get('/media/resolve', { params: { key: attachment.key } })
      .then(({ data }) => { if (active) setUrl(data.url); })
      .catch(() => { if (active) setUrl(''); });
    return () => { active = false; };
  }, [attachment.key]);
  if (!url) return <span className="chat-attachment-loading">Loading {attachment.name || 'attachment'}…</span>;
  if (attachment.type === 'image') return <a href={url} target="_blank" rel="noreferrer"><img className="chat-attachment-image" src={url} alt={attachment.name || 'Shared image'}/></a>;
  if (attachment.type === 'video') return <video className="chat-attachment-video" src={url} controls preload="metadata"/>;
  return <a className="chat-file-link" href={url} target="_blank" rel="noreferrer"><FileText size={17}/>{attachment.name || 'Open attachment'}</a>;
}

export default function ChatPage() {
  const socket = useSocket();
  const { profile } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [active, setActive] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [error, setError] = useState('');
  const [typing, setTyping] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [callState, setCallState] = useState('idle');
  const [incomingCall, setIncomingCall] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [chatMode, setChatMode] = useState('individual');
  const [following, setFollowing] = useState([]);
  const [followingLoading, setFollowingLoading] = useState(false);
  const [creatingChat, setCreatingChat] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [groupTitle, setGroupTitle] = useState('');
  const [followingQuery, setFollowingQuery] = useState('');
  const [pickerError, setPickerError] = useState('');
  const [notificationPermission, setNotificationPermission] = useState(() => typeof Notification === 'undefined' ? 'unsupported' : Notification.permission);
  const end = useRef(null);
  const peerRef = useRef(null);
  const streamRef = useRef(null);
  const remoteAudio = useRef(null);
  const callPeer = useRef(null);
  const pendingIce = useRef([]);

  const loadConversations = async () => {
    try {
      const { data } = await api.get('/conversations');
      setConversations(data.conversations);
      setActive((current) => current ? (data.conversations.find((item) => item._id === current._id) || current) : null);
    } catch (e) { setError(e.message); }
  };

  useEffect(() => { loadConversations(); }, []);

  const joinActive = async () => {
    if (!active?._id || !socket) return;
    socket.emit('conversation:join', { conversationId: active._id }, (result) => {
      if (!result?.ok) setError(result?.error || 'Conversation access denied.');
    });
    try {
      const { data } = await api.get(`/conversations/${active._id}/messages`);
      setMessages(data.messages);
      data.messages.filter((message) => String(message.sender?._id) !== String(profile?._id))
        .forEach((message) => socket.emit('message:read', { messageId: message._id }));
    } catch (e) { setError(e.message); }
  };

  useEffect(() => {
    if (!active?._id) { setMessages([]); return; }
    setMessages([]);
    joinActive();
  }, [active?._id, socket]);

  useEffect(() => {
    if (!socket) return;
    const onNew = ({ message }) => {
      const conversationId = message.conversation?._id || message.conversation;
      setConversations((items) => items.map((item) => item._id === conversationId ? { ...item, lastMessage: message, lastActivityAt: message.createdAt } : item).sort((a, b) => new Date(b.lastActivityAt) - new Date(a.lastActivityAt)));
      if (conversationId !== active?._id) return;
      setMessages((items) => items.some((item) => item._id === message._id) ? items : [...items, message]);
      if (String(message.sender?._id) !== String(profile?._id)) socket.emit('message:read', { messageId: message._id });
    };
    const onTyping = ({ conversationId, userId, typing: isTyping }) => {
      if (conversationId === active?._id && String(userId) !== String(profile?._id)) setTyping(isTyping);
    };
    const onRead = ({ messageId, userId }) => setMessages((items) => items.map((message) => message._id === messageId ? { ...message, readBy: [...(message.readBy || []), userId] } : message));
    const recover = () => { if (active?._id) joinActive(); };
    socket.on('message:new', onNew);
    socket.on('typing:update', onTyping);
    socket.on('message:read', onRead);
    socket.on('connect', recover);
    return () => {
      socket.off('message:new', onNew);
      socket.off('typing:update', onTyping);
      socket.off('message:read', onRead);
      socket.off('connect', recover);
    };
  }, [socket, active?._id, profile?._id]);

  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, typing, attachments]);

  const start = async () => {
    setPickerOpen(true);
    setPickerError('');
    setSelectedIds([]);
    setGroupTitle('');
    setFollowingQuery('');
    setFollowingLoading(true);
    try {
      const { data } = await api.get('/profiles/me/following');
      setFollowing(data.users || []);
    } catch (e) { setPickerError(e.message || 'Could not load the people you follow.'); }
    finally { setFollowingLoading(false); }
  };

  const toggleParticipant = (userId) => {
    setSelectedIds((ids) => chatMode === 'individual' ? [userId] : ids.includes(userId) ? ids.filter((id) => id !== userId) : [...ids, userId]);
  };

  const createChat = async () => {
    if (!selectedIds.length) { setPickerError(chatMode === 'group' ? 'Choose at least two people for a group.' : 'Choose someone to message.'); return; }
    if (chatMode === 'group' && selectedIds.length < 2) { setPickerError('Choose at least two people for a group.'); return; }
    setCreatingChat(true);
    try {
      const { data } = await api.post('/conversations', { participants: selectedIds, ...(chatMode === 'group' && groupTitle.trim() ? { title: groupTitle.trim().slice(0, 80) } : {}) });
      setConversations((items) => [data.conversation, ...items.filter((item) => item._id !== data.conversation._id)]);
      setActive(data.conversation);
      setMobileOpen(true);
      setPickerOpen(false);
    } catch (e) { setPickerError(e.message || 'Could not create the conversation.'); }
    finally { setCreatingChat(false); }
  };

  const onFiles = async (event) => {
    const files = [...(event.target.files || [])];
    event.target.value = '';
    const slots = Math.max(0, 5 - attachments.length);
    if (files.length > slots) setError('You can attach up to five files per message.');
    setUploading(true);
    try {
      const uploaded = [];
      for (const file of files.slice(0, slots)) {
        const media = await uploadMedia(file, 'chat');
        uploaded.push({ ...media, name: file.name, type: file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : 'file' });
      }
      setAttachments((items) => [...items, ...uploaded]);
    } catch (e) { setError(e.message); }
    finally { setUploading(false); }
  };

  const send = (event) => {
    event.preventDefault();
    if ((!text.trim() && !attachments.length) || !active || !socket || uploading) return;
    const body = text.trim();
    const media = attachments;
    socket.emit('message:send', {
      conversationId: active._id,
      body,
      attachments: media.map(({ key, type, name, size }) => ({ key, type, name, size })),
    }, (result) => {
      if (!result?.ok) { setError(result?.error || 'Message could not be sent.'); return; }
      setText('');
      setAttachments([]);
      setError('');
      setConversations((items) => items.map((item) => item._id === active._id ? { ...item, lastMessage: result.message, lastActivityAt: result.message.createdAt } : item));
    });
  };

  const askNotificationPermission = async () => {
    if (typeof Notification === 'undefined') return;
    setNotificationPermission(await Notification.requestPermission());
  };

  const stopCall = (notifyPeer = false) => {
    if (notifyPeer && callPeer.current && socket) socket.emit('call:end', callPeer.current);
    if (peerRef.current) {
      peerRef.current.onconnectionstatechange = null;
      peerRef.current.onicecandidate = null;
      peerRef.current.ontrack = null;
    }
    peerRef.current?.close();
    peerRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    pendingIce.current = [];
    callPeer.current = null;
    setIncomingCall(null);
    setCallState('idle');
    if (remoteAudio.current) remoteAudio.current.srcObject = null;
  };

  const startCall = async () => {
    const target = active?.type === 'direct' ? active.participants?.find((user) => String(user._id) !== String(profile?._id)) : null;
    if (!target || !socket) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      streamRef.current = stream;
      callPeer.current = { conversationId: active._id, toUserId: target._id };
      const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
      peerRef.current = pc;
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));
      pc.ontrack = (event) => { if (remoteAudio.current) remoteAudio.current.srcObject = event.streams[0]; };
      pc.onicecandidate = (event) => { if (event.candidate) socket.emit('call:ice', { ...callPeer.current, candidate: event.candidate }); };
      pc.onconnectionstatechange = () => { if (pc.connectionState === 'connected') setCallState('active'); else if (['failed', 'closed'].includes(pc.connectionState)) stopCall(false); };
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit('call:invite', { conversationId: active._id, toUserId: target._id, offer: pc.localDescription }, (result) => {
        if (!result?.ok) { setError(result?.error || 'Could not start the call.'); stopCall(false); }
      });
      setCallState('calling');
    } catch (e) { stopCall(false); setError(e.name === 'NotAllowedError' ? 'Allow microphone access to make a voice call.' : e.message); }
  };

  const acceptCall = async () => {
    if (!incomingCall || !socket) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      streamRef.current = stream;
      callPeer.current = { conversationId: incomingCall.conversationId, toUserId: incomingCall.caller._id };
      const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
      peerRef.current = pc;
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));
      pc.ontrack = (event) => { if (remoteAudio.current) remoteAudio.current.srcObject = event.streams[0]; };
      pc.onicecandidate = (event) => { if (event.candidate) socket.emit('call:ice', { ...callPeer.current, candidate: event.candidate }); };
      pc.onconnectionstatechange = () => { if (pc.connectionState === 'connected') setCallState('active'); else if (['failed', 'closed'].includes(pc.connectionState)) stopCall(false); };
      await pc.setRemoteDescription(incomingCall.offer);
      for (const candidate of pendingIce.current.splice(0)) await pc.addIceCandidate(candidate);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit('call:accept', { conversationId: incomingCall.conversationId, toUserId: incomingCall.caller._id, answer: pc.localDescription });
      setIncomingCall(null);
      setCallState('connecting');
    } catch (e) { stopCall(true); setError(e.name === 'NotAllowedError' ? 'Allow microphone access to answer the call.' : e.message); }
  };

  useEffect(() => {
    if (!socket) return;
    const onIncoming = ({ conversationId, caller, offer }) => {
      if (callState !== 'idle') { socket.emit('call:end', { conversationId, toUserId: caller._id }); return; }
      const conversation = conversations.find((item) => item._id === conversationId);
      if (conversation) { setActive(conversation); setMobileOpen(true); }
      setIncomingCall({ conversationId, caller, offer });
    };
    const onAccept = async ({ answer, fromUserId }) => {
      if (!peerRef.current || String(callPeer.current?.toUserId) !== String(fromUserId)) return;
      try {
        await peerRef.current.setRemoteDescription(answer);
        for (const candidate of pendingIce.current.splice(0)) await peerRef.current.addIceCandidate(candidate);
        setCallState('connecting');
      } catch (e) { setError(e.message); stopCall(true); }
    };
    const onIce = async ({ candidate }) => {
      if (!candidate) return;
      if (!peerRef.current?.remoteDescription) pendingIce.current.push(candidate);
      else { try { await peerRef.current.addIceCandidate(candidate); } catch { /* stale ICE candidate */ } }
    };
    const onEnd = () => stopCall(false);
    socket.on('call:incoming', onIncoming);
    socket.on('call:accepted', onAccept);
    socket.on('call:ice', onIce);
    socket.on('call:ended', onEnd);
    return () => {
      socket.off('call:incoming', onIncoming);
      socket.off('call:accepted', onAccept);
      socket.off('call:ice', onIce);
      socket.off('call:ended', onEnd);
    };
  }, [socket, callState, conversations]);

  useEffect(() => () => stopCall(true), []);

  const other = (conversation) => conversation?.participants?.find((user) => String(user._id) !== String(profile?._id));
  const callName = incomingCall?.caller?.displayName || incomingCall?.caller?.username || other(active)?.displayName || other(active)?.username || 'Contact';

  return <section className={`chat-page ${mobileOpen ? 'mobile-chat-open' : ''}`}>
    <aside className="chat-sidebar">
      <div className="chat-title"><div><span className="eyebrow">SAY HELLO</span><h1>Messages</h1></div><button className="icon-button plus-button" aria-label="New conversation or group" title="New chat or group" onClick={start}><Plus/></button></div>
      <div className="conversation-list">{conversations.map((conversation) => {
        const person = other(conversation);
        const title = conversation.title || (conversation.type === 'group' ? conversation.participants?.filter((user) => String(user._id) !== String(profile?._id)).map((user) => user.displayName || user.username).join(', ') : person?.displayName || person?.username) || 'Group conversation';
        return <button key={conversation._id} className={`conversation-item ${active?._id === conversation._id ? 'current' : ''}`} onClick={() => { setActive(conversation); setMobileOpen(true); setAttachments([]); }}>
          {conversation.type === 'group' ? <span className="avatar avatar-lg avatar-fallback"><Users size={20}/></span> : <Avatar user={person} size="lg"/>}
          <span className="conversation-summary"><b>{title}</b><small>{conversation.lastMessage?.body || (conversation.lastMessage?.attachments?.length ? 'Shared an attachment' : 'Start a conversation')}</small></span>
          <span className="conversation-time">{conversation.lastActivityAt ? new Date(conversation.lastActivityAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : ''}</span>
        </button>;
      })}{!conversations.length && <div className="empty-chat"><MessageCircle/><p>Your conversations will show up here.</p><button className="text-button" onClick={start}>Start a conversation</button></div>}</div>
    </aside>
    <div className="chat-window">
      {active ? <>
        <header className="chat-window-head">
          <button className="back-mobile icon-button" onClick={() => setMobileOpen(false)}><ArrowLeft/></button>
          {active.type === 'group' ? <span className="avatar avatar-md avatar-fallback"><Users size={18}/></span> : <Avatar user={other(active)} size="md"/>}
          <div><b>{active.title || (active.type === 'group' ? `${active.participants?.length || 0} people` : other(active)?.displayName || other(active)?.username || 'Conversation')}</b><small>{active.type === 'group' ? `${active.participants?.length || 0} members` : 'Messages are private to your conversation'}</small></div>
          {notificationPermission !== 'granted' && notificationPermission !== 'unsupported' && <button className="icon-button" title="Enable message notifications" onClick={askNotificationPermission}><Bell size={18}/></button>}
          {active.type === 'direct' && <button className="icon-button" title="Start voice call" aria-label="Start voice call" disabled={callState !== 'idle'} onClick={startCall}><Phone size={18}/></button>}
        </header>
        {callState !== 'idle' && <div className="call-status"><span>{callState === 'active' ? `Voice call with ${callName}` : `Calling ${callName}…`}</span><button className="call-end-button" onClick={() => stopCall(true)}><PhoneOff size={16}/> End call</button></div>}
        <div className="message-list">{messages.map((message) => <div className={`message-row ${String(message.sender?._id) === String(profile?._id) ? 'mine' : ''}`} key={message._id}>
          {String(message.sender?._id) !== String(profile?._id) && <Avatar user={message.sender} size="sm"/>}
          <div className="message-stack">{active.type === 'group' && String(message.sender?._id) !== String(profile?._id) && <small className="message-sender-name">{message.sender?.displayName || message.sender?.username}</small>}
            <div className="message-bubble">{message.deletedAt ? 'Message removed' : message.body}{message.attachments?.map((attachment) => <MessageAttachment key={attachment.key} attachment={attachment}/>)}</div>
            <small>{new Date(message.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}{String(message.sender?._id) === String(profile?._id) && message.readBy?.length > 1 ? ' · Read' : ''}</small>
          </div>
        </div>)}{typing && <div className="typing-label">Someone is typing…</div>}<div ref={end}/></div>
        {attachments.length > 0 && <div className="chat-upload-list">{attachments.map((item) => <div className="chat-upload-item" key={item.key}>{item.type === 'image' ? <img src={item.url} alt=""/> : <FileText size={16}/>}<span>{item.name}</span><button aria-label="Remove attachment" onClick={() => setAttachments((items) => items.filter((file) => file.key !== item.key))}><X size={15}/></button></div>)}</div>}
        <form className="message-composer" onSubmit={send}>
          <label className="chat-attach-button" title="Attach media"><Paperclip size={18}/><input type="file" hidden multiple accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,application/pdf,text/plain" disabled={uploading || attachments.length >= 5} onChange={onFiles}/></label>
          <input value={text} onChange={(event) => { setText(event.target.value); socket?.emit('typing:start', { conversationId: active._id }); clearTimeout(window.typingTimeout); window.typingTimeout = setTimeout(() => socket?.emit('typing:stop', { conversationId: active._id }), 700); }} placeholder={uploading ? 'Uploading attachment…' : 'Write a message…'} maxLength={5000}/>
          <button className="send-message" disabled={uploading || (!text.trim() && !attachments.length)} aria-label="Send"><Send size={18}/></button>
        </form>
      </> : <div className="chat-empty-state"><span className="chat-empty-icon"><MessageCircle/></span><h2>Your conversations start here</h2><p>Send a little hello to someone in your circle.</p><button className="primary-button" onClick={start}>New message <Plus size={16}/></button></div>}
      {incomingCall && <div className="incoming-call"><div><b>{callName}</b><small>Incoming voice call</small></div><button className="primary-button" onClick={acceptCall}><Phone size={16}/> Answer</button><button className="call-end-button" onClick={() => { socket?.emit('call:end', { conversationId: incomingCall.conversationId, toUserId: incomingCall.caller._id }); setIncomingCall(null); }}><PhoneOff size={16}/> Decline</button></div>}
      <audio ref={remoteAudio} autoPlay playsInline className="remote-call-audio"/>
      {error && <div className="chat-error">{error}<button onClick={() => setError('')}>×</button></div>}
    </div>
    {pickerOpen && <div className="chat-picker-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !creatingChat) setPickerOpen(false); }}>
      <section className="chat-picker" role="dialog" aria-modal="true" aria-labelledby="chat-picker-title">
        <header className="chat-picker-header"><div><span className="eyebrow">START A CONVERSATION</span><h2 id="chat-picker-title">New message</h2></div><button className="icon-button" aria-label="Close" disabled={creatingChat} onClick={() => setPickerOpen(false)}><X/></button></header>
        <div className="chat-picker-modes" role="tablist" aria-label="Conversation type">
          <button type="button" role="tab" aria-selected={chatMode === 'individual'} className={chatMode === 'individual' ? 'selected' : ''} onClick={() => { setChatMode('individual'); setSelectedIds([]); setPickerError(''); }}>Individual</button>
          <button type="button" role="tab" aria-selected={chatMode === 'group'} className={chatMode === 'group' ? 'selected' : ''} onClick={() => { setChatMode('group'); setSelectedIds([]); setPickerError(''); }}>Group</button>
        </div>
        <label className="chat-picker-search"><input value={followingQuery} onChange={(event) => setFollowingQuery(event.target.value)} placeholder="Search people you follow" aria-label="Search people you follow"/></label>
        {chatMode === 'group' && <input className="chat-picker-group-name" maxLength={80} value={groupTitle} onChange={(event) => setGroupTitle(event.target.value)} placeholder="Group name (optional)" aria-label="Group name"/>}
        <div className="chat-picker-list">
          {followingLoading ? <p className="chat-picker-empty">Loading people you follow…</p> : following.filter((user) => `${user.displayName || ''} ${user.username || ''}`.toLowerCase().includes(followingQuery.trim().toLowerCase())).map((user) => {
            const id = String(user._id);
            const selected = selectedIds.includes(id);
            return <button type="button" className={`chat-picker-person ${selected ? 'selected' : ''}`} key={id} aria-pressed={selected} onClick={() => toggleParticipant(id)}>
              <Avatar user={user} size="md"/><span><b>{user.displayName || user.username}</b><small>@{user.username}</small></span><i>{selected ? '✓' : chatMode === 'group' ? '+' : ''}</i>
            </button>;
          })}
          {!followingLoading && following.filter((user) => `${user.displayName || ''} ${user.username || ''}`.toLowerCase().includes(followingQuery.trim().toLowerCase())).length === 0 && <p className="chat-picker-empty">{following.length ? 'No matches found.' : 'You are not following anyone yet.'}</p>}
        </div>
        {pickerError && <p className="chat-picker-error" role="alert">{pickerError}</p>}
        <footer className="chat-picker-footer"><small>{selectedIds.length ? `${selectedIds.length} selected` : chatMode === 'group' ? 'Select at least two people' : 'Select someone to message'}</small><button className="primary-button" disabled={creatingChat || selectedIds.length === 0 || (chatMode === 'group' && selectedIds.length < 2)} onClick={createChat}>{creatingChat ? 'Starting…' : chatMode === 'group' ? 'Create group' : 'Start chat'}</button></footer>
      </section>
    </div>}
  </section>;
}
