import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, deleteDoc, updateDoc, collection, getDocs, query, where, writeBatch, addDoc } from 'firebase/firestore';

const env = await initializeTestEnvironment({
  projectId: 'coong-rules-test',
  firestore: { rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8'), host: '127.0.0.1', port: 8080 },
});
await env.clearFirestore();

let pass = 0, fail = 0;
const t = async (name, p) => {
  try { await p; pass++; console.log('  ok  ', name); }
  catch (e) { fail++; console.log('  FAIL', name, e.message); }
};

const ADMIN = '0987654321', A = '0911111111', B = '0922222222';
const adminDb = env.authenticatedContext('uid-admin').firestore();
const aDb = env.authenticatedContext('uid-a').firestore();
const bDb = env.authenticatedContext('uid-b').firestore();
const evilDb = env.authenticatedContext('uid-evil').firestore();
const anonDb = env.unauthenticatedContext().firestore();

const bootstrap = (db, uid, phone) => {
  const batch = writeBatch(db);
  batch.set(doc(db, 'meta/setup'), { adminPhone: phone, createdAt: 'x' });
  batch.set(doc(db, 'users', phone), { name: 'Chủ', role: 'admin' });
  batch.set(doc(db, 'pins', phone), { pin: '1111' });
  batch.set(doc(db, 'devices', uid), { phone, pin: '1111', createdAt: 'x' });
  return batch.commit();
};

await t('chưa đăng nhập không đọc được meta? (được đọc)', assertSucceeds(getDoc(doc(anonDb, 'meta/setup'))));
await t('bootstrap chủ quán', assertSucceeds(bootstrap(adminDb, 'uid-admin', ADMIN)));
await t('bootstrap lần 2 bị chặn', assertFails(bootstrap(evilDb, 'uid-evil', '0999999999')));

// Admin tạo khách A, B
const mk = async (phone, pin) => {
  const batch = writeBatch(adminDb);
  batch.set(doc(adminDb, 'users', phone), { name: 'K' + phone.slice(-1), role: 'customer' });
  batch.set(doc(adminDb, 'pins', phone), { pin });
  return batch.commit();
};
await t('admin tạo khách A', assertSucceeds(mk(A, '1111')));
await t('admin tạo khách B', assertSucceeds(mk(B, '2222')));
await t('khách lạ không tự tạo tài khoản', assertFails(setDoc(doc(evilDb, 'users', '0933333333'), { name: 'x', role: 'customer' })));

await t('PIN sai bị chặn', assertFails(setDoc(doc(evilDb, 'devices/uid-evil'), { phone: A, pin: '0000', createdAt: 'x' })));
await t('mở khóa thiết bị cho SĐT admin bằng PIN sai bị chặn', assertFails(setDoc(doc(evilDb, 'devices/uid-evil'), { phone: ADMIN, pin: '0000', createdAt: 'x' })));
await t('không đọc được pins', assertFails(getDoc(doc(evilDb, 'pins', A))));
await t('khách A mở khóa đúng PIN', assertSucceeds(setDoc(doc(aDb, 'devices/uid-a'), { phone: A, pin: '1111', createdAt: 'x' })));
await t('khách B mở khóa đúng PIN', assertSucceeds(setDoc(doc(bDb, 'devices/uid-b'), { phone: B, pin: '2222', createdAt: 'x' })));
await t('không ghi thiết bị của người khác', assertFails(setDoc(doc(evilDb, 'devices/uid-x'), { phone: A, pin: '1111', createdAt: 'x' })));

await t('chưa mở khóa không đọc menu', assertFails(getDocs(collection(evilDb, 'menu'))));
await t('admin thêm món', assertSucceeds(setDoc(doc(adminDb, 'menu/m1'), { name: 'Đen', price: 25000, cost: 8000, active: true })));
await t('khách đọc menu', assertSucceeds(getDocs(collection(aDb, 'menu'))));
await t('khách không sửa menu', assertFails(updateDoc(doc(aDb, 'menu/m1'), { price: 1 })));

const order = (phone) => ({ customerPhone: phone, customerName: 'K', items: [], note: '', totalAmount: 25000, status: 'pending', paid: false, createdAt: 'x' });
await t('khách A đặt đơn', assertSucceeds(setDoc(doc(aDb, 'orders/o1'), order(A))));
await t('khách A không đặt đơn hộ B', assertFails(setDoc(doc(aDb, 'orders/o2'), order(B))));
await t('khách A không tự đặt đơn đã thanh toán', assertFails(setDoc(doc(aDb, 'orders/o3'), { ...order(A), paid: true })));
await t('khách B đặt đơn', assertSucceeds(setDoc(doc(bDb, 'orders/o4'), order(B))));
await t('khách A đọc đơn của mình', assertSucceeds(getDocs(query(collection(aDb, 'orders'), where('customerPhone', '==', A)))));
await t('khách A không đọc toàn bộ đơn', assertFails(getDocs(collection(aDb, 'orders'))));
await t('khách A không đọc đơn của B', assertFails(getDoc(doc(aDb, 'orders/o4'))));
await t('khách A không tự đánh dấu đã trả', assertFails(updateDoc(doc(aDb, 'orders/o1'), { paid: true })));
await t('khách B tự hủy đơn đang chờ', assertSucceeds(updateDoc(doc(bDb, 'orders/o4'), { status: 'cancelled' })));
await t('admin đọc toàn bộ đơn', assertSucceeds(getDocs(collection(adminDb, 'orders'))));
await t('admin chuyển trạng thái đơn', assertSucceeds(updateDoc(doc(adminDb, 'orders/o1'), { status: 'brewing' })));
await t('khách A không hủy đơn đang pha', assertFails(updateDoc(doc(aDb, 'orders/o1'), { status: 'cancelled' })));

await t('khách không đọc sổ thu chi', assertFails(getDocs(collection(aDb, 'transactions'))));
await t('admin ghi sổ thu chi', assertSucceeds(addDoc(collection(adminDb, 'transactions'), { type: 'expense', amount: 1, createdAt: 'x' })));
await t('khách không xem danh sách khách', assertFails(getDocs(collection(aDb, 'users'))));
await t('admin xem danh sách khách', assertSucceeds(getDocs(collection(adminDb, 'users'))));
await t('khách A đổi tên mình', assertSucceeds(updateDoc(doc(aDb, 'users', A), { name: 'Tên mới' })));
await t('khách A không tự nâng quyền admin', assertFails(updateDoc(doc(aDb, 'users', A), { role: 'admin' })));
await t('admin không đổi quyền khách thành admin', assertFails(updateDoc(doc(adminDb, 'users', A), { role: 'admin' })));
await t('khách A đổi PIN mình', assertSucceeds(setDoc(doc(aDb, 'pins', A), { pin: '9999' })));
await t('khách A không đổi PIN của B', assertFails(setDoc(doc(aDb, 'pins', B), { pin: '9999' })));
await t('PIN phải 4 số', assertFails(setDoc(doc(aDb, 'pins', A), { pin: '12' })));
await t('khách A khóa thiết bị', assertSucceeds(deleteDoc(doc(aDb, 'devices/uid-a'))));
await t('sau khi khóa không đọc menu', assertFails(getDocs(collection(aDb, 'menu'))));
await t('PIN cũ không dùng được', assertFails(setDoc(doc(aDb, 'devices/uid-a'), { phone: A, pin: '1111', createdAt: 'x' })));
await t('PIN mới dùng được', assertSucceeds(setDoc(doc(aDb, 'devices/uid-a'), { phone: A, pin: '9999', createdAt: 'x' })));
await t('admin không xóa được chính tài khoản admin', assertFails(deleteDoc(doc(adminDb, 'users', ADMIN))));

console.log(`\n${pass} ok, ${fail} fail`);
await env.cleanup();
process.exit(fail ? 1 : 0);
