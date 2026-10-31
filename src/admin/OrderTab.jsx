import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createOrder } from '../db';
import { Icon, Sym, Page, Btn, Empty, fmt, dmy, hm, timeOf, phoneText, kindOf, XL_EXTRA, orderCode, useUI, errText } from './ui.jsx';
import { CustomerPicker, NewCustomer, EditCustomerForm } from './Customers.jsx';
import { DrinkHome, DrinkDetail, drinkOf } from './Drinks.jsx';

const ORDER = ['bac', 'den', 'nau'];
const METHODS = [['bank', 'Chuyển khoản', 'i-qr'], ['cash', 'Tiền mặt', 'i-cash'], ['debt', 'Ghi nợ nhé!', 'i-debt']];
const PAY_NAME = { bank: 'Chuyển khoản', cash: 'Tiền mặt', debt: 'Ghi nợ' };

// Đen: size L và XL cùng giá
const extraOf = (m) => (kindOf(m.name) === 'den' ? 0 : typeof m.upsize === 'number' ? m.upsize : XL_EXTRA);
const qtyText = (n) => String(n).padStart(2, '0');

// Chọn món như app khách: Trang chủ → Chi tiết → Giỏ hàng → Thanh toán (gán khách) → Đặt hàng thành công
const O0 = { upsize: 0, hot: 0, sweet: 0, cafe: 0 }; // sweet/cafe: 0 = 100%, 50 = 50%
const flagsOf = (kind) => ({ sweet: kind === 'nau' || kind === 'bac', cafe: kind === 'bac' });
const optText = (l) => {
  const f = flagsOf(l.kind), o = l.o;
  return [o.upsize ? 'XL' : 'L', o.hot ? 'Nóng' : 'Lạnh', f.sweet ? `${o.sweet || 100}% ngọt` : 'Không đường', ...(f.cafe ? [`${o.cafe || 100}% cafe`] : [])].join(' / ');
};
const sameLine = (a, b) => a.menuId === b.menuId && optText(a) === optText(b);
const unitOf = (l) => l.price + (l.o.upsize ? l.extra : 0);
const lineOf = (m, o = O0, qty = 1) => ({ menuId: m.id, name: m.name, kind: kindOf(m.name), price: m.price, extra: extraOf(m), qty, o: { ...o } });
const mergeLines = (ls) => ls.reduce((acc, l) => {
  const j = acc.findIndex((x) => sameLine(x, l));
  if (j < 0) acc.push(l); else acc[j] = { ...acc[j], qty: Math.min(99, acc[j].qty + l.qty) };
  return acc;
}, []);
const SHORT = { den: 'Đen', nau: 'Nâu', bac: 'Bạc' };
const shortOf = (name) => SHORT[kindOf(name)] || name;
const THUMB = { den: '/den.webp', nau: '/nau.webp', bac: '/bac.webp' };

export default function OrderTab({ menu, users, orders, onTrack }) {
  const { toast } = useUI();
  const [customer, setCustomer] = useState(null);
  const [lines, setLines] = useState([]); // { menuId, name, kind, price, extra, qty, o }
  const [page, setPage] = useState(null); // { detail } | cart | pay | pick | newCustomer | { edit } | { done } | notif
  const [pay, setPay] = useState('debt');
  const [busy, setBusy] = useState(false);
  const [sheet, setSheet] = useState(-1); // dòng đang chỉnh trong giỏ
  const homeRef = useRef(null);

  const items = menu
    .filter((m) => m.active !== false)
    .sort((a, b) => {
      const ia = ORDER.indexOf(kindOf(a.name)), ib = ORDER.indexOf(kindOf(b.name));
      return (ia < 0 ? 9 : ia) - (ib < 0 ? 9 : ib);
    });
  const qtyOf = (id) => lines.filter((l) => l.menuId === id).reduce((n, l) => n + l.qty, 0);
  const count = lines.reduce((n, l) => n + l.qty, 0);
  const total = lines.reduce((n, l) => n + unitOf(l) * l.qty, 0);

  const addLine = (l) => setLines((ls) => mergeLines([...ls, l]));
  const setQty = (i, d) => setLines((ls) => ls.flatMap((l, k) => (k !== i ? [l] : l.qty + d > 0 ? [{ ...l, qty: Math.min(99, l.qty + d) }] : [])));
  const openCart = () => setPage('cart');

  const drinkText = (() => `${qtyText(count)} x ${[...new Set(lines.map((l) => shortOf(l.name)))].join(', ')}`)();

  const place = async () => {
    if (!customer) return toast('Chọn khách hàng cho đơn này');
    if (!lines.length || busy) return;
    setBusy(true);
    const order = {
      customerPhone: customer.phone,
      customerName: customer.name,
      items: lines.map((l) => ({
        menuId: l.menuId, name: l.name, price: unitOf(l), cost: 0, quantity: l.qty,
        sweetness: flagsOf(l.kind).sweet ? `${l.o.sweet || 100}% ngọt` : 'Không đường',
        ice: `${l.o.cafe || 100}% cafe`, caffeine: l.o.upsize ? 'Size XL' : 'Size L', temp: l.o.hot ? 'Nóng' : 'Lạnh',
        opts: { ...l.o },
      })),
      note: '',
      totalAmount: total,
      status: 'pending',
      paid: pay === 'cash',
      payMethod: pay,
    };
    if (pay === 'cash') order.paymentStatus = 'confirmed';
    try {
      const made = await createOrder(order);
      // cả 3 cách thanh toán đều sang màn Đặt hàng thành công
      setPage({ done: { id: made.id, no: made.no, drinks: drinkText, method: PAY_NAME[pay], total } });
      setLines([]); setPay('debt'); setCustomer(null); setSheet(-1);
    } catch (e) { toast(errText(e)); }
    setBusy(false);
  };

  if (page && page.done) {
    const d = page.done;
    return (
      <div className="a-page o-done">
        <div className="o-glow" aria-hidden="true" />
        <div className="o-ok" aria-hidden="true"><Icon n="check" size={56} /></div>
        <h1 className="a-title">Đặt hàng thành công</h1>
        <p className="a-sub">Mã đơn {orderCode({ no: d.no, id: d.id })}. Coong sẽ xác nhận đơn của bạn trong ít phút</p>
        <div className="a-card" style={{ gap: 0, width: '100%', marginTop: 20 }}>
          <div className="a-kv"><span>Đồ uống</span><b>{d.drinks}</b></div>
          <div className="a-kv"><span>Phương thức</span><b>{d.method}</b></div>
          <div className="a-kv tot"><span>Tổng</span><b>{fmt(d.total)}</b></div>
        </div>
        <div className="o-done-act">
          <Btn onClick={() => { setPage(null); onTrack && onTrack(d.id); }}>Theo dõi</Btn>
          <Btn kind="ghost" onClick={() => setPage(null)}>Tiếp tục đặt hàng</Btn>
        </div>
      </div>
    );
  }
  if (page === 'newCustomer') {
    return <NewCustomer users={users} onBack={() => setPage('pick')} onCreated={(u) => { setCustomer(u); setPage('pay'); }} />;
  }
  if (page && page.edit) {
    const done = (u) => { setCustomer((c) => (c && c.phone === page.edit.phone ? (u ? { ...c, ...u } : null) : c)); setPage('pick'); };
    return <EditCustomerForm customer={page.edit} onBack={() => setPage('pick')} onSaved={done} onDeleted={() => done(null)} />;
  }
  if (page === 'pick') {
    return (
      <CustomerPicker
        users={users} selected={customer} onBack={() => setPage('pay')}
        onPick={(u) => { setCustomer(u); setPage('pay'); }}
        onAdd={() => setPage('newCustomer')} onEdit={(u) => setPage({ edit: { phone: u.phone, ...users[u.phone] } })}
      />
    );
  }
  if (page === 'notif') return <Notifs orders={orders} onBack={() => setPage(null)} onOpen={(id) => { setPage(null); onTrack && onTrack(id); }} />;
  if (page === 'pay') {
    return (
      <Page
        title="Thanh toán"
        onBack={() => setPage('cart')}
        footer={(
          <div className="o-total">
            <div className="o-sum"><span>Giá chỉ</span><b className="y">{fmt(total)}</b></div>
            <Btn onClick={place} disabled={busy || !lines.length}>{busy ? 'Đang đặt...' : 'Đặt hàng'}</Btn>
          </div>
        )}
      >
        <div className="o-paywrap">
        <div className="a-card o-sum-card">
          {lines.map((l, i) => (
            <div key={i} className="o-line">
              <span className="grow">
                <b className="a-t" style={{ display: 'block' }}>{qtyText(l.qty)} x {shortOf(l.name)}</b>
                <span className="a-s">{optText(l)}</span>
              </span>
              <b className="a-t a-num">{fmt(unitOf(l) * l.qty)}</b>
            </div>
          ))}
        </div>
        <button className="a-card h o-cust" onClick={() => setPage('pick')} aria-label="Chọn khách">
          <span className="grow o-clabel">Khách hàng</span>
          <b className={`a-t ${customer ? '' : 'y'}`}>{customer ? customer.name : 'Chọn khách'}</b>
          <span className="m"><Icon n="right" size={24} /></span>
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
        </div>
      </Page>
    );
  }
  if (page === 'cart') {
    const cur = sheet >= 0 ? lines[sheet] : null;
    return (
      <div className="a-page o-cartpg">
        <button className="a-back" onClick={() => { setSheet(-1); setPage(null); }} aria-label="Đóng giỏ hàng"><Sym id="i-close" size={28} /></button>
        {lines.length === 0 ? (
          <div className="o-cempty">
            <div className="eico"><Sym id="i-bag" size={44} /></div>
            <h3>Giỏ hàng trống</h3>
          </div>
        ) : (
          <>
            <div className="a-body o-clist">
              {lines.map((l, i) => (
                <div key={i} className="o-citem">
                  <button className="o-cthumb" onClick={() => setSheet(i)} aria-label={`Sửa ${l.name}`}>{THUMB[l.kind] ? <img src={THUMB[l.kind]} alt="" draggable="false" /> : <Sym id="i-cup" size={36} />}</button>
                  <div className="o-cinfo">
                    <b className="o-cname">{shortOf(l.name)}</b>
                    <button className="o-copt" onClick={() => setSheet(i)}>{optText(l)}<Sym id="i-chev" size={14} /></button>
                    <div className="o-crow">
                      <span className="o-cqty">
                        <button className="o-cpm" onClick={() => setQty(i, -1)} aria-label={`Bớt ${l.name}`}><Sym id="i-minus" size={20} /></button>
                        <span>{l.qty}</span>
                        <button className="o-cpm" onClick={() => setQty(i, 1)} aria-label={`Thêm ${l.name}`}><Sym id="i-plus" size={20} /></button>
                      </span>
                      <span className="o-cprice a-num">{fmt(unitOf(l) * l.qty)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="a-foot">
              <div className="o-total">
                <div className="o-sum"><span>Giá chỉ</span><b className="y">{fmt(total)}</b></div>
                <Btn onClick={() => setPage('pay')}>Đặt hàng</Btn>
              </div>
            </div>
          </>
        )}
        {cur && (
          <EditSheet
            line={cur}
            onClose={() => setSheet(-1)}
            onDelete={() => { setLines((ls) => ls.filter((_, k) => k !== sheet)); setSheet(-1); }}
            onSave={(o) => { setLines((ls) => mergeLines(ls.map((l, k) => (k === sheet ? { ...l, o } : l)))); setSheet(-1); toast('Đã cập nhật món', true); }}
          />
        )}
      </div>
    );
  }

  const unread = orders.filter((o) => o.status === 'pending').length;
  const drinks = items.map(drinkOf);
  const det = page && page.detail != null ? drinks[page.detail] : null;
  return (
    <>
      <DrinkHome ref={homeRef} items={drinks} count={count} unread={unread} onCart={openCart} onBell={() => setPage('notif')} onOpen={(i) => setPage({ detail: i })} />
      {det && (
        <DrinkDetail
          key={det.m.id} item={det} index={page.detail} home={homeRef.current} count={count}
          onClose={() => setPage(null)} onCart={openCart}
          onAdd={({ o, qty }) => { addLine(lineOf(det.m, o, qty)); toast(`Đã thêm ${qtyText(qty)} ${shortOf(det.m.name)}`, true); }}
          onBuy={({ o, qty }) => { addLine(lineOf(det.m, o, qty)); setPage('pay'); }}
        />
      )}
    </>
  );
}

// Nhóm nút chọn: size, nóng/lạnh, ngọt, cafe (dùng ở Chi tiết và ở sheet sửa món)
function Opts({ kind, o, set, cls }) {
  const f = flagsOf(kind);
  const pick = (k, v) => set({ ...o, [k]: v });
  const chip = (k, v, label, content) => (
    <button key={v} className={`${cls} ${(o[k] || 0) === v ? 'on' : ''}`} onClick={() => pick(k, v)} aria-label={label} aria-pressed={(o[k] || 0) === v}>{content}</button>
  );
  return (
    <>
      <div className="op" data-k="upsize"><div>{chip('upsize', 0, 'Size L', <Sym id="i-sizeL" size={40} />)}{chip('upsize', 1, 'Size XL', <Sym id="i-sizeXL" size={40} />)}</div></div>
      <div className="op" data-k="hot"><div>{chip('hot', 0, 'Lạnh', <Sym id="i-snow" size={22} />)}{chip('hot', 1, 'Nóng', <Sym id="i-steam" size={22} />)}</div></div>
      {f.sweet && <div className="op" data-k="sweet"><label>Ngọt</label><div>{chip('sweet', 0, 'Ngọt 100%', '100')}{chip('sweet', 50, 'Ngọt 50%', '50')}</div></div>}
      {f.cafe && <div className="op" data-k="cafe"><label>Cafe</label><div>{chip('cafe', 0, 'Cafe 100%', '100')}{chip('cafe', 50, 'Cafe 50%', '50')}</div></div>}
    </>
  );
}

// Sheet sửa món trong giỏ: đổi biến thể, xoá khỏi giỏ hoặc lưu lại
function EditSheet({ line, onClose, onDelete, onSave }) {
  const [o, setO] = useState({ ...line.o });
  return (
    <div className="o-sheetbg" onClick={onClose}>
      <div className="o-sheet" role="dialog" aria-label="Chỉnh món" onClick={(e) => e.stopPropagation()}>
        <div className="o-handle" />
        <div className="o-ehead">
          <span className="o-cthumb sm">{THUMB[line.kind] ? <img src={THUMB[line.kind]} alt="" draggable="false" /> : <Sym id="i-cup" size={32} />}</span>
          <b>{shortOf(line.name)}</b>
        </div>
        <div className="o-egrid"><Opts kind={line.kind} o={o} set={setO} cls="o-echip" /></div>
        <div className="o-eacts">
          <Btn kind="danger" onClick={onDelete}>Xoá khỏi giỏ</Btn>
          <Btn onClick={() => onSave(o)}>Lưu lại</Btn>
        </div>
      </div>
    </div>
  );
}

const NT = {
  pending: ['chờ xác nhận', 'wait'],
  brewing: ['được chế', 'brew'],
  completed: ['xong', 'done'],
  cancelled: ['huỷ', 'cancel'],
};
const NTEXT = {
  pending: (c) => `Đơn ${c} đang chờ xác nhận`,
  brewing: (c) => `Đơn ${c} đang được chế`,
  completed: (c) => `Đơn ${c} đã xong`,
  cancelled: (c) => `Đơn ${c} đã huỷ`,
};
const agoText = (d) => {
  if (!d) return '';
  const m = Math.max(0, Math.round((Date.now() - d.getTime()) / 60000));
  if (m < 1) return 'Vừa xong';
  if (m < 60) return `${m} phút trước`;
  if (m < 24 * 60) return `${Math.round(m / 60)} giờ trước`;
  return `${dmy(d)}, ${hm(d)}`;
};

// Thông báo: trạng thái các đơn gần đây
function Notifs({ orders, onBack, onOpen }) {
  const list = orders.slice(0, 30);
  return (
    <Page title="Thông báo" onBack={onBack}>
      {list.map((o) => {
        const k = NT[o.status] ? o.status : 'pending';
        return (
          <button key={o.id} className={`o-nrow ${NT[k][1]} ${k === 'pending' ? 'new' : ''}`} onClick={() => onOpen(o.id)}>
            <span className="ni"><Sym id={k === 'cancelled' ? 'i-x' : 'i-cup'} size={20} /></span>
            <div><b>{NTEXT[k](orderCode(o))}</b><small>{agoText(timeOf(o))}</small></div>
          </button>
        );
      })}
      {list.length === 0 && <Empty icon="bell" title="Chưa có thông báo" text="Trạng thái đơn hàng sẽ được báo ở đây." />}
    </Page>
  );
}
