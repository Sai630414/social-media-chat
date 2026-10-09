import { createClient } from '@supabase/supabase-js';
import { env } from './env.js';
const key = env.SUPABASE_ANON_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
if (!key) { console.error('Set SUPABASE_ANON_KEY (or server-only SUPABASE_SERVICE_ROLE_KEY) to verify access tokens.'); process.exit(1); }
export const supabase = createClient(env.SUPABASE_URL, key, { auth: { persistSession: false, autoRefreshToken: false } });
