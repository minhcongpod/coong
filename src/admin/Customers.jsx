import React, { useState, useMemo } from 'react';
import { createCustomer, updateUserName, deleteCustomer } from '../db';
import { Icon, Sym, Page, Btn, Field, Empty, byName, phoneText, useUI, errText } from './ui.jsx';

export const customersOf = (users) => Object.values(users).filter((u) => u.role === 'customer').sort(byName);

const norm = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd');

// Chọn khách theo tên hoặc số điện thoại; thêm khách mới và sửa khách ngay tại đây
export function CustomerPicker({ users, selected, onPick, onBack, onAdd, onEdit }) {
  const [q, setQ] = useState('');
  const list = useMemo(() => {
    const k = norm(q).replace(/\s/g, '');
    return customersOf(users).filter((u) => !k || norm(u.name).replace(/\s/g, '').includes(k) || u.phone.includes(k));
  }, [users, q]);
  return (
    <Page className="s-pg" onBack={onBack} footer={onAdd && <button className="a-btn s-add" onClick={onAdd}><Sym id="i-s-plus" size={20} />Thêm khách</button>}>
      <label className="s-search"><Sym id="i-s-search" size={20} /><input placeholder="Tìm tên hoặc SĐT" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Tìm khách" /></label>
      {list.map((u) => (
        <div key={u.phone} className="s-cust" role="button" tabIndex={0} onClick={() => onPick(u)} aria-label={`Chọn ${u.name}`}>
          <span className="s-name"><b className="a-ell">{u.name}</b><small>{phoneText(u.phone)}</small></span>
          {selected && selected.phone === u.phone && <span className="g"><Icon n="check" /></span>}
          {onEdit
            ? <button className="s-chev" onClick={(e) => { e.stopPropagation(); onEdit(u); }} aria-label={`Sửa ${u.name}`}><Sym id="i-s-right" size={20} /></button>
            : <span className="s-chev"><Sym id="i-s-right" size={20} /></span>}
        </div>
      ))}
      {list.length === 0 && <Empty icon="user" title="Không thấy khách" text="Thử tên hoặc số khác, hoặc bấm Thêm khách." />}
    </Page>
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
