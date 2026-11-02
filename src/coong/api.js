// Cầu nối giữa giao diện Coong (index.html, JS thuần) và Firebase.
// Giao diện gọi window.CoongAPI; mọi đọc/ghi đi qua src/db.js như app chủ quán.
import { APP_URL, tgToAdmin, tgToCustomer, getTgCfg, peekTgCfg, itemsText, tgDebtText, getTgChat, setTgChat, clearTgChat, tgNewCode, tgDeepLink, tgWaitChat } from '../telegram';
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { doc, writeBatch, increment } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { vietQR, qrMatrix } from './qr';
import { fireworks } from './fireworks';
import {
  getUser, watchDevice, unlockDevice, lockDevice, watchMenu, watchOrders, watchShop,
  createOrder, updateOrder, watchWallet, updateUserName, setPin, resetPinByName,
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
    tgToAdmin(`📣 Khách mới: ${name} · ${phone}`, null); // không kèm link
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
  watchShop: (cb, onError) => watchShop(cb, onError),
  watchOrders: (phone, cb, onError) => watchOrders(phone, false, cb, onError),
  /** Số dư ví tiền (null nếu quán chưa nạp cho khách này) */
  watchWallet: (phone, cb, onError) => watchWallet(phone, cb, onError),

  /** Trả về id và số của đơn vừa tạo */
  async placeOrder(order) {
    const ref = await createOrder(order);
    const its = itemsText(order.items);
    const wl = order.payMethod === 'wallet' ? ' (đã trả bằng ví tiền)' : '';
    tgToAdmin(`📣 ${order.customerName} đã đặt ${its}${wl}.`, `${APP_URL}/admin/order/#${String(ref.no).padStart(4, '0')}`, 'Xác nhận ngay');
    tgToCustomer(order.customerPhone, `📣 Bạn đã đặt thành công ${its}. Coong sẽ xác nhận đơn của bạn trong giây lát.`, `${APP_URL}/order/#${String(ref.no).padStart(4, '0')}`);
    return { id: ref.id, no: ref.no };
  },
  cancelOrder: async (id, info) => {
    if (info && info.wallet) {
      // đơn đã trả bằng ví: huỷ và hoàn tiền vào ví trong cùng một lần ghi
      const b = writeBatch(db);
      b.update(doc(db, 'orders', id), { status: 'cancelled' });
      b.set(doc(db, 'wallets', info.phone), { balance: increment(info.total), refund: id }, { merge: true });
      await b.commit();
    } else await updateOrder(id, { status: 'cancelled' });
    // khách tự huỷ: Telegram không nhắn lại cho khách, chỉ báo quán
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
    return tgWaitChat(c.token, code).then(async (chat) => { if (!chat) return false; await setTgChat(phone, chat);
      // chào mừng ngay sau khi khách bấm Start
      tgToCustomer(phone, '✨ Telegram đã kết nối thành công! Chào mừng bạn đến với Coong ☕️\nMột dự án nhỏ với 100% tâm huyết, rất mong nhận được những góp ý từ bạn để tối ưu trải nghiệm mỗi ngày.\n🚀', `${APP_URL}/menu`, 'Đặt hàng ngay nhé!');
      return true;
    });
  },
};

window.dispatchEvent(new Event('coong-api'));
