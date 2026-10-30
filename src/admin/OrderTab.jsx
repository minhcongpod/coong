import React, { useState } from 'react';
import { createOrder } from '../db';
import { Icon, Page, Btn, Seg, Chip, Empty, fmt, phoneText, PAY, useUI, errText } from './ui.jsx';
import { CustomerPicker, NewCustomer } from './Customers.jsx';

const XL_EXTRA = 5000;
const HINT = {
  cash: 'Thu tiền ngay, đơn tính đã thanh toán',
  bank: 'Khách chuyển khoản, bạn xác nhận khi nhận được tiền',
  debt: 'Ghi vào danh sách chưa thanh toán của khách',
};

const unit = (l) => l.price + (l.size === 'XL' ? XL_EXTRA : 0);
const sameOpts = (a, b) => a.menuId === b.menuId && a.size === b.size && a.sweet === b.sweet && a.ice === b.ice;

// Tab Đặt hàng: chủ quán đặt đơn cho khách (gán số điện thoại)
export default function OrderTab({ menu, users }) {
  const { toast } = useUI();
  const [customer, setCustomer] = useState(null);
  const [lines, setLines] = useState([]); // { menuId, name, price, qty, size, sweet, ice }
  const [page, setPage] = useState(null); // pick | new | confirm
  const [pay, setPay] = useState('cash');
  const [busy, setBusy] = useState(false);

  const items = menu.filter((m) => m.active !== false);
  const qtyOf = (id) => lines.filter((l) => l.menuId === id).reduce((n, l) => n + l.qty, 0);
  const count = lines.reduce((n, l) => n + l.qty, 0);
  const total = lines.reduce((n, l) => n + unit(l) * l.qty, 0);

  const add = (m) => setLines((ls) => {
    const base = { menuId: m.id, name: m.name, price: m.price, size: 'L', sweet: 100, ice: 100 };
    const i = ls.findIndex((l) => sameOpts(l, base));
    return i < 0 ? [...ls, { ...base, qty: 1 }] : ls.map((l, k) => (k === i ? { ...l, qty: l.qty + 1 } : l));
  });
  const sub = (m) => setLines((ls) => {
    const i = ls.map((l) => l.menuId).lastIndexOf(m.id);
    if (i < 0) return ls;
    return ls.flatMap((l, k) => (k !== i ? [l] : l.qty > 1 ? [{ ...l, qty: l.qty - 1 }] : []));
  });
  const setOpt = (i, patch) => setLines((ls) => {
    const next = ls.map((l, k) => (k === i ? { ...l, ...patch } : l));
    // gộp dòng trùng tuỳ chọn
    return next.reduce((acc, l) => {
      const j = acc.findIndex((x) => sameOpts(x, l));
      if (j < 0) acc.push(l); else acc[j] = { ...acc[j], qty: acc[j].qty + l.qty };
      return acc;
    }, []);
  });

  const place = async () => {
    if (!customer || !lines.length || busy) return;
    setBusy(true);
    const order = {
      customerPhone: customer.phone,
      customerName: customer.name,
      items: lines.map((l) => ({
        menuId: l.menuId, name: l.name, price: unit(l), cost: 0, quantity: l.qty,
        sweetness: `${l.sweet} ngọt`, ice: `${l.ice} đá`, caffeine: l.size === 'XL' ? 'Size XL' : 'Size L',
        opts: { upsize: l.size === 'XL' ? 1 : 0, sweet: l.sweet === 50 ? 50 : 0, cafe: l.ice === 50 ? 50 : 0 },
      })),
      note: '',
      totalAmount: total,
      status: 'pending',
      paid: pay === 'cash',
      payMethod: pay,
    };
    if (pay === 'cash') order.paymentStatus = 'confirmed';
    try {
      await createOrder(order);
      toast(`Đã đặt đơn cho ${customer.name}`, true);
      setLines([]); setPage(null); setPay('cash');
    } catch (e) { toast(errText(e)); }
    setBusy(false);
  };

  if (page === 'pick') {
    return <CustomerPicker users={users} selected={customer} onBack={() => setPage(null)} onNew={() => setPage('new')} onPick={(u) => { setCustomer(u); setPage(null); }} />;
  }
  if (page === 'new') {
    return <NewCustomer users={users} onBack={() => setPage('pick')} onCreated={(u) => { setCustomer(u); setPage(null); }} />;
  }

  return (
    <>
      <h1 className="a-title">Đặt hàng</h1>
      <p className="a-sub">Đặt giúp khách cùng công ty</p>
      <div className="a-body">
        <button className="a-card h" onClick={() => setPage('pick')} aria-label="Chọn khách">
          <span className="grow">
            <span className="a-xs m" style={{ display: 'block' }}>Khách hàng</span>
            <b className={`a-t a-ell ${customer ? '' : 'y'}`} style={{ display: 'block' }}>{customer ? `${customer.name} · ${phoneText(customer.phone)}` : 'Chọn khách'}</b>
          </span>
          <span className="m"><Icon n="right" /></span>
        </button>
        {items.map((m) => {
          const q = qtyOf(m.id);
          return (
            <div key={m.id} className="a-card h">
              <span className="grow">
                <b className="a-t" style={{ display: 'block' }}>{m.name}</b>
                <span className="a-s a-num">{fmt(m.price)}</span>
              </span>
              <span className="a-step">
                {q > 0 && <button className="a-circ" onClick={() => sub(m)} aria-label={`Bớt ${m.name}`}><Icon n="minus" /></button>}
                {q > 0 && <span className="a-num">{q}</span>}
                <button className="a-circ w" onClick={() => add(m)} aria-label={`Thêm ${m.name}`}><Icon n="plus" /></button>
              </span>
            </div>
          );
        })}
        {items.length === 0 && <Empty icon="coffee" title="Chưa có món" text="Thêm món trong Cài đặt › Quản lý menu." />}
      </div>
      <div className="a-foot">
        <Btn disabled={!count} onClick={() => (customer ? setPage('confirm') : setPage('pick'))}>
          {!count ? 'Chọn món để đặt' : customer ? `Xem giỏ · ${fmt(total)}` : 'Chọn khách để tiếp tục'}
        </Btn>
      </div>

      {page === 'confirm' && (
        <Page
          title="Xác nhận đơn"
          sub={`${customer.name} · ${phoneText(customer.phone)}`}
          onBack={() => setPage(null)}
          footer={<Btn onClick={place} disabled={busy}>{busy ? 'Đang đặt...' : `Đặt đơn · ${fmt(total)}`}</Btn>}
        >
          <div className="a-card">
            {lines.map((l, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '4px 0' }}>
                <div className="a-between">
                  <b className="a-t">{l.qty} x {l.name}</b>
                  <b className="a-t a-num">{fmt(unit(l) * l.qty)}</b>
                </div>
                <div className="a-chips wrap">
                  {[['L', 'Size L'], ['XL', 'Size XL']].map(([v, label]) => <Chip key={v} on={l.size === v} onClick={() => setOpt(i, { size: v })} aria-label={label}>{v}</Chip>)}
                  {[50, 100].map((v) => <Chip key={`s${v}`} on={l.sweet === v} onClick={() => setOpt(i, { sweet: v })} aria-label={`${v} ngọt`}>{v} ngọt</Chip>)}
                  {[50, 100].map((v) => <Chip key={`i${v}`} on={l.ice === v} onClick={() => setOpt(i, { ice: v })} aria-label={`${v} đá`}>{v} đá</Chip>)}
                </div>
              </div>
            ))}
          </div>
          <p className="a-t" style={{ paddingLeft: 4, marginTop: 8 }}>Thanh toán</p>
          <Seg items={Object.entries(PAY)} value={pay} onChange={setPay} />
          <p className="a-hint" style={{ paddingLeft: 4 }}>{HINT[pay]}</p>
          <div className="a-between" style={{ padding: '8px 4px' }}>
            <span className="m a-t" style={{ fontWeight: 500 }}>Tổng</span>
            <b className="a-h2">{fmt(total)}</b>
          </div>
        </Page>
      )}
    </>
  );
}
