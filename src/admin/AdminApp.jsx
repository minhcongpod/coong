import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { auth } from '../firebase';
import { getSetup, watchDevice, unlockDevice, lockDevice, watchOrders, watchMenu, watchUsers, watchTransactions } from '../db';
import './admin.css';
import { Sym, UIProvider, useUI, errText } from './ui.jsx';
import OrderTab from './OrderTab.jsx';
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

  // đủ 4 số thì vào luôn, không cần nút
  const submit = async (value) => {
    if (busy) return;
    setBusy(true);
    try { await onLogin(value); } catch (err) {
      setError(err.code === 'permission-denied' ? 'Mã PIN không đúng!' : `Lỗi: ${err.code || err.message}`);
      setPin(''); setBusy(false);
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
        <div style={{ display: 'flex', gap: 8, position: 'relative' }} onClick={() => document.getElementById('a-pin').focus()}>
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

const NavIcon = ({ k }) => {
  if (k === 'order') return <Sym id="i-cup" size={32} />;
  if (k === 'history') return <Sym id="i-list" size={32} />;
  if (k === 'wallet') return <span className="a-bars" aria-hidden="true"><i style={{ height: 17 }} /><i style={{ height: 31 }} /><i style={{ height: 22 }} /></span>;
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" fillRule="evenodd" stroke="currentColor" strokeWidth="1" strokeLinejoin="round" d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2zM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0z" />
    </svg>
  );
};

const NAV = [['order', 'Đặt hàng'], ['history', 'Đơn hàng'], ['wallet', 'Thống kê'], ['settings', 'Cài đặt']];

function Shell({ adminPhone, onLogout }) {
  const { toast } = useUI();
  const [tab, setTab] = useState('order');
  const [menu, setMenu] = useState([]);
  const [orders, setOrders] = useState(null);
  const [users, setUsers] = useState({});
  const [txs, setTxs] = useState([]);

  useEffect(() => {
    const fail = (e) => toast(errText(e));
    const subs = [
      watchMenu(setMenu, fail),
      watchOrders(null, true, setOrders, fail),
      watchUsers(setUsers, fail),
      watchTransactions(setTxs, fail),
    ];
    return () => subs.forEach((u) => u && u());
  }, [toast]);

  const data = { menu, orders: orders || [], users, txs, loading: orders === null };
  const pending = data.orders.filter((o) => o.status === 'pending').length;

  return (
    <>
      <div className="a-tab" hidden={tab !== 'order'}><OrderTab {...data} /></div>
      <div className="a-tab" hidden={tab !== 'history'}><HistoryTab {...data} onGoOrder={() => setTab('order')} /></div>
      <div className="a-tab" hidden={tab !== 'wallet'}><WalletTab {...data} /></div>
      <div className="a-tab" hidden={tab !== 'settings'}><SettingsTab {...data} adminPhone={adminPhone} onLogout={onLogout} /></div>
      <nav className="a-nav" style={{ position: 'absolute', left: 24, right: 24, bottom: 0, margin: '0 0 31px' }}>
        {NAV.map(([k, label]) => (
          <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)} aria-label={label} title={label}>
            <NavIcon k={k} />
            {k === 'history' && pending > 0 && <span className="a-badge">{pending}</span>}
          </button>
        ))}
      </nav>
    </>
  );
}
