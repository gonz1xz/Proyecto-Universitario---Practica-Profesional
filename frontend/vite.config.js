import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode, command }) => {
  const env = loadEnv(mode, '.', '');

  if (command === 'build' && process.env.VERCEL === '1') {
    let apiUrl;
    try { apiUrl = new URL(env.VITE_API_URL); } catch { throw new Error('Configurá VITE_API_URL en Vercel con la URL HTTPS del backend terminada en /api.'); }
    if (apiUrl.protocol !== 'https:' || apiUrl.username || apiUrl.password || apiUrl.search || apiUrl.hash || !/^\/api\/?$/.test(apiUrl.pathname)) {
      throw new Error('VITE_API_URL debe ser una URL HTTPS sin credenciales ni parámetros, terminada en /api.');
    }
  }

  return {
    plugins: [react(), tailwindcss()],
    server: {
      proxy: {
        '/api': {
          target: env.VITE_BACKEND_URL || 'http://localhost:3001',
          changeOrigin: true,
        },
      },
    },
  };
});
