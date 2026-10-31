import React, { useState } from 'react';
import { saveMenuItem, deleteMenuItem, saveShop } from '../db';
import { Icon, Sym, Page, Btn, Toggle, Field, Empty, fmt, phoneText, XL_EXTRA, kindOf, useUI, errText, BellBtn } from './ui.jsx';
import { customersOf, CustomerPicker, NewCustomer, EditCustomerForm } from './Customers.jsx';

// Hàng nhập: nhãn bên trái, giá trị bên phải
const Row = ({ label, children }) => (
  <label className="s-row"><span>{label}</span>{children}</label>
);

// Tab Cài đặt: quản lý khách hàng, quản lý menu, đăng xuất
export default function SettingsTab({ menu, users, shop = {}, onLogout, unread, onBell }) {
  const [page, setPage] = useState(null); // customers | newCustomer | { customer } | menu | { dish }
  const { confirm, toast } = useUI();
  const customers = customersOf(users);
  const back = () => setPage(null);

  if (page === 'customers') return <CustomerPicker users={users} onBack={back} onAdd={() => setPage('newCustomer')} onPick={(c) => setPage({ customer: c })} onEdit={(c) => setPage({ customer: c })} />;
  if (page === 'newCustomer') return <NewCustomer users={users} onBack={() => setPage('customers')} onCreated={() => setPage('customers')} />;
  if (page && page.customer) return <EditCustomerForm customer={page.customer} onBack={() => setPage('customers')} onSaved={() => setPage('customers')} onDeleted={() => setPage('customers')} />;
  if (page === 'hours') return <Hours shop={shop} onBack={back} />;
  if (page === 'menu') return <MenuList menu={menu} onBack={back} onOpen={(m) => setPage({ dish: m })} />;
  if (page && page.dish) return <EditDish dish={page.dish} onBack={() => setPage('menu')} />;

  const rows = [
    ['i-s-user', 'Quản lý khách hàng', 'customers'],
    ['i-s-cup', 'Quản lý menu', 'menu'],
    ['i-s-clock', 'Giờ đóng mở cửa', 'hours'],
  ];
  const flipSold = async (v) => { try { await saveShop({ soldOut: v }); } catch (e) { toast(errText(e)); } };
  return (
    <>
      <div className="w-head"><h1 className="a-title s-title">Cài đặt</h1><BellBtn n={unread} onClick={onBell} /></div>
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

function MenuList({ menu, onBack, onOpen }) {
  const { toast } = useUI();
  const flip = async (m, v) => { try { await saveMenuItem({ id: m.id, active: v }); } catch (e) { toast(errText(e)); } };
  return (
    <Page className="s-pg" title="Menu" onBack={onBack}>
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
      {menu.length === 0 && <Empty icon="coffee" title="Chưa có món" text="Menu đang trống." />}
    </Page>
  );
}

const digits = (v) => v.replace(/\D/g, '').slice(0, 7);

function EditDish({ dish, onBack }) {
  const { toast, confirm } = useUI();
  const isNew = !dish.id;
  const name = dish.name || ''; // tên món cố định, không sửa
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
      className="s-pg" title={isNew ? 'Thêm món' : 'Sửa món'} onBack={onBack}
      footer={(
        <div style={{ display: 'flex', gap: 8 }}>
          {!isNew && <Btn kind="danger" onClick={remove}>Xoá món</Btn>}
          <Btn onClick={save}>Lưu lại</Btn>
        </div>
      )}
    >
      <div className="s-row"><span>Tên món</span><span className="s-ro">{name}</span></div>
      <Row label="Giá bán"><input type="tel" inputMode="numeric" placeholder="0" value={price ? fmt(Number(price)) : ''} onChange={(e) => setPrice(digits(e.target.value))} aria-label="Giá bán" /></Row>
      <Row label="Upsize"><input type="tel" inputMode="numeric" placeholder="0" value={upsize ? fmt(Number(upsize)) : '0'} onChange={(e) => setUpsize(digits(e.target.value))} aria-label="Phụ thu Upsize" /></Row>
      <div className="s-row"><span>Còn hàng</span><Toggle on={on} onChange={setOn} label="Còn hàng" /></div>
    </Page>
  );
}

// Giờ mở cửa: ngoài giờ này app khách không cho đặt đơn. Để trống cả hai là không giới hạn.
// Thứ trong tuần theo getDay(): 1..6 là T2..T7, 0 là CN
const DAYS = [[1, 'T2'], [2, 'T3'], [3, 'T4'], [4, 'T5'], [5, 'T6'], [6, 'T7'], [0, 'CN']];

// Một dòng giờ: chạm để chọn giờ, có giờ thì hiện ở giữa kèm nút x để xoá
function TimeRow({ label, value, onChange }) {
  return (
    <label className="s-time">
      <span>{label}</span>
      <input type="time" value={value} onChange={(e) => onChange(e.target.value)} aria-label={`Giờ ${label.toLowerCase()}`} className={value ? '' : 'empty'} />
      {value && <button type="button" className="s-clear" onClick={(e) => { e.preventDefault(); onChange(''); }} aria-label={`Xoá giờ ${label.toLowerCase()}`}><Icon n="x" size={24} /></button>}
    </label>
  );
}

// Giờ mở cửa và ngày mở cửa (Figma 91-6550): ngoài giờ hoặc ngày nghỉ thì khách không đặt được
function Hours({ shop, onBack }) {
  const { toast } = useUI();
  const [openAt, setOpenAt] = useState(shop.openAt || '');
  const [closeAt, setCloseAt] = useState(shop.closeAt || '');
  const [days, setDays] = useState(Array.isArray(shop.days) ? shop.days : DAYS.map((d) => d[0]));
  const flip = (k) => setDays((ds) => (ds.includes(k) ? ds.filter((x) => x !== k) : [...ds, k]));
  const save = async () => {
    if (!!openAt !== !!closeAt) return toast('Nhập đủ giờ mở và giờ đóng');
    try { await saveShop({ openAt, closeAt, days: [...days].sort() }); toast('Đã lưu', true); onBack(); } catch (e) { toast(errText(e)); }
  };
  return (
    <Page className="s-pg s-hours" title="Giờ đóng mở cửa" onBack={onBack} footer={<Btn onClick={save}>Lưu lại</Btn>}>
      <TimeRow label="Mở cửa" value={openAt} onChange={setOpenAt} />
      <TimeRow label="Đóng cửa" value={closeAt} onChange={setCloseAt} />
      <div className="s-days">
        {DAYS.map(([k, l]) => <button key={k} className={days.includes(k) ? 'on' : ''} aria-pressed={days.includes(k)} onClick={() => flip(k)}>{l}</button>)}
      </div>
    </Page>
  );
}
