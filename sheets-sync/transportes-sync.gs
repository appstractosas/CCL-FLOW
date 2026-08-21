/*****************************************************************************
 * CCL FLOW — Sincronización Google Sheets → Supabase (tabla "transportes")
 * ---------------------------------------------------------------------------
 * Lee la pestaña de operaciones del Sheets y hace UPSERT de cada fila en la
 * tabla TRANSPORTES de Supabase usando el par (llave, placa) como clave.
 *
 * REGLA DE NEGOCIO (confirmada):
 *   Una LLAVE puede tener VARIAS PLACAS (cada placa = UNA FILA en la BD y en el
 *   Sheets). Las CAJAS se registran POR PLACA, no se suman por llave.
 *   Un TRANSPORTE (nº pedido) no puede pertenecer a DOS llaves distintas
 *   (dentro de la MISMA llave puede repetirse si el pedido se reparte en
 *   varias placas).
 *
 * CLAVE (llave, placa):
 *   El UPSERT identifica la fila por (llave, placa). Si el Sheets repite el
 *   MISMO par llave+placa (un camión/placa con varios transportes), esas filas
 *   se fusionan en UN registro: las CAJAS se SUMAN por placa y el resto de
 *   campos toma el último valor no vacío. Una placa distinta de la misma llave
 *   es UNA FILA aparte y se sincroniza sin problema.
 *   placa '' (PENDIENTE) es válida: una llave no puede tener dos filas sin
 *   placa (la BD lo rechaza con UNIQUE (llave, placa)).
 *
 * CAMPOS PARA INFORMES:
 *   - Transporte   → numero de pedido (col. "Transporte")
 *   - Denominación → nombre del cliente (col. "Denominación")
 *   - Cajas        → cantidad de cajas, se envía como número (col. "Cajas")
 *   Requieren haber creado las columnas en la BD:
 *   ALTER TABLE transportes
 *     ADD COLUMN IF NOT EXISTS transporte TEXT,
 *     ADD COLUMN IF NOT EXISTS denominacion TEXT,
 *     ADD COLUMN IF NOT EXISTS cajas NUMERIC DEFAULT 0;
 *   Y el UNIQUE por (llave, placa) en lugar de llave sola:
 *     ALTER TABLE transportes DROP CONSTRAINT IF EXISTS transportes_llave_key;
 *     ALTER TABLE transportes ADD CONSTRAINT transportes_llave_placa_key
 *       UNIQUE (llave, placa);
 *
 * Configuración previa (Apps Script → Proyecto → Configuración del proyecto):
 *   - Propiedades del script (Script Properties):
 *       SUPABASE_URL         → https://gklcxnlseghdqylvnkdb.supabase.co
 *       SUPABASE_SERVICE_KEY → Service Role key (NO la anon key)
 *
 * Para activar los disparadores: Ejecutar la función  installTriggers()  una vez.
 *****************************************************************************/

var SPREADSHEET_ID = '1uVuPEnwLHFjVRTysi9SSXgt1PVeJNWqRQ69oxxaNiY4';
var SHEET_NAME = 'Hoja 1'; // Ajustar al nombre exacto de la pestaña de operaciones.
var TABLE = 'transportes';
// Clave del UPSERT: el par (llave, placa) identifica la fila.
var UNIQUE_KEY = 'llave,placa';

// Encabezados relevantes (llave y placa identifican la fila en el Sheets).
var HEADER_LLAVE = 'Llave 2';

// Cuenta de Google con permiso total para editar/eliminar en el Sheets.
// Se puede sobreescribir con la Script Property ADMIN_EMAIL (sin tocar código).
var ADMIN_EMAIL = 'appstractosas@gmail.com';

/*****************************************************************************
 * MAPEO DE COLUMNAS:  "Encabezado del Sheets"  ->  campo de la BD
 *****************************************************************************/
var MAPPING = {
  'Fecha': 'fecha_hora',          // dd/mm/aaaa
  'Llave 2': 'llave',             // parte de la clave (upsert por (llave,placa))
  'Vehículo': 'vehiculo_tipo',
  'Cita de cargue': 'cita_cargue',// dd/mm/aaaa hh:mm
  'Olt Inicial': 'transportadora',
  'Transporte': 'transporte',     // NÚMERO DE PEDIDO (no es placa ni vehículo)
  'Denominación': 'denominacion', // Nombre del cliente
  'Placa': 'placa',
  'Cajas': 'cajas',               // Cantidad de cajas (numérica)
  // 'Estatus' alimenta estado_transporte con DESPACHADO/ALISTADO/PENDIENTE
  // (valores del CHECK de la BD). El valor CANCELADO no entra en ese CHECK:
  // se traduce a estado_porteria='CANCELADO' (ver normalización en buildRows_).
  'Estatus': 'estado_transporte',
};

// Valor de la columna Estatus que cancela la llave en la app.
var CANCELAR_KEYWORD = 'CANCELADO';

/* ------------------------------- utilidades ------------------------------ */

function pad_(n) {
  return n < 10 ? '0' + n : '' + n;
}

/** Índice (0-based) de un encabezado en la fila de títulos, o -1 si no existe. */
function headerIndex_(headers, name) {
  return headers.indexOf(String(name).trim());
}

/** Normaliza un encabezado para comparar sin diferenciar mayúsculas, tildes ni espacios. */
function normalizeHeader_(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function dateToISO_(d) {
  return d.getFullYear() + '-' + pad_(d.getMonth() + 1) + '-' + pad_(d.getDate()) +
    'T' + pad_(d.getHours()) + ':' + pad_(d.getMinutes()) + ':00';
}

/** Convierte dd/mm/aaaa (o Date de Google) a fecha ISO a medianoche. */
function parseFecha_(val) {
  if (val instanceof Date) return dateToISO_(val);
  var s = String(val).trim();
  var m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (m) {
    var y = m[3].length === 2 ? '20' + m[3] : m[3];
    return y + '-' + pad_(+m[2]) + '-' + pad_(+m[1]) + 'T00:00:00';
  }
  return s; // Ya en ISO o formato desconocido: se envía tal cual.
}

/** Convierte dd/mm/aaaa hh:mm (o Date de Google) a ISO. */
function parseFechaHora_(val) {
  if (val instanceof Date) return dateToISO_(val);
  var s = String(val).trim();
  var m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})\s+(\d{1,2}):(\d{2})/);
  if (m) {
    var y = m[3].length === 2 ? '20' + m[3] : m[3];
    return y + '-' + pad_(+m[2]) + '-' + pad_(+m[1]) + 'T' + pad_(+m[4]) + ':' + m[5] + ':00';
  }
  return s;
}

/* ------------------------------- lectura ---------------------------------- */

function getConfig_() {
  var props = PropertiesService.getScriptProperties();
  return {
    url: props.getProperty('SUPABASE_URL'),
    key: props.getProperty('SUPABASE_SERVICE_KEY'), // Service Role
  };
}

function getSheet_() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  return ss.getSheetByName(SHEET_NAME) || ss.getSheets()[0];
}

/** Construye los objetos que se enviarán a la BD (una fila por (llave, placa)). */
function buildRows_() {
  var sheet = getSheet_();
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow < 2) return [];

  var values = sheet.getRange(1, 1, lastRow, lastCol).getValues();
  var headers = values[0].map(function (h) { return String(h).trim(); });

  // Mapa normalizado "encabezado normalizado" -> "campo BD" para que no importen
  // mayúsculas, tildes o espacios (ej: "Denominación" vs "Denominacion").
  var mappingNorm = {};
  Object.keys(MAPPING).forEach(function (h) {
    mappingNorm[normalizeHeader_(h)] = MAPPING[h];
  });

  // Todas las filas deben enviar EXACTAMENTE las mismas claves (PostgREST PGRST102).
  // Se inicia cada objeto con las claves mapeadas en null y se rellenan las no vacías.
  var dbFields = Object.keys(MAPPING).map(function (h) { return MAPPING[h]; });

  var rows = [];
  for (var r = 1; r < values.length; r++) {
    var obj = {};
    for (var f = 0; f < dbFields.length; f++) {
      obj[dbFields[f]] = null;
    }

    for (var c = 0; c < headers.length; c++) {
      var dbField = mappingNorm[normalizeHeader_(headers[c])];
      if (dbField) {
        var raw = values[r][c];
        if (raw === null || raw === undefined || raw === '') continue;

        var val;
        if (dbField === 'fecha_hora') {
          val = parseFecha_(raw);
        } else if (dbField === 'cita_cargue') {
          val = parseFechaHora_(raw);
        } else if (dbField === 'placa' || dbField === 'llave') {
          val = String(raw).toUpperCase().trim();
        } else if (dbField === 'cajas') {
          // NUMERIC en la BD: se envía como número (soporta "1.234" o "1234").
          var cajasNum = Number(String(raw).replace(/[.,]/g, '').trim());
          val = isFinite(cajasNum) ? Math.round(cajasNum) : null;
        } else if (dbField === 'estado_transporte') {
          // Estatus del fuente: solo DESPACHADO/ALISTADO/PENDIENTE (CHECK de la
          // BD). CANCELADO no está en el CHECK: se traduce a estado_porteria y
          // NO se envía en estado_transporte. Cualquier otro valor se ignora
          // (la BD aplica su DEFAULT 'ALISTADO').
          var est = String(raw).trim().toUpperCase();
          if (est === CANCELAR_KEYWORD) {
            obj.estado_porteria = 'CANCELADO';
            continue;
          }
          if (est !== 'DESPACHADO' && est !== 'ALISTADO' && est !== 'PENDIENTE') {
            continue;
          }
          val = est;
        } else {
          val = String(raw).trim();
        }

        obj[dbField] = val;
      }
    }

    // Solo se envían filas con llave (necesaria para el upsert por (llave,placa)).
    if (obj.llave) {
      // Las columnas NOT NULL con default (fecha_hora, placa, vehiculo_tipo,
      // transportadora) no deben llegar en null: se eliminan y la BD aplica su
      // DEFAULT. Como se envía fila a fila, no importa que varíen entre filas.
      Object.keys(obj).forEach(function (k) {
        if (obj[k] === null || obj[k] === '') delete obj[k];
      });
      // La placa SIEMPRE se envía (valor o ''): las filas se identifican por
      // (llave, placa); si se borra la placa en el Sheets, la BD la limpia y el
      // trigger devuelve la fila a PENDIENTE.
      if (!obj.placa) obj.placa = '';
      rows.push(obj);
    }
  }

  // DEDUPE POR (llave, placa): la clave de la fila es el par (llave, placa). Si el
  // Sheets repite el MISMO par (un camión/placa con varios transportes), se
  // fusionan: la placa guarda la SUMA de cajas de todas sus filas (cajas por
  // placa) y el resto de campos toma el ÚLTIMO valor no vacío. Placas DISTINTAS
  // de la misma llave son filas APARTE y se conservan tal cual.
  var dedup = {};
  var orden = [];
  for (var i = 0; i < rows.length; i++) {
    var filaActual = rows[i];
    var clave = filaActual.llave + '|' + (filaActual.placa || '');
    if (!Object.prototype.hasOwnProperty.call(dedup, clave)) {
      var copia = {};
      for (var k in filaActual) copia[k] = filaActual[k];
      dedup[clave] = copia;
      orden.push(clave);
    } else {
      var base = dedup[clave];
      for (var k2 in filaActual) {
        var v = filaActual[k2];
        if (k2 === 'cajas') {
          // SUMAR cajas de TODAS las filas del MISMO (llave, placa).
          base.cajas = (base.cajas || 0) + (v || 0);
        } else if (v !== null && v !== undefined && v !== '') {
          // Último valor no vacío gana (no se pisan datos con filas vacías).
          base[k2] = v;
        }
      }
    }
  }
  rows = [];
  for (var o = 0; o < orden.length; o++) {
    rows.push(dedup[orden[o]]);
  }
  return rows;
}

/* ---------------------------- sincronización ------------------------------ */

/**
 * Lee el Sheets y hace UPSERT a Supabase (inserta o actualiza por (llave, placa)).
 * Ejecutable a mano y usado por los disparadores onEdit/temporal.
 * Envía las filas AGRUPADAS: ahorra llamadas HTTP (cuota diaria de urlfetch).
 */
function syncTransportes() {
  var cfg = getConfig_();
  if (!cfg.url || !cfg.key) {
    throw new Error('Faltan SUPABASE_URL / SUPABASE_SERVICE_KEY en las propiedades del script.');
  }

  var rows = buildRows_();
  if (rows.length === 0) {
    Logger.log('syncTransportes: sin filas nuevas para enviar.');
    return 0;
  }

  var baseUrl = cfg.url.replace(/\/+$/, '') + '/rest/v1/' + TABLE + '?on_conflict=' + UNIQUE_KEY;
  var headers = {
    'apikey': cfg.key,
    'Authorization': 'Bearer ' + cfg.key,
    'Prefer': 'resolution=merge-duplicates,return=minimal',
    'Content-Type': 'application/json',
  };

  // AGRUPACIÓN POR FIRMA DE COLUMNAS. PostgREST exige que todas las filas de un
  // mismo POST lleven EXACTAMENTE las mismas claves (PGRST102). Como las filas
  // se normalizan en buildRows_ (solo se envían los campos con valor, más placa
  // siempre), cada fila trae su propio conjunto de columnas. Se agrupan
  // las que comparten la misma firma y se envía UN POST por grupo, en lugar de
  // uno por fila. Así una sincronización completa usa 1-3 llamadas HTTP en vez
  // de N (una por fila), evitando agotar la cuota diaria de urlfetch (~20k/día);
  // el temporal de 1 minuto deja de multiplicarlas por fila.
  var grupos = {};
  for (var i = 0; i < rows.length; i++) {
    var firma = Object.keys(rows[i]).sort().join(',');
    (grupos[firma] = grupos[firma] || []).push(rows[i]);
  }

  var firmas = Object.keys(grupos);
  var enviadas = 0;
  for (var g = 0; g < firmas.length; g++) {
    var lote = grupos[firmas[g]];
    var options = {
      method: 'post',
      contentType: 'application/json',
      headers: headers,
      payload: JSON.stringify(lote),
      muteHttpExceptions: true,
    };
    var res = UrlFetchApp.fetch(baseUrl, options);
    var code = res.getResponseCode();
    if (code >= 400) {
      throw new Error('Lote ' + (g + 1) + ' (firma: ' + firmas[g] + ') → Supabase respondió ' + code + ': ' + res.getContentText());
    }
    enviadas += lote.length;
  }

  Logger.log('syncTransportes: ' + enviadas + ' filas sincronizadas en ' + firmas.length + ' lotes (pares llave+placa).');
  return enviadas;
}

/* ---------------------- control de acceso: solo el admin ---------------- */

/**
 * Email del admin: Script Property ADMIN_EMAIL o la constante del encabezado.
 */
function adminEmail_() {
  var prop = PropertiesService.getScriptProperties().getProperty('ADMIN_EMAIL');
  return (prop && prop.trim()) ? prop.trim().toLowerCase() : ADMIN_EMAIL.toLowerCase();
}

/**
 * Email del usuario que está disparando el evento. En onEdit instalable el
 * evento trae `e.user` (email de quien editó); si no, se cae a la sesión.
 */
function usuarioEmail_(e) {
  try {
    if (e && e.user && e.user.getEmail) {
      var u = e.user.getEmail();
      if (u) return u.toLowerCase();
    }
  } catch (err) { /* sin email disponible */ }
  try {
    return (Session.getActiveUser().getEmail() || '').toLowerCase();
  } catch (err) {
    return '';
  }
}

/**
 * True si el usuario actual es el admin (cuenta dueña del Sheets).
 */
function esAdmin_(e) {
  return usuarioEmail_(e) === adminEmail_();
}

/**
 * Bloquea la edición/eliminación a los no-admin: revierte el cambio y muestra
 * un toast. Devuelve true si se bloqueó (para abortar el flujo de onEdit).
 * No toca la sincronización: solo antecede onEdit.
 * La barrera real contra editar/eliminar es protegerHoja() (permisos nativos);
 * este check solo es defensa y aviso. Si el email no se puede determinar, NO
 * se bloquea (para no dejar afuera al admin por fallo de detección).
 */
function bloquearNoAdmin_(e) {
  if (!e || !e.range) return false;

  var correo = usuarioEmail_(e);
  if (!correo) return false;   // sin email no se puede demostrar que es no-admin
  if (correo === adminEmail_()) return false; // es el admin: se permite

  var fila = e.range.getRow();
  var col = e.range.getColumn();

  // Restaurar el valor anterior de la(s) celda(s) editadas (o vacío si no existía).
  var anterior = (e.oldValue !== undefined && e.oldValue !== null) ? e.oldValue : '';
  try {
    e.range.setValue(anterior);
  } catch (err) {
    Logger.log('bloquearNoAdmin_: no se pudo revertir (' + err.message + ')');
  }

  try {
    e.source.toast(
      'Solo el admin puede editar o eliminar en este Sheets. Tu cambio fue revertido.',
      'Acceso restringido',
      40
    );
  } catch (err) {
    Logger.log('bloquearNoAdmin_: toast no disponible (' + err.message + ')');
  }

  Logger.log('bloquearNoAdmin_: cambio de no-admin revertido (celda ' + col + ',' + fila + ')');
  return true;
}

/**
 * Protege la hoja con permisos NATIVOS de Google: solo el admin queda como editor.
 * Esto bloquea modificar celdas, eliminar/insertar filas o columnas, etc.
 * Ejecutar UNA vez (como admin) para activar la protección.
 */
function protegerHoja() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEET_NAME) || ss.getSheets()[0];
  var admin = adminEmail_();

  var proteccion = sheet.protect().setWarningOnly(false); // bloquea de verdad
  var editores = proteccion.getEditors();
  for (var i = 0; i < editores.length; i++) {
    if (editores[i].getEmail().toLowerCase() !== admin) {
      proteccion.removeEditor(editores[i]);
    }
  }
  if (proteccion.canDomainEdit()) proteccion.setDomainEdit(false); // sin visitantes
  proteccion.addEditor(admin);
  proteccion.setDescription('Solo el admin puede editar/eliminar.');

  Logger.log('Hoja protegida. Solo puede editar: ' + admin);
  return proteccion.getProtectionType();
}

/** Disparador onEdit: cada cambio en el Sheets dispara la sincronización. */
function onEdit(e) {
  try {
    if (e && e.source) {
      // Control de acceso: los no-admin NO pueden editar ni eliminar.
      if (bloquearNoAdmin_(e)) return;

      var target = SpreadsheetApp.openById(SPREADSHEET_ID);
      if (e.source.getId() !== target.getId()) return;
      var sheet = e.source.getActiveSheet();
      if (sheet.getName() !== getSheet_().getName()) return;
    }
    syncTransportes();
  } catch (err) {
    Logger.log('onEdit error: ' + err.message);
  }
}

/** Crea los disparadores: onEdit + un respaldo temporal cada 1 minuto. */
function installTriggers() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  ScriptApp.getProjectTriggers().forEach(function (t) {
    ScriptApp.deleteTrigger(t);
  });

  ScriptApp.newTrigger('onEdit')
    .forSpreadsheet(ss)
    .onEdit()
    .create();

  ScriptApp.newTrigger('syncTransportes')
    .timeBased()
    .everyMinutes(1)
    .create();

  Logger.log('Disparadores creados: onEdit + cada 1 minuto.');
}

/**
 * Elimina TODOS los disparadores instalados del proyecto (onEdit + el temporal
 * de cada 1 minuto) mientras Power Automate (Excel 365) es el sync activo.
 * El resto del script queda intacto como respaldo:
 *   - syncTransportes() sigue siendo ejecutable a mano (botón ▶ en el editor).
 *   - Para REACTIVAR el respaldo cuando Power Automate falle, ejecutar:
 *       installTriggers();
 */
function uninstallTriggers() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    ScriptApp.deleteTrigger(t);
  });
  Logger.log('Disparadores eliminados. El sync queda a cargo de Power Automate (Excel 365).');
}
