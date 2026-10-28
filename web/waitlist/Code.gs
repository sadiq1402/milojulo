// Waitlist for milojulo.co.in: the landing page's form posts email, city, the Modes they want, where
// they came from and a hidden honeypot here.
// Deployed as a web app from the Google Sheet that holds the list (see README.md).
const SHEET = 'Waitlist';
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const HEADER = ['Joined', 'Email', 'City', 'Modes', 'Source'];
const MODES = ['Friends', 'Activities', 'Dating', 'Serious', 'Casual', 'Networking'];

function doPost(e) {
  const p = (e && e.parameter) || {};
  // Bots fill every field; people never see this one.
  if (p.website) return reply('ok');
  const email = String(p.email || '').trim().toLowerCase();
  const city = clean(p.city, 80);
  const modes = ((e && e.parameters && e.parameters.modes) || []).filter(m => MODES.includes(m)).join(', ');
  const source = clean(p.source, 60);
  if (email.length > 254 || !EMAIL.test(email)) return reply('invalid');

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = getSheet();
    const seen = sheet.getRange('B:B').createTextFinder(email).matchEntireCell(true).findNext();
    if (!seen) sheet.appendRow([new Date(), email, cell(city), modes, cell(source)]);
  } finally {
    lock.releaseLock();
  }
  return reply('ok');
}

function getSheet() {
  const book = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = book.getSheetByName(SHEET);
  if (!sheet) {
    sheet = book.insertSheet(SHEET);
    sheet.setFrozenRows(1);
  }
  // Also adds the Modes and Source headings to a Sheet made before they existed.
  sheet.getRange(1, 1, 1, HEADER.length).setValues([HEADER]);
  return sheet;
}

function clean(value, max) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, max);
}

// A leading = + - @ would make the sheet read typed text as a formula.
function cell(text) {
  return /^[=+\-@]/.test(text) ? "'" + text : text;
}

function reply(status) {
  return ContentService.createTextOutput(status).setMimeType(ContentService.MimeType.TEXT);
}
