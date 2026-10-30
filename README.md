# CongCa Coffee

Web app đặt café cho quán CongCa (React + Vite + Tailwind + Firebase).

## Cách hoạt động

- Dữ liệu (menu, đơn hàng, khách, sổ thu chi) lưu trên Firestore, đồng bộ realtime giữa các điện thoại.
- Mỗi điện thoại đăng nhập ẩn danh với Firebase. Khi nhập đúng PIN, thiết bị được "mở khóa"
  cho đúng SĐT đó. PIN được kiểm tra bởi quy tắc bảo mật phía server (`firestore.rules`),
  app không đọc được PIN.
- Chủ quán thêm khách trong tab **Khách**, rồi gửi link gốc https://coong-59ede.web.app cho khách.
  Khách mở link, nhập SĐT rồi nhập PIN. Máy nhớ SĐT cho lần sau.
  PIN mặc định của khách là 4 số cuối SĐT; khách tự đổi được trong tab Tài khoản.
- Lần đầu mở app sẽ hiện màn **Thiết lập quán** để tạo tài khoản chủ quán. Sau đó chủ quán
  cũng vào bằng SĐT + PIN ở link gốc.

## Thông báo

- Khi app đang mở: có đơn mới thì chủ quán nghe chuông, rung máy và thấy thông báo trong app.
  Khách nhận báo khi đơn chuyển sang "Đã xong".
- Khi app đã tắt: Cloud Functions (`functions/`) gửi thông báo đẩy qua Firebase Cloud Messaging.
  Cần gói Blaze và key Web Push đặt ở `VAPID_KEY` trong `src/firebaseConfig.js`.
  Trên iPhone (iOS 16.4+), phải "Thêm vào MH chính" rồi mở app từ đó và bấm "Bật thông báo".

## Triển khai lên Firebase

Cần Node.js 18+ trên máy tính.

```bash
npm install
(cd functions && npm install)
npm run build
npx firebase-tools login
npx firebase-tools deploy
```

Lệnh `deploy` đưa quy tắc bảo mật Firestore, Cloud Functions (cần gói Blaze) và trang web lên Firebase Hosting
(địa chỉ dạng `https://coong-59ede.web.app`).

Nếu chỉ muốn cập nhật quy tắc bằng tay: Firebase Console → Firestore → tab Rules,
dán nội dung `firestore.rules` rồi bấm Publish.

## Chạy thử trên máy

```bash
npm run dev
```

Chạy với trình giả lập Firebase (không đụng vào dữ liệu thật):

```bash
npx firebase-tools emulators:start --only auth,firestore
VITE_USE_EMULATOR=1 npm run dev
```
