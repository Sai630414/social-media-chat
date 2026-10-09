import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(10).default(0),
  CLIENT_URL: z.string().default('http://localhost:5173'),
  MONGODB_URI: z.string().trim().min(1),
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().trim().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().trim().optional(),
  CLOUDINARY_CLOUD_NAME: z.string().trim().optional(),
  CLOUDINARY_API_KEY: z.string().trim().optional(),
  CLOUDINARY_API_SECRET: z.string().trim().optional(),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
}).superRefine((value, context) => {
  if (!/^mongodb(?:\+srv)?:\/\//i.test(value.MONGODB_URI)) context.addIssue({ code: 'custom', path: ['MONGODB_URI'], message: 'Must be a MongoDB connection URI.' });
  const origins = value.CLIENT_URL.split(',').map((item) => item.trim()).filter(Boolean);
  if (!origins.length) context.addIssue({ code: 'custom', path: ['CLIENT_URL'], message: 'At least one client origin is required.' });
  for (const origin of origins) {
    try {
      const parsed = new URL(origin);
      const local = ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname);
      if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password || parsed.pathname !== '/' || parsed.search || parsed.hash) throw new Error();
      if (value.NODE_ENV === 'production' && (!parsed.protocol.startsWith('https') || local)) throw new Error();
    } catch {
      context.addIssue({ code: 'custom', path: ['CLIENT_URL'], message: `Invalid ${value.NODE_ENV} client origin: ${origin}` });
    }
  }
  const cloudinary = [value.CLOUDINARY_CLOUD_NAME, value.CLOUDINARY_API_KEY, value.CLOUDINARY_API_SECRET];
  if (cloudinary.some(Boolean) && !cloudinary.every(Boolean)) context.addIssue({ code: 'custom', path: ['CLOUDINARY_CLOUD_NAME'], message: 'Set all Cloudinary credentials together.' });
  if (value.NODE_ENV === 'production' && !cloudinary.every(Boolean)) context.addIssue({ code: 'custom', path: ['CLOUDINARY_CLOUD_NAME'], message: 'Cloudinary credentials are required in production.' });
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) { console.error('Invalid server environment:', parsed.error.flatten().fieldErrors); process.exit(1); }
export const env = parsed.data;
export const clientOrigins = env.CLIENT_URL.split(',').map((origin) => new URL(origin.trim()).origin);
