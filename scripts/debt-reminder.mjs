// Nhắc nợ hằng tuần: gửi Telegram cho từng khách còn đơn chưa thanh toán (số đơn và tổng tiền).
// Chạy bởi GitHub Actions lúc 18:30 thứ 6 (giờ Việt Nam). Cần GOOGLE_APPLICATION_CREDENTIALS (service account Firebase).
// DRY_RUN=1: chỉ in ra, không gửi.
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp({ credential: applicationDefault(), projectId: process.env.GCLOUD_PROJECT || 'coong-59ede' });
const db = getFirestore();
const dry = process.env.DRY_RUN === '1';

const cfg = (await db.doc('meta/telegram').get()).data() || {};
if (!cfg.token) { console.log('Chưa cài bot Telegram, bỏ qua.'); process.exit(0); }

// Đơn nợ: chưa thanh toán, chưa huỷ, khách chưa báo đã trả (đơn chờ quán xác nhận thì không nhắc)
const snap = await db.collection('orders').where('paid', '==', false).get();
const debts = new Map();
snap.forEach((d) => {
  const o = d.data();
  if (o.status === 'cancelled' || o.paymentStatus === 'awaiting' || !o.customerPhone) return;
  const g = debts.get(o.customerPhone) || { name: o.customerName, n: 0, total: 0 };
  g.n += 1; g.total += o.totalAmount || 0;
  debts.set(o.customerPhone, g);
});

const vnd = (n) => n.toLocaleString('vi-VN') + 'đ';
let sent = 0, skipped = 0;
for (const [phone, g] of debts) {
  const chat = (await db.doc(`tg/${phone}`).get()).data()?.chatId;
  if (!chat) { skipped++; continue; }
  const text = `🧾 Nhắc nhẹ: bạn còn ${g.n} đơn chưa thanh toán, tổng ${vnd(g.total)}.\nVào Tài khoản trong app Coong, bấm Thanh toán nhé!`;
  if (dry) { console.log('[dry]', phone, text.replace(/\n/g, ' ')); sent++; continue; }
  const r = await fetch(`https://api.telegram.org/bot${cfg.token}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: chat, text }) }).then((x) => x.json()).catch(() => null);
  if (r && r.ok) sent++; else console.warn('gửi lỗi', phone, r && r.description);
}
console.log(`Khách còn nợ: ${debts.size}, đã nhắc: ${sent}, chưa bật Telegram: ${skipped}`);
