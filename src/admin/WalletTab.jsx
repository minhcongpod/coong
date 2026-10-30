import React, { useState, useMemo } from 'react';
import { addDoc, collection } from 'firebase/firestore';
import { db } from '../firebase';
import { updateOrder, deleteTransaction } from '../db';
import { Icon, Page, Btn, Seg, Chip, Empty, Field, fmt, pad, dmy, dayLabel, timeOf, phoneText, isLive, useUI, errText } from './ui.jsx';

const PERIODS = [['day', 'Ngày'], ['month', 'Tháng'], ['year', 'Năm']];
const EXPENSE_CATS = ['Nguyên liệu', 'Mặt bằng', 'Lương', 'Khác'];
const INCOME_CATS = ['Thu khác'];

const range = (kind, a) => {
  if (kind === 'day') return [new Date(a.getFullYear(), a.getMonth(), a.getDate()), new Date(a.getFullYear(), a.getMonth(), a.getDate() + 1)];
  if (kind === 'month') return [new Date(a.getFullYear(), a.getMonth(), 1), new Date(a.getFullYear(), a.getMonth() + 1, 1)];
  return [new Date(a.getFullYear(), 0, 1), new Date(a.getFullYear() + 1, 0, 1)];
};
const shift = (kind, a, n) => {
  const d = new Date(a);
  if (kind === 'day') d.setDate(d.getDate() + n);
  else if (kind === 'month') { d.setDate(1); d.setMonth(d.getMonth() + n); } else d.setFullYear(d.getFullYear() + n);
  return d;
};
const label = (kind, a) => {
  const t = new Date();
  if (kind === 'day') return a.toDateString() === t.toDateString() ? `Hôm nay · ${dmy(a)}` : dmy(a);
  if (kind === 'month') return `Tháng ${a.getMonth() + 1}/${a.getFullYear()}`;
  return `Năm ${a.getFullYear()}`;
};
const within = (rec, [s, e]) => { const d = timeOf(rec); return d && d >= s && d < e; };
const txText = (t) => (t.description || '').replace(/^\[[^\]]*\]\s*/, '') || (t.description || '').match(/^\[([^\]]*)\]/)?.[1] || (t.type === 'income' ? 'Khoản thu' : 'Khoản chi');
const txCat = (t) => (t.description || '').match(/^\[([^\]]*)\]/)?.[1] || (t.type === 'income' ? 'Thu' : 'Chi');
// Khoản thu từ thu nợ (cũ) đã nằm trong đơn đã thanh toán, không cộng lần nữa
const extraIncome = (t) => t.type === 'income' && !t.customerPhone;

// Tab Ví: thống kê theo ngày/tháng/năm, thu chi, đơn chưa thanh toán
export default function WalletTab({ orders, txs, users }) {
  const [kind, setKind] = useState('day');
  const [anchor, setAnchor] = useState(new Date());
  const [page, setPage] = useState(null); // unpaid | add | txs

  const r = range(kind, anchor);
  const stats = useMemo(() => {
    const live = orders.filter((o) => isLive(o) && within(o, r));
    const paid = live.filter((o) => o.paid).reduce((n, o) => n + (o.totalAmount || 0), 0);
    const inc = txs.filter((t) => extraIncome(t) && within(t, r)).reduce((n, t) => n + (t.amount || 0), 0);
    const exp = txs.filter((t) => t.type === 'expense' && within(t, r)).reduce((n, t) => n + (t.amount || 0), 0);
    return { orders: live.length, revenue: paid + inc, expense: exp, profit: paid + inc - exp };
  }, [orders, txs, kind, anchor]); // eslint-disable-line react-hooks/exhaustive-deps

  const unpaid = orders.filter((o) => isLive(o) && !o.paid);
  const unpaidSum = unpaid.reduce((n, o) => n + (o.totalAmount || 0), 0);
  const isNow = within({ createdAt: new Date().toISOString() }, r);

  if (page === 'unpaid') return <Unpaid orders={unpaid} users={users} onBack={() => setPage(null)} />;
  if (page === 'txs') return <TxList txs={txs} onBack={() => setPage(null)} />;
  if (page && page.add) return <AddTx onBack={() => setPage(null)} initial={page.add} />;

  return (
    <>
      <h1 className="a-title">Ví</h1>
      <div className="a-body">
        <Seg items={PERIODS} value={kind} onChange={(k) => { setKind(k); setAnchor(new Date()); }} />
        <div className="a-between" style={{ padding: '0 0 0 4px' }}>
          <span className="a-s">{label(kind, anchor)}</span>
          <span className="a-step" style={{ gap: 8 }}>
            <button className="a-circ" onClick={() => setAnchor(shift(kind, anchor, -1))} aria-label="Kỳ trước"><Icon n="left" /></button>
            <button className="a-circ" disabled={isNow} style={{ opacity: isNow ? 0.3 : 1 }} onClick={() => setAnchor(shift(kind, anchor, 1))} aria-label="Kỳ sau"><Icon n="right" /></button>
          </span>
        </div>
        <div className="a-card" style={{ gap: 2 }}>
          <span className="a-s">Lợi nhuận</span>
          <b className="a-big" style={{ color: stats.profit < 0 ? 'var(--err)' : '#fff' }}>{stats.profit < 0 ? '−' : ''}{fmt(Math.abs(stats.profit))}</b>
          <span className="a-xs m">Doanh thu − Chi tiêu</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div className="a-card" style={{ flex: 1, gap: 0 }}><span className="a-s">Doanh thu</span><b className="a-h2 g">{fmt(stats.revenue)}</b></div>
          <div className="a-card" style={{ flex: 1, gap: 0 }}><span className="a-s">Chi tiêu</span><b className="a-h2 r">{fmt(stats.expense)}</b></div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div className="a-card" style={{ flex: 1, gap: 0 }}><span className="a-s">Số đơn</span><b className="a-h2">{stats.orders}</b></div>
          <button className="a-card" style={{ flex: 1, gap: 0 }} onClick={() => setPage('unpaid')} aria-label="Xem đơn chưa thanh toán">
            <span className="a-s">Chưa thanh toán</span>
            <b className="a-h2 y a-ic" style={{ gap: 4 }}>{unpaid.length} đơn<Icon n="right" size={20} /></b>
            {unpaid.length > 0 && <span className="a-xs m a-num">{fmt(unpaidSum)}</span>}
          </button>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Btn kind="ok" icon="inn" className="sm" onClick={() => setPage({ add: 'income' })}>Thu</Btn>
          <Btn kind="danger" icon="out" className="sm" onClick={() => setPage({ add: 'expense' })}>Chi</Btn>
        </div>
        <button className="a-card h" onClick={() => setPage('txs')}>
          <b className="a-t grow">Lịch sử thu chi</b>
          <span className="m"><Icon n="right" /></span>
        </button>
      </div>
    </>
  );
}

function Unpaid({ orders, users, onBack }) {
  const { toast, confirm } = useUI();
  const groups = useMemo(() => {
    const m = {};
    orders.forEach((o) => { (m[o.customerPhone] = m[o.customerPhone] || { phone: o.customerPhone, name: o.customerName, orders: [], total: 0 }).orders.push(o); m[o.customerPhone].total += o.totalAmount || 0; });
    return Object.values(m).sort((a, b) => b.total - a.total);
  }, [orders]);
  const total = groups.reduce((n, g) => n + g.total, 0);
  const collect = async (g) => {
    if (!(await confirm({ title: `Thu đủ ${fmt(g.total)}?`, msg: `Đánh dấu ${g.orders.length} đơn của ${g.name} là đã thanh toán.`, ok: 'Thu đủ' }))) return;
    try { await Promise.all(g.orders.map((o) => updateOrder(o.id, { paid: true, paymentStatus: 'confirmed' }))); toast(`Đã thu của ${g.name}`, true); } catch (e) { toast(errText(e)); }
  };
  return (
    <Page title="Chưa thanh toán" sub={groups.length ? `${orders.length} đơn · ${fmt(total)} · ${groups.length} khách` : undefined} onBack={onBack}>
      {groups.map((g) => (
        <div key={g.phone} className="a-card">
          <div className="a-between">
            <span>
              <b className="a-t" style={{ display: 'block' }}>{g.name}</b>
              <span className="a-s">{users[g.phone] ? phoneText(g.phone) : g.phone}</span>
              <b className="a-h2 y" style={{ display: 'block', marginTop: 2 }}>{fmt(g.total)}</b>
            </span>
            <Btn kind="yellow" className="xs" onClick={() => collect(g)}>Thu đủ nợ</Btn>
          </div>
          {g.orders.map((o) => (
            <div key={o.id} className="a-between">
              <span className="a-s a-ell">{timeOf(o) ? dayLabel(timeOf(o)) : ''} · {(o.items || []).map((x) => `${x.quantity} x ${x.name}`).join(', ')}</span>
              <b className="a-s a-num" style={{ color: '#fff', flex: 'none' }}>{fmt(o.totalAmount)}</b>
            </div>
          ))}
        </div>
      ))}
      {groups.length === 0 && <Empty icon="check" title="Không còn đơn nợ" text="Mọi đơn đều đã thanh toán." />}
    </Page>
  );
}

function AddTx({ onBack, initial = 'expense' }) {
  const { toast } = useUI();
  const [type, setType] = useState(initial);
  const [amount, setAmount] = useState('');
  const [cat, setCat] = useState(initial === 'income' ? INCOME_CATS[0] : EXPENSE_CATS[0]);
  const [note, setNote] = useState('');
  const t = new Date();
  const [date, setDate] = useState(`${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`);
  const [busy, setBusy] = useState(false);
  const cats = type === 'income' ? INCOME_CATS : EXPENSE_CATS;

  const save = async () => {
    const n = Number(amount);
    if (!(n > 0)) return toast('Nhập số tiền');
    setBusy(true);
    const when = new Date(`${date}T${pad(t.getHours())}:${pad(t.getMinutes())}:00`);
    try {
      await addDoc(collection(db, 'transactions'), {
        type, amount: n, description: `[${cat}] ${note.trim()}`.trim(), createdAt: (isNaN(when) ? t : when).toISOString(),
      });
      toast(type === 'income' ? 'Đã ghi khoản thu' : 'Đã ghi khoản chi', true);
      onBack();
    } catch (e) { toast(errText(e)); setBusy(false); }
  };

  return (
    <Page title="Thêm khoản" onBack={onBack} footer={<Btn onClick={save} disabled={busy}>{type === 'income' ? 'Lưu khoản thu' : 'Lưu khoản chi'}</Btn>}>
      <Seg items={[['income', 'Thu'], ['expense', 'Chi']]} value={type} onChange={(k) => { setType(k); setCat(k === 'income' ? INCOME_CATS[0] : EXPENSE_CATS[0]); }} />
      <label className="a-card" style={{ gap: 0 }}>
        <span className="a-s">Số tiền</span>
        <span className="a-ic" style={{ gap: 8, alignItems: 'flex-end' }}>
          <input
            className="a-big" inputMode="numeric" placeholder="0" aria-label="Số tiền" value={amount ? fmt(Number(amount)) : ''}
            onChange={(e) => setAmount(e.target.value.replace(/\D/g, '').slice(0, 10))}
            style={{ background: 'none', border: 0, outline: 0, color: '#fff', font: 'inherit', fontSize: 44, fontWeight: 500, width: '100%', minWidth: 0, padding: 0 }}
          />
          <span className="a-h2 m">đ</span>
        </span>
      </label>
      <p className="a-t" style={{ paddingLeft: 4 }}>Danh mục</p>
      <div className="a-chips">{cats.map((c) => <Chip key={c} on={cat === c} onClick={() => setCat(c)}>{c}</Chip>)}</div>
      <Field placeholder="Ghi chú (không bắt buộc)" value={note} onChange={(e) => setNote(e.target.value)} aria-label="Ghi chú" />
      <Field type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Ngày" style={{ colorScheme: 'dark' }} />
    </Page>
  );
}

function TxList({ txs, onBack }) {
  const { toast, confirm } = useUI();
  const [f, setF] = useState('all');
  const list = txs.filter((t) => f === 'all' || t.type === f);
  const del = async (t) => {
    if (!(await confirm({ title: 'Xoá khoản này?', msg: `${txCat(t)} · ${fmt(t.amount)}`, ok: 'Xoá', danger: true }))) return;
    deleteTransaction(t.id).catch((e) => toast(errText(e)));
  };
  return (
    <Page title="Thu chi" onBack={onBack}>
      <Seg items={[['all', 'Tất cả'], ['income', 'Thu'], ['expense', 'Chi']]} value={f} onChange={setF} />
      {list.map((t) => {
        const inc = t.type === 'income';
        const d = timeOf(t);
        return (
          <div key={t.id} className="a-card h">
            <span className={`a-ibg ${inc ? 'g' : 'r'}`} style={{ color: inc ? 'var(--ok)' : 'var(--err)' }}><Icon n={inc ? 'inn' : 'out'} /></span>
            <span className="grow">
              <b className="a-t a-ell" style={{ display: 'block' }}>{txCat(t)}{txText(t) !== txCat(t) ? ` · ${txText(t)}` : ''}</b>
              <span className="a-s">{d ? dayLabel(d) : ''}</span>
            </span>
            <b className={`a-t a-num ${inc ? 'g' : 'r'}`}>{inc ? '+' : '−'}{fmt(t.amount)}</b>
            <button className="m" onClick={() => del(t)} aria-label="Xoá khoản này"><Icon n="trash" size={18} /></button>
          </div>
        );
      })}
      {list.length === 0 && <Empty icon="wallet" title="Chưa có khoản nào" text="Bấm Thu hoặc Chi trong tab Ví để ghi." />}
    </Page>
  );
}
