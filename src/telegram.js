// Thông báo qua Telegram, gửi thẳng từ app (không cần máy chủ):
//   meta/telegram { token, bot, adminChat }  chỉ chủ quán ghi, các máy đã đăng nhập đọc
//   tg/{phone}     { chatId }                khách tự gắn Telegram của mình
import { doc, getDoc, setDoc, deleteDoc, collection, getDocs } from 'firebase/firestore';
import { db } from './firebase';

const api = (token, method) => `https://api.telegram.org/bot${token}/${method}`;
const call = (token, method, body) =>
  fetch(api(token, method), body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : undefined)
    .then((r) => r.json()).catch(() => null);

// Cấu hình giữ trong bộ nhớ 30 giây; đọc lỗi hoặc chưa có thì không giữ để lần sau đọc lại
let cache = null, cacheAt = 0;
export const getTgCfg = async (fresh) => {
  if (cache && cache.token && !fresh && Date.now() - cacheAt < 30000) return cache;
  try {
    const s = await getDoc(doc(db, 'meta', 'telegram'));
    cache = s.exists() ? s.data() : {}; cacheAt = Date.now();
  } catch (e) { console.warn('telegram: không đọc được cấu hình', e && e.code); return cache || {}; }
  return cache;
};
export const peekTgCfg = () => cache;
export const saveTgCfg = async (patch) => { await setDoc(doc(db, 'meta', 'telegram'), patch, { merge: true }); cache = { ...(cache || {}), ...patch }; cacheAt = Date.now(); };

// Kiểm tra token và lấy tên bot
export const tgCheckToken = async (token) => {
  const r = await call(token, 'getMe');
  return r && r.ok ? r.result.username : null;
};

export const getTgChat = async (phone) => {
  try { const s = await getDoc(doc(db, 'tg', phone)); return s.exists() ? s.data().chatId : null; } catch (e) { return null; }
};
export const clearTgChat = (phone) => deleteDoc(doc(db, 'tg', phone));
export const setTgChat = (phone, chatId) => setDoc(doc(db, 'tg', phone), { chatId: String(chatId) });

// Mở bot kèm mã, rồi chờ tin "/start <mã>" để biết chat id của người đó. Trả về chat id hoặc null nếu hết giờ.
export const tgNewCode = () => 'c' + Math.random().toString(36).slice(2, 10);
export const tgDeepLink = (bot, code) => `https://t.me/${bot}?start=${code}`;
export const tgWaitChat = async (token, code, ms = 120000) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const r = await call(token, 'getUpdates?limit=100');
    const hit = r && r.ok && r.result.map((u) => u.message).filter(Boolean).reverse().find((m) => (m.text || '').trim() === `/start ${code}`);
    if (hit) return hit.chat.id;
    await new Promise((res) => setTimeout(res, 2500));
  }
  return null;
};

// Mỗi tin có dòng "Xem ngay" gắn link vào app (chủ quán: /admin, khách: trang chủ)
export const APP_URL = 'https://coongcafe.web.app';
const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const send = async (token, chat, text, link) => {
  const body = esc(text) + (link ? `\n<a href="${link}">Xem ngay</a>` : '');
  const r = await call(token, 'sendMessage', { chat_id: chat, text: body, parse_mode: 'HTML', disable_web_page_preview: true });
  if (!r || !r.ok) console.warn('telegram: gửi lỗi', r && r.description);
  return r;
};

// Gửi cho chủ quán / cho khách; lỗi thì bỏ qua để không làm hỏng việc đang làm
export const tgToAdmin = async (text, link = `${APP_URL}/admin`) => {
  try { const c = await getTgCfg(); if (!c.token || !c.adminChat) return console.warn('telegram: chủ quán chưa kết nối'); await send(c.token, c.adminChat, text, link); } catch (e) {}
};
export const tgToCustomer = async (phone, text, link = APP_URL) => {
  try {
    const c = await getTgCfg(); if (!c.token || !phone) return;
    const chat = await getTgChat(phone); if (!chat) return console.warn('telegram: khách chưa bật Telegram'); await send(c.token, chat, text, link);
  } catch (e) {}
};

// Chủ quán gửi một tin cho tất cả khách đã bật Telegram. Trả về { sent, total }.
export const tgChatCount = async () => (await getDocs(collection(db, 'tg'))).size;
export const tgBroadcast = async (text) => {
  const c = await getTgCfg(true);
  if (!c.token) return { sent: 0, total: 0 };
  const chats = (await getDocs(collection(db, 'tg'))).docs.map((d) => d.data().chatId).filter(Boolean);
  let sent = 0;
  for (const chat of chats) {
    const r = await send(c.token, chat, text, APP_URL);
    if (r && r.ok) sent++;
    await new Promise((res) => setTimeout(res, 60));
  }
  return { sent, total: chats.length };
};
