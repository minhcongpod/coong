import React, { useState, useMemo } from 'react';
import { addDoc, collection } from 'firebase/firestore';
import { db } from '../firebase';
import { updateOrder, deleteTransaction } from '../db';
import { Icon, Page, Btn, Seg, Chip, Empty, fmt, dayLabel, timeOf, isLive, useUI, errText } from './ui.jsx';

const PERIODS = [['day', 'Ngày'], ['month', 'Tháng'], ['year', 'Năm']];
const EXPENSE_CATS = ['Cafe', 'Sữa', 'Bao bì', 'Khác'];
const INCOME_CATS = ['Tiền mặt', 'Chuyển khoản', 'Khác'];

const range = (kind, a) => {
  if (kind === 'day') return [new Date(a.getFullYear(), a.getMonth(), a.getDate()), new Date(a.getFullYear(), a.getMonth(), a.getDate() + 1)];
  if (kind === 'month') return [new Date(a.getFullYear(), a.getMonth(), 1), new Date(a.getFullYear(), a.getMonth() + 1, 1)];
  return [new Date(a.getFullYear(), 0, 1), new Date(a.getFullYear() + 1, 0, 1)];
};
const within = (rec, [s, e]) => { const d = timeOf(rec); return d && d >= s && d < e; };
const txCat = (t) => (t.description || '').match(/^\[([^\]]*)\]/)?.[1] || (t.type === 'income' ? 'Khoản thu' : 'Khoản chi');
const txNote = (t) => (t.description || '').replace(/^\[[^\]]*\]\s*/, '');
const txName = (t) => (txNote(t) ? `${txCat(t)} · ${txNote(t)}` : txCat(t));
// Khoản thu nợ khách đã nằm trong đơn đã thanh toán, không cộng lần nữa vào doanh thu
const extraIncome = (t) => t.type === 'income' && !t.customerPhone;
const qtyText = (n) => String(n).padStart(2, '0');

// Tab Thống kê: số đơn, doanh thu, chi tiêu, đơn chưa thanh toán, thu chi
export default function WalletTab({ orders, txs }) {
  const [kind, setKind] = useState('day');
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(null); // unpaid | { add }
  const { toast, confirm } = useUI();

  const stats = useMemo(() => {
    const r = range(kind, new Date());
    const live = orders.filter((o) => isLive(o) && within(o, r));
    const paid = live.filter((o) => o.paid).reduce((n, o) => n + (o.totalAmount || 0), 0);
    const inc = txs.filter((t) => extraIncome(t) && within(t, r)).reduce((n, t) => n + (t.amount || 0), 0);
    const exp = txs.filter((t) => t.type === 'expense' && within(t, r)).reduce((n, t) => n + (t.amount || 0), 0);
    return { orders: live.length, revenue: paid + inc, expense: exp };
  }, [orders, txs, kind]);

  const unpaid = orders.filter((o) => isLive(o) && !o.paid);
  const list = txs.filter((t) => filter === 'all' || t.type === filter);

  const del = async (t) => {
    if (!(await confirm({ title: 'Xoá khoản này?', msg: `${txName(t)} · ${fmt(t.amount)}`, ok: 'Xoá', danger: true }))) return;
    deleteTransaction(t.id).catch((e) => toast(errText(e)));
  };

  if (page === 'unpaid') return <Unpaid orders={unpaid} onBack={() => setPage(null)} />;
  if (page && page.add) return <AddTx onBack={() => setPage(null)} initial={page.add} />;

  return (
    <>
      <h1 className="a-title">Thống kê</h1>
      <div className="a-body">
        <Seg items={PERIODS} value={kind} onChange={setKind} />
        <div className="w-grid">
          <div className="a-card w-stat"><span className="a-s">Số đơn</span><b className="a-h2">{stats.orders}</b></div>
          <div className="a-card w-stat"><span className="a-s">Doanh thu</span><b className="a-h2 g">{fmt(stats.revenue)}</b></div>
          <button className="a-card w-stat" onClick={() => setPage('unpaid')} aria-label="Xem đơn chưa thanh toán">
            <span className="a-s">Chưa thanh toán</span>
            <b className="a-h2 y a-ic" style={{ gap: 4 }}>{unpaid.length} đơn<Icon n="right" size={20} /></b>
          </button>
          <div className="a-card w-stat"><span className="a-s">Chi tiêu</span><b className="a-h2 r">{fmt(stats.expense)}</b></div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Btn kind="ok" icon="inn" className="sm" onClick={() => setPage({ add: 'income' })}>Thu</Btn>
          <Btn kind="danger" icon="out" className="sm" onClick={() => setPage({ add: 'expense' })}>Chi</Btn>
        </div>
        <Seg items={[['all', 'Tất cả'], ['income', 'Thu'], ['expense', 'Chi']]} value={filter} onChange={setFilter} />
        {list.map((t) => {
          const inc = t.type === 'income';
          const d = timeOf(t);
          return (
            <button key={t.id} className="w-tx" onClick={() => del(t)} aria-label={`${txName(t)}, bấm để xoá`}>
              <span className={`a-ibg ${inc ? 'g' : 'r'}`} style={{ color: inc ? 'var(--ok)' : 'var(--err)' }}><Icon n={inc ? 'inn' : 'out'} /></span>
              <span className="grow">
                <b className="a-t a-ell" style={{ display: 'block' }}>{txName(t)}</b>
                <span className="a-s">{d ? dayLabel(d) : ''}</span>
              </span>
              <b className={`a-t a-num ${inc ? 'g' : 'r'}`}>{inc ? '+' : '−'}{fmt(t.amount)}</b>
            </button>
          );
        })}
        {list.length === 0 && <Empty icon="wallet" title="Chưa có khoản nào" text="Bấm Thu hoặc Chi để ghi." />}
      </div>
    </>
  );
}

function Unpaid({ orders, onBack }) {
  const { toast, confirm } = useUI();
  const groups = useMemo(() => {
    const m = {};
    orders.forEach((o) => {
      const g = (m[o.customerPhone] = m[o.customerPhone] || { phone: o.customerPhone, name: o.customerName, orders: [], total: 0 });
      g.orders.push(o);
      g.total += o.totalAmount || 0;
    });
    return Object.values(m).sort((a, b) => b.total - a.total);
  }, [orders]);
  const total = groups.reduce((n, g) => n + g.total, 0);

  const collect = async (g) => {
    if (!(await confirm({ title: `Thu đủ ${fmt(g.total)}?`, msg: `Đánh dấu ${g.orders.length} đơn của ${g.name} là đã thanh toán.`, ok: 'Đã thu' }))) return;
    try {
      await Promise.all(g.orders.map((o) => updateOrder(o.id, { paid: true, paymentStatus: 'confirmed' })));
      await addDoc(collection(db, 'transactions'), {
        type: 'income', amount: g.total, description: `[Thu nợ] ${g.name}`, customerPhone: g.phone, createdAt: new Date().toISOString(),
      });
      toast(`Đã thu của ${g.name}`, true);
    } catch (e) { toast(errText(e)); }
  };

  return (
    <Page title="Chưa thanh toán" sub={groups.length ? `${orders.length} đơn · ${fmt(total)} · ${groups.length} khách` : undefined} onBack={onBack}>
      {groups.map((g) => (
        <div key={g.phone} className="a-card">
          <div className="a-between">
            <span>
              <b className="a-t" style={{ display: 'block' }}>{g.name}</b>
              <b className="a-h2 y" style={{ display: 'block' }}>{fmt(g.total)}</b>
            </span>
            <button className="o-pill" onClick={() => collect(g)} aria-label={`Đã thu của ${g.name}`}>Đã thu</button>
          </div>
          {g.orders.map((o) => {
            const d = timeOf(o);
            return (
              <div key={o.id} className="a-between">
                <span className="a-s a-ell">
                  {qtyText((o.items || []).reduce((n, x) => n + (x.quantity || 1), 0))} x {[...new Set((o.items || []).map((x) => x.name))].join(', ')}{d ? ` · ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}` : ''}
                </span>
                <b className="a-s a-num" style={{ color: '#fff', flex: 'none' }}>{fmt(o.totalAmount)}</b>
              </div>
            );
          })}
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
  const [busy, setBusy] = useState(false);
  const cats = type === 'income' ? INCOME_CATS : EXPENSE_CATS;

  const save = async () => {
    const n = Number(amount);
    if (!(n > 0)) return toast('Nhập số tiền');
    setBusy(true);
    try {
      await addDoc(collection(db, 'transactions'), {
        type, amount: n, description: `[${cat}] ${note.trim()}`.trim(), createdAt: new Date().toISOString(),
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
            className="a-big w-amount" inputMode="numeric" placeholder="0" aria-label="Số tiền" value={amount ? fmt(Number(amount)) : ''}
            onChange={(e) => setAmount(e.target.value.replace(/\D/g, '').slice(0, 10))}
          />
          <span className="a-h2 m" style={{ paddingBottom: 6 }}>đ</span>
        </span>
      </label>
      <div className="a-chips">{cats.map((c) => <Chip key={c} on={cat === c} onClick={() => setCat(c)}>{c}</Chip>)}</div>
      <label className="a-card" style={{ gap: 0 }}>
        <span className="a-s">Ghi chú</span>
        <input className="w-note" value={note} onChange={(e) => setNote(e.target.value)} aria-label="Ghi chú" placeholder="Không bắt buộc" />
      </label>
    </Page>
  );
}
