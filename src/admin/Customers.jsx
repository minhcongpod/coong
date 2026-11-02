import React, { useState, useMemo, useRef } from 'react';
import { tgMessageCustomer } from '../telegram';
import { createCustomer, updateUserName, deleteCustomer } from '../db';
import { Icon, Sym, Page, Btn, Field, Empty, byName, phoneText, useUI, errText } from './ui.jsx';

export const customersOf = (users) => Object.values(users).filter((u) => u.role === 'customer').sort(byName);

const norm = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd');

// Chọn khách theo tên hoặc số điện thoại; thêm khách mới và sửa khách ngay tại đây
export function CustomerPicker({ users, selected, onPick, onBack, onAdd, onEdit, onChat }) {
  const [q, setQ] = useState('');
  const [chat, setChat] = useState(null);
  const list = useMemo(() => {
    const k = norm(q).replace(/\s/g, '');
    return customersOf(users).filter((u) => !k || norm(u.name).replace(/\s/g, '').includes(k) || u.phone.includes(k));
  }, [users, q]);
  return (<>
    <Page className="s-pg" onBack={onBack} footer={onAdd && <button className="a-btn s-add" onClick={onAdd}><Sym id="i-s-plus" size={20} />Thêm khách</button>}>
      <label className="s-search"><Sym id="i-s-search" size={20} /><input placeholder="Tìm tên hoặc SĐT" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Tìm khách" /></label>
      {list.map((u) => (
        <div key={u.phone} className="s-cust" role="button" tabIndex={0} onClick={() => onPick(u)} aria-label={`Chọn ${u.name}`}>
          <span className="s-name"><b className="a-ell">{u.name}</b><small>{phoneText(u.phone)}</small></span>
          {selected && selected.phone === u.phone && <span className="g"><Icon n="check" /></span>}
          {onChat && <button className="s-chat" onClick={(e) => { e.stopPropagation(); setChat(u); }} aria-label={`Nhắn ${u.name}`}><svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M4.5 2.5h11A2.5 2.5 0 0 1 18 5v7a2.5 2.5 0 0 1-2.5 2.5H9L5.2 17.6a.6.6 0 0 1-1-.5v-2.6H4.5A2.5 2.5 0 0 1 2 12V5a2.5 2.5 0 0 1 2.5-2.5z" /></svg></button>}
          {onEdit
            ? <button className="s-chev" onClick={(e) => { e.stopPropagation(); onEdit(u); }} aria-label={`Sửa ${u.name}`}><Sym id="i-s-right" size={20} /></button>
            : <span className="s-chev"><Sym id="i-s-right" size={20} /></span>}
        </div>
      ))}
      {list.length === 0 && <Empty icon="user" title="Không thấy khách" text="Thử tên hoặc số khác, hoặc bấm Thêm khách." />}
    </Page>
    {chat && <ChatSheet customer={chat} onClose={() => setChat(null)} />}
  </>);
}

// Nhắn riêng cho một khách (qua Telegram): bottom sheet, gạt xuống để đóng
function ChatSheet({ customer, onClose }) {
  const { toast } = useUI();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const box = useRef(null), drag = useRef(null);
  const down = (e) => { drag.current = { y: e.clientY, dy: 0 }; box.current.style.transition = 'none'; e.currentTarget.setPointerCapture(e.pointerId); };
  const move = (e) => { const d = drag.current; if (!d) return; d.dy = Math.max(0, e.clientY - d.y); box.current.style.transform = `translateY(${d.dy}px)`; };
  const up = () => {
    const d = drag.current; drag.current = null; if (!d) return;
    box.current.style.transition = 'transform .25s var(--ease-out)';
    if (d.dy > 90) { box.current.style.transform = 'translateY(100%)'; setTimeout(onClose, 200); } else box.current.style.transform = '';
  };
  const send = async () => {
    const t = text.trim(); if (!t || busy) return;
    setBusy(true);
    const r = await tgMessageCustomer(customer.phone, t);
    setBusy(false);
    if (r === 'ok') { toast(`Đã nhắn ${customer.name}`, true); onClose(); }
    else toast(r === 'nochat' ? `${customer.name} chưa bật Telegram nên chưa nhắn được` : r === 'notoken' ? 'Chưa kết nối bot Telegram trong Cài đặt' : 'Chưa gửi được, thử lại nhé');
  };
  return (
    <div className="o-sheetbg" onClick={onClose}>
      <div className="o-sheet c-sheet" ref={box} role="dialog" aria-label={`Nhắn ${customer.name}`} onClick={(e) => e.stopPropagation()}>
        <div className="c-grab" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}><div className="o-handle" /></div>
        <div className="c-head"><b className="a-ell">{customer.name}</b><small>{phoneText(customer.phone)}</small></div>
        <label className="a-card w-notecard">
          <textarea
            className="w-note" rows={3} value={text} placeholder="Nhập nội dung" aria-label="Nội dung"
            ref={(el) => { if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; } }}
            onChange={(e) => setText(e.target.value.slice(0, 1000))}
          />
        </label>
        <Btn onClick={send} disabled={busy || !text.trim()}>{busy ? 'Đang gửi...' : 'Gửi'}</Btn>
      </div>
    </div>
  );
}

// Mã PIN ngẫu nhiên cho khách do quán tạo: khách tự đặt PIN riêng bằng "Quên hả?" (số điện thoại + tên đặt hàng)
const DEFAULT_PIN = '0000'; // khách tự đặt PIN mới ở lần đăng nhập đầu

// Tạo khách mới: tên đặt hàng và số điện thoại
export function NewCustomer({ users, onBack, onCreated }) {
  const { toast } = useUI();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const p = phone.replace(/\D/g, '');
    if (!name.trim()) return setError('Nhập tên đặt hàng.');
    if (p.length < 9 || p.length > 11) return setError('Số điện thoại chưa đúng.');
    if (users[p]) return setError('Số điện thoại này đã có tài khoản.');
    setBusy(true);
    try {
      await createCustomer({ phone: p, name: name.trim(), pin: DEFAULT_PIN });
      toast('Đã tạo khách', true);
      onCreated({ phone: p, name: name.trim(), role: 'customer' });
    } catch (e) { setError(errText(e)); setBusy(false); }
  };

  return (
    <Page className="s-pg s-form" title="Khách hàng mới" onBack={onBack} footer={<Btn onClick={save} disabled={busy}>{busy ? 'Đang lưu...' : 'Lưu lại'}</Btn>}>
      <Field placeholder="Tên đặt hàng" value={name} onChange={(e) => { setName(e.target.value); setError(''); }} aria-label="Tên đặt hàng" />
      <Field placeholder="Số điện thoại" type="tel" inputMode="numeric" value={phone} onChange={(e) => { setPhone(e.target.value.replace(/[^\d\s]/g, '')); setError(''); }} aria-label="Số điện thoại" />
      {error && <p className="a-err">{error}</p>}
    </Page>
  );
}

// Sửa khách: đổi tên đặt hàng hoặc xoá khách (số điện thoại là mã tài khoản nên không đổi)
export function EditCustomerForm({ customer, onBack, onSaved, onDeleted }) {
  const { toast, confirm } = useUI();
  const [name, setName] = useState(customer.name);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!name.trim()) return setError('Nhập tên đặt hàng.');
    setBusy(true);
    try {
      if (name.trim() !== customer.name) await updateUserName(customer.phone, name.trim());
      toast('Đã lưu', true);
      onSaved({ ...customer, name: name.trim() });
    } catch (e) { setError(errText(e)); setBusy(false); }
  };
  const remove = async () => {
    if (!(await confirm({ title: `Xoá ${customer.name}?`, msg: 'Đơn cũ vẫn giữ lại trong lịch sử.', ok: 'Xoá khách', danger: true }))) return;
    try { await deleteCustomer(customer.phone); onDeleted(customer); } catch (e) { setError(errText(e)); }
  };

  return (
    <Page
      className="s-pg s-form" title="Sửa khách hàng" onBack={onBack}
      footer={(
        <div style={{ display: 'flex', gap: 8 }}>
          <Btn kind="danger" onClick={remove} disabled={busy}>Xoá khách</Btn>
          <Btn onClick={save} disabled={busy}>{busy ? 'Đang lưu...' : 'Lưu lại'}</Btn>
        </div>
      )}
    >
      <Field placeholder="Tên đặt hàng" value={name} onChange={(e) => { setName(e.target.value); setError(''); }} aria-label="Tên đặt hàng" />
      <Field value={phoneText(customer.phone)} disabled aria-label="Số điện thoại" />
      {error && <p className="a-err">{error}</p>}
    </Page>
  );
}
