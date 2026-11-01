// Pháo hoa bắn từ hai bên vào giữa màn hình, vẽ trên một canvas phủ lên container rồi tự gỡ khi xong.
const COLORS = ['#ffcc00', '#ffffff', '#ff9500', '#34c759', '#ff375f', '#64d2ff'];

export function fireworks(host, { w = 390, h = 660 } = {}) {
  if (!host || (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches)) return () => {};
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const cv = document.createElement('canvas');
  cv.width = w * dpr; cv.height = h * dpr;
  cv.style.cssText = `position:absolute;left:0;top:0;width:${w}px;height:${h}px;pointer-events:none;z-index:60`;
  cv.setAttribute('aria-hidden', 'true');
  host.appendChild(cv);
  const g = cv.getContext('2d'); g.scale(dpr, dpr);
  let ps = [], raf = 0, stopped = false;
  const rnd = (a, b) => a + Math.random() * (b - a);

  // một quả pháo: bay từ mép lên rồi nổ thành chùm hạt
  const shots = [];
  const launch = (side) => {
    const x0 = side < 0 ? -4 : w + 4, y0 = rnd(h * .62, h * .8);
    const tx = w / 2 + rnd(-w * .22, w * .22) + (side < 0 ? -w * .12 : w * .12), ty = rnd(h * .16, h * .38);
    shots.push({ x: x0, y: y0, tx, ty, t: 0, dur: rnd(520, 760), x0, y0, side });
  };
  const burst = (x, y) => {
    const col = [COLORS[(Math.random() * COLORS.length) | 0], COLORS[(Math.random() * COLORS.length) | 0]];
    for (let i = 0; i < 46; i++) {
      const a = Math.random() * Math.PI * 2, v = rnd(1.2, 4.6);
      ps.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0, max: rnd(900, 1500), c: col[i % 2], r: rnd(1.4, 2.8) });
    }
  };
  // 4 đợt, mỗi đợt một quả từ mỗi bên
  [0, 380, 760, 1180].forEach((d) => setTimeout(() => { if (!stopped) { launch(-1); launch(1); } }, d));

  let last = performance.now(), end = performance.now() + 4200;
  const frame = (now) => {
    const dt = Math.min(40, now - last); last = now;
    g.clearRect(0, 0, w, h);
    for (let i = shots.length - 1; i >= 0; i--) {
      const s = shots[i]; s.t += dt;
      const k = Math.min(1, s.t / s.dur), e = 1 - Math.pow(1 - k, 2);
      s.x = s.x0 + (s.tx - s.x0) * e; s.y = s.y0 + (s.ty - s.y0) * e;
      g.globalAlpha = 1; g.fillStyle = '#ffe58a'; g.beginPath(); g.arc(s.x, s.y, 2.2, 0, 7); g.fill();
      if (k >= 1) { burst(s.x, s.y); shots.splice(i, 1); }
    }
    for (let i = ps.length - 1; i >= 0; i--) {
      const p = ps[i]; p.life += dt;
      if (p.life > p.max) { ps.splice(i, 1); continue; }
      p.vx *= .985; p.vy = p.vy * .985 + .045 * (dt / 16);
      p.x += p.vx * (dt / 16); p.y += p.vy * (dt / 16);
      g.globalAlpha = Math.max(0, 1 - p.life / p.max);
      g.fillStyle = p.c; g.beginPath(); g.arc(p.x, p.y, p.r, 0, 7); g.fill();
    }
    if (!stopped && (now < end || shots.length || ps.length)) raf = requestAnimationFrame(frame); else stop();
  };
  const stop = () => { stopped = true; cancelAnimationFrame(raf); cv.remove(); };
  raf = requestAnimationFrame(frame);
  return stop;
}
