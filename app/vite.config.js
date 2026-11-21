import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [react(), tailwind()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  build: {
    chunkSizeWarningLimit: 900,
    // Libraries go in their own file. They change rarely, so after an update a returning player re-downloads only the app's own code.
    rolldownOptions: { output: { advancedChunks: { groups: [{ name: 'vendor', test: /node_modules/ }] } } },
  },
});
