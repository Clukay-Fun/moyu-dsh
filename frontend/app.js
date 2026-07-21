// =====================================================================
// 包装设计工具箱 — Frontend Logic
// Bridges to Python via  window.pywebview.api
// =====================================================================

// ---- state -----------------------------------------------------------
let state = {
  page: 'ai',
  files: [],
  selectedIndices: new Set(),
  sameFolder: true,
  outputDir: '',
  workerRunning: false,
  gen: 0,
  bcSvg: null,
  bcCode: '',
  bcType: 'ean13',
};

// ---- init ------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  loadFileList();
  loadBarcodeTypes();
  loadTheme();
  pollMessages();
});

// =====================================================================
// Page switching
// =====================================================================

function switchPage(name) {
  state.page = name;
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(`page-${name}`).classList.add('active');
  document.querySelectorAll('.nav-pill').forEach(b => b.classList.remove('active'));
  document.querySelector(`.nav-pill[data-page="${name}"]`).classList.add('active');
  if (name === 'more') switchMore('settings');
}

// =====================================================================
// File list
// =====================================================================

async function loadFileList() {
  const raw = await pywebview.api.get_files();
  state.files = JSON.parse(raw);
  renderFileList();
}

function renderFileList() {
  const body = document.getElementById('file-list-body');
  const empty = document.getElementById('file-list-empty');
  const footer = document.getElementById('file-list-footer');
  const count = document.getElementById('file-count');

  body.querySelectorAll('.file-row').forEach(r => r.remove());

  if (state.files.length === 0) {
    empty.style.display = 'flex';
    footer.style.display = 'none';
  } else {
    empty.style.display = 'none';
    footer.style.display = 'block';
    count.textContent = `${state.files.length} 个文件`;
    state.files.forEach((f, i) => {
      const row = document.createElement('div');
      row.className = 'file-row' + (state.selectedIndices.has(i) ? ' selected' : '');
      row.innerHTML = `
        <span class="col-num">${i + 1}</span>
        <span class="col-name">${f.name}</span>
        <span class="col-size">${f.size}</span>
        <span class="col-status"></span>`;
      row.onclick = (e) => selectFile(i, e.ctrlKey || e.metaKey, e.shiftKey);
      row.oncontextmenu = (e) => { e.preventDefault(); showContextMenu(e, i); };
      row.ondblclick = () => removeFile(i);
      body.appendChild(row);
    });
  }
}

function selectFile(i, ctrl, shift) {
  if (shift && state.selectedIndices.size > 0) {
    const sel = Array.from(state.selectedIndices);
    const min = Math.min(i, ...sel);
    const max = Math.max(i, ...sel);
    for (let j = min; j <= max; j++) state.selectedIndices.add(j);
  } else if (ctrl) {
    state.selectedIndices.has(i) ? state.selectedIndices.delete(i) : state.selectedIndices.add(i);
  } else {
    state.selectedIndices.clear();
    state.selectedIndices.add(i);
  }
  renderFileList();
}

async function removeFile(i) {
  const raw = await pywebview.api.remove_file(JSON.stringify(i));
  state.files = JSON.parse(raw);
  state.selectedIndices.clear();
  renderFileList();
}

async function removeSelected() {
  const indices = Array.from(state.selectedIndices).sort((a, b) => b - a);
  if (indices.length === 0) return;
  if (indices.length > 1 && !confirm(`确定要移除选中的 ${indices.length} 个文件吗？`)) return;
  for (const i of indices) {
    const raw = await pywebview.api.remove_file(JSON.stringify(i));
    state.files = JSON.parse(raw);
  }
  state.selectedIndices.clear();
  renderFileList();
}

async function clearAll() {
  if (state.files.length === 0) return;
  if (!confirm(`确定要清空全部 ${state.files.length} 个文件吗？`)) return;
  const raw = await pywebview.api.clear_files();
  state.files = JSON.parse(raw);
  state.selectedIndices.clear();
  renderFileList();
}

async function openFileLocation(i) {
  await pywebview.api.open_file_location(JSON.stringify(i));
}

// ---- context menu ----------------------------------------------------
function showContextMenu(e, i) {
  if (!state.selectedIndices.has(i)) {
    state.selectedIndices.clear();
    state.selectedIndices.add(i);
    renderFileList();
  }
  const old = document.querySelector('.context-menu');
  if (old) old.remove();

  const menu = document.createElement('div');
  menu.className = 'context-menu';
  menu.style.left = e.clientX + 'px';
  menu.style.top = e.clientY + 'px';
  menu.innerHTML = `
    <button onclick="removeSelected();closeCtx()">移除选中</button>
    <button onclick="openFileLocation(${i});closeCtx()">打开文件所在位置</button>
    <div class="divider"></div>
    <button onclick="clearAll();closeCtx()">清空列表</button>`;
  document.body.appendChild(menu);

  setTimeout(() => document.addEventListener('click', closeCtx, { once: true }), 0);
}
function closeCtx() {
  const m = document.querySelector('.context-menu');
  if (m) m.remove();
}

// ---- drag & drop -----------------------------------------------------
function handleDragOver(e) {
  e.preventDefault();
  document.getElementById('file-list-container').classList.add('drag-over');
}
function handleDragLeave(e) {
  document.getElementById('file-list-container').classList.remove('drag-over');
}
async function handleDrop(e) {
  e.preventDefault();
  document.getElementById('file-list-container').classList.remove('drag-over');
  // On webview, the drop data is not easily accessible.
  // We use a native dialog fallback.
  await pywebview.api.pick_files().then(async (raw) => {
    const paths = JSON.parse(raw);
    if (paths.length > 0) {
      const result = await pywebview.api.add_paths(JSON.stringify(paths));
      state.files = JSON.parse(result);
      renderFileList();
    }
  });
}

// ---- toolbar actions -------------------------------------------------
async function pickFiles() {
  const raw = await pywebview.api.pick_files();
  const paths = JSON.parse(raw);
  if (paths.length > 0) {
    const result = await pywebview.api.add_paths(JSON.stringify(paths));
    state.files = JSON.parse(result);
    renderFileList();
  }
}

async function pickFolder() {
  const folder = await pywebview.api.pick_folder_files();
  if (folder) {
    const result = await pywebview.api.add_paths(JSON.stringify([folder]));
    state.files = JSON.parse(result);
    renderFileList();
  }
}

// ---- output dir ------------------------------------------------------
function toggleOutputDir() {
  state.sameFolder = document.getElementById('same-folder').checked;
  document.getElementById('output-dir-row').style.display = state.sameFolder ? 'none' : 'flex';
}
async function pickOutputDir() {
  const d = await pywebview.api.pick_folder();
  if (d) {
    state.outputDir = d;
    document.getElementById('output-dir').value = d;
  }
}

// =====================================================================
// Workers
// =====================================================================

async function startPdfExport(mode) {
  if (state.files.length === 0) { alert('请先添加 AI 文件'); return; }
  if (!state.sameFolder && !state.outputDir) { alert('请选择输出目录'); return; }

  const raw = await pywebview.api.start_pdf_export(JSON.stringify({
    mode, sameFolder: state.sameFolder, outputDir: state.outputDir,
  }));
  if (raw.startsWith('error')) return;
  const info = JSON.parse(raw);
  state.gen = info.gen;
  state.workerRunning = true;
  setWorkerUI(true);
  document.getElementById('progress-row').style.display = 'flex';
  document.getElementById('progress-fill').style.width = '0%';
  document.getElementById('progress-text').textContent = `0 / ${info.total}`;
}

async function startOutline() {
  if (state.files.length === 0) { alert('请先添加 AI 文件'); return; }
  const raw = await pywebview.api.start_outline();
  if (raw.startsWith('error')) return;
  const info = JSON.parse(raw);
  state.gen = info.gen;
  state.workerRunning = true;
  setWorkerUI(true);
  document.getElementById('progress-row').style.display = 'flex';
  document.getElementById('progress-fill').style.width = '0%';
  document.getElementById('progress-text').textContent = `0 / ${info.total}`;
}

function stopWorker() {
  pywebview.api.stop_worker();
  setWorkerUI(false);
  document.getElementById('progress-row').style.display = 'none';
  state.workerRunning = false;
}

function setWorkerUI(running) {
  document.getElementById('btn-pdf').disabled = running;
  document.getElementById('btn-minimal').disabled = running;
  document.getElementById('btn-outline').disabled = running;
  document.getElementById('btn-stop').disabled = !running;
}

// =====================================================================
// Message poll
// =====================================================================

async function pollMessages() {
  if (typeof pywebview === 'undefined') { setTimeout(pollMessages, 150); return; }
  try {
    const raw = await pywebview.api.poll_messages();
    const msgs = JSON.parse(raw);
    for (const m of msgs) {
      handleMessage(m);
    }
  } catch (e) { /* ignore */ }
  setTimeout(pollMessages, 150);
}

function handleMessage(m) {
  const log = document.getElementById('log-inner');
  switch (m.type) {
    case 'log':
      log.textContent += m.text + '\n';
      log.scrollTop = log.scrollHeight;
      break;
    case 'progress': {
      const pct = m.total > 0 ? Math.round(m.current / m.total * 100) : 0;
      document.getElementById('progress-fill').style.width = pct + '%';
      document.getElementById('progress-text').textContent = `${m.current} / ${m.total}`;
      // Update row status
      const rows = document.querySelectorAll('.file-row');
      const ri = m.current - 1;
      if (rows[ri]) rows[ri].querySelector('.col-status').textContent = '完成';
      break;
    }
    case 'error': {
      log.textContent += `  x ${m.filename}: ${m.error}\n`;
      log.scrollTop = log.scrollHeight;
      // Mark failure
      const rows = document.querySelectorAll('.file-row');
      for (const r of rows) {
        if (r.querySelector('.col-name').textContent === m.filename) {
          r.querySelector('.col-status').textContent = '失败';
          break;
        }
      }
      break;
    }
    case 'complete':
      log.textContent += `\n-- 完成: 成功 ${m.success}, 失败 ${m.fail} --\n`;
      log.scrollTop = log.scrollHeight;
      state.workerRunning = false;
      setWorkerUI(false);
      document.getElementById('progress-row').style.display = 'none';
      break;
    case 'cancelled':
      log.textContent += '-- 已取消 --\n';
      state.workerRunning = false;
      setWorkerUI(false);
      break;
    case 'aborted':
      log.textContent += `!! 错误: ${m.reason}\n`;
      state.workerRunning = false;
      setWorkerUI(false);
      break;
  }
}

// =====================================================================
// Barcode
// =====================================================================

async function loadBarcodeTypes() {
  if (typeof pywebview === 'undefined') { setTimeout(loadBarcodeTypes, 200); return; }
  const raw = await pywebview.api.barcode_types();
  const types = JSON.parse(raw);
  const sel = document.getElementById('bc-type');
  types.forEach(t => {
    const opt = document.createElement('option');
    opt.value = t.value;
    opt.textContent = t.label;
    sel.appendChild(opt);
  });
  // Default to UPCA
  const upcaOpt = sel.querySelector('option[value="upca"]');
  if (upcaOpt) { upcaOpt.selected = true; state.bcType = 'upca'; }
}

async function genBarcode() {
  const type = document.getElementById('bc-type').value;
  const code = document.getElementById('bc-code').value.trim();
  const status = document.getElementById('bc-status');
  if (!code) { status.textContent = '请输入条码编码'; return; }
  state.bcType = type;
  state.bcCode = code;

  const raw = await pywebview.api.generate_barcode(JSON.stringify({ code, type }));
  const result = JSON.parse(raw);
  if (result.error) {
    status.textContent = result.error;
    document.getElementById('bc-svg-container').style.display = 'none';
    document.querySelector('.bc-placeholder').style.display = 'block';
    return;
  }
  state.bcSvg = result.svg;
  status.textContent = `✓ ${type.toUpperCase()}: ${code}`;
  document.querySelector('.bc-placeholder').style.display = 'none';

  // Render SVG — keep native mm dimensions, just scale to fit
  const container = document.getElementById('bc-svg-container');
  container.innerHTML = '';
  // Use insertAdjacentHTML which correctly handles SVG namespace + DOCTYPE
  container.insertAdjacentHTML('beforeend', result.svg);
  // CSS handles containment — just clear any inline styles
  const svgEl = container.querySelector('svg');
  if (svgEl) {
    svgEl.removeAttribute('style');
  }
  container.style.display = 'flex';
}

// ---- DPI helpers -----------------------------------------------------
function getExportDpi() {
  const dpiSel = document.getElementById('bc-dpi');
  if (dpiSel.value === 'custom') {
    const v = parseInt(document.getElementById('bc-dpi-custom').value) || 300;
    return Math.max(72, Math.min(2400, v));
  }
  return parseInt(dpiSel.value);
}

// Toggle custom DPI input
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    const dpiSel = document.getElementById('bc-dpi');
    if (dpiSel) dpiSel.addEventListener('change', () => {
      document.getElementById('bc-dpi-custom').style.display =
        dpiSel.value === 'custom' ? 'inline-block' : 'none';
    });
  }, 500);
});

// ---- Export functions ------------------------------------------------
async function exportBarcode(format) {
  if (!state.bcSvg) { alert('请先生成条码'); return; }
  if (!state.bcCode) { alert('请输入条码编码'); return; }

  const status = document.getElementById('bc-status');
  const cleanCode = state.bcCode.replace(/[^a-zA-Z0-9]/g, '');
  const cleanType = state.bcType;

  if (format === 'EPS') {
    status.textContent = '正在导出 EPS...';
    const raw = await pywebview.api.export_barcode_eps(JSON.stringify({
      code: cleanCode, type: cleanType,
    }));
    const r = JSON.parse(raw);
    if (r.ok) status.textContent = `✓ 已保存到桌面: ${r.filename}`;
    else status.textContent = `✗ ${r.error || '导出失败'}`;
  } else if (format === 'SVG') {
    status.textContent = '正在导出 SVG...';
    const raw = await pywebview.api.export_barcode_svg(JSON.stringify({
      code: cleanCode, type: cleanType,
    }));
    const r = JSON.parse(raw);
    if (r.ok) status.textContent = `✓ 已保存到桌面: ${r.filename}`;
    else status.textContent = `✗ ${r.error || '导出失败'}`;
  } else {
    const dpi = getExportDpi();
    status.textContent = `正在导出 ${format} ${dpi}DPI...`;
    const raw = await pywebview.api.export_barcode_raster(JSON.stringify({
      code: cleanCode, type: cleanType, format, dpi,
    }));
    const r = JSON.parse(raw);
    if (r.ok) status.textContent = `✓ 已保存到桌面: ${r.filename} (${dpi}DPI)`;
    else status.textContent = `✗ ${r.error || '导出失败'}`;
  }
}

// ---- One-click AI / PS ------------------------------------------------
async function openInApp(app) {
  if (!state.bcSvg) { alert('请先生成条码'); return; }
  const dpi = getExportDpi();
  const status = document.getElementById('bc-status');
  status.textContent = `正在打开 ${app === 'ai' ? 'Illustrator' : 'Photoshop'}...`;

  const method = app === 'ai' ? 'open_in_illustrator' : 'open_in_photoshop';
  const raw = await pywebview.api[method](JSON.stringify({
    code: state.bcCode, type: state.bcType, dpi,
  }));
  const r = JSON.parse(raw);
  if (r.ok) {
    status.textContent = `✓ 已在 ${app === 'ai' ? 'Illustrator' : 'Photoshop'} 中打开`;
  } else {
    status.textContent = `✗ ${r.error || '打开失败'}`;
  }
}

// =====================================================================
// More — sidebar panels
// =====================================================================

function switchMore(panel) {
  document.querySelectorAll('.more-panel').forEach(p => p.style.display = 'none');
  document.getElementById(`panel-${panel}`).style.display = 'block';
  document.querySelectorAll('.sidebar-btn').forEach(b => b.classList.remove('active'));
  document.querySelector(`.sidebar-btn[data-panel="${panel}"]`).classList.add('active');
}

// =====================================================================
// Theme
// =====================================================================

async function loadTheme() {
  if (typeof pywebview === 'undefined') { setTimeout(loadTheme, 200); return; }
  const raw = await pywebview.api.get_theme();
  const s = JSON.parse(raw);
  applyTheme(s.theme);
  // Set radio button
  const radio = document.querySelector(`input[name="theme"][value="${s.theme}"]`);
  if (radio) radio.checked = true;

  // Listen for system theme changes
  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (s.theme === 'system') applyTheme('system');
    });
  }
}

async function setTheme(theme) {
  const resolved = await pywebview.api.set_theme(theme);
  applyTheme(resolved);
}

function applyTheme(theme) {
  if (theme === 'system') {
    theme = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark' : 'light';
  }
  document.body.setAttribute('data-theme', theme);
}

// =====================================================================
// HSL Color picker
// =====================================================================

let cpState = { h: 265, s: 70, l: 65, r: 94, g: 92, b: 214 };

function initColorPicker() {
  const saved = localStorage.getItem('accentColor');
  if (saved) {
    try {
      const c = JSON.parse(saved);
      cpState = { ...cpState, ...c };
    } catch(e) {}
  }
  syncHslFromRgb();
  drawWheel();
  updateSliders();
  applyAccent();
  updateMarker();
}

// ---- HSL wheel canvas ------------------------------------------------
function drawWheel() {
  const canvas = document.getElementById('cp-wheel');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const cx = 100, cy = 100, r = 90, ir = 50;

  // Draw hue ring
  for (let angle = 0; angle < 360; angle++) {
    const startAngle = (angle - 1) * Math.PI / 180;
    const endAngle = (angle + 1) * Math.PI / 180;
    for (let rad = ir; rad <= r; rad += 2) {
      const sat = (rad - ir) / (r - ir);
      const hsl = `hsl(${angle}, ${Math.round(sat * 100)}%, 55%)`;
      ctx.fillStyle = hsl;
      ctx.beginPath();
      ctx.arc(cx, cy, rad, startAngle, endAngle);
      ctx.lineTo(cx, cy);
      ctx.fill();
    }
  }
}

canvasEvents: {
  const canvas = document.getElementById('cp-wheel');
  if (!canvas) break canvasEvents;
  let dragging = false;

  function pickFromEvent(e) {
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left - 100;
    const my = e.clientY - rect.top - 100;
    const dist = Math.sqrt(mx * mx + my * my);
    if (dist < 48 || dist > 92) return; // outside ring

    const angle = ((Math.atan2(my, mx) * 180 / Math.PI) + 360) % 360;
    const sat = Math.min(1, Math.max(0, (dist - 48) / 44));
    cpState.h = Math.round(angle);
    cpState.s = Math.round(sat * 100);
    cpState.l = 55;
    hslToRgb(cpState.h, cpState.s, cpState.l);
    updateSliders();
    updateMarker();
    applyAccent();
  }

  canvas.addEventListener('mousedown', e => { dragging = true; pickFromEvent(e); });
  canvas.addEventListener('mousemove', e => { if (dragging) pickFromEvent(e); });
  window.addEventListener('mouseup', () => { dragging = false; });
}

function updateMarker() {
  const marker = document.getElementById('cp-marker');
  if (!marker) return;
  const angle = cpState.h * Math.PI / 180;
  const dist = 48 + (cpState.s / 100) * 44;
  const mx = 100 + Math.cos(angle) * dist;
  const my = 100 + Math.sin(angle) * dist;
  marker.style.left = mx + 'px';
  marker.style.top = my + 'px';
}

// ---- RGB sliders -----------------------------------------------------
function updateSliders() {
  document.getElementById('cp-r').value = cpState.r;
  document.getElementById('cp-g').value = cpState.g;
  document.getElementById('cp-b').value = cpState.b;
  document.getElementById('cp-r-val').textContent = cpState.r;
  document.getElementById('cp-g-val').textContent = cpState.g;
  document.getElementById('cp-b-val').textContent = cpState.b;
  document.getElementById('cp-hex').value = rgbToHex(cpState.r, cpState.g, cpState.b);
  document.getElementById('cp-swatch').style.background =
    `rgb(${cpState.r},${cpState.g},${cpState.b})`;
}

function onRgbSlider() {
  cpState.r = +document.getElementById('cp-r').value;
  cpState.g = +document.getElementById('cp-g').value;
  cpState.b = +document.getElementById('cp-b').value;
  rgbToHsl(cpState.r, cpState.g, cpState.b);
  updateSliders();
  drawWheel();
  updateMarker();
  applyAccent();
}

function onHexInput() {
  const hex = document.getElementById('cp-hex').value.trim();
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  cpState.r = r; cpState.g = g; cpState.b = b;
  rgbToHsl(r, g, b);
  updateSliders();
  drawWheel();
  updateMarker();
  applyAccent();
}

function resetAccent() {
  cpState = { h: 265, s: 70, l: 65, r: 94, g: 92, b: 214 };
  syncHslFromRgb();
  updateSliders();
  drawWheel();
  updateMarker();
  applyAccent();
}

async function followWindowsAccent() {
  if (typeof pywebview === 'undefined') return;
  const raw = await pywebview.api.get_windows_accent();
  const c = JSON.parse(raw);
  cpState.r = c.r; cpState.g = c.g; cpState.b = c.b;
  syncHslFromRgb();
  updateSliders();
  drawWheel();
  updateMarker();
  applyAccent();
}

// ---- HSL ↔ RGB -------------------------------------------------------
function hslToRgb(h, s, l) {
  s /= 100; l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = n => {
    const k = (n + h / 30) % 12;
    return l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
  };
  cpState.r = Math.round(f(0) * 255);
  cpState.g = Math.round(f(8) * 255);
  cpState.b = Math.round(f(4) * 255);
}

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) {
    cpState.h = 0; cpState.s = 0;
  } else {
    const d = max - min;
    cpState.s = Math.round((l > 0.5 ? d / (2 - max - min) : d / (max + min)) * 100);
    switch (max) {
      case r: cpState.h = Math.round(60 * ((g - b) / d + (g < b ? 6 : 0))); break;
      case g: cpState.h = Math.round(60 * ((b - r) / d + 2)); break;
      case b: cpState.h = Math.round(60 * ((r - g) / d + 4)); break;
    }
  }
  cpState.l = Math.round(l * 100);
}

function syncHslFromRgb() {
  rgbToHsl(cpState.r, cpState.g, cpState.b);
}

// ---- Apply to UI -----------------------------------------------------
function applyAccent() {
  const { r, g, b } = cpState;
  document.documentElement.style.setProperty('--accent-r', r);
  document.documentElement.style.setProperty('--accent-g', g);
  document.documentElement.style.setProperty('--accent-b', b);
  // Persist to localStorage (also save to python settings)
  localStorage.setItem('accentColor', JSON.stringify({ r, g, b, h: cpState.h, s: cpState.s, l: cpState.l }));
  // Also save via Python API if available
  if (typeof pywebview !== 'undefined') {
    try { pywebview.api.save_accent(JSON.stringify({ r, g, b })); } catch(e) {}
  }
}

function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(c => c.toString(16).padStart(2, '0')).join('').toUpperCase();
}

// Init on settings panel first view
const _origSwitchMore = switchMore;
switchMore = function(panel) {
  _origSwitchMore(panel);
  if (panel === 'settings') {
    setTimeout(initColorPicker, 100);
  }
};

