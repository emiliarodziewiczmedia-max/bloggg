/* ============================================================
   fx.js — dedykowane animacje sekcji (canvas). Każda funkcja
   dostaje <canvas> i kolor sekcji; kończy się sama, gdy canvas
   zniknie z DOM. Przypisanie sekcja -> efekt: SECTION_FX na dole.
   ============================================================ */
(() => {
"use strict";
const ACID = "#b8ff2e", PINK = "#f2a0b8", INK = "#ececec";
const MONO = "JetBrains Mono, monospace";
const hexa = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`; };
const rnd = (a, b) => a + Math.random() * (b - a);

function run(canvas, draw) {
  const ctx = canvas.getContext("2d");
  let t0 = performance.now(), frames = 0;
  const loop = now => {
    if (!canvas.isConnected) return;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) { requestAnimationFrame(loop); return; }
    const dpr = Math.min(2, devicePixelRatio || 1);
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (document.hidden) { requestAnimationFrame(loop); return; }
    draw(ctx, w, h, (now - t0) / 1000, frames++);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
function grid(ctx, w, h, color, step = 24) {
  ctx.strokeStyle = hexa(color, .08); ctx.lineWidth = 1; ctx.beginPath();
  for (let x = .5; x < w; x += step) { ctx.moveTo(x, 0); ctx.lineTo(x, h); }
  for (let y = .5; y < h; y += step) { ctx.moveTo(0, y); ctx.lineTo(w, y); }
  ctx.stroke();
}
function label(ctx, w, h, text, color) {
  ctx.font = `9px ${MONO}`; ctx.fillStyle = hexa(color, .7); ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
  ctx.fillText(text, 10, h - 8);
}

/* --- Terapia: EKG ---------------------------------------------- */
function ekg(canvas, color) {
  const pts = [];
  run(canvas, (ctx, w, h, t) => {
    ctx.clearRect(0, 0, w, h); grid(ctx, w, h, color);
    const mid = h * .55, speed = 160; const x = (t * speed) % (w + 40);
    // sygnał: płaska linia z zespołem QRS co ~1,1 s
    const sig = tt => { const ph = (tt * 1.1) % 1; let v = Math.sin(tt * 7) * .02;
      if (ph > .30 && ph < .34) v -= (ph - .30) / .04 * .12; else if (ph >= .34 && ph < .40) v += 1 - Math.abs(ph - .37) / .03; else if (ph >= .40 && ph < .45) v -= (1 - (ph - .40) / .05) * .25; else if (ph > .55 && ph < .70) v += Math.sin((ph - .55) / .15 * Math.PI) * .18;
      return v; };
    pts.push({ x, y: mid - sig(t) * h * .38 }); if (pts.length > 2000) pts.shift();
    ctx.lineWidth = 1.6; ctx.strokeStyle = color; ctx.shadowColor = color; ctx.shadowBlur = 8;
    ctx.beginPath(); let started = false;
    for (let i = 0; i < pts.length; i++) { const p = pts[i]; const age = x - p.x; if (age < 0 || age > w) { started = false; continue; } ctx.globalAlpha = Math.max(0, 1 - age / w); if (!started) { ctx.moveTo(p.x, p.y); started = true; } else ctx.lineTo(p.x, p.y); }
    ctx.stroke(); ctx.shadowBlur = 0; ctx.globalAlpha = 1;
    ctx.fillStyle = INK; ctx.fillRect(x - 1, 0, 2, h); ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, pts[pts.length - 1].y, 3, 0, 7); ctx.fill();
    ctx.font = `10px ${MONO}`; ctx.textAlign = "right"; ctx.fillStyle = hexa(INK, .7); ctx.fillText(`${(62 + Math.sin(t * .4) * 4).toFixed(0)} BPM`, w - 10, 16);
    label(ctx, w, h, "// sygnał_ rytm zatokowy", color);
  });
}

/* --- RPG: wireframe d20 ---------------------------------------- */
function d20(canvas, color) {
  const phi = (1 + Math.sqrt(5)) / 2; const V = [];
  [[-1, phi, 0], [1, phi, 0], [-1, -phi, 0], [1, -phi, 0], [0, -1, phi], [0, 1, phi], [0, -1, -phi], [0, 1, -phi], [phi, 0, -1], [phi, 0, 1], [-phi, 0, -1], [-phi, 0, 1]].forEach(v => { const l = Math.hypot(...v); V.push(v.map(c => c / l)); });
  const E = []; for (let i = 0; i < 12; i++) for (let j = i + 1; j < 12; j++) { const d = Math.hypot(V[i][0] - V[j][0], V[i][1] - V[j][1], V[i][2] - V[j][2]); if (d < 1.1) E.push([i, j]); }
  run(canvas, (ctx, w, h, t) => {
    ctx.clearRect(0, 0, w, h); grid(ctx, w, h, color, 32);
    const R = Math.min(w, h) * .38, cx = w * .5, cy = h * .5;
    const a = t * .5, b = t * .33; const ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b);
    const P = V.map(([x, y, z]) => { const x1 = x * ca - z * sa, z1 = x * sa + z * ca; const y1 = y * cb - z1 * sb, z2 = y * sb + z1 * cb; return [cx + x1 * R, cy + y1 * R, z2]; });
    ctx.lineWidth = 1;
    E.forEach(([i, j]) => { const z = (P[i][2] + P[j][2]) / 2; ctx.strokeStyle = hexa(color, .25 + (z + 1) / 2 * .7); ctx.beginPath(); ctx.moveTo(P[i][0], P[i][1]); ctx.lineTo(P[j][0], P[j][1]); ctx.stroke(); });
    P.forEach(p => { ctx.fillStyle = p[2] > 0 ? INK : hexa(color, .5); ctx.fillRect(p[0] - 1.5, p[1] - 1.5, 3, 3); });
    // orbita liczb
    ctx.font = `10px ${MONO}`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    for (let k = 0; k < 6; k++) { const ang = t * .6 + k * Math.PI / 3; const x = cx + Math.cos(ang) * R * 1.45, y = cy + Math.sin(ang) * R * .45; const front = Math.sin(ang) > 0; ctx.fillStyle = hexa(front ? INK : color, front ? .9 : .35); ctx.fillText(String(((Math.floor(t * 3) + k * 7) % 20) + 1).padStart(2, "0"), x, y); }
    ctx.strokeStyle = hexa(color, .3); ctx.beginPath(); ctx.ellipse(cx, cy, R * 1.45, R * .45, 0, 0, Math.PI * 2); ctx.stroke();
    label(ctx, w, h, "// rzut_ 1d20", color);
  });
}

/* --- IdPol: drut kolczasty + zakłócony sygnał ------------------ */
function wire(canvas, color) {
  run(canvas, (ctx, w, h, t, f) => {
    ctx.clearRect(0, 0, w, h); grid(ctx, w, h, color, 40);
    const rows = [h * .3, h * .7];
    rows.forEach((y, ri) => {
      const off = ((t * 40 * (ri ? -1 : 1)) % 60 + 60) % 60;
      ctx.strokeStyle = hexa(color, .8); ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
      for (let x = -60 + off; x < w + 60; x += 60) { ctx.beginPath(); ctx.moveTo(x - 6, y - 7); ctx.lineTo(x + 6, y + 7); ctx.moveTo(x + 6, y - 7); ctx.lineTo(x - 6, y + 7); ctx.stroke(); ctx.beginPath(); ctx.arc(x, y, 2.5, 0, 7); ctx.stroke(); }
    });
    // sygnał między drutami: fala z glitchami
    ctx.strokeStyle = PINK; ctx.lineWidth = 1.4; ctx.beginPath();
    const my = h * .5;
    for (let x = 0; x <= w; x += 2) { const g = (Math.sin(x * .05 + t * 3) > .97 && f % 7 < 3) ? rnd(-10, 10) : 0; const y = my + Math.sin(x * .03 + t * 2) * h * .08 + Math.sin(x * .11 - t * 5) * h * .03 + g; x ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
    ctx.stroke();
    // paski hazard po bokach
    ctx.save(); ctx.fillStyle = hexa(color, .55); const s = ((t * 30) % 20);
    for (let x = -20 + s; x < w + 20; x += 20) { ctx.beginPath(); ctx.moveTo(x, h - 6); ctx.lineTo(x + 8, h - 6); ctx.lineTo(x + 2, h); ctx.lineTo(x - 6, h); ctx.fill(); }
    ctx.restore();
    ctx.font = `9px ${MONO}`; ctx.fillStyle = hexa(INK, .7); ctx.textAlign = "right"; ctx.fillText("ODMOWA INTERNALIZACJI", w - 10, 16);
    label(ctx, w, h, "// strefa_ bez zgody", color);
  });
}

/* --- Linux: deszcz znaków -------------------------------------- */
function rain(canvas, color) {
  let cols = null;
  run(canvas, (ctx, w, h, t) => {
    const cw = 12; const n = Math.ceil(w / cw);
    if (!cols || cols.length !== n) cols = Array.from({ length: n }, () => ({ y: rnd(-h, 0), v: rnd(40, 140), ch: [] }));
    ctx.fillStyle = "rgba(5,5,5,.25)"; ctx.fillRect(0, 0, w, h);
    ctx.font = `11px ${MONO}`; ctx.textAlign = "center";
    cols.forEach((c, i) => {
      c.y += c.v / 60; if (c.y > h + 40) { c.y = rnd(-200, 0); c.v = rnd(40, 140); }
      const ch = Math.random() < .3 ? String.fromCharCode(0x30A0 + Math.random() * 96) : "0123456789ABCDEF$#@:~>"[Math.floor(Math.random() * 22)];
      ctx.fillStyle = INK; ctx.fillText(ch, i * cw + cw / 2, c.y);
      ctx.fillStyle = hexa(color, .8); ctx.fillText(ch, i * cw + cw / 2, c.y - 12);
    });
    ctx.fillStyle = "rgba(5,5,5,.6)"; ctx.fillRect(0, h - 22, 190, 22);
    ctx.font = `10px ${MONO}`; ctx.textAlign = "left"; ctx.fillStyle = color; ctx.fillText("emilia@legion:~$ " + (Math.floor(t * 2) % 2 ? "▌" : " "), 10, h - 8);
  });
}

/* --- Twórczość: dryfujące litery ------------------------------- */
function letters(canvas, color) {
  const ps = []; const src = "komu dane jest widzieć młodość ciało dokument liszajec xenosym corpus ";
  run(canvas, (ctx, w, h, t) => {
    ctx.clearRect(0, 0, w, h);
    if (ps.length < 90) ps.push({ x: rnd(0, w), y: h + 10, v: rnd(8, 26), ch: src[Math.floor(Math.random() * src.length)], s: rnd(9, 22), a: rnd(.2, .9), dx: rnd(-6, 6) });
    for (let i = ps.length - 1; i >= 0; i--) { const p = ps[i]; p.y -= p.v / 60; p.x += Math.sin(t + p.y * .02) * .2 + p.dx / 60; if (p.y < -20) { ps.splice(i, 1); continue; }
      ctx.font = `${p.s}px ${p.s > 16 ? "Orbitron, " : ""}${MONO}`; ctx.textAlign = "center"; ctx.fillStyle = hexa(p.s > 16 ? color : INK, p.a * Math.min(1, p.y / 40)); ctx.fillText(p.ch, p.x, p.y); }
    // linia "kartki"
    ctx.strokeStyle = hexa(color, .35); ctx.setLineDash([2, 6]); ctx.beginPath(); ctx.moveTo(0, h * .82); ctx.lineTo(w, h * .82); ctx.stroke(); ctx.setLineDash([]);
    const typed = "proza · proza poetycka"; const n = Math.floor((t * 6) % (typed.length + 14));
    ctx.font = `10px ${MONO}`; ctx.textAlign = "left"; ctx.fillStyle = color; ctx.fillText("// " + typed.slice(0, n) + (Math.floor(t * 2) % 2 ? "▌" : ""), 10, h - 8);
  });
}

/* --- Kultura: korektor + perforacja filmu ---------------------- */
function eq(canvas, color) {
  const bars = 48; const lv = new Array(bars).fill(0);
  run(canvas, (ctx, w, h, t) => {
    ctx.clearRect(0, 0, w, h);
    // perforacja
    ctx.fillStyle = hexa(INK, .18); const s = (t * 40) % 24;
    for (let x = -24 + s; x < w; x += 24) { ctx.fillRect(x, 4, 12, 8); ctx.fillRect(x, h - 12, 12, 8); }
    const bw = w / bars;
    for (let i = 0; i < bars; i++) { const target = (Math.sin(t * 3 + i * .5) * .5 + .5) * (Math.sin(t * .7 + i * .13) * .5 + .5) * .9 + Math.random() * .1; lv[i] += (target - lv[i]) * .15;
      const bh = lv[i] * (h - 36); ctx.fillStyle = i % 6 === 5 ? PINK : color; ctx.globalAlpha = .85; ctx.fillRect(i * bw + 1, h - 16 - bh, bw - 2, bh); ctx.globalAlpha = 1;
      ctx.fillStyle = INK; ctx.fillRect(i * bw + 1, h - 16 - bh - 2, bw - 2, 1); }
    label(ctx, w, h, "// odtwarzanie_ 215 tytułów", color);
  });
}

/* --- IVF: dzielące się komórki --------------------------------- */
function cells(canvas, color) {
  run(canvas, (ctx, w, h, t) => {
    ctx.clearRect(0, 0, w, h); grid(ctx, w, h, color, 20);
    const cx = w * .5, cy = h * .5, R = Math.min(w, h) * .3;
    const stage = (t * .35) % 4; // 0..4: 1, 2, 4, 8 komórek i od nowa
    const n = Math.pow(2, Math.floor(stage)); const k = stage - Math.floor(stage);
    ctx.strokeStyle = color; ctx.lineWidth = 1.2; ctx.fillStyle = hexa(color, .08);
    ctx.beginPath(); ctx.arc(cx, cy, R * 1.15, 0, 7); ctx.stroke(); // osłonka
    for (let i = 0; i < n; i++) { const ang = i / n * Math.PI * 2 + t * .2; const rr = n === 1 ? 0 : R * .55; const r = R / Math.sqrt(n) * .8;
      const x = cx + Math.cos(ang) * rr, y = cy + Math.sin(ang) * rr;
      // każda komórka wydłuża się przed podziałem
      ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.beginPath(); ctx.ellipse(0, 0, r * (1 + k * .35), r * (1 - k * .25), 0, 0, 7); ctx.fill(); ctx.stroke();
      if (k > .5) { ctx.beginPath(); ctx.moveTo(0, -r * (1 - k * .25)); ctx.lineTo(0, r * (1 - k * .25)); ctx.strokeStyle = hexa(INK, (k - .5) * 2); ctx.stroke(); }
      ctx.fillStyle = PINK; ctx.beginPath(); ctx.arc(k > .5 ? -r * .3 : 0, 0, 2.5, 0, 7); ctx.fill(); if (k > .5) { ctx.beginPath(); ctx.arc(r * .3, 0, 2.5, 0, 7); ctx.fill(); }
      ctx.restore(); ctx.strokeStyle = color; ctx.fillStyle = hexa(color, .08); }
    ctx.font = `10px ${MONO}`; ctx.textAlign = "right"; ctx.fillStyle = hexa(INK, .7); ctx.fillText(`${n}-komórkowy · dzień ${Math.floor(stage) + 1}`, w - 10, 16);
    label(ctx, w, h, "// hodowla_ ryga", color);
  });
}

/* --- Kosmetyki: cząsteczki ------------------------------------- */
function molecule(canvas, color) {
  const atoms = Array.from({ length: 14 }, () => ({ x: Math.random(), y: Math.random(), vx: rnd(-.05, .05), vy: rnd(-.05, .05), r: rnd(2, 5) }));
  run(canvas, (ctx, w, h, t) => {
    ctx.clearRect(0, 0, w, h); grid(ctx, w, h, color, 30);
    atoms.forEach(a => { a.x += a.vx / 60; a.y += a.vy / 60; if (a.x < 0 || a.x > 1) a.vx *= -1; if (a.y < 0 || a.y > 1) a.vy *= -1; });
    for (let i = 0; i < atoms.length; i++) for (let j = i + 1; j < atoms.length; j++) { const a = atoms[i], b = atoms[j]; const d = Math.hypot((a.x - b.x) * w, (a.y - b.y) * h); if (d < 110) { ctx.strokeStyle = hexa(color, (1 - d / 110) * .7); ctx.lineWidth = d < 60 ? 2 : 1; ctx.beginPath(); ctx.moveTo(a.x * w, a.y * h); ctx.lineTo(b.x * w, b.y * h); ctx.stroke(); } }
    atoms.forEach((a, i) => { ctx.fillStyle = i % 4 === 0 ? PINK : INK; ctx.beginPath(); ctx.arc(a.x * w, a.y * h, a.r, 0, 7); ctx.fill(); ctx.strokeStyle = hexa(color, .5); ctx.beginPath(); ctx.arc(a.x * w, a.y * h, a.r + 3 + Math.sin(t * 3 + i) * 1.5, 0, 7); ctx.stroke(); });
    ctx.font = `10px ${MONO}`; ctx.textAlign = "right"; ctx.fillStyle = hexa(INK, .7); ctx.fillText("C₁₈H₃₄O₂ · pH 5.5", w - 10, 16);
    label(ctx, w, h, "// skład_", color);
  });
}

/* --- Projekty: tunel z siatki ---------------------------------- */
function tunnel(canvas, color) {
  run(canvas, (ctx, w, h, t) => {
    ctx.clearRect(0, 0, w, h);
    const cx = w * .5, cy = h * .5; const N = 14; const z0 = (t * .6) % 1;
    ctx.lineWidth = 1;
    for (let i = 0; i < N; i++) { const z = (i + z0) / N; const s = Math.pow(z, 2.2); const rw = w * .5 * s + 4, rh = h * .5 * s + 2; ctx.strokeStyle = hexa(color, .15 + s * .8); ctx.strokeRect(cx - rw, cy - rh, rw * 2, rh * 2); }
    ctx.strokeStyle = hexa(color, .5); ctx.beginPath(); [[0, 0], [w, 0], [0, h], [w, h]].forEach(([x, y]) => { ctx.moveTo(cx, cy); ctx.lineTo(x, y); }); ctx.stroke();
    // światło na końcu
    ctx.fillStyle = hexa(INK, .5 + Math.sin(t * 4) * .3); ctx.fillRect(cx - 3, cy - 2, 6, 4);
    ctx.font = `10px ${MONO}`; ctx.textAlign = "right"; ctx.fillStyle = hexa(INK, .7); ctx.fillText("FREE ENTRANCE", w - 10, 16);
    label(ctx, w, h, "// wejście_ projekty", color);
  });
}

/* --- Start / O mnie: radar ------------------------------------- */
function radar(canvas, color) {
  const blips = Array.from({ length: 9 }, () => ({ a: rnd(0, 7), r: rnd(.2, .95), seen: 0 }));
  run(canvas, (ctx, w, h, t) => {
    ctx.clearRect(0, 0, w, h);
    const cx = w * .5, cy = h * .5, R = Math.min(w, h) * .46;
    ctx.strokeStyle = hexa(color, .3); ctx.lineWidth = 1;
    [.25, .5, .75, 1].forEach(k => { ctx.beginPath(); ctx.arc(cx, cy, R * k, 0, 7); ctx.stroke(); });
    ctx.beginPath(); ctx.moveTo(cx - R, cy); ctx.lineTo(cx + R, cy); ctx.moveTo(cx, cy - R); ctx.lineTo(cx, cy + R); ctx.stroke();
    const ang = t * 1.4; const g = ctx.createConicGradient ? ctx.createConicGradient(ang - 1.2, cx, cy) : null;
    if (g) { g.addColorStop(0, hexa(color, 0)); g.addColorStop(.19, hexa(color, .35)); g.addColorStop(.191, hexa(color, 0)); g.addColorStop(1, hexa(color, 0)); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, R, ang - 1.2, ang); ctx.fill(); }
    ctx.strokeStyle = color; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(ang) * R, cy + Math.sin(ang) * R); ctx.stroke();
    blips.forEach(b => { const d = ((ang - b.a) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2); if (d < .05) b.seen = t; const age = t - b.seen; if (age < 3) { ctx.fillStyle = hexa(age < .3 ? INK : PINK, 1 - age / 3); ctx.beginPath(); ctx.arc(cx + Math.cos(b.a) * R * b.r, cy + Math.sin(b.a) * R * b.r, 2.5, 0, 7); ctx.fill(); } });
    label(ctx, w, h, "// skan_ trójmiasto", color);
  });
}

const SECTION_FX = { Terapia: ekg, RPG: d20, IdPol: wire, Linux: rain, poems: letters, Kultura: eq, IVF: cells, Kosmetyki: molecule, Projekty: tunnel, Ja: radar, "(root)": radar };
window.SectionFX = { run: (section, canvas, color) => { const f = SECTION_FX[section] || radar; f(canvas, color || ACID); }, has: s => !!SECTION_FX[s] };
})();
