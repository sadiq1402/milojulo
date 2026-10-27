// Waitlist for milojulo.co.in: the landing page's form posts email, city and a hidden honeypot here.
// Deployed as a web app from the Google Sheet that holds the list (see README.md).
const SHEET = 'Waitlist';
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function doPost(e) {
  const p = (e && e.parameter) || {};
  // Bots fill every field; people never see this one.
  if (p.website) return reply('ok');
  const email = String(p.email || '').trim().toLowerCase();
  const city = String(p.city || '').trim().replace(/\s+/g, ' ').slice(0, 80);
  if (email.length > 254 || !EMAIL.test(email)) return reply('invalid');

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = getSheet();
    const seen = sheet.getRange('B:B').createTextFinder(email).matchEntireCell(true).findNext();
    // A leading = + - @ would make the sheet read a city as a formula.
    if (!seen) sheet.appendRow([new Date(), email, /^[=+\-@]/.test(city) ? "'" + city : city]);
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
    sheet.appendRow(['Joined', 'Email', 'City']);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function reply(status) {
  return ContentService.createTextOutput(status).setMimeType(ContentService.MimeType.TEXT);
}
