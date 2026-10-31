import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { updateOrder } from '../db';
import { Icon, Sym, Page, Btn, Seg, fmt, hm, dmy, timeOf, phoneText, payLabel, payState, orderCode, kindOf, STATUS, isLive, useUI, errText, BellBtn } from './ui.jsx';

const FILTERS = [['all', 'Tất cả'], ['pending', 'Chờ xác nhận'], ['brewing', 'Đang chế'], ['completed', 'Hoàn thành'], ['cancelled', 'Hủy']];
const LIST_LABEL = { brewing: 'Đang chế' };
const MENU_ORDER = ['den', 'nau', 'bac'];
const SHORT = { den: 'Đen', nau: 'Nâu', bac: 'Bạc' };
// "3 Đen / 3 Nâu / 3 Bạc": mỗi loại một lần, theo thứ tự Đen, Nâu, Bạc
export const summary = (o) => {
  const by = new Map();
  (o.items || []).forEach((x) => { const k = kindOf(x.name) || x.name; by.set(k, (by.get(k) || 0) + (x.quantity || 1)); });
  const rank = (k) => { const i = MENU_ORDER.indexOf(k); return i < 0 ? 99 : i; };
  return [...by].sort((a, b) => rank(a[0]) - rank(b[0])).map(([k, n]) => `${n} ${SHORT[k] || k}`).join(' / ');
};

// nhóm theo thời gian: Hôm nay, Hôm qua, 7 ngày trước, 30 ngày trước, Cũ hơn
const groupOf = (d) => {
  if (!d) return 'Cũ hơn';
  const t = new Date(); t.setHours(0, 0, 0, 0);
  const days = Math.round((t - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 86400000);
  return days <= 0 ? 'Hôm nay' : days === 1 ? 'Hôm qua' : days <= 7 ? '7 ngày trước' : days <= 30 ? '30 ngày trước' : 'Cũ hơn';
};

const qtyText = (n) => String(n).padStart(2, '0');
const itemNames = (o) => [...new Set((o.items || []).map((x) => x.name))].join(', ');
const itemQty = (o) => (o.items || []).reduce((n, x) => n + (x.quantity || 1), 0);
const whenText = (d) => (!d ? '' : d.toDateString() === new Date().toDateString() ? 'Hôm nay' : dmy(d));

// Tab Đơn hàng: danh sách đơn, xem chi tiết, thu tiền, nhận đơn, hoàn thành, huỷ
export default function HistoryTab({ orders, users, loading, onGoOrder, track, unread, onBell }) {
  const [filter, setFilter] = useState('all');
  const [openId, setOpenId] = useState(null);
  useEffect(() => { if (track) setOpenId(track.id); }, [track]);

  const list = orders.filter((o) => filter === 'all' || o.status === filter);
  const open = openId ? orders.find((o) => o.id === openId) : null;
  const { toast, confirm } = useUI();
  const run = (o, patch) => updateOrder(o.id, patch).catch((e) => toast(errText(e)));
  const cancel = async (o) => {
    if (await confirm({ title: 'Huỷ đơn này?', ok: 'Huỷ đơn', danger: true })) run(o, { status: 'cancelled' });
  };

  // các card hiện lần lượt, như app khách (lúc mở tab và mỗi lần đổi bộ lọc)
  const listRef = useRef(null);
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const an = [...el.querySelectorAll('.h-card, .h-head')].slice(0, 12).map((r, j) => r.animate(
      [{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }],
      { duration: 360, delay: j * 30, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'backwards' },
    ));
    return () => an.forEach((x) => x.cancel());
  }, [filter, loading]);

  return (
    <>
      <div className="w-head"><h1 className="a-title">Đơn hàng</h1><BellBtn n={unread} onClick={onBell} /></div>
      <FilterBar value={filter} onChange={setFilter} />
      <div className="a-body" ref={listRef}>
        {list.map((o, i) => {
          const st = STATUS[o.status] || STATUS.pending;
          const paid = payState(o) === 'paid';
          const g = groupOf(timeOf(o));
          const head = i === 0 || g !== groupOf(timeOf(list[i - 1]));
          return (
            <React.Fragment key={o.id}>
              {head && <h2 className="h-head">{g}</h2>}
            <div className="a-card h-card" role="button" tabIndex={0} onClick={() => setOpenId(o.id)} onKeyDown={(e) => { if (e.key === 'Enter' && e.target === e.currentTarget) setOpenId(o.id); }}>
              <span className="h-info">
                <span className="a-between">
                  <b className="a-t a-ell">{summary(o)}</b>
                  <span className={`h-st ${st.cls}`}>{LIST_LABEL[o.status] || st.label}</span>
                </span>
                <span className="h-who">
                  {paid ? <span className="g"><Sym id="i-verified" size={16} /></span> : <span className="y"><Sym id="i-hourglass" size={16} /></span>}
                  <b className="a-ell">{o.customerName}</b>
                  <small>{whenText(timeOf(o))}</small>
                </span>
              </span>
              {o.status === 'pending' && (
                <span className="h-act" onClick={(e) => e.stopPropagation()}>
                  <button className="h-b w" onClick={() => run(o, { status: 'brewing' })}>Xác nhận</button>
                  <button className="h-b r" onClick={() => cancel(o)}>Hủy</button>
                </span>
              )}
              {o.status === 'brewing' && (
                <span className="h-act" onClick={(e) => e.stopPropagation()}>
                  <button className="h-b w" onClick={() => run(o, { status: 'completed' })}>Hoàn thành</button>
                </span>
              )}
            </div>
            </React.Fragment>
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

// Bộ lọc cuộn ngang; viên trắng trượt theo tab đang chọn
function FilterBar({ value, onChange }) {
  const box = useRef(null);
  const [pill, setPill] = useState(null);
  useLayoutEffect(() => {
    const c = box.current;
    if (!c) return;
    // tab Đơn hàng có thể đang ẩn lúc đầu (rộng 0): đo lại khi thanh lọc hiện ra
    const measure = () => { const b = c.querySelector('button.on'); if (b && b.offsetWidth) setPill({ w: b.offsetWidth, x: b.offsetLeft }); };
    measure();
    const b = c.querySelector('button.on');
    if (b && b.offsetWidth) c.scrollTo({ left: Math.max(0, b.offsetLeft - 24), behavior: 'smooth' });
    const ro = new ResizeObserver(measure);
    ro.observe(c);
    return () => ro.disconnect();
  }, [value]);
  return (
    <div className="h-seg" role="tablist" ref={box}>
      {pill && <i style={{ width: pill.w, transform: `translateX(${pill.x}px)` }} />}
      {FILTERS.map(([k, label]) => (
        <button key={k} className={k === value ? 'on' : ''} role="tab" aria-selected={k === value} onClick={() => onChange(k)}>{label}</button>
      ))}
    </div>
  );
}

function OrderDetail({ o, onBack, users }) {
  const { toast, confirm } = useUI();
  const pay = payState(o);
  const paid = pay === 'paid';
  const run = (patch) => updateOrder(o.id, patch).catch((e) => toast(errText(e)));
  const cancel = async () => {
    if (await confirm({ title: 'Huỷ đơn này?', ok: 'Huỷ đơn', danger: true })) {
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
    ? [['placed', 'Đã đặt'], ['cancelled', 'Đã huỷ']]
    : [['pending', 'Chờ xác nhận'], ['brewing', 'Đang pha chế'], ['completed', 'Hoàn thành']];
  const cur = cancelled ? 1 : steps.findIndex(([k]) => k === o.status);
  // một màu theo trạng thái hiện tại, giống app khách: vàng chờ, xanh dương pha chế, xanh lá hoàn thành, đỏ đã huỷ
  // màu theo trạng thái và màu vòng sáng nhấp nháy ở bước hiện tại, như app khách
  const [sc, cg] = cancelled ? ['#ff383c', 'rgba(255,56,60,.45)'] : o.status === 'pending' ? ['#fc0', 'rgba(255,204,0,.45)'] : o.status === 'brewing' ? ['#00c0e8', 'rgba(0,192,232,.45)'] : ['#34c759', 'rgba(52,199,89,.45)'];
  const d = timeOf(o);

  let footer = null;
  if (o.status === 'pending') {
    footer = (
      <div style={{ display: 'flex', gap: 8 }}>
        <Btn kind="danger" onClick={cancel}>Huỷ đơn</Btn>
        <Btn onClick={() => run({ status: 'brewing' })}>Xác nhận</Btn>
      </div>
    );
  } else if (o.status === 'brewing') {
    footer = <Btn onClick={() => run({ status: 'completed' })}>Hoàn thành</Btn>;
  }

  // thanh tiến trình chạy từ bước đầu tới bước hiện tại, như app khách
  // thanh chạy từ chấm đầu tới chấm hiện tại (đo theo vị trí chấm, cả khi đơn huỷ)
  const tlRef = useRef(null);
  const [bw, setBw] = useState(0);
  useEffect(() => {
    const el = tlRef.current;
    if (!el) return;
    const t = requestAnimationFrame(() => requestAnimationFrame(() => {
      const st = el.querySelectorAll('.a-st');
      if (st[cur]) setBw(st[cur].offsetLeft - st[0].offsetLeft);
    }));
    return () => cancelAnimationFrame(t);
  }, [cur, cancelled]);
  const count = (o.items || []).length;

  return (
    <Page
      onBack={onBack}
      footer={footer}
      head={(
        <>
          <div className="a-between" data-s>
            <h1 className="a-title">{orderCode(o)}</h1>
            {!cancelled && (
              <button className={`o-pill${paid ? ' on' : ''}`} onClick={togglePaid} aria-label={paid ? 'Bỏ đánh dấu đã thu' : 'Đánh dấu đã thu'}>
                {paid && <Sym id="i-verified" size={16} />}{paid ? 'Đã thanh toán' : 'Thu tiền'}
              </button>
            )}
          </div>
          <p className="a-s" data-s style={{ marginBottom: 12 }}>{d ? `${hm(d)} · ${dmy(d)} · ${count} món` : ''}</p>
        </>
      )}
    >
      <div className="a-card" data-s style={{ padding: '12px 24px' }}>
        <div className="a-tl" ref={tlRef} style={{ '--c': sc, '--cg': cg }}>
          <span className="bar" style={{ width: bw }} />
          {steps.map(([k, label], i) => (
            <div key={k} className={`a-st ${i <= cur ? 'on' : ''} ${i === cur && o.status !== 'completed' && !cancelled ? 'cur' : ''}`}><i />{label}</div>
          ))}
        </div>
      </div>
      <div className="a-card" data-s style={{ gap: 0 }}>
        {(o.items || []).map((x, i) => {
          const kind = kindOf(x.name);
          return (
            <div key={i} className="o-item">
              <span className="o-thumb">{kind ? <img src={`/${kind}.webp`} alt="" /> : <Sym id="i-cup" size={22} />}</span>
              <span className="grow" style={{ minWidth: 0 }}>
                <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                  <b className="a-t">{qtyText(x.quantity || 1)} x {x.name}</b>
                  <b className="a-t a-num">{fmt(x.price * (x.quantity || 1))}</b>
                </span>
                <span className="a-s" style={{ display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{[x.caffeine && x.caffeine.replace('Size ', ''), x.temp, x.sweetness, x.ice].filter(Boolean).join(' / ')}</span>
              </span>
            </div>
          );
        })}
        {o.note && <p className="a-s" style={{ paddingTop: 6 }}>Ghi chú: {o.note}</p>}
      </div>
      <div className="a-card" data-s>
        <div className="a-kv"><span>Khách hàng</span><b>{o.customerName}</b></div>
      </div>
      <div className="a-card a-kv16" data-s style={{ gap: 0 }}>
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
