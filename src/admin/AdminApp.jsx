import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { auth } from '../firebase';
import { getSetup, watchDevice, unlockDevice, lockDevice, watchOrders, watchMenu, watchUsers, watchTransactions, watchShop } from '../db';
import './admin.css';
import { Sym, UIProvider, useUI, errText, stagger } from './ui.jsx';
import OrderTab, { Notifs } from './OrderTab.jsx';
import HistoryTab from './HistoryTab.jsx';
import WalletTab from './WalletTab.jsx';
import SettingsTab from './SettingsTab.jsx';

const FW = 390, FH = 660;

// Khung 390×660 co giãn vừa cửa sổ, giống app khách
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
  const st = Math.min(size.w / FW, size.h / FH);
  const dev = Math.abs(size.w - FW * st) > 1 || Math.abs(size.h - FH * st) > 1;
  return (
    <div className={`a-root${dev ? ' a-dev' : ''}`}>
      <div className="a-device" style={{ width: FW * st, height: FH * st }}>
        <div className="a-stage" style={{ transform: `scale(${st})` }}>{children}</div>
      </div>
    </div>
  );
}

export default function AdminApp() {
  return <Device><UIProvider><Gate /></UIProvider></Device>;
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

  if (stage === 'loading') return <Center><p className="a-sub">Đang kết nối...</p></Center>;
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

  const [menu, setMenu] = useState([]);
  const [orders, setOrders] = useState(null);
  const [users, setUsers] = useState({});
  const [txs, setTxs] = useState([]);
  const [shop, setShop] = useState({});
  const [track, setTrack] = useState(null); // { id, n }: mở chi tiết đơn vừa đặt
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
  const data = { shop, menu, orders: orders || [], users, txs, loading: orders === null, unread: pending, onBell: () => setNotif(true) };

  return (
    <>
      <div className="a-tab" ref={(e) => { panes.current.order = e; }} hidden={tab !== 'order' && leaving !== 'order'}><OrderTab {...data} onTrack={(id) => { setTrack({ id, n: Date.now() }); setTab('history'); }} /></div>
      <div className="a-tab" ref={(e) => { panes.current.history = e; }} hidden={tab !== 'history' && leaving !== 'history'}><HistoryTab {...data} track={track} onGoOrder={() => setTab('order')} /></div>
      <div className="a-tab" ref={(e) => { panes.current.wallet = e; }} hidden={tab !== 'wallet' && leaving !== 'wallet'}><WalletTab {...data} /></div>
      <div className="a-tab" ref={(e) => { panes.current.settings = e; }} hidden={tab !== 'settings' && leaving !== 'settings'}><SettingsTab {...data} adminPhone={adminPhone} onLogout={onLogout} /></div>
      {notif && (
        <div className="a-tab a-over">
          <Notifs orders={data.orders} onBack={() => setNotif(false)} onOpen={(id) => { setNotif(false); setTrack({ id, n: Date.now() }); setTab('history'); }} />
        </div>
      )}
      <nav className="a-nav" style={{ position: 'absolute', left: 24, right: 24, bottom: 0, margin: '0 0 31px' }}>
        {NAV.map(([k, label]) => (
          <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)} aria-label={label} title={label}>
            <NavIcon k={k} />
            {k === 'history' && pending > 0 && <span key={pending} className="a-badge pop">{pending}</span>}
          </button>
        ))}
      </nav>
    </>
  );
}
