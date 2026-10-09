import { z } from 'zod';

const schema = z.object({ PORT: z.coerce.number().default(4000), CLIENT_URL: z.string().default('http://localhost:5173'), MONGODB_URI: z.string().min(1), SUPABASE_URL: z.string().url(), SUPABASE_ANON_KEY: z.string().optional(), SUPABASE_SERVICE_ROLE_KEY: z.string().optional(), R2_ACCOUNT_ID: z.string().optional(), R2_ACCESS_KEY_ID: z.string().optional(), R2_SECRET_ACCESS_KEY: z.string().optional(), R2_BUCKET_NAME: z.string().optional(), R2_ENDPOINT: z.string().optional(), R2_PUBLIC_BASE_URL: z.string().optional(), LOG_LEVEL: z.string().default('info') });
const parsed = schema.safeParse(process.env);
if (!parsed.success) { console.error('Invalid server environment:', parsed.error.flatten().fieldErrors); process.exit(1); }
export const env = parsed.data;
