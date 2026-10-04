import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        secure: false,
        configure: (proxy) => {
          proxy.on('error', (_err, _req, res) => {
            const response = res as { headersSent?: boolean; writeHead?: (code: number, headers: Record<string, string>) => void; end?: (body: string) => void };
            if (!response.writeHead || response.headersSent) return;
            response.writeHead(502, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({
              detail: 'Cannot reach the API on port 8000. Start the backend, then try again.',
            }));
          });
        },
      },
    },
  },
});
