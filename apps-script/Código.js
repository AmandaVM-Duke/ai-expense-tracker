var SPREADSHEET_ID = '1DsM0o59KF-4bZyrvpQzbueJVX__bD88Ai23UlmgdhMk';
var SHEET_NAME = 'Expenses';
var BUDGET_SHEET = 'Orcamento';
var CONFIG_SHEET = 'Config';
var MONTHS_PT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

// Normaliza qualquer forma de mês (Date, "2026-Agosto", "2026-agosto", "2026-08") -> "2026-08"
function canonMonth(v) {
  if (v === null || v === undefined || v === '') return '';
  if (Object.prototype.toString.call(v) === '[object Date]') {
    return v.getFullYear() + '-' + ('0' + (v.getMonth() + 1)).slice(-2);
  }
  var s = String(v).trim().toLowerCase();
  var parts = s.split('-');
  if (parts.length === 2) {
    var year = parts[0];
    var idx = MONTHS_PT.map(function(m){ return m.toLowerCase(); }).indexOf(parts[1]);
    if (idx >= 0) return year + '-' + ('0' + (idx + 1)).slice(-2);
    if (/^\d{1,2}$/.test(parts[1])) return year + '-' + ('0' + parseInt(parts[1], 10)).slice(-2);
  }
  return s;
}

// Converte "2026-08" de volta pro formato do app "2026-Agosto"
function appMonth(v) {
  var c = canonMonth(v);
  var p = c.split('-');
  if (p.length === 2) {
    var mi = parseInt(p[1], 10) - 1;
    if (mi >= 0 && mi < 12) return p[0] + '-' + MONTHS_PT[mi];
  }
  return String(v);
}

function doGet(e) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  if (e.parameter.action === 'saveBudget') {
    var mes = e.parameter.month;
    var mesCanon = canonMonth(mes);
    var newBudgets = JSON.parse(decodeURIComponent(e.parameter.data));
    var budSheet = ss.getSheetByName(BUDGET_SHEET) || ss.insertSheet(BUDGET_SHEET);
    var existing = [];
    if (budSheet.getLastRow() > 1) {
      existing = budSheet.getRange(2, 1, budSheet.getLastRow() - 1, 3).getValues()
        .filter(function(r) { return r[0] && canonMonth(r[2]) !== mesCanon; });
    }
    var newRows = Object.keys(newBudgets).map(function(cat) { return [cat, newBudgets[cat], mes]; });
    var maxRow = budSheet.getMaxRows();
    if (maxRow > 1) budSheet.getRange(2, 1, maxRow - 1, 3).clearContent();
    var allRows = existing.concat(newRows);
    if (allRows.length > 0) budSheet.getRange(2, 1, allRows.length, 3).setValues(allRows);
    return ContentService.createTextOutput(JSON.stringify({ ok: true })).setMimeType(ContentService.MimeType.JSON);
  }

  if (e.parameter.action === 'saveCats') {
    var cats = JSON.parse(decodeURIComponent(e.parameter.data));
    var cfg = ss.getSheetByName(CONFIG_SHEET) || ss.insertSheet(CONFIG_SHEET);
    cfg.getRange(1, 1).setValue(JSON.stringify(cats));
    return ContentService.createTextOutput(JSON.stringify({ ok: true })).setMimeType(ContentService.MimeType.JSON);
  }

  if (e.parameter.action === 'delete') {
    var target = JSON.parse(decodeURIComponent(e.parameter.data));
    var sheet = ss.getSheetByName(SHEET_NAME);
    var deleted = false;
    if (sheet && sheet.getLastRow() > 1) {
      var rows = sheet.getDataRange().getValues();
      // Bottom-up so deleting a row doesn't shift the ones we haven't checked yet.
      for (var i = rows.length - 1; i >= 1; i--) {
        if (rowMatches(rows[i], target)) {
          sheet.deleteRow(i + 1); // getValues is 0-indexed; sheet rows are 1-indexed
          deleted = true;
          break; // remove only the single matching entry
        }
      }
    }
    return ContentService.createTextOutput(JSON.stringify({ ok: true, deleted: deleted })).setMimeType(ContentService.MimeType.JSON);
  }

  var data = [];
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (sheet && sheet.getLastRow() > 1) {
    sheet.getDataRange().getValues().slice(1).forEach(function(r) {
      data.push({ date: r[0], merchant: r[1], category: r[2], amount: r[3], notes: r[4] || '', month: r[5] });
    });
  }

  var budgets = {};
  var budSheet = ss.getSheetByName(BUDGET_SHEET);
  if (budSheet && budSheet.getLastRow() > 1) {
    budSheet.getDataRange().getValues().slice(1).forEach(function(r) {
      var cat = String(r[0]); var val = Number(r[1]) || 0; var mes = r[2] ? appMonth(r[2]) : 'default';
      if (!cat) return;
      if (!budgets[mes]) budgets[mes] = {};
      budgets[mes][cat] = val;
    });
  }

  var cats = null;
  var cfg = ss.getSheetByName(CONFIG_SHEET);
  if (cfg && cfg.getRange(1, 1).getValue()) {
    try { cats = JSON.parse(cfg.getRange(1, 1).getValue()); } catch (err) {}
  }

  return ContentService.createTextOutput(JSON.stringify({ data: data, budgets: budgets, cats: cats })).setMimeType(ContentService.MimeType.JSON);
}

// Normaliza data (Date ou string com/sem hora) -> "YYYY-MM-DD" para comparação
function canonDate(v) {
  if (v === null || v === undefined || v === '') return '';
  if (Object.prototype.toString.call(v) === '[object Date]') {
    return v.getFullYear() + '-' + ('0' + (v.getMonth() + 1)).slice(-2) + '-' + ('0' + v.getDate()).slice(-2);
  }
  var s = String(v).trim();
  var m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return m[1] + '-' + m[2] + '-' + m[3];
  return s;
}

// Uma linha da aba Expenses (r) casa com o lançamento (t) enviado pelo app?
// Mesma lógica de identidade que o app usa: data + estabelecimento + valor + categoria.
function rowMatches(r, t) {
  return canonDate(r[0]) === canonDate(t.date)
    && String(r[1]).trim() === String(t.merchant).trim()
    && String(r[2]).trim() === String(t.category).trim()
    && Number(r[3]) === Number(t.amount);
}

function doPost(e) {
  var body = JSON.parse(e.postData.contents);
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) sheet.appendRow(['date','merchant','category','amount','notes','month']);
  sheet.appendRow([body.date, body.merchant, body.category, body.amount, body.notes || '', body.month]);
  return ContentService.createTextOutput(JSON.stringify({ ok: true })).setMimeType(ContentService.MimeType.JSON);
}