import React, { useState, useMemo, useEffect } from 'react';
import { addDoc, collection, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { updateOrder, deleteTransaction } from '../db';
import { tgToCustomer, tgDebt, APP_URL } from '../telegram';
import { Icon, Sym, Page, Btn, Seg, Chip, Empty, fmt, dayLabel, timeOf, isLive, useUI, errText, BellBtn } from './ui.jsx';
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
// Khoản thu tự tạo từ đơn: "Tên TT #1234" / "Tên TT 3 đơn" (khoản cũ dạng [Thu đơn]/[Thu nợ] đổi sang cùng dạng khi hiển thị)
const legacyTT = (t) => {
  const d = t.description || '';
  const m = d.match(/^\[Thu đơn\]\s*(.*?)\s*(#?(?:\d{4}|CG\w{4}))?$/);
  if (m) return `${m[1]} TT ${m[2] ? (m[2][0] === '#' ? m[2] : '#' + m[2]) : ''}`.trim();
  const n = d.match(/^\[Thu nợ\]\s*(.*?)(?:\s*\((\d+) đơn\))?$/);
  if (n) return n[2] ? `${n[1]} TT ${n[2]} đơn` : `${n[1]} TT`;
  return d;
};
const txName = (t) => (t.customerPhone ? legacyTT(t) : txNote(t) ? `${txCat(t)} · ${txNote(t)}` : txCat(t));
// Khoản thu nợ khách đã nằm trong đơn đã thanh toán, không cộng lần nữa vào doanh thu
const extraIncome = (t) => t.type === 'income' && !t.customerPhone;
const qtyText = (n) => String(n).padStart(2, '0');

// Tab Thống kê: số đơn, doanh thu, chi tiêu, đơn chưa thanh toán, thu chi
export default function WalletTab({ orders, txs, users, unread, onBell, focus, onOpenOrder }) {
  const [kind, setKind] = useState('day');
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(null); // unpaid | { add }
  const { toast } = useUI();
  // Chủ quán bấm thông báo "Khách hàng báo đã thanh toán": mở thẳng đơn chưa thanh toán của khách đó
  useEffect(() => { if (focus && focus.phone) setPage({ unpaid: focus.phone }); }, [focus]);

  const stats = useMemo(() => {
    const r = range(kind, new Date());
    const live = orders.filter((o) => isLive(o) && within(o, r));
    // doanh thu tính theo ngày thu tiền (đơn cũ chưa có paidAt thì theo ngày đặt)
    const paid = orders.filter((o) => isLive(o) && o.paid && within({ createdAt: o.paidAt || o.createdAt }, r)).reduce((n, o) => n + (o.totalAmount || 0), 0);
    const inc = txs.filter((t) => extraIncome(t) && within(t, r)).reduce((n, t) => n + (t.amount || 0), 0);
    const exp = txs.filter((t) => t.type === 'expense' && within(t, r)).reduce((n, t) => n + (t.amount || 0), 0);
    return { orders: live.length, revenue: paid + inc, expense: exp, profit: paid + inc - exp };
  }, [orders, txs, kind]);

  const unpaid = orders.filter((o) => isLive(o) && !o.paid);
  const list = txs.filter((t) => filter === 'all' || t.type === filter);

  if (page === 'unpaid') return <Unpaid orders={unpaid} onOpen={onOpenOrder} onBack={() => setPage(null)} />;
  if (page && page.unpaid) return <Unpaid orders={unpaid.filter((o) => o.customerPhone === page.unpaid)} only focus onOpen={onOpenOrder} onBack={() => setPage(null)} />;
  if (page && (page.add || page.edit)) return <AddTx onBack={() => setPage(null)} initial={page.add} edit={page.edit} />;

  const waitN = unpaid.filter((o) => o.paymentStatus === 'awaiting').length;
  const debt = unpaid.reduce((n, o) => n + (o.totalAmount || 0), 0);
  return (
    <>
      <div className="w-head">
        <h1 className="a-title">Ví tiền</h1>
        <span className="w-acts">
          <BellBtn n={unread} onClick={onBell} />
          <button className="w-plus" onClick={() => setPage({ add: 'expense' })} aria-label="Thêm khoản thu chi"><Icon n="plus" size={26} /></button>
        </span>
      </div>
      <div className="a-body w-body">
        <div className="w-top">
        <div className="a-card w-stats">
          <div className="a-between" style={{ alignItems: 'flex-start' }}>
            <span>
              <span className="a-s" style={{ display: 'block' }}>{stats.orders} đơn</span>
              <b className="w-rev">{fmt(stats.revenue)}</b>
            </span>
            <div className="w-per" role="tablist" aria-label="Khoảng thời gian">
              {PERIODS.map(([k, l]) => <button key={k} role="tab" aria-selected={kind === k} className={kind === k ? 'on' : ''} onClick={() => setKind(k)}>{l}</button>)}
            </div>
          </div>
          <div className="w-two">
            <span><span className="a-s" style={{ display: 'block' }}>Chi tiêu</span><b className="w-val r">{fmt(stats.expense)}</b></span>
            <span><span className="a-s" style={{ display: 'block' }}>Lợi nhuận</span><b className={`w-val ${stats.profit < 0 ? 'r' : 'g'}`}>{stats.profit < 0 ? '−' : ''}{fmt(Math.abs(stats.profit))}</b></span>
          </div>
        </div>
        {unpaid.length > 0 && <button className="a-card w-unpaid" onClick={() => setPage('unpaid')} aria-label="Xem trạng thái thanh toán">
          <span style={{ textAlign: 'left' }}>
            <span className="a-ic" style={{ gap: 8 }}><Sym id="i-hourglass" size={20} /><b className="w-rev y">{fmt(debt)}</b></span>
            <span className="a-s" style={{ display: 'block' }}>Chưa thanh toán: {unpaid.length - waitN}・Chờ xác nhận: {waitN}</span>
          </span>
          <Icon n="right" size={20} />
        </button>}
        </div>
        <Seg items={[['all', 'Tất cả'], ['income', 'Thu'], ['expense', 'Chi']]} value={filter} onChange={setFilter} />
        <div className="w-list">
        {list.map((t) => {
          const inc = t.type === 'income';
          const d = timeOf(t);
          return (
            <button key={t.id} className="w-tx" onClick={() => (t.customerPhone ? toast('Khoản thu từ đơn không sửa được') : setPage({ edit: t }))} aria-label={`${txName(t)}, bấm để sửa`}>
              <span className={`a-ibg ${inc ? 'g' : 'r'}`} style={{ color: inc ? 'var(--ok)' : 'var(--err)' }}><Icon n={inc ? 'inn' : 'out'} /></span>
              <span className="grow w-txt">
                <b className="a-t a-ell" style={{ display: 'block' }}>{txName(t)}</b>
                <span className="a-s">{d ? dayLabel(d) : ''}</span>
              </span>
              <b className={`a-t a-num ${inc ? 'g' : 'r'}`}>{inc ? '+' : '−'}{fmt(t.amount)}</b>
            </button>
          );
        })}
        </div>
        {list.length === 0 && <Empty icon="wallet" title="Chưa có khoản nào" text="Bấm Thu hoặc Chi để ghi." />}
      </div>
    </>
  );
}

function Unpaid({ orders, onBack, only, focus, onOpen }) {
  const { toast, confirm } = useUI();
  const nWait = orders.filter((o) => o.paymentStatus === 'awaiting').length;
  const [tab, setTab] = useState(nWait ? 'wait' : 'due');
  const shown = useMemo(() => orders.filter((o) => (o.paymentStatus === 'awaiting') === (tab === 'wait')), [orders, tab]);
  const groups = useMemo(() => {
    const m = {};
    shown.forEach((o) => {
      const g = (m[o.customerPhone] = m[o.customerPhone] || { phone: o.customerPhone, name: o.customerName, orders: [], total: 0 });
      g.orders.push(o);
      g.total += o.totalAmount || 0;
    });
    return Object.values(m).sort((a, b) => b.total - a.total);
  }, [shown]);
  const total = groups.reduce((n, g) => n + g.total, 0);

  const collect = async (g) => {
    if (!(await confirm({ title: `Thu đủ ${fmt(g.total)}?`, ok: 'Đã thu' }))) return;
    try {
      await Promise.all(g.orders.map((o) => updateOrder(o.id, { paid: true, paymentStatus: 'confirmed', paidAt: new Date().toISOString() })));
      await addDoc(collection(db, 'transactions'), {
        type: 'income', amount: g.total, description: `${g.name} TT ${g.orders.length} đơn`, customerPhone: g.phone, createdAt: new Date().toISOString(),
      });
      const debt = await tgDebt(g.phone);
      if (debt.n) tgToCustomer(g.phone, `📣 Coong đã nhận ${fmt(g.total)}đ · ${g.orders.length} đơn.${debt.text}`, `${APP_URL}/payment`);
      else tgToCustomer(g.phone, `📣 Coong đã nhận ${fmt(g.total)}đ · ${g.orders.length} đơn. Cảm ơn bạn rất nhiều! Tiếp tục ủng hộ Coong nhé.`, `${APP_URL}/menu`, 'Đặt hàng');
      toast(`Đã thu của ${g.name}`, true);
    } catch (e) { toast(errText(e)); }
  };

  return (
    <Page onBack={onBack}>
      <Seg items={[['wait', 'Chờ xác nhận'], ['due', 'Chưa thanh toán']]} value={tab} onChange={setTab} />
      {groups.map((g) => (
        <div key={g.phone} className="a-card w-debt">
          <b className="a-t" style={{ fontSize: 18, lineHeight: '23px' }}>{g.name}</b>
          <div className="w-drows">
            {g.orders.map((o) => {
              const d = timeOf(o);
              return (
                <button key={o.id} className="w-drow" onClick={() => onOpen && onOpen(o.id)} aria-label="Xem chi tiết đơn">
                  <span className="a-ell">{d ? `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} · ` : ''}{summary(o)}</span>
                  <b className="a-num">{fmt(o.totalAmount)}</b>
                  <Icon n="right" size={16} />
                </button>
              );
            })}
          </div>
          <div className="a-between w-dtot"><span className="a-s">{g.orders.length} đơn tổng</span><b className="y a-num" style={{ fontSize: 18, lineHeight: '23px' }}>{fmt(g.total)}</b></div>
          <button className="o-pill w-collect" onClick={() => collect(g)} aria-label={`Xác nhận thanh toán của ${g.name}`}><Sym id="i-verified" size={16} />Xác nhận thanh toán</button>
        </div>
      ))}
      {groups.length === 0 && <Empty icon="check" title={tab === 'wait' ? 'Không có đơn chờ xác nhận' : 'Không còn đơn nợ'} text="Mọi đơn đều đã thanh toán." />}
    </Page>
  );
}

function AddTx({ onBack, initial = 'expense', edit }) {
  const { toast, confirm } = useUI();
  const c0 = edit ? txCat(edit) : '';
  const [type, setType] = useState(edit ? edit.type : initial);
  const [amount, setAmount] = useState(edit ? String(edit.amount || '') : '');
  const [cat, setCat] = useState(edit && edit.type === 'expense' ? (EXPENSE_CATS.includes(c0) ? c0 : 'Khác') : EXPENSE_CATS[0]);
  const [note, setNote] = useState(edit ? txNote(edit) || (edit.type === 'expense' && !EXPENSE_CATS.includes(c0) ? c0 : '') : '');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const n = Number(amount);
    if (!(n > 0)) return toast('Nhập số tiền');
    if ((type === 'income' || cat === 'Khác') && !note.trim()) return toast('Nhập ghi chú');
    setBusy(true);
    const label = type === 'income' ? 'Khoản thu' : cat;
    const text = type === 'income' || cat === 'Khác' ? note.trim() : '';
    try {
      if (edit) {
        await updateDoc(doc(db, 'transactions', edit.id), { type, amount: n, description: `[${label}] ${text}`.trim() });
        toast('Đã lưu thay đổi', true);
      } else {
        await addDoc(collection(db, 'transactions'), {
          type, amount: n, description: `[${label}] ${text}`.trim(), createdAt: new Date().toISOString(),
        });
        toast(type === 'income' ? 'Đã ghi khoản thu' : 'Đã ghi khoản chi', true);
        // thêm mới: ở lại trang để nhập tiếp khoản khác
        setAmount(''); setNote(''); setBusy(false);
        return;
      }
      onBack();
    } catch (e) { toast(errText(e)); setBusy(false); }
  };

  const remove = async () => {
    if (!(await confirm({ title: 'Xoá khoản này?', msg: `${txName(edit)} · ${fmt(edit.amount)}`, ok: 'Xoá', danger: true }))) return;
    try { await deleteTransaction(edit.id); toast('Đã xoá khoản', true); onBack(); } catch (e) { toast(errText(e)); }
  };

  return (
    <Page
      className="w-addpg" onBack={onBack}
      footer={(
        <div className="w-foot">
          <Btn onClick={save} disabled={busy}>{busy ? 'Đang lưu...' : 'Lưu lại'}</Btn>
          {edit && <Btn kind="danger" onClick={remove} disabled={busy}>Xoá khoản</Btn>}
        </div>
      )}
    >
      <Seg items={[['expense', 'Chi'], ['income', 'Thu']]} value={type} onChange={setType} />
      <label className="a-card w-money">
        <span className="a-s" style={{ fontSize: 16 }}>Số tiền</span>
        <input
          className="a-big w-amount" inputMode="numeric" placeholder="0" aria-label="Số tiền" value={amount ? fmt(Number(amount)) : ''}
          onChange={(e) => setAmount(e.target.value.replace(/\D/g, '').slice(0, 10))}
        />
      </label>
      {type === 'expense' && (
        <div className="a-chips wrap w-chips">{EXPENSE_CATS.map((c) => <Chip key={c} on={cat === c} onClick={() => setCat(c)}>{c}</Chip>)}</div>
      )}
      {/* Chi: ô ghi chú chỉ hiện khi chọn Khác. Thu: ô Lý do */}
      {(type === 'income' || cat === 'Khác') && (
        <label className="a-card w-notecard">
          <textarea
            className="w-note" rows={2} value={note} placeholder="Nhập nội dung" aria-label="Nội dung"
            ref={(el) => { if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; } }}
            onChange={(e) => setNote(e.target.value.slice(0, 300))}
          />
        </label>
      )}
    </Page>
  );
}
