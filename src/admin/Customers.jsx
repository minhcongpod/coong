import React, { useState, useMemo } from 'react';
import { createCustomer } from '../db';
import { Icon, Page, Btn, Field, Empty, byName, phoneText, useUI, errText } from './ui.jsx';

export const customersOf = (users) => Object.values(users).filter((u) => u.role === 'customer').sort(byName);

const norm = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd');

// Chọn khách theo tên hoặc số điện thoại
export function CustomerPicker({ users, selected, onPick, onBack, onNew, allLabel, title = 'Chọn khách' }) {
  const [q, setQ] = useState('');
  const list = useMemo(() => {
    const k = norm(q).replace(/\s/g, '');
    return customersOf(users).filter((u) => !k || norm(u.name).replace(/\s/g, '').includes(k) || u.phone.includes(k));
  }, [users, q]);
  return (
    <Page
      title={title}
      sub="Tìm theo tên hoặc số điện thoại"
      onBack={onBack}
      footer={onNew && <Btn kind="ghost" icon="plus" onClick={onNew}>Tạo khách mới</Btn>}
    >
      <Field icon="search" placeholder="Tìm tên hoặc SĐT" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Tìm khách" />
      {allLabel && (
        <button className="a-card h" onClick={() => onPick(null)}>
          <span className="a-t grow">{allLabel}</span>
          {!selected && <span className="g"><Icon n="check" /></span>}
        </button>
      )}
      {list.map((u) => (
        <button key={u.phone} className="a-card h" onClick={() => onPick(u)}>
          <span className="grow">
            <b className="a-t a-ell" style={{ display: 'block' }}>{u.name}</b>
            <span className="a-s">{phoneText(u.phone)}</span>
          </span>
          {selected && selected.phone === u.phone && <span className="g"><Icon n="check" /></span>}
        </button>
      ))}
      {list.length === 0 && <Empty icon="user" title="Không thấy khách" text="Thử tên hoặc số khác, hoặc tạo khách mới." />}
    </Page>
  );
}

// Tạo khách mới: tên, số điện thoại và PIN 4 số
export function NewCustomer({ users, onBack, onCreated }) {
  const { toast } = useUI();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const p = phone.replace(/\D/g, '');
    if (!name.trim()) return setError('Nhập tên khách.');
    if (p.length < 9 || p.length > 11) return setError('Số điện thoại chưa đúng.');
    if (users[p]) return setError('Số điện thoại này đã có tài khoản.');
    if (!/^\d{4}$/.test(pin)) return setError('Mã PIN gồm 4 chữ số.');
    setBusy(true);
    try {
      await createCustomer({ phone: p, name: name.trim(), pin });
      toast('Đã tạo khách', true);
      onCreated({ phone: p, name: name.trim(), role: 'customer' });
    } catch (e) { setError(errText(e)); setBusy(false); }
  };

  return (
    <Page title="Khách mới" sub="Khách đăng nhập bằng số điện thoại và PIN" onBack={onBack} footer={<Btn onClick={save} disabled={busy}>{busy ? 'Đang lưu...' : 'Tạo khách'}</Btn>}>
      <Field placeholder="Tên khách" value={name} onChange={(e) => { setName(e.target.value); setError(''); }} aria-label="Tên khách" />
      <Field placeholder="Số điện thoại" type="tel" inputMode="numeric" value={phone} onChange={(e) => { setPhone(e.target.value.replace(/[^\d\s]/g, '')); setError(''); }} aria-label="Số điện thoại" />
      <Field placeholder="Mã PIN 4 số" type="tel" inputMode="numeric" maxLength={4} value={pin} onChange={(e) => { setPin(e.target.value.replace(/\D/g, '')); setError(''); }} aria-label="Mã PIN" />
      {error && <p className="a-err">{error}</p>}
    </Page>
  );
}
