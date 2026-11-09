'use strict';

/* ============ Markenwerte (design.gruene.de) ============ */
const COLORS = {
  tanne: '#005538', klee: '#008939', grashalm: '#8ABD24',
  himmel: '#0BA1DD', sand: '#F5F1E9', sonne: '#FFF17A',
};
const COLOR_LABEL = { tanne: 'Tanne', klee: 'Klee', grashalm: 'Grashalm', himmel: 'Himmel', sand: 'Sand', sonne: 'Sonne' };
const DARK = new Set(['tanne', 'klee', 'himmel']);
const SIZE_MULT = { S: 0.6, M: 0.8, L: 1, XL: 1.25 };
const SCHEMES = {
  tanne:  { label: 'Tanne / Sand',  bar: 'tanne',  text: 'sand',  subBar: 'sand',  subText: 'tanne' },
  sand:   { label: 'Sand / Tanne',  bar: 'sand',   text: 'tanne', subBar: 'tanne', subText: 'sand' },
  sonne:  { label: 'Sonne / Tanne', bar: 'sonne',  text: 'tanne', subBar: 'tanne', subText: 'sonne' },
  klee:   { label: 'Klee / Sand',   bar: 'klee',   text: 'sand',  subBar: 'tanne', subText: 'sand' },
  himmel: { label: 'Himmel / Sand', bar: 'himmel', text: 'sand',  subBar: 'tanne', subText: 'sand' },
};

/* Farben: Marken-Schlüssel (tanne, klee …) oder eigene Hex-Werte */
const colorOf = k => COLORS[k] || (typeof k === 'string' && /^#[0-9a-f]{6}$/i.test(k) ? k : COLORS.klee);
function lum(k) {
  const n = parseInt(colorOf(k).slice(1), 16);
  const [r, g, b] = [n >> 16, (n >> 8) & 255, n & 255].map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const isDarkColor = k => (COLORS[k] ? DARK.has(k) : lum(k) < 0.28);
function getScheme(key) {
  if (SCHEMES[key]) return SCHEMES[key];
  const c = (typeof P !== 'undefined' && P.customSchemes || []).find(x => x.id === key);
  return c ? { label: 'Eigene', bar: c.bar, text: c.text, subBar: c.text, subText: c.bar } : SCHEMES.tanne;
}
const OVERLAY_COLORS = ['tanne', '#000000', 'klee', 'himmel'];
let SHADOW = null; // Schlagschatten der aktuell gerenderten Slide
const mkShadow = (sh, u) => (sh > 0 ? { color: `rgba(0,20,12,${0.25 + 0.45 * sh})`, blur: (8 + 34 * sh) * u, oy: (2 + 10 * sh) * u } : null);
const hasOwn = v => v !== undefined && v !== null && v !== '';
function applyShadow(ctx) {
  if (!SHADOW) return;
  ctx.shadowColor = SHADOW.color; ctx.shadowBlur = SHADOW.blur; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = SHADOW.oy;
}
function clearShadow(ctx) { ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0; }

/* Durchgehende Verlaufs-Hintergründe fürs Karussell */
const FLOWS = {
  gruen:  { label: 'Grün',   base: '#00402a', dark: true,  colors: ['#008939', '#8ABD24', '#0BA1DD', '#005538', '#FFF17A'] },
  himmel: { label: 'Himmel', base: '#005538', dark: true,  colors: ['#0BA1DD', '#008939', '#F5F1E9', '#0BA1DD', '#8ABD24'] },
  sonne:  { label: 'Sonne',  base: '#008939', dark: true,  colors: ['#FFF17A', '#8ABD24', '#005538', '#0BA1DD', '#FFF17A'] },
  bayern: { label: 'Bayern', base: '#00402a', dark: true,  colors: ['#0BA1DD', '#F5F1E9', '#0BA1DD', '#008939', '#FFFFFF'] },
  sand:   { label: 'Sand',   base: '#F5F1E9', dark: false, colors: ['#FFF17A', '#8ABD24', '#0BA1DD', '#FFF17A', '#008939'], alpha: 0.55 },
  pride:  { label: 'Pride',  base: '#00301f', dark: true,  colors: ['#E40303', '#FF8C00', '#FFED00', '#008026', '#24408E', '#732982', '#5BCEFA', '#F5A9B8'] },
};

/* ============ Formate (Stand 2026) ============ */
const FORMATS = {
  ig45:  { w: 1080, h: 1350, group: 'Instagram & Facebook Feed', label: 'Hochformat 4:5 · 1080×1350',
           hint: 'Standard für Feed-Posts und Karussells auf Instagram und Facebook.' },
  ig34:  { w: 1080, h: 1440, group: 'Instagram & Facebook Feed', label: 'Hochformat 3:4 · 1080×1440',
           hint: 'Passt exakt ins hochformatige Profilraster von Instagram – nichts wird abgeschnitten.' },
  sq:    { w: 1080, h: 1080, group: 'Instagram & Facebook Feed', label: 'Quadrat 1:1 · 1080×1080',
           hint: 'Klassisches Format, z. B. für Facebook-Karussells.' },
  story: { w: 1080, h: 1920, group: 'Hochkant 9:16', label: 'Story / Reel / TikTok · 1080×1920',
           hint: 'Für Instagram- & Facebook-Stories und TikTok-Fotokarussells.',
           safe: { t: 220, b: 340, l: 0, r: 120 } },
  thumb: { w: 1080, h: 1920, group: 'Hochkant 9:16', label: 'Reel-/TikTok-Thumbnail · 1080×1920',
           hint: 'Titelbild für Reels und TikToks – wichtige Inhalte bleiben im Profilraster sichtbar.',
           safe: { t: 250, b: 420, l: 0, r: 130 } },
  fb:    { w: 1200, h: 630,  group: 'Querformat', label: 'Facebook Link / Quer 1,91:1 · 1200×630',
           hint: 'Für Link-Vorschauen und Querformat-Posts auf Facebook.' },
};
/* Druckformate (Plakat-Tab): 300 dpi, optional 3 mm Beschnitt.
   Pixelfläche wird auf ~16,5 MP begrenzt, damit der Export in allen Browsern (auch Safari) klappt. */
const PRINT = { a6: [105, 148], a5: [148, 210], a4: [210, 297], a3: [297, 420], a2: [420, 594], a1: [594, 841] };
for (const [k, [w, h]] of Object.entries(PRINT)) {
  FORMATS[k] = { group: 'Druck', label: `DIN ${k.toUpperCase()} · ${w} × ${h} mm`, print: { w, h } };
}
const PRINT_DPI = 300, MAX_PX = 16.5e6, BLEED_MM = 3;
let MODE = 'social'; // 'social' | 'poster'
const isFormatFor = (k, mode) => !!FORMATS[k] && (mode === 'poster' ? !!FORMATS[k].print : !FORMATS[k].print);
function fmt() {
  const f = FORMATS[P.format] || FORMATS.ig45;
  if (!f.print) return f;
  const bleed = P.bleed ? BLEED_MM : 0;
  const mmW = f.print.w + 2 * bleed, mmH = f.print.h + 2 * bleed;
  let w = mmW / 25.4 * PRINT_DPI, h = mmH / 25.4 * PRINT_DPI;
  const sc = Math.min(1, Math.sqrt(MAX_PX / (w * h)));
  w = Math.round(w * sc); h = Math.round(h * sc);
  const b = bleed / 25.4 * PRINT_DPI * sc;
  return { ...f, w, h, mmW, mmH, dpi: Math.round(PRINT_DPI * sc), safe: b ? { t: b, b, l: b, r: b } : null, forceSafe: true };
}

/* ============ Helfer ============ */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const getPath = (o, p) => p.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
function setPath(o, p, v) {
  const ks = p.split('.'); let t = o;
  for (let i = 0; i < ks.length - 1; i++) { if (t[ks[i]] == null) t[ks[i]] = {}; t = t[ks[i]]; }
  t[ks[ks.length - 1]] = v;
}
function merge(base, over) {
  for (const k in over) {
    if (over[k] && typeof over[k] === 'object' && !Array.isArray(over[k]) && base[k] && typeof base[k] === 'object') merge(base[k], over[k]);
    else base[k] = over[k];
  }
  return base;
}
function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
}
function toast(msg, ms = 2600) {
  const t = $('#toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toast._t); toast._t = setTimeout(() => (t.hidden = true), ms);
}

/* ============ Datenmodell ============ */
let uid = 1;
function newSlide(over = {}) {
  return merge({
    id: 's' + Date.now().toString(36) + (uid++),
    layout: 'balken', headline: '', sub: '', body: '', number: '',
    scheme: 'tanne', size: 1, angle: -3, posY: 'bottom', align: 'left',
    bg: { type: 'color', color: 'klee', color2: null, dir: 'down', src: null, zoom: 1, x: 0.5, y: 0.5, overlay: 0.45, ovColor: 'tanne', ovMode: 'auto' },
    shadow: 0, font: 'gt',
    stoerer: { on: false, text: 'Jetzt\nmitmachen!', pos: 'tr', size: 1 },
    showLogo: true, showAbsender: true,
    emojis: [], off: { x: 0, y: 0 }, el: {}, items: [], lineStyle: [], subStyle: {},
    event: { date: '', from: '', to: '', place: '', address: '', hint: '', qr: '', people: [] },
  }, JSON.parse(JSON.stringify(over)));
}
function isoInDays(d) { const t = new Date(Date.now() + d * 864e5); return t.toISOString().slice(0, 10); }
const LOGO_FRAKTION = 'assets/logo-fraktion-bayern.png';
function logoSrc() {
  if (P.logo.choice === 'none') return null;
  if (P.logo.choice === 'custom') return P.logo.src || null;
  return LOGO_FRAKTION;
}
function defaultPoster() {
  return Object.assign(defaultProject('social'), {
    mode: 'poster', format: 'a3', numbering: false, swipe: false, bleed: false,
    slides: [
      newSlide({
        layout: 'event', headline: 'Grüne Ideen\nfür unsere Region', sub: 'Diskussionsabend', posY: 'top', angle: -3,
        scheme: 'tanne', bg: { type: 'flow', color: 'klee' },
        body: 'Wir sprechen über Mobilität, Klimaschutz und gutes Leben vor Ort – und freuen uns auf Ihre Fragen und Ideen.',
        stoerer: { on: true, text: 'Eintritt\nfrei', pos: 'tr' },
        event: {
          date: isoInDays(14), from: '19:00', to: '21:00', place: 'Veranstaltungsort', address: 'Straße 1, 12345 Ort',
          hint: 'Alle sind herzlich willkommen!', qr: '',
          people: [{ name: 'Vorname Nachname', role: 'Funktion', src: null }, { name: 'Vorname Nachname', role: 'Funktion', src: null }],
        },
      }),
    ],
  });
}
function defaultProject(mode = 'social') {
  if (mode === 'poster') return defaultPoster();
  return {
    v: 2, mode: 'social', format: 'ig45', absender: 'Vorname Nachname', numbering: true, swipe: true, useSafe: true,
    logo: { choice: 'fraktion', src: null, pos: 'br', size: 0.16 },
    abs: { on: true, size: 1, pos: 'bl', font: 'gt' },
    customSchemes: [], customColors: [],
    panorama: { src: null, zoom: 1, x: 0.5, y: 0.5 },
    flow: { palette: 'gruen', seed: 1, soft: 0.6, grain: 0.5 },
    slides: [
      newSlide({ layout: 'balken', headline: 'Mehr Bus.\nMehr Bahn.', sub: 'Für unseren Landkreis', scheme: 'tanne',
                 bg: { type: 'flow', color: 'klee' }, stoerer: { on: true },
                 emojis: [{ ch: '🚆', x: 0.2, y: 0.22, size: 0.2, rot: -8 }] }),
      newSlide({ layout: 'liste', headline: 'Das packen\nwir an', angle: 0, posY: 'top', scheme: 'sonne',
                 body: 'Alle 15 Minuten ein Bus – auch auf dem Land\nSichere Radwege zu allen Schulen\nGünstiges Ticket für Azubis und Studis',
                 bg: { type: 'flow', color: 'tanne' } }),
      newSlide({ layout: 'zahl', number: '15', headline: 'Minuten', sub: 'Takt für alle Ortsteile', posY: 'middle',
                 body: 'Hier ist Platz für eine kurze Erklärung, warum diese Zahl wichtig ist.', bg: { type: 'flow', color: 'sand' } }),
      newSlide({ layout: 'zitat', headline: 'Gute Politik fängt vor der eigenen Haustür an.', sub: 'Vorname Nachname',
                 body: 'Funktion · Ort', scheme: 'sonne', bg: { type: 'flow', color: 'klee' } }),
    ],
  };
}

const STORE_KEYS = { social: 'sharepic-social-v2', poster: 'sharepic-poster-v1' };
// Einmalige Übernahme von Projekten, die unter früheren Speicher-Namen abgelegt wurden
try {
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k || !k.startsWith('sharepic-') || Object.values(STORE_KEYS).includes(k)) continue;
    const target = /poster-v1$/.test(k) ? STORE_KEYS.poster : /-v2$/.test(k) ? STORE_KEYS.social : null;
    if (target && !localStorage.getItem(target)) localStorage.setItem(target, localStorage.getItem(k));
  }
} catch { /* Speicher nicht verfügbar */ }
const MODE_KEY = 'sharepic-mode';
const FONT_KEY = 'sharepic-font-v1';
function loadProject(mode) {
  try {
    const raw = localStorage.getItem(STORE_KEYS[mode]);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (!p || !Array.isArray(p.slides) || !p.slides.length) return null;
    return normalize(p, mode);
  } catch { return null; }
}
function normalize(p, mode = 'social') {
  const d = defaultProject(mode);
  const out = merge(d, { ...p, slides: [] });
  out.mode = mode;
  out.slides = p.slides.map(s => newSlide(s));
  out.slides.forEach(s => { if (!Array.isArray(s.emojis)) s.emojis = []; if (!Array.isArray(s.event.people)) s.event.people = []; });
  if (!isFormatFor(out.format, mode)) out.format = mode === 'poster' ? 'a3' : 'ig45';
  if (!p.logo || !p.logo.choice) out.logo.choice = (p.logo && p.logo.src) ? 'custom' : 'fraktion';
  if (typeof p.showSafe === 'boolean' && typeof p.useSafe !== 'boolean') out.useSafe = p.showSafe;
  delete out.showSafe;
  return out;
}

try { MODE = localStorage.getItem(MODE_KEY) === 'poster' ? 'poster' : 'social'; } catch {}
let P = loadProject(MODE) || defaultProject(MODE);
let cur = 0;
let selEmoji = -1;
let stoererSel = false;
let selElKey = null; // gewähltes Layout-Element (head, body, info …)
let selItem = -1;    // gewähltes Zusatz-Element
let elSel = null; // 'logo' | 'abs'
const slide = () => P.slides[cur];
const EMOJI_SET = ['🌻','💚','🌍','🌱','🌳','☀️','⚡','💧','🚲','🚆','🚌','🏡','🏫','🎓','👨‍👩‍👧','🤝',
  '✊','📣','🗳️','✅','❌','❗','❓','👉','👇','🔥','💡','📍','📅','⏰','🎉','👏',
  '❤️','😊','💪','🌈','🐝','🦋','⛰️','🥨'];

/* ============ Schriften ============ */
const fontState = { uploaded: false, installed: null };
const FONT_CANDIDATES = ['GrueneType Neue', 'GrueneTypeNeue', 'GrueneType Neue Black', 'GrueneTypeNeue-Black', 'GrueneType', 'GrueneType Black'];
function isInstalled(name) {
  const c = document.createElement('canvas').getContext('2d');
  const t = 'Wahlkampf 2026 – HHHgjü';
  return ['monospace', 'serif'].some(b => {
    c.font = `72px ${b}`; const a = c.measureText(t).width;
    c.font = `72px "${name}", ${b}`; return Math.abs(c.measureText(t).width - a) > 0.5;
  });
}
function detectInstalledFont() {
  fontState.installed = FONT_CANDIDATES.find(isInstalled) || null;
}
function hspec() {
  if (fontState.uploaded) return { fam: '"GrueneUpload"', pre: '' };
  if (fontState.installed) return { fam: `"${fontState.installed}"`, pre: '' };
  return { fam: '"Barlow Condensed"', pre: 'italic 800' };
}
const EMOJI_FONTS = '"Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji"';
let FACE = 'gt'; // 'gt' = GrueneType Neue, 'pt' = PT Sans Bold – wird pro Element beim Rendern gesetzt
const hfont = px => {
  if (FACE === 'pt') return `700 ${px}px "PT Sans", ${EMOJI_FONTS}, sans-serif`;
  const s = hspec(); return `${s.pre} ${px}px ${s.fam}, "Barlow Condensed", ${EMOJI_FONTS}, sans-serif`.trim();
};
const bfont = (px, bold) => `${bold ? '700 ' : ''}${px}px "PT Sans", ${EMOJI_FONTS}, sans-serif`;

async function loadFontBuffer(buf) {
  const ff = new FontFace('GrueneUpload', buf);
  await ff.load();
  document.fonts.add(ff);
  fontState.uploaded = true;
}
function bufToB64(buf) {
  const bytes = new Uint8Array(buf); let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
function b64ToBuf(b64) {
  const s = atob(b64); const b = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i);
  return b.buffer;
}

/* ============ Bilder ============ */
const imgCache = new Map();
function getImg(src) {
  if (!src) return null;
  let im = imgCache.get(src);
  if (!im) {
    im = new Image();
    if (/^https?:/.test(src)) im.crossOrigin = 'anonymous';
    im.onload = () => { scheduleRender(); scheduleThumbs(); };
    im.src = src; imgCache.set(src, im);
  }
  return im.complete && im.naturalWidth ? im : null;
}
function readImage(file, { max = 2400, alpha = false } = {}) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file);
    const im = new Image();
    im.onload = () => {
      const w = im.naturalWidth || 1200, h = im.naturalHeight || 1200;
      const sc = Math.min(1, max / Math.max(w, h));
      const c = document.createElement('canvas');
      c.width = Math.round(w * sc); c.height = Math.round(h * sc);
      c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      res(c.toDataURL(alpha ? 'image/png' : 'image/jpeg', 0.9));
    };
    im.onerror = () => { URL.revokeObjectURL(url); rej(new Error('Bild konnte nicht gelesen werden.')); };
    im.src = url;
  });
}

/* ============ Zeichen-Bausteine ============ */
function fitFont(ctx, texts, fs, maxW, padRatio, fontFn) {
  let f = fs;
  for (let k = 0; k < 4; k++) {
    ctx.font = fontFn(f);
    const mw = Math.max(0, ...texts.map(t => ctx.measureText(t).width)) + 2 * padRatio * f;
    if (mw <= maxW) break;
    f *= (maxW / mw) * 0.995;
  }
  return f;
}
function capOf(ctx) { return ctx.measureText('H').actualBoundingBoxAscent; }

/* Headline-Balken: jede Zeile ein Balken, optional kleinerer Unterzeilen-Balken */
function barsBlock(ctx, o) {
  const sc = getScheme(o.scheme);
  const up = o.upper !== false;
  const lines = o.lines.map(l => l.trim()).filter(Boolean).map(l => (up ? l.toUpperCase() : l));
  const subRaw = (o.sub || '').trim();
  const sub = up ? subRaw.toUpperCase() : subRaw;
  const rows = [];
  const maxW = o.maxW * 0.97;
  // Breite nach tatsächlicher Buchstabenkante (nicht Laufweite) -> gleichmäßiger Rand links/rechts
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; // Messung hängt von der Ausrichtung ab
  const ink = t => { const m = ctx.measureText(t); return { L: m.actualBoundingBoxLeft, w: m.actualBoundingBoxLeft + m.actualBoundingBoxRight }; };
  if (lines.length) {
    // gemeinsame Grundgröße, dann pro Zeile Größen-Stufe, Farbschema und Einrückung
    const F = fitFont(ctx, lines, o.fs, maxW, 0.22, hfont);
    lines.forEach((t, i) => {
      const ls = (o.lineStyles && o.lineStyles[i]) || {};
      const lsc = ls.scheme ? getScheme(ls.scheme) : sc;
      const Fi = fitFont(ctx, [t], F * (SIZE_MULT[ls.size] || 1), maxW, 0.22, hfont);
      ctx.font = hfont(Fi); const cap = capOf(ctx); const pad = Fi * 0.22; const k = ink(t);
      rows.push({ t, F: Fi, cap, pad, L: k.L, w: k.w + 2 * pad, h: cap + Fi * 0.4, bar: lsc.bar, col: lsc.text, indent: ls.indent || 0 });
    });
  }
  if (sub) {
    const indent = (lines.length && o.align !== 'center') ? o.subFs * 0.8 : 0;
    const ss = o.subStyle || {};
    const SF = fitFont(ctx, [sub], o.subFs * (SIZE_MULT[ss.size] || 1), maxW - indent, 0.3, hfont);
    ctx.font = hfont(SF); const cap = capOf(ctx); const pad = SF * 0.3; const k = ink(sub);
    let subBar = sc.subBar, subCol = sc.subText;
    if (ss.scheme) { const x = getScheme(ss.scheme); subBar = x.bar; subCol = x.text; }
    // Unterzeilen-Balken darf nicht mit dem Hintergrund verschmelzen
    else if (o.bgKey && colorOf(subBar).toLowerCase() === colorOf(o.bgKey).toLowerCase()) {
      const d = isDarkColor(o.bgKey); subBar = d ? 'sand' : 'klee'; subCol = d ? 'tanne' : 'sand';
    }
    rows.push({ t: sub, F: SF, cap, pad, L: k.L, w: k.w + 2 * pad, h: cap + SF * 0.6, bar: subBar, col: subCol, sub: true, ind: indent, indent: ss.indent || 0 });
  }
  if (!rows.length) return null;
  const gap = rows[0].F * 0.035;
  let H = 0;
  rows.forEach((r, i) => { if (i) H += r.sub ? rows[0].F * 0.09 : gap; H += r.h; });
  let y = o.anchor === 'bottom' ? -H : o.anchor === 'middle' ? -H / 2 : 0;
  rows.forEach((r, i) => {
    if (i) y += r.sub ? rows[0].F * 0.09 : gap;
    const base = r.ind || 0;
    r.x = o.align === 'center' ? -r.w / 2 + (r.indent || 0) * (maxW - r.w) / 2 : base + (r.indent || 0) * Math.max(0, maxW - r.w - base);
    r.y = y; y += r.h;
  });
  const a = o.angle * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a);
  const bb = { l: Infinity, t: Infinity, r: -Infinity, b: -Infinity };
  for (const r of rows) {
    for (const [px, py] of [[r.x, r.y], [r.x + r.w, r.y], [r.x, r.y + r.h], [r.x + r.w, r.y + r.h]]) {
      const X = o.x + px * ca - py * sa, Y = o.y + px * sa + py * ca;
      bb.l = Math.min(bb.l, X); bb.r = Math.max(bb.r, X); bb.t = Math.min(bb.t, Y); bb.b = Math.max(bb.b, Y);
    }
  }
  if (!o.dry) {
    ctx.save(); ctx.translate(o.x, o.y); ctx.rotate(a);
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    for (const r of rows) {
      applyShadow(ctx);
      ctx.fillStyle = colorOf(r.bar); ctx.fillRect(r.x, r.y, r.w, r.h + 0.5);
      clearShadow(ctx); // Schatten nur unter dem Balken, nicht unter der Schrift darin
      ctx.font = hfont(r.F); ctx.fillStyle = colorOf(r.col);
      ctx.fillText(r.t, r.x + r.pad + r.L, r.y + r.h / 2 + r.cap / 2);
    }
    ctx.restore();
  }
  return bb;
}

// mode: '' = automatisch, 'hyph' = mit Silbentrennung, 'manual' = nur eigene Zeilenumbrüche
function wrapLines(ctx, text, maxW, mode = '') {
  const out = [];
  for (const para of text.split('\n')) {
    if (!para.trim()) { out.push(''); continue; }
    if (mode === 'manual') { out.push(para.trim()); continue; }
    if (mode === 'hyph') { out.push(...wrapHyph(ctx, para.trim(), maxW)); continue; }
    let line = '';
    for (const w of para.trim().split(/\s+/)) {
      const t = line ? line + ' ' + w : w;
      if (ctx.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t;
    }
    out.push(line);
  }
  return out;
}

/* Schrift für Fließtext-Elemente: PT Sans (Standard) oder GrueneType Neue, wenn am Element so eingestellt */
let BFACE = 'pt';
const tfont = (px, bold) => {
  if (BFACE !== 'gt') return bfont(px, bold);
  const p = FACE; FACE = 'gt'; const r = hfont(px); FACE = p; return r;
};

/* Stack-Items: { key, h, gap, ext?, draw(top) } */
function barsItem(ctx, o) {
  const dry = barsBlock(ctx, { ...o, y: 0, anchor: 'top', dry: true });
  if (!dry) return null;
  return { h: dry.b - dry.t, gap: o.gap || 0, ext: [dry.l, dry.r], draw: top => barsBlock(ctx, { ...o, y: top - dry.t, anchor: 'top' }) };
}
function textItem(ctx, o) {
  if (!o.text || !o.text.trim()) return null;
  const font = o.fontFn ? o.fontFn(o.f) : tfont(o.f, o.bold);
  ctx.font = font;
  const lines = wrapLines(ctx, o.text.trim(), o.maxW, o.wrap);
  const lh = o.f * o.lh;
  const w = Math.max(...lines.map(l => ctx.measureText(l).width));
  const x0 = o.align === 'center' ? o.x - w / 2 : o.x;
  return {
    h: lines.length * lh - (lh - o.f) * 0.6, gap: o.gap || 0, ext: [x0, x0 + w],
    draw: top => {
      ctx.font = font; ctx.fillStyle = o.color; ctx.textBaseline = 'alphabetic';
      ctx.textAlign = o.align === 'center' ? 'center' : 'left';
      lines.forEach((l, i) => ctx.fillText(l, o.x, top + o.f * 0.78 + i * lh));
    },
  };
}
function glyphItem(ctx, o) {
  if (!o.text || !o.text.trim()) return null;
  let f = o.f;
  if (o.maxW) f = fitFont(ctx, [o.text], f, o.maxW, 0, hfont);
  ctx.font = hfont(f);
  const font = ctx.font;
  const m = ctx.measureText(o.text);
  const asc = m.actualBoundingBoxAscent, desc = Math.max(m.actualBoundingBoxDescent, -asc * 0.95);
  const x0 = o.align === 'center' ? o.x - m.width / 2 : o.x;
  return {
    h: asc + desc, gap: o.gap || 0, ext: [x0, x0 + m.width],
    draw: top => {
      ctx.font = font; ctx.fillStyle = o.color; ctx.textBaseline = 'alphabetic';
      ctx.textAlign = o.align === 'center' ? 'center' : 'left';
      ctx.fillText(o.text, o.x, top + asc);
    },
  };
}
function listItem(ctx, o) {
  const items = o.text.split('\n').map(t => t.replace(/^\s*([-•*–]|\d+[.)])\s*/, '').trim()).filter(Boolean);
  if (!items.length) return null;
  const f = o.f, d = f * 1.35, gx = f * 0.55, lh = f * 1.22, gapY = f * 0.7;
  const bodyFont = tfont(f, false), numFont = hfont(f * 0.85);
  ctx.font = bodyFont;
  const rows = items.map(t => {
    const lines = wrapLines(ctx, t, o.maxW - d - gx, o.wrap);
    return { lines, h: Math.max(d, lines.length * lh) };
  });
  const H = rows.reduce((s, r, i) => s + r.h + (i ? gapY : 0), 0);
  return {
    h: H, gap: o.gap || 0,
    draw: top => {
      let y = top;
      rows.forEach((r, i) => {
        const cx = o.x0 + d / 2, cy = y + d / 2;
        ctx.fillStyle = o.acc; ctx.beginPath(); ctx.arc(cx, cy, d / 2, 0, Math.PI * 2); ctx.fill();
        ctx.font = numFont; ctx.fillStyle = o.accText; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
        const cap = capOf(ctx); ctx.fillText(String(i + 1), cx, cy + cap / 2);
        ctx.font = bodyFont; ctx.fillStyle = o.color; ctx.textAlign = 'left';
        const th = r.lines.length * lh;
        const ty = y + Math.max(0, (d - th) / 2);
        r.lines.forEach((l, j) => ctx.fillText(l, o.x0 + d + gx, ty + f * 0.95 + j * lh));
        y += r.h + gapY;
      });
    },
  };
}

/* ---------- Termin-Bausteine ---------- */
function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso + 'T12:00:00');
  if (isNaN(d)) return iso;
  return new Intl.DateTimeFormat('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(d);
}
function formatTime(from, to) {
  if (from && to) return `${from} – ${to} Uhr`;
  return from ? `${from} Uhr` : '';
}
function drawIcon(ctx, type, x, y, s, color) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s / 24, s / 24);
  ctx.strokeStyle = color; ctx.lineWidth = 2.2; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath();
  if (type === 'cal') {
    ctx.rect(3, 4.5, 18, 16.5); ctx.moveTo(3, 10); ctx.lineTo(21, 10); ctx.moveTo(8, 2.5); ctx.lineTo(8, 6.5); ctx.moveTo(16, 2.5); ctx.lineTo(16, 6.5);
  } else if (type === 'clock') {
    ctx.arc(12, 12, 9.5, 0, Math.PI * 2); ctx.moveTo(12, 6.5); ctx.lineTo(12, 12); ctx.lineTo(15.5, 14);
  } else {
    ctx.moveTo(12, 22); ctx.bezierCurveTo(12, 22, 4, 14.5, 4, 9.5); ctx.arc(12, 9.5, 8, Math.PI, 0); ctx.bezierCurveTo(20, 14.5, 12, 22, 12, 22);
    ctx.moveTo(15, 9.5); ctx.arc(12, 9.5, 3, 0, Math.PI * 2);
  }
  ctx.stroke(); ctx.restore();
}
// Info-Block: Datum, Uhrzeit, Ort – als Fläche, damit es auch auf Fotos lesbar bleibt
function infoItem(ctx, o) {
  if (!o.rows.length) return null;
  const { u, sz } = o, pad = 40 * u * sz, ic = 46 * u * sz, gi = 26 * u * sz, rowGap = 22 * u * sz;
  const textW = o.maxW - 2 * pad - ic - gi;
  const mainF = fitFont(ctx, o.rows.filter(r => r.big).map(r => r.main), 58 * u * sz, textW, 0, hfont);
  const rows = o.rows.map(r => {
    const f = r.big ? mainF : 40 * u * sz;
    const font = r.big ? hfont(f) : tfont(f, true);
    ctx.font = font;
    const lines = wrapLines(ctx, r.main, textW);
    const subF = 34 * u * sz, subFont = tfont(subF, false);
    ctx.font = subFont;
    const sub = r.sub ? wrapLines(ctx, r.sub, textW) : [];
    const h = lines.length * f * 1.12 + sub.length * subF * 1.3;
    return { ...r, f, font, lines, subF, subFont, sub, h: Math.max(h, ic) };
  });
  const H = rows.reduce((a, r, i) => a + r.h + (i ? rowGap : 0), 0) + 2 * pad;
  const boxC = o.box ? colorOf(o.box) : (o.dark ? COLORS.sand : COLORS.tanne);
  const boxDark = o.box ? isDarkColor(o.box) : !o.dark;
  const txtC = boxDark ? COLORS.sand : COLORS.tanne, icC = boxDark ? COLORS.sonne : COLORS.klee;
  return {
    h: H, gap: o.gap || 0, ext: [o.x0, o.x0 + o.maxW],
    draw: top => {
      ctx.fillStyle = boxC; ctx.fillRect(o.x0, top, o.maxW, H);
      ctx.save(); clearShadow(ctx);
      let y = top + pad;
      for (const r of rows) {
        drawIcon(ctx, r.icon, o.x0 + pad, y + (r.big ? (r.f * 1.12 - ic) / 2 : 0), ic, icC);
        const tx = o.x0 + pad + ic + gi;
        ctx.fillStyle = txtC; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
        let ty = y;
        ctx.font = r.font;
        r.lines.forEach(l => { ctx.fillText(l, tx, ty + r.f * 0.86); ty += r.f * 1.12; });
        ctx.font = r.subFont;
        r.sub.forEach(l => { ctx.fillText(l, tx, ty + r.subF * 0.95); ty += r.subF * 1.3; });
        y += r.h + rowGap;
      }
      ctx.restore();
    },
  };
}
const initials = n => (n || '').trim().split(/\s+/).filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase();
function drawPortrait(ctx, p, cx, cy, d, dark, u) {
  const r = d / 2, img = getImg(p.src);
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
  if (img) {
    ctx.save(); ctx.clip();
    const sc = Math.max(d / img.naturalWidth, d / img.naturalHeight);
    const w = img.naturalWidth * sc, h = img.naturalHeight * sc;
    ctx.drawImage(img, cx - w / 2, cy - r - (h - d) * 0.3, w, h); // Fokus eher oben (Gesicht)
    ctx.restore();
  } else {
    ctx.fillStyle = dark ? COLORS.klee : COLORS.tanne; ctx.fill();
    const p0 = FACE; FACE = 'gt';
    ctx.font = hfont(d * 0.36); FACE = p0;
    ctx.fillStyle = COLORS.sand; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.fillText(initials(p.name) || '?', cx, cy + capOf(ctx) / 2);
  }
  ctx.lineWidth = 7 * u; ctx.strokeStyle = dark ? COLORS.sonne : COLORS.klee;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
}
// Personen: arr = 'top' (Foto oben, Name mittig darunter) | 'left' | 'right' (Foto seitlich, Name daneben)
// Standard: eine Person seitlich, mehrere mit Foto oben. ns/rs/ps = Größe Name/Funktion/Foto
function peopleItem(ctx, o) {
  const ps = o.people;
  if (!ps.length) return null;
  const { u, sz } = o, n = ps.length, gap = 34 * u * sz;
  const tc = o.color || (o.dark ? COLORS.sand : COLORS.tanne);
  const ns = o.ns || 1, rs = o.rs || 1, phs = o.ps || 1;
  const arr = o.arr || (n === 1 ? 'left' : 'top');
  const names = ps.map(p => p.name || ' ');

  if (arr === 'top') {
    const cols = n === 4 && !o.wide ? 2 : n;
    const colW = (o.maxW - gap * (cols - 1)) / cols;
    const d = Math.min(colW * 0.95, colW * 0.78 * phs, 290 * u * sz * phs);
    const nf = fitFont(ctx, names, 44 * u * sz * ns, colW, 0, hfont), nameFont = hfont(nf);
    const rf = 28 * u * sz * rs, roleFont = tfont(rf, false);
    ctx.font = roleFont;
    const roles = ps.map(p => (p.role ? wrapLines(ctx, p.role, colW).slice(0, 3) : []));
    const maxRole = Math.max(...roles.map(r => r.length));
    const cellH = d + 20 * u * sz + nf * 1.1 + maxRole * rf * 1.3;
    const rowsN = Math.ceil(n / cols), H = rowsN * cellH + (rowsN - 1) * gap;
    return {
      h: H, gap: o.gap || 0, ext: [o.x0, o.x0 + o.maxW],
      draw: top => {
        ps.forEach((p, i) => {
          const row = Math.floor(i / cols), inRow = Math.min(cols, n - row * cols), c = i % cols;
          const rowW = inRow * colW + (inRow - 1) * gap;
          const cx = o.x0 + (o.maxW - rowW) / 2 + c * (colW + gap) + colW / 2;
          const y0 = top + row * (cellH + gap);
          drawPortrait(ctx, p, cx, y0 + d / 2, d, o.dark, u);
          let y = y0 + d + 20 * u * sz;
          ctx.fillStyle = tc; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
          ctx.font = nameFont; ctx.fillText(p.name || '', cx, y + nf * 0.9); y += nf * 1.1;
          ctx.font = roleFont; roles[i].forEach(l => { ctx.fillText(l, cx, y + rf * 0.95); y += rf * 1.3; });
        });
      },
    };
  }

  // seitlich: Foto links oder rechts, Name und Funktion daneben
  const cols = n === 1 ? 1 : 2;
  const colW = (o.maxW - gap * (cols - 1)) / cols;
  const d = Math.min((n === 1 ? 280 : 200) * u * sz * phs, colW * 0.5);
  const gi = gap * 0.8, tw = Math.max(40, colW - d - gi);
  const nf = fitFont(ctx, names, (n === 1 ? 62 : 44) * u * sz * ns, tw, 0, hfont), nameFont = hfont(nf);
  const rf = (n === 1 ? 34 : 28) * u * sz * rs, roleFont = tfont(rf, false);
  ctx.font = roleFont;
  const roles = ps.map(p => (p.role ? wrapLines(ctx, p.role, tw).slice(0, 3) : []));
  const textH = i => nf * 1.1 + roles[i].length * rf * 1.3;
  const cellH = Math.max(d, ...ps.map((_, i) => textH(i)));
  const rowsN = Math.ceil(n / cols), H = rowsN * cellH + (rowsN - 1) * gap;
  return {
    h: H, gap: o.gap || 0, ext: [o.x0, o.x0 + o.maxW],
    draw: top => {
      ps.forEach((p, i) => {
        const row = Math.floor(i / cols), inRow = Math.min(cols, n - row * cols), c = i % cols;
        const rowW = inRow * colW + (inRow - 1) * gap;
        const x0 = o.x0 + (inRow < cols ? (o.maxW - rowW) / 2 : 0) + c * (colW + gap);
        const y0 = top + row * (cellH + gap);
        const left = arr !== 'right';
        drawPortrait(ctx, p, left ? x0 + d / 2 : x0 + colW - d / 2, y0 + cellH / 2, d, o.dark, u);
        const tx = left ? x0 + d + gi : x0 + colW - d - gi;
        let y = y0 + (cellH - textH(i)) / 2;
        ctx.fillStyle = tc; ctx.textAlign = left ? 'left' : 'right'; ctx.textBaseline = 'alphabetic';
        ctx.font = nameFont; ctx.fillText(p.name || '', tx, y + nf * 0.9); y += nf * 1.1;
        ctx.font = roleFont; roles[i].forEach(l => { ctx.fillText(l, tx, y + rf * 0.95); y += rf * 1.3; });
      });
    },
  };
}
const qrCache = new Map();
function getQr(value) {
  if (!value || !window.QRious) return null;
  let c = qrCache.get(value);
  if (!c) {
    c = document.createElement('canvas');
    try { new QRious({ element: c, value, size: 600, level: 'M', foreground: '#003d28', background: '#ffffff' }); } catch { return null; }
    qrCache.set(value, c);
  }
  return c;
}
function hintItem(ctx, o) {
  const text = (o.text || '').trim(), qr = getQr((o.qr || '').trim());
  if (!text && !qr) return null;
  const { u, sz } = o, qs = qr ? 220 * u * sz : 0, qp = 16 * u * sz, gap = 36 * u * sz;
  const tw = o.maxW - (qr ? qs + 2 * qp + gap : 0);
  const f = 46 * u * sz, font = hfont(f);
  ctx.font = font;
  const lines = text ? wrapLines(ctx, text, tw, o.wrap) : [];
  const th = lines.length * f * 1.12;
  const H = Math.max(th, qr ? qs + 2 * qp : 0);
  const col = o.color || (o.dark ? COLORS.sonne : COLORS.tanne);
  return {
    h: H, gap: o.gap || 0, ext: [o.x0, o.x0 + o.maxW],
    draw: top => {
      ctx.font = font; ctx.fillStyle = col; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      let y = top + (H - th) / 2;
      lines.forEach(l => { ctx.fillText(l, o.x0, y + f * 0.86); y += f * 1.12; });
      if (qr) {
        const bx = o.x0 + o.maxW - qs - 2 * qp, by = top + (H - qs - 2 * qp) / 2;
        ctx.fillStyle = '#ffffff'; ctx.fillRect(bx, by, qs + 2 * qp, qs + 2 * qp);
        ctx.save(); clearShadow(ctx); ctx.imageSmoothingEnabled = false;
        ctx.drawImage(qr, bx + qp, by + qp, qs, qs); ctx.restore();
      }
    },
  };
}

/* Element-Einstellungen pro Slide (Größe, Schrift, Versatz) */
const EL_LABEL = { head: 'Headline', number: 'Zahl', body: 'Text', list: 'Liste', mark: 'Anführungszeichen', quote: 'Zitat', name: 'Name', info: 'Termin-Infos', people: 'Personen', hint: 'Hinweis & QR-Code' };
const elOf = (s, key) => (s.el && s.el[key]) || {};

// base = true: Vorlagen-Geometrie ohne Einzel-Änderungen (Größe, Breite, Schrift, Umbruch) –
// daraus werden Grundgröße und Startposition bestimmt, damit eine Änderung an einem Element die anderen nicht verschiebt
function buildItems(ctx, s, A, k, dark, base = false) {
  const u = A.u, maxW = A.x1 - A.x0;
  const center = s.align === 'center';
  const x = center ? (A.x0 + A.x1) / 2 : A.x0;
  const tc = dark ? COLORS.sand : COLORS.tanne;
  const acc = dark ? COLORS.sonne : COLORS.tanne;
  const accText = dark ? COLORS.tanne : COLORS.sand;
  const slideFace = s.font === 'pt' ? 'pt' : 'gt';
  const items = [];
  // Baut ein Element mit seiner eigenen Größe/Schrift; die Schrift gilt auch beim späteren Zeichnen
  let mw = maxW, wrap = '', wf = 1, ecol = '', esch = '', ce = {}; // Breite, Umbruch und Farbe des gerade gebauten Elements
  const TC = () => (ecol ? colorOf(ecol) : tc), AC = () => (ecol ? colorOf(ecol) : acc);
  const add = (key, make) => {
    const e0 = elOf(s, key);
    if (e0.hidden) return;
    const e = base ? {} : e0;
    wf = clamp(e.w || 1, 0.2, 1); mw = maxW * wf; wrap = e.wrap || ''; ecol = e.color || ''; esch = e.scheme || ''; ce = e;
    const sz = s.size * k * (e.scale || 1);
    const pf = FACE, pb = BFACE;
    FACE = e.font || slideFace; BFACE = e.font || 'pt';
    const it = make(sz);
    const f0 = FACE, b0 = BFACE;
    FACE = pf; BFACE = pb;
    if (!it) return;
    const draw = it.draw;
    it.draw = top => { const a = FACE, b = BFACE; FACE = f0; BFACE = b0; draw(top); FACE = a; BFACE = b; };
    it.key = key;
    items.push(it);
  };
  // Steht der Störer in einer Ecke auf Höhe der Headline, bekommt die Headline nur die restliche Breite
  const st = s.stoerer;
  // Termin-Layouts füllen meist die ganze Höhe – dort weicht die Headline einem Störer oben immer aus
  const stoererBeside = st.on && typeof st.x !== 'number' && (s.layout === 'event'
    ? st.pos[0] === 't'
    : st.pos[0] === (s.posY === 'bottom' ? 'b' : 't') && s.posY !== 'middle');
  const headW = stoererBeside && !center ? maxW - (2 * 128 * u * st.size + 24 * u) : maxW;
  const bars = (sz, fs, subFs, lines = s.headline.split('\n'), sub = s.sub, gap = 0) =>
    barsItem(ctx, { lines, sub, fs: fs * u * sz, subFs: subFs * u * sz, maxW: fs >= 96 ? headW * wf : mw, angle: s.angle, scheme: esch || s.scheme, align: s.align, x, gap, bgKey: A.bgKey,
                    lineStyles: lines === s.headline.split('\n') || lines.join('\n') === s.headline ? s.lineStyle : null, subStyle: sub === s.sub ? s.subStyle : null });
  switch (s.layout) {
    case 'balken':
      add('head', sz => bars(sz, 150, 56));
      break;
    case 'text':
      add('head', sz => bars(sz, 96, 44));
      add('body', sz => textItem(ctx, { text: s.body, f: 44 * u * sz, lh: 1.32, maxW: mw, wrap, color: TC(), align: s.align, x, gap: 44 * u * k }));
      break;
    case 'liste':
      add('head', sz => bars(sz, 96, 42));
      add('list', sz => listItem(ctx, { text: s.body, f: 42 * u * sz, maxW: mw, wrap, x0: A.x0, color: TC(), acc, accText, gap: 52 * u * k }));
      break;
    case 'zahl':
      add('number', sz => glyphItem(ctx, { text: s.number, f: 360 * u * sz, maxW, color: AC(), align: s.align, x }));
      add('head', sz => bars(sz, 100, 46, undefined, undefined, 34 * u * k));
      add('body', sz => textItem(ctx, { text: s.body, f: 40 * u * sz, lh: 1.32, maxW: mw, wrap, color: TC(), align: s.align, x, gap: 60 * u * k }));
      break;
    case 'zitat':
      add('mark', sz => glyphItem(ctx, { text: '„', f: 300 * u * sz, color: AC(), align: s.align, x }));
      add('quote', sz => textItem(ctx, { text: s.headline, f: 84 * u * sz, lh: 1.06, maxW: mw, wrap, color: TC(), align: s.align, x, fontFn: hfont, gap: 30 * u * k }));
      add('name', sz => bars(sz, 54, 36, [s.sub], s.body, 46 * u * k));
      break;
    case 'bild':
      add('head', sz => bars(sz, 96, 40));
      break;
    case 'event': {
      const ev = s.event || {};
      const rows = [];
      const d = formatDate(ev.date), t = formatTime(ev.from, ev.to);
      if (d) rows.push({ icon: 'cal', main: d, big: true });
      if (t) rows.push({ icon: 'clock', main: t, big: true });
      if (ev.place || ev.address) rows.push({ icon: 'pin', main: ev.place || ev.address, sub: ev.place ? ev.address : '' });
      add('head', sz => bars(sz, 130, 50));
      add('info', sz => infoItem(ctx, { rows, maxW: mw, box: ecol || null, x0: A.x0, dark, u, sz, gap: 46 * u * k }));
      add('people', sz => peopleItem(ctx, { people: (ev.people || []).filter(p => p.name || p.src).slice(0, 4), maxW: mw, color: ecol ? colorOf(ecol) : null, arr: ce.arr || '', ns: ce.ns, rs: ce.rs, ps: ce.ps, x0: A.x0, dark, u, sz, wide: A.W > A.H, gap: 46 * u * k }));
      add('body', sz => textItem(ctx, { text: s.body, f: 36 * u * sz, lh: 1.36, maxW: mw, wrap, color: TC(), align: s.align, x, gap: 40 * u * k }));
      add('hint', sz => hintItem(ctx, { text: ev.hint, qr: ev.qr, maxW: mw, wrap, color: ecol ? colorOf(ecol) : null, x0: A.x0, dark, u, sz, gap: 44 * u * k }));
      break;
    }
  }
  return items;
}

// draws: Map, in die jedes Element seinen Zeichenschritt einträgt (gezeichnet wird später in Ebenen-Reihenfolge)
function layoutStack(ctx, s, A, dark, draws) {
  const avail = A.y1 - A.y0;
  let k = 1, items, total = 0;
  for (let n = 0; n < 7; n++) {
    items = buildItems(ctx, s, A, k, dark, true);
    total = items.reduce((acc, it, i) => acc + it.h + (i ? it.gap : 0), 0);
    if (total <= avail || k < 0.35) break;
    k *= Math.max(0.55, avail / total) * 0.98;
  }
  // Termin-Plakate füllen die Fläche: bei viel freiem Platz behutsam vergrößern
  if (s.layout === 'event' && total < avail * 0.82) {
    for (let n = 0; n < 4 && total < avail * 0.9; n++) {
      const k2 = Math.min(k * 1.4, k * (avail * 0.94 / total));
      const it2 = buildItems(ctx, s, A, k2, dark, true);
      const t2 = it2.reduce((acc, it, i) => acc + it.h + (i ? it.gap : 0), 0);
      if (t2 > avail) break;
      k = k2; items = it2; total = t2;
    }
  }
  // Startposition aus der Vorlagen-Geometrie, gezeichnet wird mit den Einzel-Änderungen
  let y = s.posY === 'top' ? A.y0 : s.posY === 'bottom' ? A.y1 - total : (A.y0 + A.y1 - total) / 2;
  y = Math.max(y, A.y0 - 2);
  items = buildItems(ctx, s, A, k, dark, false);
  // Versatz des ganzen Blocks (ältere Projekte) plus Versatz einzelner Elemente
  const ox = (s.off && s.off.x || 0) * A.W, oy = (s.off && s.off.y || 0) * A.H;
  const els = [];
  items.forEach((it, i) => {
    if (i) y += it.gap;
    const e = elOf(s, it.key), dx = (e.dx || 0) * A.W, dy = (e.dy || 0) * A.H, yy = y;
    const paint = () => {
      const prev = SHADOW; if (hasOwn(e.shadow)) SHADOW = mkShadow(+e.shadow, A.u); // eigener Schatten des Elements
      ctx.save(); ctx.translate(ox + dx, oy + dy); applyShadow(ctx); it.draw(yy); ctx.restore();
      SHADOW = prev;
    };
    if (draws) draws.set('el:' + it.key, paint); else paint();
    const ext = it.ext || [A.x0, A.x1];
    els.push({ key: it.key, x0: ext[0] + ox + dx, x1: ext[1] + ox + dx, y0: y + oy + dy, y1: y + it.h + oy + dy });
    y += it.h;
  });
  return els;
}

/* ---------- Ebenen-Reihenfolge: erste = hinten, letzte = vorne (wie in der Ebenen-Liste von oben nach unten) ---------- */
function ensureEmojiIds(s) { s.emojis.forEach(e => { if (!e.id) e.id = 'e' + Math.random().toString(36).slice(2, 9); }); }
function defaultOrder(s) {
  ensureEmojiIds(s);
  return [...(LAYOUT_LAYERS[s.layout] || []).map(k => 'el:' + k), 'stoerer', 'logo', 'abs',
          ...(s.items || []).map(it => 'item:' + it.id), ...s.emojis.map(e => 'emoji:' + e.id)];
}
function orderedIds(s) {
  const all = defaultOrder(s), valid = new Set(all);
  const ord = (s.order || []).filter(id => valid.has(id));
  const seen = new Set(ord);
  const missEl = all.filter(id => !seen.has(id) && id.startsWith('el:'));
  const missRest = all.filter(id => !seen.has(id) && !id.startsWith('el:'));
  return [...missEl, ...ord, ...missRest]; // fehlende Vorlagen-Elemente hinten, neue Elemente vorne (unten in der Liste)
}

function stoererGeom(st, A, W, H) {
  const r = 128 * A.u * st.size;
  const m = 6 * A.u;
  if (typeof st.x === 'number' && typeof st.y === 'number') return { cx: st.x * W, cy: st.y * H, r };
  return {
    cx: st.pos[1] === 'l' ? A.x0 + r + m : A.x1 - r - m,
    cy: st.pos[0] === 't' ? A.y0 + r + m : A.y1 - r - m, r,
  };
}
function drawStoerer(ctx, st, A, W, H) {
  const lines = (st.text || '').split('\n').map(l => l.trim()).filter(Boolean);
  if (!lines.length) return null;
  const { cx, cy, r } = stoererGeom(st, A, W, H);
  ctx.save();
  ctx.fillStyle = COLORS.himmel; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  ctx.translate(cx, cy); ctx.rotate(-7 * Math.PI / 180);
  // 90 % Typofläche: Textblock-Diagonale passt in 90 % des Durchmessers
  let f = r * 0.6;
  for (let n = 0; n < 6; n++) {
    ctx.font = hfont(f);
    const w = Math.max(...lines.map(l => ctx.measureText(l).width));
    const h = lines.length * f * 0.98;
    const diag = Math.hypot(w, h);
    if (diag <= 2 * r * 0.88) break;
    f *= (2 * r * 0.88) / diag;
  }
  ctx.font = hfont(f); ctx.fillStyle = COLORS.sand; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  const cap = capOf(ctx), lh = f * 0.98;
  const top = -((lines.length - 1) * lh) / 2;
  lines.forEach((l, i) => ctx.fillText(l, 0, top + i * lh + cap / 2));
  ctx.restore();
  return { cx, cy, r };
}

/* Emojis: einheitliche Twemoji-Grafiken, Fallback auf System-Emoji-Schrift */
function emojiUrl(ch) {
  let cps = [...ch].map(c => c.codePointAt(0).toString(16));
  if (!cps.includes('200d')) cps = cps.filter(c => c !== 'fe0f');
  return `https://cdn.jsdelivr.net/gh/jdecked/twemoji@15.1.0/assets/svg/${cps.join('-')}.svg`;
}
function drawEmoji(ctx, e, W, H) {
  if (e.hidden) return;
  const base = Math.min(W, H);
  {
    const size = e.size * base;
    const cx = e.x * W, cy = e.y * H;
    ctx.save(); ctx.translate(cx, cy); ctx.rotate((e.rot || 0) * Math.PI / 180);
    const img = getImg(emojiUrl(e.ch));
    if (img) ctx.drawImage(img, -size / 2, -size / 2, size, size);
    else {
      ctx.font = `${size * 0.86}px ${EMOJI_FONTS}, sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#000';
      ctx.fillText(e.ch, 0, size * 0.04);
    }
    ctx.restore();
  }
}
/* ---------- Zusatz-Elemente (Text, Zahl, Bild) ---------- */
const mctx = document.createElement('canvas').getContext('2d'); // nur zum Messen
function itemMetrics(ctx, it, u) {
  const pf = FACE; FACE = it.font === 'pt' ? 'pt' : 'gt';
  const lines = (it.text || ' ').split('\n').map(l => (it.caps ? l.toUpperCase() : l));
  const fs = it.size * u;
  let w, h, bb = null;
  if (it.bar) {
    bb = barsBlock(ctx, { lines, fs, subFs: 0, maxW: 1e6, angle: 0, scheme: it.bar, align: 'center', x: 0, y: 0, anchor: 'middle', upper: false, dry: true });
    w = bb ? bb.r - bb.l : 0; h = bb ? bb.b - bb.t : 0;
  } else {
    ctx.font = hfont(fs);
    w = Math.max(...lines.map(l => ctx.measureText(l).width)); h = lines.length * fs * 1.08;
  }
  FACE = pf;
  return { lines, fs, w, h };
}
function itemGeom(it) {
  if (!it) return null;
  const W = G.W, H = G.H, u = Math.min(W, H) / 1080;
  let hw, hh;
  if (it.kind === 'image') {
    const img = getImg(it.src), w = it.size * W, ar = img ? img.naturalHeight / img.naturalWidth : 1;
    const d = it.shape === 'circle' ? Math.min(w, w * ar) : null;
    hw = (d || w) / 2; hh = (d || w * ar) / 2;
  } else {
    const m = itemMetrics(mctx, it, u); hw = m.w / 2; hh = m.h / 2;
  }
  return { cx: it.x * W, cy: it.y * H, hw, hh, rot: (it.rot || 0) * Math.PI / 180 };
}
function drawItem(ctx, it, W, H, u) {
  if (it.hidden) return;
  {
    const cx = it.x * W, cy = it.y * H, a = (it.rot || 0) * Math.PI / 180;
    if (it.kind === 'image') {
      const img = getImg(it.src); if (!img) return;
      const w = it.size * W, h = w * img.naturalHeight / img.naturalWidth;
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(a);
      if (it.shape === 'circle') {
        const d = Math.min(w, h);
        ctx.beginPath(); ctx.arc(0, 0, d / 2, 0, Math.PI * 2); ctx.clip();
        const sc = d / Math.min(img.naturalWidth, img.naturalHeight);
        ctx.drawImage(img, -img.naturalWidth * sc / 2, -img.naturalHeight * sc / 2, img.naturalWidth * sc, img.naturalHeight * sc);
      } else ctx.drawImage(img, -w / 2, -h / 2, w, h);
      ctx.restore();
      return;
    }
    const pf = FACE; FACE = it.font === 'pt' ? 'pt' : 'gt';
    const m = itemMetrics(ctx, it, u);
    if (it.bar) {
      ctx.save(); applyShadow(ctx);
      barsBlock(ctx, { lines: m.lines, fs: m.fs, subFs: 0, maxW: 1e6, angle: it.rot || 0, scheme: it.bar, align: 'center', x: cx, y: cy, anchor: 'middle', upper: false });
      ctx.restore();
    } else {
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(a); applyShadow(ctx);
      ctx.font = hfont(m.fs); ctx.fillStyle = colorOf(it.color || 'sand'); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      m.lines.forEach((l, i) => ctx.fillText(l, 0, -m.h / 2 + m.fs * 1.08 * (i + 0.5)));
      ctx.restore();
    }
    FACE = pf;
  }
}
function hitOneItem(it, x, y) {
  if (!it || it.hidden) return false;
  const g = itemGeom(it); if (!g) return false;
  const p = toLocal(g, x, y);
  return Math.abs(p.x) <= g.hw + 6 && Math.abs(p.y) <= g.hh + 6;
}
function hitOneEmoji(e, x, y) {
  if (!e || e.hidden) return false;
  return Math.hypot(x - e.x * G.W, y - e.y * G.H) <= e.size * Math.min(G.W, G.H) * 0.55;
}
function hitItem(s, x, y) {
  const list = s.items || [];
  for (let i = list.length - 1; i >= 0; i--) {
    if (list[i].hidden) continue;
    const g = itemGeom(list[i]); if (!g) continue;
    const p = toLocal(g, x, y);
    if (Math.abs(p.x) <= g.hw + 6 && Math.abs(p.y) <= g.hh + 6) return i;
  }
  return -1;
}
// Ausgangs-Versatz für Verschieben (Layout-Element oder alter Block-Versatz)
function offOf(t) {
  const s = slide();
  if (t === 'el') { const e = (s.el && s.el[selElKey]) || {}; return { x: e.dx || 0, y: e.dy || 0 }; }
  return { ...(s.off || { x: 0, y: 0 }) };
}
function addItem(kind, extra = {}) {
  const s = slide(); if (!s.items) s.items = [];
  const base = kind === 'image'
    ? { kind, src: null, size: 0.35, shape: 'rect', x: 0.5, y: 0.5, rot: 0 }
    : { kind: 'text', text: 'Neuer Text', font: 'gt', size: 72, color: 'sand', bar: 'tanne', caps: true, x: 0.5, y: 0.5, rot: 0 };
  const nid = 'i' + Date.now().toString(36);
  s.items.push({ id: nid, ...base, ...extra });
  s.order = [...orderedIds(s).filter(x => x !== 'item:' + nid), 'item:' + nid]; // neu = ganz unten in der Liste = vorne
  setSel('item', s.items.length - 1);
  syncUI(); changed();
}

function hitEmoji(s, px, py, W, H) {
  const base = Math.min(W, H);
  for (let i = s.emojis.length - 1; i >= 0; i--) {
    const e = s.emojis[i], r = e.size * base * 0.55;
    if (e.hidden) continue;
    if (Math.hypot(px - e.x * W, py - e.y * H) <= r) return i;
  }
  return -1;
}

function mulberry32(a) {
  return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
/* Ein langer Streifen über alle Slides, in niedriger Auflösung gerendert und weich hochskaliert */
const FLOW_SCALE = 1 / 6;
let flowCache = { key: '', canvas: null };
function flowStrip(W, H, total) {
  const F = P.flow;
  const key = [F.palette, F.seed, F.soft, total, W, H].join('|');
  if (flowCache.key === key) return flowCache.canvas;
  flowCache = { key, canvas: genFlow(F, Math.ceil(W * total * FLOW_SCALE), Math.ceil(H * FLOW_SCALE), total) };
  return flowCache.canvas;
}
function genFlow(F, cw, ch, total) {
  const pal = FLOWS[F.palette] || FLOWS.gruen;
  const c = document.createElement('canvas'); c.width = cw; c.height = ch;
  const x = c.getContext('2d');
  x.fillStyle = pal.base; x.fillRect(0, 0, cw, ch);
  const rnd = mulberry32(F.seed * 9973 + 17);
  const cols = [...pal.colors].sort(() => rnd() - 0.5);
  const a = pal.alpha || 0.92;
  const core = 0.6 - F.soft * 0.55;
  const blob = (cx, cy, r, col, alpha) => {
    x.save(); x.translate(cx, cy); x.rotate(rnd() * Math.PI); x.scale(1, 0.55 + rnd() * 0.6);
    const g = x.createRadialGradient(0, 0, 0, 0, 0, r);
    g.addColorStop(0, hexA(col, alpha)); g.addColorStop(core, hexA(col, alpha * 0.8)); g.addColorStop(1, hexA(col, 0));
    x.fillStyle = g; x.beginPath(); x.arc(0, 0, r, 0, Math.PI * 2); x.fill(); x.restore();
  };
  const n = Math.round(total * 2.4) + 2;
  for (let k = 0; k < n; k++) {
    const cx = ((k + 0.5) / n) * cw + (rnd() - 0.5) * (cw / n);
    const cy = (k % 2 ? 0.78 : 0.22) * ch + (rnd() - 0.5) * ch * 0.35;
    blob(cx, cy, ch * (0.42 + rnd() * 0.3), cols[k % cols.length], a);
  }
  for (let k = 0; k < Math.round(n * 0.7); k++) {
    blob(rnd() * cw, rnd() * ch, ch * (0.14 + rnd() * 0.16), cols[(k + 2) % cols.length], a * 0.85);
  }
  return c;
}
let grainTile = null;
function drawGrain(ctx, W, H, amount) {
  if (amount <= 0) return;
  if (!grainTile) {
    grainTile = document.createElement('canvas'); grainTile.width = grainTile.height = 256;
    const g = grainTile.getContext('2d'), d = g.createImageData(256, 256), rnd = mulberry32(42);
    for (let p = 0; p < d.data.length; p += 4) { const v = rnd() * 255; d.data[p] = d.data[p + 1] = d.data[p + 2] = v; d.data[p + 3] = 255; }
    g.putImageData(d, 0, 0);
  }
  ctx.save();
  ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = amount * 0.45;
  ctx.fillStyle = ctx.createPattern(grainTile, 'repeat'); ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

function drawBackground(ctx, s, i, total, W, H) {
  ctx.fillStyle = colorOf(s.bg.color);
  if (s.bg.type === 'color' && s.bg.color2) { // Zweifarb-Verlauf
    const d = s.bg.dir || 'down';
    const g = d === 'right' ? ctx.createLinearGradient(0, 0, W, 0) : d === 'diag' ? ctx.createLinearGradient(0, 0, W, H) : ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, colorOf(s.bg.color)); g.addColorStop(1, colorOf(s.bg.color2));
    ctx.fillStyle = g;
  }
  ctx.fillRect(0, 0, W, H);
  if (s.bg.type === 'flow') {
    const strip = flowStrip(W, H, total);
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(strip, i * W * FLOW_SCALE, 0, W * FLOW_SCALE, H * FLOW_SCALE, 0, 0, W, H);
    drawGrain(ctx, W, H, P.flow.grain);
    return true;
  }
  let img = null, cfg = null, tw = W, off = 0;
  if (s.bg.type === 'image') { img = getImg(s.bg.src); cfg = s.bg; }
  else if (s.bg.type === 'panorama') { img = getImg(P.panorama.src); cfg = P.panorama; tw = W * total; off = i * W; }
  if (!img) return false;
  const sc = Math.max(tw / img.naturalWidth, H / img.naturalHeight) * (cfg.zoom || 1);
  const dw = img.naturalWidth * sc, dh = img.naturalHeight * sc;
  ctx.drawImage(img, (tw - dw) * cfg.x - off, (H - dh) * cfg.y, dw, dh);
  const ov = s.bg.overlay || 0;
  if (ov > 0) {
    const oc = colorOf(s.bg.ovColor || 'tanne');
    // Richtung: automatisch dort, wo der Text steht – oder fest gewählt
    const mode = (s.bg.ovMode && s.bg.ovMode !== 'auto') ? s.bg.ovMode : (s.posY === 'middle' ? 'full' : s.posY === 'top' ? 'top' : 'bottom');
    if (mode === 'full') {
      ctx.fillStyle = hexA(oc, ov * 0.65); ctx.fillRect(0, 0, W, H);
    } else {
      const g = mode === 'top' ? ctx.createLinearGradient(0, 0, 0, H) : ctx.createLinearGradient(0, H, 0, 0);
      g.addColorStop(0, hexA(oc, ov));
      g.addColorStop(0.5, hexA(oc, ov * 0.35));
      g.addColorStop(1, hexA(oc, 0));
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }
  }
  return true;
}

function bgGeom(s, i, total, W, H) {
  let img = null, cfg = null, tw = W;
  if (s.bg.type === 'image') { img = getImg(s.bg.src); cfg = s.bg; }
  else if (s.bg.type === 'panorama') { img = getImg(P.panorama.src); cfg = P.panorama; tw = W * total; }
  if (!img) return null;
  const sc = Math.max(tw / img.naturalWidth, H / img.naturalHeight) * (cfg.zoom || 1);
  return { cfg, spanX: tw - img.naturalWidth * sc, spanY: H - img.naturalHeight * sc };
}

/* ============ Haupt-Render ============ */
// scale < 1: kleinere Pixelzahl (Vorschau/Thumbnails), gezeichnet wird immer in Format-Koordinaten
function render(canvas, i, { preview = false, scale = 1 } = {}) {
  const f = fmt(), W = f.w, H = f.h;
  const cw = Math.max(1, Math.round(W * scale)), ch = Math.max(1, Math.round(H * scale));
  if (canvas.width !== cw) canvas.width = cw;
  if (canvas.height !== ch) canvas.height = ch;
  const ctx = canvas.getContext('2d');
  const s = P.slides[i], total = P.slides.length;
  const u = Math.min(W, H) / 1080;
  ctx.setTransform(cw / W, 0, 0, ch / H, 0, 0);
  ctx.clearRect(0, 0, W, H);

  const hasImg = drawBackground(ctx, s, i, total, W, H);
  const dark = s.bg.type === 'flow' ? (FLOWS[P.flow.palette] || FLOWS.gruen).dark
    : hasImg ? true
    : s.bg.color2 ? (lum(s.bg.color) + lum(s.bg.color2)) / 2 < 0.28
    : isDarkColor(s.bg.color);
  SHADOW = mkShadow(s.shadow || 0, u);

  const safe = (f.safe && (f.forceSafe || P.useSafe)) ? f.safe : { t: 0, b: 0, l: 0, r: 0 };
  const m = 66 * u;
  const box = { x0: m + safe.l, y0: Math.max(m, safe.t), x1: W - m - safe.r, y1: H - Math.max(m, safe.b) };

  // Logo
  const logo = s.showLogo ? getImg(logoSrc()) : null;
  let lw = 0, lh = 0;
  if (logo) {
    lh = P.logo.size * Math.min(W, H);
    lw = lh * (logo.naturalWidth / logo.naturalHeight);
    if (lw > W * 0.6) { lw = W * 0.6; lh = lw * (logo.naturalHeight / logo.naturalWidth); }
  }
  const logoFree = logo && typeof P.logo.x === 'number';

  // Absender
  const AB = P.abs;
  const absText = AB.on && s.showAbsender ? (P.absender || '').trim() : '';
  const absFs = 46 * u * AB.size;
  const absFace = AB.font === 'pt' ? 'pt' : 'gt';
  FACE = absFace;
  ctx.font = hfont(absFs); ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  const absW = absText ? ctx.measureText(absText).width : 0;
  const absCap = capOf(ctx);
  FACE = 'gt';
  const absFree = absText && typeof AB.x === 'number';

  // Seitenzahl / Wisch-Pfeil
  const showArrow = total > 1 && P.swipe && i < total - 1;
  const showNum = total > 1 && P.numbering;
  const pr = 30 * u;
  ctx.font = bfont(30 * u, true);
  const numTxt = `${i + 1} / ${total}`;
  const numW = showNum ? ctx.measureText(numTxt).width : 0;
  const pagerW = (showArrow ? 2 * pr : 0) + (showArrow && showNum ? 16 * u : 0) + numW;

  // Ecken-Slots: vom Rand nach innen Logo, Absender, Seitenzahl
  const rowH = 60 * u, gapX = 28 * u;
  const slots = { tl: [], tr: [], bl: [], br: [] };
  if (logo && !logoFree) slots[P.logo.pos || 'br'].push({ kind: 'logo', w: lw, h: lh });
  if (absText && !absFree) slots[AB.pos || 'bl'].push({ kind: 'abs', w: absW, h: absCap });
  if (showArrow || showNum) slots.br.push({ kind: 'pager', w: pagerW, h: 2 * pr });
  const rowHeight = list => (list.length ? Math.max(rowH, ...list.map(o => o.h)) : 0);
  const topH = Math.max(rowHeight(slots.tl), rowHeight(slots.tr));
  const botH = Math.max(rowHeight(slots.bl), rowHeight(slots.br));

  const A = {
    u, W, H, x0: box.x0, x1: box.x1, bgKey: hasImg ? (s.bg.type === 'flow' && !dark ? 'sand' : null) : s.bg.color,
    y0: box.y0 + (topH ? topH + 36 * u : 0),
    y1: box.y1 - (botH ? botH + 44 * u : 0),
  };

  const draws = new Map();
  FACE = s.font === 'pt' ? 'pt' : 'gt';
  const tb = layoutStack(ctx, s, A, dark, draws);
  FACE = 'gt';
  const hasSt = s.stoerer.on && (s.stoerer.text || '').trim();
  const sg = hasSt ? stoererGeom(s.stoerer, A, W, H) : null;
  if (hasSt) draws.set('stoerer', () => { const pf = FACE; FACE = 'gt'; drawStoerer(ctx, s.stoerer, A, W, H); FACE = pf; }); // Störer laut Richtlinie immer in GrueneType Neue

  const place = {};
  for (const [corner, list] of Object.entries(slots)) {
    const top = corner[0] === 't', left = corner[1] === 'l';
    let x = left ? box.x0 : box.x1;
    for (const o of list) {
      const ox = left ? x : x - o.w;
      const band = top ? box.y0 : box.y1 - rowH; // kleine Elemente mittig im Randstreifen
      const oy = o.h >= rowH ? (top ? box.y0 : box.y1 - o.h) : band + (rowH - o.h) / 2;
      place[o.kind] = { x: ox, y: oy, w: o.w, h: o.h };
      x = left ? x + o.w + gapX : x - o.w - gapX;
    }
  }
  if (logoFree) place.logo = { x: P.logo.x * W - lw / 2, y: P.logo.y * H - lh / 2, w: lw, h: lh };
  if (absFree) place.abs = { x: AB.x * W - absW / 2, y: AB.y * H - absCap / 2, w: absW, h: absCap };

  if (place.logo) draws.set('logo', () => ctx.drawImage(logo, place.logo.x, place.logo.y, lw, lh));
  if (place.abs) draws.set('abs', () => {
    FACE = absFace;
    ctx.font = hfont(absFs); ctx.fillStyle = dark ? COLORS.sand : COLORS.tanne;
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    applyShadow(ctx); ctx.fillText(absText, place.abs.x, place.abs.y + absCap); clearShadow(ctx);
    FACE = 'gt';
  });
  for (const it of s.items || []) draws.set('item:' + it.id, () => {
    const prev = SHADOW; if (hasOwn(it.shadow)) SHADOW = mkShadow(+it.shadow, u);
    drawItem(ctx, it, W, H, u); SHADOW = prev;
  });
  ensureEmojiIds(s);
  for (const e of s.emojis) draws.set('emoji:' + e.id, () => drawEmoji(ctx, e, W, H));
  // alle Ebenen in der Reihenfolge der Ebenen-Liste zeichnen
  for (const id of orderedIds(s)) { const d = draws.get(id); if (d) d(); }
  if (place.pager) {
    const p = place.pager, cy = p.y + p.h / 2;
    let xr = p.x + p.w;
    if (showArrow) {
      const cx = xr - pr;
      ctx.fillStyle = dark ? COLORS.sonne : COLORS.tanne;
      ctx.beginPath(); ctx.arc(cx, cy, pr, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = dark ? COLORS.tanne : COLORS.sand; ctx.lineWidth = 6 * u; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(cx - 12 * u, cy); ctx.lineTo(cx + 12 * u, cy);
      ctx.moveTo(cx + 2 * u, cy - 10 * u); ctx.lineTo(cx + 12 * u, cy); ctx.lineTo(cx + 2 * u, cy + 10 * u); ctx.stroke();
      xr -= 2 * pr + 16 * u;
    }
    if (showNum) {
      ctx.font = bfont(30 * u, true); ctx.fillStyle = dark ? COLORS.sand : COLORS.tanne;
      ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      ctx.fillText(numTxt, xr, cy);
    }
  }
  if (preview) {
    const gb = b => (b ? { cx: b.x + b.w / 2, cy: b.y + b.h / 2, hw: b.w / 2, hh: b.h / 2 } : null);
    G.els = tb || []; G.stoerer = sg; G.W = W; G.H = H; G.logo = gb(place.logo); G.abs = gb(place.abs);
  }


  if (preview && f.safe && (f.forceSafe || P.useSafe)) {
    // Druck: Beschnittzone grau, Social: verdeckte UI-Bereiche rot
    const k = uiScale();
    ctx.fillStyle = f.print ? 'rgba(0,0,0,.22)' : 'rgba(220,40,40,.16)';
    ctx.fillRect(0, 0, W, safe.t);
    ctx.fillRect(0, H - safe.b, W, safe.b);
    ctx.fillRect(0, safe.t, safe.l, H - safe.t - safe.b);
    ctx.fillRect(W - safe.r, safe.t, safe.r, H - safe.t - safe.b);
    ctx.setLineDash([10 * k, 7 * k]); ctx.strokeStyle = f.print ? 'rgba(0,0,0,.6)' : 'rgba(220,40,40,.8)'; ctx.lineWidth = 1.5 * k;
    ctx.strokeRect(safe.l, safe.t, W - safe.l - safe.r, H - safe.t - safe.b);
    ctx.setLineDash([]);
  }
  if (preview) drawSelection(ctx, W, H);
}

/* ============ Auswahl & Griffe (nur Vorschau) ============ */
const G = { text: null, stoerer: null, logo: null, abs: null, W: 1080, H: 1350 }; // Geometrie der aktuellen Vorschau
let guides = { v: false, h: false };
function uiScale() { const w = preview.getBoundingClientRect().width || G.W; return G.W / w; } // Canvas-px pro Bildschirm-px
function selType() { return selEmoji >= 0 ? 'emoji' : selItem >= 0 ? 'item' : stoererSel ? 'stoerer' : selElKey ? 'el' : elSel; }
const elBox = key => (G.els || []).find(e => e.key === key);
// Box des ausgewählten Elements: Mittelpunkt, halbe Breite/Höhe, Drehung
function selBox() {
  const t = selType(), s = slide(), pad = 10 * uiScale();
  if (t === 'emoji') {
    const e = s.emojis[selEmoji]; if (!e) return null;
    const hs = e.size * Math.min(G.W, G.H) / 2 + pad;
    return { cx: e.x * G.W, cy: e.y * G.H, hw: hs, hh: hs, rot: (e.rot || 0) * Math.PI / 180, canRotate: true };
  }
  if ((t === 'logo' || t === 'abs') && G[t]) { const b = G[t]; return { cx: b.cx, cy: b.cy, hw: b.hw + pad, hh: b.hh + pad, rot: 0 }; }
  if (t === 'stoerer' && G.stoerer) return { cx: G.stoerer.cx, cy: G.stoerer.cy, hw: G.stoerer.r + pad, hh: G.stoerer.r + pad, rot: 0 };
  if (t === 'item') { const g = itemGeom(slide().items[selItem]); return g && { ...g, hw: g.hw + pad, hh: g.hh + pad, canRotate: true }; }
  if (t === 'el' && elBox(selElKey)) {
    const b = elBox(selElKey), cw = !!(ELDEF[selElKey] && ELDEF[selElKey].opts.width);
    return { cx: (b.x0 + b.x1) / 2, cy: (b.y0 + b.y1) / 2, hw: (b.x1 - b.x0) / 2 + pad, hh: (b.y1 - b.y0) / 2 + pad, rot: 0, canWidth: cw };
  }
  return null;
}
function toLocal(b, x, y) {
  const dx = x - b.cx, dy = y - b.cy, c = Math.cos(-b.rot), s = Math.sin(-b.rot);
  return { x: dx * c - dy * s, y: dx * s + dy * c };
}
function handleAt(x, y) {
  const b = selBox(); if (!b) return null;
  const k = uiScale(), p = toLocal(b, x, y), hr = 14 * k;
  if (Math.hypot(p.x - b.hw, p.y - b.hh) <= hr) return 'resize';
  if (b.canWidth && Math.abs(p.x - b.hw) <= hr && Math.abs(p.y) <= 22 * k) return 'width';
  if (b.canRotate && Math.hypot(p.x, p.y + b.hh + 30 * k) <= hr) return 'rotate';
  return null;
}
function drawSelection(ctx, W, H) {
  const k = uiScale();
  ctx.save();
  ctx.strokeStyle = COLORS.himmel; ctx.lineWidth = 2 * k; ctx.setLineDash([]);
  if (guides.v) { ctx.beginPath(); ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, H); ctx.stroke(); }
  if (guides.h) { ctx.beginPath(); ctx.moveTo(0, H / 2); ctx.lineTo(W, H / 2); ctx.stroke(); }
  const b = selBox();
  if (b) {
    ctx.translate(b.cx, b.cy); ctx.rotate(b.rot);
    ctx.lineWidth = 4 * k; ctx.strokeStyle = 'rgba(0,40,25,.55)'; ctx.strokeRect(-b.hw, -b.hh, b.hw * 2, b.hh * 2);
    ctx.lineWidth = 2 * k; ctx.strokeStyle = COLORS.sonne; ctx.setLineDash([8 * k, 6 * k]);
    ctx.strokeRect(-b.hw, -b.hh, b.hw * 2, b.hh * 2); ctx.setLineDash([]);
    const dot = (x, y) => {
      ctx.beginPath(); ctx.arc(x, y, 9 * k, 0, Math.PI * 2);
      ctx.fillStyle = COLORS.sonne; ctx.fill(); ctx.lineWidth = 2.5 * k; ctx.strokeStyle = COLORS.tanne; ctx.stroke();
    };
    dot(b.hw, b.hh);
    if (b.canWidth) { // Breiten-Griff: senkrechte Pille rechts
      ctx.beginPath(); ctx.roundRect(b.hw - 4 * k, -14 * k, 8 * k, 28 * k, 4 * k);
      ctx.fillStyle = COLORS.sonne; ctx.fill(); ctx.lineWidth = 2.5 * k; ctx.strokeStyle = COLORS.tanne; ctx.stroke();
    }
    if (b.canRotate) {
      ctx.beginPath(); ctx.moveTo(0, -b.hh); ctx.lineTo(0, -b.hh - 30 * k);
      ctx.strokeStyle = COLORS.sonne; ctx.lineWidth = 2 * k; ctx.stroke();
      dot(0, -b.hh - 30 * k);
    }
  }
  ctx.restore();
}

/* ============ UI ============ */
const preview = $('#preview');
let rq = 0, thumbT = 0, saveT = 0;
const previewScale = () => { const f = fmt(); return Math.min(1, 2000 / Math.max(f.w, f.h)); };
function scheduleRender() { if (!rq) rq = requestAnimationFrame(() => { rq = 0; render(preview, cur, { preview: true, scale: previewScale() }); layoutPreview(); }); }
function scheduleThumbs(now) { clearTimeout(thumbT); thumbT = setTimeout(renderThumbs, now ? 0 : 160); }
function scheduleSave() { clearTimeout(saveT); saveT = setTimeout(save, 500); }
function changed() { scheduleRender(); scheduleThumbs(); scheduleSave(); scheduleRecord(); }

/* ============ Rückgängig / Wiederherstellen ============ */
// Schnappschüsse des Projekts; Fotos (data-URLs) werden nur als Verweis gespeichert.
const hist = { stack: [], idx: -1, lock: false };
const imgIds = new Map(), imgById = [];
function imgRef(v) { let id = imgIds.get(v); if (id === undefined) { id = imgById.length; imgById.push(v); imgIds.set(v, id); } return '@img:' + id; }
const snapshot = () => JSON.stringify(P, (k, v) => (typeof v === 'string' && v.length > 2000 && v.startsWith('data:') ? imgRef(v) : v));
const unsnap = str => JSON.parse(str, (k, v) => (typeof v === 'string' && v.startsWith('@img:') ? imgById[+v.slice(5)] : v));
let recT = 0;
function scheduleRecord() { if (hist.lock) return; clearTimeout(recT); recT = setTimeout(record, 400); }
function record() {
  clearTimeout(recT); recT = 0;
  if (hist.lock) return;
  const s = snapshot();
  if (hist.stack[hist.idx] === s) return;
  hist.stack = hist.stack.slice(0, hist.idx + 1);
  hist.stack.push(s);
  if (hist.stack.length > 80) hist.stack.shift();
  hist.idx = hist.stack.length - 1;
  updateHistButtons();
}
function updateHistButtons() {
  $('#btnUndo').disabled = hist.idx <= 0;
  $('#btnRedo').disabled = hist.idx >= hist.stack.length - 1;
}
function restoreHist(step) {
  if (recT) record(); // laufende Änderung erst abschließen
  const to = hist.idx + step;
  if (to < 0 || to >= hist.stack.length) return;
  hist.idx = to; hist.lock = true;
  const curId = P.slides[cur] && P.slides[cur].id;
  P = unsnap(hist.stack[to]);
  const keep = P.slides.findIndex(s => s.id === curId);
  cur = keep >= 0 ? keep : clamp(cur, 0, P.slides.length - 1);
  selEmoji = -1; stoererSel = false; selElKey = null; selItem = -1; elSel = null;
  $('#strip').innerHTML = '';
  syncUI(); scheduleRender(); scheduleThumbs(true); scheduleSave();
  hist.lock = false;
  updateHistButtons();
}
const undo = () => restoreHist(-1), redo = () => restoreHist(1);

function save() {
  const hint = $('#saveHint');
  try { localStorage.setItem(STORE_KEYS[MODE], JSON.stringify(P)); hint.hidden = true; }
  catch {
    hint.hidden = false;
    try {
      const lite = JSON.parse(JSON.stringify(P));
      lite.panorama.src = null; lite.slides.forEach(s => { s.bg.src = null; if (s.bg.type === 'image' || s.bg.type === 'panorama') s.bg.type = 'color'; });
      localStorage.setItem(STORE_KEYS[MODE], JSON.stringify(lite));
      hint.textContent = 'Fotos sind zu groß zum automatischen Sichern. Über „Projekt speichern“ bleiben sie erhalten.';
    } catch { hint.textContent = 'Automatisches Sichern ist in diesem Browser nicht möglich.'; }
  }
}

const offscreen = document.createElement('canvas');
function renderThumbs() {
  const strip = $('#strip');
  const f = fmt();
  const tw = 168, th = Math.round(tw * f.h / f.w);
  if (strip.children.length !== P.slides.length) {
    strip.innerHTML = '';
    P.slides.forEach((_, i) => {
      const b = document.createElement('button');
      b.className = 'thumb'; b.dataset.i = i;
      b.innerHTML = `<canvas></canvas><span class="n">${i + 1}</span>`;
      b.title = `Slide ${i + 1}`;
      strip.appendChild(b);
    });
  }
  [...strip.children].forEach((b, i) => {
    b.dataset.i = i; b.querySelector('.n').textContent = i + 1;
    b.classList.toggle('active', i === cur);
    const c = b.querySelector('canvas');
    if (c.width !== tw || c.height !== th) { c.width = tw; c.height = th; }
    render(offscreen, i, { scale: tw / f.w });
    const x = c.getContext('2d'); x.clearRect(0, 0, tw, th); x.drawImage(offscreen, 0, 0, tw, th);
  });
  $('#slideCount').textContent = `${P.slides.length} ${P.slides.length > 1 ? term('many') : term('one')}`;
  syncExportLabels();
}

function buildFlowPicker() {
  const box = $('#flowPicker'); box.innerHTML = '';
  for (const [k, pal] of Object.entries(FLOWS)) {
    const b = document.createElement('button'); b.type = 'button'; b.dataset.flow = k; b.title = pal.label;
    const c = document.createElement('canvas'); c.width = 120; c.height = 40;
    const src = genFlow({ ...P.flow, palette: k }, 60, 20, 3);
    const x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(src, 0, 0, 120, 40);
    const sp = document.createElement('span'); sp.textContent = pal.label;
    b.append(c, sp); b.classList.toggle('active', P.flow.palette === k); box.appendChild(b);
  }
}
function applyFlowToAll() {
  P.slides.forEach(s => (s.bg.type = 'flow'));
  syncUI(); changed();
}
$('#flowPicker').addEventListener('click', e => {
  const b = e.target.closest('button[data-flow]'); if (!b) return;
  P.flow.palette = b.dataset.flow;
  $$('#flowPicker button').forEach(x => x.classList.toggle('active', x === b));
  const before = P.slides.filter(s => s.bg.type !== 'flow').length;
  applyFlowToAll();
  if (before) toast('Verlauf auf alle Slides angewendet.');
});
$('#btnFlowShuffle').onclick = () => { P.flow.seed = Math.floor(Math.random() * 1e6); buildFlowPicker(); applyFlowToAll(); };
$('#btnFlowAll').onclick = applyFlowToAll;

function buildStatic() {
  buildFlowPicker();
  const eg = $('#emojiGrid');
  EMOJI_SET.forEach(ch => {
    const b = document.createElement('button'); b.type = 'button'; b.textContent = ch; b.dataset.emoji = ch;
    b.title = 'Emoji einfügen'; eg.appendChild(b);
  });
}

/* Farbfelder (Marke + eigene) – werden bei jeder Synchronisierung neu aufgebaut */
function swatchBtn(v, bg, title, textColor) {
  const b = document.createElement('button'); b.type = 'button'; b.dataset.v = v; b.title = title;
  b.setAttribute('aria-label', title); b.style.background = bg;
  if (textColor) b.innerHTML = `<span class="t" style="background:${textColor}"></span>`;
  return b;
}
function rebuildSwatches() {
  $$('.swatches').forEach(g => {
    const type = g.dataset.type;
    g.innerHTML = '';
    if (type === 'scheme') {
      for (const [k, s] of Object.entries(SCHEMES)) g.appendChild(swatchBtn(k, COLORS[s.bar], s.label, COLORS[s.text]));
      for (const c of P.customSchemes) g.appendChild(swatchBtn(c.id, c.bar, 'Eigene Kombination', c.text));
    } else if (type === 'bar') {
      const none = swatchBtn('', 'transparent', 'Ohne Balken'); none.classList.add('none-swatch');
      none.innerHTML = '<svg class="i"><use href="#i-none"/></svg>'; g.appendChild(none);
      for (const [k, s] of Object.entries(SCHEMES)) g.appendChild(swatchBtn(k, COLORS[s.bar], s.label, COLORS[s.text]));
      for (const c of P.customSchemes) g.appendChild(swatchBtn(c.id, c.bar, 'Eigene Kombination', c.text));
    } else if (type === 'elscheme' || type === 'elcolor') {
      const auto = swatchBtn('', 'transparent', 'Automatisch (wie Vorlage)'); auto.classList.add('auto-swatch'); auto.textContent = 'A'; g.appendChild(auto);
      if (type === 'elscheme') {
        for (const [k, s] of Object.entries(SCHEMES)) g.appendChild(swatchBtn(k, COLORS[s.bar], s.label, COLORS[s.text]));
        for (const c of P.customSchemes) g.appendChild(swatchBtn(c.id, c.bar, 'Eigene Kombination', c.text));
      } else {
        for (const k of Object.keys(COLOR_LABEL)) g.appendChild(swatchBtn(k, COLORS[k], COLOR_LABEL[k]));
        for (const c of P.customColors) g.appendChild(swatchBtn(c, c, c.toUpperCase()));
      }
    } else if (type === 'tcolor') {
      for (const k of Object.keys(COLOR_LABEL)) g.appendChild(swatchBtn(k, COLORS[k], COLOR_LABEL[k]));
      for (const c of P.customColors) g.appendChild(swatchBtn(c, c, c.toUpperCase()));
    } else if (type === 'overlay') {
      for (const k of OVERLAY_COLORS) g.appendChild(swatchBtn(k, colorOf(k), COLOR_LABEL[k] || 'Schwarz'));
      for (const c of P.customColors) if (!OVERLAY_COLORS.includes(c)) g.appendChild(swatchBtn(c, c, c.toUpperCase()));
    } else {
      for (const k of Object.keys(COLOR_LABEL)) g.appendChild(swatchBtn(k, COLORS[k], COLOR_LABEL[k]));
      for (const c of P.customColors) g.appendChild(swatchBtn(c, c, c.toUpperCase()));
    }
    if (type === 'scheme' || type === 'color') {
      const add = document.createElement('button'); add.type = 'button'; add.className = 'add-swatch';
      add.title = type === 'scheme' ? 'Eigene Kombination' : 'Eigene Farbe'; add.setAttribute('aria-label', add.title);
      add.innerHTML = '<svg class="i"><use href="#i-plus"/></svg>';
      g.appendChild(add);
    }
  });
}

const LABELS = {
  balken: { h: 'Headline', hp: 'Eine Zeile pro Balken', s: 'Unterzeile', b: 'Text', bp: '' },
  text:   { h: 'Headline', hp: 'Eine Zeile pro Balken', s: 'Unterzeile', b: 'Fließtext', bp: 'Leerzeile = neuer Absatz' },
  liste:  { h: 'Headline', hp: 'Eine Zeile pro Balken', s: 'Unterzeile', b: 'Punkte', bp: 'Ein Punkt pro Zeile' },
  zahl:   { h: 'Text unter der Zahl', hp: 'Eine Zeile pro Balken', s: 'Unterzeile', b: 'Erklärung', bp: 'Quelle oder Einordnung' },
  zitat:  { h: 'Zitat', hp: 'Ohne Anführungszeichen', s: 'Name', b: 'Funktion / Ort', bp: '' },
  bild:   { h: 'Bildtext', hp: 'Optional, z. B. Ort oder Anlass', s: 'Unterzeile', b: '', bp: '' },
  event:  { h: 'Titel', hp: 'Eine Zeile pro Balken', s: 'Thema / Untertitel', b: 'Beschreibung', bp: 'Optional, kurz halten' },
};

function syncUI() {
  const s = slide();
  renderLayers();
  rebuildSwatches();
  $('#slideNo').textContent = `${cur + 1} / ${P.slides.length}`;
  $$('[data-bind]').forEach(el => {
    const v = getPath(s, el.dataset.bind);
    if (el.classList.contains('seg') || el.classList.contains('swatches')) {
      $$('button', el).forEach(b => b.classList.toggle('active', b.dataset.v === (v ?? '')));
    } else if (el.type === 'checkbox') el.checked = !!v;
    else if (document.activeElement !== el) el.value = v ?? (el.dataset.default === 'inherit-shadow' ? (s.shadow || 0) : el.dataset.default) ?? '';
  });
  $$('#projectPanel [data-pbind]').forEach(el => {
    const v = getPath(P, el.dataset.pbind);
    if (el.classList.contains('seg')) $$('button', el).forEach(b => b.classList.toggle('active', b.dataset.v === v));
    else if (el.type === 'checkbox') el.checked = !!v;
    else if (document.activeElement !== el) el.value = v ?? '';
  });
  // Freie Position: keine Ecke markieren
  if (typeof P.logo.x === 'number') $$('[data-pbind="logo.pos"] button').forEach(b => b.classList.remove('active'));
  if (typeof P.abs.x === 'number') $$('[data-pbind="abs.pos"] button').forEach(b => b.classList.remove('active'));
  if (typeof s.stoerer.x === 'number') $$('[data-bind="stoerer.pos"] button').forEach(b => b.classList.remove('active'));

  $$('[data-layouts]').forEach(el => (el.hidden = !el.dataset.layouts.split(' ').includes(s.layout)));
  $$('[data-bg]').forEach(el => (el.hidden = !el.dataset.bg.split(' ').includes(s.bg.type)));
  $('#gradField').hidden = !s.bg.color2;
  $('#gradToggle').checked = !!s.bg.color2;
  $('#absFields').hidden = !P.abs.on;
  updateVals();
  syncPropResets();
  syncMode();
  renderLineStyles();
  renderPeople();

  const f = fmt();
  $('#safeField').hidden = !f.safe || !!f.print;
  $('#panoZoomField').hidden = !P.panorama.src;
  $('#btnPanoRemove').hidden = !P.panorama.src;
  $('#panoBtnText').textContent = P.panorama.src ? 'Ersetzen' : 'Foto laden';
  $('#panoHint').hidden = s.bg.type !== 'panorama' || !!P.panorama.src;
  const lp = $('#logoPreview');
  lp.style.backgroundImage = P.logo.src ? `url("${P.logo.src}")` : ''; lp.classList.toggle('has', !!P.logo.src);
  $('#logoCustomActions').hidden = !(P.logo.src && P.logo.choice === 'custom');
  $$('#logoPicker button').forEach(b => b.classList.toggle('active', b.dataset.logo === (P.logo.choice || 'fraktion')));
  $('#logoPosField').hidden = P.logo.choice === 'none';
  $$('#flowPicker button').forEach(b => b.classList.toggle('active', b.dataset.flow === P.flow.palette));
  $('#schemeRemove').hidden = !P.customSchemes.some(c => c.id === s.scheme);
  $('#colorRemove').hidden = !(s.bg.type === 'color' && P.customColors.includes(s.bg.color));
  syncEmojis();

  const fs = $('#fontStatus');
  const ok = fontState.uploaded || fontState.installed;
  fs.className = 'status ' + (ok ? 'ok' : 'warn');
  fs.innerHTML = `<svg class="i"><use href="#${ok ? 'i-check' : 'i-alert'}"/></svg>` +
    (fontState.uploaded ? 'Eigene Schrift' : fontState.installed ? 'GrueneType Neue' : 'Ersatzschrift aktiv');
  $('#btnFontReset').hidden = !fontState.uploaded;
  $('#btnLeft').disabled = cur === 0;
  $('#btnRight').disabled = cur === P.slides.length - 1;
  $('#btnDel').disabled = P.slides.length < 2;
}
function updateVals() {
  const s = slide();
  $$('[data-val]').forEach(el => {
    const v = getPath(s, el.dataset.val);
    let v2 = v;
    if (v2 == null || v2 === '') v2 = el.dataset.def === 'inherit-shadow' ? (s.shadow || 0) : el.dataset.def != null ? +el.dataset.def : null;
    if (v2 == null || isNaN(v2)) { el.textContent = ''; return; }
    const fmt = el.dataset.fmt || (el.dataset.val === 'angle' ? 'deg' : 'pct');
    el.textContent = fmt === 'deg' ? `${Math.round(v2)}°` : fmt === 'px' ? `${Math.round(v2)} px` : `${Math.round(v2 * 100)} %`;
  });
}

function syncEmojis() {
  const s = slide();
  if (selEmoji >= s.emojis.length) selEmoji = -1;
  if (selItem >= (s.items || []).length) selItem = -1;
  syncSel();
}
function addEmoji(ch) {
  ch = (ch || '').trim(); if (!ch) return;
  const s = slide(); const n = s.emojis.length;
  s.emojis.push({ ch, x: clamp(0.5 + (n % 4) * 0.06, 0.1, 0.9), y: clamp(0.4 + (n % 4) * 0.06, 0.1, 0.9), size: 0.16, rot: 0 });
  selEmoji = s.emojis.length - 1;
  ensureEmojiIds(s);
  { const eid = 'emoji:' + s.emojis[selEmoji].id; s.order = [...orderedIds(s).filter(x => x !== eid), eid]; }
  syncUI(); changed();
  openLayerRow('emoji:' + s.emojis[selEmoji].id);
}

function select(i) {
  selEmoji = -1; stoererSel = false; selElKey = null; selItem = -1;
  cur = clamp(i, 0, P.slides.length - 1);
  syncUI(); scheduleRender(); scheduleThumbs(true);
}

/* ---- Eingaben ---- */
/* ---- Eigene Farben ---- */
let colorTarget = null; // 'bg.color' | 'bg.color2'
document.addEventListener('click', e => {
  const add = e.target.closest('.add-swatch'); if (!add) return;
  const g = add.parentElement;
  if (g.dataset.type === 'scheme') { $('#schemeEditor').hidden = !$('#schemeEditor').hidden; return; }
  colorTarget = g.dataset.bind;
  const pick = $('#colorPick'); pick.value = colorOf(getPath(slide(), colorTarget) || 'klee'); pick.click();
});
$('#colorPick').addEventListener('change', e => {
  const hex = e.target.value.toLowerCase();
  if (!P.customColors.includes(hex) && !Object.values(COLORS).map(c => c.toLowerCase()).includes(hex)) P.customColors.push(hex);
  const key = Object.keys(COLORS).find(k => COLORS[k].toLowerCase() === hex) || hex;
  if (colorTarget) setPath(slide(), colorTarget, key);
  syncUI(); changed();
});
$('#ceAdd').onclick = () => {
  const c = { id: 'c' + Date.now().toString(36), bar: $('#ceBar').value, text: $('#ceText').value };
  P.customSchemes.push(c); slide().scheme = c.id; $('#schemeEditor').hidden = true;
  syncUI(); changed();
};
$('#ceCancel').onclick = () => ($('#schemeEditor').hidden = true);
$('#schemeRemove').onclick = () => {
  const id = slide().scheme;
  P.customSchemes = P.customSchemes.filter(c => c.id !== id);
  P.slides.forEach(s => { if (s.scheme === id) s.scheme = 'tanne'; });
  syncUI(); changed();
};
$('#colorRemove').onclick = () => {
  const hex = slide().bg.color;
  P.customColors = P.customColors.filter(c => c !== hex);
  P.slides.forEach(s => { if (s.bg.color === hex) s.bg.color = 'klee'; if (s.bg.color2 === hex) s.bg.color2 = 'tanne'; if (s.bg.ovColor === hex) s.bg.ovColor = 'tanne'; });
  syncUI(); changed();
};
$('#gradToggle').addEventListener('change', e => {
  const bg = slide().bg;
  bg.color2 = e.target.checked ? (bg.color === 'tanne' ? 'klee' : 'tanne') : null;
  syncUI(); changed();
});

/* ---- Ein-/ausklappbare Bereiche (Zustand bleibt gespeichert) ---- */
const SEC_KEY = 'sharepic-sections';
let secState = {};
try { secState = JSON.parse(localStorage.getItem(SEC_KEY) || '{}'); } catch {}
$$('details.sec[data-sec]').forEach(d => {
  if (d.dataset.sec in secState) d.open = secState[d.dataset.sec];
  d.addEventListener('toggle', () => {
    secState[d.dataset.sec] = d.open;
    try { localStorage.setItem(SEC_KEY, JSON.stringify(secState)); } catch {}
  });
});

/* ---- Logo-Auswahl ---- */
$('#logoPicker').addEventListener('click', e => {
  const b = e.target.closest('button[data-logo]'); if (!b) return;
  if (b.dataset.logo === 'custom' && !P.logo.src) { $('#fileLogo').click(); return; }
  P.logo.choice = b.dataset.logo; syncUI(); changed();
});

/* ---- Emojis ---- */
$('#emojiGrid').addEventListener('click', e => { const b = e.target.closest('button[data-emoji]'); if (b) addEmoji(b.dataset.emoji); });
$('#btnEmojiAdd').onclick = () => { addEmoji($('#emojiInput').value); $('#emojiInput').value = ''; };
$('#emojiInput').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); $('#btnEmojiAdd').click(); } });
function deleteEmoji() {
  const s = slide(); if (selEmoji < 0 || !s.emojis[selEmoji]) return;
  s.emojis.splice(selEmoji, 1); selEmoji = -1; openLayer = null; syncUI(); changed();
}

document.addEventListener('input', e => {
  const el = e.target;
  if (!el.dataset.bind && !el.dataset.pbind) return;
  const val = el.type === 'checkbox' ? el.checked : (el.type === 'range' ? parseFloat(el.value) : el.value);
  if (el.dataset.bind) {
    setPath(slide(), el.dataset.bind, val);
    if (el.type === 'checkbox') syncUI(); else updateVals();
    if (el.dataset.bind === 'headline' || el.dataset.bind === 'sub') renderLineStyles();
    if (/\.wrap$/.test(el.dataset.bind)) ensureHyphenator();
    renderLayers(); syncPropResets();
    changed();
  } else if (el.dataset.pbind) {
    setPath(P, el.dataset.pbind, val);
    if (el.dataset.pbind === 'format') { syncUI(); scheduleThumbs(true); }
    else if (el.type === 'checkbox') syncUI();
    changed();
  }
});
document.addEventListener('click', e => {
  const b = e.target.closest('.seg button, .swatches button');
  if (!b || b.dataset.v === undefined) return;
  const g = b.parentElement;
  if (g.dataset.bind === 'stoerer.pos') { delete slide().stoerer.x; delete slide().stoerer.y; }
  if (g.dataset.pbind === 'logo.pos') { delete P.logo.x; delete P.logo.y; }
  if (g.dataset.pbind === 'abs.pos') { delete P.abs.x; delete P.abs.y; }
  if (g.dataset.bind === 'posY' || g.dataset.bind === 'align') slide().off = { x: 0, y: 0 }; // frei verschobenen Text zurücksetzen
  if (g.dataset.bind) setPath(slide(), g.dataset.bind, b.dataset.v);
  else if (g.dataset.pbind) setPath(P, g.dataset.pbind, b.dataset.v);
  else return;
  if (g.dataset.bind === 'bg.type' && b.dataset.v === 'image' && !slide().bg.src) $('#fileBg').click();
  if (g.dataset.bind === 'layout' && b.dataset.v === 'bild') {
    const bg = slide().bg;
    if (bg.src) bg.type = 'image'; else $('#fileBg').click();
    if (bg.overlay > 0.3) bg.overlay = 0.25;
  }
  if (/\.wrap$/.test(g.dataset.bind || '') && b.dataset.v === 'hyph') ensureHyphenator();
  if (g.dataset.bind === 'bg.type' && b.dataset.v === 'panorama' && !P.panorama.src) $('#filePano').click();
  syncUI(); changed();
});

/* ---- Slides verwalten ---- */
$('#strip').addEventListener('click', e => { if (suppressClick) return; const t = e.target.closest('.thumb'); if (t) select(+t.dataset.i); });
function moveSlide(from, to) {
  if (from === to || to < 0 || to >= P.slides.length) return;
  const [s] = P.slides.splice(from, 1); P.slides.splice(to, 0, s);
  cur = to; syncUI(); changed(); scheduleThumbs(true);
}
$('#btnLeft').onclick = () => moveSlide(cur, cur - 1);
$('#btnRight').onclick = () => moveSlide(cur, cur + 1);
$('#btnAdd').onclick = () => {
  const c = slide();
  if (P.slides.length >= 35) return toast('Mehr als 35 Slides unterstützt keine Plattform.');
  const s = newSlide({ layout: 'text', headline: 'Neue Slide', body: 'Hier steht dein Text.', posY: 'top', angle: c.angle,
                       scheme: c.scheme, bg: { ...c.bg }, showLogo: c.showLogo, showAbsender: c.showAbsender });
  P.slides.splice(cur + 1, 0, s);
  select(cur + 1); changed();
};
// Bild-Slide: Foto vollflächig, Bildtext optional
$('#addImageSlide').addEventListener('change', async e => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  if (P.slides.length >= 35) return toast('Mehr als 35 Slides unterstützt keine Plattform.');
  try {
    const src = await readImage(f);
    const c = slide();
    const s = newSlide({ layout: 'bild', headline: '', sub: '', posY: 'bottom', angle: c.angle, scheme: c.scheme,
                         bg: { type: 'image', src, zoom: 1, x: 0.5, y: 0.5, overlay: 0.25, ovMode: 'bottom' },
                         stoerer: { on: false }, showLogo: c.showLogo, showAbsender: c.showAbsender });
    P.slides.splice(cur + 1, 0, s);
    select(cur + 1); changed();
  } catch (err) { toast(err.message); }
});
$('#btnDup').onclick = () => {
  if (P.slides.length >= 35) return toast('Mehr als 35 Slides unterstützt keine Plattform.');
  const s = newSlide({ ...JSON.parse(JSON.stringify(slide())), id: undefined });
  s.id = 's' + Date.now().toString(36) + (uid++);
  P.slides.splice(cur + 1, 0, s); select(cur + 1); changed();
};
$('#btnDel').onclick = () => {
  if (P.slides.length < 2) return;
  P.slides.splice(cur, 1); select(Math.min(cur, P.slides.length - 1)); changed();
};

/* ---- Dateien ---- */
$('#fileBg').onchange = async e => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  try { setBgImage(await readImage(f)); } catch (err) { toast(err.message); }
};
function setBgImage(src) {
  const s = slide(); s.bg.src = src; s.bg.type = 'image'; s.bg.zoom = 1; s.bg.x = 0.5; s.bg.y = 0.5;
  syncUI(); changed();
}
$('#filePano').onchange = async e => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  try {
    P.panorama.src = await readImage(f, { max: 5000 });
    P.panorama.zoom = 1; P.panorama.x = 0.5; P.panorama.y = 0.5;
    P.slides.forEach(s => (s.bg.type = 'panorama'));
    toast('Panorama auf alle Slides angewendet.');
    syncUI(); changed();
  } catch (err) { toast(err.message); }
};
$('#btnPanoRemove').onclick = () => {
  P.panorama.src = null;
  P.slides.forEach(s => { if (s.bg.type === 'panorama') s.bg.type = 'color'; });
  syncUI(); changed();
};
$('#fileLogo').onchange = async e => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  try { P.logo.src = await readImage(f, { max: 1200, alpha: true }); P.logo.choice = 'custom'; syncUI(); changed(); } catch (err) { toast(err.message); }
};
$('#btnLogoRemove').onclick = () => { P.logo.src = null; if (P.logo.choice === 'custom') P.logo.choice = 'fraktion'; syncUI(); changed(); };
$('#fileFont').onchange = async e => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  try {
    const buf = await f.arrayBuffer();
    await loadFontBuffer(buf.slice(0));
    try { localStorage.setItem(FONT_KEY, bufToB64(buf)); } catch { toast('Schrift aktiv, aber zu groß zum dauerhaften Speichern.'); }
    syncUI(); changed(); scheduleThumbs(true);
  } catch { toast('Schriftdatei konnte nicht geladen werden.'); }
};
$('#btnFontReset').onclick = () => {
  fontState.uploaded = false;
  try { localStorage.removeItem(FONT_KEY); } catch {}
  syncUI(); changed(); scheduleThumbs(true);
};

/* Drop auf Vorschau */
const wrap = $('#canvasWrap');
wrap.addEventListener('dragover', e => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); wrap.classList.add('drop'); } });
wrap.addEventListener('dragleave', () => wrap.classList.remove('drop'));
wrap.addEventListener('drop', async e => {
  wrap.classList.remove('drop');
  const f = [...e.dataTransfer.files].find(x => x.type.startsWith('image/'));
  if (!f) return; e.preventDefault();
  try { setBgImage(await readImage(f)); } catch (err) { toast(err.message); }
});

/* ============ Vorschau: Auswählen, Verschieben, Größe, Drehen ============ */
let drag = null;
function canvasPoint(e) {
  const f = fmt(), r = preview.getBoundingClientRect();
  return { x: (e.clientX - r.left) * f.w / r.width, y: (e.clientY - r.top) * f.h / r.height, f };
}
function onStoerer(x, y) { return G.stoerer && Math.hypot(x - G.stoerer.cx, y - G.stoerer.cy) <= G.stoerer.r; }
function elAt(x, y) {
  const pad = 6 * uiScale(), els = G.els || [];
  for (let i = els.length - 1; i >= 0; i--) { const b = els[i]; if (x >= b.x0 - pad && x <= b.x1 + pad && y >= b.y0 - pad && y <= b.y1 + pad) return b.key; }
  return null;
}
function onEl(k, x, y) { const b = G[k], pad = 8 * uiScale(); return b && Math.abs(x - b.cx) <= b.hw + pad && Math.abs(y - b.cy) <= b.hh + pad; }
// Treffer in Ebenen-Reihenfolge: die vorderste Ebene gewinnt
function hitAny(x, y) {
  const s = slide(), ids = orderedIds(s), pad = 6 * uiScale();
  for (let i = ids.length - 1; i >= 0; i--) {
    const id = ids[i];
    if (id.startsWith('el:')) {
      const b = elBox(id.slice(3));
      if (b && x >= b.x0 - pad && x <= b.x1 + pad && y >= b.y0 - pad && y <= b.y1 + pad) return ['el', id.slice(3)];
    } else if (id === 'stoerer') { if (onStoerer(x, y)) return ['stoerer']; }
    else if (id === 'logo' || id === 'abs') { if (onEl(id, x, y)) return [id]; }
    else if (id.startsWith('item:')) {
      const idx = s.items.findIndex(it => 'item:' + it.id === id);
      if (idx >= 0 && hitOneItem(s.items[idx], x, y)) return ['item', idx];
    } else if (id.startsWith('emoji:')) {
      const idx = s.emojis.findIndex(e => 'emoji:' + e.id === id);
      if (idx >= 0 && hitOneEmoji(s.emojis[idx], x, y)) return ['emoji', idx];
    }
  }
  return null;
}
function setSel(type, idx = -1) {
  selEmoji = type === 'emoji' ? idx : -1;
  stoererSel = type === 'stoerer';
  selElKey = type === 'el' ? idx : null;
  selItem = type === 'item' ? idx : -1;
  elSel = type === 'logo' || type === 'abs' ? type : null;
  syncEmojis(); scheduleRender();
  // Auswahl-Bereich sitzt oben im Editor: in der Desktop-Ansicht dorthin scrollen
}
// Logo/Absender/Störer beim ersten Anfassen von Ecke auf freie Position umstellen
function makeFree(t) {
  const c = target(t).center();
  const o = t === 'stoerer' ? slide().stoerer : t === 'logo' ? P.logo : t === 'abs' ? P.abs : null;
  if (o) { o.x = c.x / G.W; o.y = c.y / G.H; }
}
// Element-Adapter: Mittelpunkt lesen/setzen, Größe lesen/setzen
function target(type) {
  const s = slide(), W = G.W, H = G.H;
  if (type === 'emoji') {
    const e = s.emojis[selEmoji];
    return { center: () => ({ x: e.x * W, y: e.y * H }), move: (x, y) => { e.x = clamp(x / W, 0, 1); e.y = clamp(y / H, 0, 1); },
             size: () => e.size, setSize: v => (e.size = clamp(v, 0.04, 0.6)), rot: () => e.rot || 0, setRot: v => (e.rot = v) };
  }
  if (type === 'stoerer') {
    const st = s.stoerer;
    return { center: () => ({ x: G.stoerer.cx, y: G.stoerer.cy }), move: (x, y) => { st.x = clamp(x / W, 0, 1); st.y = clamp(y / H, 0, 1); },
             size: () => st.size, setSize: v => (st.size = clamp(v, 0.6, 1.6)) };
  }
  if (type === 'el') {
    const key = selElKey;
    if (!s.el) s.el = {};
    if (!s.el[key]) s.el[key] = {};
    const e = s.el[key];
    return { center: () => { const b = elBox(key); return { x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2 }; },
             move: (x, y, c0, off0) => { e.dx = off0.x + (x - c0.x) / W; e.dy = off0.y + (y - c0.y) / H; },
             size: () => e.scale || 1, setSize: v => (e.scale = clamp(v, 0.3, 3)) };
  }
  if (type === 'item') {
    const it = s.items[selItem];
    return { center: () => ({ x: it.x * W, y: it.y * H }), move: (x, y) => { it.x = clamp(x / W, 0, 1); it.y = clamp(y / H, 0, 1); },
             size: () => it.size, setSize: v => (it.size = clamp(v, it.kind === 'image' ? 0.04 : 12, it.kind === 'image' ? 1.5 : 600)),
             rot: () => it.rot || 0, setRot: v => (it.rot = v) };
  }
  if (type === 'logo' || type === 'abs') {
    const o = type === 'logo' ? P.logo : P.abs, k = type;
    const [lo, hi] = type === 'logo' ? [0.04, 0.5] : [0.4, 3];
    return { center: () => ({ x: G[k].cx, y: G[k].cy }), move: (x, y) => { o.x = clamp(x / W, 0, 1); o.y = clamp(y / H, 0, 1); },
             size: () => o.size, setSize: v => (o.size = clamp(v, lo, hi)) };
  }
  return null;
}
function snap(x, y) {
  const t = 12 * uiScale();
  guides = { v: Math.abs(x - G.W / 2) < t, h: Math.abs(y - G.H / 2) < t };
  return { x: guides.v ? G.W / 2 : x, y: guides.h ? G.H / 2 : y };
}

preview.addEventListener('pointerdown', e => {
  if (e.button > 0) return;
  const p = canvasPoint(e);
  const type = selType();
  const h = handleAt(p.x, p.y);
  let mode = null, t = null;
  if (h && type) { mode = h; t = type; }
  else {
    const hit = hitAny(p.x, p.y);
    if (hit) { setSel(hit[0], hit[1]); t = hit[0]; mode = 'move'; }
  }
  if (mode) {
    const tg = target(t), c0 = tg.center(), s = slide();
    if (mode === 'move') makeFree(t);
    drag = { mode, t, tg, p0: p, c0, size0: tg.size(), box0: selBox(), w0: t === 'el' ? (elOf(s, selElKey).w || 1) : 1, rot0: tg.rot ? tg.rot() : 0, off0: offOf(t), moved: false };
  } else {
    if (type) setSel(null);
    const f = fmt();
    const g = bgGeom(slide(), cur, P.slides.length, f.w, f.h);
    if (!g) return;
    drag = { mode: 'pan', x: e.clientX, y: e.clientY, g, scale: uiScale() };
  }
  preview.setPointerCapture(e.pointerId); preview.classList.add('dragging');
});

preview.addEventListener('pointermove', e => {
  const p = canvasPoint(e);
  if (!drag) {
    const h = handleAt(p.x, p.y);
    preview.style.cursor = h === 'resize' ? 'nwse-resize' : h === 'width' ? 'ew-resize' : h === 'rotate' ? 'crosshair'
      : hitAny(p.x, p.y) ? 'move'
      : bgGeom(slide(), cur, P.slides.length, G.W, G.H) ? 'grab' : 'default';
    return;
  }
  drag.moved = true;
  if (drag.mode === 'pan') {
    const dx = (e.clientX - drag.x) * drag.scale, dy = (e.clientY - drag.y) * drag.scale;
    drag.x = e.clientX; drag.y = e.clientY;
    const { cfg, spanX, spanY } = drag.g;
    if (Math.abs(spanX) > 1) cfg.x = clamp(cfg.x + dx / spanX, 0, 1);
    if (Math.abs(spanY) > 1) cfg.y = clamp(cfg.y + dy / spanY, 0, 1);
  } else if (drag.mode === 'move') {
    const c = e.shiftKey ? (guides = { v: false, h: false }, { x: drag.c0.x + p.x - drag.p0.x, y: drag.c0.y + p.y - drag.p0.y })
                         : snap(drag.c0.x + p.x - drag.p0.x, drag.c0.y + p.y - drag.p0.y);
    drag.tg.move(c.x, c.y, drag.c0, drag.off0);
  } else if (drag.mode === 'width') {
    // Textbreite: linker Rand bleibt (bei Mitte-Ausrichtung symmetrisch)
    const b0 = drag.box0, center = slide().align === 'center';
    const newW = center ? 2 * Math.abs(p.x - b0.cx) : p.x - (b0.cx - b0.hw);
    const s = slide(); if (!s.el) s.el = {}; const e = (s.el[selElKey] = s.el[selElKey] || {});
    e.w = clamp(drag.w0 * newW / Math.max(1, 2 * b0.hw), 0.2, 1);
  } else if (drag.mode === 'resize') {
    const d0 = Math.hypot(drag.p0.x - drag.c0.x, drag.p0.y - drag.c0.y) || 1;
    const d1 = Math.hypot(p.x - drag.c0.x, p.y - drag.c0.y);
    drag.tg.setSize(drag.size0 * d1 / d0);
  } else if (drag.mode === 'rotate') {
    const a0 = Math.atan2(drag.p0.y - drag.c0.y, drag.p0.x - drag.c0.x);
    const a1 = Math.atan2(p.y - drag.c0.y, p.x - drag.c0.x);
    let deg = drag.rot0 + (a1 - a0) * 180 / Math.PI;
    deg = ((deg + 540) % 360) - 180;
    if (!e.shiftKey) { const r = Math.round(deg / 15) * 15; if (Math.abs(deg - r) < 4) deg = r; } // rastet bei 15°-Schritten
    drag.tg.setRot(Math.round(deg));
  }
  scheduleRender();
});

const endDrag = () => {
  if (!drag) return;
  const wasMove = drag.moved;
  drag = null; guides = { v: false, h: false };
  preview.classList.remove('dragging');
  syncEmojis(); updateVals();
  if (wasMove) { syncUI(); changed(); } else scheduleRender();
};
preview.addEventListener('pointerup', endDrag);
preview.addEventListener('pointercancel', endDrag);
preview.addEventListener('dblclick', e => {
  const p = canvasPoint(e);
  // Doppelklick: passende Ebene öffnen und ins Textfeld springen
  const hit = hitAny(p.x, p.y);
  if (!hit) return;
  if (hit[0] === 'abs') { const ta = $('#absender'); ta.focus(); ta.select(); return; }
  setSel(hit[0], hit[1]);
  const id = layerIdOfSel(); if (id) openLayerRow(id, true);
});
preview.addEventListener('wheel', e => {
  if (e.ctrlKey || e.metaKey) { e.preventDefault(); setZoom(zoom * (1 - e.deltaY * 0.0015)); return; } // Strg + Mausrad = Zoom
  const s = slide();
  const p = canvasPoint(e);
  const k = 1 - e.deltaY * 0.0012;
  const hit = hitEmoji(s, p.x, p.y, G.W, G.H);
  if (hit >= 0) { e.preventDefault(); setSel('emoji', hit); target('emoji').setSize(s.emojis[hit].size * k); syncEmojis(); changed(); return; }
  if (onStoerer(p.x, p.y)) { e.preventDefault(); setSel('stoerer'); s.stoerer.size = clamp(s.stoerer.size * k, 0.6, 1.6); syncUI(); changed(); return; }
  const hi = hitItem(s, p.x, p.y);
  if (hi >= 0) { e.preventDefault(); setSel('item', hi); const tg = target('item'); tg.setSize(tg.size() * k); syncUI(); changed(); return; }
  for (const el of ['logo', 'abs']) {
    if (onEl(el, p.x, p.y)) { e.preventDefault(); setSel(el); const tg = target(el); tg.setSize(tg.size() * k); syncUI(); changed(); return; }
  }
  const cfg = s.bg.type === 'image' && s.bg.src ? s.bg : s.bg.type === 'panorama' && P.panorama.src ? P.panorama : null;
  if (!cfg) return;
  e.preventDefault();
  cfg.zoom = clamp((cfg.zoom || 1) * k, 1, 4);
  syncUI(); changed();
}, { passive: false });

/* Tastatur: Pfeile verschieben das ausgewählte Element, sonst Slide wechseln */
document.addEventListener('keydown', e => {
  if (e.target.closest && e.target.closest('input, textarea, select, [contenteditable], .resizer')) return;
  const mod = e.ctrlKey || e.metaKey, key = e.key.toLowerCase();
  if (mod && key === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
  if (mod && key === 'y') { e.preventDefault(); redo(); return; }
  if (mod && key === 'd') { const id = layerIdOfSel(); if (id && (id.startsWith('item:') || id.startsWith('emoji:'))) { e.preventDefault(); duplicateLayer(id); } return; }
  const type = selType();
  const arrows = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
  if (arrows[e.key]) {
    if (!type) { if (e.key === 'ArrowLeft') select(cur - 1); if (e.key === 'ArrowRight') select(cur + 1); return; }
    e.preventDefault();
    const step = e.shiftKey ? 20 : 4, [ax, ay] = arrows[e.key];
    const tg = target(type), c = tg.center(), s = slide();
    makeFree(type);
    tg.move(c.x + ax * step, c.y + ay * step, c, offOf(type));
    changed(); return;
  }
  if (e.key === 'Escape' && type) { setSel(null); return; }
  if ((e.key === 'Delete' || e.key === 'Backspace') && type) {
    e.preventDefault();
    if (type === 'emoji') deleteEmoji();
    else if (type === 'item') deleteItem();
    else if (type === 'stoerer') { slide().stoerer.on = false; setSel(null); syncUI(); changed(); }
    else if (type === 'logo') { P.logo.choice = 'none'; setSel(null); syncUI(); changed(); }
    else if (type === 'abs') { P.abs.on = false; setSel(null); syncUI(); changed(); }
  }
});

/* ============ Slide-Leiste: Reihenfolge per Ziehen ============ */
let sdrag = null, suppressClick = false;
const stripEl = $('#strip');
stripEl.addEventListener('pointerdown', e => {
  const t = e.target.closest('.thumb');
  if (!t || e.button > 0 || e.pointerType === 'touch') return; // Touch: Leiste scrollen, Sortieren über die Buttons
  sdrag = { el: t, x0: e.clientX, started: false, order0: [...stripEl.children].map(c => +c.dataset.i), pid: e.pointerId };
});
window.addEventListener('pointermove', e => {
  if (!sdrag) return;
  if (!sdrag.started) {
    if (Math.abs(e.clientX - sdrag.x0) < 6) return;
    sdrag.started = true; sdrag.el.classList.add('lifted'); document.body.classList.add('sorting');
  }
  // Ziel-Slot: vor dem ersten Thumbnail, dessen Mitte rechts vom Zeiger liegt
  const others = [...stripEl.children].filter(c => c !== sdrag.el);
  let ref = null;
  for (const c of others) { const r = c.getBoundingClientRect(); if (e.clientX < r.left + r.width / 2) { ref = c; break; } }
  if (sdrag.el.nextElementSibling !== ref && !(ref === null && !sdrag.el.nextElementSibling)) {
    const before = new Map(others.map(c => [c, c.getBoundingClientRect().left]));
    stripEl.insertBefore(sdrag.el, ref);
    for (const c of others) { // FLIP: Nachbarn gleiten an ihren neuen Platz
      const dx = before.get(c) - c.getBoundingClientRect().left;
      if (!dx) continue;
      c.style.transition = 'none'; c.style.transform = `translateX(${dx}px)`;
      requestAnimationFrame(() => { c.style.transition = 'transform .16s ease'; c.style.transform = ''; });
    }
  }
  // Leiste automatisch scrollen am Rand
  const r = stripEl.getBoundingClientRect();
  if (e.clientX < r.left + 40) stripEl.scrollLeft -= 12; else if (e.clientX > r.right - 40) stripEl.scrollLeft += 12;
});
window.addEventListener('pointerup', () => {
  if (!sdrag) return;
  const { el, started } = sdrag; sdrag = null;
  if (!started) return;
  el.classList.remove('lifted'); document.body.classList.remove('sorting');
  suppressClick = true; setTimeout(() => (suppressClick = false), 0);
  const order = [...stripEl.children].map(c => +c.dataset.i);
  if (order.every((v, i) => v === i)) return;
  const curId = slide().id;
  P.slides = order.map(i => P.slides[i]);
  cur = P.slides.findIndex(s => s.id === curId);
  syncUI(); changed(); scheduleThumbs(true);
});

/* ============ Arbeitsbereiche: Social Media / Plakat ============ */
const TERMS = {
  social: { one: 'Slide', many: 'Slides', this: 'Auf dieser Slide zeigen', all: 'Auf alle Slides', exportOne: 'Diese Slide', scopeAll: 'Gilt für alle Slides', scopeOne: 'Nur diese Slide' },
  poster: { one: 'Plakat', many: 'Plakate', this: 'Auf diesem Plakat zeigen', all: 'Auf alle Plakate', exportOne: 'Dieses Plakat', scopeAll: 'Gilt für alle Plakate', scopeOne: 'Nur dieses Plakat' },
};
const term = k => TERMS[MODE][k];
function buildFormatSelect() {
  const sel = $('#formatSelect'); sel.innerHTML = '';
  const groups = {};
  for (const [k, f] of Object.entries(FORMATS)) {
    if (!isFormatFor(k, MODE)) continue;
    if (!groups[f.group]) { groups[f.group] = document.createElement('optgroup'); groups[f.group].label = f.group; sel.appendChild(groups[f.group]); }
    const o = document.createElement('option'); o.value = k; o.textContent = f.label; groups[f.group].appendChild(o);
  }
  sel.value = P.format;
}
function switchMode(m, project) {
  if (m === MODE && !project) return;
  if (recT) record();
  clearTimeout(saveT); save();
  MODE = m;
  try { localStorage.setItem(MODE_KEY, m); } catch {}
  P = project || loadProject(m) || defaultProject(m);
  cur = 0; selEmoji = -1; stoererSel = false; selElKey = null; selItem = -1; elSel = null;
  hist.stack = []; hist.idx = -1;
  buildFormatSelect(); buildFlowPicker();
  $('#exportType').value = m === 'poster' ? 'pdf' : 'png';
  $('#strip').innerHTML = '';
  syncUI(); scheduleRender(); scheduleThumbs(true); save(); record();
}
$$('.mode-tabs button').forEach(b => (b.onclick = () => switchMode(b.dataset.mode)));

function syncMode() {
  const f = fmt();
  $$('.mode-tabs button').forEach(b => { const on = b.dataset.mode === MODE; b.classList.toggle('active', on); b.setAttribute('aria-selected', on); });
  $$('[data-mode]:not(.mode-tabs button)').forEach(el => (el.hidden = el.dataset.mode !== MODE));
  $$('.term-one').forEach(el => (el.textContent = term('one')));
  $$('.term-this').forEach(el => (el.textContent = term('this')));
  $$('.term-all').forEach(el => (el.textContent = term('all')));
  $$('.term-scope-all').forEach(el => (el.textContent = term('scopeAll')));
  $$('.term-scope-one').forEach(el => (el.textContent = term('scopeOne')));
  $('#karTitle').textContent = MODE === 'poster' ? 'Hintergrund-Verlauf' : 'Karussell';
  $('#bleedField').hidden = !f.print;
  $('#printInfo').hidden = !f.print;
  if (f.print) $('#printInfo').textContent = `${f.mmW} × ${f.mmH} mm · ${f.w} × ${f.h} px · ${f.dpi} dpi`;
  const pdfOpt = $('#exportType option[value=pdf]');
  pdfOpt.hidden = MODE !== 'poster';
  if (MODE !== 'poster' && $('#exportType').value === 'pdf') $('#exportType').value = 'png';
  syncExportLabels();
  $('#btnAdd').title = `${term('one')} hinzufügen`; $('#btnAdd').setAttribute('aria-label', `${term('one')} hinzufügen`);
}
function syncExportLabels() {
  const n = P.slides.length, pdf = $('#exportType').value === 'pdf';
  $('#exportOneText').textContent = term('exportOne');
  $('#exportAllText').textContent = pdf ? (n > 1 ? 'Alle als PDF' : 'Als PDF') : (n > 1 ? 'Alle als ZIP' : 'Herunterladen');
}
$('#exportType').addEventListener('change', syncExportLabels);

/* ============ Zeilen-Steuerung (Farbschema, Größe, Einrückung pro Balken) ============ */
function renderLineStyles() {
  const box = $('#lineStyles');
  if (!box || box.closest('[hidden]') || box.contains(document.activeElement)) return;
  const s = slide();
  const lines = s.headline.split('\n').map(l => l.trim()).filter(Boolean);
  const rows = lines.map((t, i) => ({ key: String(i), label: String(i + 1), text: t, st: (s.lineStyle || [])[i] || {} }));
  if (s.sub.trim() && s.layout !== 'zitat') rows.push({ key: 'sub', label: 'U', text: s.sub, st: s.subStyle || {} });
  const opts = [['', 'Auto'], ...Object.entries(SCHEMES).map(([k, v]) => [k, v.label]), ...P.customSchemes.map((c, i) => [c.id, `Eigene ${i + 1}`])];
  box.innerHTML = '';
  for (const r of rows) {
    const row = document.createElement('div');
    row.className = 'ls-row'; row.dataset.key = r.key; row.title = r.text;
    row.innerHTML = `<span class="ls-n">${r.label}</span>`
      + `<select class="ls-scheme" aria-label="Farbschema Zeile ${r.label}">${opts.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select>`
      + `<div class="seg ls-size" aria-label="Größe Zeile ${r.label}">${Object.keys(SIZE_MULT).map(z => `<button type="button" data-z="${z}">${z}</button>`).join('')}</div>`
      + `<input type="range" class="ls-indent" min="0" max="1" step="0.05" aria-label="Einrückung Zeile ${r.label}">`
      + `<button type="button" class="ls-reset prop-like" data-tip="Zeile zurücksetzen" aria-label="Zeile ${r.label} zurücksetzen"${Object.keys(r.st).length ? '' : ' hidden'}><svg class="i"><use href="#i-reset"/></svg></button>`;
    row.querySelector('.ls-scheme').value = r.st.scheme || '';
    $$('.ls-size button', row).forEach(b => b.classList.toggle('active', b.dataset.z === (r.st.size || 'L')));
    row.querySelector('.ls-indent').value = r.st.indent || 0;
    box.appendChild(row);
  }
  if (!rows.length) box.innerHTML = '<p class="meta">Erst Headline eingeben.</p>';
}
function lineStyleOf(key) {
  const s = slide();
  if (key === 'sub') { if (!s.subStyle) s.subStyle = {}; return s.subStyle; }
  if (!s.lineStyle) s.lineStyle = [];
  return (s.lineStyle[+key] = s.lineStyle[+key] || {});
}
function setLineStyle(key, prop, val) {
  const t = lineStyleOf(key);
  if (val === undefined || val === '' || val === null) delete t[prop]; else t[prop] = val;
  const row = $(`#lineStyles .ls-row[data-key="${key}"]`); if (row) row.querySelector('.ls-reset').hidden = !Object.keys(t).length;
  changed();
}
$('#layers').addEventListener('change', e => {
  const sel = e.target.closest('.ls-scheme'); if (!sel) return;
  setLineStyle(sel.closest('.ls-row').dataset.key, 'scheme', sel.value);
});
$('#layers').addEventListener('input', e => {
  const r = e.target.closest('.ls-indent'); if (!r) return;
  setLineStyle(r.closest('.ls-row').dataset.key, 'indent', parseFloat(r.value) || undefined);
});
$('#layers').addEventListener('click', e => {
  const rs = e.target.closest('.ls-reset');
  if (rs) {
    const key = rs.closest('.ls-row').dataset.key, s = slide();
    if (key === 'sub') s.subStyle = {}; else if (s.lineStyle) s.lineStyle[+key] = {};
    changed(); const box = $('#lineStyles'); if (box) box.innerHTML = ''; renderLineStyles(); return;
  }
  const b = e.target.closest('.ls-size button'); if (!b) return;
  const row = b.closest('.ls-row');
  $$('.ls-size button', row).forEach(x => x.classList.toggle('active', x === b));
  setLineStyle(row.dataset.key, 'size', b.dataset.z === 'L' ? undefined : b.dataset.z);
});

/* ============ Personen (Termin-Layout) ============ */
function renderPeople() {
  const box = $('#people');
  if (!box || box.closest('[hidden]') || box.contains(document.activeElement)) return;
  const ps = slide().event.people;
  box.innerHTML = '';
  ps.forEach((p, i) => {
    const row = document.createElement('div'); row.className = 'person';
    row.innerHTML = `<label class="person-photo" title="Foto wählen"><span class="ph"></span><svg class="i"><use href="#i-user"/></svg><input type="file" accept="image/*" hidden data-pi="${i}"></label>`
      + `<div class="person-fields"><input type="text" placeholder="Name" aria-label="Name" data-pf="name" data-pi="${i}"><input type="text" placeholder="Funktion" aria-label="Funktion" data-pf="role" data-pi="${i}"></div>`
      + `<button class="icon-btn" type="button" data-premove="${i}" title="Entfernen" aria-label="Person entfernen"><svg class="i"><use href="#i-x"/></svg></button>`;
    row.querySelector('[data-pf=name]').value = p.name || '';
    row.querySelector('[data-pf=role]').value = p.role || '';
    if (p.src) { row.querySelector('.ph').style.backgroundImage = `url("${p.src}")`; row.classList.add('has-photo'); }
    box.appendChild(row);
  });
  $('#btnAddPerson').hidden = ps.length >= 4;
}
$('#layers').addEventListener('input', e => {
  const el = e.target; if (!el.dataset.pf) return;
  slide().event.people[+el.dataset.pi][el.dataset.pf] = el.value; changed();
});
$('#layers').addEventListener('change', async e => {
  const el = e.target; if (el.type !== 'file' || el.dataset.pi === undefined) return;
  const f = el.files[0]; if (!f) return;
  try { slide().event.people[+el.dataset.pi].src = await readImage(f, { max: 1000 }); renderPeople(); changed(); } catch (err) { toast(err.message); }
});
$('#layers').addEventListener('click', e => {
  const b = e.target.closest('[data-premove]'); if (!b) return;
  slide().event.people.splice(+b.dataset.premove, 1); renderPeople(); changed();
});
function addPerson() {
  const ps = slide().event.people; if (ps.length >= 4) return;
  ps.push({ name: '', role: '', src: null }); renderPeople(); changed();
  const ins = $$('#people [data-pf=name]'); if (ins.length) ins[ins.length - 1].focus();
}

/* ============ Ebenen-Liste (wie in Figma): alle Elemente der Slide mit Inhalt und Einstellungen ============ */
const LAYOUT_LAYERS = {
  balken: ['head'], text: ['head', 'body'], liste: ['head', 'list'], zahl: ['number', 'head', 'body'],
  zitat: ['mark', 'quote', 'name'], event: ['head', 'info', 'people', 'body', 'hint'], bild: ['head'],
};
const ELDEF = {
  head:   { icon: 'i-type',  opts: { font: 1, width: 1 } },
  body:   { icon: 'i-text',  opts: { font: 1, width: 1, wrap: 1 } },
  list:   { icon: 'i-list',  opts: { font: 1, width: 1, wrap: 1 } },
  number: { icon: 'i-hash',  opts: { font: 1 } },
  mark:   { icon: 'i-quote', opts: {} },
  quote:  { icon: 'i-quote', opts: { font: 1, width: 1, wrap: 1 } },
  name:   { icon: 'i-sign',  opts: { font: 1, width: 1 } },
  info:   { icon: 'i-cal',   opts: { font: 1, width: 1 } },
  people: { icon: 'i-users', opts: { font: 1, width: 1 } },
  hint:   { icon: 'i-qr',    opts: { font: 1, width: 1, wrap: 1 } },
};
const esc = t => String(t ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fTA = (path, label, ph = '', rows = 2) => `<div class="field"><label>${esc(label)}</label><textarea rows="${rows}" data-bind="${path}" placeholder="${esc(ph)}"></textarea></div>`;
const fIn = (path, label, ph = '', type = 'text') => `<div class="field"><label>${esc(label)}</label><input type="${type}" data-bind="${path}" placeholder="${esc(ph)}"></div>`;
// Rücksetz-Icon neben einer Eigenschaft – nur sichtbar, wenn sie vom Standard abweicht
const rb = path => `<button type="button" class="prop-reset" data-reset="${path}" data-tip="Auf Standard zurücksetzen" aria-label="Auf Standard zurücksetzen" hidden><svg class="i"><use href="#i-reset"/></svg></button>`;
const lab = (text, path) => `<label><span>${text}</span>${path ? rb(path) : ''}</label>`;
const rangeF = (path, label, min, max, step, def, fmt = '') =>
  `<div><label><span>${label}</span><span class="lab-end">${rb(path)}<span class="val" data-val="${path}" data-def="${def}"${fmt ? ` data-fmt="${fmt}"` : ''}></span></span></label><input type="range" min="${min}" max="${max}" step="${step}" data-bind="${path}" data-default="${def}" aria-label="${label}"></div>`;
const fontSeg = (path, auto = true) => `<div class="field">${lab('Schrift', path)}<div class="seg" data-bind="${path}">${auto ? '<button data-v="">Auto</button>' : ''}<button data-v="gt" class="face-gt">GrueneType</button><button data-v="pt" class="face-pt">PT Sans</button></div></div>`;
const cornerSeg = path => `<div class="corner-picker seg" data-bind="${path}" title="Oder in der Vorschau frei ziehen"><button data-v="tl" aria-label="Oben links"><i></i></button><button data-v="tr" aria-label="Oben rechts"><i></i></button><button data-v="bl" aria-label="Unten links"><i></i></button><button data-v="br" aria-label="Unten rechts"><i></i></button></div>`;

function elLabel(key, s) {
  const L = LABELS[s.layout] || LABELS.balken;
  return { head: L.h, body: L.b || 'Text', list: 'Liste', number: 'Zahl', mark: 'Anführungszeichen', quote: 'Zitat',
           name: 'Name & Funktion', info: 'Termin-Infos', people: 'Personen', hint: 'Hinweis & QR-Code' }[key];
}
function elContent(key, s) {
  const L = LABELS[s.layout] || LABELS.balken;
  switch (key) {
    case 'head': return fTA('headline', L.h, L.hp, 3) + fIn('sub', L.s) + '<div class="field"><label>Zeilen</label><div class="line-styles" id="lineStyles"></div></div>';
    case 'body': return fTA('body', L.b, L.bp, 4);
    case 'list': return fTA('body', 'Punkte', 'Ein Punkt pro Zeile', 4);
    case 'number': return fIn('number', 'Zahl', '15 %');
    case 'quote': return fTA('headline', 'Zitat', 'Ohne Anführungszeichen', 3);
    case 'name': return fIn('sub', 'Name') + fIn('body', 'Funktion / Ort');
    case 'info': return `<div class="field grid-date"><div><label>Datum</label><input type="date" data-bind="event.date"></div><div><label>Beginn</label><input type="time" data-bind="event.from"></div><div><label>Ende</label><input type="time" data-bind="event.to"></div></div>`
      + fIn('event.place', 'Ort', 'Name des Veranstaltungsorts') + fIn('event.address', 'Adresse', 'Straße, PLZ Ort');
    case 'people': return '<div class="field"><div class="people" id="people"></div><button class="btn ghost small" id="btnAddPerson" type="button"><svg class="i"><use href="#i-plus"/></svg>Person hinzufügen</button></div>'
      + '<div class="field">' + lab('Anordnung', 'el.people.arr') + '<div class="seg" data-bind="el.people.arr"><button data-v="" data-tip="1 Person: Foto links · mehrere: Foto oben">Auto</button><button data-v="top">Foto oben</button><button data-v="left">Foto links</button><button data-v="right">Foto rechts</button></div></div>'
      + `<div class="field">${rangeF('el.people.ps', 'Fotogröße', 0.5, 1.6, 0.05, 1)}</div><div class="field">${rangeF('el.people.ns', 'Schriftgröße Name', 0.5, 2, 0.05, 1)}</div><div class="field">${rangeF('el.people.rs', 'Schriftgröße Funktion', 0.5, 2, 0.05, 1)}</div>`;
    case 'hint': return fIn('event.hint', 'Hinweis', 'Eintritt frei · Anmeldung erbeten') + fIn('event.qr', 'QR-Code-Link', 'https://…');
  }
  return '';
}
// Icon-Aktionen einer Ebene (Reihenfolge, Duplizieren, Löschen) – mit Tooltip
const ib = (act, id, icon, tip, cls = '') => `<button class="icon-btn ${cls}" type="button" data-act="${act}" data-id="${esc(id)}" data-tip="${tip}" aria-label="${tip}"><svg class="i"><use href="#${icon}"/></svg></button>`;
function layerActions(id, { dup = false, del = false } = {}) {
  return `<div class="layer-actions icon-row">`
    + ib('fwd', id, 'i-step-fwd', 'Eine Ebene nach vorn') + ib('bwd', id, 'i-step-back', 'Eine Ebene nach hinten')
    + ib('top', id, 'i-to-front', 'Ganz nach vorn') + ib('bottom', id, 'i-to-back', 'Ganz nach hinten')
    + (dup || del ? '<span class="icon-sep"></span>' : '')
    + (dup ? ib('dup', id, 'i-copy', 'Duplizieren (Strg+D)') : '') + (del ? ib('del', id, 'i-trash', 'Löschen (Entf)', 'danger') : '')
    + '</div>';
}
const EL_COLOR = { head: 'scheme', name: 'scheme', number: 'color', mark: 'color', quote: 'color', body: 'color', list: 'color', hint: 'color', people: 'color', info: 'box' };
function elSettings(key) {
  const o = ELDEF[key].opts, ck = EL_COLOR[key];
  const colorField = !ck ? '' : ck === 'scheme'
    ? `<div class="field">${lab('Farbschema', `el.${key}.scheme`)}<div class="swatches small" data-bind="el.${key}.scheme" data-type="elscheme"></div></div>`
    : `<div class="field">${lab(ck === 'box' ? 'Flächenfarbe' : 'Farbe', `el.${key}.color`)}<div class="swatches small" data-bind="el.${key}.color" data-type="elcolor"></div></div>`;
  return `<div class="layer-settings">
    <div class="field grid2">${rangeF(`el.${key}.scale`, 'Größe', 0.3, 3, 0.05, 1)}${o.width ? rangeF(`el.${key}.w`, 'Breite', 0.25, 1, 0.01, 1) : '<div></div>'}</div>
    ${colorField}
    <div class="field">${rangeF(`el.${key}.shadow`, 'Schatten', 0, 1, 0.05, 'inherit-shadow')}</div>
    ${o.font ? fontSeg(`el.${key}.font`) : ''}
    ${o.wrap ? `<div class="field">${lab('Zeilenumbruch', `el.${key}.wrap`)}<div class="seg" data-bind="el.${key}.wrap"><button data-v="">Automatisch</button><button data-v="hyph">Silbentrennung</button><button data-v="manual">Nur manuell</button></div></div>` : ''}
  </div>`;
}
function layerPreview(key, s) {
  const first = t => (t || '').split('\n').find(l => l.trim()) || '';
  const ev = s.event || {};
  switch (key) {
    case 'head': case 'quote': return first(s.headline);
    case 'body': case 'list': return first(s.body);
    case 'number': return s.number;
    case 'name': return s.sub;
    case 'info': return [formatDate(ev.date), ev.place].filter(Boolean).join(' · ');
    case 'people': return (ev.people || []).map(p => p.name).filter(Boolean).join(', ');
    case 'hint': return ev.hint || ev.qr;
  }
  return '';
}
function layerDefs(s) {
  const defs = [];
  for (const key of LAYOUT_LAYERS[s.layout] || []) {
    const ov = (s.el || {})[key] || {};
    const modified = Object.keys(ov).some(p => p !== 'hidden' && isModifiedPath('el.' + key + '.' + p, s));
    defs.push({ id: 'el:' + key, icon: ELDEF[key].icon, name: elLabel(key, s), preview: layerPreview(key, s), hidden: !!ov.hidden, modified,
                body: elContent(key, s) + elSettings(key) + layerActions('el:' + key) });
  }
  defs.push({ id: 'stoerer', icon: 'i-badge', name: 'Störer', preview: (s.stoerer.text || '').replace(/\n/g, ' '), hidden: !s.stoerer.on,
              body: fTA('stoerer.text', 'Text', 'Kurzer Text', 2) + `<div class="field pos-size"><div>${lab('Ecke', 'stoerer.pos')}${cornerSeg('stoerer.pos')}</div><div class="grow">${lab('Größe', 'stoerer.size')}<input type="range" min="0.6" max="1.6" step="0.05" data-bind="stoerer.size" aria-label="Störer-Größe"></div></div>` + layerActions('stoerer') });
  (s.items || []).forEach((it, i) => {
    const p = `items.${i}`;
    const act = layerActions('item:' + it.id, { dup: true, del: true });
    if (it.kind === 'image') {
      defs.push({ id: 'item:' + it.id, icon: 'i-image', name: 'Bild', preview: it.shape === 'circle' ? 'rund' : '', hidden: !!it.hidden, added: true,
        body: `<div class="field row tight"><label class="btn ghost small"><svg class="i"><use href="#i-image"/></svg>Ersetzen<input type="file" accept="image/*" hidden data-act="replace" data-idx="${i}"></label>${rb(`${p}.shape`)}<div class="seg" data-bind="${p}.shape"><button data-v="rect">Eckig</button><button data-v="circle">Rund</button></div></div>`
          + `<div class="field grid2">${rangeF(`${p}.size`, 'Größe', 0.04, 1.5, 0.01, 0.35)}${rangeF(`${p}.rot`, 'Drehung', -45, 45, 1, 0, 'deg')}</div>` + act });
    } else {
      defs.push({ id: 'item:' + it.id, icon: /^\s*[\d.,%+-]+\s*$/.test(it.text || '') ? 'i-hash' : 'i-type', name: 'Eigener Text', preview: (it.text || '').replace(/\n/g, ' '), hidden: !!it.hidden, added: true,
        body: fTA(`${p}.text`, 'Text', '', 2)
          + `<div class="field grid2">${rangeF(`${p}.size`, 'Größe', 12, 600, 1, 72, 'px')}${rangeF(`${p}.rot`, 'Drehung', -45, 45, 1, 0, 'deg')}</div>`
          + `<div class="field">${rangeF(`${p}.shadow`, 'Schatten', 0, 1, 0.05, 'inherit-shadow')}</div>`
          + fontSeg(`${p}.font`, false)
          + `<div class="field">${lab('Balken', `${p}.bar`)}<div class="swatches small" data-bind="${p}.bar" data-type="bar"></div></div>`
          + `<div class="field">${lab('Schriftfarbe (ohne Balken)', `${p}.color`)}<div class="swatches small" data-bind="${p}.color" data-type="tcolor"></div></div>`
          + `<div class="field switch-reset"><label class="switch"><input type="checkbox" data-bind="${p}.caps"><span>Großbuchstaben</span></label>${rb(`${p}.caps`)}</div>` + act });
    }
  });
  ensureEmojiIds(s);
  s.emojis.forEach((e, i) => {
    defs.push({ id: 'emoji:' + e.id, icon: null, emoji: e.ch, name: 'Emoji', preview: '', hidden: !!e.hidden, added: true,
      body: `<div class="field grid2">${rangeF(`emojis.${i}.size`, 'Größe', 0.04, 0.6, 0.01, 0.16)}${rangeF(`emojis.${i}.rot`, 'Drehung', -45, 45, 1, 0, 'deg')}</div>`
        + layerActions('emoji:' + e.id, { dup: true, del: true }) });
  });
  defs.push({ id: 'logo', icon: 'i-sun', name: 'Logo', preview: P.logo.choice === 'none' ? 'keins gewählt' : P.logo.choice === 'custom' ? 'eigenes' : 'Fraktion', hidden: !s.showLogo, note: true });
  defs.push({ id: 'abs', icon: 'i-sign', name: 'Absender', preview: P.absender, hidden: !s.showAbsender, note: true });
  // Liste = Ebenen-Reihenfolge (oben hinten, unten vorne)
  const pos = new Map(orderedIds(s).map((id, i) => [id, i]));
  return defs.sort((a, b) => (pos.get(a.id) ?? 0) - (pos.get(b.id) ?? 0));
}
function layerRow(d) {
  const icon = d.emoji ? `<span class="li emo">${esc(d.emoji)}</span>` : `<svg class="i li"><use href="#${d.icon}"/></svg>`;
  const body = d.body ? `<div class="layer-body" hidden>${d.body}</div>`
    : d.note ? `<div class="layer-body" hidden><p class="meta">Größe, Position und Inhalt stellst du links unter „Marke“ ein – gilt für alle ${term('many')}.</p></div>` : '';
  return `<div class="layer${d.added ? ' added' : ''}" data-layer="${esc(d.id)}" role="listitem">`
    + `<div class="layer-head"><button type="button" class="layer-toggle" aria-expanded="false">${icon}<span class="layer-name">${esc(d.name)}</span><span class="layer-preview"></span><svg class="i chev"><use href="#i-chev"/></svg></button>`
    + (d.id.startsWith('el:') ? `<button type="button" class="reset-btn" data-act="reset" data-key="${esc(d.id.slice(3))}" title="Auf Vorlage zurücksetzen" aria-label="${esc(d.name)} auf Vorlage zurücksetzen"><svg class="i"><use href="#i-reset"/></svg></button>` : '')
    + `<button type="button" class="eye" data-act="eye" data-id="${esc(d.id)}" title="Ein- oder ausblenden" aria-label="${esc(d.name)} ein- oder ausblenden"><svg class="i on"><use href="#i-eye"/></svg><svg class="i off"><use href="#i-eye-off"/></svg></button></div>`
    + body + '</div>';
}
let openLayer = null, layerSig = '', inLayerSync = false;
function layerIdOfSel() {
  const t = selType(), s = slide();
  if (t === 'el') return 'el:' + selElKey;
  if (t === 'item') return s.items[selItem] ? 'item:' + s.items[selItem].id : null;
  if (t === 'emoji') return s.emojis[selEmoji] ? 'emoji:' + s.emojis[selEmoji].id : null;
  if (t === 'stoerer') return 'stoerer';
  if (t === 'logo' || t === 'abs') return t;
  return null;
}
function renderLayers() {
  const box = $('#layers'); if (!box) return;
  const s = slide(), defs = layerDefs(s);
  const sig = [s.id, s.layout, MODE, defs.map(d => d.id).join(','), P.customSchemes.length, P.customColors.length].join('|');
  if (sig !== layerSig) {
    layerSig = sig;
    box.innerHTML = defs.map(layerRow).join('');
    if (!inLayerSync) { inLayerSync = true; syncUI(); inLayerSync = false; return; }
  }
  const selId = layerIdOfSel();
  for (const d of defs) {
    const row = box.querySelector(`[data-layer="${CSS.escape(d.id)}"]`); if (!row) continue;
    const open = openLayer === d.id;
    row.classList.toggle('open', open);
    row.classList.toggle('selected', selId === d.id);
    row.classList.toggle('is-hidden', d.hidden);
    row.classList.toggle('modified', !!d.modified);
    row.querySelector('.layer-toggle').setAttribute('aria-expanded', open);
    const body = row.querySelector('.layer-body'); if (body) body.hidden = !open;
    row.querySelector('.layer-preview').textContent = d.preview || '';
  }
  $('#layerCount').textContent = `${defs.length}`;
}
function openLayerRow(id, focus) {
  openLayer = id;
  renderLayers(); renderLineStyles(); renderPeople();
  const row = $(`#layers [data-layer="${CSS.escape(id)}"]`);
  if (!row) return;
  const ed = $('#editor');
  if (getComputedStyle(ed).position === 'sticky') {
    const rr = row.getBoundingClientRect(), er = ed.getBoundingClientRect();
    if (rr.top < er.top + 60 || rr.top > er.bottom - 80) ed.scrollTo({ top: ed.scrollTop + rr.top - er.top - 70, behavior: 'smooth' });
  }
  if (focus) { const f = row.querySelector('.layer-body textarea, .layer-body input:not([type=range]):not([type=file])'); if (f) { f.focus(); if (f.select) f.select(); } }
}
function selectLayer(id) {
  const s = slide();
  if (id.startsWith('el:')) setSel('el', id.slice(3));
  else if (id.startsWith('item:')) setSel('item', s.items.findIndex(it => 'item:' + it.id === id));
  else if (id.startsWith('emoji:')) setSel('emoji', s.emojis.findIndex(e => 'emoji:' + e.id === id));
  else if (id === 'stoerer') setSel(s.stoerer.on ? 'stoerer' : null);
  else if (id === 'logo' || id === 'abs') setSel(G[id] ? id : null);
}
// wird von setSel/syncEmojis aufgerufen: Auswahl in der Vorschau öffnet die passende Ebene
function syncSel() {
  const id = layerIdOfSel();
  if (id && id !== openLayer) { openLayerRow(id); return; }
  renderLayers();
}
function toggleEye(id) {
  const s = slide();
  if (id.startsWith('el:')) { const k = id.slice(3); if (!s.el) s.el = {}; const e = (s.el[k] = s.el[k] || {}); e.hidden = !e.hidden; }
  else if (id.startsWith('item:')) { const it = s.items.find(x => 'item:' + x.id === id); if (it) it.hidden = !it.hidden; }
  else if (id.startsWith('emoji:')) { const e = s.emojis.find(x => 'emoji:' + x.id === id); if (e) e.hidden = !e.hidden; }
  else if (id === 'stoerer') s.stoerer.on = !s.stoerer.on;
  else if (id === 'logo') s.showLogo = !s.showLogo;
  else if (id === 'abs') s.showAbsender = !s.showAbsender;
  syncUI(); changed();
}
function moveItem(i, dir) {
  const s = slide(); if (!s.items[i]) return;
  const [it] = s.items.splice(i, 1);
  if (dir > 0) s.items.push(it); else s.items.unshift(it);
  selItem = s.items.indexOf(it);
  syncUI(); changed();
}
function deleteItem(i = selItem) {
  const s = slide(); if (i < 0 || !s.items[i]) return;
  s.items.splice(i, 1); setSel(null); openLayer = null; syncUI(); changed();
}
$('#layers').addEventListener('click', e => {
  const tog = e.target.closest('.layer-toggle');
  if (tog) {
    const id = tog.closest('.layer').dataset.layer;
    if (openLayer === id) { openLayer = null; setSel(null); renderLayers(); }
    else { openLayer = id; selectLayer(id); openLayerRow(id); }
    return;
  }
  const a = e.target.closest('[data-act]'); if (!a || a.type === 'file') return;
  const s = slide(), i = +a.dataset.idx;
  switch (a.dataset.act) {
    case 'eye': toggleEye(a.dataset.id); break;
    case 'reset': {
      const k = a.dataset.key, hid = s.el && s.el[k] && s.el[k].hidden;
      if (s.el) delete s.el[k];
      if (hid) s.el[k] = { hidden: true };
      syncUI(); changed(); break;
    }
    case 'fwd': reorder(a.dataset.id, 1); break;
    case 'bwd': reorder(a.dataset.id, -1); break;
    case 'top': reorder(a.dataset.id, 'top'); break;
    case 'bottom': reorder(a.dataset.id, 'bottom'); break;
    case 'dup': duplicateLayer(a.dataset.id); break;
    case 'del': deleteLayer(a.dataset.id); break;
  }
  if (e.target.closest('#btnAddPerson')) addPerson();
});
$('#layers').addEventListener('change', async e => {
  const el = e.target;
  if (el.dataset.act === 'replace') {
    const f = el.files[0]; el.value = ''; const it = slide().items[+el.dataset.idx]; if (!f || !it) return;
    try { it.src = await readImage(f, { max: 1600, alpha: true }); changed(); } catch (err) { toast(err.message); }
  }
});
$('#addImage').addEventListener('change', e => { const f = e.target.files[0]; e.target.value = ''; if (f) addImageFromFile(f); });

/* Silbentrennung: deutsche Trennmuster (Liang), werden beim ersten Bedarf geladen */
let hyphenateDe = null, hyphLoading = false;
function ensureHyphenator() {
  if (hyphenateDe || hyphLoading) return;
  hyphLoading = true;
  import('https://cdn.jsdelivr.net/npm/hyphen@1.10.6/de/+esm')
    .then(m => { hyphenateDe = m.hyphenateSync || (m.default && m.default.hyphenateSync); hyphCache.clear(); scheduleRender(); scheduleThumbs(); })
    .catch(() => toast('Silbentrennung konnte nicht geladen werden (offline?).'))
    .finally(() => { hyphLoading = false; });
}
const hyphCache = new Map();
function hyphPoints(word) {
  if (!hyphenateDe) { ensureHyphenator(); return []; }
  if (hyphCache.has(word)) return hyphCache.get(word);
  const parts = hyphenateDe(word, { hyphenChar: '­' }).split('­');
  const pts = []; let n = 0;
  for (let i = 0; i < parts.length - 1; i++) { n += parts[i].length; pts.push(n); }
  hyphCache.set(word, pts);
  return pts;
}
function wrapHyph(ctx, para, maxW) {
  const out = []; let line = '';
  const fits = t => ctx.measureText(t).width <= maxW;
  for (const w of para.split(/\s+/)) {
    if (fits(line ? line + ' ' + w : w)) { line = line ? line + ' ' + w : w; continue; }
    let rest = w;
    for (;;) {
      const prefix = line ? line + ' ' : '';
      let best = -1;
      for (const p of hyphPoints(rest)) {
        const head = rest.slice(0, p);
        if (fits(prefix + head + (head.endsWith('-') ? '' : '-'))) best = p;
      }
      if (best > 0) {
        const head = rest.slice(0, best);
        out.push(prefix + head + (head.endsWith('-') ? '' : '-'));
        line = ''; rest = rest.slice(best);
        if (fits(rest)) { line = rest; break; }
        continue;
      }
      if (line) { out.push(line); line = ''; if (fits(rest)) { line = rest; break; } continue; }
      line = rest; break; // einzelnes Wortstück passt nicht – darf überstehen
    }
  }
  if (line) out.push(line);
  return out;
}

/* ============ Einzelne Eigenschaft auf Standard zurücksetzen ============ */
function propDefault(path, s) {
  let m;
  if ((m = path.match(/^el\.\w+\.(\w+)$/))) return { scale: 1, w: 1, ns: 1, rs: 1, ps: 1 }[m[1]];
  if ((m = path.match(/^items\.(\d+)\.(\w+)$/))) {
    const it = s.items[+m[1]]; if (!it) return undefined;
    return (it.kind === 'image' ? { size: 0.35, shape: 'rect', rot: 0 } : { size: 72, font: 'gt', color: 'sand', bar: 'tanne', caps: true, rot: 0 })[m[2]];
  }
  if ((m = path.match(/^emojis\.\d+\.(\w+)$/))) return { size: 0.16, rot: 0 }[m[1]];
  const d = TEMPLATE_DEFAULTS[s.layout] || {};
  return { 'stoerer.size': 1, 'stoerer.pos': 'tr', size: 1, angle: d.angle ?? -3, posY: d.posY, align: 'left', shadow: 0, font: 'gt', scheme: 'tanne' }[path];
}
function isModifiedPath(path, s = slide()) {
  if (path === 'stoerer.pos' && typeof s.stoerer.x === 'number') return true;
  const v = getPath(s, path), d = propDefault(path, s);
  const unset = v === undefined || v === null || (v === '' && !path.startsWith('items.'));
  if (unset) return false;
  if (typeof v === 'number' && typeof d === 'number') return Math.abs(v - d) > 1e-6;
  return v !== d;
}
function resetProp(path) {
  const s = slide(), d = propDefault(path, s);
  if (path === 'stoerer.pos') { delete s.stoerer.x; delete s.stoerer.y; }
  if (path === 'posY' || path === 'align') s.off = { x: 0, y: 0 };
  if (d === undefined) {
    const ks = path.split('.'), parent = getPath(s, ks.slice(0, -1).join('.'));
    if (parent && typeof parent === 'object') delete parent[ks[ks.length - 1]];
  } else setPath(s, path, d);
  syncUI(); changed();
}
function syncPropResets() {
  const s = slide();
  $$('[data-reset]').forEach(b => (b.hidden = !isModifiedPath(b.dataset.reset, s)));
}
document.addEventListener('click', e => {
  const b = e.target.closest('.prop-reset'); if (!b) return;
  e.preventDefault(); e.stopPropagation();
  resetProp(b.dataset.reset);
}, true);

/* ============ Ebenen-Reihenfolge ändern, duplizieren, löschen ============ */
function reorder(id, to) {
  const s = slide(), ids = orderedIds(s), i = ids.indexOf(id);
  if (i < 0) return;
  ids.splice(i, 1);
  const j = to === 'top' ? ids.length : to === 'bottom' ? 0 : clamp(i + to, 0, ids.length);
  ids.splice(j, 0, id);
  s.order = ids;
  syncUI(); changed();
}
function duplicateLayer(id) {
  const s = slide(), ids = orderedIds(s);
  let newId = null;
  if (id.startsWith('item:')) {
    const it = s.items.find(x => 'item:' + x.id === id); if (!it) return;
    const c = { ...JSON.parse(JSON.stringify(it)), id: 'i' + Date.now().toString(36), x: clamp(it.x + 0.03, 0, 1), y: clamp(it.y + 0.03, 0, 1) };
    s.items.push(c); newId = 'item:' + c.id;
    selEmoji = -1; selItem = s.items.length - 1;
  } else if (id.startsWith('emoji:')) {
    const e = s.emojis.find(x => 'emoji:' + x.id === id); if (!e) return;
    const c = { ...e, id: 'e' + Math.random().toString(36).slice(2, 9), x: clamp(e.x + 0.03, 0, 1), y: clamp(e.y + 0.03, 0, 1) };
    s.emojis.push(c); newId = 'emoji:' + c.id;
    selItem = -1; selEmoji = s.emojis.length - 1;
  } else return;
  ids.splice(ids.indexOf(id) + 1, 0, newId); // direkt über dem Original
  s.order = ids;
  openLayer = newId;
  syncUI(); changed();
}
function deleteLayer(id) {
  const s = slide();
  if (id.startsWith('item:')) s.items = s.items.filter(x => 'item:' + x.id !== id);
  else if (id.startsWith('emoji:')) s.emojis = s.emojis.filter(x => 'emoji:' + x.id !== id);
  else return toggleEye(id); // Vorlagen-Elemente werden ausgeblendet statt gelöscht
  selItem = -1; selEmoji = -1; if (openLayer === id) openLayer = null;
  setSel(null); syncUI(); changed();
}
function resetElement(key) {
  const s = slide(), hid = s.el && s.el[key] && s.el[key].hidden;
  if (s.el) delete s.el[key];
  if (hid) s.el[key] = { hidden: true };
  syncUI(); changed();
}

/* Ebenen per Ziehen sortieren (Maus); Touch nutzt das Rechtsklick-/Langdruck-Menü */
let ldrag = null, suppressLayerClick = false;
$('#layers').addEventListener('pointerdown', e => {
  const head = e.target.closest('.layer-head');
  if (!head || e.button > 0 || e.pointerType === 'touch' || e.target.closest('.eye, .reset-btn')) return;
  ldrag = { row: head.closest('.layer'), y0: e.clientY, started: false };
});
window.addEventListener('pointermove', e => {
  if (!ldrag) return;
  if (!ldrag.started) {
    if (Math.abs(e.clientY - ldrag.y0) < 6) return;
    ldrag.started = true; ldrag.row.classList.add('lifted'); document.body.classList.add('sorting');
  }
  const box = $('#layers'), others = [...box.children].filter(c => c !== ldrag.row);
  let ref = null;
  for (const c of others) { const r = c.getBoundingClientRect(); if (e.clientY < r.top + r.height / 2) { ref = c; break; } }
  if (ldrag.row.nextElementSibling !== ref && !(ref === null && !ldrag.row.nextElementSibling)) {
    const before = new Map(others.map(c => [c, c.getBoundingClientRect().top]));
    box.insertBefore(ldrag.row, ref);
    for (const c of others) { // FLIP: Nachbarn gleiten an ihren neuen Platz
      const dy = before.get(c) - c.getBoundingClientRect().top; if (!dy) continue;
      c.style.transition = 'none'; c.style.transform = `translateY(${dy}px)`;
      requestAnimationFrame(() => { c.style.transition = 'transform .16s ease'; c.style.transform = ''; });
    }
  }
});
window.addEventListener('pointerup', () => {
  if (!ldrag) return;
  const { row, started } = ldrag; ldrag = null;
  if (!started) return;
  row.classList.remove('lifted'); document.body.classList.remove('sorting');
  suppressLayerClick = true; setTimeout(() => (suppressLayerClick = false), 0);
  slide().order = [...$('#layers').children].map(c => c.dataset.layer);
  syncUI(); changed();
});
$('#layers').addEventListener('click', e => { if (suppressLayerClick) { e.stopImmediatePropagation(); e.preventDefault(); } }, true);

/* ============ Menü (Hinzufügen & Rechtsklick) ============ */
const menuEl = document.createElement('div');
menuEl.className = 'ctx-menu'; menuEl.setAttribute('role', 'menu'); menuEl.hidden = true;
document.body.appendChild(menuEl);
function showMenu(x, y, entries) {
  menuEl.innerHTML = '';
  for (const en of entries) {
    if (en === '-') { const s = document.createElement('div'); s.className = 'ctx-sep'; s.setAttribute('role', 'separator'); menuEl.appendChild(s); continue; }
    const b = document.createElement('button');
    b.type = 'button'; b.setAttribute('role', 'menuitem');
    b.className = 'ctx-item' + (en.danger ? ' danger' : '');
    b.disabled = !!en.disabled;
    b.innerHTML = (en.emoji ? `<span class="i emo">${esc(en.emoji)}</span>` : en.icon ? `<svg class="i"><use href="#${en.icon}"/></svg>` : '<span class="i"></span>') + '<span class="ctx-label"></span>' + (en.key ? `<kbd>${esc(en.key)}</kbd>` : '');
    b.querySelector('.ctx-label').textContent = en.label;
    b.onclick = () => { hideMenu(); en.action(); };
    menuEl.appendChild(b);
  }
  menuEl.hidden = false;
  const r = menuEl.getBoundingClientRect();
  menuEl.style.left = Math.max(8, Math.min(x, innerWidth - r.width - 8)) + 'px';
  menuEl.style.top = (y + r.height > innerHeight - 8 ? Math.max(8, y - r.height) : y) + 'px';
  const first = menuEl.querySelector('.ctx-item:not(:disabled)'); if (first) first.focus({ preventScroll: true });
}
function hideMenu() { menuEl.hidden = true; }
document.addEventListener('pointerdown', e => { if (!menuEl.hidden && !menuEl.contains(e.target)) hideMenu(); }, true);
window.addEventListener('blur', hideMenu);
window.addEventListener('resize', hideMenu);
menuEl.addEventListener('keydown', e => {
  const items = [...menuEl.querySelectorAll('.ctx-item:not(:disabled)')], i = items.indexOf(document.activeElement);
  if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); hideMenu(); }
  else if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length].focus(); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
});

function addEntries() {
  return [
    { label: 'Text', icon: 'i-type', action: () => addItem('text') },
    { label: 'Zahl', icon: 'i-hash', action: () => addItem('text', { text: '42', size: 220, bar: null, color: 'sonne', caps: false }) },
    '-',
    { label: 'Bild aus Datei …', icon: 'i-image', action: () => $('#addImage').click() },
    { label: 'Bild per Link …', icon: 'i-link', action: () => showUrlRow() },
    { label: 'Bild aus Zwischenablage', icon: 'i-paste', key: 'Strg+V', action: () => addImageFromClipboard() },
    '-',
    { label: 'Emoji …', emoji: '😊', action: () => { $('#emojiPicker').hidden = false; $('#emojiPicker').scrollIntoView({ block: 'nearest' }); } },
    { label: 'Störer', icon: 'i-badge', disabled: slide().stoerer.on, action: () => { slide().stoerer.on = true; syncUI(); changed(); setSel('stoerer'); openLayerRow('stoerer', true); } },
  ];
}
$('#addMenuBtn').onclick = () => {
  const r = $('#addMenuBtn').getBoundingClientRect();
  showMenu(r.left, r.bottom + 4, addEntries());
};
function elementEntries(id) {
  const s = slide(), ids = orderedIds(s), i = ids.indexOf(id);
  const added = id.startsWith('item:') || id.startsWith('emoji:');
  const def = layerDefs(s).find(d => d.id === id) || {};
  const out = [];
  if (added) out.push({ label: 'Duplizieren', icon: 'i-copy', key: 'Strg+D', action: () => duplicateLayer(id) }, '-');
  out.push(
    { label: 'Eine Ebene nach vorn', icon: 'i-step-fwd', disabled: i === ids.length - 1, action: () => reorder(id, 1) },
    { label: 'Eine Ebene nach hinten', icon: 'i-step-back', disabled: i === 0, action: () => reorder(id, -1) },
    { label: 'Ganz nach vorn', icon: 'i-to-front', disabled: i === ids.length - 1, action: () => reorder(id, 'top') },
    { label: 'Ganz nach hinten', icon: 'i-to-back', disabled: i === 0, action: () => reorder(id, 'bottom') },
    '-',
    { label: def.hidden ? 'Einblenden' : 'Ausblenden', icon: def.hidden ? 'i-eye' : 'i-eye-off', action: () => toggleEye(id) },
  );
  if (id.startsWith('el:') && def.modified) out.push({ label: 'Auf Vorlage zurücksetzen', icon: 'i-reset', action: () => resetElement(id.slice(3)) });
  if (added) out.push('-', { label: 'Löschen', icon: 'i-trash', key: 'Entf', danger: true, action: () => deleteLayer(id) });
  return out;
}
// Rechtsklick in der Vorschau: Element-Menü, auf leerer Fläche das Hinzufügen-Menü
preview.addEventListener('contextmenu', e => {
  e.preventDefault();
  const p = canvasPoint(e), hit = hitAny(p.x, p.y);
  if (hit) {
    setSel(hit[0], hit[1]);
    const id = layerIdOfSel();
    if (id) return showMenu(e.clientX, e.clientY, elementEntries(id));
  }
  setSel(null);
  showMenu(e.clientX, e.clientY, [...addEntries(), '-', { label: 'Hintergrundfoto wählen …', icon: 'i-image', action: () => $('#fileBg').click() }]);
});
$('#layers').addEventListener('contextmenu', e => {
  const row = e.target.closest('.layer'); if (!row) return;
  e.preventDefault();
  const id = row.dataset.layer;
  selectLayer(id);
  showMenu(e.clientX, e.clientY, elementEntries(id));
});

/* ============ Bilder: Datei, Link, Zwischenablage, Strg+V ============ */
async function addImageFromFile(f) {
  try { addItem('image', { src: await readImage(f, { max: 1600, alpha: true }) }); } catch (err) { toast(err.message); }
}
async function addImageFromUrl(url) {
  try {
    const res = await fetch(url, { mode: 'cors' });
    if (!res.ok) throw new Error();
    const b = await res.blob();
    if (!b.type.startsWith('image/')) throw new Error();
    await addImageFromFile(new File([b], 'bild', { type: b.type }));
    hideUrlRow();
  } catch {
    toast('Das Bild ließ sich nicht laden – die Seite erlaubt keinen direkten Zugriff. Speichere es und füge es als Datei oder mit Strg+V ein.', 6000);
  }
}
async function addImageFromClipboard() {
  try {
    for (const it of await navigator.clipboard.read()) {
      const t = it.types.find(x => x.startsWith('image/'));
      if (t) return addImageFromFile(new File([await it.getType(t)], 'bild', { type: t }));
    }
    toast('In der Zwischenablage ist kein Bild.');
  } catch { toast('Kein Zugriff auf die Zwischenablage – kopiere das Bild und drücke Strg+V.'); }
}
function showUrlRow() { $('#urlRow').hidden = false; const i = $('#imgUrl'); i.value = ''; i.focus(); }
function hideUrlRow() { $('#urlRow').hidden = true; }
$('#imgUrlLoad').onclick = () => { const u = $('#imgUrl').value.trim(); if (u) addImageFromUrl(u); };
$('#imgUrl').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); $('#imgUrlLoad').click(); } if (e.key === 'Escape') hideUrlRow(); });
$('#imgUrlClose').onclick = hideUrlRow;
document.addEventListener('paste', e => {
  if (e.target.closest && e.target.closest('input, textarea, [contenteditable]')) return;
  const cd = e.clipboardData; if (!cd) return;
  const img = [...cd.items].find(i => i.type.startsWith('image/'));
  if (img) { e.preventDefault(); addImageFromFile(img.getAsFile()); return; }
  const text = (cd.getData('text/plain') || '').trim();
  if (/^https?:\/\/\S+$/i.test(text)) { e.preventDefault(); addImageFromUrl(text); }
});

/* ============ Slide auf den Designvorschlag der Vorlage zurücksetzen ============ */
const TEMPLATE_DEFAULTS = {
  balken: { headline: 'Deine Headline\nin zwei Zeilen', sub: 'Unterzeile', body: '', posY: 'bottom', angle: -3 },
  text:   { headline: 'Überschrift', sub: '', body: 'Hier steht dein Text.', posY: 'top', angle: -3 },
  liste:  { headline: 'Das packen\nwir an', sub: '', body: 'Erster Punkt\nZweiter Punkt\nDritter Punkt', posY: 'top', angle: 0 },
  zahl:   { number: '42', headline: 'Was die Zahl zeigt', sub: 'Unterzeile', body: 'Kurze Einordnung oder Quelle.', posY: 'middle', angle: -3 },
  zitat:  { headline: 'Hier steht ein starkes Zitat.', sub: 'Vorname Nachname', body: 'Funktion · Ort', posY: 'bottom', angle: -3 },
  event:  { headline: 'Titel der\nVeranstaltung', sub: 'Thema', body: '', posY: 'top', angle: -3 },
  bild:   { headline: '', sub: '', body: '', posY: 'bottom', angle: -3 },
};
function resetSlide() {
  const s = slide(), d = TEMPLATE_DEFAULTS[s.layout] || TEMPLATE_DEFAULTS.balken;
  Object.assign(s, { headline: d.headline, sub: d.sub, body: d.body, number: d.number || '', posY: d.posY, angle: d.angle,
    align: 'left', size: 1, shadow: 0, font: 'gt', el: {}, items: [], emojis: [], order: [], lineStyle: [], subStyle: {}, off: { x: 0, y: 0 },
    stoerer: { on: false, text: 'Jetzt\nmitmachen!', pos: 'tr', size: 1 }, showLogo: true, showAbsender: true });
  if (s.layout === 'event') s.event = { date: isoInDays(14), from: '19:00', to: '21:00', place: 'Veranstaltungsort', address: 'Straße 1, 12345 Ort', hint: 'Eintritt frei', qr: '', people: [{ name: 'Vorname Nachname', role: 'Funktion', src: null }] };
  selItem = -1; selEmoji = -1; openLayer = null; setSel(null);
  syncUI(); changed();
  toast(`${term('one')} auf Vorlage zurückgesetzt – Strg+Z macht es rückgängig.`);
}
$('#btnResetSlide').onclick = resetSlide;

/* ============ PDF-Export (Druck) ============ */
async function exportPdf(indices) {
  if (!window.jspdf) { toast('PDF-Export ist gerade nicht verfügbar (keine Internetverbindung?).'); return; }
  const f = fmt();
  toast(indices.length > 1 ? 'PDF wird erstellt …' : 'PDF wird erstellt …');
  await new Promise(r => setTimeout(r, 30));
  const mmW = f.mmW || f.w * 25.4 / 150, mmH = f.mmH || f.h * 25.4 / 150;
  const orient = mmW > mmH ? 'l' : 'p';
  const pdf = new window.jspdf.jsPDF({ orientation: orient, unit: 'mm', format: [mmW, mmH], compress: true });
  for (let n = 0; n < indices.length; n++) {
    if (n) pdf.addPage([mmW, mmH], orient);
    const c = document.createElement('canvas');
    render(c, indices[n]);
    pdf.addImage(c.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, mmW, mmH, undefined, 'FAST');
  }
  const name = `${MODE === 'poster' ? 'plakat' : 'sharepic'}_${P.format}${P.bleed && f.print ? '_beschnitt' : ''}${indices.length === 1 ? '_' + String(indices[0] + 1).padStart(2, '0') : ''}.pdf`;
  download(pdf.output('blob'), name);
  toast('PDF fertig.');
}

/* ---- Export ---- */
function exportName(i) {
  const ext = $('#exportType').value === 'jpg' ? 'jpg' : 'png';
  return `sharepic_${P.format}_${String(i + 1).padStart(2, '0')}.${ext}`;
}
function slideBlob(i) {
  const c = document.createElement('canvas');
  render(c, i);
  const jpg = $('#exportType').value === 'jpg';
  return new Promise(res => c.toBlob(res, jpg ? 'image/jpeg' : 'image/png', 0.93));
}
function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
$('#btnExportOne').onclick = async () => {
  if ($('#exportType').value === 'pdf') return exportPdf([cur]);
  download(await slideBlob(cur), exportName(cur));
};
$('#btnExportAll').onclick = async () => {
  if ($('#exportType').value === 'pdf') return exportPdf(P.slides.map((_, i) => i));
  if (P.slides.length === 1) return download(await slideBlob(0), exportName(0));
  if (!window.JSZip) {
    toast('ZIP nicht verfügbar (offline?) – lade einzeln herunter.');
    for (let i = 0; i < P.slides.length; i++) { download(await slideBlob(i), exportName(i)); await new Promise(r => setTimeout(r, 350)); }
    return;
  }
  toast('ZIP wird erstellt …');
  const zip = new JSZip();
  for (let i = 0; i < P.slides.length; i++) zip.file(exportName(i), await slideBlob(i));
  download(await zip.generateAsync({ type: 'blob' }), `sharepics_${P.format}.zip`);
  toast('Fertig – Reihenfolge im Karussell = Dateinummer.');
};
(function setupShare() {
  try {
    const probe = new File([new Blob(['x'], { type: 'image/png' })], 'a.png', { type: 'image/png' });
    if (!(navigator.canShare && navigator.canShare({ files: [probe] }))) return;
  } catch { return; }
  const b = $('#btnShare'); b.hidden = false;
  b.onclick = async () => {
    const files = [];
    for (let i = 0; i < P.slides.length; i++) {
      const blob = await slideBlob(i);
      files.push(new File([blob], exportName(i), { type: blob.type }));
    }
    try { await navigator.share({ files }); } catch (err) { if (err.name !== 'AbortError') toast('Teilen nicht möglich.'); }
  };
})();

/* ---- Projekt ---- */
$('#btnSave').onclick = () => {
  download(new Blob([JSON.stringify(P)], { type: 'application/json' }), MODE === 'poster' ? 'plakat-projekt.json' : 'sharepic-projekt.json');
};
$('#fileProject').onchange = async e => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  try {
    const p = JSON.parse(await f.text());
    if (!p || !Array.isArray(p.slides) || !p.slides.length) throw new Error();
    const m = p.mode || (FORMATS[p.format] && FORMATS[p.format].print ? 'poster' : 'social');
    switchMode(m, normalize(p, m));
    toast('Projekt geladen.');
  } catch { toast('Diese Datei ist kein gültiges Sharepic-Projekt.'); }
};
$('#btnReset').onclick = () => {
  if (!confirm('Neues Projekt beginnen? Nicht gespeicherte Inhalte gehen verloren. Logo und Marke bleiben erhalten.')) return;
  const keep = { logo: P.logo, absender: P.absender, format: P.format };
  P = merge(defaultProject(MODE), keep); cur = 0;
  $('#strip').innerHTML = '';
  syncUI(); changed(); scheduleThumbs(true);
};

/* ============ Bereichsgrößen: Spaltenbreiten und Zoom der Vorschau ============ */
const LAYOUT_KEY = 'sharepic-layout';
const LAY_DEF = { left: 300, right: 340 }, LAY_MIN = { left: 240, right: 280 }, LAY_MAX = 560;
const lay = { ...LAY_DEF };
try { Object.assign(lay, JSON.parse(localStorage.getItem(LAYOUT_KEY) || '{}')); } catch {}
function applyLayout() {
  const r = document.documentElement.style;
  r.setProperty('--left-w', lay.left + 'px'); r.setProperty('--right-w', lay.right + 'px');
}
function saveLayout() { try { localStorage.setItem(LAYOUT_KEY, JSON.stringify(lay)); } catch {} }
$$('.resizer').forEach(rz => {
  const side = rz.dataset.side, dir = side === 'left' ? 1 : -1;
  const setW = w => { lay[side] = clamp(Math.round(w), LAY_MIN[side], LAY_MAX); applyLayout(); layoutPreview(); };
  rz.addEventListener('pointerdown', e => {
    if (e.button > 0) return;
    e.preventDefault(); rz.setPointerCapture(e.pointerId);
    const x0 = e.clientX, w0 = lay[side];
    rz.classList.add('active'); document.body.classList.add('resizing');
    const move = ev => setW(w0 + dir * (ev.clientX - x0));
    const up = () => {
      rz.removeEventListener('pointermove', move); rz.removeEventListener('pointerup', up); rz.removeEventListener('pointercancel', up);
      rz.classList.remove('active'); document.body.classList.remove('resizing'); saveLayout();
    };
    rz.addEventListener('pointermove', move); rz.addEventListener('pointerup', up); rz.addEventListener('pointercancel', up);
  });
  rz.addEventListener('dblclick', () => { setW(LAY_DEF[side]); saveLayout(); });
  rz.addEventListener('keydown', e => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault(); e.stopPropagation();
    setW(lay[side] + dir * (e.key === 'ArrowRight' ? 16 : -16)); saveLayout();
  });
});

let zoom = 1; // 1 = einpassen
function layoutPreview() {
  const f = fmt(), wrap = $('#canvasWrap');
  const cs = getComputedStyle(wrap);
  const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight), padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
  const mobile = window.innerWidth <= 780;
  const availW = Math.max(120, wrap.clientWidth - padX);
  const availH = Math.max(200, mobile ? window.innerHeight * 0.68 : window.innerHeight - 250);
  const fit = Math.min(availW / f.w, availH / f.h);
  const sc = fit * zoom;
  preview.style.width = Math.round(f.w * sc) + 'px';
  preview.style.height = Math.round(f.h * sc) + 'px';
  wrap.style.maxHeight = zoom > 1.001 ? Math.round(availH + padY) + 'px' : '';
  wrap.classList.toggle('zoomed', zoom > 1.001);
  const zf = $('#zoomFit');
  zf.textContent = `${Math.round(sc * 100)} %`;
  zf.classList.toggle('fit', Math.abs(zoom - 1) < 0.001);
  zf.title = Math.abs(zoom - 1) < 0.001 ? 'Eingepasst' : 'Einpassen';
}
function setZoom(z) { zoom = clamp(z, 0.25, 6); layoutPreview(); }
$('#zoomIn').onclick = () => setZoom(zoom * 1.25);
$('#zoomOut').onclick = () => setZoom(zoom / 1.25);
$('#zoomFit').onclick = () => setZoom(1);
window.addEventListener('resize', () => layoutPreview());

/* ============ Start ============ */
(async function init() {
  buildStatic();
  try {
    const b64 = localStorage.getItem(FONT_KEY);
    if (b64) await loadFontBuffer(b64ToBuf(b64));
  } catch { /* ignorieren */ }
  applyLayout();
  buildFormatSelect();
  if (MODE === 'poster') $('#exportType').value = 'pdf';
  syncUI();
  render(preview, cur, { preview: true, scale: previewScale() });
  try {
    await Promise.all([
      document.fonts.load('italic 800 40px "Barlow Condensed"'),
      document.fonts.load('400 40px "PT Sans"'),
      document.fonts.load('700 40px "PT Sans"'),
    ]);
  } catch {}
  detectInstalledFont();
  syncUI();
  scheduleRender(); scheduleThumbs(true);
  $('#btnUndo').onclick = undo; $('#btnRedo').onclick = redo;
  record(); // Ausgangszustand
  document.fonts.addEventListener && document.fonts.addEventListener('loadingdone', () => { scheduleRender(); scheduleThumbs(); });
})();
