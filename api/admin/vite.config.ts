import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Served by the API under /moderation; in dev, API calls are proxied to the local API.
export default defineConfig({
  plugins: [react()],
  base: '/moderation/',
  server: {
    port: 5174,
    proxy: { '/admin': 'http://localhost:3000' },
  },
});
