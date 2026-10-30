import React, { useState } from 'react';
import { saveMenuItem, deleteMenuItem, updateUserName, setPin, deleteCustomer } from '../db';
import { Icon, Page, Btn, Toggle, Field, Empty, fmt, phoneText, isLive, useUI, errText } from './ui.jsx';
import { customersOf, NewCustomer } from './Customers.jsx';

// Tab Cài đặt: quản lý khách hàng, menu, mã PIN chủ quán
export default function SettingsTab({ menu, users, orders, adminPhone, onLogout }) {
  const [page, setPage] = useState(null); // customers | newCustomer | { customer } | menu | { dish } | pin
  const { confirm } = useUI();
  const customers = customersOf(users);
  const back = () => setPage(null);

  if (page === 'customers') return <Customers customers={customers} orders={orders} onBack={back} onNew={() => setPage('newCustomer')} onOpen={(c) => setPage({ customer: c })} />;
  if (page === 'newCustomer') return <NewCustomer users={users} onBack={() => setPage('customers')} onCreated={() => setPage('customers')} />;
  if (page && page.customer) return <EditCustomer customer={users[page.customer.phone] || page.customer} orders={orders} onBack={() => setPage('customers')} />;
  if (page === 'menu') return <MenuList menu={menu} onBack={back} onNew={() => setPage({ dish: {} })} onOpen={(m) => setPage({ dish: m })} />;
  if (page && page.dish) return <EditDish dish={page.dish} onBack={() => setPage('menu')} />;
  if (page === 'pin') return <ChangePin adminPhone={adminPhone} onBack={back} />;

  const rows = [
    ['user', 'Quản lý khách hàng', `${customers.length} khách`, 'customers'],
    ['coffee', 'Quản lý menu', `${menu.length} món`, 'menu'],
    ['lock', 'Đổi mã PIN', 'Mã PIN đăng nhập chủ quán', 'pin'],
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

function Customers({ customers, orders, onBack, onNew, onOpen }) {
  const [q, setQ] = useState('');
  const debt = (phone) => orders.filter((o) => o.customerPhone === phone && isLive(o) && !o.paid).reduce((n, o) => n + (o.totalAmount || 0), 0);
  const k = q.replace(/\s/g, '').toLowerCase();
  const list = customers.filter((c) => !k || c.name.toLowerCase().includes(k) || c.phone.includes(k));
  return (
    <Page title="Khách hàng" sub={`${customers.length} khách`} onBack={onBack} footer={<Btn icon="plus" onClick={onNew}>Thêm khách</Btn>}>
      <Field icon="search" placeholder="Tìm tên hoặc SĐT" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Tìm khách" />
      {list.map((c) => {
        const d = debt(c.phone);
        return (
          <button key={c.phone} className="a-card h" onClick={() => onOpen(c)}>
            <span className="grow"><b className="a-t a-ell" style={{ display: 'block' }}>{c.name}</b><span className="a-s">{phoneText(c.phone)}</span></span>
            {d > 0 && <span className="a-xs r a-num">Nợ {fmt(d)}</span>}
            <span className="m"><Icon n="right" /></span>
          </button>
        );
      })}
      {list.length === 0 && <Empty icon="user" title="Chưa có khách" text="Bấm Thêm khách để tạo tài khoản." />}
    </Page>
  );
}

function EditCustomer({ customer, orders, onBack }) {
  const { toast, confirm } = useUI();
  const [name, setName] = useState(customer.name);
  const [pin, setPinText] = useState('');
  const debt = orders.filter((o) => o.customerPhone === customer.phone && isLive(o) && !o.paid).length;

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
    const msg = debt ? `Khách còn ${debt} đơn chưa thanh toán. Đơn cũ vẫn giữ lại trong lịch sử.` : 'Đơn cũ vẫn giữ lại trong lịch sử.';
    if (!(await confirm({ title: `Xoá ${customer.name}?`, msg, ok: 'Xoá khách', danger: true }))) return;
    try { await deleteCustomer(customer.phone); onBack(); } catch (e) { toast(errText(e)); }
  };
  return (
    <Page title={customer.name} sub="Khách hàng" onBack={onBack} footer={<div style={{ display: 'flex', gap: 8 }}><Btn className="sm" onClick={save}>Lưu</Btn><Btn kind="danger" className="sm" icon="trash" style={{ width: 'auto', flex: 'none' }} onClick={remove} aria-label="Xoá khách" /></div>}>
      <p className="a-lbl">Tên</p>
      <Field value={name} onChange={(e) => setName(e.target.value)} aria-label="Tên" />
      <p className="a-lbl">Số điện thoại</p>
      <Field value={phoneText(customer.phone)} disabled aria-label="Số điện thoại" />
      <p className="a-lbl">Đặt lại mã PIN (để trống nếu giữ nguyên)</p>
      <Field placeholder="PIN mới, 4 số" type="tel" inputMode="numeric" maxLength={4} value={pin} onChange={(e) => setPinText(e.target.value.replace(/\D/g, ''))} aria-label="PIN mới" />
    </Page>
  );
}

function MenuList({ menu, onBack, onNew, onOpen }) {
  const { toast } = useUI();
  const flip = (m, on) => saveMenuItem({ id: m.id, active: on }).catch((e) => toast(errText(e)));
  return (
    <Page title="Menu" sub={`${menu.length} món`} onBack={onBack} footer={<Btn icon="plus" onClick={onNew}>Thêm món</Btn>}>
      {menu.map((m) => {
        const on = m.active !== false;
        return (
          <div key={m.id} className="a-card h" role="button" tabIndex={0} onClick={() => onOpen(m)} onKeyDown={(e) => e.key === 'Enter' && onOpen(m)}>
            <span className="grow" style={{ opacity: on ? 1 : 0.5 }}><b className="a-t a-ell" style={{ display: 'block' }}>{m.name}</b><span className="a-s a-num">{fmt(m.price)}{on ? '' : ' · Tạm hết'}</span></span>
            <Toggle on={on} onChange={(v) => flip(m, v)} label={`Bán ${m.name}`} />
            <span className="m"><Icon n="right" /></span>
          </div>
        );
      })}
      {menu.length === 0 && <Empty icon="coffee" title="Chưa có món" text="Bấm Thêm món để tạo món đầu tiên." />}
    </Page>
  );
}

function EditDish({ dish, onBack }) {
  const { toast, confirm } = useUI();
  const isNew = !dish.id;
  const [name, setName] = useState(dish.name || '');
  const [price, setPrice] = useState(dish.price ? String(dish.price) : '');
  const [on, setOn] = useState(dish.active !== false);

  const save = async () => {
    const p = Number(price);
    if (!name.trim()) return toast('Nhập tên món');
    if (!(p > 0)) return toast('Nhập giá bán');
    try {
      await saveMenuItem({ id: dish.id, name: name.trim(), price: p, active: on, ...(isNew ? { cost: 0 } : {}) });
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
      footer={<div style={{ display: 'flex', gap: 8 }}><Btn className="sm" onClick={save}>Lưu</Btn>{!isNew && <Btn kind="danger" className="sm" icon="trash" style={{ width: 'auto', flex: 'none' }} onClick={remove} aria-label="Xoá món" />}</div>}
    >
      <p className="a-lbl">Tên món</p>
      <Field value={name} onChange={(e) => setName(e.target.value)} aria-label="Tên món" />
      <p className="a-lbl">Giá bán (đ)</p>
      <Field type="tel" inputMode="numeric" value={price ? fmt(Number(price)) : ''} placeholder="0" onChange={(e) => setPrice(e.target.value.replace(/\D/g, '').slice(0, 7))} aria-label="Giá bán" />
      <div className="a-card h">
        <span className="grow"><b className="a-t" style={{ display: 'block' }}>Đang bán</b><span className="a-s">Tắt khi tạm hết món</span></span>
        <Toggle on={on} onChange={setOn} label="Đang bán" />
      </div>
    </Page>
  );
}

function ChangePin({ adminPhone, onBack }) {
  const { toast } = useUI();
  const [pin, setPinText] = useState('');
  const [again, setAgain] = useState('');
  const save = async () => {
    if (!/^\d{4}$/.test(pin)) return toast('Mã PIN gồm 4 chữ số');
    if (pin !== again) return toast('Hai lần nhập chưa giống nhau');
    try { await setPin(adminPhone, pin); toast('Đã đổi mã PIN', true); onBack(); } catch (e) { toast(errText(e)); }
  };
  return (
    <Page title="Đổi mã PIN" sub="PIN dùng để đăng nhập chủ quán" onBack={onBack} footer={<Btn onClick={save}>Lưu mã PIN</Btn>}>
      <Field placeholder="PIN mới, 4 số" type="tel" inputMode="numeric" maxLength={4} value={pin} onChange={(e) => setPinText(e.target.value.replace(/\D/g, ''))} aria-label="PIN mới" />
      <Field placeholder="Nhập lại PIN mới" type="tel" inputMode="numeric" maxLength={4} value={again} onChange={(e) => setAgain(e.target.value.replace(/\D/g, ''))} aria-label="Nhập lại PIN" />
    </Page>
  );
}
