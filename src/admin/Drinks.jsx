import { createPortal } from 'react-dom';
import React, { useRef, useEffect, useLayoutEffect, useState, forwardRef, useImperativeHandle } from 'react';
import { Sym, fmt, kindOf, XL_EXTRA } from './ui.jsx';
import './drinks.css';

// Trang chủ (3 thẻ đồ uống) và màn chi tiết: bê nguyên từ app khách, kể cả hiệu ứng.
const RM = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const T = (ms) => (RM ? Math.min(ms, 120) : ms);
const pad = (n) => String(n).padStart(2, '0');
const EASE_MORPH = 'cubic-bezier(.32,.72,0,1)';
const GLOW = 'rgba(255,255,255,.5)';
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

export const META = {
  bac: { name: 'Bạc', sweet: true, cafe: true, aspect: 512 / 901, rec: true, stops: [[0, '#e2e2e2'], [0.5739, '#d9d0b7']], edge: 0.35, card: 'linear-gradient(0deg,#d9d0b7 42.61%,#e2e2e2 100%)', bg: 'linear-gradient(0deg,#d9d0b7 42.61%,#e2e2e2 100%)' },
  den: { name: 'Đen', sweet: false, cafe: false, aspect: 512 / 792, stops: [[0, '#484848'], [0.5739, '#1e1e1e']], edge: 0.12, card: 'linear-gradient(0deg,#1e1e1e 42.61%,#484848 100%)', bg: 'linear-gradient(0deg,#1e1e1e 42.61%,#484848 100%)' },
  nau: { name: 'Nâu', sweet: true, cafe: false, aspect: 512 / 797, stops: [[0, '#fed9ae'], [0.574, '#ffc077']], edge: 0.35, card: 'linear-gradient(180deg,#fed9ae 0%,#ffc077 57.4%)', bg: 'linear-gradient(180deg,#fed3a1,#ffc077)' },
};
// món trong menu → món đã thiết kế (tên khác 3 món này dùng kiểu Đen)
export const drinkOf = (m) => { const k = kindOf(m.name); return { m, id: k || 'den', known: !!k, meta: META[k || 'den'] }; };

const rootRect = () => document.querySelector('.a-device').getBoundingClientRect();
const untransformedRect = (el) => { const p = el.style.transform; el.style.transform = 'none'; const r = el.getBoundingClientRect(); el.style.transform = p; return r; };
function veilKF(r, s, rad0, rad1) {
  const sx = r.width / s.width, sy = r.height / s.height;
  return [{ transform: `translate(${r.left - s.left}px,${r.top - s.top}px) scale(${sx},${sy})`, borderRadius: `${rad0 / sx}px / ${rad0 / sy}px` },
    { transform: 'translate(0px,0px) scale(1,1)', borderRadius: `${rad1}px / ${rad1}px` }];
}
function placeVeil(v, s) { Object.assign(v.style, { inset: 'auto', left: s.left + 'px', top: s.top + 'px', width: s.width + 'px', height: s.height + 'px', transformOrigin: '0 0', overflow: 'hidden', willChange: 'transform,opacity' }); }

const N_SIDE = 135 + 10 + 135 * (1 - 0.12); // 270px thẻ, 10px khe, thẻ bên 88%
const SIDE_SHRINK = 0.12;

// ---------------- Trang chủ: 3 thẻ, kéo ngang, 3 chấm ----------------
export const DrinkHome = forwardRef(function DrinkHome({ items, count, unread, onCart, onBell, onOpen, sold }, ref) {
  const N = items.length;
  const openRef = useRef(onOpen); openRef.current = onOpen;
  const carRef = useRef(null), dotsRef = useRef(null), cards = useRef([]);
  const partsRef = useRef({});
  const st = useRef({ pos: Math.min(1, Math.max(0, N - 1)), target: 1, vel: 0, raf: 0, drag: null, busy: false });
  const wrap = (o) => { o = ((o % N) + N) % N; return o >= N / 2 ? o - N : o; };

  useEffect(() => {
    if (!N) return undefined;
    const s = st.current, car = carRef.current;
    if (!s.init) { s.init = true; s.pos = s.target = Math.min(1, N - 1); }
    if (s.pos > N - 1) s.pos = N - 1;
    const active = () => ((Math.round(s.pos) % N) + N) % N;
    const layout = () => {
      const t = performance.now() / 1000;
      cards.current.forEach((el, i) => {
        if (!el) return;
        const o = wrap(i - s.pos), a = Math.abs(o);
        const sc = 1 - SIDE_SHRINK * Math.min(a, 1), x = o * N_SIDE;
        el.style.transform = `translate(${x}px,0) scale(${sc})`;
        el.style.opacity = a > 1 ? Math.max(0, 1 - (a - 1) * 2.2) : 1;
        el.style.zIndex = 10 - Math.round(a * 3);
        const cup = el.querySelector('.cup');
        const bob = RM ? 0 : Math.sin(t * 1.6 + i) * 4 * (1 - Math.min(a, 1));
        cup.style.transform = `translate(${-o * 26}px,${bob}px) rotate(${11.7 + o * 6}deg)`;
      });
      const ai = active();
      if (dotsRef.current) [...dotsRef.current.children].forEach((d, i) => d.classList.toggle('on', i === ai));
    };
    const settle = (to) => {
      s.target = to; cancelAnimationFrame(s.raf);
      const step = () => {
        s.vel = s.vel * 0.74 + (s.target - s.pos) * 0.085; s.pos += s.vel;
        if (Math.abs(s.target - s.pos) < 0.0008 && Math.abs(s.vel) < 0.0008) { s.pos = s.target; s.vel = 0; }
        layout();
        if (s.pos !== s.target || !RM) s.raf = requestAnimationFrame(step);
      };
      s.raf = requestAnimationFrame(step);
    };
    const idle = () => { cancelAnimationFrame(s.raf); const loop = () => { layout(); s.raf = requestAnimationFrame(loop); }; if (!RM) s.raf = requestAnimationFrame(loop); else layout(); };
    s.layout = layout; s.idle = idle; s.wrap = wrap;
    layout(); idle();

    const down = (e) => {
      if (s.busy) return;
      s.drag = { x: e.clientX, p: s.pos, lx: e.clientX, lt: performance.now(), v: 0, moved: false, card: e.target.closest('.card') };
      car.setPointerCapture(e.pointerId);
    };
    const move = (e) => {
      const d = s.drag; if (!d) return;
      const dx = e.clientX - d.x;
      if (Math.abs(dx) > 6) d.moved = true;
      if (!d.moved) return;
      const now = performance.now();
      d.v = (e.clientX - d.lx) / Math.max(1, now - d.lt); d.lx = e.clientX; d.lt = now;
      cancelAnimationFrame(s.raf); s.vel = 0;
      s.pos = d.p - dx / N_SIDE; layout();
    };
    const end = () => {
      const d = s.drag; if (!d) return; s.drag = null;
      if (!d.moved) {
        if (!d.card) return idle();
        const i = +d.card.dataset.i, o = Math.round(wrap(i - s.pos));
        if (o === 0) return openRef.current(i);
        return settle(Math.round(s.pos) + o);
      }
      let to = Math.round(s.pos + -d.v * 0.9);
      to = Math.max(Math.round(d.p) - 1, Math.min(Math.round(d.p) + 1, to));
      settle(to);
    };
    const key = (e) => { if (e.key === 'ArrowRight') settle(Math.round(s.pos) + 1); if (e.key === 'ArrowLeft') settle(Math.round(s.pos) - 1); };
    car.addEventListener('pointerdown', down); car.addEventListener('pointermove', move);
    car.addEventListener('pointerup', end); car.addEventListener('pointercancel', end); car.addEventListener('keydown', key);
    return () => { cancelAnimationFrame(s.raf); car.removeEventListener('pointerdown', down); car.removeEventListener('pointermove', move); car.removeEventListener('pointerup', end); car.removeEventListener('pointercancel', end); car.removeEventListener('keydown', key); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [N]);

  // điều khiển từ màn chi tiết: đo thẻ, thu/hiện lại phần còn lại của trang chủ
  useImperativeHandle(ref, () => ({
    freeze(i) {
      const s = st.current; cancelAnimationFrame(s.raf); s.pos = Math.round(s.pos); s.vel = 0; s.layout && s.layout(); s.busy = true;
      const card = cards.current[i], cup = card.querySelector('.cup');
      cup.style.transform = 'none'; const cupR = cup.getBoundingClientRect(); cup.style.transform = 'rotate(11.7deg)';
      return { cardR: card.getBoundingClientRect(), cupR, pill: this.pill(i) };
    },
    cardRect(i) { const card = cards.current[i], cup = card.querySelector('.cup'); cup.style.transform = 'none'; const c = cup.getBoundingClientRect(); cup.style.transform = 'rotate(11.7deg)'; return { cardR: card.getBoundingClientRect(), cupR: c }; },
    pill(i) {
      const card = cards.current[i], r = card.getBoundingClientRect();
      const w = document.createElement('div'); w.className = 'card'; w.dataset.id = card.dataset.id;
      Object.assign(w.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px', transform: 'none', pointerEvents: 'none', cursor: 'default' });
      w.appendChild(card.querySelector('.pricebar').cloneNode(true));
      return w;
    },
    hideCup(i, hide) { const c = cards.current[i]; if (c) c.querySelector('.cup').style.visibility = hide ? 'hidden' : ''; },
    recede(i) {
      const s = st.current;
      const parts = [partsRef.current.logo, partsRef.current.bell, partsRef.current.cart, partsRef.current.dots];
      parts.forEach((el, k) => el && el.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: k >= 3 ? 'translateY(30px)' : 'translateY(-24px)' }], { duration: T(320), delay: k * 25, easing: 'ease-in', fill: 'forwards' }));
      cards.current.forEach((c, k) => {
        if (!c) return;
        if (k === i) { c.querySelectorAll('.top,.pricebar').forEach((el) => el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: T(160), fill: 'forwards' })); return; }
        const o = Math.sign(wrap(k - s.pos)) || 1;
        c.animate([{ opacity: c.style.opacity, translate: '0 0' }, { opacity: 0, translate: `${o * 160}px 0` }], { duration: T(420), easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' });
      });
    },
    restore(i, D) {
      const s = st.current;
      const parts = [partsRef.current.logo, partsRef.current.bell, partsRef.current.cart, partsRef.current.dots];
      parts.forEach((el) => el && el.getAnimations().forEach((a) => a.cancel()));
      cards.current.forEach((c) => { if (!c) return; c.getAnimations().forEach((a) => a.cancel()); c.querySelectorAll('.top,.pricebar').forEach((el) => el.getAnimations().forEach((a) => a.cancel())); });
      parts.forEach((el, k) => el && el.animate([{ opacity: 0, transform: k >= 3 ? 'translateY(30px)' : 'translateY(-24px)' }, { opacity: 1, transform: 'none' }], { duration: T(520), delay: D * 0.45 + k * 40, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'backwards' }));
      cards.current.forEach((c, k) => {
        if (!c) return;
        if (k === i) { c.querySelectorAll('.top,.pricebar').forEach((el) => el.animate([{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }], { duration: T(400), delay: D * 0.7, easing: 'ease-out', fill: 'backwards' })); return; }
        const o = Math.sign(wrap(k - s.pos)) || 1;
        c.animate([{ opacity: 0, translate: `${o * 160}px 0` }, { opacity: c.style.opacity, translate: '0 0' }], { duration: T(620), delay: D * 0.35, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'backwards' });
      });
    },
    unfreeze() { const s = st.current; s.busy = false; if (carRef.current && s.idle) s.idle(); },
  }));

  return (
    <div className="dr dr-home">
      <div className="o-head">
        <span ref={(n) => { partsRef.current.logo = n; }}><Sym id="i-logo" size={110} /></span>
        <span className="grow" />
        <button ref={(n) => { partsRef.current.bell = n; }} className="o-bag" onClick={onBell} aria-label="Thông báo"><Sym id="i-bell" size={26} />{unread > 0 && <span className="a-badge">{unread}</span>}</button>
        <button ref={(n) => { partsRef.current.cart = n; }} className="o-bag" onClick={onCart} aria-label="Giỏ hàng"><Sym id="i-bag" size={28} />{count > 0 && <span className="a-badge">{count}</span>}</button>
      </div>
      <div className="dr-mid">
        <div className="dr-car" ref={carRef} tabIndex={0}>
          {items.map((it, i) => {
            const d = it.meta, k = it.id;
            return (
              <div key={it.m.id} className={`card${sold ? ' sold' : ''}`} data-id={k} data-i={i} role="button" aria-label={`Xem ${d.name}`} ref={(n) => { cards.current[i] = n; }}>
                <svg className="surf" viewBox="0 0 270 360" aria-hidden="true">
                  <defs>
                    <linearGradient id={`g-${k}-${i}`} x1="0" y1="0" x2="0" y2="1">{d.stops.map(([o, c]) => <stop key={o} offset={o} stopColor={c} />)}</linearGradient>
                    <linearGradient id={`e-${k}-${i}`} x1="0" y1="0" x2="1" y2="0"><stop stopColor="#fff" /><stop offset=".5" stopColor="#fff" stopOpacity=".5" /><stop offset="1" stopColor="#fff" /></linearGradient>
                  </defs>
                  <rect width="270" height="360" rx="32" fill={`url(#g-${k}-${i})`} />
                  <rect x=".75" y=".75" width="268.5" height="358.5" rx="31.25" fill="none" stroke={`url(#e-${k}-${i})`} strokeOpacity={d.edge} strokeWidth="1.5" />
                </svg>
                <div className="cup" style={k === 'bac' ? undefined : { left: (135 - (245 * d.aspect) / 2).toFixed(1) + 'px' }}>
                  {it.known ? <img src={`/${k}.webp`} alt="" draggable="false" /> : <Sym id="i-cup" size={120} />}
                </div>
                <div className="top">
                  {d.rec
                    ? <div className="row"><h3>{it.known ? d.name : it.m.name}</h3><span className="rec"><Sym id="i-star" size={13} />RECOMMEND</span></div>
                    : <h3>{it.known ? d.name : it.m.name}</h3>}
                  <div className="ico"><span className="circ"><Sym id="i-snow" size={16} /></span><span className="circ"><Sym id="i-steam" size={16} /></span></div>
                </div>
                <div className="pricebar"><i className="glint" /><b>{sold ? 'Hết hàng' : fmt(it.m.price)}</b><span><Sym id="i-cardadd" size={28} /></span></div>
              </div>
            );
          })}
        </div>
        <div className="dots" ref={(n) => { partsRef.current.dots = n; dotsRef.current = n; }}>{items.map((it) => <i key={it.m.id} />)}</div>
      </div>
    </div>
  );
});

// ---------------- Chi tiết món ----------------
const preT = (el) => {
  const a = el.dataset.a;
  return a === 'left' ? 'translateX(-36px)' : a === 'l' ? 'translateX(-70px)'
    : a === 'r' ? (el.classList.contains('bulge') ? 'scaleX(-1) translateX(-70px)' : 'translateX(70px)')
      : a === 'up' ? (el.dataset.k === 'price' ? 'translate(-50%,24px)' : 'translateY(24px)')
        : a === 'rise' ? 'translateY(90px)' : 'scale(.6)';
};
const restT = (el) => (el.classList.contains('bulge') && el.dataset.a === 'r' ? 'scaleX(-1)' : el.dataset.k === 'price' ? 'translateX(-50%)' : 'none');

export function DrinkDetail({ item, index, home, count, onClose, onAdd, onBuy, onCart }) {
  const d = item.meta, k = item.id, m = item.m;
  const extra = typeof m.upsize === 'number' ? m.upsize : XL_EXTRA;
  const root = useRef(null), stage = useRef(null), spin = useRef(null), fxRef = useRef(null), qtyBox = useRef(null), priceRef = useRef(null), cartBtn = useRef(null);
  const [o, setO] = useState({ upsize: 0, hot: 0, sweet: 0, cafe: 0 });
  const [qty, setQty] = useState(1);
  const qtyN = useRef(1), busy = useRef(true), adding = useRef(false);
  const unit = m.price + (o.upsize ? extra : 0);
  const made = useRef([]);
  const track = (n) => { made.current.push(n); return n; };

  // lớp hiệu ứng nằm ngoài khung nên cắt theo khung 390×660
  useLayoutEffect(() => {
    const clip = () => { const r = rootRect(); if (fxRef.current) fxRef.current.style.clipPath = `inset(${r.top}px ${innerWidth - r.right}px ${innerHeight - r.bottom}px ${r.left}px)`; };
    clip(); addEventListener('resize', clip); return () => removeEventListener('resize', clip);
  }, []);

  const parts = () => [...root.current.querySelectorAll('[data-a]')];
  const S = () => stage.current.getBoundingClientRect().width / 390;

  // mở: thẻ nở thành màn chi tiết, ly bay sang chỗ mới, các nút vào lần lượt
  useEffect(() => {
    let dead = false;
    (async () => {
      const info = home.freeze(index);
      const { cardR, cupR: from } = info; const pill = track(info.pill);
      const rootEl = root.current, fx = fxRef.current, sp = spin.current;
      rootEl.style.opacity = '0';
      const ps = parts();
      ps.forEach((el) => el.getAnimations().forEach((x) => x.cancel()));
      ps.forEach((el) => { el.style.opacity = 0; el.style.transform = preT(el); });
      const title = rootEl.querySelector('.dtitle'); title.style.opacity = 0;
      sp.style.opacity = 0;
      const to = untransformedRect(sp);
      const sr = rootRect(), Sc = S();
      const veil = track(document.createElement('div')); veil.className = 'veil';
      veil.innerHTML = `<div style="position:absolute;inset:0;background:${d.card}"></div><div class="vb" style="position:absolute;inset:0;background:${d.bg};opacity:0"></div>`;
      placeVeil(veil, sr); fx.appendChild(veil);
      const fly = track(document.createElement('img')); fly.className = 'fly'; fly.src = item.known ? `/${k}.webp` : '';
      fly.style.width = to.width + 'px'; fly.style.height = to.height + 'px'; fly.style.filter = `drop-shadow(0 0 22px ${GLOW})`;
      if (item.known) fx.appendChild(fly);
      const sx = from.width / to.width;
      const fromT = `translate(${from.left}px,${from.top}px) translate(${from.width / 2}px,${from.height / 2}px) rotate(11.7deg) translate(${-from.width / 2}px,${-from.height / 2}px) scale(${sx})`;
      const midT = `translate(${(from.left + to.left) / 2}px,${Math.min(from.top, to.top) - 30 * Sc}px) scale(${((sx + 1) / 2) * 1.04})`;
      const toT = `translate(${to.left}px,${to.top}px)`;
      fx.appendChild(pill); pill.animate([{ opacity: 1 }, { opacity: 0 }], { duration: T(160), fill: 'forwards' });
      home.hideCup(index, true);
      await nextFrame(); if (dead) return;
      const D = T(760);
      const veilA = veil.animate(veilKF(cardR, sr, 32 * Sc, 0), { duration: D * 0.9, easing: EASE_MORPH, fill: 'forwards' });
      veil.animate([{ opacity: 0 }, { opacity: 1, offset: 0.4 }, { opacity: 1 }], { duration: D * 0.9, easing: 'ease-out', fill: 'forwards' });
      veil.querySelector('.vb').animate([{ opacity: 0 }, { opacity: 1 }], { duration: D * 0.7, delay: D * 0.1, easing: 'ease-in-out', fill: 'forwards' });
      if (item.known) fly.animate([{ transform: fromT }, { transform: midT, offset: 0.45 }, { transform: toT }], { duration: D, easing: 'cubic-bezier(.5,0,.15,1)', fill: 'forwards' });
      home.recede(index);
      await veilA.finished; if (dead) return;
      rootEl.style.opacity = ''; veil.remove(); pill.remove();
      const order = ['back', 'cart', 'title', 'opts', 'l', 'r', 'qty', 'price', 'rise'];
      ps.forEach((el) => {
        const key = el.dataset.k || el.dataset.a;
        if (el.classList.contains('opt')) {
          const row = [...el.parentNode.children].indexOf(el);
          el.querySelectorAll('.chip').forEach((c, n) => c.animate([{ opacity: 0, transform: 'scale(.2)' }, { opacity: 1, transform: 'scale(1)' }], { duration: T(640), delay: T(190 + (row * 2 + n) * 100), easing: 'cubic-bezier(.34,1.75,.5,1)', fill: 'backwards' }));
          const lb = el.querySelector('label');
          if (lb) lb.animate([{ opacity: 0, transform: 'translateX(-14px)' }, { opacity: 1, transform: 'none' }], { duration: T(420), delay: T(190 + row * 200), easing: 'cubic-bezier(.22,1,.36,1)', fill: 'backwards' });
          el.style.opacity = ''; el.style.transform = ''; return;
        }
        const kk = order.indexOf(key);
        el.animate([{ opacity: 0, transform: preT(el) }, { opacity: 1, transform: restT(el) }], { duration: T(560), delay: T(40 + (kk < 0 ? 8 : kk) * 45), easing: 'cubic-bezier(.22,1,.36,1)', fill: 'backwards' });
        el.style.opacity = ''; el.style.transform = '';
      });
      title.style.opacity = '';
      await new Promise((r) => setTimeout(r, Math.max(0, D - D * 0.9)));
      sp.style.opacity = ''; fly.remove();
      busy.current = false;
    })();
    return () => { dead = true; made.current.forEach((n) => n.remove()); made.current = []; home.hideCup(index, false); home.unfreeze(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // đóng: ly và thẻ thu về chỗ cũ trên trang chủ
  const close = async () => {
    if (busy.current) return; busy.current = true;
    const rootEl = root.current, fx = fxRef.current, sp = spin.current, Sc = S();
    const from = untransformedRect(sp);
    const { cardR, cupR: to } = home.cardRect(index);
    const ps = parts().reverse();
    ps.forEach((el, kk) => el.animate([{ opacity: 1, transform: restT(el) }, { opacity: 0, transform: preT(el) }], { duration: T(260), delay: kk * 18, easing: 'cubic-bezier(.4,0,1,1)', fill: 'forwards' }));
    const title = rootEl.querySelector('.dtitle'); title.animate([{ opacity: 1 }, { opacity: 0 }], { duration: T(200), fill: 'forwards' });
    const veil = document.createElement('div'); veil.className = 'veil';
    veil.innerHTML = `<div style="position:absolute;inset:0;background:${d.card}"></div><div class="vb" style="position:absolute;inset:0;background:${d.bg}"></div>`;
    const sr = rootRect(); placeVeil(veil, sr);
    const fly = document.createElement('img'); fly.className = 'fly'; fly.src = item.known ? `/${k}.webp` : '';
    fly.style.width = from.width + 'px'; fly.style.height = from.height + 'px'; fly.style.filter = `drop-shadow(0 0 22px ${GLOW})`;
    const sx = to.width / from.width;
    const toT = `translate(${to.left}px,${to.top}px) translate(${to.width / 2}px,${to.height / 2}px) rotate(11.7deg) translate(${-to.width / 2}px,${-to.height / 2}px) scale(${sx})`;
    const fromT = `translate(${from.left}px,${from.top}px)`;
    await new Promise((r) => setTimeout(r, T(160)));
    const pill = home.pill(index);
    fx.appendChild(veil); if (item.known) fx.appendChild(fly); fx.appendChild(pill);
    pill.animate([{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }], { duration: T(400), delay: T(720) * 0.7, easing: 'ease-out', fill: 'backwards' });
    sp.style.opacity = 0; rootEl.style.visibility = 'hidden';
    await nextFrame();
    const D = T(720);
    home.restore(index, D);
    veil.querySelector('.vb').animate([{ opacity: 1 }, { opacity: 0 }], { duration: D * 0.7, easing: 'ease-in-out', fill: 'forwards' });
    const veilA = veil.animate(veilKF(cardR, sr, 32 * Sc, 0).reverse(), { duration: D, easing: EASE_MORPH, fill: 'forwards' });
    veil.animate([{ opacity: 1 }, { opacity: 1, offset: 0.55 }, { opacity: 0 }], { duration: D, easing: 'ease-in', fill: 'forwards' });
    const midT = `translate(${(from.left + to.left) / 2}px,${Math.min(from.top, to.top) - 24 * Sc}px) scale(${((sx + 1) / 2) * 1.04})`;
    if (item.known) fly.animate([{ transform: fromT }, { transform: midT, offset: 0.5 }, { transform: toT }], { duration: D, easing: 'cubic-bezier(.65,0,.25,1)', fill: 'forwards' });
    await veilA.finished;
    home.hideCup(index, false); veil.remove(); fly.remove(); pill.remove();
    home.unfreeze(); onClose();
  };

  // số lượng: chữ số cũ trượt đi, số mới trượt vào; nhấn giữ để đếm liên tục
  const bump = (n) => {
    n = Math.max(1, Math.min(99, n)); if (n === qtyN.current) return;
    const dir = n > qtyN.current ? 1 : -1; qtyN.current = n; setQty(n);
    const box = qtyBox.current;
    while (box.children.length > 1) box.firstElementChild.remove();
    const old = box.firstElementChild, nu = document.createElement('span');
    old.getAnimations().forEach((x) => x.cancel());
    nu.textContent = pad(n); box.appendChild(nu);
    old.animate([{ transform: 'translateY(0)', opacity: 1 }, { transform: `translateY(${-dir * 40}px)`, opacity: 0 }], { duration: T(320), easing: 'cubic-bezier(.22,1,.36,1)' }).onfinish = () => old.remove();
    nu.animate([{ transform: `translateY(${dir * 40}px)`, opacity: 0 }, { transform: 'translateY(0)', opacity: 1 }], { duration: T(320), easing: 'cubic-bezier(.22,1,.36,1)' });
  };
  const hold = (dir) => {
    let t = 0, iv = 0, held = false;
    const stop = () => { clearTimeout(t); clearInterval(iv); };
    return {
      onPointerDown: () => { held = false; stop(); t = setTimeout(() => { held = true; bump(qtyN.current + dir); iv = setInterval(() => bump(qtyN.current + dir), 110); }, 380); },
      onPointerUp: stop, onPointerLeave: stop, onPointerCancel: stop,
      onContextMenu: (e) => e.preventDefault(),
      onClick: () => { if (held) { held = false; return; } bump(qtyN.current + dir); },
    };
  };
  const minus = useRef(null), plus = useRef(null);
  if (!minus.current) { minus.current = hold(-1); plus.current = hold(1); }

  // giá nảy nhẹ khi đổi
  const first = useRef(true);
  useEffect(() => { if (first.current) { first.current = false; return; } priceRef.current.animate([{ transform: 'translateX(-50%) scale(1.08)' }, { transform: 'translateX(-50%) scale(1)' }], { duration: T(260), easing: 'ease-out' }); }, [unit, qty]);

  const pick = (key, v, e) => {
    e.currentTarget.animate([{ transform: 'scale(.8)' }, { transform: 'scale(1)' }], { duration: T(380), easing: 'cubic-bezier(.34,1.56,.64,1)' });
    setO((x) => ({ ...x, [key]: v }));
  };
  const chip = (key, v, label, content, val) => <button key={v} className={`chip${(o[key] || 0) === v ? ' on' : ''}${val ? ' val' : ''}`} aria-label={label} aria-pressed={(o[key] || 0) === v} onClick={(e) => pick(key, v, e)}>{content}</button>;

  // vuốt xuống để quay lại
  useEffect(() => {
    const det = root.current; let sw = null;
    const down = (e) => { sw = e.target.closest('.dacts,.pm,.chip,button') ? null : { x: e.clientX, y: e.clientY }; };
    const move = (e) => { if (!sw) return; const dy = e.clientY - sw.y, dx = e.clientX - sw.x; if (dy > 70 && dy > Math.abs(dx) * 1.4) { sw = null; close(); } };
    const up = () => { sw = null; };
    det.style.touchAction = 'none';
    det.addEventListener('pointerdown', down); det.addEventListener('pointermove', move); det.addEventListener('pointerup', up); det.addEventListener('pointercancel', up);
    return () => { det.removeEventListener('pointerdown', down); det.removeEventListener('pointermove', move); det.removeEventListener('pointerup', up); det.removeEventListener('pointercancel', up); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // thêm vào giỏ: ly bay vào nút giỏ hàng
  const add = async () => {
    if (busy.current || adding.current) return; adding.current = true;
    const sp = spin.current, fx = fxRef.current, Sc = S();
    const r = sp.getBoundingClientRect(), c = cartBtn.current.getBoundingClientRect();
    const ghost = document.createElement('div'); ghost.className = 'fly';
    Object.assign(ghost.style, { width: r.width + 'px', height: r.height + 'px', backgroundImage: sp.style.backgroundImage, backgroundSize: 'contain', backgroundRepeat: 'no-repeat', backgroundPosition: 'center', filter: `drop-shadow(0 0 12px ${GLOW})` });
    fx.appendChild(ghost);
    const s = (34 * Sc) / r.height;
    const ex = c.left + c.width / 2 - (r.width * s) / 2, ey = c.top + c.height / 2 - (r.height * s) / 2;
    const a = ghost.animate([
      { transform: `translate(${r.left}px,${r.top}px) scale(1)`, opacity: 1 },
      { transform: `translate(${(r.left + ex) / 2 + 20 * Sc}px,${Math.min(r.top, ey) - 50 * Sc}px) scale(${(1 + s) / 2}) rotate(-12deg)`, opacity: 1, offset: 0.5 },
      { transform: `translate(${ex}px,${ey}px) scale(${s}) rotate(-20deg)`, opacity: 0.4 },
    ], { duration: T(820), easing: 'cubic-bezier(.5,0,.3,1)', fill: 'forwards' });
    sp.animate([{ opacity: 1, transform: 'scale(1)' }, { opacity: 0.35, transform: 'scale(.94)', offset: 0.3 }, { opacity: 1, transform: 'scale(1)' }], { duration: T(900), easing: 'ease-in-out' });
    await a.finished; ghost.remove();
    cartBtn.current.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.22)' }, { transform: 'scale(.95)' }, { transform: 'scale(1)' }], { duration: T(480), easing: 'ease-out' });
    onAdd({ o, qty: qtyN.current });
    adding.current = false;
  };

  const f = d;
  return (
    <>
    <div className="dr dr-detail" data-id={k} ref={root} aria-label="Chi tiết đồ uống">
      <div className="dr-stage" ref={stage} style={{ transform: 'translate(-50%,-50%)' }}>
        <div className="abs bulge l" data-a="l"><Sym id="i-bulge" size={84} /></div>
        <div className="abs bulge r" data-a="r"><Sym id="i-bulge" size={84} /></div>
        <button className="abs circ back" data-k="back" data-a="pop" onClick={close} aria-label="Đóng"><Sym id="i-close" size={28} /></button>
        <button className="abs circ cartbtn" data-k="cart" data-a="pop" ref={cartBtn} onClick={onCart} aria-label="Giỏ hàng"><Sym id="i-bag" size={28} /><span className={`badge${count > 0 ? ' on' : ''}`}>{count}</span></button>
        <h1 className="abs dtitle" data-k="title" data-a="left">{item.known ? d.name : m.name}</h1>
        <div className="abs opts" data-k="opts">
          <div className="opt" data-a="left" data-k="upsize"><div>{chip('upsize', 0, 'Size L', <Sym id="i-sizeL" size={40} />)}{chip('upsize', 1, 'Size XL', <Sym id="i-sizeXL" size={40} />, true)}</div></div>
          <div className="opt" data-a="left" data-k="hot"><div>{chip('hot', 0, 'Lạnh', <Sym id="i-snow" size={22} />)}{chip('hot', 1, 'Nóng', <Sym id="i-steam" size={22} />, true)}</div></div>
          {f.sweet && <div className="opt" data-a="left" data-k="sweet"><label>Ngọt</label><div>{chip('sweet', 0, 'Ngọt 100%', '100')}{chip('sweet', 50, 'Ngọt 50%', '50', true)}</div></div>}
          {f.cafe && <div className="opt" data-a="left" data-k="cafe"><label>Cafe</label><div>{chip('cafe', 0, 'Cafe 100%', '100')}{chip('cafe', 50, 'Cafe 50%', '50', true)}</div></div>}
        </div>
        <div className="abs spin" ref={spin} role="img" aria-label={d.name} style={{ backgroundImage: item.known ? `url(/${k}.webp)` : 'none', height: 310, width: 310 * d.aspect, left: 261 - (310 * d.aspect) / 2 }} />
        <button className="abs circ pm minus" data-a="l" aria-label="Giảm" {...minus.current}><Sym id="i-minus" size={32} /></button>
        <button className="abs circ pm plus" data-a="r" aria-label="Tăng" {...plus.current}><Sym id="i-plus" size={32} /></button>
        <div className="abs qty" data-k="qty" data-a="up" ref={qtyBox} dangerouslySetInnerHTML={{ __html: '<span>01</span>' }} />
        <div className="abs dprice" data-k="price" data-a="up" ref={priceRef}>{fmt(unit * qty)}</div>
        <div className="abs dacts" data-k="rise" data-a="rise">
          <button className="dadd" onClick={add} aria-label="Thêm vào giỏ hàng"><Sym id="i-bagadd" size={28} /></button>
          <button className="dbuy" onClick={() => { if (busy.current || adding.current) return; onBuy({ o, qty: qtyN.current }); }}>Thanh toán ngay</button>
        </div>
      </div>
    </div>
    {createPortal(<div className="dr dr-fx" ref={fxRef} />, document.body)}
    </>
  );
}
