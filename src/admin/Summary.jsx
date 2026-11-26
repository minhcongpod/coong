import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Page, Seg, fmt, timeOf, isLive } from './ui.jsx';
import './summary.css';

// Trang Tổng kết: lãi ròng có biểu đồ xu hướng, thu chi, món bán chạy, khách thân thiết, chi phí theo nhóm.
// Số chạy lên xuống, biểu đồ vẽ dần, cột mọc lên mỗi lần đổi Tuần/Tháng/Năm.

const PERIODS = [['week', 'Tuần'], ['month', 'Tháng'], ['year', 'Năm']];
const NOW_LABEL = { week: 'tuần này', month: 'tháng này', year: 'năm nay' };
const PREV_LABEL = { week: 'tuần trước', month: 'tháng trước', year: 'năm trước' };
const DOW = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
const DRINK_COLORS = ['var(--yellow)', 'var(--info)', 'var(--ok)', '#fff'];
const CATS = [['Nguyên liệu', 'var(--yellow)'], ['Cốc & ống hút', 'var(--info)'], ['Khác', '#ff2d92']];
const catOf = (t) => {
  const c = (t.description || '').match(/^\[([^\]]*)\]/)?.[1] || '';
  if (['Cafe', 'Cacao', 'Sữa'].includes(c)) return 0;
  if (['Cốc', 'Ống hút'].includes(c)) return 1;
  return 2;
};

const day = (y, m, d) => new Date(y, m, d);
const startOf = (kind, d) => {
  if (kind === 'week') return day(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7));
  if (kind === 'month') return day(d.getFullYear(), d.getMonth(), 1);
  return day(d.getFullYear(), 0, 1);
};
const shift = (kind, s, n) => (kind === 'week' ? day(s.getFullYear(), s.getMonth(), s.getDate() + 7 * n)
  : kind === 'month' ? day(s.getFullYear(), s.getMonth() + n, 1) : day(s.getFullYear() + n, 0, 1));
const buckets = (kind, s) => {
  if (kind === 'week') return DOW.map((l, i) => ({ l, s: day(s.getFullYear(), s.getMonth(), s.getDate() + i), e: day(s.getFullYear(), s.getMonth(), s.getDate() + i + 1) }));
  if (kind === 'month') {
    const n = new Date(s.getFullYear(), s.getMonth() + 1, 0).getDate();
    return Array.from({ length: n }, (_, i) => ({ l: String(i + 1), s: day(s.getFullYear(), s.getMonth(), i + 1), e: day(s.getFullYear(), s.getMonth(), i + 2) }));
  }
  return Array.from({ length: 12 }, (_, i) => ({ l: 'T' + (i + 1), s: day(s.getFullYear(), i, 1), e: day(s.getFullYear(), i + 1, 1) }));
};

// Cùng quy tắc với tab Ví tiền: khoản thu từ đơn đã nằm trong đơn; khoản đánh dấu "không tính" thì bỏ qua
const extraIncome = (t) => t.type === 'income' && !t.customerPhone && !t.excludeRevenue;
const isExpense = (t) => t.type === 'expense' && !t.excludeRevenue;
const sum = (a, f) => a.reduce((n, x) => n + (f(x) || 0), 0);
const cupsOf = (o) => sum(o.items || [], (x) => x.quantity || 1);
const calc = (orders, txs, s, e) => {
  const inR = (r) => { const d = timeOf(r); return d && d >= s && d < e; };
  const os = orders.filter((o) => isLive(o) && inR(o));
  const ex = txs.filter((t) => isExpense(t) && inR(t));
  const inc = sum(os, (o) => o.totalAmount) + sum(txs.filter((t) => extraIncome(t) && inR(t)), (t) => t.amount);
  const exp = sum(ex, (t) => t.amount);
  return { os, ex, inc, exp, net: inc - exp, cups: sum(os, cupsOf) };
};

const signed = (n) => (n < 0 ? '−' : '') + fmt(Math.abs(n));
const compact = (n) => {
  const a = Math.abs(n), s = n < 0 ? '−' : '';
  if (a >= 1e6) return s + (a / 1e6).toFixed(2).replace(/\.?0+$/, '').replace('.', ',') + 'tr';
  if (a >= 1e3) return s + Math.round(a / 1e3) + 'k';
  return s + Math.round(a);
};
const deltaOf = (cur, prev) => (prev ? Math.round(((cur - prev) / Math.abs(prev)) * 100) : null);

const reduced = () => typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Số chạy từ giá trị cũ đến giá trị mới; tăng thì nảy lên xanh, giảm thì chúi xuống đỏ
function Num({ v, f = signed, className = '', dur = 1100 }) {
  const [n, setN] = useState(0);
  const [dir, setDir] = useState({ k: 0, d: '' });
  const cur = useRef(0);
  useEffect(() => {
    const a = cur.current, b = v;
    if (a !== b && a !== 0) setDir((x) => ({ k: x.k + 1, d: b > a ? 'up' : 'down' }));
    if (reduced()) { cur.current = b; setN(b); return undefined; }
    let raf, t0;
    const step = (t) => {
      if (!t0) t0 = t;
      const p = Math.min(1, (t - t0) / dur);
      const x = a + (b - a) * (1 - Math.pow(1 - p, 4));
      cur.current = x;
      setN(x);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [v, dur]);
  return <span key={dir.k} className={`tk-num ${dir.d ? 'tk-' + dir.d : ''} ${className}`}>{f(n)}</span>;
}

const Delta = ({ pct, invert, label }) => {
  if (pct === null) return label ? <span className="tk-dl"><span className="tk-chip">Mới</span><span className="tk-mute">{label}</span></span> : null;
  const good = invert ? pct <= 0 : pct >= 0;
  return (
    <span className="tk-dl">
      <span className={`tk-chip ${good ? 'g' : 'r'}`}>{pct >= 0 ? '▲' : '▼'} <Num v={Math.abs(pct)} f={(x) => Math.round(x) + '%'} dur={900} /></span>
      {label && <span className="tk-mute">{label}</span>}
    </span>
  );
};

const smooth = (pts, lo = -Infinity, hi = Infinity) => {
  const cy = (v) => Math.min(hi, Math.max(lo, v)); // không cho đường cong vượt ra ngoài khung
  if (!pts.length) return '';
  let d = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, cy(p1[1] + (p2[1] - p0[1]) / 6)], c2 = [p2[0] - (p3[0] - p1[0]) / 6, cy(p2[1] - (p3[1] - p1[1]) / 6)];
    d += ` C ${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return d;
};

// Biểu đồ lãi ròng theo ngày/tháng: đường vàng vẽ dần, vùng dưới hiện theo, điểm cao nhất nảy ra
function Trend({ kind, series }) {
  const W = 300, H = 100, TOP = 16, BOT = 96;
  const live = series.filter((b) => !b.future); // ngày/tháng chưa tới thì không vẽ
  const vals = live.map((b) => b.v);
  const hi = Math.max(0, ...vals), lo = Math.min(0, ...vals);
  const span = hi - lo || 1;
  const y = (v) => TOP + (BOT - TOP) * (1 - (v - lo) / span);
  const step = series.length > 1 ? W / (series.length - 1) : W;
  const pts = live.map((b, i) => [i * step, y(b.v)]);
  const line = smooth(pts, TOP, BOT);
  const zero = y(0);
  const area = pts.length ? `${line} L ${pts[pts.length - 1][0]} ${zero} L 0 ${zero} Z` : '';
  const pk = vals.length ? vals.indexOf(Math.max(...vals)) : -1;
  const showPk = pk >= 0 && vals[pk] > 0;
  const label = (i) => (kind === 'month' ? (i % 7 === 0 ? series[i].l : '') : series[i].l);
  return (
    <div className="tk-trend">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="tk-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fc0" stopOpacity=".35" />
            <stop offset="1" stopColor="#fc0" stopOpacity="0" />
          </linearGradient>
          <clipPath id="tk-reveal"><rect className="tk-reveal" x="0" y="0" width={W} height={H} /></clipPath>
        </defs>
        {[TOP, (TOP + BOT) / 2, BOT].map((g) => <line key={g} x1="0" x2={W} y1={g} y2={g} className="tk-grid" />)}
        <path d={area} fill="url(#tk-area)" clipPath="url(#tk-reveal)" />
        <path d={line} className="tk-line" pathLength="1" vectorEffect="non-scaling-stroke" />
      </svg>
      {showPk && (
        <>
          <span className="tk-peak" style={{ left: `${(pts[pk][0] / W) * 100}%`, top: pts[pk][1] }} />
          <span className="tk-tip" style={{ left: `${(pts[pk][0] / W) * 100}%`, top: pts[pk][1], '--tx': `${-Math.round(Math.min(.92, Math.max(.08, pts[pk][0] / W)) * 100)}%` }}>{series[pk].l} · {fmt(vals[pk])}</span>
        </>
      )}
      <div className="tk-xl">{series.map((b, i) => (label(i) ? <span key={i} className={i === pk && showPk ? 'on' : ''} style={{ left: `${(i * step / W) * 100}%`, transform: `translateX(${i === 0 ? 0 : i === series.length - 1 ? -100 : -50}%)` }}>{label(i)}</span> : null))}</div>
    </div>
  );
}

// Thanh ngang mọc từ 0 lên, đổi kỳ thì co giãn tới giá trị mới
const Bar = ({ pct, color, delay = 0, ready }) => (
  <div className="tk-track"><div className="tk-fill" style={{ width: ready ? `${Math.max(2, pct * 100)}%` : 0, background: color, transitionDelay: `${delay}ms` }} /></div>
);

const CROWN = (
  <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true"><path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5L3 8z" fill="#fc0" /></svg>
);

export default function Summary({ orders, txs, users, onBack }) {
  const [kind, setKind] = useState('week');
  const [ready, setReady] = useState(false);
  useEffect(() => { const r = requestAnimationFrame(() => requestAnimationFrame(() => setReady(true))); return () => cancelAnimationFrame(r); }, []);

  const s = useMemo(() => {
    const now = new Date();
    const st = startOf(kind, now), en = shift(kind, st, 1), pv = shift(kind, st, -1);
    const cur = calc(orders, txs, st, en), prev = calc(orders, txs, pv, st);
    const series = buckets(kind, st).map((b) => ({ l: b.l, future: b.s > now, v: b.s > now ? 0 : calc(orders, txs, b.s, b.e).net }));
    const dm = new Map();
    cur.os.forEach((o) => (o.items || []).forEach((x) => {
      const d = dm.get(x.name) || { name: x.name, cups: 0, rev: 0 };
      d.cups += x.quantity || 1; d.rev += (x.price || 0) * (x.quantity || 1);
      dm.set(x.name, d);
    }));
    const drinks = [...dm.values()].sort((a, b) => b.cups - a.cups || b.rev - a.rev).slice(0, 4);
    const cm = new Map();
    cur.os.forEach((o) => {
      if (!o.customerPhone) return;
      const c = cm.get(o.customerPhone) || { phone: o.customerPhone, name: (users && users[o.customerPhone] && users[o.customerPhone].name) || o.customerName || 'Khách', cups: 0, paid: 0 };
      c.cups += cupsOf(o);
      if (o.paid) c.paid += o.totalAmount || 0;
      cm.set(o.customerPhone, c);
    });
    const custs = [...cm.values()].sort((a, b) => b.cups - a.cups || b.paid - a.paid).slice(0, 10);
    const cats = CATS.map(([name, color], i) => ({ name, color, v: sum(cur.ex.filter((t) => catOf(t) === i), (t) => t.amount) }));
    return { cur, prev, series, drinks, custs, cats };
  }, [orders, txs, users, kind]);

  const { cur, prev, series, drinks, custs, cats } = s;
  const maxCups = drinks[0] ? drinks[0].cups : 1;
  const podium = [custs[1], custs[0], custs[2]];
  const PCOL = ['#00c0e8', '#ffcc00', '#30d158']; // màu bục theo Figma: hạng 2, 1, 3
  const PRANK = [2, 1, 3];
  const ratio = cur.inc ? Math.round((cur.exp / cur.inc) * 100) : 0;

  return (
    <Page onBack={onBack} className="tk-page">
      <div className="w-sticky"><Seg items={PERIODS} value={kind} onChange={setKind} /></div>

      <div className="a-card tk-hero">
        <span className="tk-mute">Lãi ròng · {NOW_LABEL[kind]}</span>
        <Num v={cur.net} className={`tk-big ${cur.net < 0 ? 'r' : ''}`} />
        <Delta pct={deltaOf(cur.net, prev.net)} label={`so với ${PREV_LABEL[kind]}`} />
        <Trend key={kind} kind={kind} series={series} />
      </div>

      <div className="tk-kpis">
        {[['Tổng thu', cur.inc, prev.inc, 'var(--ok)', false], ['Tổng chi', cur.exp, prev.exp, 'var(--err)', true], ['Số cốc', cur.cups, prev.cups, 'var(--yellow)', false]].map(([l, v, p, c, inv]) => (
          <div key={l} className="a-card tk-kpi">
            <span className="tk-mute tk-lab"><i style={{ background: c }} />{l}</span>
            <Num v={v} f={l === 'Số cốc' ? (x) => fmt(x) : compact} className="tk-mid" />
            <Delta pct={deltaOf(v, p)} invert={inv} />
          </div>
        ))}
      </div>

      <div className="a-card tk-list">
        <h2 className="tk-h">Món bán chạy</h2>
        {drinks.length === 0 && <span className="tk-mute">Chưa có đơn trong {NOW_LABEL[kind]}</span>}
        {drinks.map((d, i) => (
          <div key={d.name} className="tk-drink">
            <div className="tk-row">
              <b className={`tk-rk ${i === 0 ? 'y' : ''}`}>{i + 1}</b>
              <b className="tk-name a-ell">{d.name}</b>
              <span className="tk-mute tk-cups"><Num v={d.cups} f={(x) => fmt(x)} /> cốc</span>
              <Num v={d.rev} f={(x) => fmt(x)} className="tk-money" />
            </div>
            <Bar pct={d.cups / maxCups} color={DRINK_COLORS[i]} delay={i * 90} ready={ready} />
          </div>
        ))}
      </div>

      <div className="a-card tk-cust">
        <h2 className="tk-h">Khách hàng thân thiết</h2>
        {custs.length === 0 && <span className="tk-mute">Chưa có khách trong {NOW_LABEL[kind]}</span>}
        {custs.length > 0 && (
          <div className="tk-podium" key={kind}>
            {podium.map((c, i) => (c ? (
              <div key={c.phone} className={`tk-ped p${PRANK[i]}`} style={{ '--c': PCOL[i], animationDelay: `${[120, 0, 240][i]}ms` }}>
                {PRANK[i] === 1 && <span className="tk-crown">{CROWN}</span>}
                <span className="tk-badge">{PRANK[i]}</span>
                <b className="tk-pname a-ell">{c.name}</b>
                <span className="tk-pcups"><Num v={c.cups} f={(x) => fmt(x)} /> cốc</span>
                <Num v={c.paid} f={(x) => fmt(x)} className="tk-pmoney" />
              </div>
            ) : <div key={'e' + i} className="tk-ped empty" />))}
          </div>
        )}
        {custs.slice(3).map((c, i) => (
          <div key={c.phone} className="tk-crow" style={{ animationDelay: `${300 + i * 60}ms` }}>
            <b className="tk-rk">{i + 4}</b>
            <b className="tk-name a-ell">{c.name}</b>
            <span className="tk-mute tk-cups"><Num v={c.cups} f={(x) => fmt(x)} /> cốc</span>
            <Num v={c.paid} f={(x) => fmt(x)} className="tk-money" />
          </div>
        ))}
      </div>

      <div className="a-card tk-exp">
        <h2 className="tk-h">Chi phí</h2>
        <Num v={cur.exp} f={(x) => fmt(x)} className="tk-mid2" />
        <span className="tk-mute">chiếm <Num v={ratio} f={(x) => Math.round(x) + '%'} /> doanh thu</span>
        <div className="tk-stack">
          {cats.map((c, i) => <span key={c.name} style={{ flexGrow: ready && cur.exp ? c.v : 0, background: c.color, transitionDelay: `${i * 90}ms` }} />)}
          {!cur.exp && <span className="tk-none" />}
        </div>
        {cats.map((c) => (
          <div key={c.name} className="tk-cat">
            <i style={{ background: c.color }} />
            <span className="grow">{c.name}</span>
            <Num v={c.v} f={(x) => fmt(x)} className="tk-catv" />
            <span className="tk-mute tk-pct">{cur.exp ? Math.round((c.v / cur.exp) * 100) : 0}%</span>
          </div>
        ))}
      </div>
    </Page>
  );
}
