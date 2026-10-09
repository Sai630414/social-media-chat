import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../services/supabase.js';
import { api } from '../services/api.js';
const AuthContext = createContext(null);
export function AuthProvider({ children }) { const [session, setSession] = useState(null); const [profile, setProfile] = useState(null); const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  const syncProfile = async () => { const { data: { session: current } } = await supabase.auth.getSession(); setSession(current); if (current) { try { const { data } = await api.get('/profiles/me'); setProfile(data.user); setError(''); } catch (err) { setProfile(null); setError(err.message); } } else setProfile(null); setLoading(false); };
  useEffect(() => { if (!isSupabaseConfigured) { setLoading(false); return; } syncProfile(); const { data: { subscription } } = supabase.auth.onAuthStateChange(() => { queueMicrotask(syncProfile); }); return () => subscription.unsubscribe(); }, []);
  const value = useMemo(() => ({ session, profile, loading, error, configured: isSupabaseConfigured, refreshProfile: syncProfile, signOut: () => supabase?.auth.signOut(), signIn: (email, password) => supabase.auth.signInWithPassword({ email, password }), signUp: (email, password, displayName) => supabase.auth.signUp({ email, password, options: { data: { full_name: displayName } } }), signInGoogle: () => supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } }), resetPassword: (email) => supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` }) }), [session, profile, loading, error]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>; }
export const useAuth = () => useContext(AuthContext);
