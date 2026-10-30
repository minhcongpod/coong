// Tạo dữ liệu ban đầu cho project mới: tài khoản chủ quán, PIN và menu.
// Chạy: ADMIN_PHONE=0900000000 ADMIN_PIN=1996 GOOGLE_APPLICATION_CREDENTIALS=key.json node scripts/seed-shop.mjs
import { createRequire } from 'node:module';
const require = createRequire(new URL('../functions/', import.meta.url));
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const phone = (process.env.ADMIN_PHONE || '').replace(/\D/g, '');
const pin = process.env.ADMIN_PIN || '';
if (phone.length < 9 || !/^\d{4}$/.test(pin)) {
  console.error('Cần ADMIN_PHONE (9-11 số) và ADMIN_PIN (4 số).');
  process.exit(1);
}

const db = getFirestore(initializeApp({ projectId: 'coong-cafe' }));
const now = new Date().toISOString();
const batch = db.batch();
batch.set(db.doc('meta/setup'), { adminPhone: phone, createdAt: now });
batch.set(db.doc(`users/${phone}`), { name: 'Chủ quán', role: 'admin' });
batch.set(db.doc(`pins/${phone}`), { pin });
for (const [id, name, price] of [['bac', 'Bạc', 20000], ['den', 'Đen', 20000], ['nau', 'Nâu', 20000]]) {
  batch.set(db.doc(`menu/${id}`), { name, price, cost: 0, active: true });
}
await batch.commit();
console.log('Đã tạo chủ quán', phone, 'và 3 món menu.');
