import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({ plugins: [react({ jsxRuntime: 'automatic' })], build: { rollupOptions: { output: { manualChunks(id) { if (!id.includes('node_modules')) return; if (/\/react-dom\/|\/react\/|\/scheduler\//.test(id)) return 'react-vendor'; if (id.includes('/@supabase/')) return 'supabase-vendor'; if (id.includes('/lucide-react/')) return 'icons-vendor'; if (/\/socket.io-client\/|\/engine.io-client\/|\/socket.io-parser\/|\/axios\//.test(id)) return 'network-vendor'; } } } } });
