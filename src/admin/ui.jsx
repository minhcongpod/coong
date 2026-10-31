import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { SYMS } from './symbols.js';

const PATHS = {
  coffee: '<path d="M10 2v2"/><path d="M14 2v2"/><path d="M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1"/><path d="M6 2v2"/>',
  list: '<rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/>',
  wallet: '<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>',
  sliders: '<path d="M21 4h-7"/><path d="M10 4H3"/><path d="M21 12h-9"/><path d="M8 12H3"/><path d="M21 20h-5"/><path d="M12 20H3"/><path d="M14 2v4"/><path d="M8 10v4"/><path d="M16 18v4"/>',
  plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
  minus: '<path d="M5 12h14"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  right: '<path d="m9 18 6-6-6-6"/>',
  edit: '<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/>',
  left: '<path d="m15 18-6-6 6-6"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  hourglass: '<path d="M5 22h14"/><path d="M5 2h14"/><path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22"/><path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2"/>',
  calendar: '<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>',
  user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  lock: '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
  trash: '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>',
  inn: '<path d="M17 7 7 17"/><path d="M17 17H7V7"/>',
  out: '<path d="M7 7h10v10"/><path d="M7 17 17 7"/>',
};

export const Icon = ({ n, size }) => (
  <svg width={size || 24} height={size || 24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" dangerouslySetInnerHTML={{ __html: PATHS[n] }} />
);

// Biểu tượng của app khách (cốc, giỏ, đồng hồ cát...)
export const Sym = ({ id, size = 24 }) => {
  const sym = SYMS[id];
  const [, , w, h] = sym.vb.split(' ').map(Number);
  return <svg width={size} height={Math.round((size * h) / w)} viewBox={sym.vb} aria-hidden="true" dangerouslySetInnerHTML={{ __html: sym.html }} />;
};

// --- định dạng ---
export const fmt = (n) => String(Math.round(n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
export const pad = (n) => String(n).padStart(2, '0');
export const shortId = (id) => id.slice(-6).toUpperCase();
// Mã đơn: số tăng dần (#1234); đơn cũ chưa có số thì lấy theo id
export const orderCode = (o) => (typeof o.no === 'number' ? `#${String(o.no).padStart(4, '0')}` : `#CG${o.id.slice(-4).toUpperCase()}`);
// Món nào có ảnh cốc riêng: khớp theo tên như app khách
export const kindOf = (name) => {
  const n = (name || '').toLowerCase();
  return n.includes('bạc') ? 'bac' : n.includes('đen') ? 'den' : n.includes('nâu') ? 'nau' : '';
};
export const timeOf = (rec) => (rec.createdAt ? new Date(rec.createdAt) : null);
export const hm = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
export const dmy = (d) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
export const dayLabel = (d) => {
  if (!d) return '';
  const t = new Date();
  if (d.toDateString() === t.toDateString()) return `Hôm nay · ${hm(d)}`;
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} · ${hm(d)}`;
};
export const phoneText = (p) => (p && p.length === 10 ? `${p.slice(0, 4)} ${p.slice(4, 7)} ${p.slice(7)}` : p || '');
export const byName = (a, b) => (a.name || '').localeCompare(b.name || '', 'vi');
export const errText = (e) => (e && (e.code === 'permission-denied' ? 'Không có quyền thực hiện' : e.code || e.message)) || 'Lỗi';

export const PAY = { cash: 'Tiền mặt', bank: 'Chuyển khoản', debt: 'Ghi nợ' };
export const XL_EXTRA = 5000;
export const payLabel = (o) => PAY[o.payMethod] || 'Ghi nợ';
export const STATUS = {
  pending: { label: 'Chờ xác nhận', cls: 'y', color: 'var(--yellow)' },
  brewing: { label: 'Đang pha chế', cls: 'b', color: 'var(--info)' },
  completed: { label: 'Hoàn thành', cls: 'g', color: 'var(--ok)' },
  cancelled: { label: 'Hủy', cls: 'r', color: 'var(--err)' },
};
// paid: chủ quán đã xác nhận tiền; awaiting: khách báo đã trả, chờ quán xác nhận
export const payState = (o) => (o.paid ? 'paid' : o.paymentStatus === 'awaiting' ? 'awaiting' : 'unpaid');
export const isLive = (o) => o.status !== 'cancelled';

// --- thông báo lỗi và hộp xác nhận ---
const UICtx = createContext(null);
export const useUI = () => useContext(UICtx);

export function UIProvider({ children }) {
  const [toast, setToast] = useState(null);
  const [dlg, setDlg] = useState(null);
  const timer = useRef(0);
  const show = useCallback((msg, ok) => {
    setToast({ msg, ok });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 3500);
  }, []);
  const confirm = useCallback((o) => new Promise((resolve) => setDlg({ ...o, resolve })), []);
  const close = (v) => { dlg.resolve(v); setDlg(null); };
  return (
    <UICtx.Provider value={{ toast: show, confirm }}>
      {children}
      {toast && <div className={`a-toast${toast.ok ? ' ok' : ''}`} role="alert">{toast.msg}</div>}
      {dlg && (
        <div className="a-dim" onClick={() => close(false)}>
          <div className="a-dlg" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <h3>{dlg.title}</h3>
            {dlg.msg && <p>{dlg.msg}</p>}
            <div className="acts">
              <button className="a-btn ghost" onClick={() => close(false)}>Giữ lại</button>
              <button className={`a-btn ${dlg.danger ? 'danger' : ''}`} onClick={() => close(true)}>{dlg.ok || 'Đồng ý'}</button>
            </div>
          </div>
        </div>
      )}
    </UICtx.Provider>
  );
}

// --- thành phần dùng chung ---
export const Btn = ({ kind = '', icon, children, ...p }) => (
  <button {...p} className={`a-btn ${kind} ${p.className || ''}`}>{icon && <Icon n={icon} />}{children}</button>
);

export const Seg = ({ items, value, onChange }) => (
  <div className="a-seg" role="tablist">
    {items.map(([k, label]) => (
      <button key={k} className={k === value ? 'on' : ''} role="tab" aria-selected={k === value} onClick={() => onChange(k)}>{label}</button>
    ))}
  </div>
);

export const Chip = ({ on, icon, tail, children, ...p }) => (
  <button {...p} className={`a-chip ${on ? 'on' : ''}`}>{icon && <Icon n={icon} />}{children}{tail && <Icon n="down" />}</button>
);

export const Toggle = ({ on, onChange, label }) => (
  <button className={`a-toggle ${on ? 'on' : ''}`} role="switch" aria-checked={on} aria-label={label} onClick={(e) => { e.stopPropagation(); onChange(!on); }}><i /></button>
);

export const Page = ({ title, sub, head, onBack, children, footer }) => (
  <div className="a-page">
    <button className="a-back" onClick={onBack} aria-label="Quay lại"><Icon n="left" size={28} /></button>
    {head}
    {title && <h1 className="a-title">{title}</h1>}
    {sub && <p className="a-sub">{sub}</p>}
    <div className="a-body">{children}</div>
    {footer && <div className="a-foot">{footer}</div>}
  </div>
);

export const Empty = ({ icon, title, text }) => (
  <div className="a-empty">
    <div className="eico"><Icon n={icon} size={44} /></div>
    <h3>{title}</h3>
    {text && <p>{text}</p>}
  </div>
);

export const Field = ({ icon, error, ...p }) => (
  <label className={`a-field ${error ? 'err' : ''}`}>{icon && <Icon n={icon} />}<input {...p} /></label>
);

export const Kv = ({ k, children, cls }) => (
  <div className={`a-kv ${cls || ''}`}><span>{k}</span><b>{children}</b></div>
);
