// Cầu nối giữa giao diện Coong (index.html, JS thuần) và Firebase.
// Giao diện gọi window.CoongAPI; mọi đọc/ghi đi qua src/db.js như app chủ quán.
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { doc, writeBatch } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { vietQR, qrMatrix } from './qr';
import {
  getUser, watchDevice, unlockDevice, lockDevice, watchMenu, watchOrders,
  createOrder, updateOrder, updateUserName, setPin, resetPinByName,
} from '../db';

const nowIso = () => new Date().toISOString();

// Đăng nhập ẩn danh một lần; mọi hàm bên dưới chờ uid này
const uidReady = new Promise((resolve, reject) => {
  const unsub = onAuthStateChanged(auth, (user) => {
    if (user) { unsub(); resolve(user.uid); return; }
    signInAnonymously(auth).catch(reject);
  });
});

// Thiết bị này đang mở khóa cho SĐT nào (null nếu chưa); chỉ lấy bản máy chủ đã chấp nhận
const currentDevice = () => uidReady.then((uid) => new Promise((resolve, reject) => {
  const unsub = watchDevice(uid, (d) => { unsub(); resolve(d); }, (e) => { unsub(); reject(e); });
}));

const isWrongPin = (e) => e && e.code === 'permission-denied';

// Mã QR chuyển khoản thật cho tờ thanh toán
window.CoongQR = { vietQR, qrMatrix };

window.CoongAPI = {
  ready: uidReady,

  /** SĐT đã mở khóa trên máy này, kèm hồ sơ; null nếu cần đăng nhập */
  async session() {
    const d = await currentDevice();
    if (!d) return null;
    const user = await getUser(d.phone);
    return user ? { phone: d.phone, name: user.name } : null;
  },

  lookup: (phone) => getUser(phone),

  /** Mở khóa bằng PIN. Trả về false nếu PIN sai. */
  async signIn(phone, pin) {
    const uid = await uidReady;
    if (await currentDevice()) await lockDevice(uid);
    try { await unlockDevice(uid, phone, pin); return true; }
    catch (e) { if (isWrongPin(e)) return false; throw e; }
  },

  /** Khách mới: tạo tài khoản, PIN và mở khóa thiết bị trong một lần ghi */
  async register(phone, name, pin) {
    const uid = await uidReady;
    if (await currentDevice()) await lockDevice(uid);
    const batch = writeBatch(db);
    batch.set(doc(db, 'users', phone), { name, role: 'customer' });
    batch.set(doc(db, 'pins', phone), { pin });
    batch.set(doc(db, 'devices', uid), { phone, pin, createdAt: nowIso() });
    await batch.commit();
  },

  async signOut() { await lockDevice(await uidReady); },

  setPin,
  rename: updateUserName,

  /** Quên PIN: tự đặt PIN mới bằng SĐT + tên đặt hàng rồi đăng nhập luôn. Trả về false nếu tên không khớp. */
  async resetPin(phone, name, pin) {
    const uid = await uidReady;
    if (await currentDevice()) await lockDevice(uid);
    try { await resetPinByName(uid, phone, name, pin); return true; }
    catch (e) { if (isWrongPin(e)) return false; throw e; }
  },

  watchMenu: (cb, onError) => watchMenu(cb, onError),
  watchOrders: (phone, cb, onError) => watchOrders(phone, false, cb, onError),

  /** Trả về id và số của đơn vừa tạo */
  async placeOrder(order) {
    const ref = await createOrder(order);
    return { id: ref.id, no: ref.no };
  },
  cancelOrder: (id) => updateOrder(id, { status: 'cancelled' }),
  claimPaid: (ids) => Promise.all(ids.map((id) => updateOrder(id, { paymentStatus: 'awaiting' }))),
};

window.dispatchEvent(new Event('coong-api'));
