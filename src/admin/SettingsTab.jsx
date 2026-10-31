import React, { useState } from 'react';
import { saveMenuItem, deleteMenuItem, saveShop } from '../db';
import { Icon, Page, Btn, Toggle, Field, Empty, fmt, phoneText, XL_EXTRA, kindOf, useUI, errText } from './ui.jsx';
import { customersOf, CustomerPicker, NewCustomer, EditCustomerForm } from './Customers.jsx';

// Hàng nhập: nhãn bên trái, giá trị bên phải
const Row = ({ label, children }) => (
  <label className="s-row"><span>{label}</span>{children}</label>
);

// Tab Cài đặt: quản lý khách hàng, quản lý menu, đăng xuất
export default function SettingsTab({ menu, users, shop = {}, onLogout }) {
  const [page, setPage] = useState(null); // customers | newCustomer | { customer } | menu | { dish }
  const { confirm, toast } = useUI();
  const customers = customersOf(users);
  const back = () => setPage(null);

  if (page === 'customers') return <CustomerPicker users={users} onBack={back} onAdd={() => setPage('newCustomer')} onPick={(c) => setPage({ customer: c })} onEdit={(c) => setPage({ customer: c })} />;
  if (page === 'newCustomer') return <NewCustomer users={users} onBack={() => setPage('customers')} onCreated={() => setPage('customers')} />;
  if (page && page.customer) return <EditCustomerForm customer={page.customer} onBack={() => setPage('customers')} onSaved={() => setPage('customers')} onDeleted={() => setPage('customers')} />;
  if (page === 'hours') return <Hours shop={shop} onBack={back} />;
  if (page === 'menu') return <MenuList menu={menu} onBack={back} onNew={() => setPage({ dish: {} })} onOpen={(m) => setPage({ dish: m })} />;
  if (page && page.dish) return <EditDish dish={page.dish} onBack={() => setPage('menu')} />;

  const rows = [
    ['user', 'Quản lý khách hàng', `${customers.length} khách`, 'customers'],
    ['coffee', 'Quản lý menu', `${menu.length} món`, 'menu'],
    ['clock', 'Giờ đóng mở cửa', '', 'hours'],
  ];
  const flipSold = async (v) => { try { await saveShop({ soldOut: v }); } catch (e) { toast(errText(e)); } };
  return (
    <>
      <h1 className="a-title">Cài đặt</h1>
      <div className="a-body">
        <div className="a-card h">
          <span className="a-ibg"><Icon n="coffee" /></span>
          <b className="a-t grow" style={{ textAlign: 'left' }}>Hết hàng</b>
          <Toggle on={!!shop.soldOut} onChange={flipSold} label="Tạm ngưng nhận đơn" />
        </div>
        {rows.map(([i, t, s, k]) => (
          <button key={k} className="a-card h" onClick={() => setPage(k)}>
            <span className="a-ibg"><Icon n={i} /></span>
            <b className="a-t grow" style={{ textAlign: 'left' }}>{t}</b>
            <span className="m"><Icon n="right" /></span>
          </button>
        ))}
      </div>
      <div className="a-foot">
        <Btn kind="danger" icon="logout" onClick={async () => (await confirm({ title: 'Đăng xuất?', msg: 'Bạn sẽ cần nhập lại mã PIN để vào.', ok: 'Đăng xuất', danger: true })) && onLogout()}>Đăng xuất</Btn>
      </div>
    </>
  );
}

function MenuList({ menu, onBack, onNew, onOpen }) {
  const { toast } = useUI();
  const flip = async (m, v) => { try { await saveMenuItem({ id: m.id, active: v }); } catch (e) { toast(errText(e)); } };
  return (
    <Page title="Menu" onBack={onBack} footer={<Btn icon="plus" onClick={onNew}>Thêm món</Btn>}>
      {menu.map((m) => {
        const on = m.active !== false;
        return (
          <div key={m.id} className="a-card h">
            <button className="grow s-dish" style={{ opacity: on ? 1 : 0.5 }} onClick={() => onOpen(m)}>
              <b className="a-t a-ell">{m.name}</b><span className="a-t a-num">{fmt(m.price)}</span>
            </button>
            <Toggle on={on} onChange={(v) => flip(m, v)} label={`${m.name} còn hàng`} />
            <button className="m" onClick={() => onOpen(m)} aria-label={`Sửa ${m.name}`}><Icon n="right" /></button>
          </div>
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
  const [upsize, setUpsize] = useState(String(typeof dish.upsize === 'number' ? dish.upsize : kindOf(dish.name || '') === 'den' ? 0 : XL_EXTRA));
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
      title={isNew ? 'Thêm món' : 'Sửa món'} onBack={onBack}
      footer={(
        <div style={{ display: 'flex', gap: 8 }}>
          {!isNew && <Btn kind="danger" onClick={remove}>Xoá món</Btn>}
          <Btn onClick={save}>Lưu lại</Btn>
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

// Giờ mở cửa: ngoài giờ này app khách không cho đặt đơn. Để trống cả hai là không giới hạn.
function Hours({ shop, onBack }) {
  const { toast } = useUI();
  const [openAt, setOpenAt] = useState(shop.openAt || '');
  const [closeAt, setCloseAt] = useState(shop.closeAt || '');
  const save = async () => {
    if (!!openAt !== !!closeAt) return toast('Nhập đủ giờ mở và giờ đóng');
    try { await saveShop({ openAt, closeAt }); toast('Đã lưu', true); onBack(); } catch (e) { toast(errText(e)); }
  };
  return (
    <Page title="Giờ đóng mở cửa" onBack={onBack} footer={<Btn onClick={save}>Lưu lại</Btn>}>
      <Row label="Mở cửa"><input type="time" value={openAt} onChange={(e) => setOpenAt(e.target.value)} aria-label="Giờ mở cửa" /></Row>
      <Row label="Đóng cửa"><input type="time" value={closeAt} onChange={(e) => setCloseAt(e.target.value)} aria-label="Giờ đóng cửa" /></Row>
      <p className="a-s" style={{ padding: '0 8px' }}>Ngoài giờ này khách không đặt đơn được. Xoá cả hai giờ để không giới hạn.</p>
    </Page>
  );
}
