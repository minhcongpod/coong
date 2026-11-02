import React, { useState, useEffect, useLayoutEffect, useRef, useMemo } from 'react';
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { auth } from '../firebase';
import { getSetup, watchDevice, unlockDevice, lockDevice, watchOrders, watchMenu, watchUsers, watchTransactions, watchShop } from '../db';
import './admin.css';
import { Sym, UIProvider, useUI, errText, stagger, orderCode, phoneText } from './ui.jsx';
import OrderTab, { Notifs, claimGroups } from './OrderTab.jsx';
import HistoryTab from './HistoryTab.jsx';
import WalletTab from './WalletTab.jsx';
import SettingsTab from './SettingsTab.jsx';
import { LOGO_PATH } from './logo.js';

const FW = 390, FH = 700;

// Khung 390×700 co giãn vừa cửa sổ, giống app khách
function Device({ children }) {
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight });
  useEffect(() => {
    const f = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', f);
    return () => window.removeEventListener('resize', f);
  }, []);
  useEffect(() => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&display=swap';
    document.head.appendChild(link);
    const prev = { title: document.title, bg: document.body.style.background, theme: document.body.className };
    document.title = 'Coong · Chủ quán';
    document.body.style.background = '#000';
    document.body.className = '';
    return () => { link.remove(); document.title = prev.title; document.body.style.background = prev.bg; document.body.className = prev.theme; };
  }, []);
  // điện thoại: lấp đầy màn hình, co theo chiều ngang và cao thêm nếu máy dài; cửa sổ lớn: khung 390×700 ở giữa
  const st = Math.min(size.w / FW, size.h / FH);
  const fh = size.w <= 500 ? Math.min(Math.round(size.h / st), 900) : FH;
  const dev = Math.abs(size.w - FW * st) > 1 || Math.abs(size.h - fh * st) > 1;
  return (
    <div className={`a-root${dev ? ' a-dev' : ''}`} style={{ '--fh': fh + 'px' }}>
      <div className="a-device" style={{ width: FW * st, height: fh * st }}>
        <div className="a-stage" style={{ transform: `scale(${st})` }}>{children}</div>
      </div>
    </div>
  );
}

export default function AdminApp() {
  return <Device><UIProvider><Gate /></UIProvider></Device>;
}

// Màn chờ lúc mở app: ảnh nền và logo như splash app khách
function Splash({ out }) {
  return (
    <div className={`a-splash${out ? ' out' : ''}`} role="img" aria-label="Coong">
      <svg className="a-slogo" viewBox="0 0 91.42 35.78"><path fill="currentColor" d={LOGO_PATH} /></svg>
    </div>
  );
}

function Center({ children }) {
  return <div className="a-tab" style={{ justifyContent: 'center' }}>{children}</div>;
}

function Gate() {
  const [stage, setStage] = useState('loading'); // loading | error | locked | ready
  const [errorText, setErrorText] = useState('');
  const [uid, setUid] = useState(null);
  const [adminPhone, setAdminPhone] = useState(null);
  const [device, setDevice] = useState(undefined);

  useEffect(() => {
    let cancelled = false;
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        signInAnonymously(auth).catch((e) => { setErrorText(e.code || e.message); setStage('error'); });
        return;
      }
      try {
        const setup = await getSetup();
        if (cancelled) return;
        if (!setup) { setErrorText('Quán chưa được thiết lập'); return setStage('error'); }
        setUid(user.uid);
        setAdminPhone(setup.adminPhone);
      } catch (e) { setErrorText(e.code || e.message); setStage('error'); }
    });
    return () => { cancelled = true; unsub(); };
  }, []);

  useEffect(() => {
    if (!uid) return;
    return watchDevice(uid, setDevice, (e) => { setErrorText(e.code); setStage('error'); });
  }, [uid]);

  useEffect(() => {
    if (device === undefined || !adminPhone) return;
    setStage(device && device.phone === adminPhone ? 'ready' : 'locked');
  }, [device, adminPhone]);

  // PIN được kiểm tra phía server bằng quy tắc Firestore (so với pins/{số điện thoại chủ quán})
  const login = async (pin) => {
    if (device) await lockDevice(uid);
    await unlockDevice(uid, adminPhone, pin);
  };

  if (stage === 'loading') return <Splash />;
  if (stage === 'error') {
    return (
      <Center>
        <h1 className="a-title">Không kết nối được</h1>
        <p className="a-sub" style={{ marginBottom: 24 }}>Mã lỗi: {errorText}</p>
        <button className="a-btn" onClick={() => window.location.reload()}>Thử lại</button>
      </Center>
    );
  }
  if (stage === 'locked') return <Login onLogin={login} />;
  return <Shell adminPhone={adminPhone} onLogout={() => lockDevice(uid)} />;
}

function Login({ onLogin }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [errN, setErrN] = useState(0);

  // đủ 4 số thì vào luôn, không cần nút
  const submit = async (value) => {
    if (busy) return;
    setBusy(true);
    try { await onLogin(value); } catch (err) {
      setError(err.code === 'permission-denied' ? 'Mã PIN không đúng!' : `Lỗi: ${err.code || err.message}`);
      setPin(''); setBusy(false); setErrN((n) => n + 1);
      setTimeout(() => { const el = document.getElementById('a-pin'); el && el.focus(); }, 0);
    }
  };
  const change = (e) => {
    const v = e.target.value.replace(/\D/g, '').slice(0, 4);
    setPin(v); setError('');
    if (v.length === 4) submit(v);
  };

  return (
    <div className="a-tab a-login">
      <div style={{ height: 60, display: 'flex', justifyContent: 'center', marginTop: -6 }}><Sym id="i-logo" size={153} /></div>
      <div style={{ marginTop: 44, display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div style={{ textAlign: 'center' }}>
          <h1 className="a-title">Chào Coong</h1>
          <p className="a-sub">Nhập mã PIN nào!</p>
        </div>
        <div key={errN} className={errN ? 'a-shake' : ''} style={{ display: 'flex', gap: 8, position: 'relative' }} onClick={() => document.getElementById('a-pin').focus()}>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="a-field" style={{ flex: 1, justifyContent: 'center', padding: 0, fontSize: 24, fontWeight: 700, boxShadow: error ? 'inset 0 0 0 1.5px var(--err)' : i === Math.min(pin.length, 3) ? 'inset 0 0 0 1.5px #fff' : 'none' }}>
              {pin[i] ? '•' : ''}
            </div>
          ))}
          <input
            id="a-pin" autoFocus type="tel" inputMode="numeric" autoComplete="off" maxLength={4} value={pin} aria-label="Mã PIN" disabled={busy}
            onChange={change}
            style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', cursor: 'pointer' }}
          />
        </div>
        {error && <p className="a-err" style={{ textAlign: 'center', marginTop: -8 }}>{error}</p>}
      </div>
    </div>
  );
}

const TAB_SYM = { history: 'i-tab-orders', order: 'i-tab-menu', wallet: 'i-tab-wallet', settings: 'i-tab-gear' };
const NavIcon = ({ k }) => <Sym id={TAB_SYM[k]} size={32} />;

const NAV = [['history', 'Đơn hàng'], ['order', 'Menu'], ['wallet', 'Ví tiền'], ['settings', 'Cài đặt']];

function Shell({ adminPhone, onLogout }) {
  const { toast } = useUI();
  const [tab, setTabState] = useState('history'); // nhập PIN xong vào thẳng tab Đơn hàng
  const [leaving, setLeaving] = useState(null);
  const panes = useRef({});
  const anims = useRef([]);
  // đổi tab như app khách: tab cũ mờ và lệch đi, tab mới trượt vào, các khối trong tab hiện lần lượt.
  // Hiệu ứng chạy trong useLayoutEffect (trước khi vẽ) để không lộ một khung hình nào ở trạng thái cuối.
  const move = useRef(null);
  const setTab = (k) => {
    if (k === tab) return;
    const keys = NAV.map((n) => n[0]);
    move.current = { from: tab, to: k, dir: keys.indexOf(k) > keys.indexOf(tab) ? 1 : -1 };
    setLeaving(tab); setTabState(k);
  };
  useLayoutEffect(() => {
    const m = move.current;
    if (!m || m.to !== tab) return;
    move.current = null;
    anims.current.forEach((a) => a.cancel());
    const from = panes.current[m.from], to = panes.current[m.to];
    const list = [];
    const out = from && from.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: `translateX(${-m.dir * 28}px)` }], { duration: 220, easing: 'ease-in', fill: 'forwards' });
    if (out) list.push(out);
    if (to) {
      list.push(to.animate([{ opacity: 0, transform: `translateX(${m.dir * 28}px)` }, { opacity: 1, transform: 'none' }], { duration: 420, delay: 90, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'backwards' }));
      list.push(...stagger(to, ':scope > .a-title, :scope > .w-head, .h-seg, .h-head, .h-card, .a-body > .a-card, .a-body > button, .a-foot', 140, 50));
    }
    anims.current = list;
    // tab cũ ẩn đi khi đã mờ hẳn; giữ fill forwards tới lúc ẩn để không chớp lại
    if (out) out.finished.then(() => setLeaving((l) => (l === m.from ? null : l))).catch(() => {});
  }, [tab]);
  useLayoutEffect(() => {
    // khi tab cũ đã ẩn thì bỏ hiệu ứng mờ của nó (lần sau hiện lại bình thường)
    Object.entries(panes.current).forEach(([k, el]) => {
      if (el && k !== tab && k !== leaving) el.getAnimations().forEach((a) => { if (a.effect && a.effect.target === el) a.cancel(); });
    });
  }, [leaving, tab]);

  // vào app (từ màn nhập PIN hoặc splash): tiêu đề trượt vào, thanh chuyển tab trồi lên, các thẻ đơn nảy lần lượt như trang chủ app khách
  const reduce = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // chờ dữ liệu về xong (màn splash che bên trên) rồi mới chạy hiệu ứng, để không bị giật khi React vẽ lại nhiều lần
  const [late, setLate] = useState(false); // quá 4 giây vẫn chưa có dữ liệu: bỏ splash, không kẹt mãi
  useEffect(() => { const t = setTimeout(() => setLate(true), 4000); return () => clearTimeout(t); }, []);
  const ready = (orders !== null && users !== null) || late;
  const [veil, setVeil] = useState(true); // true: splash còn che
  const introDone = useRef(false);
  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => setVeil(false), 520);
    return () => clearTimeout(t);
  }, [ready]);
  useLayoutEffect(() => {
    const pane = panes.current.history;
    if (!ready || introDone.current) return;
    introDone.current = true;
    if (!pane || reduce()) return;
    const E = 'cubic-bezier(.22,1,.36,1)', B = 'cubic-bezier(.34,1.56,.64,1)';
    const go = (el, kf, o) => el && el.animate(kf, { fill: 'backwards', easing: E, ...o });
    go(pane.querySelector('.h-head, .a-title'), [{ opacity: 0, transform: 'translateY(-8px)' }, { opacity: 1, transform: 'none' }], { duration: 420, delay: 60 });
    go(pane.querySelector('.h-seg'), [{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 420, delay: 140 });
    const nav = document.querySelector('.a-nav');
    go(nav, [{ opacity: 0, transform: 'translateY(24px)' }, { opacity: 1, transform: 'none' }], { duration: 500, delay: 200 });
    nav && nav.querySelectorAll('button').forEach((b, k) => go(b, [{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 400, delay: 260 + k * 50 }));
  }, [ready]);
  const backTo = useRef(null); // mở đơn từ trang Trạng thái thanh toán: back lại về đó
  const [menu, setMenu] = useState([]);
  const [orders, setOrders] = useState(null);
  const [users, setUsersRaw] = useState(null); // null: chưa tải
  const setUsers = setUsersRaw;
  const [txs, setTxs] = useState([]);

  const [shop, setShop] = useState({});
  const [track, setTrack] = useState(null); // { id, n }: mở chi tiết đơn vừa đặt
  const [payFocus, setPayFocus] = useState(null); // { phone, n }: mở trang Chưa thanh toán của một khách
  const [notif, setNotif] = useState(false); // trang Thông báo mở từ chuông ở các tab

  useEffect(() => {
    const fail = (e) => toast(errText(e));
    const subs = [
      watchMenu(setMenu, fail),
      watchOrders(null, true, setOrders, fail),
      watchUsers(setUsers, fail),
      watchTransactions(setTxs, fail),
      watchShop(setShop, fail),
    ];
    return () => subs.forEach((u) => u && u());
  }, [toast]);

  const pending = (orders || []).filter((o) => o.status === 'pending').length;
  const claims = claimGroups(orders || []).length;
  // Link từ Telegram: /admin/order/#1234, /admin/wallet, /admin/menu/bac, /admin/account (?pay=SĐT mở trang chưa thanh toán của khách)
  const deep = useRef((() => {
    const seg = window.location.pathname.replace(/^\/(admin|quanly)/, '').split('/').filter(Boolean);
    return { a: seg[0] || '', b: seg[1] || '', h: decodeURIComponent(window.location.hash.slice(1)), pay: new URLSearchParams(window.location.search).get('pay') };
  })());
  const [dive, setDive] = useState(null); // { kind, n }: mở món trong tab Menu
  useEffect(() => {
    const d = deep.current;
    if (!d || orders === null) return;
    deep.current = null;
    if (!d.a && !d.pay) return;
    window.history.replaceState(null, '', window.location.pathname.startsWith('/quanly') ? '/quanly' : '/admin');
    if (d.pay) { setPayFocus({ phone: d.pay, n: Date.now() }); setTab('wallet'); }
    else if (['order', 'orders', 'history'].includes(d.a)) {
      const o = d.h && orders.find((x) => orderCode(x) === `#${d.h}`);
      if (o) setTrack({ id: o.id, n: Date.now() });
      setTab('history');
    } else if (d.a === 'wallet') setTab('wallet');
    else if (d.a === 'menu') { setTab('order'); if (d.b) setDive({ kind: d.b, n: Date.now() }); }
    else if (['account', 'settings'].includes(d.a)) setTab('settings');
  }, [orders]);
  const openClaim = (phone) => { setNotif(false); setPayFocus({ phone, n: Date.now() }); setTab('wallet'); };
  // tên khách luôn theo hồ sơ hiện tại, không theo tên lúc đặt đơn
  // tên khách lấy theo tài khoản hiện tại; khách đã bị xoá thì hiện số điện thoại đặt hàng
  const named = useMemo(() => (orders || []).map((o) => {
    if (!users) return o;
    const u = users[o.customerPhone];
    if (!u) return { ...o, customerName: phoneText(o.customerPhone) || o.customerName };
    return u.name && u.name !== o.customerName ? { ...o, customerName: u.name } : o;
  }), [orders, users]);
  const data = { shop, menu, orders: named, users: users || {}, txs, loading: orders === null, unread: pending + claims, onBell: () => setNotif(true), onPay: openClaim };

  return (
    <>
      {veil && <Splash out={ready} />}
      <div className="a-tab" ref={(e) => { panes.current.order = e; }} hidden={tab !== 'order' && leaving !== 'order'}><OrderTab {...data} dive={dive} onTrack={(id) => { setTrack({ id, n: Date.now() }); setTab('history'); }} /></div>
      <div className="a-tab" ref={(e) => { panes.current.history = e; }} hidden={tab !== 'history' && leaving !== 'history'}><HistoryTab {...data} track={track} onClose={() => { const t = backTo.current; backTo.current = null; if (t) setTab(t); }} onGoOrder={() => setTab('order')} /></div>
      <div className="a-tab" ref={(e) => { panes.current.wallet = e; }} hidden={tab !== 'wallet' && leaving !== 'wallet'}><WalletTab {...data} focus={payFocus} onOpenOrder={(id) => { backTo.current = 'wallet'; setTrack({ id, n: Date.now() }); setTab('history'); }} /></div>
      <div className="a-tab" ref={(e) => { panes.current.settings = e; }} hidden={tab !== 'settings' && leaving !== 'settings'}><SettingsTab {...data} adminPhone={adminPhone} onLogout={onLogout} /></div>
      {notif && (
        <div className="a-tab a-over">
          <Notifs orders={data.orders} onPay={openClaim} onBack={() => setNotif(false)} onOpen={(id) => { setNotif(false); setTrack({ id, n: Date.now() }); setTab('history'); }} />
        </div>
      )}
      <nav className="a-nav" style={{ position: 'absolute', left: 24, right: 24, bottom: 0, margin: '0 0 24px' }}>
        {NAV.map(([k, label]) => (
          <button key={k} className={tab === k ? 'on' : ''} onClick={() => { backTo.current = null; setTab(k); }} aria-label={label} title={label}>
            <NavIcon k={k} />
            {k === 'history' && pending > 0 && <span key={pending} className="a-badge pop">{pending}</span>}
          </button>
        ))}
      </nav>
    </>
  );
}
