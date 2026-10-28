import { defineConfig } from 'vite';

// Build service worker thành một file IIFE duy nhất ở gốc trang
export default defineConfig({
  publicDir: false,
  build: {
    emptyOutDir: false,
    lib: {
      entry: 'src/sw.js',
      formats: ['iife'],
      name: 'congcaSw',
      fileName: () => 'firebase-messaging-sw.js',
    },
  },
});
