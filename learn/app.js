/* =========================================================
   Neo Temperature Lab — Premium v2
   Features: gold searchable selects, tilt/parallax, PWA,
   particles, share-card generator, parser++, analytics,
   sounds & haptics, a11y, premium micro-themes.
   ========================================================= */

// ---------- DOM ----------
const canvas = document.getElementById('particles');

const powerInput = document.getElementById('powerInput');
const inputValue = document.getElementById('inputValue');
const fromUnit = document.getElementById('fromUnit');
const toUnit = document.getElementById('toUnit');

const precision = document.getElementById('precision');
const precisionNum = document.getElementById('precisionNum');
const sigfigs = document.getElementById('sigfigs');
const scientific = document.getElementById('scientific');

const swapBtn = document.getElementById('swapBtn');
const copyBtn = document.getElementById('copyBtn');
const shareCardBtn = document.getElementById('shareCardBtn');
const resetBtn = document.getElementById('resetBtn');
const favBtn = document.getElementById('favBtn');
const copyLinkBtn = document.getElementById('copyLinkBtn');
const clearAllBtn = document.getElementById('clearAllBtn');

const hint = document.getElementById('hint');
const statusPill = document.getElementById('statusPill');
const resultText = document.getElementById('resultText');

const historyList = document.getElementById('historyList');
const clearHistoryBtn = document.getElementById('clearHistoryBtn');
const exportCSV = document.getElementById('exportCSV');

const matrixBody = document.getElementById('matrixBody');

const premiumSwitch = document.getElementById('premiumSwitch');
const premiumThemeWrap = document.getElementById('premiumThemeWrap');
const premiumTheme = document.getElementById('premiumTheme');

const proTools = document.getElementById('proTools');
const autoCopy = document.getElementById('autoCopy');
const soundFx = document.getElementById('soundFx');
const favoritesBar = document.getElementById('favoritesBar');
const favChips = document.getElementById('favChips');
const clearFavs = document.getElementById('clearFavs');

const analytics = document.getElementById('analytics');
const statTotal = document.getElementById('statTotal');
const statTopPair = document.getElementById('statTopPair');
const statAvgP = document.getElementById('statAvgP');

// Premium custom selects
const fromCustom = document.getElementById('fromCustom');
const toCustom = document.getElementById('toCustom');

// ---------- Unit Registry ----------
const Units = {
    C: { sym: '°C', name: 'Celsius', min: -273.15, toC: v => v, fromC: v => v },
    F: { sym: '°F', name: 'Fahrenheit', min: -459.67, toC: v => (v - 32) * 5 / 9, fromC: v => v * 9 / 5 + 32 },
    K: { sym: 'K', name: 'Kelvin', min: 0, toC: v => v - 273.15, fromC: v => v + 273.15 },
    R: { sym: '°R', name: 'Rankine', min: 0, toC: v => (v - 491.67) * 5 / 9, fromC: v => (v + 273.15) * 9 / 5 },
    Re: { sym: '°Re', name: 'Réaumur', min: -218.52, toC: v => v * 5 / 4, fromC: v => v * 4 / 5 }
};
const UnitKeys = Object.keys(Units);

// ---------- Utils ----------
const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
function debounce(fn, ms = 120) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
const fmtTime = () => new Date().toLocaleTimeString();
const prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function makeURLState() {
    const params = new URLSearchParams({
        v: inputValue.value || '',
        from: fromUnit.value,
        to: toUnit.value,
        p: precision.value,
        sf: sigfigs.checked ? '1' : '0',
        sci: scientific.checked ? '1' : '0',
        q: powerInput.value || '',
        premium: document.body.classList.contains('premium') ? '1' : '0',
        theme: document.body.dataset.premiumTheme || 'gold'
    });
    history.replaceState(null, '', `?${params.toString()}`);
}
function readURLState() {
    const params = new URLSearchParams(location.search);
    if (params.has('from')) fromUnit.value = params.get('from');
    if (params.has('to')) toUnit.value = params.get('to');
    if (params.has('p')) { const p = clamp(+params.get('p') || 2, 0, 8); precision.value = p; precisionNum.value = p; }
    if (params.has('sf')) sigfigs.checked = params.get('sf') === '1';
    if (params.has('sci')) scientific.checked = params.get('sci') === '1';
    if (params.has('v')) inputValue.value = params.get('v');
    if (params.has('q')) powerInput.value = params.get('q');
    if (params.get('premium') === '1') enablePremium(true);
    const th = params.get('theme');
    if (th) setPremiumTheme(th, true);
}

// Significant figures + display formatting
function toSigFigs(num, sig) {
    if (!isFinite(num)) return '—';
    if (num === 0) return '0';
    const p = Math.max(1, sig | 0);
    return Number(num).toPrecision(p);
}
function toFixedSmart(num, dp, autoSci) {
    if (!isFinite(num)) return '—';
    const n = Number(num);
    const abs = Math.abs(n);
    if (autoSci && ((abs !== 0 && abs < 0.001) || abs >= 1e6)) return n.toExponential(dp);
    return n.toFixed(dp);
}
function formatOut(n) {
    const dp = +precision.value;
    return sigfigs.checked ? toSigFigs(n, dp || 2) : toFixedSmart(n, dp, scientific.checked);
}
function symbol(u) { return Units[u]?.sym || u; }
function unitName(u) { return Units[u]?.name || u; }

// Absolute-zero guard
function validateAbsoluteZero(value, unit) {
    const min = Units[unit]?.min;
    if (min === undefined) return { ok: true };
    if (value < min) return { ok: false, msg: `${unitName(unit)} cannot be below absolute zero (${min} ${symbol(unit)}).` };
    return { ok: true };
}

// ---------- Conversion ----------
function convert(value, from, to) {
    const toC = Units[from].toC(value);
    return Units[to].fromC(toC);
}
function convertAll(value, from) {
    const out = {};
    const c = Units[from].toC(value);
    for (const u of UnitKeys) out[u] = Units[u].fromC(c);
    return out;
}

// ---------- Parser++ ----------
function parsePower(s) {
    if (!s) return null;
    const str = s.trim().replace(/\s+/g, ' ');
    // "x unit to y" | "xunit" | "x unit -> all"
    const unitRe = '(?:c|°c|celsius|f|°f|fahrenheit|k|kelvin|r|°r|rankine|re|°re|reaumur)';
    const re = new RegExp(`^(-?\\d+(?:\\.\\d+)?)\\s*(${unitRe})?(?:\\s*(?:to|->|→)\\s*((${unitRe})|all))?$`, 'i');
    const m = str.match(re);
    if (!m) return null;
    const v = parseFloat(m[1]);
    const toRaw = m[3];
    const from = normalizeUnit(m[2]) || fromUnit.value;
    const to = toRaw && toRaw.toLowerCase() === 'all' ? 'ALL' : (normalizeUnit(toRaw) || toUnit.value);
    return { v, from, to };
}
function normalizeUnit(raw) {
    if (!raw) return null;
    const t = raw.replace('°', '').toLowerCase();
    switch (t) {
        case 'c': case 'celsius': return 'C';
        case 'f': case 'fahrenheit': return 'F';
        case 'k': case 'kelvin': return 'K';
        case 'r': case 'rankine': return 'R';
        case 're': case 'reaumur': return 'Re';
        default: return null;
    }
}

// ---------- History ----------
function addHistory(entry) {
    const li = document.createElement('li');
    li.innerHTML = `
    <span>${entry.val} ${symbol(entry.from)} → <strong>${entry.outFormatted} ${symbol(entry.to)}</strong></span>
    <span class="pill">${fmtTime()}</span>
  `;
    historyList.prepend(li);
    while (historyList.children.length > 12) historyList.removeChild(historyList.lastChild);
}
function clearHistory() { historyList.innerHTML = ''; }
function exportHistoryCSV() {
    const rows = [['Time', 'FromValue', 'FromUnit', 'ToValue', 'ToUnit']];
    Array.from(historyList.children).reverse().forEach(li => {
        const t = li.querySelector('.pill')?.textContent || '';
        const text = li.querySelector('span')?.textContent || '';
        const m = text.match(/^(.+?)\s([^\s]+)\s→\s(.+?)\s([^\s]+)$/);
        if (m) rows.push([t, m[1], m[2], m[3], m[4]]);
    });
    const csv = rows.map(r => r.map(x => `"${String(x).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'neo-temp-history.csv';
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}

// ---------- Favorites (premium) ----------
const FAV_KEY = 'neoTempFavs';
function getFavs() { try { return JSON.parse(localStorage.getItem(FAV_KEY) || '[]'); } catch { return [] } }
function setFavs(list) { localStorage.setItem(FAV_KEY, JSON.stringify(list.slice(0, 12))); }
function pairKey(a, b) { return `${a}->${b}`; }
function renderFavs() {
    favChips.innerHTML = '';
    const favs = getFavs();
    if (!favs.length) { favChips.innerHTML = `<div class="muted">No favorites yet. Click ☆ Favorite to save this pair.</div>`; return; }
    favs.forEach(k => {
        const [a, b] = k.split('->');
        const chip = document.createElement('button');
        chip.className = 'chip';
        chip.textContent = `${symbol(a)} → ${symbol(b)}`;
        chip.title = `Use ${a} to ${b}`;
        chip.addEventListener('click', () => {
            fromUnit.value = a; toUnit.value = b; syncGoldSelects(); runConvert(true);
        });
        favChips.appendChild(chip);
    });
}
function addCurrentToFavs() {
    if (!isPremium()) { pulsePill('warn', 'Premium feature'); return; }
    const k = pairKey(fromUnit.value, toUnit.value);
    const favs = getFavs(); if (!favs.includes(k)) favs.unshift(k);
    setFavs(favs); renderFavs(); pulsePill('ok', 'Saved to favorites');
}
function clearFavorites() { localStorage.removeItem(FAV_KEY); renderFavs(); pulsePill('ok', 'Favorites cleared'); }

// ---------- Analytics (local) ----------
const STATS_KEY = 'neoTempStats';
function getStats() { try { return JSON.parse(localStorage.getItem(STATS_KEY) || '{"total":0,"pairs":{},"pSum":0,"pCount":0}'); } catch { return { total: 0, pairs: {}, pSum: 0, pCount: 0 } } }
function setStats(s) { localStorage.setItem(STATS_KEY, JSON.stringify(s)); }
function bumpStats(from, to) {
    const s = getStats();
    s.total += 1;
    const k = pairKey(from, to); s.pairs[k] = (s.pairs[k] || 0) + 1;
    s.pSum += (+precision.value || 0); s.pCount += 1;
    setStats(s); renderStats();
}
function renderStats() {
    if (!isPremium()) return;
    const s = getStats();
    statTotal.textContent = s.total;
    const top = Object.entries(s.pairs).sort((a, b) => b[1] - a[1])[0];
    statTopPair.textContent = top ? `${top[0]} (${top[1]})` : '—';
    statAvgP.textContent = s.pCount ? (s.pSum / s.pCount).toFixed(2) : '—';
}

// ---------- Status / UI ----------
function setStatus(level, text) {
    statusPill.className = 'pill' + (level ? ` ${level}` : '');
    statusPill.textContent = text;
}
function setHint(text) { hint.textContent = text || ''; }
function pulseResult() {
    resultText.style.transform = 'translateY(-1px) scale(1.01)';
    requestAnimationFrame(() => { resultText.style.transform = ''; });
}
function pulsePill(level, text) {
    setStatus(level, text);
    setTimeout(() => setStatus(null, 'Ready'), 1200);
}

// ---------- Matrix & Meters ----------
function celsiusNormalized(c) {
    const pct = (c - (-50)) / 200;
    return clamp(Math.round(pct * 100), 0, 100);
}
function renderMatrix(value, from) {
    const map = convertAll(value, from);
    matrixBody.innerHTML = '';
    const c = Units[from].toC(value);
    const pct = celsiusNormalized(c);

    for (const u of UnitKeys) {
        const tr = document.createElement('tr');
        const val = map[u];
        tr.innerHTML = `
      <td><strong>${unitName(u)}</strong> <span class="muted">(${symbol(u)})</span></td>
      <td>${formatOut(val)}<div class="meter" style="--pct:${isPremium() ? pct : 0}%"></div></td>
      <td>${Units[u].min} ${symbol(u)}</td>
    `;
        matrixBody.appendChild(tr);
    }
}

// ---------- Convert & Paint ----------
function runConvert(pushHistory = true) {
    const vRaw = inputValue.value.trim();
    if (!vRaw) {
        resultText.textContent = '—'; matrixBody.innerHTML = '';
        setHint(''); setStatus(null, 'Ready'); inputValue.classList.remove('input-error'); makeURLState(); return;
    }
    const val = Number(vRaw);
    if (Number.isNaN(val)) {
        setStatus('warn', 'Invalid number'); setHint('Please enter a valid numeric value.');
        resultText.textContent = '—'; matrixBody.innerHTML = '';
        inputValue.classList.add('input-error'); return;
    }
    const from = fromUnit.value, to = toUnit.value;
    const check = validateAbsoluteZero(val, from);
    if (!check.ok) { inputValue.classList.add('input-error'); setStatus('err', 'Below absolute zero'); setHint(check.msg); resultText.textContent = '—'; matrixBody.innerHTML = ''; return; }
    inputValue.classList.remove('input-error'); setStatus('ok', 'OK'); setHint('');

    const out = convert(val, from, to);
    renderResult({ val, from, to, out });
    renderMatrix(val, from);

    if (pushHistory) addHistory({ val, from, to, outFormatted: formatOut(out) });

    makeURLState(); pulseResult();

    // Stats
    if (isPremium()) bumpStats(from, to);

    // Auto-copy
    if (isPremium() && autoCopy.checked) {
        const text = resultText.textContent.trim();
        navigator.clipboard?.writeText(text).then(() => {
            setHint('Auto-copied!');
            setTimeout(() => { if (hint.textContent === 'Auto-copied!') setHint(''); }, 1000);
            playChime(); vibrate(10);
        }).catch(() => { });
    }
}
const runConvertDebounced = debounce(() => runConvert(true), 120);

function renderResult({ val, from, to, out }) {
    resultText.textContent = `${formatOut(val)} ${symbol(from)} = ${formatOut(out)} ${symbol(to)}`;
}

// ---------- Power input ----------
function applyPowerInput() {
    const parsed = parsePower(powerInput.value);
    if (!parsed) { setStatus('warn', 'Could not parse input'); setHint('Try: "37 C to F", "98.6F", or "100 C -> all"'); return; }
    inputValue.value = String(parsed.v);
    fromUnit.value = parsed.from;
    toUnit.value = (parsed.to === 'ALL') ? toUnit.value : parsed.to;
    syncGoldSelects();
    setStatus('ok', 'Parsed'); setHint('');

    if (parsed.to === 'ALL') {
        // show matrix only; result remains based on current "to"
        runConvert(false);
        // small hint
        setHint('Converted to all units in the matrix below.');
    } else {
        runConvert(true);
    }
    makeURLState();
}

// ---------- Copy/Reset/Swap/Link ----------
async function copyResult() {
    const text = resultText.textContent.trim(); if (!text || text === '—') return;
    try { await navigator.clipboard.writeText(text); setHint('Copied result!'); setTimeout(() => { if (hint.textContent === 'Copied result!') setHint(''); }, 1200); playChime(); vibrate(10); }
    catch { setHint('Copy not allowed by browser.'); }
}
function resetInputs() { inputValue.value = ''; powerInput.value = ''; runConvert(false); }
function resetAll() {
    resetInputs(); fromUnit.value = 'C'; toUnit.value = 'F'; syncGoldSelects();
    precision.value = 2; precisionNum.value = 2; sigfigs.checked = false; scientific.checked = false;
    clearHistory(); makeURLState(); setStatus(null, 'Ready'); setHint('');
}
function swapUnits() { const a = fromUnit.value; fromUnit.value = toUnit.value; toUnit.value = a; syncGoldSelects(); runConvert(true); playChime(880); vibrate(8); }
async function copyLink() { makeURLState(); try { await navigator.clipboard.writeText(location.href); setHint('Link copied!'); setTimeout(() => { if (hint.textContent === 'Link copied!') setHint(''); }, 1200); playChime(1320); vibrate(6); } catch { setHint('Copy blocked by browser.'); } }

// ---------- Premium Mode ----------
const PREMIUM_KEY = 'neoTempPremium';
const THEME_KEY = 'neoTempPremiumTheme';
function isPremium() { return document.body.classList.contains('premium'); }
function enablePremium(silent = false) {
    document.body.classList.add('premium');
    premiumSwitch.checked = true;
    proTools.hidden = false;
    favoritesBar.hidden = false;
    analytics.hidden = false;
    premiumThemeWrap.hidden = false;
    fromCustom.hidden = false; toCustom.hidden = false;
    Array.from(document.querySelectorAll('.native-select')).forEach(e => e.style.display = 'none');
    localStorage.setItem(PREMIUM_KEY, '1');
    if (!silent) pulsePill('ok', 'Premium enabled');
    renderFavs(); renderStats(); initGoldSelects(); syncGoldSelects(); runConvert(false);
}
function disablePremium(silent = false) {
    document.body.classList.remove('premium', 'theme-rose', 'theme-plat');
    document.body.dataset.premiumTheme = 'gold';
    premiumSwitch.checked = false;
    proTools.hidden = true;
    favoritesBar.hidden = true;
    analytics.hidden = true;
    premiumThemeWrap.hidden = true;
    fromCustom.hidden = true; toCustom.hidden = true;
    Array.from(document.querySelectorAll('.native-select')).forEach(e => e.style.display = '');
    localStorage.setItem(PREMIUM_KEY, '0'); localStorage.setItem(THEME_KEY, 'gold');
    if (!silent) pulsePill(null, 'Premium off');
    runConvert(false);
}
function setPremiumTheme(name = 'gold', silent = false) {
    document.body.dataset.premiumTheme = name;
    document.body.classList.remove('theme-rose', 'theme-plat');
    if (name === 'rose') document.body.classList.add('theme-rose');
    else if (name === 'platinum') document.body.classList.add('theme-plat');
    if (!silent) pulsePill('ok', name === 'gold' ? 'Classic Gold' : name === 'rose' ? 'Rose Gold' : 'Platinum');
    localStorage.setItem(THEME_KEY, name);
}
function restorePremiumFromStorage() {
    if (localStorage.getItem(PREMIUM_KEY) === '1') enablePremium(true);
    const th = localStorage.getItem(THEME_KEY) || 'gold';
    premiumTheme.value = th === 'platinum' ? 'platinum' : th;
    setPremiumTheme(th, true);
}

// ---------- Custom Gold Selects (searchable) ----------
const UnitItems = UnitKeys.map(k => ({ key: k, icon: Units[k].sym, label: Units[k].name }));
function initGoldSelects() {
    [fromCustom, toCustom].forEach((wrap, idx) => {
        const list = wrap.querySelector('.gold-select__list');
        list.innerHTML = '';
        UnitItems.forEach(u => {
            const li = document.createElement('li');
            li.setAttribute('role', 'option'); li.dataset.key = u.key;
            li.innerHTML = `<span class="gold-select__icon">${u.icon}</span><span>${u.label}</span>`;
            li.addEventListener('click', () => {
                const target = wrap.querySelector('.gold-select__btn').dataset.for === 'from' ? fromUnit : toUnit;
                if (wrap.querySelector('.gold-select__btn').dataset.for === 'from') fromUnit.value = u.key; else toUnit.value = u.key;
                syncGoldSelects(); closeGoldSelect(wrap);
                runConvert(true);
            });
            list.appendChild(li);
        });
        const btn = wrap.querySelector('.gold-select__btn');
        btn.dataset.for = wrap.id === 'fromCustom' ? 'from' : 'to';
        btn.addEventListener('click', () => {
            const panel = wrap.querySelector('.gold-select__panel');
            const open = !panel.classList.contains('open');
            closeAllGoldSelects();
            if (open) { panel.classList.add('open'); panel.querySelector('.gold-select__search').focus(); }
        });
        wrap.querySelector('.gold-select__search').addEventListener('input', (e) => {
            const q = e.target.value.toLowerCase();
            Array.from(list.children).forEach(li => {
                li.style.display = li.textContent.toLowerCase().includes(q) ? '' : 'none';
            });
        });
    });
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.gold-select')) closeAllGoldSelects();
    });
}
function closeGoldSelect(wrap) { wrap.querySelector('.gold-select__panel').classList.remove('open'); }
function closeAllGoldSelects() { document.querySelectorAll('.gold-select__panel.open').forEach(p => p.classList.remove('open')); }
function syncGoldSelects() {
    if (!isPremium()) return;
    const map = { from: fromCustom, to: toCustom };
    Object.entries(map).forEach(([type, wrap]) => {
        const key = type === 'from' ? fromUnit.value : toUnit.value;
        wrap.querySelector('.gold-select__icon').textContent = Units[key].sym;
        wrap.querySelector('.gold-select__label').textContent = Units[key].name;
        // aria-selected
        wrap.querySelectorAll('.gold-select__list li').forEach(li => li.setAttribute('aria-selected', li.dataset.key === key ? 'true' : 'false'));
    });
}

// ---------- Particles (canvas) ----------
const ctx = canvas.getContext('2d');
let particles = []; let lastT = 0; let lowFPS = false;
function resizeCanvas() { canvas.width = innerWidth; canvas.height = innerHeight; }
window.addEventListener('resize', resizeCanvas); resizeCanvas();
function spawn(x, y, color = 'gold') {
    if (prefersReduced || lowFPS) return;
    for (let i = 0; i < 6; i++) {
        particles.push({
            x, y, vx: (Math.random() - 0.5) * 1.2, vy: (Math.random() - 0.5) * 1.2 - 0.4,
            a: 1, r: 1 + Math.random() * 2, c: color === 'gold' ? 'rgba(246,214,107,' : 'rgba(138,180,248,', life: 700
        });
    }
}
function tick(ts) {
    const dt = lastT ? ts - lastT : 16; lastT = ts;
    if (dt > 80) lowFPS = true; // pause effects if too slow
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const now = performance.now();
    particles = particles.filter(p => (p.life -= dt) > 0);
    for (const p of particles) {
        p.x += p.vx * dt / 16; p.y += p.vy * dt / 16; p.a = Math.max(0, p.life / 700);
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `${p.c}${p.a})`; ctx.fill();
    }
    requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
window.addEventListener('pointermove', (e) => isPremium() ? spawn(e.clientX, e.clientY, 'gold') : null);

// ---------- 3D Tilt / Parallax ----------
function initTilt() {
    document.querySelectorAll('[data-tilt]').forEach(el => {
        const max = +el.dataset.tiltMax || 6;
        function onMove(e) {
            if (prefersReduced) return;
            const rect = el.getBoundingClientRect();
            const cx = rect.left + rect.width / 2;
            const cy = rect.top + rect.height / 2;
            const dx = (e.clientX - cx) / rect.width;
            const dy = (e.clientY - cy) / rect.height;
            el.style.transform = `rotateX(${-dy * max}deg) rotateY(${dx * max}deg)`;
        }
        function onLeave() { el.style.transform = ''; }
        el.addEventListener('pointermove', onMove);
        el.addEventListener('pointerleave', onLeave);
    });
}
initTilt();

// ---------- Sounds & Haptics ----------
let actx;
function playChime(freq = 1040) {
    if (!isPremium() || !soundFx.checked) return;
    try {
        actx = actx || new (window.AudioContext || window.webkitAudioContext)();
        const o = actx.createOscillator(); const g = actx.createGain();
        o.type = 'sine'; o.frequency.value = freq;
        o.connect(g); g.connect(actx.destination);
        g.gain.setValueAtTime(0.0001, actx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.15, actx.currentTime + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + 0.15);
        o.start(); o.stop(actx.currentTime + 0.16);
    } catch { }
}
function vibrate(ms = 10) {
    if (!isPremium() || !soundFx.checked) return;
    if (navigator.vibrate) navigator.vibrate(ms);
}

/* ==== Share Card: Premium Edition =======================================
   Features:
   - Theme-aware bezel frame + inner glow
   - Brushed-metal background + optional noise
   - Round brand logo with metallic ring (fallback emoji)
   - AmEx-style gradient nameplate (theme-aware)
   - Hero result with shadow + outline + smart auto-shrink
   - Two-column matrix with dotted leaders + unit icons
   - Format & quality control (PNG/JPEG/WebP) + Web Share API fallback
   - IST timestamp
   - Optional QR code (uses window.QRCode if present)
========================================================================== */

const CARD_LOGO_SRC = './web-app-manifest-192x192.png'; // update path if needed
const CARD_LOGO = new Image();
CARD_LOGO.src = CARD_LOGO_SRC;

/* --- theme helpers --- */
function currentThemeKey() {
    if (!isPremium()) return 'normal';
    const b = document.body;
    if (b.classList.contains('theme-rose')) return 'rose';
    if (b.classList.contains('theme-plat')) return 'plat';
    return 'gold';
}
function themeColors(key) {
    switch (key) {
        case 'rose': return {
            bg1: '#5d2e36', bg2: '#33161a',
            bezelA: '#5b2e36', bezelB: '#f7b2b2',
            text: '#fff2f4', sub: '#ffd1d6', accent: '#f6d66b'
        };
        case 'plat': return {
            bg1: '#3c4752', bg2: '#1f262d',
            bezelA: '#6f7f8f', bezelB: '#d8e1e8',
            text: '#eef3f7', sub: '#dfe7ee', accent: '#d8e1e8'
        };
        case 'gold': return {
            bg1: '#2b2414', bg2: '#0f0b05',
            bezelA: '#5d4e2a', bezelB: '#f6e27a',
            text: '#fff6cf', sub: '#e5d9ad', accent: '#f6d66b'
        };
        default: return {
            bg1: '#0f1629', bg2: '#0a0f1c',
            bezelA: '#3a5a7a', bezelB: '#9cd3ff',
            text: '#eaf0ff', sub: '#a8b7d8', accent: '#6ad1ff'
        };
    }
}

/* --- background: brushed metal + optional noise overlay --- */
function fillBrushed(cx, w, h, c1, c2) {
    const g = cx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, c1); g.addColorStop(1, c2);
    cx.fillStyle = g; cx.fillRect(0, 0, w, h);

    cx.globalAlpha = 0.06;
    cx.fillStyle = 'rgba(255,255,255,0.18)';
    for (let y = 0; y < h; y += 2) cx.fillRect(0, y, w, 1);
    cx.globalAlpha = 1;
}
function overlayNoise(cx, w, h, alpha = 0.04) {
    const n = 120;
    const tile = document.createElement('canvas');
    tile.width = n; tile.height = n;
    const t = tile.getContext('2d');
    const img = t.createImageData(n, n);
    for (let i = 0; i < img.data.length; i += 4) {
        const v = 220 + Math.random() * 35 | 0;
        img.data[i] = v; img.data[i + 1] = v; img.data[i + 2] = v; img.data[i + 3] = 35;
    }
    t.putImageData(img, 0, 0);
    const pat = cx.createPattern(tile, 'repeat');
    cx.save(); cx.globalAlpha = alpha; cx.fillStyle = pat; cx.fillRect(0, 0, w, h); cx.restore();
}

/* --- bezel frame + inner glow --- */
function strokeBezel(cx, w, h, theme) {
    const { bezelA, bezelB } = themeColors(theme);
    const g = cx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, bezelA);
    g.addColorStop(0.5, bezelB);
    g.addColorStop(1, bezelA);

    cx.save();
    cx.lineWidth = 8; cx.strokeStyle = g;
    cx.strokeRect(14, 14, w - 28, h - 28);

    cx.strokeStyle = theme === 'normal'
        ? 'rgba(255,255,255,0.12)'
        : 'rgba(246,214,107,0.22)';
    cx.lineWidth = 2; cx.strokeRect(24, 24, w - 48, h - 48);
    cx.restore();
}

/* --- ROUND brand logo (circular mask + metallic ring) --- */
function drawRoundLogo(cx, img, {
    cx0 = 68, cy0 = 58, r = 30, fallback = '🌡️'
} = {}) {
    cx.save();
    cx.beginPath(); cx.arc(cx0, cy0, r, 0, Math.PI * 2); cx.clip();

    if (img && img.complete && img.naturalWidth) {
        cx.drawImage(img, cx0 - r, cy0 - r, r * 2, r * 2);
    } else {
        cx.fillStyle = 'rgba(255,255,255,0.06)';
        cx.fillRect(cx0 - r, cy0 - r, r * 2, r * 2);
        cx.fillStyle = '#ffffff';
        cx.font = '700 26px ui-sans-serif, system-ui';
        cx.textAlign = 'center'; cx.textBaseline = 'middle';
        cx.fillText(fallback, cx0, cy0);
    }
    cx.restore();

    // metallic dual ring
    cx.save();
    cx.lineWidth = 2.5; cx.strokeStyle = 'rgba(255,255,255,0.35)';
    cx.beginPath(); cx.arc(cx0, cy0, r + 1.25, 0, Math.PI * 2); cx.stroke();

    cx.lineWidth = 1.25; cx.strokeStyle = 'rgba(0,0,0,0.35)';
    cx.beginPath(); cx.arc(cx0, cy0, r - 1.25, 0, Math.PI * 2); cx.stroke();
    cx.restore();
}

/* --- NAMEPLATE (AmEx-style premium gradient pill) --- */
function drawNameplate(cx, text, x, y, themeKey, {
    padX = 18, padY = 10, radius = 16, maxW = 560,
    font = '700 28px ui-sans-serif, system-ui, Segoe UI'
} = {}) {
    cx.font = font; cx.textAlign = 'left'; cx.textBaseline = 'middle';
    let size = 28, tw = cx.measureText(text).width;
    while (tw > maxW - padX * 2 && size > 18) {
        size -= 2; cx.font = `700 ${size}px ui-sans-serif, system-ui, Segoe UI`;
        tw = cx.measureText(text).width;
    }
    const w = Math.min(maxW, tw + padX * 2), h = size + padY * 2;

    let g;
    if (themeKey === 'gold') {
        g = cx.createLinearGradient(x, y - h / 2, x + w, y + h / 2);
        g.addColorStop(0, '#5d4e2a'); g.addColorStop(.5, '#f6e27a'); g.addColorStop(1, '#5d4e2a');
    } else if (themeKey === 'rose') {
        g = cx.createLinearGradient(x, y - h / 2, x + w, y + h / 2);
        g.addColorStop(0, '#6d3943'); g.addColorStop(.5, '#ffb7b2'); g.addColorStop(1, '#6d3943');
    } else if (themeKey === 'plat') {
        g = cx.createLinearGradient(x, y - h / 2, x + w, y + h / 2);
        g.addColorStop(0, '#6f7f8f'); g.addColorStop(.5, '#d8e1e8'); g.addColorStop(1, '#6f7f8f');
    } else {
        g = cx.createLinearGradient(x, y - h / 2, x + w, y + h / 2);
        g.addColorStop(0, '#2a3b55'); g.addColorStop(.5, '#9cd3ff'); g.addColorStop(1, '#2a3b55');
    }

    cx.save();
    cx.shadowColor = 'rgba(0,0,0,0.35)'; cx.shadowBlur = 8; cx.shadowOffsetY = 2;

    // rounded pill
    cx.beginPath();
    const r = radius, x2 = x + w, yTop = y - h / 2, yBot = y + h / 2;
    cx.moveTo(x + r, yTop);
    cx.lineTo(x2 - r, yTop);
    cx.quadraticCurveTo(x2, yTop, x2, yTop + r);
    cx.lineTo(x2, yBot - r);
    cx.quadraticCurveTo(x2, yBot, x2 - r, yBot);
    cx.lineTo(x + r, yBot);
    cx.quadraticCurveTo(x, yBot, x, yBot - r);
    cx.lineTo(x, yTop + r);
    cx.quadraticCurveTo(x, yTop, x + r, yTop);
    cx.closePath();

    cx.fillStyle = g; cx.fill();

    // inner highlight stroke
    cx.shadowBlur = 0;
    cx.strokeStyle = themeKey === 'normal' ? 'rgba(255,255,255,0.35)' : 'rgba(255,245,205,0.45)';
    cx.lineWidth = 1.4; cx.stroke();

    // beveled title
    cx.fillStyle = themeKey === 'normal' ? '#0b1426' : '#1b150a';
    cx.fillText(text, x + padX, y + 1);
    cx.fillStyle = themeKey === 'normal' ? '#eaf3ff' : '#fffaf0';
    cx.fillText(text, x + padX, y - 1);

    cx.restore();
    return { w, h };
}

/* --- smart hero text (shadow + outline + autoshrink) --- */
function drawHero(cx, text, x, y, {
    maxWidth, maxSize = 44, minSize = 28, fill = '#fff',
} = {}) {
    let size = maxSize;
    cx.textAlign = 'left'; cx.textBaseline = 'alphabetic';
    while (size >= minSize) {
        cx.font = `700 ${size}px ui-sans-serif, system-ui, Segoe UI`;
        if (cx.measureText(text).width <= maxWidth) break;
        size -= 2;
    }
    cx.save();
    cx.fillStyle = fill;
    cx.shadowColor = 'rgba(0,0,0,0.35)'; cx.shadowBlur = 6; cx.shadowOffsetY = 2;
    cx.fillText(text, x, y);
    cx.shadowBlur = 0; cx.lineWidth = 2; cx.strokeStyle = 'rgba(255,255,255,0.12)';
    cx.strokeText(text, x, y);
    cx.restore();
}

/* --- dotted leaders helper --- */
function drawDottedLine(cx, x1, y, x2, color = 'rgba(255,255,255,0.18)') {
    cx.save();
    cx.strokeStyle = color; cx.lineWidth = 1; cx.setLineDash([2, 3]);
    cx.beginPath(); cx.moveTo(x1, y); cx.lineTo(x2, y); cx.stroke();
    cx.restore();
}

/* --- matrix (two columns, icons) --- */
const UnitIcon = { C: '°C', F: '°F', K: '🧪', R: '°R', Re: '°Re' };

function drawMatrixTwoCol(cx, map, themeKey, x, y, colW, rowH) {
    const theme = themeColors(themeKey);
    const nameColor = theme.sub;
    const valColor = themeKey === 'normal' ? '#cfe2ff' : '#fff6cf';

    const leftX = x;
    const rightX = x + colW + 40;
    let ly = y, ry = y;

    cx.font = '600 20px ui-sans-serif, system-ui, Segoe UI';

    const units = [...UnitKeys];
    const half = Math.ceil(units.length / 2);
    const leftUnits = units.slice(0, half);
    const rightUnits = units.slice(half);

    function drawRow(U, xx, yy) {
        const u = Units[U];
        const icon = UnitIcon[U] || '';
        const name = `${u.name} ${icon ? `(${icon})` : ''}`;
        const value = formatOut(map[U]);

        // name
        cx.fillStyle = nameColor;
        cx.textAlign = 'left';
        cx.fillText(name, xx, yy);

        // dotted leaders
        const nameWidth = cx.measureText(name).width;
        const lineStart = xx + nameWidth + 10;
        const maxValX = xx + colW;
        drawDottedLine(cx, lineStart, yy - 6, maxValX - 4, 'rgba(255,255,255,0.15)');

        // value right-aligned
        cx.fillStyle = valColor;
        cx.textAlign = 'right';
        cx.fillText(value, maxValX, yy);
        cx.textAlign = 'left';
    }

    for (const U of leftUnits) { drawRow(U, leftX, ly); ly += rowH; }
    for (const U of rightUnits) { drawRow(U, rightX, ry); ry += rowH; }
}

/* --- timestamp (IST) --- */
function stampIST() {
    try { return new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }); }
    catch { return new Date().toLocaleString(); }
}

/* --- optional QR (if QRCode lib available) --- */
async function drawQR(cx, text, x, y, size, stroke = 'rgba(246,214,107,0.45)') {
    if (!window.QRCode) return;
    const qr = new window.QRCode(-1, window.QRCode.ErrorCorrectLevel.M);
    qr.addData(text); qr.make();

    const tile = size / qr.getModuleCount();
    cx.save(); cx.fillStyle = '#000';
    for (let r = 0; r < qr.getModuleCount(); r++) {
        for (let c = 0; c < qr.getModuleCount(); c++) {
            if (qr.isDark(r, c)) cx.fillRect(x + c * tile, y + r * tile, tile, tile);
        }
    }
    cx.restore();

    cx.save(); cx.strokeStyle = stroke; cx.lineWidth = 2;
    cx.strokeRect(x - 2, y - 2, size + 4, size + 4); cx.restore();
}

/* --- export & share --- */
async function shareOrDownload(canvas, fmt = 'png', quality = 0.92, filename = 'neo-temp-share') {
    const mime = fmt === 'jpeg' ? 'image/jpeg' : (fmt === 'webp' ? 'image/webp' : 'image/png');
    const blob = await new Promise(res => canvas.toBlob(res, mime, quality));
    if (!blob) {
        const a = document.createElement('a');
        a.href = canvas.toDataURL(mime, quality); a.download = `${filename}.${fmt}`; a.click();
        return;
    }
    const file = new File([blob], `${filename}.${fmt}`, { type: mime });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Neo Temperature Lab' });
    } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = `${filename}.${fmt}`; a.click();
        URL.revokeObjectURL(url);
    }
}

/* ================= main generator ================= */
async function generateShareCard(opts = {}) {
    // optional UI controls (fallback defaults)
    const fmtSel = document.getElementById('shareFormat');   // png|jpeg|webp
    const qSel = document.getElementById('shareQuality');  // 0.8..0.95
    const sizeSel = document.getElementById('sharePreset');   // classic|social|story|square
    const wantQR = document.getElementById('shareQR')?.checked;

    const preset = (sizeSel?.value) || opts.preset || 'classic';
    const format = (fmtSel?.value) || opts.format || 'png';
    const quality = Number(qSel?.value || opts.quality || 0.92);

    const PRESETS = {
        classic: { w: 900, h: 470 },
        social: { w: 1200, h: 630 },
        story: { w: 1080, h: 1920 },
        square: { w: 1080, h: 1080 },
    };
    const { w, h } = PRESETS[preset] || PRESETS.classic;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const can = document.createElement('canvas');
    can.width = Math.round(w * dpr);
    can.height = Math.round(h * dpr);
    can.style.width = w + 'px';
    can.style.height = h + 'px';
    const cx = can.getContext('2d');
    cx.scale(dpr, dpr);

    // theme
    const themeKey = currentThemeKey();
    const theme = themeColors(themeKey);

    // background
    fillBrushed(cx, w, h, theme.bg1, theme.bg2);
    if (isPremium()) overlayNoise(cx, w, h, 0.05);

    // bezel
    strokeBezel(cx, w, h, themeKey);

    // round logo (left)
    drawRoundLogo(cx, CARD_LOGO, { cx0: 68, cy0: 58, r: 30, fallback: '🌡️' });

    // nameplate (AmEx vibe)
    const plate = drawNameplate(
        cx,
        'Neo Temperature Lab',
        112, /* x */
        58,  /* y (aligned with logo center) */
        themeKey,
        { padX: 18, padY: 10, radius: 16, maxW: w - 112 - 36 }
    );

    // subtitle under plate
    cx.font = '600 16px ui-sans-serif, system-ui, Segoe UI';
    cx.textAlign = 'left'; cx.textBaseline = 'alphabetic';
    cx.fillStyle = themeKey === 'normal' ? '#cfe2ff' : theme.sub;

    const valRaw = Number(inputValue.value || 0);
    const from = fromUnit.value;
    const toSel = document.getElementById('toUnit')?.value || 'F';
    const useSig = document.getElementById('sigfigs')?.checked;
    const sci = document.getElementById('scientific')?.checked;

    cx.fillText(
        `${formatOut(valRaw)} ${Units[from].sym} → ${Units[toSel].sym} • ${useSig ? 'sig figs' : 'dp'} • sci ${sci ? 'on' : 'off'}`,
        112,
        58 + plate.h / 2 + 18
    );

    // hero result
    const resText = resultText.textContent || '—';
    drawHero(cx, resText, 40, 180, {
        maxWidth: w - 80,
        maxSize: preset === 'story' ? 72 : 46,
        minSize: 26,
        fill: theme.text
    });

    // matrix (two columns)
    const map = convertAll(valRaw, from);
    cx.font = '600 20px ui-sans-serif, system-ui, Segoe UI';
    drawMatrixTwoCol(cx, map, themeKey, 40, 230, Math.floor((w - 120) / 2), 34);

    // footer: timestamp
    cx.font = '14px ui-sans-serif, system-ui, Segoe UI';
    cx.fillStyle = themeKey === 'normal' ? '#8b5cf6' : theme.accent;
    cx.textAlign = 'left';
    cx.fillText(`Generated ${stampIST()}`, 40, h - 28);

    // footer: credit (right)
    const CREDIT = '~ Made by Soumyadip';
    cx.save();
    cx.font = '600 16px ui-sans-serif, system-ui, Segoe UI';
    cx.textAlign = 'right';
    cx.fillStyle = themeKey === 'normal' ? '#6ad1ff' : theme.accent;
    if (isPremium()) { cx.shadowColor = 'rgba(246,214,107,0.35)'; cx.shadowBlur = 8; }
    cx.fillText(CREDIT, w - 22, h - 22);
    cx.restore();

    // optional QR
    if (wantQR || opts.qr) {
        const shareLink = location.href;
        const size = Math.min(120, Math.floor(w * 0.12));
        await drawQR(
            cx, shareLink, w - size - 28, h - size - 36, size,
            themeKey === 'normal' ? 'rgba(255,255,255,0.28)' : 'rgba(246,214,107,0.45)'
        );
    }

    // export/share
    await shareOrDownload(can, format, quality, 'neo-temp-share');

    playChime?.(1200); vibrate?.(12); spawn?.(innerWidth - 80, 80, 'gold');
}

// Create a unique invite link with optional meta (no backend needed)
function makeInviteLink({ base = location.origin + location.pathname, code, meta = {} } = {}) {
    const token = code || (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2));
    const params = new URLSearchParams({ invite: token, ...meta });
    return `${base}?${params.toString()}`;
}

// Read invite params if someone opens your app from an invite link
function getInviteParams() {
    const sp = new URLSearchParams(location.search);
    return {
        invite: sp.get('invite'),
        ref: sp.get('ref'),
        campaign: sp.get('campaign'),
    };
}














/* === Invite Helpers + QR Rendering (drop-in) ========================== */

/** Create a unique invite link (no backend needed) */
function makeInviteLink({ base = location.origin + location.pathname, code, meta = {} } = {}) {
    const token = code || (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2));
    const params = new URLSearchParams({ invite: token, ...meta });
    return `${base}?${params.toString()}`;
}

/** Wrap paragraph into multiple lines within max width */
function wrapText(cx, text, x, y, maxWidth, lineHeight) {
    const words = text.split(/\s+/);
    let line = '', yy = y;
    for (let i = 0; i < words.length; i++) {
        const test = line ? line + ' ' + words[i] : words[i];
        if (cx.measureText(test).width <= maxWidth) {
            line = test;
        } else {
            cx.fillText(line, x, yy); yy += lineHeight; line = words[i];
        }
    }
    if (line) cx.fillText(line, x, yy);
    return yy;
}

/** Fancy panel behind QR (rounded, theme gradient stroke) */
function drawQRPanel(cx, x, y, w, h, themeKey) {
    const r = 16;
    cx.save();
    // Panel shadow
    cx.shadowColor = 'rgba(0,0,0,0.35)';
    cx.shadowBlur = 10; cx.shadowOffsetY = 3;

    // Panel fill (subtle glass)
    cx.fillStyle = themeKey === 'normal' ? 'rgba(255,255,255,0.07)' : 'rgba(255,245,205,0.06)';
    cx.beginPath();
    cx.moveTo(x + r, y); cx.lineTo(x + w - r, y); cx.quadraticCurveTo(x + w, y, x + w, y + r);
    cx.lineTo(x + w, y + h - r); cx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    cx.lineTo(x + r, y + h); cx.quadraticCurveTo(x, y + h, x, y + h - r);
    cx.lineTo(x, y + r); cx.quadraticCurveTo(x, y, x + r, y);
    cx.closePath(); cx.fill();

    // Gradient stroke
    let g = cx.createLinearGradient(x, y, x + w, y + h);
    if (themeKey === 'gold') { g.addColorStop(0, '#5d4e2a'); g.addColorStop(0.5, '#f6e27a'); g.addColorStop(1, '#5d4e2a'); }
    else if (themeKey === 'rose') { g.addColorStop(0, '#6d3943'); g.addColorStop(0.5, '#ffb7b2'); g.addColorStop(1, '#6d3943'); }
    else if (themeKey === 'plat') { g.addColorStop(0, '#6f7f8f'); g.addColorStop(0.5, '#d8e1e8'); g.addColorStop(1, '#6f7f8f'); }
    else { g.addColorStop(0, '#2a3b55'); g.addColorStop(0.5, '#9cd3ff'); g.addColorStop(1, '#2a3b55'); }
    cx.shadowBlur = 0; cx.lineWidth = 2; cx.strokeStyle = g; cx.stroke();
    cx.restore();
}

/** Compatibility drawQR: supports qrcode-generator OR qrcodejs (David Shim) */
async function drawQR(cx, text, x, y, size, stroke = 'rgba(246,214,107,0.45)') {
    // Lib A: qrcode-generator (window.QRCode with ErrorCorrectLevel)
    if (window.QRCode && window.QRCode.ErrorCorrectLevel) {
        const qr = new window.QRCode(-1, window.QRCode.ErrorCorrectLevel.M);
        qr.addData(text); qr.make();
        const N = qr.getModuleCount();
        const tile = size / N;

        cx.save();
        cx.fillStyle = '#fff'; // quiet zone base
        cx.fillRect(x - 4, y - 4, size + 8, size + 8);

        cx.fillStyle = '#000';
        for (let r = 0; r < N; r++) {
            for (let c = 0; c < N; c++) {
                if (qr.isDark(r, c)) {
                    const px = Math.round(x + c * tile);
                    const py = Math.round(y + r * tile);
                    const w = Math.ceil(tile);
                    const h = Math.ceil(tile);
                    cx.fillRect(px, py, w, h);
                }
            }
        }
        cx.restore();

        // frame
        cx.save(); cx.strokeStyle = stroke; cx.lineWidth = 2;
        cx.strokeRect(x - 2, y - 2, size + 4, size + 4); cx.restore();
        return;
    }

    // Lib B: qrcodejs (David Shim) – constructor needing a DOM element
    if (window.QRCode && typeof window.QRCode === 'function' && !window.QRCode.ErrorCorrectLevel) {
        const tmp = document.createElement('div');
        tmp.style.position = 'fixed'; tmp.style.left = '-9999px';
        document.body.appendChild(tmp);

        // build QR
        const qrobj = new window.QRCode(tmp, {
            text,
            width: size,
            height: size,
            colorDark: '#000000',
            colorLight: '#ffffff',
            correctLevel: window.QRCode.CorrectLevel ? window.QRCode.CorrectLevel.M : 1
        });

        let el = tmp.querySelector('canvas') || tmp.querySelector('img');
        if (!el) { document.body.removeChild(tmp); throw new Error('qrcodejs canvas/img not found'); }

        await new Promise(r => setTimeout(r, 0)); // ensure render
        if (el.tagName === 'IMG') {
            await new Promise(res => { if (el.complete) return res(); el.onload = () => res(); el.onerror = () => res(); });
            cx.drawImage(el, x, y, size, size);
        } else {
            cx.drawImage(el, x, y, size, size);
        }

        cx.save(); cx.strokeStyle = stroke; cx.lineWidth = 2;
        cx.strokeRect(x - 2, y - 2, size + 4, size + 4); cx.restore();

        document.body.removeChild(tmp);
        return;
    }

    // No library present
    console.warn('QR library not found. Include qrcode-generator OR qrcodejs before app.js');
    cx.save();
    cx.fillStyle = 'rgba(0,0,0,0.2)';
    cx.fillRect(x, y, size, size);
    cx.fillStyle = '#fff';
    cx.font = '600 12px ui-sans-serif, system-ui';
    cx.textAlign = 'center'; cx.textBaseline = 'middle';
    cx.fillText('QR lib missing', x + size / 2, y + size / 2);
    cx.restore();
}

/* === Main: QR-only Invitation Card (premium layout) =================== */
async function generateInvitationQRCard(opts = {}) {
    const {
        host = 'Soumyadip',
        title = 'You’re Invited!',
        subtitle = 'Scan to join Neo Temperature Lab',
        // deep-link meta (optional)
        code, ref, campaign,
        // output/preset
        preset = 'classic',   // classic | social | story | square
        format = 'png',       // png | jpeg | webp
        quality = 0.95,        // higher for crisp invite
        showLogo = true,
        showScanCaption = true
    } = opts;

    // sizes
    const PRESETS = {
        classic: { w: 900, h: 470 },
        social: { w: 1200, h: 630 },
        story: { w: 1080, h: 1920 },
        square: { w: 1080, h: 1080 },
    };
    const { w, h } = PRESETS[preset] || PRESETS.classic;

    // canvas (Hi-DPI, more crisp)
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const can = document.createElement('canvas');
    can.width = Math.round(w * dpr); can.height = Math.round(h * dpr);
    can.style.width = w + 'px'; can.style.height = h + 'px';
    const cx = can.getContext('2d'); cx.scale(dpr, dpr);

    // theme + background + bezel
    const themeKey = currentThemeKey();
    const theme = themeColors(themeKey);
    fillBrushed(cx, w, h, theme.bg1, theme.bg2);
    if (isPremium()) overlayNoise(cx, w, h, 0.05);
    strokeBezel(cx, w, h, themeKey);

    // logo + nameplate (CARD_LOGO must exist from your Share Card code)
    if (showLogo) drawRoundLogo(cx, CARD_LOGO, { cx0: 72, cy0: 70, r: 32, fallback: '🌡️' });
    const plate = drawNameplate(
        cx, 'Neo Temperature Lab',
        showLogo ? 120 : 40, 70, themeKey,
        { padX: 18, padY: 10, radius: 16, maxW: w - (showLogo ? 160 : 80) }
    );

    // Title
    cx.textAlign = 'left'; cx.textBaseline = 'alphabetic'; cx.fillStyle = theme.text;
    let titleSize = preset === 'story' ? 60 : 40;
    while (titleSize >= 26) {
        cx.font = `800 ${titleSize}px ui-sans-serif, system-ui, Segoe UI`;
        if (cx.measureText(title).width <= w - 80) break;
        titleSize -= 2;
    }
    cx.shadowColor = 'rgba(0,0,0,0.35)'; cx.shadowBlur = 6; cx.shadowOffsetY = 2;
    cx.fillText(title, 40, 160); cx.shadowBlur = 0;

    // Subtitle
    cx.font = '600 20px ui-sans-serif, system-ui, Segoe UI';
    cx.fillStyle = themeKey === 'normal' ? '#cfe2ff' : theme.sub;
    cx.fillText(subtitle, 40, 190);

    // Host badge
    const hostText = `Host: ${host}`;
    cx.font = '700 16px ui-sans-serif, system-ui, Segoe UI';
    const hw = cx.measureText(hostText).width + 20, hh = 28;
    const hx = 40, hy = 210, rr = 12;
    cx.beginPath();
    cx.moveTo(hx + rr, hy); cx.lineTo(hx + hw - rr, hy); cx.quadraticCurveTo(hx + hw, hy, hx + hw, hy + rr);
    cx.lineTo(hx + hw, hy + hh - rr); cx.quadraticCurveTo(hx + hw, hy + hh, hx + hw - rr, hy + hh);
    cx.lineTo(hx + rr, hy + hh); cx.quadraticCurveTo(hx, hy + hh, hx, hy + hh - rr);
    cx.lineTo(hx, hy + rr); cx.quadraticCurveTo(hx, hy, hx + rr, hy);
    const gBadge = cx.createLinearGradient(hx, hy, hx + hw, hy + hh);
    if (themeKey === 'gold') { gBadge.addColorStop(0, '#5d4e2a'); gBadge.addColorStop(1, '#f6e27a'); }
    else if (themeKey === 'rose') { gBadge.addColorStop(0, '#6d3943'); gBadge.addColorStop(1, '#ffb7b2'); }
    else if (themeKey === 'plat') { gBadge.addColorStop(0, '#6f7f8f'); gBadge.addColorStop(1, '#d8e1e8'); }
    else { gBadge.addColorStop(0, '#2a3b55'); gBadge.addColorStop(1, '#9cd3ff'); }
    cx.fillStyle = gBadge; cx.fill();
    cx.fillStyle = themeKey === 'normal' ? '#0b1426' : '#1b150a';
    cx.fillText(hostText, hx + 10, hy + 19);

    /* ---- Right-middle QR safe area ---- */
    const margin = 32;
    const panelW = Math.min(Math.floor(w * 0.36), 420);
    const panelH = Math.min(Math.floor(h * 0.68), 420);
    const panelX = w - panelW - margin;
    const panelY = Math.floor((h - panelH) / 2);

    drawQRPanel(cx, panelX, panelY, panelW, panelH, themeKey);

    // Invite URL (not printed as text)
    const inviteURL = makeInviteLink({ code, meta: { ref, campaign } });

    // QR size inside panel (quiet zone + optional caption space)
    const qrMargin = 18;
    const captionH = showScanCaption ? 26 : 0;
    const qrSize = Math.min(panelW - 2 * qrMargin, panelH - 2 * qrMargin - captionH);

    // White base (quiet zone beyond QR)
    cx.save();
    cx.fillStyle = '#ffffff';
    const basePad = 6;
    const qx = panelX + Math.floor((panelW - qrSize) / 2);
    const qy = panelY + Math.floor((panelH - captionH - qrSize) / 2);
    cx.fillRect(qx - basePad, qy - basePad, qrSize + basePad * 2, qrSize + basePad * 2);
    cx.restore();

    // Draw QR crisp
    await drawQR(
        cx, inviteURL,
        qx, qy,
        qrSize,
        themeKey === 'normal' ? 'rgba(255,255,255,0.28)' : 'rgba(246,214,107,0.45)'
    );

    if (showScanCaption) {
        cx.font = '700 14px ui-sans-serif, system-ui, Segoe UI';
        cx.textAlign = 'center'; cx.textBaseline = 'alphabetic';
        cx.fillStyle = themeKey === 'normal' ? '#cfe2ff' : theme.sub;
        cx.fillText('Scan to Join', panelX + panelW / 2, panelY + panelH - 10);
    }

    /* ---- About app (left) ---- */
    cx.textAlign = 'left'; cx.textBaseline = 'alphabetic';
    cx.fillStyle = theme.text;
    cx.font = '700 18px ui-sans-serif, system-ui, Segoe UI';
    cx.fillText('Why Neo Temperature Lab?', 40, 260);

    cx.font = '600 16px ui-sans-serif, system-ui, Segoe UI';
    cx.fillStyle = themeKey === 'normal' ? '#cfe2ff' : theme.sub;
    const about = [
        '• Ultra-fast & precise temperature conversions across °C, °F, K, °R, and °Re.',
        '• Premium Gold/Rose/Platinum themes with pro-grade UI animations.',
        '• Smart input (e.g., “100 C -> all”), favorites, history & CSV export.',
        '• PWA: Installable, offline-ready, and share-friendly.'
    ].join(' ');
    wrapText(cx, about, 40, 286, Math.min(w - panelW - 80, 560), 22);

    // Footer: timestamp + credit
    cx.font = '14px ui-sans-serif, system-ui, Segoe UI';
    cx.fillStyle = themeKey === 'normal' ? '#8b5cf6' : theme.accent;
    cx.textAlign = 'left';
    cx.fillText(`Generated ${stampIST()}`, 40, h - 28);

    cx.save();
    const CREDIT = '~ Made by Soumyadip';
    cx.font = '600 16px ui-sans-serif, system-ui, Segoe UI';
    cx.textAlign = 'right';
    cx.fillStyle = themeKey === 'normal' ? '#6ad1ff' : theme.accent;
    if (isPremium()) { cx.shadowColor = 'rgba(246,214,107,0.35)'; cx.shadowBlur = 8; }
    cx.fillText(CREDIT, w - 22, h - 22);
    cx.restore();

    await shareOrDownload(can, format, quality, 'neo-temp-invite');

    playChime?.(1200); vibrate?.(12); spawn?.(innerWidth - 80, 80, 'gold');
}











// ---------- Events ----------
powerInput.addEventListener('change', applyPowerInput);
powerInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); applyPowerInput(); }
    if (e.key === 'Escape') { e.preventDefault(); powerInput.value = ''; }
});

[inputValue, fromUnit, toUnit].forEach(el => {
    el.addEventListener('input', runConvertDebounced);
    el.addEventListener('change', runConvert);
});
precision.addEventListener('input', () => { precisionNum.value = precision.value; runConvert(false); });
precisionNum.addEventListener('input', () => { const v = clamp(+precisionNum.value || 0, 0, 8); precision.value = v; precisionNum.value = v; runConvert(false); });
sigfigs.addEventListener('change', () => runConvert(false));
scientific.addEventListener('change', () => runConvert(false));

swapBtn.addEventListener('click', swapUnits);
copyBtn.addEventListener('click', copyResult);
shareCardBtn.addEventListener('click', generateShareCard);
resetBtn.addEventListener('click', resetInputs);
copyLinkBtn.addEventListener('click', copyLink);
clearAllBtn.addEventListener('click', resetAll);

clearHistoryBtn.addEventListener('click', clearHistory);
exportCSV.addEventListener('click', exportHistoryCSV);

favBtn.addEventListener('click', addCurrentToFavs);
clearFavs.addEventListener('click', clearFavorites);

premiumSwitch.addEventListener('change', (e) => e.target.checked ? enablePremium() : disablePremium());
premiumTheme.addEventListener('change', (e) => setPremiumTheme(e.target.value === 'platinum' ? 'platinum' : e.target.value));

document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); swapUnits(); }
    if (e.key === 'Enter') { e.preventDefault(); copyResult(); }
    if (e.key === 'Escape') { e.preventDefault(); resetInputs(); }
});





document.getElementById('inviteBtn')?.addEventListener('click', () => {
    generateInvitationQRCard({
        host: 'Soumyadip',
        preset: 'classic', // try 'social' or 'story' too
        format: 'png',
        quality: 0.95
    });
});





// ---- Prevent pinch-zoom (iOS Safari gesture events) ----
['gesturestart', 'gesturechange', 'gestureend'].forEach(evt => {
    document.addEventListener(evt, e => e.preventDefault(), { passive: false });
});

// ---- Prevent double-tap zoom (iOS Safari) ----
let lastTouchEnd = 0;
document.addEventListener('touchend', e => {
    const now = Date.now();
    if (now - lastTouchEnd <= 300) {
        e.preventDefault();  // second tap ko cancel
    }
    lastTouchEnd = now;
}, { passive: false });

// ---- Prevent ctrl + wheel zoom (desktop) ----
window.addEventListener('wheel', e => {
    if (e.ctrlKey) e.preventDefault();
}, { passive: false });

// ---- Prevent keyboard zoom shortcuts (desktop) ----
window.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && (e.key === '+' || e.key === '-' || e.key === '=')) {
        e.preventDefault();
    }
});




// ---------- Init ----------
function renderAll() {
    syncGoldSelects();
    runConvert(false);
}
readURLState();
restorePremiumFromStorage();
renderAll();

// ---------- PWA: register sw ----------
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').catch(() => { });
    });
}
