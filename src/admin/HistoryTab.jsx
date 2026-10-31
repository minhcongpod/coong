import React, { useState } from 'react';
import { updateOrder } from '../db';
import { Icon, Sym, Page, Btn, Seg, fmt, hm, dmy, timeOf, phoneText, payLabel, payState, orderCode, kindOf, STATUS, isLive, useUI, errText } from './ui.jsx';

const FILTERS = [['all', 'Tất cả'], ['paid', 'Đã thanh toán'], ['unpaid', 'Chưa thanh toán']];
const LIST_LABEL = { brewing: 'Đang chế' };

const qtyText = (n) => String(n).padStart(2, '0');
const itemNames = (o) => [...new Set((o.items || []).map((x) => x.name))].join(', ');
const itemQty = (o) => (o.items || []).reduce((n, x) => n + (x.quantity || 1), 0);
const whenText = (d) => (!d ? '' : d.toDateString() === new Date().toDateString() ? 'Hôm nay' : dmy(d));

// Tab Đơn hàng: danh sách đơn, xem chi tiết, thu tiền, nhận đơn, hoàn thành, huỷ
export default function HistoryTab({ orders, users, loading, onGoOrder }) {
  const [filter, setFilter] = useState('all');
  const [openId, setOpenId] = useState(null);

  const list = orders.filter((o) => {
    if (filter === 'paid') return o.paid;
    if (filter === 'unpaid') return isLive(o) && !o.paid;
    return true;
  });
  const open = openId ? orders.find((o) => o.id === openId) : null;

  return (
    <>
      <h1 className="a-title">Đơn hàng</h1>
      <div className="a-body">
        <Seg items={FILTERS} value={filter} onChange={setFilter} />
        {list.map((o) => {
          const st = STATUS[o.status] || STATUS.pending;
          const paid = payState(o) === 'paid';
          return (
            <button key={o.id} className="a-card" onClick={() => setOpenId(o.id)}>
              <span className="a-between">
                <b className="a-t a-ell">{qtyText(itemQty(o))} x {itemNames(o)}</b>
                <span className={`a-s ${st.cls}`} style={{ fontWeight: 700, flex: 'none' }}>{LIST_LABEL[o.status] || st.label}</span>
              </span>
              <span className="a-between">
                <span className="a-s" style={{ fontWeight: 400, color: 'var(--gray)' }}>{whenText(timeOf(o))}</span>
                <span className="a-ic" style={{ flex: 'none' }}>
                  <b className="a-t">{o.customerName}</b>
                  {isLive(o) && (paid ? <span className="g"><Sym id="i-paid" size={16} /></span> : <span className="y"><Sym id="i-due" size={16} /></span>)}
                </span>
              </span>
            </button>
          );
        })}
        {list.length === 0 && (orders.length === 0 && !loading ? (
          <div className="o-none">
            <div className="o-cups" aria-hidden="true"><img src="/bac.webp" alt="" /><img src="/den.webp" alt="" /><img src="/nau.webp" alt="" /></div>
            <h3>Chưa có đơn nào</h3>
            <p>Đơn bạn đặt sẽ hiện ở đây.</p>
            <Btn className="sm" style={{ width: 'auto' }} onClick={onGoOrder}>Làm tí thôi!</Btn>
          </div>
        ) : <p className="a-s" style={{ textAlign: 'center', padding: 24 }}>{loading ? 'Đang tải...' : 'Không có đơn phù hợp'}</p>)}
      </div>
      {open && <OrderDetail o={open} onBack={() => setOpenId(null)} users={users} />}
    </>
  );
}

function OrderDetail({ o, onBack, users }) {
  const { toast, confirm } = useUI();
  const pay = payState(o);
  const paid = pay === 'paid';
  const run = (patch) => updateOrder(o.id, patch).catch((e) => toast(errText(e)));
  const cancel = async () => {
    if (await confirm({ title: 'Huỷ đơn này?', msg: 'Bạn có thể huỷ khi quán chưa bắt đầu pha chế.', ok: 'Huỷ đơn', danger: true })) {
      await run({ status: 'cancelled' });
      onBack();
    }
  };
  const togglePaid = async () => {
    if (!paid) return run({ paid: true, paymentStatus: 'confirmed' });
    if (await confirm({ title: 'Bỏ đánh dấu đã thu?', msg: `${orderCode(o)} · ${fmt(o.totalAmount)}`, ok: 'Bỏ đánh dấu', danger: true })) run({ paid: false, paymentStatus: null });
  };

  const cancelled = o.status === 'cancelled';
  const steps = cancelled
    ? [['placed', 'Đã đặt', 'var(--yellow)'], ['cancelled', 'Đã huỷ', 'var(--err)']]
    : [['pending', 'Chờ xác nhận', 'var(--yellow)'], ['brewing', 'Đang pha chế', 'var(--info)'], ['completed', 'Hoàn thành', 'var(--ok)']];
  const cur = cancelled ? 1 : steps.findIndex(([k]) => k === o.status);
  const d = timeOf(o);
  const phone = users[o.customerPhone] ? phoneText(o.customerPhone) : o.customerPhone;

  let footer = null;
  if (o.status === 'pending') {
    footer = (
      <div style={{ display: 'flex', gap: 8 }}>
        <Btn kind="danger" className="sm" onClick={cancel}>Huỷ</Btn>
        <Btn kind="yellow" className="sm" onClick={() => run({ status: 'brewing' })}>Xác nhận</Btn>
      </div>
    );
  } else if (o.status === 'brewing') {
    footer = <Btn className="sm" onClick={() => run({ status: 'completed' })}>Hoàn thành</Btn>;
  }

  return (
    <Page
      onBack={onBack}
      footer={footer}
      head={(
        <>
          <div className="a-between" style={{ alignItems: 'flex-start' }}>
            <h1 className="a-title">{orderCode(o)}</h1>
            {!cancelled && <button className="o-pill" onClick={togglePaid} aria-label={paid ? 'Bỏ đánh dấu đã thu' : 'Đánh dấu đã thu'}>{paid ? 'Đã thu' : 'Thu tiền'}</button>}
          </div>
          <p className="a-s" style={{ marginBottom: 12 }}>{o.customerName} · {phone} · {d ? `${hm(d)} · ${dmy(d)}` : ''}</p>
        </>
      )}
    >
      <div className="a-card" style={{ padding: '12px 24px' }}>
        <div className="a-tl" style={cancelled ? { '--tl': '1' } : undefined}>
          {steps.map(([k, label, color], i) => (
            <div key={k} className={`a-st ${i <= cur ? 'on' : ''} ${i === cur ? 'cur' : ''}`} style={{ '--c': color }}><i />{label}</div>
          ))}
        </div>
      </div>
      <div className="a-card" style={{ gap: 0 }}>
        {(o.items || []).map((x, i) => {
          const kind = kindOf(x.name);
          return (
            <div key={i} className="o-item">
              <span className="o-thumb">{kind ? <img src={`/${kind}.webp`} alt="" /> : <Sym id="i-cup" size={22} />}</span>
              <span className="grow">
                <b className="a-t" style={{ display: 'block' }}>{qtyText(x.quantity || 1)} x {x.name}</b>
                <span className="a-s">{[x.caffeine && x.caffeine.replace('Size ', ''), x.sweetness, x.ice].filter(Boolean).join(' / ')}</span>
              </span>
              <b className="a-t a-num">{fmt(x.price * (x.quantity || 1))}</b>
            </div>
          );
        })}
        {o.note && <p className="a-s" style={{ paddingTop: 6 }}>Ghi chú: {o.note}</p>}
      </div>
      <div className="a-card" style={{ gap: 0 }}>
        <div className="a-kv"><span>Phương thức</span><b>{payLabel(o)}</b></div>
        <div className="a-kv">
          <span>Thanh toán</span>
          <b className={paid ? 'g' : pay === 'awaiting' ? 'y' : 'r'}>{paid ? 'Đã thanh toán' : pay === 'awaiting' ? 'Khách báo đã trả' : 'Chưa thanh toán'}</b>
        </div>
        <div className="a-kv tot"><span>Tổng</span><b>{fmt(o.totalAmount)}</b></div>
      </div>
    </Page>
  );
}
