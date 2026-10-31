import React, { useState, useMemo } from 'react';
import { createCustomer, updateUserName, deleteCustomer } from '../db';
import { Icon, Page, Btn, Field, Empty, byName, phoneText, useUI, errText } from './ui.jsx';

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
    <Page onBack={onBack} footer={onAdd && <Btn icon="plus" onClick={onAdd}>Thêm khách</Btn>}>
      <Field icon="search" placeholder="Tìm tên hoặc SĐT" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Tìm khách" />
      {list.map((u) => (
        <div key={u.phone} className="a-card h">
          <button className="grow" style={{ textAlign: 'left', minWidth: 0 }} onClick={() => onPick(u)} aria-label={`Chọn ${u.name}`}>
            <b className="a-t a-ell" style={{ display: 'block' }}>{u.name}</b>
            <span className="a-s">{phoneText(u.phone)}</span>
          </button>
          {selected && selected.phone === u.phone && <span className="g"><Icon n="check" /></span>}
          {onEdit && <button className="m" onClick={() => onEdit(u)} aria-label={`Sửa ${u.name}`}><Icon n="edit" size={20} /></button>}
        </div>
      ))}
      {list.length === 0 && <Empty icon="user" title="Không thấy khách" text="Thử tên hoặc số khác, hoặc bấm Thêm khách." />}
    </Page>
  );
}

// Mã PIN ngẫu nhiên cho khách do quán tạo: khách tự đặt PIN riêng bằng "Quên hả?" (số điện thoại + tên đặt hàng)
const randomPin = () => String(Math.floor(Math.random() * 10000)).padStart(4, '0');

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
      await createCustomer({ phone: p, name: name.trim(), pin: randomPin() });
      toast('Đã tạo khách', true);
      onCreated({ phone: p, name: name.trim(), role: 'customer' });
    } catch (e) { setError(errText(e)); setBusy(false); }
  };

  return (
    <Page title="Khách hàng mới" onBack={onBack} footer={<Btn onClick={save} disabled={busy}>{busy ? 'Đang lưu...' : 'Lưu lại'}</Btn>}>
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
      title="Sửa khách hàng" onBack={onBack}
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
