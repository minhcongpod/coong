import React, { useState } from 'react';
import { saveMenuItem, deleteMenuItem, saveShop } from '../db';
import { Icon, Sym, Page, Btn, Toggle, Field, Empty, fmt, phoneText, XL_EXTRA, kindOf, useUI, errText } from './ui.jsx';
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
    ['i-s-user', 'Quản lý khách hàng', 'customers'],
    ['i-s-cup', 'Quản lý menu', 'menu'],
    ['i-s-clock', 'Giờ đóng mở cửa', 'hours'],
  ];
  const flipSold = async (v) => { try { await saveShop({ soldOut: v }); } catch (e) { toast(errText(e)); } };
  return (
    <>
      <h1 className="a-title s-title">Cài đặt</h1>
      <div className="a-body s-list">
        <div className="s-item">
          <Sym id="i-s-soldout" size={20} />
          <b>Hết hàng</b>
          <Toggle on={!!shop.soldOut} onChange={flipSold} label="Hết hàng" />
        </div>
        {rows.map(([i, t, k]) => (
          <button key={k} className="s-item" onClick={() => setPage(k)}>
            <Sym id={i} size={20} />
            <b>{t}</b>
            <span className="s-chev"><Sym id="i-s-right" size={20} /></span>
          </button>
        ))}
        <button className="s-logout" onClick={async () => (await confirm({ title: 'Đăng xuất?', msg: 'Bạn sẽ cần nhập lại mã PIN để vào.', ok: 'Đăng xuất', danger: true })) && onLogout()}>Đăng xuất</button>
      </div>
    </>
  );
}

function MenuList({ menu, onBack, onNew, onOpen }) {
  const { toast } = useUI();
  const flip = async (m, v) => { try { await saveMenuItem({ id: m.id, active: v }); } catch (e) { toast(errText(e)); } };
  return (
    <Page className="s-pg" title="Menu" onBack={onBack} footer={<Btn icon="plus" onClick={onNew}>Thêm món</Btn>}>
      {menu.map((m) => {
        const on = m.active !== false;
        const kind = kindOf(m.name);
        return (
          <div key={m.id} className="s-dishcard" role="button" tabIndex={0} onClick={() => onOpen(m)}>
            <span className="s-thumb">{kind ? <img src={`/${kind}.webp`} alt="" /> : <Sym id="i-s-cup" size={20} />}</span>
            <span className="s-name" style={{ opacity: on ? 1 : 0.5 }}><b className="a-ell">{m.name}</b><small>{fmt(m.price)}</small></span>
            <span className="s-ctl">
              <Toggle on={on} onChange={(v) => flip(m, v)} label={`${m.name} còn hàng`} />
              <span className="s-chev"><Sym id="i-s-right" size={20} /></span>
            </span>
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
      className="s-pg" title={isNew ? 'Thêm món' : 'Sửa món'} onBack={onBack}
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
      <div className="s-row"><span>Còn hàng</span><Toggle on={on} onChange={setOn} label="Còn hàng" /></div>
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
    <Page className="s-pg" title="Giờ đóng mở cửa" onBack={onBack} footer={<Btn onClick={save}>Lưu lại</Btn>}>
      <Row label="Mở cửa"><input type="time" value={openAt} onChange={(e) => setOpenAt(e.target.value)} aria-label="Giờ mở cửa" /></Row>
      <Row label="Đóng cửa"><input type="time" value={closeAt} onChange={(e) => setCloseAt(e.target.value)} aria-label="Giờ đóng cửa" /></Row>
      <p className="a-s" style={{ padding: '0 8px' }}>Ngoài giờ này khách không đặt đơn được. Xoá cả hai giờ để không giới hạn.</p>
    </Page>
  );
}
