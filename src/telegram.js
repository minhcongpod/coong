// Thông báo qua Telegram, gửi thẳng từ app (không cần máy chủ):
//   meta/telegram { token, bot, adminChat }  chỉ chủ quán ghi, các máy đã đăng nhập đọc
//   tg/{phone}     { chatId }                khách tự gắn Telegram của mình
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';

const api = (token, method) => `https://api.telegram.org/bot${token}/${method}`;
const call = (token, method, body) =>
  fetch(api(token, method), body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : undefined)
    .then((r) => r.json()).catch(() => null);

let cache = null;
export const getTgCfg = async (fresh) => {
  if (cache && !fresh) return cache;
  try { const s = await getDoc(doc(db, 'meta', 'telegram')); cache = s.exists() ? s.data() : {}; } catch (e) { cache = {}; }
  return cache;
};
export const peekTgCfg = () => cache;
export const saveTgCfg = async (patch) => { await setDoc(doc(db, 'meta', 'telegram'), patch, { merge: true }); cache = { ...(cache || {}), ...patch }; };

// Kiểm tra token và lấy tên bot
export const tgCheckToken = async (token) => {
  const r = await call(token, 'getMe');
  return r && r.ok ? r.result.username : null;
};

export const getTgChat = async (phone) => {
  try { const s = await getDoc(doc(db, 'tg', phone)); return s.exists() ? s.data().chatId : null; } catch (e) { return null; }
};
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

const send = (token, chat, text) => call(token, 'sendMessage', { chat_id: chat, text });

// Gửi cho chủ quán / cho khách; lỗi thì bỏ qua để không làm hỏng việc đang làm
export const tgToAdmin = async (text) => {
  try { const c = await getTgCfg(); if (c.token && c.adminChat) await send(c.token, c.adminChat, text); } catch (e) {}
};
export const tgToCustomer = async (phone, text) => {
  try {
    const c = await getTgCfg(); if (!c.token || !phone) return;
    const chat = await getTgChat(phone); if (chat) await send(c.token, chat, text);
  } catch (e) {}
};
