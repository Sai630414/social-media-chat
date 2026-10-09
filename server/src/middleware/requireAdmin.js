import { HttpError } from '../utils/httpError.js';
export function requireAdmin(req, res, next) { if (req.auth?.user?.role !== 'admin') return next(new HttpError(403, 'Administrator access is required.', 'FORBIDDEN')); next(); }
