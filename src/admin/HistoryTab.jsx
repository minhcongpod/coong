import React, { useState } from 'react';
import { updateOrder } from '../db';
import { Icon, Page, Btn, Chip, Empty, fmt, shortId, timeOf, dayLabel, phoneText, payLabel, payState, STATUS, isLive, useUI, errText } from './ui.jsx';
import { CustomerPicker } from './Customers.jsx';

const FILTERS = [['all', 'Tất cả'], ['pending', 'Chờ xác nhận'], ['brewing', 'Đang pha chế'], ['completed', 'Hoàn thành'], ['cancelled', 'Hủy'], ['unpaid', 'Chưa thanh toán']];
const DATES = [['all', 'Mọi ngày'], ['day', 'Hôm nay'], ['month', 'Tháng này'], ['year', 'Năm nay']];

const inDate = (o, kind) => {
  if (kind === 'all') return true;
  const d = timeOf(o), n = new Date();
  if (!d) return false;
  if (kind === 'day') return d.toDateString() === n.toDateString();
  if (kind === 'month') return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth();
  return d.getFullYear() === n.getFullYear();
};

const itemNames = (o) => (o.items || []).map((x) => `${String(x.quantity || 1).padStart(2, '0')} x ${x.name}`).join(', ');

function PayMark({ o }) {
  const s = payState(o);
  if (o.status === 'cancelled') return null;
  if (s === 'paid') return <span className="g"><Icon n="check" size={16} /></span>;
  if (s === 'awaiting') return <span className="y"><Icon n="hourglass" size={16} /></span>;
  return <span className="a-xs r">{payLabel(o) === 'Ghi nợ' ? 'Nợ' : 'Chưa trả'}</span>;
}

// Tab Lịch sử: giống app khách nhưng chủ quán tích đã thanh toán và chuyển trạng thái
export default function HistoryTab({ orders, users, loading }) {
  const [filter, setFilter] = useState('all');
  const [date, setDate] = useState('all');
  const [cust, setCust] = useState(null);
  const [page, setPage] = useState(null); // pick | { id }

  const list = orders.filter((o) => {
    if (cust && o.customerPhone !== cust.phone) return false;
    if (!inDate(o, date)) return false;
    if (filter === 'unpaid') return isLive(o) && !o.paid;
    return filter === 'all' || o.status === filter;
  });
  const cycleDate = () => setDate(DATES[(DATES.findIndex(([k]) => k === date) + 1) % DATES.length][0]);

  if (page === 'pick') {
    return <CustomerPicker users={users} selected={cust} title="Lọc theo khách" allLabel="Tất cả khách" onBack={() => setPage(null)} onPick={(u) => { setCust(u); setPage(null); }} />;
  }
  const open = page && page.id ? orders.find((o) => o.id === page.id) : null;

  return (
    <>
      <h1 className="a-title">Lịch sử</h1>
      <div className="a-body">
        <div className="a-chips" role="tablist">
          {FILTERS.map(([k, label]) => <Chip key={k} on={filter === k} onClick={() => setFilter(k)} role="tab" aria-selected={filter === k}>{label}</Chip>)}
        </div>
        <div className="a-chips">
          <Chip icon="calendar" tail onClick={cycleDate} aria-label="Lọc theo ngày">{DATES.find(([k]) => k === date)[1]}</Chip>
          <Chip icon="user" tail on={!!cust} onClick={() => setPage('pick')} aria-label="Lọc theo khách">{cust ? cust.name : 'Tất cả khách'}</Chip>
        </div>
        {list.map((o) => {
          const st = STATUS[o.status] || STATUS.pending;
          const d = timeOf(o);
          return (
            <button key={o.id} className="a-card" onClick={() => setPage({ id: o.id })}>
              <span className="a-between">
                <b className="a-t a-ell">{o.customerName}</b>
                <span className={`a-s ${st.cls}`} style={{ fontWeight: 700, flex: 'none' }}>{st.label}</span>
              </span>
              <span className="a-between">
                <span className="a-s a-ell">{itemNames(o)} · {d ? dayLabel(d) : ''}</span>
                <span className="a-ic" style={{ flex: 'none' }}><b className="a-t a-num">{fmt(o.totalAmount)}</b><PayMark o={o} /></span>
              </span>
            </button>
          );
        })}
        {list.length === 0 && (
          <Empty icon="list" title={loading ? 'Đang tải...' : orders.length ? 'Không có đơn phù hợp' : 'Chưa có đơn nào'} text={loading ? '' : orders.length ? 'Thử đổi bộ lọc.' : 'Đơn khách đặt sẽ hiện ở đây.'} />
        )}
      </div>
      {open && <OrderDetail o={open} onBack={() => setPage(null)} users={users} />}
    </>
  );
}

function OrderDetail({ o, onBack, users }) {
  const { toast, confirm } = useUI();
  const st = STATUS[o.status] || STATUS.pending;
  const pay = payState(o);
  const run = (patch) => updateOrder(o.id, patch).catch((e) => toast(errText(e)));
  const cancel = async () => {
    if (await confirm({ title: 'Huỷ đơn này?', msg: `Đơn #${shortId(o.id)} · ${fmt(o.totalAmount)}`, ok: 'Huỷ đơn', danger: true })) run({ status: 'cancelled' });
  };
  const steps = [['pending', 'Chờ xác nhận'], ['brewing', 'Đang pha chế'], ['completed', 'Hoàn thành']];
  const cur = steps.findIndex(([k]) => k === o.status);
  const d = timeOf(o);
  const phone = users[o.customerPhone] ? phoneText(o.customerPhone) : o.customerPhone;

  const footer = (
    <>
      {o.status !== 'cancelled' && pay !== 'paid' && (
        <Btn kind={pay === 'awaiting' ? 'yellow' : 'ghost'} icon="check" className="sm" onClick={() => run({ paid: true, paymentStatus: 'confirmed' })}>
          {pay === 'awaiting' ? 'Xác nhận đã nhận tiền' : 'Đánh dấu đã thanh toán'}
        </Btn>
      )}
      {o.status !== 'cancelled' && pay === 'paid' && (
        <Btn kind="ghost" className="sm" onClick={() => run({ paid: false, paymentStatus: null })}>Bỏ đánh dấu đã thanh toán</Btn>
      )}
      <div style={{ display: 'flex', gap: 8 }}>
        {o.status === 'pending' && <Btn className="sm" onClick={() => run({ status: 'brewing' })}>Nhận đơn · Pha chế</Btn>}
        {o.status === 'brewing' && <Btn className="sm" onClick={() => run({ status: 'completed' })}>Hoàn thành</Btn>}
        {o.status === 'completed' && <Btn kind="ghost" className="sm" onClick={() => run({ status: 'brewing' })}>Đưa về Đang pha chế</Btn>}
        {o.status === 'cancelled' && <Btn kind="ghost" className="sm" onClick={() => run({ status: 'pending' })}>Khôi phục đơn</Btn>}
        {(o.status === 'pending' || o.status === 'brewing') && <Btn kind="danger" className="sm" style={{ width: 'auto', flex: 'none' }} onClick={cancel}>Huỷ</Btn>}
      </div>
    </>
  );

  return (
    <Page title={`Đơn #${shortId(o.id)}`} sub={`${o.customerName} · ${phone} · ${d ? dayLabel(d) : ''}`} onBack={onBack} footer={footer}>
      {o.status === 'cancelled' ? (
        <div className="a-card"><b className="a-t r">Đơn đã huỷ</b></div>
      ) : (
        <div className="a-card" style={{ padding: '8px 16px' }}>
          <div className="a-tl">
            {steps.map(([k, label], i) => (
              <div key={k} className={`a-st ${i <= cur ? 'on' : ''}`} style={{ '--c': STATUS[k].color }}><i />{label}</div>
            ))}
          </div>
        </div>
      )}
      <div className="a-card">
        {(o.items || []).map((x, i) => (
          <div key={i} className="a-between" style={{ padding: '4px 0' }}>
            <span>
              <b className="a-t" style={{ display: 'block' }}>{String(x.quantity || 1).padStart(2, '0')} x {x.name}</b>
              <span className="a-s">{[x.caffeine && x.caffeine.replace('Size ', ''), x.sweetness, x.ice].filter(Boolean).join(' / ')}</span>
            </span>
            <b className="a-t a-num">{fmt(x.price * (x.quantity || 1))}</b>
          </div>
        ))}
        {o.note && <p className="a-s">Ghi chú: {o.note}</p>}
      </div>
      <div className="a-card" style={{ gap: 0 }}>
        <div className="a-kv"><span>Phương thức</span><b>{payLabel(o)}</b></div>
        <div className="a-kv">
          <span>Thanh toán</span>
          <b className={pay === 'paid' ? 'g' : pay === 'awaiting' ? 'y' : 'r'}>
            {pay === 'paid' ? 'Đã thanh toán' : pay === 'awaiting' ? 'Khách báo đã trả' : 'Chưa thanh toán'}
          </b>
        </div>
        <div className="a-kv tot"><span>Tổng</span><b>{fmt(o.totalAmount)}</b></div>
      </div>
    </Page>
  );
}
