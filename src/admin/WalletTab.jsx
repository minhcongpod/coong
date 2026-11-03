import React, { useState, useMemo, useEffect } from 'react';
import { updateOrder, saveTx, removeTx } from '../db';
import { CustomerPicker } from './Customers.jsx';
import { tgToCustomer, tgDebt, APP_URL } from '../telegram';
import { Icon, Sym, Page, Btn, Seg, Chip, Empty, fmt, hm, timeOf, isLive, useUI, errText, BellBtn } from './ui.jsx';
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
// Hai dòng của một khoản trong lịch sử: [tiêu đề, phần thêm sau giờ]
const txLines = (t) => {
  if (t.customerPhone) {
    const m = legacyTT(t).match(/^(.*?)\s*TT\s*(.*)$/);
    const name = (m ? m[1] : legacyTT(t)) || 'Khách';
    const rest = m ? m[2].trim() : '';
    return [name, rest.startsWith('#') ? `Thanh toán đơn ${rest}` : /^\d+ đơn$/.test(rest) ? `Thanh toán ${rest}` : 'Thanh toán'];
  }
  const cat = txCat(t), note = txNote(t);
  if (t.walletPhone) { const w = t.type === 'income' ? 'Nạp ví' : 'Chuyển ví'; return [t.walletName || 'Khách', note ? `${w} · ${note}` : w]; }
  if (t.type === 'income') return [note || 'Khoản thu', ''];
  return [cat, note];
};
// Nhóm theo ngày: Hôm nay, Hôm qua, còn lại dd/m/yyyy
const groupLabel = (d) => {
  if (!d) return '';
  const day = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(new Date()) - day(d)) / 86400000);
  return diff === 0 ? 'Hôm nay' : diff === 1 ? 'Hôm qua' : `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
};
const txName = (t) => (t.customerPhone ? legacyTT(t) : txNote(t) ? `${txCat(t)} · ${txNote(t)}` : txCat(t));
// Khoản thu nợ khách đã nằm trong đơn đã thanh toán, không cộng lần nữa vào doanh thu
const extraIncome = (t) => t.type === 'income' && !t.customerPhone && !t.excludeRevenue;
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
    // doanh thu tính theo ngày đặt, gồm cả đơn khách chưa thanh toán
    const paid = live.reduce((n, o) => n + (o.totalAmount || 0), 0);
    const inc = txs.filter((t) => extraIncome(t) && within(t, r)).reduce((n, t) => n + (t.amount || 0), 0);
    const exp = txs.filter((t) => t.type === 'expense' && !t.excludeRevenue && within(t, r)).reduce((n, t) => n + (t.amount || 0), 0);
    // Ví: tổng tất cả các khoản thu trừ chi (mọi thời gian, kể cả khoản không tính vào doanh thu)
    const wallet = txs.reduce((n, t) => n + (t.type === 'income' ? 1 : -1) * (t.amount || 0), 0);
    return { orders: live.length, revenue: paid + inc, expense: exp, profit: paid + inc - exp, wallet };
  }, [orders, txs, kind]);

  const unpaid = orders.filter((o) => isLive(o) && !o.paid);
  const list = txs.filter((t) => filter === 'all' || t.type === filter);

  if (page === 'unpaid') return <Unpaid orders={unpaid} onOpen={onOpenOrder} onBack={() => setPage(null)} />;
  if (page && page.unpaid) return <Unpaid orders={unpaid.filter((o) => o.customerPhone === page.unpaid)} only focus onOpen={onOpenOrder} onBack={() => setPage(null)} />;
  if (page && (page.add || page.edit)) return <AddTx users={users} onBack={() => setPage(null)} initial={page.add} edit={page.edit} />;

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
            <span><span className="a-s" style={{ display: 'block' }}>Chi phí</span><b className="w-val r">{fmt(stats.expense)}</b></span>
            <span><span className="a-s" style={{ display: 'block' }}>Lợi nhuận</span><b className={`w-val ${stats.profit < 0 ? 'r' : 'g'}`}>{stats.profit < 0 ? '−' : ''}{fmt(Math.abs(stats.profit))}</b></span>
            <span><span className="a-s" style={{ display: 'block' }}>Ví</span><b className={`w-val ${stats.wallet < 0 ? 'r' : 'g'}`}>{stats.wallet < 0 ? '−' : ''}{fmt(Math.abs(stats.wallet))}</b></span>
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
        {list.map((t, i) => {
          const inc = t.type === 'income';
          const d = timeOf(t);
          const g = groupLabel(d);
          const head = i === 0 || g !== groupLabel(timeOf(list[i - 1]));
          const [title, extra] = txLines(t);
          const sub = [d ? hm(d) : '', extra].filter(Boolean).join(' · ');
          return (
            <React.Fragment key={t.id}>
              {head && <h2 className="h-head">{g}</h2>}
              <button className="w-tx" onClick={() => (t.customerPhone ? toast('Khoản thu từ đơn không sửa được') : setPage({ edit: t }))} aria-label={`${title}, bấm để sửa`}>
                <span className={`a-ibg ${inc ? 'g' : 'r'}`} style={{ color: inc ? 'var(--ok)' : 'var(--err)' }}><Icon n={inc ? 'inn' : 'out'} /></span>
                <span className="grow w-txt">
                  <b className="a-t a-ell" style={{ display: 'block' }}>{title}</b>
                  <span className="a-s a-ell" style={{ display: 'block' }}>{sub}</span>
                </span>
                <b className={`a-t a-num ${inc ? 'g' : 'r'}`}>{inc ? '+' : '−'}{fmt(t.amount)}</b>
              </button>
            </React.Fragment>
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

function AddTx({ users, onBack, initial = 'expense', edit }) {
  const { toast, confirm } = useUI();
  const c0 = edit ? txCat(edit) : '';
  const [type, setType] = useState(edit ? edit.type : initial);
  const [amount, setAmount] = useState(edit ? String(edit.amount || '') : '');
  const [cat, setCat] = useState(edit && edit.type === 'expense' && !edit.walletPhone ? (EXPENSE_CATS.includes(c0) ? c0 : 'Khác') : EXPENSE_CATS[0]);
  const [note, setNote] = useState(edit ? txNote(edit) || (edit.type === 'expense' && !edit.walletPhone && !EXPENSE_CATS.includes(c0) ? c0 : '') : '');
  const [skip, setSkip] = useState(edit ? !!edit.excludeRevenue : false); // không tính vào doanh thu
  const [busy, setBusy] = useState(false);
  const [cust, setCust] = useState(edit && edit.walletPhone ? edit.walletPhone : ''); // khách được nạp ví (không bắt buộc)
  const [picking, setPicking] = useState(false);
  const custName = cust ? ((users && users[cust] && users[cust].name) || (edit && edit.walletName) || cust) : '';
  const wallet = !!cust; // có chọn khách: tiền vào ví khách, không tính doanh thu

  const save = async () => {
    const n = Number(amount);
    if (!(n > 0)) return toast('Nhập số tiền');
    if (!wallet && (type === 'income' || cat === 'Khác') && !note.trim()) return toast('Nhập ghi chú');
    setBusy(true);
    const label = wallet ? (type === 'income' ? 'Nạp ví' : 'Chuyển ví') : type === 'income' ? 'Khoản thu' : cat;
    const text = type === 'income' || cat === 'Khác' || wallet ? note.trim() : '';
    const data = { type, amount: n, description: `[${label}] ${text}`.trim(), excludeRevenue: skip || wallet };
    if (wallet) { data.walletPhone = cust; data.walletName = custName; }
    try {
      if (edit) {
        await saveTx(edit.id, data);
        toast('Đã lưu thay đổi', true);
      } else {
        await saveTx(null, data);
        if (wallet) tgToCustomer(cust, `💰 Coong vừa ${type === 'income' ? 'nạp' : 'chuyển'} ${fmt(n)}đ vào ví tiền của bạn. Bạn có thể dùng để thanh toán đơn hàng nhé!`, APP_URL, 'Đặt hàng');
        toast(wallet ? `Đã ${type === 'income' ? 'nạp' : 'chuyển'} ${fmt(n)}đ vào ví ${custName}` : type === 'income' ? 'Đã ghi khoản thu' : 'Đã ghi khoản chi', true);
        // thêm mới: ở lại trang để nhập tiếp khoản khác
        setAmount(''); setNote(''); setSkip(false); setCust(''); setBusy(false);
        return;
      }
      onBack();
    } catch (e) { toast(errText(e)); setBusy(false); }
  };

  const remove = async () => {
    if (!(await confirm({ title: 'Xoá khoản này?', msg: `${txName(edit)} · ${fmt(edit.amount)}`, ok: 'Xoá', danger: true }))) return;
    try { await removeTx(edit.id); toast('Đã xoá khoản', true); onBack(); } catch (e) { toast(errText(e)); }
  };

  if (picking) return <CustomerPicker users={users} selected={cust ? { phone: cust } : null} onBack={() => setPicking(false)} onPick={(u) => { setCust(u.phone === cust ? '' : u.phone); setPicking(false); }} />;
  return (
    <Page
      className="w-addpg" onBack={onBack}
      footer={(
        <div className="w-foot" style={edit ? { flexDirection: 'row', gap: 12 } : undefined}>
          {edit && <Btn kind="danger" onClick={remove} disabled={busy}>Xoá</Btn>}
          <Btn onClick={save} disabled={busy}>{busy ? 'Đang lưu...' : 'Lưu lại'}</Btn>
        </div>
      )}
    >
      <Seg items={[['expense', 'Chi'], ['income', 'Thu']]} value={type} onChange={setType} />
      <label className="w-money">
        <span className="a-s" style={{ fontSize: 16 }}>Số tiền</span>
        <input
          className="a-big w-amount" inputMode="numeric" placeholder="0" aria-label="Số tiền" value={amount ? fmt(Number(amount)) : ''}
          onChange={(e) => setAmount(e.target.value.replace(/\D/g, '').slice(0, 10))}
        />
      </label>
      <button type="button" className="w-chk" role="checkbox" aria-checked={skip || wallet} disabled={wallet} onClick={() => setSkip(!skip)}>
        <i className={skip || wallet ? 'on' : ''}>{(skip || wallet) && <Icon n="check" size={16} />}</i>Không tính vào doanh thu
      </button>
      {type === 'expense' && !wallet && (
        <div className="a-chips wrap w-chips">{EXPENSE_CATS.map((c) => <Chip key={c} on={cat === c} onClick={() => setCat(c)}>{c}</Chip>)}</div>
      )}
      {/* Chi: ô ghi chú chỉ hiện khi chọn Khác. Thu: ô Lý do */}
      {(
        <button className="a-card h o-cust" onClick={() => setPicking(true)} aria-label="Chọn khách">
          <span className="grow o-clabel">Khách hàng</span>
          <b className={`a-t ${cust ? '' : 'y'}`}>{custName || 'Chọn khách'}</b>
          <span className="m"><Icon n="right" size={24} /></span>
        </button>
      )}
      {(type === 'income' || cat === 'Khác' || wallet) && (
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
