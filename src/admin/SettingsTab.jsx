import React, { useState } from 'react';
import { saveMenuItem, deleteMenuItem, updateUserName, setPin, deleteCustomer } from '../db';
import { Icon, Page, Btn, Toggle, Field, Empty, fmt, phoneText, XL_EXTRA, useUI, errText } from './ui.jsx';
import { customersOf, NewCustomer } from './Customers.jsx';

// Hàng nhập: nhãn bên trái, giá trị bên phải
const Row = ({ label, children }) => (
  <label className="s-row"><span>{label}</span>{children}</label>
);

// Tab Cài đặt: quản lý khách hàng, quản lý menu, đăng xuất
export default function SettingsTab({ menu, users, onLogout }) {
  const [page, setPage] = useState(null); // customers | newCustomer | { customer } | menu | { dish }
  const { confirm } = useUI();
  const customers = customersOf(users);
  const back = () => setPage(null);

  if (page === 'customers') return <Customers customers={customers} onBack={back} onNew={() => setPage('newCustomer')} onOpen={(c) => setPage({ customer: c })} />;
  if (page === 'newCustomer') return <NewCustomer users={users} onBack={() => setPage('customers')} onCreated={() => setPage('customers')} />;
  if (page && page.customer) return <EditCustomer customer={users[page.customer.phone] ? { phone: page.customer.phone, ...users[page.customer.phone] } : page.customer} onBack={() => setPage('customers')} />;
  if (page === 'menu') return <MenuList menu={menu} onBack={back} onNew={() => setPage({ dish: {} })} onOpen={(m) => setPage({ dish: m })} />;
  if (page && page.dish) return <EditDish dish={page.dish} onBack={() => setPage('menu')} />;

  const rows = [
    ['user', 'Quản lý khách hàng', `${customers.length} khách`, 'customers'],
    ['coffee', 'Quản lý menu', `${menu.length} món`, 'menu'],
  ];
  return (
    <>
      <h1 className="a-title">Cài đặt</h1>
      <div className="a-body">
        {rows.map(([i, t, s, k]) => (
          <button key={k} className="a-card h" onClick={() => setPage(k)}>
            <span className="a-ibg"><Icon n={i} /></span>
            <span className="grow"><b className="a-t" style={{ display: 'block' }}>{t}</b><span className="a-s">{s}</span></span>
            <span className="m"><Icon n="right" /></span>
          </button>
        ))}
      </div>
      <div className="a-foot">
        <Btn kind="danger" icon="logout" className="sm" onClick={async () => (await confirm({ title: 'Đăng xuất?', msg: 'Bạn sẽ cần nhập lại mã PIN để vào.', ok: 'Đăng xuất', danger: true })) && onLogout()}>Đăng xuất</Btn>
      </div>
    </>
  );
}

function Customers({ customers, onBack, onNew, onOpen }) {
  const [q, setQ] = useState('');
  const k = q.replace(/\s/g, '').toLowerCase();
  const list = customers.filter((c) => !k || c.name.toLowerCase().includes(k) || c.phone.includes(k));
  return (
    <Page title="Khách hàng" sub={`${customers.length} khách`} onBack={onBack} footer={<Btn className="sm" icon="plus" onClick={onNew}>Thêm khách</Btn>}>
      <Field icon="search" placeholder="Tìm tên hoặc SĐT" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Tìm khách" />
      {list.map((c) => (
        <button key={c.phone} className="a-card h" onClick={() => onOpen(c)}>
          <span className="grow"><b className="a-t a-ell" style={{ display: 'block' }}>{c.name}</b><span className="a-s">{phoneText(c.phone)}</span></span>
          <span className="m"><Icon n="right" /></span>
        </button>
      ))}
      {list.length === 0 && <Empty icon="user" title="Chưa có khách" text="Bấm Thêm khách để tạo tài khoản." />}
    </Page>
  );
}

function EditCustomer({ customer, onBack }) {
  const { toast, confirm } = useUI();
  const [name, setName] = useState(customer.name);
  const [pin, setPinText] = useState('');

  const save = async () => {
    if (!name.trim()) return toast('Nhập tên khách');
    try {
      if (name.trim() !== customer.name) await updateUserName(customer.phone, name.trim());
      if (pin) {
        if (!/^\d{4}$/.test(pin)) return toast('Mã PIN gồm 4 chữ số');
        await setPin(customer.phone, pin);
      }
      toast('Đã lưu', true); onBack();
    } catch (e) { toast(errText(e)); }
  };
  const remove = async () => {
    if (!(await confirm({ title: `Xoá ${customer.name}?`, msg: 'Đơn cũ vẫn giữ lại trong lịch sử.', ok: 'Xoá khách', danger: true }))) return;
    try { await deleteCustomer(customer.phone); onBack(); } catch (e) { toast(errText(e)); }
  };
  return (
    <Page
      title="Sửa khách" sub={customer.name} onBack={onBack}
      footer={<div style={{ display: 'flex', gap: 8 }}><Btn kind="danger" className="sm" icon="trash" style={{ width: 'auto', flex: 'none' }} onClick={remove}>Xoá khách</Btn><Btn className="sm" onClick={save}>Lưu</Btn></div>}
    >
      <Row label="Tên"><input value={name} onChange={(e) => setName(e.target.value)} aria-label="Tên" /></Row>
      <Row label="Số điện thoại"><input value={phoneText(customer.phone)} disabled aria-label="Số điện thoại" /></Row>
      <Row label="PIN mới"><input placeholder="Để trống nếu giữ" type="tel" inputMode="numeric" maxLength={4} value={pin} onChange={(e) => setPinText(e.target.value.replace(/\D/g, ''))} aria-label="PIN mới" /></Row>
    </Page>
  );
}

function MenuList({ menu, onBack, onNew, onOpen }) {
  return (
    <Page title="Menu" sub={`${menu.length} món`} onBack={onBack} footer={<Btn className="sm" icon="plus" onClick={onNew}>Thêm món</Btn>}>
      {menu.map((m) => {
        const on = m.active !== false;
        return (
          <button key={m.id} className="a-card h" onClick={() => onOpen(m)}>
            <span className="grow" style={{ opacity: on ? 1 : 0.5 }}><b className="a-t a-ell" style={{ display: 'block' }}>{m.name}</b><span className="a-s a-num">{fmt(m.price)}{on ? '' : ' · Hết hàng'}</span></span>
            <span className="m"><Icon n="right" /></span>
          </button>
        );
      })}
      {menu.length === 0 && <Empty icon="coffee" title="Chưa có món" text="Bấm Thêm món để tạo món đầu tiên." />}
    </Page>
  );
}

const digits = (v) => v.replace(/\D/g, '').slice(0, 7);

function EditDish({ dish, onBack }) {
  const { toast, confirm } = useUI();
  const isNew = !dish.id;
  const [name, setName] = useState(dish.name || '');
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
  const remove = async () => {
    if (!(await confirm({ title: `Xoá ${dish.name}?`, msg: 'Đơn cũ vẫn giữ nguyên.', ok: 'Xoá món', danger: true }))) return;
    try { await deleteMenuItem(dish.id); onBack(); } catch (e) { toast(errText(e)); }
  };
  return (
    <Page
      title={isNew ? 'Thêm món' : 'Sửa món'} sub={isNew ? undefined : dish.name} onBack={onBack}
      footer={(
        <div style={{ display: 'flex', gap: 8 }}>
          {!isNew && <Btn kind="danger" className="sm" icon="trash" style={{ width: 'auto', flex: 'none' }} onClick={remove}>Xoá món</Btn>}
          <Btn className="sm" onClick={save}>Lưu</Btn>
        </div>
      )}
    >
      <Row label="Tên món"><input value={name} onChange={(e) => setName(e.target.value)} aria-label="Tên món" /></Row>
      <Row label="Giá bán"><input type="tel" inputMode="numeric" placeholder="0" value={price ? fmt(Number(price)) : ''} onChange={(e) => setPrice(digits(e.target.value))} aria-label="Giá bán" /></Row>
      <Row label="Upsize"><input type="tel" inputMode="numeric" placeholder="0" value={upsize ? fmt(Number(upsize)) : '0'} onChange={(e) => setUpsize(digits(e.target.value))} aria-label="Phụ thu Upsize" /></Row>
      <div className="a-card h" style={{ paddingTop: 16, paddingBottom: 16 }}>
        <b className="a-t grow" style={{ fontSize: 18 }}>Còn hàng</b>
        <Toggle on={on} onChange={setOn} label="Còn hàng" />
      </div>
    </Page>
  );
}
