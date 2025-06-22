import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  
  return {
    plugins: [react()],
    define: {
      'process.env.VITE_GEMINI_API_KEY': JSON.stringify(env.VITE_GEMINI_API_KEY),
      'process.env.VITE_GROQ_API_KEY': JSON.stringify(env.VITE_GROQ_API_KEY),
      'process.env.VITE_VAPI_API_KEY': JSON.stringify(env.VITE_VAPI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    optimizeDeps: {
      include: ['pdfjs-dist'],
    },
    server: {
      fs: {
        allow: ['..']
      }
    }
  };
});