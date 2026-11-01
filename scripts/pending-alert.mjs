// Nhắc chủ quán khi đơn chờ xác nhận quá 10 phút (mỗi đơn chỉ nhắc một lần).
// Chạy bởi GitHub Actions mỗi 5 phút. DRY_RUN=1: chỉ in ra, không gửi.
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp({ credential: applicationDefault(), projectId: process.env.GCLOUD_PROJECT || 'coong-59ede' });
const db = getFirestore();
const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const dry = process.env.DRY_RUN === '1';
const WAIT_MIN = Number(process.env.WAIT_MIN || 10);

const cfg = (await db.doc('meta/telegram').get()).data() || {};
if (!cfg.token || !cfg.adminChat) { console.log('Chưa kết nối Telegram của chủ quán, bỏ qua.'); process.exit(0); }

const cutoff = new Date(Date.now() - WAIT_MIN * 60000).toISOString();
const snap = await db.collection('orders').where('status', '==', 'pending').get();
let n = 0;
for (const d of snap.docs) {
  const o = d.data();
  if (o.pendingAlerted || !o.createdAt || o.createdAt > cutoff) continue;
  const mins = Math.round((Date.now() - new Date(o.createdAt).getTime()) / 60000);
  const text = `⏰ Đơn #${o.no || d.id.slice(0, 4)} của ${o.customerName} đã chờ ${mins} phút chưa xác nhận.`;
  if (dry) { console.log('[dry]', text); n++; continue; }
  const r = await fetch(`https://api.telegram.org/bot${cfg.token}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: cfg.adminChat, text: esc(text) + `\n<a href="https://coongcafe.web.app/admin">Xem ngay</a>`, parse_mode: 'HTML', disable_web_page_preview: true }) }).then((x) => x.json()).catch(() => null);
  if (r && r.ok) { await d.ref.update({ pendingAlerted: true }); n++; } else console.warn('gửi lỗi', r && r.description);
}
console.log(`Đơn chờ quá ${WAIT_MIN} phút: ${n}`);
