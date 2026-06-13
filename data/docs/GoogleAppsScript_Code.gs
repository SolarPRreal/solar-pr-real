/**
 * SolarPR Monitor - backend mínimo para Google Sheets / Apps Script.
 * 1) Vincula este script a una hoja de cálculo nueva.
 * 2) Ejecuta setupSolarPR() una vez y autoriza.
 * 3) En Configuración del proyecto > Propiedades del script añade:
 *    APP_BASE_URL = https://TU-PROYECTO.vercel.app
 *    SUPPORT_EMAIL = soporte.solarpr@gmail.com
 * 4) Implementa como Aplicación web: ejecutar como tú; acceso: cualquier usuario.
 * 5) Copia la URL /exec a GOOGLE_SHEETS_WEBHOOK_URL en Vercel.
 */

const USERS_SHEET = 'Usuarios';
const INSTALLATIONS_SHEET = 'Instalaciones';
const AUDIT_SHEET = 'Auditoria';
const RESET_TTL_MINUTES = 15;

function setupSolarPR() {
  const ss = SpreadsheetApp.getActive();
  ensureSheet_(ss, USERS_SHEET, [
    'userId','registeredAt','name','surname','email','passwordHash',
    'emailConfirmed','confirmationTokenHash','confirmationExpiresAt',
    'privacyAcceptedAt','privacyVersion','plantName','autonomousCommunity',
    'province','siarStationId','peakPower','resetCodeHash','resetExpiresAt',
    'lastLoginAt','deletedAt'
  ]);
  ensureSheet_(ss, INSTALLATIONS_SHEET, [
    'savedAt','userEmail','plantName','autonomousCommunity','province',
    'peakPowerKwp','siarStationId','siarStationCode','siarStationName',
    'analyzedDay','samples','productionKwh','radiationKwhM2','calculatedPr',
    'expectedKwh','estimatedLossEurMonth','sourceFileName'
  ]);
  ensureSheet_(ss, AUDIT_SHEET, ['timestamp','action','email','result']);
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    setupSolarPR();
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const action = String(body.action || '');
    let result;
    switch (action) {
      case 'registerUser': result = registerUser_(body); break;
      case 'confirmEmail': result = confirmEmail_(body); break;
      case 'login': result = login_(body); break;
      case 'requestPasswordReset': result = requestPasswordReset_(body); break;
      case 'resetPassword': result = resetPassword_(body); break;
      case 'saveInstallationData': result = saveInstallation_(body); break;
      default: result = { ok: false, code: 'INVALID_ACTION' };
    }
    audit_(action, body.email || body.userEmail || '', result.ok ? 'OK' : (result.code || 'ERROR'));
    return json_(result);
  } catch (error) {
    console.error(error);
    return json_({ ok: false, code: 'INTERNAL_ERROR' });
  } finally {
    lock.releaseLock();
  }
}

function registerUser_(body) {
  const email = normalizeEmail_(body.email);
  if (!email || !body.name || !body.surname || !/^[a-f0-9]{64}$/.test(String(body.passwordHash || ''))) {
    return { ok: false, code: 'INVALID_DATA' };
  }
  const sheet = SpreadsheetApp.getActive().getSheetByName(USERS_SHEET);
  const rows = rowsAsObjects_(sheet);
  if (rows.some(r => normalizeEmail_(r.email) === email && !r.deletedAt)) {
    return { ok: false, code: 'EMAIL_EXISTS' };
  }

  const token = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
  const now = new Date();
  const expires = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  appendObject_(sheet, {
    userId: Utilities.getUuid(), registeredAt: now.toISOString(),
    name: safeText_(body.name, 80), surname: safeText_(body.surname, 120), email,
    passwordHash: String(body.passwordHash), emailConfirmed: false,
    confirmationTokenHash: sha256_(token), confirmationExpiresAt: expires.toISOString(),
    privacyAcceptedAt: String(body.privacyAcceptedAt || now.toISOString()),
    privacyVersion: safeText_(body.privacyVersion, 32), plantName: 'Instalación FV',
    autonomousCommunity: 'Comunidad de Madrid', province: 'Madrid',
    siarStationId: '', peakPower: '100', resetCodeHash: '', resetExpiresAt: '',
    lastLoginAt: '', deletedAt: ''
  });

  const props = PropertiesService.getScriptProperties();
  const baseUrl = String(props.getProperty('APP_BASE_URL') || '').replace(/\/$/, '');
  const support = props.getProperty('SUPPORT_EMAIL') || 'soporte.solarpr@gmail.com';
  if (!/^https:\/\//.test(baseUrl)) return { ok: false, code: 'APP_BASE_URL_NOT_CONFIGURED' };
  const link = baseUrl + '/api/confirm-email?email=' + encodeURIComponent(email) + '&token=' + encodeURIComponent(token);
  MailApp.sendEmail({
    to: email,
    subject: 'Confirma tu cuenta de SolarPR Monitor',
    htmlBody: '<p>Hola ' + html_(body.name) + ',</p><p>Confirma tu cuenta pulsando este enlace (válido durante 24 horas):</p><p><a href="' + link + '">Confirmar cuenta</a></p><p>Si no solicitaste el registro, ignora este mensaje.</p><p>Contacto: ' + html_(support) + '</p>'
  });
  return { ok: true };
}

function confirmEmail_(body) {
  const email = normalizeEmail_(body.email);
  const tokenHash = sha256_(String(body.token || ''));
  const sheet = SpreadsheetApp.getActive().getSheetByName(USERS_SHEET);
  const found = findRowByEmail_(sheet, email);
  if (!found) return { ok: false, code: 'INVALID_TOKEN' };
  const row = found.object;
  if (String(row.emailConfirmed).toLowerCase() === 'true') return { ok: true };
  if (row.confirmationTokenHash !== tokenHash || new Date(row.confirmationExpiresAt).getTime() < Date.now()) {
    return { ok: false, code: 'INVALID_TOKEN' };
  }
  updateRow_(sheet, found.rowNumber, { emailConfirmed: true, confirmationTokenHash: '', confirmationExpiresAt: '' });
  return { ok: true };
}

function login_(body) {
  const email = normalizeEmail_(body.email);
  const passwordHash = String(body.passwordHash || '');
  const sheet = SpreadsheetApp.getActive().getSheetByName(USERS_SHEET);
  const found = findRowByEmail_(sheet, email);
  if (!found || found.object.deletedAt || String(found.object.emailConfirmed).toLowerCase() !== 'true' || found.object.passwordHash !== passwordHash) {
    Utilities.sleep(250);
    return { ok: false, code: 'INVALID_CREDENTIALS' };
  }
  updateRow_(sheet, found.rowNumber, { lastLoginAt: new Date().toISOString() });
  const r = found.object;
  return { ok: true, user: {
    name: r.name, surname: r.surname, plantName: r.plantName || 'Instalación FV',
    autonomousCommunity: r.autonomousCommunity || 'Comunidad de Madrid',
    province: r.province || 'Madrid', siarStationId: r.siarStationId || '',
    peakPower: r.peakPower || '100'
  }};
}

function requestPasswordReset_(body) {
  const email = normalizeEmail_(body.email);
  const sheet = SpreadsheetApp.getActive().getSheetByName(USERS_SHEET);
  const found = findRowByEmail_(sheet, email);
  if (!found || found.object.deletedAt || String(found.object.emailConfirmed).toLowerCase() !== 'true') return { ok: true };
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const expires = new Date(Date.now() + RESET_TTL_MINUTES * 60 * 1000);
  updateRow_(sheet, found.rowNumber, { resetCodeHash: sha256_(code), resetExpiresAt: expires.toISOString() });
  MailApp.sendEmail({
    to: email,
    subject: 'Código para cambiar tu contraseña de SolarPR Monitor',
    htmlBody: '<p>Tu código de recuperación es:</p><h2>' + code + '</h2><p>Caduca en ' + RESET_TTL_MINUTES + ' minutos. Si no lo solicitaste, ignora este mensaje.</p>'
  });
  return { ok: true };
}

function resetPassword_(body) {
  const email = normalizeEmail_(body.email);
  const sheet = SpreadsheetApp.getActive().getSheetByName(USERS_SHEET);
  const found = findRowByEmail_(sheet, email);
  if (!found || found.object.resetCodeHash !== sha256_(String(body.code || '')) || new Date(found.object.resetExpiresAt).getTime() < Date.now()) {
    return { ok: false, code: 'INVALID_CODE' };
  }
  if (!/^[a-f0-9]{64}$/.test(String(body.newPasswordHash || ''))) return { ok: false, code: 'INVALID_DATA' };
  updateRow_(sheet, found.rowNumber, { passwordHash: String(body.newPasswordHash), resetCodeHash: '', resetExpiresAt: '' });
  return { ok: true };
}

function saveInstallation_(body) {
  const email = normalizeEmail_(body.userEmail);
  if (!email || Number(body.samples) !== 96) return { ok: false, code: 'INVALID_DATA' };
  const users = SpreadsheetApp.getActive().getSheetByName(USERS_SHEET);
  const found = findRowByEmail_(users, email);
  if (!found || found.object.deletedAt) return { ok: false, code: 'UNKNOWN_USER' };
  const installations = SpreadsheetApp.getActive().getSheetByName(INSTALLATIONS_SHEET);
  appendObject_(installations, body);
  updateRow_(users, found.rowNumber, {
    plantName: safeText_(body.plantName, 120), autonomousCommunity: safeText_(body.autonomousCommunity, 80),
    province: safeText_(body.province, 80), siarStationId: safeText_(body.siarStationId, 30), peakPower: String(body.peakPowerKwp || '')
  });
  return { ok: true };
}

function ensureSheet_(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  if (sheet.getLastRow() === 0) sheet.appendRow(headers);
  return sheet;
}
function rowsAsObjects_(sheet) {
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0].map(String);
  return values.slice(1).map(row => Object.fromEntries(headers.map((h,i) => [h, row[i]])));
}
function findRowByEmail_(sheet, email) {
  const rows = rowsAsObjects_(sheet);
  const index = rows.findIndex(r => normalizeEmail_(r.email) === email);
  return index < 0 ? null : { rowNumber: index + 2, object: rows[index] };
}
function appendObject_(sheet, obj) {
  const headers = sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0].map(String);
  sheet.appendRow(headers.map(h => obj[h] !== undefined ? obj[h] : ''));
}
function updateRow_(sheet, rowNumber, changes) {
  const headers = sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0].map(String);
  Object.keys(changes).forEach(key => {
    const col = headers.indexOf(key);
    if (col >= 0) sheet.getRange(rowNumber, col + 1).setValue(changes[key]);
  });
}
function audit_(action, email, result) {
  const sheet = SpreadsheetApp.getActive().getSheetByName(AUDIT_SHEET);
  sheet.appendRow([new Date().toISOString(), safeText_(action, 40), normalizeEmail_(email), safeText_(result, 40)]);
}
function sha256_(value) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(value), Utilities.Charset.UTF_8)
    .map(b => ('0' + ((b < 0 ? b + 256 : b).toString(16))).slice(-2)).join('');
}
function normalizeEmail_(value) { return String(value || '').trim().toLowerCase().slice(0,254); }
function safeText_(value, max) { return String(value || '').replace(/[\u0000-\u001F\u007F]/g, ' ').trim().slice(0,max); }
function html_(value) { return String(value || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function json_(obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }
