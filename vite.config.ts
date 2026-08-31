import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  // NOTE: Client-side Gemini key is a known prototype risk — migrate to server proxy in P1.
  const geminiKey = env.GEMINI_API_KEY || env.VITE_GEMINI_API_KEY || '';

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    define: {
      'process.env.API_KEY': JSON.stringify(geminiKey),
      'process.env.GEMINI_API_KEY': JSON.stringify(geminiKey),
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
      strictPort: false,
    },
    preview: {
      port: 4173,
      host: '0.0.0.0',
    },
    build: {
      outDir: 'dist',
      sourcemap: true,
      rollupOptions: {
        output: {
          manualChunks: {
            react: ['react', 'react-dom', 'react-router-dom'],
            charts: ['recharts'],
          },
        },
      },
    },
  };
});
