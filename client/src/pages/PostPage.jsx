import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { api } from '../services/api.js';
import PostCard from '../components/PostCard.jsx';
export default function PostPage() { const { id } = useParams(); const [post, setPost] = useState(null); const [error, setError] = useState(''); useEffect(() => { api.get(`/posts/${id}`).then(({ data }) => setPost(data.post)).catch((e) => setError(e.message)); }, [id]); return <section className="page-narrow"><Link className="text-button back-post" to="/"><ArrowLeft size={15}/> Back to feed</Link>{error && <div className="error-banner">{error}</div>}{post ? <div className="post-list"><PostCard post={post}/></div> : !error && <div className="card skeleton"/>}</section>; }
