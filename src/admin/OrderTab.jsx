import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createOrder } from '../db';
import { Icon, Sym, Page, Btn, Chip, Empty, fmt, dmy, timeOf, phoneText, kindOf, XL_EXTRA, useUI, errText } from './ui.jsx';
import { CustomerPicker } from './Customers.jsx';

const ORDER = ['bac', 'den', 'nau'];
const METHODS = [['debt', 'Ghi nợ nhé!', 'i-debt'], ['bank', 'Chuyển khoản', 'i-qr'], ['cash', 'Tiền mặt', 'i-cash']];

const extraOf = (m) => (typeof m.upsize === 'number' ? m.upsize : XL_EXTRA);
const sameOpts = (a, b) => a.menuId === b.menuId && a.size === b.size && a.sweet === b.sweet && a.ice === b.ice;
const qtyText = (n) => String(n).padStart(2, '0');

// Tab Đặt hàng: chọn món như app khách, rồi gán khách ở bước Thanh toán
export default function OrderTab({ menu, users, orders }) {
  const { toast } = useUI();
  const [customer, setCustomer] = useState(null);
  const [lines, setLines] = useState([]); // { menuId, name, price, extra, qty, size, sweet, ice }
  const [page, setPage] = useState(null); // pay | pick
  const [pay, setPay] = useState('debt');
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(-1); // dòng đang mở tuỳ chọn

  const items = menu
    .filter((m) => m.active !== false)
    .sort((a, b) => {
      const ia = ORDER.indexOf(kindOf(a.name)), ib = ORDER.indexOf(kindOf(b.name));
      return (ia < 0 ? 9 : ia) - (ib < 0 ? 9 : ib);
    });
  const qtyOf = (id) => lines.filter((l) => l.menuId === id).reduce((n, l) => n + l.qty, 0);
  const count = lines.reduce((n, l) => n + l.qty, 0);
  const unit = (l) => l.price + (l.size === 'XL' ? l.extra : 0);
  const total = lines.reduce((n, l) => n + unit(l) * l.qty, 0);
  const last = orders[0];

  const add = (m) => setLines((ls) => {
    const base = { menuId: m.id, name: m.name, price: m.price, extra: extraOf(m), size: 'L', sweet: 100, ice: 100 };
    const i = ls.findIndex((l) => sameOpts(l, base));
    return i < 0 ? [...ls, { ...base, qty: 1 }] : ls.map((l, k) => (k === i ? { ...l, qty: l.qty + 1 } : l));
  });
  const setQty = (i, d) => setLines((ls) => ls.flatMap((l, k) => (k !== i ? [l] : l.qty + d > 0 ? [{ ...l, qty: l.qty + d }] : [])));
  const setOpt = (i, patch) => setLines((ls) => {
    const next = ls.map((l, k) => (k === i ? { ...l, ...patch } : l));
    return next.reduce((acc, l) => {
      const j = acc.findIndex((x) => sameOpts(x, l));
      if (j < 0) acc.push(l); else acc[j] = { ...acc[j], qty: acc[j].qty + l.qty };
      return acc;
    }, []);
  });

  const reorder = () => {
    if (!last) return;
    const next = (last.items || []).map((x) => {
      const m = menu.find((d) => d.id === x.menuId) || menu.find((d) => d.name === x.name);
      if (!m) return null;
      const xl = /XL/i.test(x.caffeine || '');
      return {
        menuId: m.id, name: m.name, price: m.price, extra: extraOf(m), qty: x.quantity || 1, size: xl ? 'XL' : 'L',
        sweet: /^50/.test(x.sweetness || '') ? 50 : 100, ice: /^50/.test(x.ice || '') ? 50 : 100,
      };
    }).filter(Boolean);
    if (!next.length) return toast('Món của đơn này không còn trong menu');
    setLines(next);
    setCustomer(users[last.customerPhone] ? { phone: last.customerPhone, ...users[last.customerPhone] } : null);
    setOpen(-1);
    setPage('pay');
  };

  const goPay = () => (count ? (setOpen(-1), setPage('pay')) : toast('Chọn món trước nhé'));

  const place = async () => {
    if (!customer) return toast('Chọn khách hàng cho đơn này');
    if (!lines.length || busy) return;
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
      setLines([]); setPage(null); setPay('debt'); setCustomer(null);
    } catch (e) { toast(errText(e)); }
    setBusy(false);
  };

  if (page === 'pick') {
    return <CustomerPicker users={users} selected={customer} onBack={() => setPage('pay')} onPick={(u) => { setCustomer(u); setPage('pay'); }} />;
  }

  return (
    <>
      <div className="o-head">
        <div>
          <p className="o-hi">Hê lô,</p>
          <p className="o-brand">Coong</p>
        </div>
        <button className="o-bag" onClick={goPay} aria-label="Giỏ hàng"><Sym id="i-bag" size={28} />{count > 0 && <span className="a-badge">{count}</span>}</button>
      </div>
      {last && (
        <button className="a-card h o-again" onClick={reorder} aria-label="Đặt lại đơn gần nhất">
          <span className="grow">
            <b className="a-t a-ell" style={{ display: 'block' }}>
              {qtyText((last.items || []).reduce((n, x) => n + (x.quantity || 1), 0))} x {[...new Set((last.items || []).map((x) => x.name))].join(', ')}
            </b>
            <span className="a-s">{timeOf(last) ? dmy(timeOf(last)) : ''}</span>
          </span>
          <b className="y a-t">ĐẶT LẠI</b>
        </button>
      )}
      <Carousel items={items} qtyOf={qtyOf} onAdd={add} />

      {page === 'pay' && (
        <Page
          title="Thanh toán"
          onBack={() => setPage(null)}
          footer={(
            <div className="o-total">
              <div className="o-sum"><span>Giá chỉ</span><b className="y">{fmt(total)}</b></div>
              <Btn onClick={place} disabled={busy || !lines.length}>{busy ? 'Đang đặt...' : 'Đặt hàng'}</Btn>
            </div>
          )}
        >
          <div className="a-card" style={{ gap: 0, padding: '10px 24px' }}>
            {lines.map((l, i) => (
              <div key={i}>
                <button className="o-line" onClick={() => setOpen(open === i ? -1 : i)} aria-expanded={open === i} aria-label={`Sửa ${l.name}`}>
                  <span className="grow">
                    <b className="a-t" style={{ display: 'block' }}>{qtyText(l.qty)} x {l.name}</b>
                    <span className="a-s">{l.size} / {l.sweet} ngọt / {l.ice} đá</span>
                  </span>
                  <b className="a-t a-num">{fmt(unit(l) * l.qty)}</b>
                </button>
                {open === i && (
                  <div className="o-opts">
                    <div className="a-chips wrap">
                      {['L', 'XL'].map((v) => <Chip key={v} on={l.size === v} onClick={() => setOpt(i, { size: v })} aria-label={`Size ${v}`}>{v}</Chip>)}
                      {[50, 100].map((v) => <Chip key={`s${v}`} on={l.sweet === v} onClick={() => setOpt(i, { sweet: v })} aria-label={`${v} ngọt`}>{v} ngọt</Chip>)}
                      {[50, 100].map((v) => <Chip key={`i${v}`} on={l.ice === v} onClick={() => setOpt(i, { ice: v })} aria-label={`${v} đá`}>{v} đá</Chip>)}
                    </div>
                    <span className="a-step">
                      <button className="a-circ" onClick={() => { setQty(i, -1); if (l.qty === 1) { setOpen(-1); if (lines.length === 1) setPage(null); } }} aria-label={`Bớt ${l.name}`}><Icon n="minus" /></button>
                      <span className="a-num">{l.qty}</span>
                      <button className="a-circ w" onClick={() => setQty(i, 1)} aria-label={`Thêm ${l.name}`}><Icon n="plus" /></button>
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
          <button className="a-card h o-cust" onClick={() => setPage('pick')} aria-label="Chọn khách">
            <span className="m a-t grow">Khách hàng</span>
            <b className={`a-t ${customer ? '' : 'y'}`}>{customer ? customer.name : 'Chọn khách'}</b>
            <span className="m"><Icon n="right" /></span>
          </button>
          <div className="o-methods" role="radiogroup">
            {METHODS.map(([k, label, sym]) => (
              <button key={k} className={`o-method ${pay === k ? 'on' : ''}`} role="radio" aria-checked={pay === k} onClick={() => setPay(k)}>
                <Sym id={sym} size={24} />
                <span className="grow">{label}</span>
                <i />
              </button>
            ))}
          </div>
          {customer && <p className="a-hint" style={{ paddingLeft: 4 }}>{phoneText(customer.phone)}</p>}
        </Page>
      )}
    </>
  );
}

function Carousel({ items, qtyOf, onAdd }) {
  const track = useRef(null);
  const cards = useRef([]);

  const update = useCallback(() => {
    const el = track.current;
    if (!el) return;
    const mid = el.scrollLeft + el.clientWidth / 2;
    cards.current.forEach((n) => {
      if (!n) return;
      const d = Math.min(1, Math.abs(mid - (n.offsetLeft + n.offsetWidth / 2)) / 220);
      n.style.transform = `scale(${(1.123 - 0.123 * d).toFixed(3)})`;
      n.style.zIndex = d < 0.5 ? 2 : 1;
    });
  }, []);

  useEffect(() => {
    const el = track.current;
    if (!el || !items.length) return;
    const n = cards.current[Math.min(1, items.length - 1)];
    if (n) el.scrollLeft = n.offsetLeft + n.offsetWidth / 2 - el.clientWidth / 2;
    update();
  }, [items.length, update]);

  if (!items.length) return <Empty icon="coffee" title="Chưa có món" text="Thêm món trong Cài đặt › Quản lý menu." />;
  return (
    <div className="o-track" ref={track} onScroll={update}>
      {items.map((m, i) => {
        const kind = kindOf(m.name);
        const q = qtyOf(m.id);
        return (
          <div key={m.id} className={`o-card ${kind || 'den'}`} ref={(n) => { cards.current[i] = n; }} role="group" aria-label={m.name}>
            <div className="surf" />
            <b className="o-name">{m.name}</b>
            {kind === 'bac' && <span className="o-rec"><Sym id="i-star" size={12} />RECOMMEND</span>}
            <span className="o-chips"><span><Sym id="i-snow" size={12} /></span><span><Sym id="i-steam" size={12} /></span></span>
            {kind ? <span className="o-cup"><img src={`/${kind}.webp`} alt="" draggable="false" /></span> : <span className="o-cup ph"><Sym id="i-cup" size={96} /></span>}
            <span className="o-price"><b className="a-num">{fmt(m.price)}</b></span>
            <button className="o-add" onClick={() => onAdd(m)} aria-label={`Thêm ${m.name}`}>
              <Sym id="i-bag" size={18} />
              {q > 0 && <span className="o-q">{q}</span>}
            </button>
          </div>
        );
      })}
    </div>
  );
}
