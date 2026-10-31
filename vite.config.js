import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Hai trang: index.html là app khách (giao diện Coong), admin.html là app React
// cho chủ quán (/admin) và trang quản lý cũ (/quanly)
// Mỗi lần build có một mã riêng gắn vào index.html để app tự biết khi có bản mới
const buildId = () => ({
  name: 'build-id',
  transformIndexHtml: (html) => html.replace('__BUILD__', String(Date.now())),
});

export default defineConfig({
  plugins: [react(), buildId()],
  build: {
    rollupOptions: {
      input: { main: 'index.html', admin: 'admin.html' },
    },
  },
});
