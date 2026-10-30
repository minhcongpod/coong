import React, { useState, useEffect, useRef } from 'react';
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { auth } from '../firebase';
import { getSetup, watchDevice, unlockDevice, lockDevice, watchOrders, updateOrder } from '../db';

// Token theo Figma (Color + Size): chữ 12/14/16/18/24/32/44, bo góc 32, padding 24/16, gap 8
const TOKENS = {
  '--core-black': '#000',
  '--core-white': '#fff',
  '--white-10': 'rgba(255,255,255,0.1)',
  '--white-50': 'rgba(255,255,255,0.5)',
  '--radius-card': '32px',
  '--space-x': '24px',
  '--space-y': '16px',
  '--space-gap': '8px',
  '--space-section': '24px',
};

const STATUS_LABELS = { pending: 'Chờ xác nhận', brewing: 'Đang pha chế', completed: 'Hoàn thành', cancelled: 'Huỷ' };
const TABS = [['pending', 'Chờ xác nhận'], ['brewing', 'Đang pha chế'], ['completed', 'Hoàn thành'], ['cancelled', 'Huỷ']];

const money = (n) => `${(n || 0).toLocaleString('vi-VN')}đ`;
const shortId = (id) => id.slice(-6).toUpperCase();
const timeText = (o) => (o.createdAt ? new Date(o.createdAt).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }) : '');
// Khách bấm "Tôi đã thanh toán" → paymentStatus 'awaiting' (biểu tượng đồng hồ cát phía khách)
const paymentState = (o) => (o.paid ? 'confirmed' : o.paymentStatus === 'awaiting' ? 'awaiting' : 'unpaid');

const font = { fontFamily: "'Space Grotesk', system-ui, sans-serif" };

function Shell({ children }) {
  useEffect(() => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&display=swap';
    document.head.appendChild(link);
    document.title = 'Coong – Chủ quán';
    return () => link.remove();
  }, []);
  return (
    <div style={{ ...TOKENS, ...font, background: 'var(--core-black)' }} className="min-h-screen text-white">
      <div className="mx-auto max-w-md min-h-screen relative">{children}</div>
    </div>
  );
}

const Logo = () => <div className="text-[24px] font-bold tracking-tight">CoonG</div>;

export default function AdminApp() {
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

  if (stage === 'loading') return <Shell><p className="p-6 text-[16px]" style={{ color: 'var(--white-50)' }}>Đang kết nối...</p></Shell>;
  if (stage === 'error') {
    return (
      <Shell>
        <div className="p-6">
          <h1 className="text-[24px] font-bold mb-2">Không kết nối được</h1>
          <p className="text-[14px] mb-4" style={{ color: 'var(--white-50)' }}>Mã lỗi: {errorText}</p>
          <button onClick={() => window.location.reload()} className="w-full h-[60px] bg-white text-black text-[18px] font-bold" style={{ borderRadius: 'var(--radius-card)' }}>Thử lại</button>
        </div>
      </Shell>
    );
  }
  if (stage === 'locked') return <Shell><Login onLogin={login} /></Shell>;
  return <Shell><Orders onLogout={() => lockDevice(uid)} /></Shell>;
}

function Login({ onLogin }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);

  const submit = async (e) => {
    e.preventDefault();
    if (pin.length !== 4) return setError('Mã PIN gồm 4 chữ số.');
    setBusy(true);
    try { await onLogin(pin); } catch (err) {
      setError(err.code === 'permission-denied' ? 'Mã PIN không đúng!' : `Lỗi: ${err.code || err.message}`);
      setPin(''); setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-[52px] px-[24px] py-[24px]" onClick={() => inputRef.current?.focus()}>
      <div className="h-[52px] flex items-center"><Logo /></div>
      <div className="flex flex-col" style={{ gap: 'var(--space-section)' }}>
        <div>
          <h1 className="text-[32px] font-bold leading-[46px]">Chào Coong</h1>
          <p className="text-[16px] font-medium" style={{ color: 'var(--white-50)' }}>Nhập mã PIN để quản lý quán</p>
        </div>
        <div className="flex" style={{ gap: 'var(--space-gap)' }}>
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="flex-1 h-[56px] flex items-center justify-center text-[24px] font-bold"
              style={{ background: 'var(--white-10)', borderRadius: 'var(--radius-card)', border: i === Math.min(pin.length, 3) ? '1.5px solid #fff' : '1.5px solid transparent' }}
            >
              {pin[i] ? '•' : ''}
            </div>
          ))}
        </div>
        <input
          ref={inputRef}
          autoFocus
          type="tel"
          inputMode="numeric"
          autoComplete="off"
          maxLength={4}
          value={pin}
          onChange={(e) => { setPin(e.target.value.replace(/\D/g, '')); setError(''); }}
          className="absolute opacity-0 pointer-events-none w-0 h-0"
          aria-label="Mã PIN"
        />
        {error && <p className="text-[14px] text-rose-400 -mt-4">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="h-[60px] bg-white text-black text-[18px] font-bold disabled:opacity-60"
          style={{ borderRadius: 'var(--radius-card)', padding: 'var(--space-y) var(--space-x)' }}
        >
          {busy ? 'Đang kiểm tra...' : 'Đăng nhập'}
        </button>
      </div>
    </form>
  );
}

function Orders({ onLogout }) {
  const [orders, setOrders] = useState(null);
  const [tab, setTab] = useState('pending');
  const [err, setErr] = useState('');

  useEffect(() => watchOrders(null, true, setOrders, (e) => setErr(e.code || e.message)), []);

  const run = (p) => p.catch((e) => setErr(e.code || e.message));
  const setStatus = (o, status) => run(updateOrder(o.id, { status }));
  const confirmPaid = (o) => run(updateOrder(o.id, { paid: true, paymentStatus: 'confirmed' }));

  const list = (orders || []).filter((o) => o.status === tab);
  const count = (s) => (orders || []).filter((o) => o.status === s).length;
  const awaiting = (orders || []).filter((o) => o.status !== 'cancelled' && paymentState(o) === 'awaiting').length;

  return (
    <div className="px-[24px] py-[24px] pb-12 flex flex-col" style={{ gap: 'var(--space-section)' }}>
      <div className="flex items-center justify-between h-[52px]">
        <Logo />
        <button onClick={onLogout} className="text-[14px] font-medium px-[16px] h-[36px]" style={{ background: 'var(--white-10)', borderRadius: 'var(--radius-card)' }}>Đăng xuất</button>
      </div>
      <div>
        <h1 className="text-[32px] font-bold leading-[46px]">Đơn hàng</h1>
        <p className="text-[16px] font-medium" style={{ color: 'var(--white-50)' }}>
          {awaiting > 0 ? `⏳ ${awaiting} đơn chờ bạn xác nhận thanh toán` : 'Đơn khách đặt hiện ngay tại đây'}
        </p>
      </div>

      <div className="flex overflow-x-auto -mx-[24px] px-[24px]" style={{ gap: 'var(--space-gap)' }}>
        {TABS.map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className="shrink-0 h-[40px] px-[16px] text-[14px] font-bold whitespace-nowrap"
            style={{ borderRadius: 'var(--radius-card)', background: tab === key ? '#fff' : 'var(--white-10)', color: tab === key ? '#000' : '#fff' }}
          >
            {label} · {count(key)}
          </button>
        ))}
      </div>

      {err && <p className="text-[14px] text-rose-400">Lỗi: {err}</p>}
      {orders === null ? (
        <p className="text-[16px]" style={{ color: 'var(--white-50)' }}>Đang tải đơn...</p>
      ) : list.length === 0 ? (
        <p className="text-[16px] text-center py-8" style={{ color: 'var(--white-50)' }}>Chưa có đơn {STATUS_LABELS[tab].toLowerCase()}.</p>
      ) : (
        <div className="flex flex-col" style={{ gap: 'var(--space-gap)' }}>
          {list.map((o) => <OrderCard key={o.id} o={o} onStatus={setStatus} onConfirmPaid={confirmPaid} />)}
        </div>
      )}
    </div>
  );
}

function PayBadge({ state }) {
  const map = {
    confirmed: ['✓ Đã thanh toán', '#34d399'],
    awaiting: ['⏳ Chờ xác nhận thanh toán', '#fbbf24'],
    unpaid: ['Ghi nợ', '#fb7185'],
  };
  const [text, color] = map[state];
  return <span className="text-[12px] font-bold" style={{ color }}>{text}</span>;
}

function OrderCard({ o, onStatus, onConfirmPaid }) {
  const pay = paymentState(o);
  const btn = 'h-[44px] px-[16px] text-[14px] font-bold flex-1';
  const radius = { borderRadius: 'var(--radius-card)' };
  return (
    <div className="flex flex-col" style={{ ...radius, background: 'var(--white-10)', padding: 'var(--space-y) var(--space-x)', gap: 'var(--space-gap)' }}>
      <div className="flex justify-between items-start">
        <div>
          <div className="text-[18px] font-bold">{o.customerName}</div>
          <div className="text-[12px]" style={{ color: 'var(--white-50)' }}>{timeText(o)} · #{shortId(o.id)}</div>
        </div>
        <div className="text-[18px] font-bold">{money(o.totalAmount)}</div>
      </div>
      <div className="flex flex-col gap-1">
        {(o.items || []).map((it, i) => (
          <div key={i} className="text-[14px] flex justify-between" style={{ gap: 'var(--space-gap)' }}>
            <span>{it.quantity}× {it.name}{[it.sweetness, it.ice, it.caffeine].filter(Boolean).length ? ` (${[it.sweetness, it.ice, it.caffeine].filter(Boolean).join(', ')})` : ''}</span>
            <span style={{ color: 'var(--white-50)' }}>{money(it.price * it.quantity)}</span>
          </div>
        ))}
        {o.note && <p className="text-[14px] italic" style={{ color: 'var(--white-50)' }}>Ghi chú: {o.note}</p>}
      </div>
      {o.status !== 'cancelled' && <PayBadge state={pay} />}
      <div className="flex" style={{ gap: 'var(--space-gap)' }}>
        {o.status === 'pending' && (<>
          <button className={btn} style={{ ...radius, background: '#fff', color: '#000' }} onClick={() => onStatus(o, 'brewing')}>Nhận đơn · Pha chế</button>
          <button className={btn} style={{ ...radius, background: 'var(--white-10)' }} onClick={() => window.confirm('Huỷ đơn này?') && onStatus(o, 'cancelled')}>Huỷ</button>
        </>)}
        {o.status === 'brewing' && (<>
          <button className={btn} style={{ ...radius, background: '#fff', color: '#000' }} onClick={() => onStatus(o, 'completed')}>Hoàn thành</button>
          <button className={btn} style={{ ...radius, background: 'var(--white-10)' }} onClick={() => window.confirm('Huỷ đơn này?') && onStatus(o, 'cancelled')}>Huỷ</button>
        </>)}
        {(o.status === 'completed' || o.status === 'cancelled') && (
          <button className={btn} style={{ ...radius, background: 'var(--white-10)' }} onClick={() => onStatus(o, 'pending')}>Đưa về chờ xác nhận</button>
        )}
      </div>
      {o.status !== 'cancelled' && pay !== 'confirmed' && (
        <button className="h-[44px] text-[14px] font-bold" style={{ ...radius, background: pay === 'awaiting' ? '#fbbf24' : 'var(--white-10)', color: pay === 'awaiting' ? '#000' : '#fff' }} onClick={() => onConfirmPaid(o)}>
          Xác nhận đã nhận tiền
        </button>
      )}
    </div>
  );
}
