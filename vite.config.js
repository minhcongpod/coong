import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Hai trang: index.html là app khách (giao diện Coong), admin.html là app React
// cho chủ quán (/admin) và trang quản lý cũ (/quanly)
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: { main: 'index.html', admin: 'admin.html' },
    },
  },
});
