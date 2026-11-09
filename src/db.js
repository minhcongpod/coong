import {
  collection, doc, getDoc, onSnapshot, query, where, setDoc, updateDoc, deleteDoc, addDoc, writeBatch, runTransaction, increment,
} from 'firebase/firestore';
import { db } from './firebase';

// --- Cấu trúc dữ liệu Firestore ---
// meta/setup          { adminPhone }               SĐT chủ quán, tạo 1 lần khi thiết lập
// users/{phone}       { name, role }               role: 'admin' | 'customer'
// pins/{phone}        { pin }                      không đọc được từ app, chỉ quy tắc so sánh
// devices/{uid}       { phone, pin, createdAt }    thiết bị đã mở khóa bằng PIN
// meta/shop           { soldOut, soldText, openAt, closeAt, days } quán tạm ngưng nhận đơn / giờ mở cửa 'HH:MM'
// menu/{id}           { name, price, cost, image, active }
// orders/{id}         { no, customerPhone, customerName, items, note, totalAmount, status, paid, createdAt }
// counters/orders     { n }                        số đơn gần nhất; đơn mới lấy n + 1, đơn đầu tiên là #1234
// transactions/{id}   { type, amount, description, customerPhone?, walletPhone?, createdAt }
// wallets/{phone}     { balance, last?, refund? }   ví tiền của khách: chủ quán nạp, khách trả đơn bằng ví

const nowIso = () => new Date().toISOString();

const toList = (snap) => snap.docs.map(d => ({ id: d.id, ...d.data() }));

const byNewest = (a, b) => (b.createdAt || '').localeCompare(a.createdAt || '');

// --- Thiết lập & xác thực ---
export const getSetup = async () => {
  const snap = await getDoc(doc(db, 'meta', 'setup'));
  return snap.exists() ? snap.data() : null;
};

export const bootstrapAdmin = async (uid, { phone, name, pin }) => {
  const batch = writeBatch(db);
  batch.set(doc(db, 'meta', 'setup'), { adminPhone: phone, createdAt: nowIso() });
  batch.set(doc(db, 'users', phone), { name, role: 'admin' });
  batch.set(doc(db, 'pins', phone), { pin });
  batch.set(doc(db, 'devices', uid), { phone, pin, createdAt: nowIso() });
  await batch.commit();
};

export const getUser = async (phone) => {
  const snap = await getDoc(doc(db, 'users', phone));
  return snap.exists() ? { phone, ...snap.data() } : null;
};

// Bỏ qua bản ghi tạm trên máy: chỉ coi là mở khóa khi máy chủ đã chấp nhận PIN
export const watchDevice = (uid, cb, onError) =>
  onSnapshot(doc(db, 'devices', uid), { includeMetadataChanges: true }, (snap) => {
    if (snap.metadata.hasPendingWrites) return;
    cb(snap.exists() ? snap.data() : null);
  }, onError);

// Quy tắc Firestore từ chối nếu PIN sai, nên lỗi permission-denied nghĩa là sai PIN
export const unlockDevice = async (uid, phone, pin) => {
  await setDoc(doc(db, 'devices', uid), { phone, pin, createdAt: nowIso() });
};

export const lockDevice = (uid) => deleteDoc(doc(db, 'devices', uid));

// --- Lắng nghe dữ liệu realtime ---
export const watchShop = (cb, onError) =>
  onSnapshot(doc(db, 'meta', 'shop'), (snap) => cb(snap.exists() ? snap.data() : {}), onError);

export const saveShop = (patch) => setDoc(doc(db, 'meta', 'shop'), patch, { merge: true });

export const watchMenu = (cb, onError) =>
  onSnapshot(collection(db, 'menu'), (snap) => cb(toList(snap).sort((a, b) => a.name.localeCompare(b.name, 'vi'))), onError);

export const watchOrders = (phone, isAdmin, cb, onError) => {
  const ref = collection(db, 'orders');
  const q = isAdmin ? ref : query(ref, where('customerPhone', '==', phone));
  return onSnapshot(q, (snap) => cb(toList(snap).sort(byNewest)), onError);
};

export const watchTransactions = (cb, onError) =>
  onSnapshot(collection(db, 'transactions'), (snap) => cb(toList(snap).sort(byNewest)), onError);

export const watchUsers = (cb, onError) =>
  onSnapshot(collection(db, 'users'), (snap) => {
    const users = {};
    snap.docs.forEach(d => { users[d.id] = { phone: d.id, ...d.data() }; });
    cb(users);
  }, onError);

export const watchUser = (phone, cb, onError) =>
  onSnapshot(doc(db, 'users', phone), (snap) => cb(snap.exists() ? { phone, ...snap.data() } : null), onError);

// --- Menu ---
export const saveMenuItem = ({ id, ...data }) =>
  id ? updateDoc(doc(db, 'menu', id), data) : addDoc(collection(db, 'menu'), { ...data, active: true });

export const deleteMenuItem = (id) => deleteDoc(doc(db, 'menu', id));

export const seedMenu = async (items) => {
  const batch = writeBatch(db);
  items.forEach(({ id, ...item }) => batch.set(doc(collection(db, 'menu')), item));
  await batch.commit();
};

// --- Đơn hàng ---
export const FIRST_ORDER_NO = 1234;
// Mỗi đơn lấy số kế tiếp của bộ đếm trong cùng một giao dịch, nên hai đơn không trùng số
const nextOrder = (order) => runTransaction(db, async (tx) => {
  const counter = doc(db, 'counters', 'orders');
  const snap = await tx.get(counter);
  const no = snap.exists() ? snap.data().n + 1 : FIRST_ORDER_NO;
  const ref = doc(collection(db, 'orders'));
  let wallet = null;
  if (order.payMethod === 'wallet') {
    wallet = doc(db, 'wallets', order.customerPhone);
    const w = await tx.get(wallet), bal = w.exists() ? w.data().balance || 0 : 0;
    if (bal < order.totalAmount) { const e = new Error('Không đủ tiền trong ví'); e.code = 'wallet/insufficient'; throw e; }
    tx.update(wallet, { balance: bal - order.totalAmount, last: ref.id });
  }
  tx.set(counter, { n: no });
  tx.set(ref, { ...order, no, createdAt: nowIso() });
  return { id: ref.id, no };
});
// Hai máy đặt cùng lúc: máy chậm hơn bị quy tắc từ chối vì số đã bị lấy, nên thử lại với số mới
export const createOrder = async (order) => {
  for (let i = 0; ; i++) {
    try { return await nextOrder(order); }
    catch (e) { if (i >= 4 || e.code !== 'permission-denied') throw e; }
  }
};

// Xoá đơn kèm khoản thu tự tạo của đơn (nếu có)
export const deleteOrder = async (id, o) => {
  const b = writeBatch(db);
  if (o && walletPaid(o) && o.status !== 'cancelled') b.set(doc(db, 'wallets', o.customerPhone), { balance: increment(o.totalAmount || 0) }, { merge: true });
  b.delete(doc(db, 'orders', id));
  b.delete(doc(db, 'transactions', 'pay_' + id));
  await b.commit();
};
const walletPaid = (o) => o.payMethod === 'wallet' && o.paid;
export const updateOrder = (id, patch) => updateDoc(doc(db, 'orders', id), patch);
// Chủ quán huỷ đơn: đơn đã trả bằng ví thì hoàn tiền vào ví của khách
export const cancelOrderRefund = async (o) => {
  const b = writeBatch(db);
  b.update(doc(db, 'orders', o.id), { status: 'cancelled' });
  if (walletPaid(o) && o.status !== 'cancelled') b.set(doc(db, 'wallets', o.customerPhone), { balance: increment(o.totalAmount || 0) }, { merge: true });
  await b.commit();
};

// --- Ví tiền của khách ---
export const watchWallet = (phone, cb, onError) =>
  onSnapshot(doc(db, 'wallets', phone), (snap) => cb(snap.exists() ? snap.data().balance || 0 : null), onError);
// Khách nào đang bật thông báo Telegram (có bản ghi tg/số điện thoại)
export const watchTgLinked = (cb, onError) =>
  onSnapshot(collection(db, 'tg'), (snap) => cb(new Set(snap.docs.map((d) => d.id))), onError);

export const watchWallets = (cb, onError) =>
  onSnapshot(collection(db, 'wallets'), (snap) => { const m = {}; snap.docs.forEach((d) => { m[d.id] = d.data().balance || 0; }); cb(m); }, onError);

// --- Sổ thu chi ---
export const addTransaction = (tx) => addDoc(collection(db, 'transactions'), { ...tx, createdAt: nowIso() });

export const deleteTransaction = (id) => deleteDoc(doc(db, 'transactions', id));

// Khoản thu hoặc chi gắn tên khách = tiền vào ví khách (thu: khách nạp vào ví quán; chi: quán chuyển từ ví quán sang ví khách).
// Thêm/sửa/xoá thì ví của khách cộng/trừ tương ứng trong cùng một lần ghi.
const walletOf = (t) => (t && t.walletPhone ? { phone: t.walletPhone, n: t.amount || 0 } : null);
const walletDelta = (b, before, after) => {
  const d = {};
  const a = walletOf(before), z = walletOf(after);
  if (a) d[a.phone] = (d[a.phone] || 0) - a.n;
  if (z) d[z.phone] = (d[z.phone] || 0) + z.n;
  Object.entries(d).forEach(([phone, n]) => { if (n) b.set(doc(db, 'wallets', phone), { balance: increment(n) }, { merge: true }); });
};
export const saveTx = async (id, data) => {
  const b = writeBatch(db);
  const ref = id ? doc(db, 'transactions', id) : doc(collection(db, 'transactions'));
  if (id) {
    const old = await getDoc(ref);
    walletDelta(b, old.exists() ? old.data() : null, data);
    b.update(ref, { ...data, walletPhone: data.walletPhone || null, walletName: data.walletName || null });
  } else {
    walletDelta(b, null, data);
    b.set(ref, { ...data, createdAt: nowIso() });
  }
  await b.commit();
};
export const removeTx = async (id) => {
  const ref = doc(db, 'transactions', id), snap = await getDoc(ref), b = writeBatch(db);
  if (snap.exists()) walletDelta(b, snap.data(), null);
  b.delete(ref);
  await b.commit();
};

// Đơn đã thanh toán: ghi ngày thu (paidAt) và một khoản thu "Thu đơn" (id cố định để bỏ đánh dấu thì xoá lại được)
const payTxRef = (orderId) => doc(db, 'transactions', 'pay_' + orderId);
const payTxOf = (o, code, at) => ({ type: 'income', amount: o.totalAmount || 0, description: `${o.customerName || ''} TT ${code || ''}`.replace(/\s+/g, ' ').trim(), customerPhone: o.customerPhone, orderId: o.id, createdAt: at });
export const markPaid = async (o, code) => {
  const at = nowIso(), b = writeBatch(db);
  b.update(doc(db, 'orders', o.id), { paid: true, paymentStatus: 'confirmed', paidAt: at });
  b.set(payTxRef(o.id), payTxOf(o, code, at));
  await b.commit();
};
export const markUnpaid = async (o) => {
  const b = writeBatch(db);
  b.update(doc(db, 'orders', o.id), { paid: false, paymentStatus: null, paidAt: null });
  b.delete(payTxRef(o.id));
  await b.commit();
};
// Đơn tạo ra đã thanh toán luôn (chủ quán đặt hộ): ghi khoản thu tương ứng
export const recordPaidOrder = (o, code) => setDoc(payTxRef(o.id), payTxOf(o, code, o.paidAt || nowIso()));

// Thu đủ nợ: gạch nợ các đơn và ghi khoản thu trong cùng một lần ghi
export const collectDebt = async (orderIds, tx) => {
  const batch = writeBatch(db);
  orderIds.forEach(id => batch.update(doc(db, 'orders', id), { paid: true, paidAt: nowIso() }));
  batch.set(doc(collection(db, 'transactions')), { ...tx, createdAt: nowIso() });
  await batch.commit();
};

// --- Khách hàng ---
export const createCustomer = async ({ phone, name, pin }) => {
  const batch = writeBatch(db);
  batch.set(doc(db, 'users', phone), { name, role: 'customer' });
  batch.set(doc(db, 'pins', phone), { pin });
  await batch.commit();
};

export const updateUserName = (phone, name) => updateDoc(doc(db, 'users', phone), { name });

export const setPin = (phone, pin) => setDoc(doc(db, 'pins', phone), { pin });

export const deleteCustomer = async (phone) => {
  const batch = writeBatch(db);
  batch.delete(doc(db, 'users', phone));
  batch.delete(doc(db, 'pins', phone));
  await batch.commit();
};

// Quên PIN: đặt PIN mới bằng SĐT + tên đặt hàng và mở khóa máy này trong cùng một lần ghi
export const resetPinByName = async (uid, phone, name, pin) => {
  const batch = writeBatch(db);
  batch.set(doc(db, 'pins', phone), { pin });
  batch.set(doc(db, 'devices', uid), { phone, pin, resetName: name, createdAt: nowIso() });
  await batch.commit();
};
