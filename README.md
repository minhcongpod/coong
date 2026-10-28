# CongCa Coffee

Web app đặt café cho quán CongCa (React + Vite + Tailwind).

## Chạy thử

```bash
npm install
npm run dev
```

Mở `http://localhost:5173/?user=admin` (PIN `0000`) để vào giao diện chủ quán,
hoặc `http://localhost:5173/?user=0912345678` (PIN `5678`) để vào giao diện khách.

## Lưu ý

Dữ liệu hiện vẫn lưu trong `localStorage` của từng trình duyệt, nên chủ quán và khách
chưa thấy chung đơn hàng khi dùng trên hai thiết bị khác nhau. Bước tiếp theo là chuyển
sang Firebase (Firestore + đăng nhập phía server).
