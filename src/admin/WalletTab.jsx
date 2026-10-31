import React, { useState, useMemo } from 'react';
import { addDoc, collection } from 'firebase/firestore';
import { db } from '../firebase';
import { updateOrder, deleteTransaction } from '../db';
import { Icon, Sym, Page, Btn, Seg, Chip, Empty, fmt, dayLabel, timeOf, isLive, useUI, errText } from './ui.jsx';
import { CustomerPicker } from './Customers.jsx';
import { summary } from './HistoryTab.jsx';

const PERIODS = [['day', 'Ngày'], ['month', 'Tháng'], ['year', 'Năm']];
const EXPENSE_CATS = ['Cafe', 'Sữa tươi', 'Sữa đặc', 'Cốc', 'Nắp', 'Ống hút', 'Rút tiền', 'Khác'];

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
export default function WalletTab({ orders, txs, users }) {
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
    return { orders: live.length, revenue: paid + inc, expense: exp, profit: paid + inc - exp };
  }, [orders, txs, kind]);

  const unpaid = orders.filter((o) => isLive(o) && !o.paid);
  const list = txs.filter((t) => filter === 'all' || t.type === filter);

  const del = async (t) => {
    if (!(await confirm({ title: 'Xoá khoản này?', msg: `${txName(t)} · ${fmt(t.amount)}`, ok: 'Xoá', danger: true }))) return;
    deleteTransaction(t.id).catch((e) => toast(errText(e)));
  };

  if (page === 'unpaid') return <Unpaid orders={unpaid} onBack={() => setPage(null)} />;
  if (page && page.add) return <AddTx onBack={() => setPage(null)} initial={page.add} users={users || {}} />;

  const debt = unpaid.reduce((n, o) => n + (o.totalAmount || 0), 0);
  return (
    <>
      <div className="w-head">
        <h1 className="a-title">Ví tiền</h1>
        <button className="w-plus" onClick={() => setPage({ add: 'expense' })} aria-label="Thêm khoản thu chi"><Icon n="plus" size={24} /></button>
      </div>
      <div className="a-body">
        <div className="a-card w-stats">
          <div className="a-between" style={{ alignItems: 'flex-start' }}>
            <span>
              <span className="a-s" style={{ display: 'block' }}>{stats.orders} đơn</span>
              <b className="w-rev">{fmt(stats.revenue)}</b>
            </span>
            <label className="w-per">
              <select value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Khoảng thời gian">
                {PERIODS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
              <Icon n="down" size={16} />
            </label>
          </div>
          <div className="w-two">
            <span><span className="a-s" style={{ display: 'block' }}>Chi tiêu</span><b className="w-val r">{fmt(stats.expense)}</b></span>
            <span><span className="a-s" style={{ display: 'block' }}>Lợi nhuận</span><b className={`w-val ${stats.profit < 0 ? 'r' : 'g'}`}>{stats.profit < 0 ? '−' : ''}{fmt(Math.abs(stats.profit))}</b></span>
          </div>
        </div>
        {unpaid.length > 0 && <div className="a-card w-unpaid">
          <span>
            <span className="a-ic" style={{ gap: 8 }}><Sym id="i-hourglass" size={16} /><b className="w-rev y">{fmt(debt)}</b></span>
            <span className="a-s" style={{ display: 'block' }}>{unpaid.length} đơn chưa thanh toán</span>
          </span>
          <button className="w-view" onClick={() => setPage('unpaid')} aria-label="Xem đơn chưa thanh toán">Xem</button>
        </div>}
        <Seg items={[['all', 'Tất cả'], ['income', 'Thu'], ['expense', 'Chi']]} value={filter} onChange={setFilter} />
        {list.map((t) => {
          const inc = t.type === 'income';
          const d = timeOf(t);
          return (
            <button key={t.id} className="w-tx" onClick={() => del(t)} aria-label={`${txName(t)}, bấm để xoá`}>
              <span className={`a-ibg ${inc ? 'g' : 'r'}`} style={{ color: inc ? 'var(--ok)' : 'var(--err)' }}><Icon n={inc ? 'inn' : 'out'} /></span>
              <span className="grow w-txt">
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
        <div key={g.phone} className="a-card w-debt">
          <div className="a-between">
            <span>
              <span className="a-t" style={{ display: 'block', fontSize: 14 }}>{g.name}</span>
              <b className="y a-num" style={{ display: 'block', fontSize: 18, lineHeight: '23px' }}>{fmt(g.total)}</b>
            </span>
            <button className="o-pill" onClick={() => collect(g)} aria-label={`Đã thu tiền của ${g.name}`}><Sym id="i-verified" size={16} />Đã thu tiền</button>
          </div>
          <div className="w-rule" />
          {g.orders.map((o) => {
            const d = timeOf(o);
            return (
              <div key={o.id} className="a-between" style={{ fontSize: 14, fontWeight: 500 }}>
                <span className="a-ell" style={{ color: 'var(--mute)' }}>
                  {d ? `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} · ` : ''}{summary(o)}
                </span>
                <b className="a-num" style={{ flex: 'none' }}>{fmt(o.totalAmount)}</b>
              </div>
            );
          })}
        </div>
      ))}
      {groups.length === 0 && <Empty icon="check" title="Không còn đơn nợ" text="Mọi đơn đều đã thanh toán." />}
    </Page>
  );
}

function AddTx({ onBack, initial = 'expense', users }) {
  const { toast } = useUI();
  const [type, setType] = useState(initial);
  const [amount, setAmount] = useState('');
  const [cat, setCat] = useState(EXPENSE_CATS[0]);
  const [customer, setCustomer] = useState(null);
  const [pick, setPick] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  if (pick) {
    return <CustomerPicker users={users} selected={customer} onBack={() => setPick(false)} onPick={(u) => { setCustomer(u); setPick(false); }} />;
  }

  const save = async () => {
    const n = Number(amount);
    if (!(n > 0)) return toast('Nhập số tiền');
    setBusy(true);
    const label = type === 'income' ? (customer ? 'Thu nợ' : 'Khoản thu') : cat;
    const text = [type === 'income' && customer ? customer.name : '', type === 'income' || cat === 'Khác' ? note.trim() : ''].filter(Boolean).join(' · ');
    try {
      await addDoc(collection(db, 'transactions'), {
        type, amount: n, description: `[${label}] ${text}`.trim(), createdAt: new Date().toISOString(),
      });
      toast(type === 'income' ? 'Đã ghi khoản thu' : 'Đã ghi khoản chi', true);
      onBack();
    } catch (e) { toast(errText(e)); setBusy(false); }
  };

  return (
    <Page className="w-addpg" onBack={onBack} footer={<Btn onClick={save} disabled={busy}>{busy ? 'Đang lưu...' : 'Lưu lại'}</Btn>}>
      <Seg items={[['expense', 'Chi'], ['income', 'Thu']]} value={type} onChange={setType} />
      <label className="a-card w-money">
        <span className="a-s" style={{ fontSize: 16 }}>Số tiền</span>
        <input
          className="a-big w-amount" inputMode="numeric" placeholder="0" aria-label="Số tiền" value={amount ? fmt(Number(amount)) : ''}
          onChange={(e) => setAmount(e.target.value.replace(/\D/g, '').slice(0, 10))}
        />
      </label>
      {type === 'expense' ? (
        <div className="a-chips wrap w-chips">{EXPENSE_CATS.map((c) => <Chip key={c} on={cat === c} onClick={() => setCat(c)}>{c}</Chip>)}</div>
      ) : (
        <button className="a-card h o-cust" onClick={() => setPick(true)} aria-label="Chọn khách">
          <span className="m a-t grow">Khách hàng</span>
          {customer && <b className="a-t">{customer.name}</b>}
          <span className="m"><Icon n="right" /></span>
        </button>
      )}
      {/* Chi: ô ghi chú chỉ hiện khi chọn Khác. Thu: ô Lý do */}
      {(type === 'income' || cat === 'Khác') && (
        <label className="a-card w-notecard">
          <span>{type === 'income' ? 'Lý do' : 'Khác'}</span>
          <input className="w-note" value={note} onChange={(e) => setNote(e.target.value)} aria-label={type === 'income' ? 'Lý do' : 'Khác'} autoFocus={type === 'expense'} />
        </label>
      )}
    </Page>
  );
}
