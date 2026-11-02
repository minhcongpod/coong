import React, { useState, useEffect } from 'react';
import { saveMenuItem, saveShop } from '../db';
import { collection, getDocs, getDoc, doc, writeBatch } from 'firebase/firestore';
import { db as fdb } from '../firebase';
import { Icon, Sym, Page, Btn, Toggle, Field, Empty, fmt, phoneText, XL_EXTRA, kindOf, useUI, errText, BellBtn } from './ui.jsx';
import { getTgCfg, saveTgCfg, tgCheckToken, tgNewCode, tgDeepLink, tgWaitChat, tgToAdmin, tgBroadcast, tgChatCount } from '../telegram';
import { customersOf, CustomerPicker, NewCustomer, EditCustomerForm } from './Customers.jsx';

// Hàng nhập: nhãn bên trái, giá trị bên phải
const Row = ({ label, children }) => (
  <label className="s-row"><span>{label}</span>{children}</label>
);

// Tab Cài đặt: quản lý khách hàng, quản lý menu, đăng xuất
export default function SettingsTab({ menu, users, shop = {}, onLogout, unread, onBell }) {
  const [page, setPage] = useState(null); // customers | newCustomer | { customer } | menu | { dish }
  const { confirm, toast } = useUI();
  const customers = customersOf(users);
  const back = () => setPage(null);

  if (page === 'customers') return <CustomerPicker users={users} onBack={back} onAdd={() => setPage('newCustomer')} onPick={(c) => setPage({ customer: c })} onEdit={(c) => setPage({ customer: c })} />;
  if (page === 'newCustomer') return <NewCustomer users={users} onBack={() => setPage('customers')} onCreated={() => setPage('customers')} />;
  if (page && page.customer) return <EditCustomerForm customer={page.customer} onBack={() => setPage('customers')} onSaved={() => setPage('customers')} onDeleted={() => setPage('customers')} />;
  if (page === 'hours') return <Hours shop={shop} onBack={back} />;
  if (page === 'telegram') return <Telegram onBack={back} />;
  if (page === 'backup') return <Backup onBack={back} />;
  if (page === 'menu') return <MenuList menu={menu} onBack={back} onOpen={(m) => setPage({ dish: m })} />;
  if (page && page.dish) return <EditDish dish={page.dish} onBack={() => setPage('menu')} />;

  const rows = [
    ['i-s-user', 'Quản lý khách hàng', 'customers'],
    ['i-s-cup', 'Quản lý menu', 'menu'],
    ['i-s-clock', 'Giờ đóng mở cửa', 'hours'],
    ['i-bell', 'Thông báo Telegram', 'telegram'],
    ['i-s-down', 'Sao lưu dữ liệu', 'backup'],
  ];
  const flipSold = async (v) => { try { await saveShop({ soldOut: v }); } catch (e) { toast(errText(e)); } };
  return (
    <>
      <div className="w-head"><h1 className="a-title s-title">Cài đặt</h1><BellBtn n={unread} onClick={onBell} /></div>
      <div className="a-body s-list">
        <div className="s-item">
          <Sym id="i-s-soldout" size={20} />
          <b>Hết hàng</b>
          <Toggle on={!!shop.soldOut} onChange={flipSold} label="Hết hàng" />
        </div>
        {rows.map(([i, t, k]) => (
          <button key={k} className="s-item" onClick={() => setPage(k)}>
            <Sym id={i} size={20} />
            <b>{t}</b>
            <span className="s-chev"><Sym id="i-s-right" size={20} /></span>
          </button>
        ))}
        <button className="s-logout" onClick={async () => (await confirm({ title: 'Đăng xuất?', msg: 'Bạn sẽ cần nhập lại mã PIN để vào.', ok: 'Đăng xuất', danger: true })) && onLogout()}>Đăng xuất</button>
      </div>
    </>
  );
}

function MenuList({ menu, onBack, onOpen }) {
  const { toast } = useUI();
  const flip = async (m, v) => { try { await saveMenuItem({ id: m.id, active: v }); } catch (e) { toast(errText(e)); } };
  return (
    <Page className="s-pg" title="Menu" onBack={onBack}>
      {menu.map((m) => {
        const on = m.active !== false;
        const kind = kindOf(m.name);
        return (
          <div key={m.id} className="s-dishcard" role="button" tabIndex={0} onClick={() => onOpen(m)}>
            <span className="s-thumb">{kind ? <img src={`/${kind}.webp`} alt="" /> : <Sym id="i-s-cup" size={20} />}</span>
            <span className="s-name" style={{ opacity: on ? 1 : 0.5 }}><b className="a-ell">{m.name}</b><small>{fmt(m.price)}</small></span>
            <span className="s-ctl">
              <Toggle on={on} onChange={(v) => flip(m, v)} label={`${m.name} còn hàng`} />
              <span className="s-chev"><Sym id="i-s-right" size={20} /></span>
            </span>
          </div>
        );
      })}
      {menu.length === 0 && <Empty icon="coffee" title="Chưa có món" text="Menu đang trống." />}
    </Page>
  );
}

const digits = (v) => v.replace(/\D/g, '').slice(0, 7);

function EditDish({ dish, onBack }) {
  const { toast } = useUI();
  const isNew = !dish.id;
  const name = dish.name || ''; // tên món cố định, không sửa
  const [price, setPrice] = useState(dish.price ? String(dish.price) : '');
  const [upsize, setUpsize] = useState(String(typeof dish.upsize === 'number' ? dish.upsize : XL_EXTRA));
  const [on, setOn] = useState(dish.active !== false);

  const save = async () => {
    const p = Number(price);
    if (!name.trim()) return toast('Nhập tên món');
    if (!(p > 0)) return toast('Nhập giá bán');
    try {
      await saveMenuItem({ id: dish.id, name: name.trim(), price: p, upsize: Number(upsize) || 0, active: on, ...(isNew ? { cost: 0 } : {}) });
      toast('Đã lưu', true); onBack();
    } catch (e) { toast(errText(e)); }
  };
  return (
    <Page
      className="s-pg" title={isNew ? 'Thêm món' : 'Sửa món'} onBack={onBack}
      footer={(
        <Btn onClick={save}>Lưu lại</Btn>
      )}
    >
      <div className="s-row"><span>Tên món</span><span className="s-ro">{name}</span></div>
      <Row label="Giá bán"><input type="tel" inputMode="numeric" placeholder="0" value={price ? fmt(Number(price)) : ''} onChange={(e) => setPrice(digits(e.target.value))} aria-label="Giá bán" /></Row>
      <Row label="Upsize"><input type="tel" inputMode="numeric" placeholder="0" value={upsize ? fmt(Number(upsize)) : '0'} onChange={(e) => setUpsize(digits(e.target.value))} aria-label="Phụ thu Upsize" /></Row>
      <div className="s-row"><span>Còn hàng</span><Toggle on={on} onChange={setOn} label="Còn hàng" /></div>
    </Page>
  );
}

// Giờ mở cửa: ngoài giờ này app khách không cho đặt đơn. Để trống cả hai là không giới hạn.
// Thứ trong tuần theo getDay(): 1..6 là T2..T7, 0 là CN
const DAYS = [[1, 'T2'], [2, 'T3'], [3, 'T4'], [4, 'T5'], [5, 'T6'], [6, 'T7'], [0, 'CN']];

// Một dòng giờ: chạm để chọn giờ, có giờ thì hiện ở giữa kèm nút x để xoá
function TimeRow({ label, value, onChange }) {
  return (
    <label className="s-time">
      <span>{label}</span>
      <input type="time" value={value} onChange={(e) => onChange(e.target.value)} aria-label={`Giờ ${label.toLowerCase()}`} className={value ? '' : 'empty'} />
      {value && <button type="button" className="s-clear" onClick={(e) => { e.preventDefault(); onChange(''); }} aria-label={`Xoá giờ ${label.toLowerCase()}`}><Icon n="x" size={24} /></button>}
    </label>
  );
}

// Giờ mở cửa và ngày mở cửa (Figma 91-6550): ngoài giờ hoặc ngày nghỉ thì khách không đặt được
function Hours({ shop, onBack }) {
  const { toast } = useUI();
  const [openAt, setOpenAt] = useState(shop.openAt || '');
  const [closeAt, setCloseAt] = useState(shop.closeAt || '');
  const [days, setDays] = useState(Array.isArray(shop.days) ? shop.days : DAYS.map((d) => d[0]));
  const flip = (k) => setDays((ds) => (ds.includes(k) ? ds.filter((x) => x !== k) : [...ds, k]));
  const save = async () => {
    if (!!openAt !== !!closeAt) return toast('Nhập đủ giờ mở và giờ đóng');
    try { await saveShop({ openAt, closeAt, days: [...days].sort() }); toast('Đã lưu', true); onBack(); } catch (e) { toast(errText(e)); }
  };
  return (
    <Page className="s-pg s-hours" title="Giờ đóng mở cửa" onBack={onBack} footer={<Btn onClick={save}>Lưu lại</Btn>}>
      <TimeRow label="Mở cửa" value={openAt} onChange={setOpenAt} />
      <TimeRow label="Đóng cửa" value={closeAt} onChange={setCloseAt} />
      <div className="s-days">
        {DAYS.map(([k, l]) => <button key={k} className={days.includes(k) ? 'on' : ''} aria-pressed={days.includes(k)} onClick={() => flip(k)}>{l}</button>)}
      </div>
    </Page>
  );
}

// Thông báo Telegram: dán token bot, rồi kết nối Telegram của chủ quán để nhận tin đơn mới và khách báo đã thanh toán
function Telegram({ onBack }) {
  const { toast, confirm } = useUI();
  const [promo, setPromo] = useState('');
  const [count, setCount] = useState(null);
  useEffect(() => { tgChatCount().then(setCount).catch(() => {}); }, []);
  const [cfg, setCfg] = useState(null);
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { getTgCfg(true).then((c) => { setCfg(c); }); }, []);
  const c = cfg || {};
  const saveToken = async () => {
    const t = token.trim();
    if (!t) return toast('Dán token của bot');
    setBusy(true);
    try {
      const bot = await tgCheckToken(t);
      if (!bot) { toast('Token chưa đúng, kiểm tra lại nhé'); return; }
      await saveTgCfg({ token: t, bot });
      setCfg({ ...c, token: t, bot }); setToken(''); toast(`Đã lưu bot @${bot}`, true);
    } catch (e) { toast(errText(e)); } finally { setBusy(false); }
  };
  // mở Telegram ngay trong lúc bấm để trình duyệt không chặn cửa sổ
  const connect = async () => {
    if (!c.token || !c.bot) return toast('Lưu token bot trước nhé');
    const code = tgNewCode();
    window.open(tgDeepLink(c.bot, code), '_blank');
    setBusy(true); toast('Mở Telegram và bấm Start nhé');
    try {
      const chat = await tgWaitChat(c.token, code);
      if (!chat) { toast('Chưa kết nối được, thử lại nhé'); return; }
      await saveTgCfg({ adminChat: String(chat) });
      setCfg({ ...c, adminChat: String(chat) }); toast('Đã kết nối Telegram của chủ quán', true);
    } catch (e) { toast(errText(e)); } finally { setBusy(false); }
  };
  const sendPromo = async () => {
    const text = promo.trim();
    if (!text) return;
    if (!(await confirm({ title: `Gửi cho ${count != null ? count : 'tất cả'} khách?`, msg: text, ok: 'Gửi' }))) return;
    setBusy(true);
    try { const r = await tgBroadcast(`📣 ${text}`); setPromo(''); toast(`Đã gửi ${r.sent}/${r.total} khách`, true); }
    catch (e) { toast(errText(e)); } finally { setBusy(false); }
  };
  const test = async () => { await tgToAdmin('📣 Coong: thông báo Telegram hoạt động'); toast('Đã gửi tin thử'); };
  return (
    <Page className="s-pg" title="Thông báo Telegram" sub={c.bot ? `Bot @${c.bot}${c.adminChat ? ' · đã kết nối' : ' · chưa kết nối'}` : 'Chưa cài bot'} onBack={onBack}>
      <Field value={token} onChange={(e) => setToken(e.target.value)} placeholder={c.token ? 'Dán token mới để đổi bot' : 'Dán token của bot (từ @BotFather)'} aria-label="Token bot Telegram" autoComplete="off" />
      <Btn onClick={saveToken} disabled={busy}>Lưu token</Btn>
      <Btn kind="ghost" onClick={connect} disabled={busy || !c.token}>Kết nối Telegram của chủ quán</Btn>
      {c.adminChat && <Btn kind="ghost" onClick={test}>Gửi tin thử</Btn>}
      {c.token && (
        <>
          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <b style={{ color: '#fff', fontWeight: 700, fontSize: 16 }}>Gửi tin khuyến mãi</b>
            {count != null && <span style={{ color: 'var(--mute)', fontWeight: 500, fontSize: 14 }}>{count} khách đã bật Telegram</span>}
          </div>
          <label className="a-card w-notecard">
            <textarea
              className="w-note" rows={2} value={promo} placeholder="Nhập nội dung" aria-label="Nội dung thông báo"
              ref={(el) => { if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; } }}
              onChange={(e) => setPromo(e.target.value.slice(0, 500))}
            />
          </label>
          <Btn onClick={sendPromo} disabled={busy || !promo.trim()}>Gửi cho khách</Btn>
        </>
      )}
    </Page>
  );
}

// Sao lưu / khôi phục: tải toàn bộ dữ liệu quán thành 1 file JSON, và nạp lại từ file đó.
// Không gồm mã PIN và token Telegram (bí mật). Khôi phục chỉ ghi đè/bổ sung, không xóa dữ liệu mới hơn.
const BK_COLS = ['orders', 'transactions', 'menu'];
function Backup({ onBack }) {
  const { toast, confirm } = useUI();
  const [busy, setBusy] = useState(false);
  const fileRef = React.useRef(null);

  const backup = async () => {
    setBusy(true);
    try {
      const data = {};
      for (const c of BK_COLS) data[c] = (await getDocs(collection(fdb, c))).docs.map((d) => ({ id: d.id, ...d.data() }));
      data.users = (await getDocs(collection(fdb, 'users'))).docs.filter((d) => d.data().role === 'customer').map((d) => ({ id: d.id, ...d.data() }));
      const shop = await getDoc(doc(fdb, 'meta', 'shop'));
      data.shop = shop.exists() ? shop.data() : null;
      const cnt = await getDoc(doc(fdb, 'counters', 'orders'));
      data.counter = cnt.exists() ? cnt.data() : null;
      const out = { app: 'coong', version: 1, createdAt: new Date().toISOString(), data };
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([JSON.stringify(out)], { type: 'application/json' }));
      a.download = `coong-sao-luu-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      toast(`Đã sao lưu ${data.orders.length} đơn, ${data.transactions.length} khoản thu chi`, true);
    } catch (e) { toast(errText(e)); } finally { setBusy(false); }
  };

  const restore = async (file) => {
    if (!file) return;
    let d;
    try {
      const j = JSON.parse(await file.text());
      if (j.app !== 'coong' || !j.data) throw new Error();
      d = j.data;
    } catch (e) { return toast('File không phải bản sao lưu của Coong'); }
    const ok = await confirm({
      title: 'Khôi phục dữ liệu?',
      msg: `Nạp lại ${(d.orders || []).length} đơn, ${(d.transactions || []).length} khoản thu chi, ${(d.users || []).length} khách, ${(d.menu || []).length} món. Dữ liệu trùng sẽ bị ghi đè bằng bản sao lưu.`,
      ok: 'Khôi phục', danger: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      const ops = [];
      const put = (path, row) => { const { id, ...rest } = row; ops.push([doc(fdb, ...path, ...(id ? [id] : [])), rest]); };
      (d.orders || []).forEach((r) => put(['orders'], r));
      (d.transactions || []).forEach((r) => put(['transactions'], r));
      (d.menu || []).forEach((r) => put(['menu'], r));
      (d.users || []).filter((r) => r.role === 'customer').forEach((r) => put(['users'], r));
      if (d.shop) ops.push([doc(fdb, 'meta', 'shop'), d.shop]);
      if (d.counter) ops.push([doc(fdb, 'counters', 'orders'), d.counter]);
      for (let i = 0; i < ops.length; i += 400) {
        const b = writeBatch(fdb);
        ops.slice(i, i + 400).forEach(([ref, val]) => b.set(ref, val));
        await b.commit();
      }
      toast(`Đã khôi phục ${ops.length} mục`, true);
    } catch (e) { toast(errText(e)); } finally { setBusy(false); if (fileRef.current) fileRef.current.value = ''; }
  };

  return (
    <Page className="s-pg" title="Sao lưu dữ liệu" onBack={onBack}>
      <div className="a-body s-list" style={{ gap: 12 }}>
        <p style={{ color: 'var(--mute)', fontSize: 15, lineHeight: 1.5, margin: 0 }}>
          Tải về 1 file gồm đơn hàng, thu chi, khách hàng, menu và giờ mở cửa. Không gồm mã PIN và token Telegram. Nên sao lưu mỗi tuần và cất file ở nơi an toàn.
        </p>
        <Btn onClick={backup} disabled={busy}>{busy ? 'Đang xử lý...' : 'Sao lưu ngay'}</Btn>
        <Btn onClick={() => fileRef.current && fileRef.current.click()} disabled={busy}>Khôi phục từ file</Btn>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => restore(e.target.files[0])} />
      </div>
    </Page>
  );
}
