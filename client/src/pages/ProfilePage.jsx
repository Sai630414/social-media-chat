import { useEffect, useState } from 'react';
import { CalendarDays, Link2, MoreHorizontal, X } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../services/api.js';
import { uploadMedia } from '../services/media.js';
import { useAuth } from '../context/AuthContext.jsx';
import Avatar from '../components/Avatar.jsx';
import PostCard from '../components/PostCard.jsx';
import '../styles/connections.css';

export default function ProfilePage() {
  const { username } = useParams();
  const { profile, refreshProfile } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [connections, setConnections] = useState(null);
  const [connectionsLoading, setConnectionsLoading] = useState(false);
  const [connectionsError, setConnectionsError] = useState('');
  const [connectionBusy, setConnectionBusy] = useState('');
  const own = profile?.username === username;

  const load = async () => {
    try {
      const { data: result } = await api.get(`/profiles/${username}`);
      setData(result);
    } catch (e) {
      setError(e.message);
    }
  };

  useEffect(() => { load(); }, [username]);

  const follow = async () => {
    setBusy(true);
    try {
      if (data.relationship?.follows || data.relationship?.requested) await api.delete(`/profiles/${data.user._id}/follow`);
      else await api.post(`/profiles/${data.user._id}/follow`);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const edit = async () => {
    const displayName = prompt('Display name', profile.displayName) ?? profile.displayName;
    const bio = prompt('Bio', profile.bio || '') ?? (profile.bio || '');
    const isPrivate = confirm('Make this account private? Choose Cancel to keep it public.');
    try {
      await api.patch('/profiles/me', { displayName, bio, isPrivate });
      await refreshProfile();
      await load();
    } catch (e) {
      setError(e.message);
    }
  };

  const uploadAvatar = async (file) => {
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      const uploaded = await uploadMedia(file, 'avatar');
      await api.patch('/profiles/me', { avatar: `cloudinary:${uploaded.key}` });
      await refreshProfile();
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const block = async () => {
    if (!confirm(`Block @${data.user.username}?`)) return;
    try {
      await api.post(`/profiles/${data.user._id}/block`);
      setError('Account blocked.');
    } catch (e) {
      setError(e.message);
    }
  };

  const openConnections = async (type) => {
    setConnections({ type, users: [] });
    setConnectionsLoading(true);
    setConnectionsError('');
    try {
      const { data: result } = await api.get(`/profiles/${username}/${type}`);
      setConnections({ type, users: result.users || [] });
    } catch (e) {
      setConnectionsError(e.message);
    } finally {
      setConnectionsLoading(false);
    }
  };

  const unfollowFromList = async (user) => {
    setConnectionBusy(user._id);
    try {
      await api.delete(`/profiles/${user._id}/follow`);
      setConnections((current) => current && ({
        ...current,
        users: current.users.filter((item) => item._id !== user._id),
      }));
      setData((current) => current && ({
        ...current,
        stats: { ...current.stats, following: Math.max(0, current.stats.following - 1) },
      }));
    } catch (e) {
      setConnectionsError(e.message);
    } finally {
      setConnectionBusy('');
    }
  };

  if (error && !data) return <section className="page-narrow"><div className="error-banner">{error}</div></section>;
  if (!data) return <section className="page-narrow"><div className="card skeleton profile-skeleton"/></section>;

  return <>
    <section className="page-narrow profile-page">
      <div className="profile-cover" style={data.user.coverImage?.startsWith('r2key:') ? {} : data.user.coverImage ? { backgroundImage: `url(${data.user.coverImage})` } : {}}/>
      <div className="profile-main card">
        <div className="profile-actions">
          <Avatar user={data.user} size="xl"/>
          {own ? <div className="profile-action-row">
            <button className="outline-button" onClick={edit}>Edit profile</button>
            <label className="outline-button avatar-upload">Photo<input type="file" accept="image/jpeg,image/png,image/webp" hidden disabled={busy} onChange={(e) => uploadAvatar(e.target.files?.[0])}/></label>
          </div> : <div className="profile-action-row">
            <button className="primary-button" disabled={busy} onClick={follow}>{data.relationship?.follows ? 'Following' : data.relationship?.requested ? 'Requested' : 'Follow'}</button>
            <button className="icon-button" title="More" onClick={block}><MoreHorizontal/></button>
          </div>}
        </div>
        <h2>{data.user.displayName || data.user.username} {data.user.isPrivate && <span className="private-label">PRIVATE</span>}</h2>
        <p className="profile-handle">@{data.user.username}</p>
        {data.private ? <div className="private-lock"><h3>This account is private</h3><p>Follow to see their photos and posts.</p></div> : <>
          {data.user.bio && <p className="profile-bio">{data.user.bio}</p>}
          <div className="profile-meta">
            {data.user.website && <a href={data.user.website} target="_blank" rel="noreferrer"><Link2 size={15}/>{data.user.website}</a>}
            <span><CalendarDays size={15}/> Joined {new Date(data.user.createdAt).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</span>
          </div>
          <div className="profile-stats">
            <span><b>{data.stats.posts}</b> posts</span>
            <button className="profile-stat-button" onClick={() => openConnections('followers')}><b>{data.stats.followers}</b> followers</button>
            <button className="profile-stat-button" onClick={() => openConnections('following')}><b>{data.stats.following}</b> following</button>
          </div>
        </>}
      </div>
      {!data.private && <>
        <div className="profile-tabs"><span className="tab-active">Posts</span></div>
        <div className="post-list">{data.posts.map((post) => <PostCard key={post._id} post={post}/>)}</div>
        {!data.posts.length && <div className="empty-state card"><h3>No posts yet</h3><p>When they share something, you'll find it here.</p></div>}
      </>}
    </section>
    {connections && <div className="connections-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setConnections(null); }}>
      <section className="connections-dialog" role="dialog" aria-modal="true" aria-labelledby="connections-title">
        <header className="connections-header">
          <h2 id="connections-title">{connections.type === 'followers' ? 'Followers' : 'Following'}</h2>
          <button className="icon-button" aria-label="Close connections" onClick={() => setConnections(null)}><X size={18}/></button>
        </header>
        {connectionsError && <div className="error-banner">{connectionsError}</div>}
        <div className="connections-list" aria-live="polite">
          {connectionsLoading ? <p className="connections-message">Loading people…</p> : connections.users.map((user) => <div className="connection-row" key={user._id}>
            <Link className="connection-profile" to={`/profile/${user.username}`} onClick={() => setConnections(null)}>
              <Avatar user={user}/>
              <span><b>{user.displayName || user.username}</b><small>@{user.username}</small></span>
            </Link>
            {own && connections.type === 'following' && <button className="outline-button connection-unfollow" disabled={connectionBusy === user._id} onClick={() => unfollowFromList(user)}>{connectionBusy === user._id ? 'Removing…' : 'Unfollow'}</button>}
          </div>)}
          {!connectionsLoading && !connectionsError && !connections.users.length && <p className="connections-message">No {connections.type} yet.</p>}
        </div>
      </section>
    </div>}
  </>;
}