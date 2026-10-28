import {
  collection, doc, getDoc, onSnapshot, query, where, setDoc, updateDoc, deleteDoc, addDoc, writeBatch,
} from 'firebase/firestore';
import { db } from './firebase';

// --- Cấu trúc dữ liệu Firestore ---
// meta/setup          { adminPhone }               SĐT chủ quán, tạo 1 lần khi thiết lập
// users/{phone}       { name, role }               role: 'admin' | 'customer'
// pins/{phone}        { pin }                      không đọc được từ app, chỉ quy tắc so sánh
// devices/{uid}       { phone, pin, createdAt }    thiết bị đã mở khóa bằng PIN
// menu/{id}           { name, price, cost, image, active }
// orders/{id}         { customerPhone, customerName, items, note, totalAmount, status, paid, createdAt }
// transactions/{id}   { type, amount, description, customerPhone?, createdAt }

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
export const createOrder = (order) => addDoc(collection(db, 'orders'), { ...order, createdAt: nowIso() });

export const updateOrder = (id, patch) => updateDoc(doc(db, 'orders', id), patch);

// --- Sổ thu chi ---
export const addTransaction = (tx) => addDoc(collection(db, 'transactions'), { ...tx, createdAt: nowIso() });

export const deleteTransaction = (id) => deleteDoc(doc(db, 'transactions', id));

// Thu đủ nợ: gạch nợ các đơn và ghi khoản thu trong cùng một lần ghi
export const collectDebt = async (orderIds, tx) => {
  const batch = writeBatch(db);
  orderIds.forEach(id => batch.update(doc(db, 'orders', id), { paid: true }));
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
