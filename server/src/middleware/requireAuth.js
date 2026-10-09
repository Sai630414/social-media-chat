import { supabase } from '../config/supabase.js';
import { User } from '../models/User.js';
import { HttpError } from '../utils/httpError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const requireAuth = asyncHandler(async (req, res, next) => {
  const token = req.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) throw new HttpError(401, 'Sign in to continue.', 'UNAUTHENTICATED');
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) throw new HttpError(401, 'Your session is invalid or expired.', 'UNAUTHENTICATED');
  const identity = data.user;
  const usernameBase = (identity.user_metadata?.user_name || identity.email?.split('@')[0] || 'member').toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20) || 'member';
  let profile = await User.findOne({ supabaseId: identity.id });
  if (!profile) {
    let username = usernameBase, suffix = 0;
    while (await User.exists({ username })) username = `${usernameBase}${++suffix}`;
    profile = await User.create({ supabaseId: identity.id, username, displayName: identity.user_metadata?.full_name || identity.user_metadata?.name || username, email: identity.email, avatar: identity.user_metadata?.avatar_url || '' });
  }
  if (profile.status === 'suspended') throw new HttpError(403, 'This account is suspended.', 'ACCOUNT_SUSPENDED');
  req.auth = { identity, user: profile }; next();
});
