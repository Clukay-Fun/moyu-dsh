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
  bcType: 'upca',
  barcodeTypes: [],
  imageCanvas: null,
  imageSourceName: '',
  pdfSources: [],
  pdfSourceKind: '',
  pdfInputKind: 'pdf',
  pdfAction: 'pdf_png',
};

const DEFAULT_BARCODE_TYPES = [
  { label: 'UPCA  —— 通用商品条码', value: 'upca' },
  { label: 'EAN-13 —— 国际商品条码', value: 'ean13' },
  { label: 'EAN-8  —— 小包装条码', value: 'ean8' },
  { label: 'Code128—— 物流仓储', value: 'code128' },
  { label: 'Code39 —— 工业标识', value: 'code39' },
  { label: 'ITF    —— 外箱条码', value: 'itf' },
  { label: 'Auto   —— 自动识别 UPC/EAN', value: 'auto' },
  { label: 'QR     —— 二维码', value: 'qrcode' },
];

// ---- init ------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  state.barcodeTypes = DEFAULT_BARCODE_TYPES;
  loadFileList();
  loadBarcodeTypes();
  loadTheme();
  pollMessages();
  startMochiTimer();
});

// =====================================================================
// Page switching
// =====================================================================

function switchPage(name, button) {
  state.page = name;
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(`page-${name}`).classList.add('active');
  document.querySelectorAll('.nav-item[data-page]').forEach(b => b.classList.remove('active'));
  (button || document.querySelector(`.nav-item[data-page="${name}"]`))?.classList.add('active');
  if (name !== 'bc') closeSecondaryMenu();
  if (name === 'more') setTimeout(initColorPicker, 0);
  if (name === 'image') setTimeout(initImageCanvas, 0);
}

// =====================================================================
// PDF tools
// =====================================================================

const PDF_ACTION_GROUPS = [
  { label: '转换', items: [
    { label: '转 PNG', action: 'pdf_png', source: 'pdf', icon: 'PNG', description: '将 PDF 的每一页导出为 PNG 图片。' },
    { label: '转 JPEG', action: 'pdf_jpeg', source: 'pdf', icon: 'JPG', description: '将 PDF 的每一页导出为 JPEG 图片。' },
    { label: '转 TXT', action: 'pdf_txt', source: 'pdf', icon: 'TXT', description: '提取 PDF 中可读取的文字内容。' },
    { label: '转 DOCX', action: 'pdf_docx', source: 'pdf', icon: 'DOC', description: '仅提取内容，不保证复杂版式。' },
    { label: '转 XLSX', action: 'pdf_xlsx', source: 'pdf', icon: 'XLS', description: '仅处理规整表格；无表格会给出提示。' },
    { label: '转 PPTX', action: 'pdf_pptx', source: 'pdf', icon: 'PPT', description: '每页 PDF 会生成一张图片幻灯片。' },
  ] },
  { label: '编辑', items: [
    { label: '合并 PDF', action: 'merge', source: 'pdf', icon: '合', description: '将选中的多个 PDF 合并为一个文件。' },
    { label: '拆分 PDF', action: 'split', source: 'pdf', icon: '拆', description: '将 PDF 拆分为按页保存的文件。' },
    { label: '旋转 PDF', action: 'rotate', source: 'pdf', icon: '旋', description: '将 PDF 页面顺时针旋转 90°。' },
    { label: '提取页', action: 'extract_pages', source: 'pdf', icon: '页', description: '按页码提取需要的 PDF 页面。' },
  ] },
  { label: '转成 PDF', items: [
    { label: '图片转 PDF', action: 'images_to_pdf', source: 'image', icon: 'IMG', description: '将选中的图片合并为一个 PDF。' },
    { label: 'Word 转 PDF', action: 'office_to_pdf', source: 'office', icon: 'W', description: '通过本机 Microsoft Word 导出 PDF。' },
    { label: 'Excel 转 PDF', action: 'office_to_pdf', source: 'office', icon: 'X', description: '通过本机 Microsoft Excel 导出 PDF。' },
    { label: 'PPT 转 PDF', action: 'office_to_pdf', source: 'office', icon: 'P', description: '通过本机 Microsoft PowerPoint 导出 PDF。' },
  ] },
];

function currentPdfAction() {
  return PDF_ACTION_GROUPS.flatMap(group => group.items).find(item => item.action === state.pdfAction && item.label === state.pdfActionLabel)
    || PDF_ACTION_GROUPS.flatMap(group => group.items).find(item => item.action === state.pdfAction);
}

function showPdfActions(owner) {
  switchPage('pdf', owner);
  setPdfAction(currentPdfAction() || PDF_ACTION_GROUPS[0].items[0]);
  renderPdfActions();
}

function renderPdfActions() {
  secondaryMenu.innerHTML = '';
  PDF_ACTION_GROUPS.forEach(group => {
    const label = document.createElement('p');
    label.className = 'secondary-label';
    label.textContent = group.label;
    secondaryMenu.appendChild(label);
    group.items.forEach(item => {
      const button = document.createElement('button');
      button.className = `secondary-item${state.pdfAction === item.action && state.pdfActionLabel === item.label ? ' active' : ''}`;
      button.innerHTML = `<span class="secondary-icon">${item.icon}</span><span>${item.label}</span>`;
      button.onclick = () => { setPdfAction(item); renderPdfActions(); };
      secondaryMenu.appendChild(button);
    });
  });
  secondaryMenu.classList.add('open');
}

function setPdfAction(item) {
  state.pdfAction = item.action;
  state.pdfActionLabel = item.label;
  state.pdfInputKind = item.source;
  state.pdfSources = [];
  state.pdfSourceKind = '';
  const sourceLabel = item.source === 'image' ? '图片' : item.source === 'office' ? 'Office 文件' : 'PDF';
  document.getElementById('pdf-action-label').textContent = item.label;
  document.getElementById('pdf-action-icon').textContent = item.icon;
  document.getElementById('pdf-action-title').textContent = item.label;
  document.getElementById('pdf-action-description').textContent = item.description;
  document.getElementById('pdf-pick-button').textContent = `＋ 选择${sourceLabel}`;
  document.getElementById('pdf-source-summary').textContent = `请选择${sourceLabel}后执行「${item.label}」`;
  document.getElementById('pdf-run-button').textContent = item.action === 'office_to_pdf' ? '开始导出 PDF' : `开始${item.label}`;
  document.getElementById('pdf-pages').style.display = item.action === 'extract_pages' ? 'block' : 'none';
  document.getElementById('pdf-office-note').style.display = item.action === 'office_to_pdf' ? 'block' : 'none';
  document.getElementById('pdf-content-note').style.display = ['pdf_docx', 'pdf_xlsx', 'pdf_pptx'].includes(item.action) ? 'block' : 'none';
  document.getElementById('pdf-result').textContent = '生成的文件会保存到桌面。';
}

async function pickPdfSources(kind = state.pdfInputKind) {
  try {
    let raw;
    if (kind === 'office') {
      const source = await pywebview.api.pick_office_file();
      raw = JSON.stringify(source ? [source] : []);
    } else {
      raw = kind === 'image' ? await pywebview.api.pick_image_files() : await pywebview.api.pick_pdf_files();
    }
    const sources = JSON.parse(raw);
    if (!sources.length) return;
    state.pdfSources = sources;
    state.pdfSourceKind = kind;
    document.getElementById('pdf-source-summary').textContent = `已选择 ${sources.length} 个${kind === 'office' ? ' Office' : kind === 'image' ? '图片' : ' PDF'}文件`;
    document.getElementById('pdf-result').textContent = sources.map(path => path.split(/[\\/]/).pop()).join('、');
  } catch (error) {
    document.getElementById('pdf-result').textContent = `✗ ${error.message || error}`;
  }
}

function clearPdfSources() {
  state.pdfSources = [];
  state.pdfSourceKind = '';
  document.getElementById('pdf-source-summary').textContent = '请先选择要处理的文件';
  document.getElementById('pdf-result').textContent = '生成的文件会保存到桌面。';
}

function runSelectedPdfAction() {
  if (state.pdfAction === 'office_to_pdf') return runOfficeToPdf();
  return runPdfAction(state.pdfAction);
}

async function runPdfAction(action) {
  if (!state.pdfSources.length) return alert('请先选择文件');
  if (action === 'images_to_pdf' && state.pdfSourceKind !== 'image') return alert('图片转 PDF 请先选择图片');
  if (action !== 'images_to_pdf' && state.pdfSourceKind !== 'pdf') return alert('此操作请先选择 PDF 文件');
  const resultNode = document.getElementById('pdf-result');
  resultNode.textContent = '正在处理…';
  try {
    const raw = await pywebview.api.run_pdf_action(JSON.stringify({ action, sources: state.pdfSources, pages: document.getElementById('pdf-pages').value }));
    const result = JSON.parse(raw);
    resultNode.textContent = result.ok ? `✓ 已保存到桌面：${result.filenames.join('、')}` : `✗ ${result.error || '处理失败'}`;
  } catch (error) {
    resultNode.textContent = `✗ ${error.message || error}`;
  }
}

async function runOfficeToPdf() {
  if (state.pdfSourceKind !== 'office' || state.pdfSources.length !== 1) return alert('请通过「选择 Office」选择一个 Word、Excel 或 PowerPoint 文件');
  const resultNode = document.getElementById('pdf-result');
  resultNode.textContent = '正在调用 Microsoft Office…';
  try {
    const raw = await pywebview.api.office_to_pdf(state.pdfSources[0]);
    const result = JSON.parse(raw);
    resultNode.textContent = result.ok ? `✓ 已保存到桌面：${result.filename}` : `✗ ${result.error || '转换失败'}`;
  } catch (error) {
    resultNode.textContent = `✗ ${error.message || error}`;
  }
}

// =====================================================================
// Search and timer
// =====================================================================

const flyout = document.getElementById('flyout');
const secondaryMenu = document.getElementById('secondary-menu');

function closeFlyout() { flyout.classList.remove('open'); }
function closeSecondaryMenu() { secondaryMenu.classList.remove('open'); secondaryMenu.innerHTML = ''; }

function renderBarcodeTypes() {
  const palette = { upca: '#e0554e', ean13: '#e08a3c', ean8: '#8fceb8', code128: '#9fb0ec', code39: '#8a7cd0', itf: '#5ca2a8', auto: '#6d7287', qrcode: '#6578dd' };
  secondaryMenu.innerHTML = '<p class="secondary-label">条码类型</p>';
  state.barcodeTypes.forEach(type => {
    const button = document.createElement('button');
    button.className = `secondary-item${state.bcType === type.value ? ' active' : ''}`;
    const icon = type.value === 'upca' ? 'U' : type.value === 'ean13' ? '13' : type.value === 'ean8' ? '8' : type.value === 'qrcode' ? 'QR' : type.value.replace('code', '').toUpperCase();
    button.innerHTML = `<span class="secondary-icon" style="background:${palette[type.value] || '#9fb0ec'}">${icon}</span><span>${type.label}</span>`;
    button.onclick = () => { setBarcodeType(type.value); renderBarcodeTypes(); };
    secondaryMenu.appendChild(button);
  });
  secondaryMenu.classList.add('open');
}

function showBarcodeTypes(owner) {
  switchPage('bc', owner);
  renderBarcodeTypes();
}

function setBarcodeType(type) {
  state.bcType = type;
  const info = state.barcodeTypes.find(item => item.value === type);
  document.getElementById('bc-type-label').textContent = info ? info.label.split(' ')[0] : type.toUpperCase();
}

function setDpi(value, button) {
  document.querySelectorAll('.segmented button').forEach(item => {
    item.classList.remove('on');
    delete item.dataset.dpi;
  });
  button.classList.add('on');
  button.dataset.dpi = value;
  document.getElementById('bc-dpi-custom').style.display = value === 'custom' ? 'block' : 'none';
}

let searchSelection = 0;
const searchableFunctions = [
  { label: '添加 AI 文件', group: '推荐', icon: '＋', shortcut: '⌘1', keywords: '添加 文件 illustrator ai', action: pickFiles },
  { label: '添加文件夹', group: '推荐', icon: '▣', shortcut: '⌘2', keywords: '添加 文件夹 illustrator ai', action: pickFolder },
  { label: '导出 PDF', group: 'Illustrator', icon: 'PDF', shortcut: '⌘3', keywords: 'pdf 导出 illustrator', action: () => document.getElementById('btn-pdf').click() },
  { label: '最小化 PDF', group: 'Illustrator', icon: 'MIN', shortcut: '⌘4', keywords: 'pdf 最小化 illustrator', action: () => document.getElementById('btn-minimal').click() },
  { label: '文字转曲', group: 'Illustrator', icon: 'Ai', shortcut: '⌘5', keywords: '文字 转曲 outline illustrator', action: () => document.getElementById('btn-outline').click() },
  { label: 'UPC-A 条码', group: '条码', icon: 'U', shortcut: '⌘6', keywords: 'upca upc 条码 barcode', action: () => selectBarcodeFromSearch('upca') },
  { label: 'EAN-13 条码', group: '条码', icon: '13', shortcut: '⌘7', keywords: 'ean 13 条码 barcode', action: () => selectBarcodeFromSearch('ean13') },
  { label: 'EAN-8 条码', group: '条码', icon: '8', shortcut: '⌘8', keywords: 'ean 8 条码 barcode', action: () => selectBarcodeFromSearch('ean8') },
  { label: 'Code128 条码', group: '条码', icon: '128', shortcut: '⌘9', keywords: 'code128 条码 barcode', action: () => selectBarcodeFromSearch('code128') },
  { label: '二维码', group: '条码', icon: 'QR', shortcut: '⌘Q', keywords: '二维码 qr qrcode 条码', action: () => selectBarcodeFromSearch('qrcode') },
  { label: '编辑图片', group: '图片', icon: '▧', shortcut: '⌘I', keywords: '图片 裁剪 水印 格式 转换', action: () => switchPage('image') },
  { label: 'PDF 工具', group: 'PDF', icon: 'PDF', shortcut: '⌘P', keywords: 'pdf 合并 拆分 转换 office word excel ppt', action: () => showPdfActions() },
  { label: '外观与主题', group: '设置', icon: '◐', shortcut: '⌘0', keywords: '外观 主题 颜色 设置', action: () => switchPage('more') },
];

function selectBarcodeFromSearch(type) {
  switchPage('bc');
  setBarcodeType(type);
  renderBarcodeTypes();
}

function searchFn(query) {
  const results = document.getElementById('search-results');
  const key = query.trim().toLowerCase();
  const matches = searchableFunctions.filter(item => !key || `${item.label} ${item.group} ${item.keywords}`.toLowerCase().includes(key));
  searchSelection = Math.min(searchSelection, Math.max(matches.length - 1, 0));
  results.innerHTML = '';
  results._matches = matches;
  let currentGroup = '';
  matches.forEach((item, index) => {
    if (item.group !== currentGroup) {
      currentGroup = item.group;
      const label = document.createElement('p');
      label.className = 'search-group-label';
      label.textContent = currentGroup;
      results.appendChild(label);
    }
    const button = document.createElement('button');
    button.className = `search-result${index === searchSelection ? ' selected' : ''}`;
    button.innerHTML = `<span class="search-icon">${item.icon}</span><span>${item.label}<small>${item.group}</small></span><kbd>${item.shortcut}</kbd>`;
    button.onmouseenter = () => { searchSelection = index; updateSearchSelection(); };
    button.onclick = () => runSearchResult(index);
    results.appendChild(button);
  });
  if (!matches.length) results.innerHTML = '<p class="search-empty">没有匹配的功能</p>';
  results.classList.add('open');
}

function updateSearchSelection() {
  document.querySelectorAll('.search-result').forEach((element, index) => element.classList.toggle('selected', index === searchSelection));
}

function runSearchResult(index) {
  const results = document.getElementById('search-results');
  const item = results._matches?.[index];
  if (!item) return;
  item.action();
  results.classList.remove('open');
  document.getElementById('function-search').value = '';
}

function handleSearchKey(event) {
  const results = document.getElementById('search-results');
  const matches = results._matches || [];
  if (event.key === 'Escape') { results.classList.remove('open'); event.currentTarget.blur(); return; }
  if (!matches.length || !['ArrowDown', 'ArrowUp', 'Enter'].includes(event.key)) return;
  event.preventDefault();
  if (event.key === 'Enter') { runSearchResult(searchSelection); return; }
  searchSelection = (searchSelection + (event.key === 'ArrowDown' ? 1 : -1) + matches.length) % matches.length;
  updateSearchSelection();
}

document.addEventListener('keydown', event => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault();
    const input = document.getElementById('function-search');
    input.focus();
    searchFn(input.value);
  }
});

function startMochiTimer() {
  const started = Date.now();
  const update = () => {
    const elapsed = Math.floor((Date.now() - started) / 1000);
    document.getElementById('mochi-timer').textContent = `${String(Math.floor(elapsed / 60)).padStart(2, '0')}:${String(elapsed % 60).padStart(2, '0')}`;
  };
  update(); setInterval(update, 1000);
}

document.addEventListener('click', event => {
  if (!event.target.closest('.nav-item[data-page="bc"]') && !event.target.closest('.flyout')) closeFlyout();
  if (!event.target.closest('.search-wrap')) document.getElementById('search-results').classList.remove('open');
});

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
      // 用 textContent 构建，避免文件名含 HTML 造成前端注入
      const cNum = document.createElement('span');
      cNum.className = 'col-num'; cNum.textContent = i + 1;
      const cName = document.createElement('span');
      cName.className = 'col-name'; cName.textContent = f.name; cName.title = f.name;
      const cSize = document.createElement('span');
      cSize.className = 'col-size'; cSize.textContent = f.size;
      const cStatus = document.createElement('span');
      cStatus.className = 'col-status';
      row.append(cNum, cName, cSize, cStatus);
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
  try {
    const raw = await pywebview.api.pick_files();
    const paths = JSON.parse(raw);
    if (paths.length > 0) {
      const result = await pywebview.api.add_paths(JSON.stringify(paths));
      state.files = JSON.parse(result);
      renderFileList();
    }
  } catch (error) {
    alert(`无法打开文件选择窗口：${error.message || error}`);
  }
}

async function pickFolder() {
  try {
    const folder = await pywebview.api.pick_folder_files();
    if (folder) {
      const result = await pywebview.api.add_paths(JSON.stringify([folder]));
      state.files = JSON.parse(result);
      renderFileList();
    }
  } catch (error) {
    alert(`无法打开文件夹选择窗口：${error.message || error}`);
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
  const controls = {
    'btn-pdf': running, 'btn-minimal': running, 'btn-outline': running,
    'btn-stop': !running,
  };
  Object.entries(controls).forEach(([id, disabled]) => {
    const control = document.getElementById(id);
    if (control) control.disabled = disabled;
  });
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
  document.getElementById('log').style.display = 'block';
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
  try {
    const raw = await pywebview.api.barcode_types();
    const types = JSON.parse(raw);
    if (Array.isArray(types) && types.length) state.barcodeTypes = types;
  } catch (error) {
    console.warn('Barcode type bridge unavailable; using built-in types.', error);
  }
  setBarcodeType(state.bcType);
  if (state.page === 'bc' && secondaryMenu.classList.contains('open')) renderBarcodeTypes();
}

async function genBarcode() {
  const code = document.getElementById('bc-code').value.trim();
  const status = document.getElementById('bc-status');
  if (!code) { status.textContent = '请输入条码编码'; return; }
  const type = state.bcType;
  state.bcCode = code;

  try {
    const raw = await pywebview.api.generate_barcode(JSON.stringify({ code, type }));
    const result = JSON.parse(raw);
    if (result.error) throw new Error(result.error);
    const container = document.getElementById('bc-svg-container');
    state.bcSvg = result.svg;
    container.innerHTML = result.svg;
    status.textContent = `✓ ${type.toUpperCase()}: ${code}`;
    document.querySelector('.bc-placeholder').style.display = 'none';
    container.style.display = 'flex';
  } catch (error) {
    state.bcSvg = null;
    status.textContent = error.message || '条码格式或编码不正确';
    document.getElementById('bc-svg-container').style.display = 'none';
    document.querySelector('.bc-placeholder').style.display = 'block';
  }
}

// ---- DPI helpers -----------------------------------------------------
function getExportDpi() {
  const selected = document.querySelector('.segmented button.on')?.dataset.dpi || '300';
  if (selected === 'custom') {
    const v = parseInt(document.getElementById('bc-dpi-custom').value) || 300;
    return Math.max(72, Math.min(2400, v));
  }
  return parseInt(selected, 10);
}

// ---- Export functions ------------------------------------------------
async function exportBarcode(format) {
  if (!state.bcSvg) { alert('请先生成条码'); return; }
  if (!state.bcCode) { alert('请输入条码编码'); return; }

  const status = document.getElementById('bc-status');
  const code = state.bcCode;
  const type = state.bcType;

  if (format === 'EPS') {
    status.textContent = '正在导出 EPS...';
    const raw = await pywebview.api.export_barcode_eps(JSON.stringify({
      code, type,
    }));
    const r = JSON.parse(raw);
    if (r.ok) status.textContent = `✓ 已保存到桌面: ${r.filename}`;
    else status.textContent = `✗ ${r.error || '导出失败'}`;
  } else if (format === 'SVG') {
    status.textContent = '正在导出 SVG...';
    const raw = await pywebview.api.export_barcode_svg(JSON.stringify({
      code, type,
    }));
    const r = JSON.parse(raw);
    if (r.ok) status.textContent = `✓ 已保存到桌面: ${r.filename}`;
    else status.textContent = `✗ ${r.error || '导出失败'}`;
  } else {
    const dpi = getExportDpi();
    status.textContent = `正在导出 ${format} ${dpi}DPI...`;
    const raw = await pywebview.api.export_barcode_raster(JSON.stringify({
      code, type, format, dpi,
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
// Image editor
// =====================================================================

function initImageCanvas() {
  if (state.imageCanvas || typeof fabric === 'undefined') return;
  state.imageCanvas = new fabric.Canvas('image-canvas', { preserveObjectStacking: true, backgroundColor: '#f8f9fc' });
}

async function pickImageFile() {
  try {
    const path = await pywebview.api.pick_image_file();
    if (!path) return;
    initImageCanvas();
    const url = encodeURI(`file:///${path.replace(/\\/g, '/')}`);
    fabric.Image.fromURL(url, image => {
      if (!image) { document.getElementById('image-status').textContent = '无法读取图片'; return; }
      state.imageCanvas.clear();
      state.imageCanvas.setDimensions({ width: image.width, height: image.height });
      image.set({ left: 0, top: 0, selectable: false, evented: false });
      state.imageCanvas.add(image);
      state.imageCanvas.setActiveObject(image);
      state.imageCanvas.requestRenderAll();
      state.imageSourceName = path.split(/[\\/]/).pop();
      document.getElementById('image-name').textContent = `${state.imageSourceName} · ${image.width} × ${image.height}px`;
      document.getElementById('image-width').value = image.width;
      document.getElementById('image-height').value = image.height;
      document.getElementById('image-placeholder').style.display = 'none';
    });
  } catch (error) {
    alert(`无法打开图片：${error.message || error}`);
  }
}

function imageObject() {
  return state.imageCanvas?.getObjects().find(item => item.type === 'image');
}

function applyImageCrop() {
  const image = imageObject();
  if (!image) return alert('请先添加图片');
  const width = Math.min(image.width, parseInt(document.getElementById('image-crop-w').value) || image.width);
  const height = Math.min(image.height, parseInt(document.getElementById('image-crop-h').value) || image.height);
  image.set({ cropX: Math.max(0, Math.floor((image.width - width) / 2)), cropY: Math.max(0, Math.floor((image.height - height) / 2)), width, height, left: 0, top: 0 });
  state.imageCanvas.setDimensions({ width, height });
  state.imageCanvas.requestRenderAll();
  document.getElementById('image-width').value = width;
  document.getElementById('image-height').value = height;
}

function addTextWatermark() {
  const text = document.getElementById('image-watermark').value.trim();
  if (!text || !state.imageCanvas) return;
  const watermark = new fabric.Textbox(text, { left: 24, top: 24, fill: '#ffffff', stroke: '#242634', strokeWidth: .7, fontSize: 28, fontWeight: '600', opacity: .78 });
  state.imageCanvas.add(watermark).setActiveObject(watermark);
  state.imageCanvas.requestRenderAll();
}

async function exportImage(format) {
  if (!state.imageCanvas || !imageObject()) return alert('请先添加图片');
  const width = parseInt(document.getElementById('image-width').value) || state.imageCanvas.width;
  const height = parseInt(document.getElementById('image-height').value) || state.imageCanvas.height;
  const status = document.getElementById('image-status');
  status.textContent = `正在导出 ${format}…`;
  try {
    const raw = await pywebview.api.export_image(JSON.stringify({ dataUrl: state.imageCanvas.toDataURL({ format: 'png' }), format, width, height, quality: document.getElementById('image-quality').value, sourceName: state.imageSourceName || 'image' }));
    const result = JSON.parse(raw);
    status.textContent = result.ok ? `✓ 已保存到桌面: ${result.filename}` : `✗ ${result.error || '导出失败'}`;
  } catch (error) {
    status.textContent = `✗ ${error.message || error}`;
  }
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
