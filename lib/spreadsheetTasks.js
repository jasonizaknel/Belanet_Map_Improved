const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const { inc, setGauge } = require('./metrics');

function listSpreadsheetFiles(baseDir) {
  const t0 = Date.now();
  const dir = path.join(baseDir, 'Data');
  if (!fs.existsSync(dir)) return [];
  const files = fs.readdirSync(dir).filter(f => /\.(xlsx|csv)$/i.test(f));
  const out = files.sort();
  const ms = Date.now() - t0;
  inc('file_io_ms_sum', { op: 'list_spreadsheets' });
  inc('file_io_ms_count', { op: 'list_spreadsheets' });
  setGauge('file_io_last_ms', { op: 'list_spreadsheets' }, ms);
  return out;
}

function parseSplynxTasksFromFile(baseDir, filePath) {
  const t0 = Date.now();
  const full = path.isAbsolute(filePath) ? filePath : path.join(baseDir, 'Data', filePath);
  if (!fs.existsSync(full)) throw new Error('File not found');
  const wb = XLSX.readFile(full);
  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false });
  if (!rows || rows.length === 0) throw new Error('Empty spreadsheet');
  const header = rows[0].map(h => String(h || '').trim());
  const idx = {};
  header.forEach((h, i) => { idx[h.toLowerCase()] = i; });
  const need = ['id', 'title'];
  for (const k of need) { if (!(k in idx)) throw new Error('Missing required header: ' + k); }
  const tasks = [];
  const seen = new Set();
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r] || [];
    const id = row[idx['id']];
    const title = row[idx['title']];
    if (!id || !title) continue;
    const key = String(id).trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const t = { ID: key, Title: String(title).trim() };
    if ('status' in idx) t.Status = String(row[idx['status']] || '').trim();
    if ('customer' in idx) t.Customer = String(row[idx['customer']] || '').trim();
    if ('created at' in idx) { const v = row[idx['created at']]; if (v) t['Created at'] = new Date(v).toISOString(); }
    if ('updated at' in idx) { const v2 = row[idx['updated at']]; if (v2) t['Updated at'] = new Date(v2).toISOString(); }
    tasks.push(t);
  }
  const ms = Date.now() - t0;
  inc('file_io_ms_sum', { op: 'parse_tasks_xlsx' });
  inc('file_io_ms_count', { op: 'parse_tasks_xlsx' });
  setGauge('file_io_last_ms', { op: 'parse_tasks_xlsx' }, ms);
  return tasks;
}

function loadTaskIdsFromExcel(baseDir) {
  try {
    const t0 = Date.now();
    const filePath = path.join(baseDir, 'Data', 'Belanet Tasks Export.xlsx');
    if (!fs.existsSync(filePath)) return [];
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    const taskIds = data.slice(2).map(row => row[1]).filter(id => id && !isNaN(id));
    const ms = Date.now() - t0;
    inc('file_io_ms_sum', { op: 'parse_task_ids_xlsx' });
    inc('file_io_ms_count', { op: 'parse_task_ids_xlsx' });
    setGauge('file_io_last_ms', { op: 'parse_task_ids_xlsx' }, ms);
    return taskIds;
  } catch {
    return [];
  }
}

function tryAutoLoadSpreadsheetIntoCache(baseDir, tasksCache) {
  if (tasksCache.data && tasksCache.data.length > 0) return false;
  const files = listSpreadsheetFiles(baseDir);
  if (files.length === 0) return false;
  try {
    const tasks = parseSplynxTasksFromFile(baseDir, files[0]);
    tasksCache.data = tasks;
    tasksCache.lastFetch = Date.now();
    tasksCache.sourceFile = files[0];
    return true;
  } catch {
    return false;
  }
}

module.exports = {
  listSpreadsheetFiles,
  parseSplynxTasksFromFile,
  loadTaskIdsFromExcel,
  tryAutoLoadSpreadsheetIntoCache,
};
