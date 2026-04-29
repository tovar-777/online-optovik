import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  server: {
    host: true,
  },
  resolve: {
    alias: {
      '@shared': resolve(__dirname, 'shared'),
    },
  },
  build: {
    rollupOptions: {
      input: {
        client: resolve(__dirname, 'client/index.html'),
        admin: resolve(__dirname, 'admin/index.html'),
        editor: resolve(__dirname, 'order-editor/index.html'),
        logistics: resolve(__dirname, 'logistics/index.html'),
      },
    },
  },
});
