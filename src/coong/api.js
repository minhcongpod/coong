// Cầu nối giữa giao diện Coong (index.html, JS thuần) và Firebase.
// Giao diện gọi window.CoongAPI; mọi đọc/ghi đi qua src/db.js như app chủ quán.
import { APP_URL, tgToAdmin, tgToCustomer, getTgCfg, peekTgCfg, itemsText, tgDebtText, getTgChat, setTgChat, clearTgChat, tgNewCode, tgDeepLink, tgWaitChat } from '../telegram';
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { doc, writeBatch } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { vietQR, qrMatrix } from './qr';
import { fireworks } from './fireworks';
import {
  getUser, watchDevice, unlockDevice, lockDevice, watchMenu, watchOrders, watchShop,
  createOrder, updateOrder, updateUserName, setPin, resetPinByName, clearFresh,
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
window.CoongFX = { fireworks };

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
    tgToAdmin(`📣 Khách mới: ${name} · ${phone}`);
  },

  async signOut() { await lockDevice(await uidReady); },

  setPin,
  rename: updateUserName,

  /** Quên PIN: tự đặt PIN mới bằng SĐT + tên đặt hàng rồi đăng nhập luôn. Trả về false nếu tên không khớp. */
  async resetPin(phone, name, pin) {
    const uid = await uidReady;
    if (await currentDevice()) await lockDevice(uid);
    try {
      await resetPinByName(uid, phone, name, pin);
      try { const u = await getUser(phone); if (u && u.fresh) await clearFresh(phone); } catch (e) {}
      return true;
    }
    catch (e) { if (isWrongPin(e)) return false; throw e; }
  },

  watchMenu: (cb, onError) => watchMenu(cb, onError),
  watchShop: (cb, onError) => watchShop(cb, onError),
  watchOrders: (phone, cb, onError) => watchOrders(phone, false, cb, onError),

  /** Trả về id và số của đơn vừa tạo */
  async placeOrder(order) {
    const ref = await createOrder(order);
    const its = itemsText(order.items);
    tgToAdmin(`📣 ${order.customerName} đã đặt ${its}.`, `${APP_URL}/admin/order/#${String(ref.no).padStart(4, '0')}`, 'Xác nhận ngay');
    tgToCustomer(order.customerPhone, `📣 Bạn đã đặt thành công ${its}. Coong sẽ xác nhận đơn của bạn trong giây lát.`, `${APP_URL}/order/#${String(ref.no).padStart(4, '0')}`);
    return { id: ref.id, no: ref.no };
  },
  cancelOrder: async (id, info) => {
    await updateOrder(id, { status: 'cancelled' });
    if (info && info.phone) tgToCustomer(info.phone, `❌ Coong đã huỷ đơn hàng ${info.items || ''} của bạn. Tiếc ghê, hẹn gặp lại bạn lần sau nhé!`, `${APP_URL}/order/${info.code}`);
    if (info) tgToAdmin(`❌ ${info.name} đã hủy đơn ${info.items || info.code}.`, `${APP_URL}/admin/order/${info.code}`);
  },
  claimPaid: async (ids, info) => {
    await Promise.all(ids.map((id) => updateOrder(id, { paymentStatus: 'awaiting' })));
    if (info) tgToAdmin(`📣 ${info.name} báo đã thanh toán ${info.total.toLocaleString('vi-VN')}đ.`, `${APP_URL}/admin/wallet${info.phone ? `?pay=${info.phone}` : ''}`, 'Xác nhận ngay');
  },

  /** Telegram: quán đã cài bot chưa, và khách này đã gắn Telegram chưa */
  async tgState(phone) {
    const c = await getTgCfg(true);
    return { on: !!(c.token && c.bot), linked: !!(await getTgChat(phone)) };
  },
  /** Khách tắt thông báo Telegram: bỏ liên kết, quán không gửi tin nữa */
  tgOff(phone) { return clearTgChat(phone); },
  /** Mở bot Telegram kèm mã rồi chờ khách bấm Start; gọi ngay trong lúc bấm nút để trình duyệt cho mở cửa sổ */
  tgConnect(phone) {
    const c = peekTgCfg();
    if (!c || !c.token || !c.bot) return Promise.resolve(false);
    const code = tgNewCode();
    window.open(tgDeepLink(c.bot, code), '_blank');
    return tgWaitChat(c.token, code).then(async (chat) => { if (!chat) return false; await setTgChat(phone, chat); return true; });
  },
};

window.dispatchEvent(new Event('coong-api'));
