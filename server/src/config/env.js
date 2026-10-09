import { z } from 'zod';

const schema = z.object({ PORT: z.coerce.number().default(4000), CLIENT_URL: z.string().default('http://localhost:5173'), MONGODB_URI: z.string().min(1), SUPABASE_URL: z.string().url(), SUPABASE_ANON_KEY: z.string().optional(), SUPABASE_SERVICE_ROLE_KEY: z.string().optional(), CLOUDINARY_CLOUD_NAME: z.string().optional(), CLOUDINARY_API_KEY: z.string().optional(), CLOUDINARY_API_SECRET: z.string().optional(), LOG_LEVEL: z.string().default('info') });
const parsed = schema.safeParse(process.env);
if (!parsed.success) { console.error('Invalid server environment:', parsed.error.flatten().fieldErrors); process.exit(1); }
export const env = parsed.data;
