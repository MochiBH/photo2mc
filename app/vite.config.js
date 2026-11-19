import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';

// One plain script (app.js) and one stylesheet (app.css); scripts/assemble.mjs turns them into the artifact page.
export default defineConfig({
  plugins: [react(), tailwind()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  define: { 'process.env.NODE_ENV': '"production"' },
  build: {
    cssCodeSplit: false,
    rollupOptions: {
      input: 'src/main.jsx',
      output: { format: 'iife', entryFileNames: 'app.js', assetFileNames: 'app.[ext]', inlineDynamicImports: true },
    },
  },
});
