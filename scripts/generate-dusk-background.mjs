// One-off generator for the "Crepúsculo jurásico" page backdrop.
// Writes public/bg-dusk-landscape.svg (1440x900) and public/bg-dusk-portrait.svg (900x1600).
// No API key needed — pure geometry, seeded so output is deterministic.
//   node scripts/generate-dusk-background.mjs
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const publicDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Midpoint-displacement ridge line, closed down to the bottom edge.
function ridge(W, H, seed, baseY, amp, roughness = 0.55) {
  const r = rng(seed);
  const n = 64;
  const pts = new Array(n + 1).fill(0);
  const rec = (l, h, a) => {
    if (h - l < 2) return;
    const m = (l + h) >> 1;
    pts[m] = (pts[l] + pts[h]) / 2 + (r() - 0.5) * a;
    rec(l, m, a * roughness);
    rec(m, h, a * roughness);
  };
  pts[0] = (r() - 0.5) * amp;
  pts[n] = (r() - 0.5) * amp;
  rec(0, n, amp);
  let d = '';
  for (let i = 0; i <= n; i++) d += `${i === 0 ? 'M' : 'L'}${((i / n) * W).toFixed(0)},${(baseY + pts[i]).toFixed(0)}`;
  return d + `L${W},${H + 10}L0,${H + 10}Z`;
}

// Cycad: curved trunk + drooping fronds with paired leaflets, all one stroked path.
function cycad(x, y, h, lean, seed) {
  const r = rng(seed);
  const topX = x + lean;
  const topY = y - h;
  let d = `M${x},${y}Q${(x + lean * 0.2).toFixed(0)},${(y - h * 0.5).toFixed(0)} ${topX.toFixed(0)},${topY.toFixed(0)}`;
  const fronds = 9;
  for (let f = 0; f < fronds; f++) {
    const ang = -Math.PI + (f / (fronds - 1)) * Math.PI + (r() - 0.5) * 0.25;
    const len = h * (0.55 + r() * 0.35);
    const ex = topX + Math.cos(ang) * len;
    const ey = topY + Math.sin(ang) * len * 0.55 + len * 0.45;
    const cx = topX + Math.cos(ang) * len * 0.55;
    const cy = topY + Math.sin(ang) * len * 0.8 - len * 0.12;
    d += `M${topX.toFixed(0)},${topY.toFixed(0)}Q${cx.toFixed(0)},${cy.toFixed(0)} ${ex.toFixed(0)},${ey.toFixed(0)}`;
    const leaflets = 14;
    for (let k = 2; k < leaflets; k++) {
      const t = k / leaflets;
      const px = (1 - t) * (1 - t) * topX + 2 * (1 - t) * t * cx + t * t * ex;
      const py = (1 - t) * (1 - t) * topY + 2 * (1 - t) * t * cy + t * t * ey;
      const tx = 2 * (1 - t) * (cx - topX) + 2 * t * (ex - cx);
      const ty = 2 * (1 - t) * (cy - topY) + 2 * t * (ey - cy);
      const tl = Math.hypot(tx, ty) || 1;
      const nx = -ty / tl;
      const ny = tx / tl;
      const ll = (1 - t * 0.7) * len * 0.16;
      const fx = (tx / tl) * ll * 0.6;
      const fy = (ty / tl) * ll * 0.6;
      d += `M${px.toFixed(0)},${py.toFixed(0)}l${(nx * ll + fx).toFixed(0)},${(ny * ll + fy).toFixed(0)}`;
      d += `M${px.toFixed(0)},${py.toFixed(0)}l${(-nx * ll + fx).toFixed(0)},${(-ny * ll + fy).toFixed(0)}`;
    }
  }
  return d;
}

const PTERO =
  'M0,0C-10,-9 -28,-9 -46,-1C-30,-4 -15,1 -5,7L-2,16L0,9L2,16L5,7C15,1 30,-4 46,-1C28,-9 10,-9 0,0Z';

function build(cfg) {
  const { W, H } = cfg;
  const r = rng(9);
  let stars = '';
  for (let i = 0; i < cfg.stars; i++) {
    const x = (r() * W).toFixed(0);
    const y = (r() * H * 0.55).toFixed(0);
    const big = r() < 0.12;
    const o = (0.25 + r() * 0.6).toFixed(2);
    stars += `<circle cx="${x}" cy="${y}" r="${big ? 1.8 : 0.9}" opacity="${o}"/>`;
  }
  const vx = 1080; // volcano is authored in 1440x900 space, then placed by transform
  const volcano = `
<g transform="${cfg.volcanoTransform}">
<ellipse cx="${vx}" cy="470" rx="90" ry="110" fill="#3a1048" opacity=".55" filter="url(#b14)"/>
<ellipse cx="${vx + 30}" cy="400" rx="70" ry="80" fill="#3a1048" opacity=".4" filter="url(#b14)"/>
<path d="M${vx - 420},900L${vx - 120},560L${vx - 52},520L${vx - 26},536L${vx - 8},512L${vx + 18},538L${vx + 44},520L${vx + 120},570L${vx + 430},900Z" fill="#2e0b3d"/>
<ellipse cx="${vx - 6}" cy="520" rx="70" ry="22" fill="url(#lava)"/>
<path d="M${vx - 14},536Q${vx - 40},610 ${vx - 90},690M${vx + 6},538Q${vx + 24},620 ${vx + 70},700" stroke="#ff6a4a" stroke-opacity=".55" stroke-width="3" fill="none" filter="url(#b3)"/>
</g>`;
  const ptero = cfg.pteros
    .map((p) => `<path d="${PTERO}" transform="translate(${p.x} ${p.y}) rotate(${p.rot}) scale(${p.s})"/>`)
    .join('');
  const cycads = cfg.cycads
    .map((c) => `<path d="${cycad(c.x, H + 5, c.h, c.lean, c.seed)}" stroke-width="${c.w}"/>`)
    .join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMax slice">
<defs>
<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#12062a"/><stop offset=".38" stop-color="#2a0b47"/><stop offset=".62" stop-color="#6d1459"/><stop offset=".82" stop-color="#c2236f"/><stop offset="1" stop-color="#ff7a6e"/></linearGradient>
<radialGradient id="lava"><stop offset="0" stop-color="#ffb347" stop-opacity=".95"/><stop offset=".35" stop-color="#ff5a3c" stop-opacity=".5"/><stop offset="1" stop-color="#ff3d7a" stop-opacity="0"/></radialGradient>
<radialGradient id="vig" cx=".5" cy=".42" r=".55"><stop offset="0" stop-color="#12062a" stop-opacity=".55"/><stop offset="1" stop-color="#12062a" stop-opacity="0"/></radialGradient>
<filter id="b14"><feGaussianBlur stdDeviation="14"/></filter>
<filter id="b3"><feGaussianBlur stdDeviation="2.2"/></filter>
</defs>
<rect width="${W}" height="${H}" fill="url(#sky)"/>
<g fill="#ffe9f5">${stars}</g>
<circle cx="${cfg.moon.x}" cy="${cfg.moon.y}" r="${cfg.moon.r * 1.63}" fill="#ff9fd0" opacity=".1" filter="url(#b14)"/>
<circle cx="${cfg.moon.x}" cy="${cfg.moon.y}" r="${cfg.moon.r}" fill="#ffd9ec" opacity=".3"/>
<circle cx="${cfg.moon.x - cfg.moon.r * 0.26}" cy="${cfg.moon.y - cfg.moon.r * 0.26}" r="${cfg.moon.r * 0.15}" fill="#c98ab3" opacity=".18"/>
<circle cx="${cfg.moon.x + cfg.moon.r * 0.37}" cy="${cfg.moon.y + cfg.moon.r * 0.28}" r="${cfg.moon.r * 0.24}" fill="#c98ab3" opacity=".14"/>
<path d="${ridge(W, H, 5, cfg.ridges[0].y, cfg.ridges[0].a)}" fill="#6a1456" opacity=".9"/>
${volcano}
<path d="${ridge(W, H, 21, cfg.ridges[1].y, cfg.ridges[1].a)}" fill="#3a0f48"/>
<path d="${ridge(W, H, 33, cfg.ridges[2].y, cfg.ridges[2].a)}" fill="#1f0832"/>
<g fill="#1a0630" opacity=".9">${ptero}</g>
<g stroke="#10041d" stroke-linecap="round" fill="none">${cycads}</g>
<rect width="${W}" height="${H}" fill="url(#vig)"/>
</svg>
`;
}

const landscape = build({
  W: 1440,
  H: 900,
  stars: 90,
  moon: { x: 250, y: 250, r: 92 },
  ridges: [
    { y: 640, a: 70 },
    { y: 730, a: 56 },
    { y: 810, a: 40 },
  ],
  volcanoTransform: '',
  pteros: [
    { x: 330, y: 430, rot: -10, s: 0.9 },
    { x: 410, y: 480, rot: 4, s: 0.5 },
    { x: 1130, y: 250, rot: -14, s: 0.75 },
  ],
  cycads: [
    { x: 80, h: 330, lean: 30, seed: 7, w: 5 },
    { x: 210, h: 200, lean: -20, seed: 11, w: 3 },
    { x: 1360, h: 360, lean: -28, seed: 13, w: 5 },
    { x: 1250, h: 210, lean: 24, seed: 19, w: 3 },
  ],
});

// Portrait: same scene recomposed for phones (otherwise `cover` would crop to the
// middle slice and lose the volcano and the cycads at the edges). Volcano group
// is scaled 1.5x and its base (1080,900) pinned to (560,1600).
const portrait = build({
  W: 900,
  H: 1600,
  stars: 80,
  moon: { x: 190, y: 330, r: 100 },
  ridges: [
    { y: 1136, a: 90 },
    { y: 1296, a: 70 },
    { y: 1440, a: 50 },
  ],
  volcanoTransform: 'translate(-1060 250) scale(1.5)',
  pteros: [
    { x: 640, y: 560, rot: -10, s: 1.1 },
    { x: 730, y: 620, rot: 4, s: 0.6 },
    { x: 220, y: 900, rot: -14, s: 0.9 },
  ],
  cycads: [
    { x: 60, h: 520, lean: 40, seed: 7, w: 6 },
    { x: 200, h: 320, lean: -25, seed: 11, w: 4 },
    { x: 850, h: 560, lean: -40, seed: 13, w: 6 },
    { x: 720, h: 340, lean: 30, seed: 19, w: 4 },
  ],
});

writeFileSync(join(publicDir, 'bg-dusk-landscape.svg'), landscape);
writeFileSync(join(publicDir, 'bg-dusk-portrait.svg'), portrait);
console.log('landscape', (landscape.length / 1024).toFixed(1), 'KB; portrait', (portrait.length / 1024).toFixed(1), 'KB');
