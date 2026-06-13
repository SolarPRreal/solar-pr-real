/**
 * SolarPR Monitor — Webhook de Google Sheets (Google Apps Script)
 *
 * INSTRUCCIONES DE INSTALACIÓN:
 * 1. Crea una hoja de cálculo de Google Sheets (o usa la que ya tienes).
 * 2. Menú Extensiones → Apps Script. Borra todo y pega este código.
 * 3. Pulsa "Implementar" → "Nueva implementación" → tipo "Aplicación web".
 *    - Ejecutar como: Tú (tu cuenta).
 *    - Quién tiene acceso: "Cualquier usuario".
 * 4. Copia la URL que termina en /exec y pégala en Vercel como variable
 *    de entorno GOOGLE_SHEETS_WEBHOOK_URL (Settings → Environment Variables)
 *    y en tu .env.local para desarrollo.
 * 5. IMPORTANTE: cada vez que cambies el código, debes crear una NUEVA
 *    implementación (o gestionar versiones), si no, la URL sigue sirviendo
 *    el código antiguo.
 *
 * Hojas que crea/usa automáticamente:
 *  - Usuarios            → registro y login
 *  - Instalaciones       → cada análisis de PR guardado
 *  - CodigosRecuperacion → códigos temporales de cambio de contraseña
 */

var SHEET_USERS = "Usuarios";
var SHEET_INSTALLATIONS = "Instalaciones";
var SHEET_CODES = "CodigosRecuperacion";
var SHEET_REVIEWS = "Solicitudes";

// Email donde quieres recibir el aviso de cada nueva solicitud de revisión.
// Déjalo vacío ("") para usar automáticamente tu propia cuenta de Google.
var ADMIN_EMAIL = "";

// Token secreto compartido con la web. Debe coincidir con la variable de
// entorno API_SECRET de Vercel/.env.local. Déjalo vacío ("") para no validar
// (modo desarrollo). En producción, pon una cadena larga y aleatoria.
var API_SECRET = "";

var USERS_HEADERS = [
  "userId", "registeredAt", "name", "surname", "email", "passwordHash",
  "emailConfirmed", "confirmationDate", "rgpdAccepted", "rgpdAcceptedAt",
  "rgpdText", "source", "plantName", "autonomousCommunity", "province",
  "siarStationId", "peakPowerKwp"
];

var INSTALLATIONS_HEADERS = [
  "savedAt", "userEmail", "userName", "userSurname", "plantName",
  "autonomousCommunity", "province", "peakPowerKwp", "siarStationId",
  "siarStationCode", "siarStationName", "siarStationMunicipality",
  "siarStationProvince", "radiationKwhM2", "omiePriceEurKwh", "analyzedDay",
  "firstSample", "lastSample", "samples", "productionKwh", "expectedKwh",
  "calculatedPr", "estimatedLossEurMonth", "sourceFileName"
];

var CODES_HEADERS = ["email", "code", "createdAt", "used"];

var REVIEWS_HEADERS = [
  "requestedAt", "userEmail", "userName", "userSurname", "plantName",
  "autonomousCommunity", "province", "peakPowerKwp", "analyzedDay",
  "productionKwh", "calculatedPr", "estimatedLossEurMonth", "estado"
];

function getOrCreateSheet(name, headers) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(name);

  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
  } else if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
  }

  return sheet;
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function readRowsAsObjects(sheet) {
  var values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];

  var headers = values[0];
  var rows = [];

  for (var i = 1; i < values.length; i++) {
    var row = {};
    for (var j = 0; j < headers.length; j++) {
      row[headers[j]] = values[i][j];
    }
    row.__rowIndex = i + 1; // fila real en la hoja (1-indexed)
    rows.push(row);
  }

  return rows;
}

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents || "{}");

    // Validación del token secreto (si está configurado)
    if (API_SECRET && String(body.token || "") !== API_SECRET) {
      return jsonResponse({ ok: false, message: "Token de autenticación no válido." });
    }

    var action = body.action || "registerUser"; // compatibilidad con versiones antiguas

    switch (action) {
      case "registerUser":
        return registerUser(body);
      case "loginUser":
        return loginUser(body);
      case "requestPasswordReset":
        return requestPasswordReset(body);
      case "resetPassword":
        return resetPassword(body);
      case "saveInstallationData":
        return saveInstallationData(body);
      case "requestReview":
        return requestReview(body);
      default:
        return jsonResponse({ ok: false, message: "Acción no reconocida: " + action });
    }
  } catch (err) {
    return jsonResponse({ ok: false, message: "Error en el webhook: " + err.message });
  }
}

/* ------------------------- REGISTRO ------------------------- */

function registerUser(body) {
  var sheet = getOrCreateSheet(SHEET_USERS, USERS_HEADERS);
  var email = String(body.email || "").trim().toLowerCase();

  if (!email || !body.passwordHash) {
    return jsonResponse({ ok: false, message: "Faltan email o contraseña." });
  }

  var users = readRowsAsObjects(sheet);
  var exists = users.some(function (u) {
    return String(u.email || "").trim().toLowerCase() === email;
  });

  if (exists) {
    return jsonResponse({
      ok: false,
      message: "Ya existe un usuario registrado con ese correo.",
    });
  }

  sheet.appendRow([
    body.userId || "", body.registeredAt || new Date().toISOString(),
    body.name || "", body.surname || "", email, body.passwordHash || "",
    body.emailConfirmed || "Pendiente", body.confirmationDate || "",
    body.rgpdAccepted || "Sí", body.rgpdAcceptedAt || "", body.rgpdText || "",
    body.source || "", body.plantName || "", body.autonomousCommunity || "",
    body.province || "", body.siarStationId || "", body.peakPowerKwp || ""
  ]);

  // Correo de confirmación de registro
  try {
    MailApp.sendEmail({
      to: email,
      subject: "SolarPR Monitor — Confirmación de registro",
      htmlBody:
        "<p>Hola " + (body.name || "") + ",</p>" +
        "<p>Tu registro en <b>SolarPR Monitor</b> se ha completado correctamente.</p>" +
        "<p>Ya puedes acceder al área privada para subir tu producción quinceminutal " +
        "y comprobar el Performance Ratio real de tu instalación fotovoltaica.</p>" +
        "<p style='color:#888;font-size:12px'>Este correo se ha enviado de forma automática. " +
        "Tus datos se tratan conforme al RGPD.</p>",
    });
  } catch (mailErr) {
    // El registro es válido aunque falle el correo.
  }

  return jsonResponse({ ok: true, message: "Usuario registrado correctamente." });
}

/* --------------------------- LOGIN -------------------------- */

function loginUser(body) {
  var sheet = getOrCreateSheet(SHEET_USERS, USERS_HEADERS);
  var email = String(body.email || "").trim().toLowerCase();
  var passwordHash = String(body.passwordHash || "");

  if (!email || !passwordHash) {
    return jsonResponse({ ok: false, message: "Faltan email o contraseña." });
  }

  var users = readRowsAsObjects(sheet);
  var found = null;

  for (var i = 0; i < users.length; i++) {
    var u = users[i];
    if (
      String(u.email || "").trim().toLowerCase() === email &&
      String(u.passwordHash || "") === passwordHash
    ) {
      found = u;
      break;
    }
  }

  if (!found) {
    return jsonResponse({ ok: false, message: "Correo o contraseña incorrectos." });
  }

  return jsonResponse({
    ok: true,
    message: "Login correcto.",
    user: {
      name: found.name || "",
      surname: found.surname || "",
      email: found.email || "",
      plantName: found.plantName || "",
      autonomousCommunity: found.autonomousCommunity || "",
      province: found.province || "",
      siarStationId: found.siarStationId || "",
      peakPowerKwp: String(found.peakPowerKwp || ""),
    },
  });
}

/* ------------------ RECUPERACIÓN DE CONTRASEÑA ------------------ */

function requestPasswordReset(body) {
  var usersSheet = getOrCreateSheet(SHEET_USERS, USERS_HEADERS);
  var codesSheet = getOrCreateSheet(SHEET_CODES, CODES_HEADERS);
  var email = String(body.email || "").trim().toLowerCase();

  if (!email) {
    return jsonResponse({ ok: false, message: "Falta el email." });
  }

  var users = readRowsAsObjects(usersSheet);
  var exists = users.some(function (u) {
    return String(u.email || "").trim().toLowerCase() === email;
  });

  // Por seguridad, se responde igual exista o no el correo.
  if (exists) {
    var code = String(Math.floor(100000 + Math.random() * 900000)); // 6 dígitos
    codesSheet.appendRow([email, code, new Date().toISOString(), "No"]);

    try {
      MailApp.sendEmail({
        to: email,
        subject: "SolarPR Monitor — Código de recuperación de contraseña",
        htmlBody:
          "<p>Has solicitado restablecer tu contraseña en <b>SolarPR Monitor</b>.</p>" +
          "<p>Tu código de recuperación es:</p>" +
          "<p style='font-size:24px;font-weight:bold;letter-spacing:4px'>" + code + "</p>" +
          "<p>Introduce este código en la web junto con tu nueva contraseña. " +
          "El código caduca en 30 minutos.</p>" +
          "<p style='color:#888;font-size:12px'>Si no has solicitado este cambio, ignora este correo.</p>",
      });
    } catch (mailErr) {
      return jsonResponse({ ok: false, message: "No se pudo enviar el correo: " + mailErr.message });
    }
  }

  return jsonResponse({
    ok: true,
    message: "Si el correo existe en el sistema, recibirás un código de recuperación.",
  });
}

function resetPassword(body) {
  var usersSheet = getOrCreateSheet(SHEET_USERS, USERS_HEADERS);
  var codesSheet = getOrCreateSheet(SHEET_CODES, CODES_HEADERS);

  var email = String(body.email || "").trim().toLowerCase();
  var code = String(body.code || "").trim();
  var newPasswordHash = String(body.newPasswordHash || "");

  if (!email || !code || !newPasswordHash) {
    return jsonResponse({ ok: false, message: "Faltan email, código o nueva contraseña." });
  }

  var codes = readRowsAsObjects(codesSheet);
  var validCode = null;
  var THIRTY_MINUTES = 30 * 60 * 1000;

  for (var i = codes.length - 1; i >= 0; i--) {
    var c = codes[i];
    if (
      String(c.email || "").trim().toLowerCase() === email &&
      String(c.code || "").trim() === code &&
      String(c.used || "") !== "Sí"
    ) {
      var createdAt = new Date(c.createdAt).getTime();
      if (Date.now() - createdAt <= THIRTY_MINUTES) {
        validCode = c;
      }
      break;
    }
  }

  if (!validCode) {
    return jsonResponse({ ok: false, message: "Código incorrecto o caducado. Solicita uno nuevo." });
  }

  var users = readRowsAsObjects(usersSheet);
  var userRow = null;

  for (var j = 0; j < users.length; j++) {
    if (String(users[j].email || "").trim().toLowerCase() === email) {
      userRow = users[j];
      break;
    }
  }

  if (!userRow) {
    return jsonResponse({ ok: false, message: "No existe un usuario con ese correo." });
  }

  // Actualizar hash de contraseña (columna passwordHash = índice 6 → columna F+1)
  var hashColumn = USERS_HEADERS.indexOf("passwordHash") + 1;
  usersSheet.getRange(userRow.__rowIndex, hashColumn).setValue(newPasswordHash);

  // Marcar código como usado
  var usedColumn = CODES_HEADERS.indexOf("used") + 1;
  codesSheet.getRange(validCode.__rowIndex, usedColumn).setValue("Sí");

  return jsonResponse({ ok: true, message: "Contraseña cambiada correctamente." });
}

/* -------------------- GUARDADO DE INSTALACIONES -------------------- */

function saveInstallationData(body) {
  var sheet = getOrCreateSheet(SHEET_INSTALLATIONS, INSTALLATIONS_HEADERS);

  if (!body.userEmail || !body.plantName) {
    return jsonResponse({ ok: false, message: "Faltan datos obligatorios: usuario e instalación." });
  }

  sheet.appendRow(
    INSTALLATIONS_HEADERS.map(function (header) {
      return body[header] !== undefined && body[header] !== null ? body[header] : "";
    })
  );

  return jsonResponse({ ok: true, message: "Datos de instalación guardados correctamente." });
}

/* -------------------- SOLICITUDES DE REVISIÓN TÉCNICA -------------------- */

function requestReview(body) {
  var sheet = getOrCreateSheet(SHEET_REVIEWS, REVIEWS_HEADERS);
  var email = String(body.userEmail || "").trim().toLowerCase();

  if (!email) {
    return jsonResponse({ ok: false, message: "Falta el email del usuario." });
  }

  sheet.appendRow([
    body.requestedAt || new Date().toISOString(),
    email,
    body.userName || "",
    body.userSurname || "",
    body.plantName || "",
    body.autonomousCommunity || "",
    body.province || "",
    body.peakPowerKwp || "",
    body.analyzedDay || "",
    body.productionKwh || "",
    body.calculatedPr || "",
    body.estimatedLossEurMonth || "",
    "Pendiente"
  ]);

  var adminEmail = ADMIN_EMAIL || Session.getActiveUser().getEmail();

  // Aviso al administrador (tú)
  try {
    MailApp.sendEmail({
      to: adminEmail,
      subject:
        "SolarPR Monitor — Nueva solicitud de revisión técnica (PR " +
        (body.calculatedPr || "?") + "%)",
      htmlBody:
        "<h3>Nueva solicitud de revisión técnica</h3>" +
        "<table border='0' cellpadding='4'>" +
        "<tr><td><b>Cliente:</b></td><td>" + (body.userName || "") + " " + (body.userSurname || "") + "</td></tr>" +
        "<tr><td><b>Email:</b></td><td>" + email + "</td></tr>" +
        "<tr><td><b>Planta:</b></td><td>" + (body.plantName || "") + " (" + (body.province || "") + ")</td></tr>" +
        "<tr><td><b>Potencia pico:</b></td><td>" + (body.peakPowerKwp || "?") + " kWp</td></tr>" +
        "<tr><td><b>PR calculado:</b></td><td>" + (body.calculatedPr || "?") + " %</td></tr>" +
        "<tr><td><b>Producción del día:</b></td><td>" + (body.productionKwh || "?") + " kWh</td></tr>" +
        "<tr><td><b>Pérdida estimada:</b></td><td>" + (body.estimatedLossEurMonth || "?") + " €/mes</td></tr>" +
        "</table>" +
        "<p>La solicitud ha quedado registrada en la hoja \"Solicitudes\" con estado <b>Pendiente</b>.</p>",
    });
  } catch (mailErr) {
    // La solicitud queda registrada aunque falle el aviso.
  }

  // Confirmación al cliente
  try {
    MailApp.sendEmail({
      to: email,
      subject: "SolarPR Monitor — Hemos recibido tu solicitud de revisión",
      htmlBody:
        "<p>Hola " + (body.userName || "") + ",</p>" +
        "<p>Hemos recibido tu solicitud de <b>revisión técnica y presupuesto</b> para la instalación " +
        "<b>" + (body.plantName || "") + "</b>.</p>" +
        "<p>Un técnico analizará los datos de rendimiento que has subido y te contactará " +
        "en un plazo máximo de 48 horas laborables.</p>" +
        "<p style='color:#888;font-size:12px'>Este correo se ha enviado de forma automática desde SolarPR Monitor.</p>",
    });
  } catch (mailErr) {}

  return jsonResponse({ ok: true, message: "Solicitud de revisión registrada correctamente." });
}

/* --------------------------- TEST GET --------------------------- */

function doGet() {
  return jsonResponse({
    ok: true,
    message: "Webhook de SolarPR Monitor activo. Usa POST con un campo 'action'.",
  });
}
