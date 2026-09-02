import './style.css';

const elements = {
  folderInput: document.querySelector('#folderInput'), fileInput: document.querySelector('#fileInput'), dropZone: document.querySelector('#dropZone'),
  folderLabel: document.querySelector('#folderLabel'), fileList: document.querySelector('#fileList'), scanStatus: document.querySelector('#scanStatus'),
  fileCount: document.querySelector('#fileCount'), sheetCount: document.querySelector('#sheetCount'), rowCount: document.querySelector('#rowCount'), cellCount: document.querySelector('#cellCount'),
  previewTitle: document.querySelector('#previewTitle'), sheetTabs: document.querySelector('#sheetTabs'), previewMeta: document.querySelector('#previewMeta'), tableWrap: document.querySelector('#tableWrap'), exportButton: document.querySelector('#exportButton'), toast: document.querySelector('#toast')
};

let workbooks = [];
let activeFile = 0;
let activeSheet = 0;
const supported = /\.(xlsx|xls|csv)$/i;

function formatNumber(value) { return new Intl.NumberFormat('zh-CN').format(value); }
function showToast(message) { elements.toast.textContent = message; elements.toast.classList.add('visible'); window.setTimeout(() => elements.toast.classList.remove('visible'), 2600); }
function resetPreview() { elements.sheetTabs.innerHTML = ''; elements.previewTitle.textContent = '数据预览'; elements.previewMeta.textContent = '选择一个 Excel 文件以查看完整表格内容'; elements.tableWrap.className = 'table-wrap empty-table'; elements.tableWrap.innerHTML = '<div><span class="empty-mark">▦</span><p>解析完成后，第一张工作表会显示在这里。</p></div>'; elements.exportButton.disabled = true; }

async function loadFiles(files) {
  if (!window.XLSX) { showToast('Excel 解析组件尚未加载，请检查网络后重试'); return; }
  const excelFiles = [...files].filter(file => supported.test(file.name));
  if (!excelFiles.length) { showToast('没有发现 .xlsx、.xls 或 .csv 文件'); return; }
  workbooks = []; activeFile = 0; activeSheet = 0;
  elements.folderLabel.textContent = `正在解析 ${excelFiles.length} 个表格文件…`;
  elements.scanStatus.textContent = '解析中';
  resetPreview();
  for (const [index, file] of excelFiles.entries()) {
    try {
      const content = await file.arrayBuffer();
      const book = XLSX.read(content, { type: 'array', cellDates: true });
      workbooks.push({ file, book, path: file.webkitRelativePath || file.name });
    } catch (error) { console.warn(`无法读取 ${file.name}`, error); }
    elements.scanStatus.textContent = `已读取 ${index + 1}/${excelFiles.length}`;
  }
  elements.folderLabel.textContent = `已载入 ${workbooks.length} 个 Excel 文件`;
  elements.scanStatus.textContent = workbooks.length ? '解析完成' : '未读取到文件';
  renderAll();
  if (workbooks.length) showToast(`已在本地解析 ${workbooks.length} 个文件`);
}

function getSheetData(fileIndex = activeFile, sheetIndex = activeSheet) {
  const item = workbooks[fileIndex];
  if (!item) return [];
  const name = item.book.SheetNames[sheetIndex];
  return XLSX.utils.sheet_to_json(item.book.Sheets[name], { header: 1, defval: '', raw: false });
}
function calculateSummary() {
  let sheets = 0, rows = 0, cells = 0;
  workbooks.forEach(item => item.book.SheetNames.forEach((_, index) => {
    const data = getSheetData(workbooks.indexOf(item), index); sheets += 1; rows += data.length; cells += data.reduce((sum, row) => sum + row.length, 0);
  }));
  return { sheets, rows, cells };
}
function renderAll() {
  const { sheets, rows, cells } = calculateSummary();
  elements.fileCount.textContent = formatNumber(workbooks.length); elements.sheetCount.textContent = formatNumber(sheets); elements.rowCount.textContent = formatNumber(rows); elements.cellCount.textContent = formatNumber(cells);
  renderFileList(); renderPreview();
}
function renderFileList() {
  if (!workbooks.length) return;
  elements.fileList.className = 'file-list';
  elements.fileList.innerHTML = workbooks.map((item, index) => {
    const dataRows = item.book.SheetNames.reduce((total, _, sheetIndex) => total + getSheetData(index, sheetIndex).length, 0);
    return `<button class="file-item ${index === activeFile ? 'active' : ''}" data-file-index="${index}"><span class="file-type">${item.file.name.split('.').pop().toUpperCase()}</span><span class="file-name"><strong>${escapeHtml(item.file.name)}</strong><small>${escapeHtml(item.path)} · ${item.book.SheetNames.length} 张表 · ${dataRows} 行</small></span><span class="arrow">›</span></button>`;
  }).join('');
  elements.fileList.querySelectorAll('[data-file-index]').forEach(button => button.addEventListener('click', () => { activeFile = Number(button.dataset.fileIndex); activeSheet = 0; renderFileList(); renderPreview(); }));
}
function renderPreview() {
  const item = workbooks[activeFile]; if (!item) return;
  const sheetName = item.book.SheetNames[activeSheet]; const data = getSheetData();
  elements.previewTitle.textContent = item.file.name;
  elements.sheetTabs.innerHTML = item.book.SheetNames.map((name, index) => `<button class="sheet-tab ${index === activeSheet ? 'active' : ''}" data-sheet-index="${index}">${escapeHtml(name)}</button>`).join('');
  elements.sheetTabs.querySelectorAll('[data-sheet-index]').forEach(button => button.addEventListener('click', () => { activeSheet = Number(button.dataset.sheetIndex); renderPreview(); }));
  const columns = Math.max(0, ...data.map(row => row.length));
  elements.previewMeta.textContent = `${sheetName} · ${data.length} 行 × ${columns} 列 · 显示全部已读取数据`;
  elements.tableWrap.className = 'table-wrap';
  if (!data.length) { elements.tableWrap.classList.add('empty-table'); elements.tableWrap.innerHTML = '<div><span class="empty-mark">—</span><p>这个工作表目前没有可显示的数据。</p></div>'; }
  else {
    const headers = data[0]; const body = data.slice(1);
    elements.tableWrap.innerHTML = `<table><thead><tr><th class="row-number">#</th>${Array.from({ length: columns }, (_, i) => `<th>${escapeHtml(headers[i] || `列 ${i + 1}`)}</th>`).join('')}</tr></thead><tbody>${body.map((row, rowIndex) => `<tr><td class="row-number">${rowIndex + 2}</td>${Array.from({ length: columns }, (_, i) => `<td title="${escapeHtml(row[i] ?? '')}">${escapeHtml(row[i] ?? '')}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  }
  elements.exportButton.disabled = false;
}
function escapeHtml(value) { return String(value).replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char])); }
function exportCsv() { const item = workbooks[activeFile]; const name = item.book.SheetNames[activeSheet]; const csv = XLSX.utils.sheet_to_csv(item.book.Sheets[name]); const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }); const link = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `${item.file.name.replace(/\.[^.]+$/, '')}-${name}.csv` }); link.click(); URL.revokeObjectURL(link.href); }

elements.folderInput.addEventListener('change', event => loadFiles(event.target.files));
elements.fileInput.addEventListener('change', event => loadFiles(event.target.files));
elements.dropZone.addEventListener('click', event => { if (event.target.tagName !== 'LABEL') elements.folderInput.click(); });
elements.dropZone.addEventListener('dragover', event => { event.preventDefault(); elements.dropZone.classList.add('dragging'); });
elements.dropZone.addEventListener('dragleave', () => elements.dropZone.classList.remove('dragging'));
elements.dropZone.addEventListener('drop', event => { event.preventDefault(); elements.dropZone.classList.remove('dragging'); loadFiles(event.dataTransfer.files); });
elements.exportButton.addEventListener('click', exportCsv);
