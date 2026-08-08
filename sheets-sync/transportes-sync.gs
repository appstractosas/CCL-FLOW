/*****************************************************************************
 * CCL FLOW — Sincronización Google Sheets → Supabase (tabla "transportes")
 * ---------------------------------------------------------------------------
 * Lee la pestaña de operaciones del Sheets y hace UPSERT de cada fila en la
 * tabla TRANSPORTES de Supabase usando la columna "llave" como clave única.
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
var UNIQUE_KEY = 'llave';

/*****************************************************************************
 * MAPEO DE COLUMNAS:  "Encabezado del Sheets"  ->  campo de la BD
 *****************************************************************************/
var MAPPING = {
  'Fecha': 'fecha_hora',          // dd/mm/aaaa
  'Llave 2': 'llave',             // clave única (upsert)
  'Vehículo': 'vehiculo_tipo',
  'MUELLE': 'muelle_asignado',
  'Cita de cargue': 'cita_cargue',// dd/mm/aaaa hh:mm
  'Olt Inicial': 'transportadora',
  'Placa': 'placa',
  // 'Estatus' NO alimenta observaciones: solo se usa como señal de CANCELADO
  // (si la celda dice exactamente CANCELADO, la llave pasa a estado CANCELADO).
};

// Valor de la columna Estatus que cancela la llave en la app.
var CANCELAR_KEYWORD = 'CANCELADO';

/* ------------------------------- utilidades ------------------------------ */

function pad_(n) {
  return n < 10 ? '0' + n : '' + n;
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

/** Normaliza el muelle del Sheets al catálogo de la app (Muelle 1..12, MUELLE CERO). */
function normalizeMuelle_(val) {
  var s = String(val).trim();
  var m = s.match(/^MUELLE\s+(\d{1,2})$/i);
  if (m) return 'Muelle ' + (+m[1]);
  var n = s.match(/^(\d{1,2})$/);
  if (n) return 'Muelle ' + (+n[1]);
  if (/^MUELLE\s*CERO$/i.test(s)) return 'MUELLE CERO';
  return s.toUpperCase();
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

/** Construye los objetos que se enviarán a la BD (una fila por LLAVE). */
function buildRows_() {
  var sheet = getSheet_();
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow < 2) return [];

  var values = sheet.getRange(1, 1, lastRow, lastCol).getValues();
  var headers = values[0].map(function (h) { return String(h).trim(); });

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
      var dbField = MAPPING[headers[c]];
      if (dbField) {
        var raw = values[r][c];
        if (raw === null || raw === undefined || raw === '') continue;

        var val;
        if (dbField === 'fecha_hora') {
          val = parseFecha_(raw);
        } else if (dbField === 'cita_cargue') {
          val = parseFechaHora_(raw);
        } else if (dbField === 'muelle_asignado') {
          val = normalizeMuelle_(raw);
        } else if (dbField === 'placa' || dbField === 'llave') {
          val = String(raw).toUpperCase().trim();
        } else {
          val = String(raw).trim();
        }

        obj[dbField] = val;
      } else if (headers[c] === 'Estatus') {
        // Estatus ya no alimenta observaciones: solo cancela la llave si dice CANCELADO.
        var est = String(values[r][c] || '').trim().toUpperCase();
        if (est === CANCELAR_KEYWORD) obj.estado_porteria = 'CANCELADO';
      }
    }

    // Solo se envían filas con llave (necesaria para el upsert).
    if (obj[UNIQUE_KEY]) {
      // Las columnas NOT NULL con default (fecha_hora, placa, vehiculo_tipo,
      // transportadora) no deben llegar en null: se eliminan y la BD aplica su
      // DEFAULT. Como se envía fila a fila, no importa que varíen entre filas.
      Object.keys(obj).forEach(function (k) {
        if (obj[k] === null || obj[k] === '') delete obj[k];
      });
      // La placa SIEMPRE se envía (valor o ''): si se borra la placa en el
      // Sheets, la BD la limpia y el trigger devuelve la llave a PENDIENTE.
      if (!obj.placa) obj.placa = '';
      rows.push(obj);
    }
  }
  return rows;
}

/* ---------------------------- sincronización ------------------------------ */

/**
 * Lee el Sheets y hace UPSERT a Supabase (inserta o actualiza por LLAVE).
 * Ejecutable a mano y usado por los disparadores onEdit/temporal.
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

  // Se envía UNA fila a la vez: evita el error PGRST102 (todas las claves
  // deben ser idénticas) y permite que celdas vacías no rompan la sincronización.
  var enviadas = 0;
  for (var i = 0; i < rows.length; i++) {
    var options = {
      method: 'post',
      contentType: 'application/json',
      headers: headers,
      payload: JSON.stringify(rows[i]),
      muteHttpExceptions: true,
    };
    var res = UrlFetchApp.fetch(baseUrl, options);
    var code = res.getResponseCode();
    if (code >= 400) {
      throw new Error('Fila ' + (i + 1) + ' (' + rows[i][UNIQUE_KEY] + ') → Supabase respondió ' + code + ': ' + res.getContentText());
    }
    enviadas++;
  }

  Logger.log('syncTransportes: ' + enviadas + ' filas sincronizadas (llaves).');
  return enviadas;
}

/** Disparador onEdit: cada cambio en el Sheets dispara la sincronización. */
function onEdit(e) {
  try {
    if (e && e.source) {
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
