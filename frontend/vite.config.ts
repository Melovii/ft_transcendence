import { fileURLToPath, URL } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

// Same-origin model: in production a
// reverse proxy serves the SPA and forwards /api and /ws to the Gateway. Local dev
// mirrors that with this proxy instead of a second origin + CORS, which is what makes
// the HttpOnly `ft_session` cookie attach automatically to REST calls and WS upgrades.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const target = env.VITE_DEV_PROXY_TARGET ?? 'http://localhost:3000';

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@app': fileURLToPath(new URL('./src/app', import.meta.url)),
        '@features': fileURLToPath(new URL('./src/features', import.meta.url)),
        '@layouts': fileURLToPath(new URL('./src/layouts', import.meta.url)),
        '@shared': fileURLToPath(new URL('./src/shared', import.meta.url)),
        '@assets': fileURLToPath(new URL('./src/assets', import.meta.url)),
      },
    },
    server: {
      proxy: {
        '/api': { target, changeOrigin: false },
        '/ws': { target, changeOrigin: false, ws: true },
      },
    },
  };
});
