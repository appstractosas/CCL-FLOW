/*****************************************************************************
 * CCL FLOW — Sincronización Google Sheets → Supabase (tabla "transportes")
 * ---------------------------------------------------------------------------
 * RESPALDO / BACKUP — La fuente principal es Power Automate (Excel 365).
 * Este script se mantiene como respaldo y se ejecuta SOLO si falla el PA.
 * ---------------------------------------------------------------------------
 * Lee la pestaña de operaciones del Sheets y hace UPSERT de cada fila en la
 * tabla TRANSPORTES de Supabase usando el par (llave, placa) como clave.
 *
 * REGLA DE NEGOCIO (confirmada):
 *   Una LLAVE puede tener VARIAS PLACAS (cada placa = UNA FILA en la BD y en el
 *   Sheets). Las CAJAS se registran POR PLACA, no se suman por llave.
 *   Un TRANSPORTE (nº pedido) PUEDE pertenecer a DISTINTAS llaves
 *   (el trigger de unicidad por transporte fue eliminado en BD v2026-09-24).
 *   Dentro de la MISMA llave puede repetirse si el pedido se reparte en
 *   varias placas.
 *
 * CLAVE (llave, placa_origen):
 *   El RPC identifica la fila por (llave, placa_origen), donde placa_origen es
 *   la placa del Sheets (clave ESTABLE). La columna `placa` de la BD NO se pisa
 *   en el UPDATE: la app puede editarla sin que el sync la revierta ni
 *   duplique la llave. Si el Sheets repite el MISMO par llave+placa (un
 *   camión/placa con varios transportes), esas filas se fusionan en UN
 *   registro: las CAJAS se SUMAN por placa (mismo tratamiento: [.,] + ROUND) y
 *   el resto de campos toma el último valor no vacío. Una placa distinta de la
 *   misma llave es UNA FILA aparte y se sincroniza sin problema.
 *   placa '' (PENDIENTE) es válida: una llave no puede tener dos filas sin
 *   placa (la BD lo rechaza con UNIQUE (llave, placa)). Cada corrida refresca
 *   las CAJAS del par con el total del Sheets (el fuente manda), salvo cuando la fila tiene cajas_manual (editadas en la app): el
 *   RPC conserva el valor capturado hasta que el Sheets trae ese mismo número.
 *   Cuando el Sheets asigna la placa a una fila que venía vacía el RPC elimina
 *   el huérfano (llave,'') de esa llave (regla de fusión sin doble conteo, ver
 *   migracion-rpc-sync-transportes.sql).
 *
 * RPC SYNC_TRANSPORTES (v2):
 *   - Si (llave, placa_origen) YA EXISTE → UPDATE esa fila (persiste cambios).
 *   - Si llave existe pero placa_origen es NUEVA → INSERT normal (nueva placa).
 *   - Si llave NO existe → INSERT normal (primera vez).
 *   - Permite mismo transporte en distintas llaves (sin error).
 *   - buildRows_ envía las últimas MAX_FILAS filas del Sheets (una por línea);
 *     el RPC consolida el upsert por (llave, placa) y aplica el full sync por
 *     _fecha (hoy, zona America/Bogota).
 *
 * CAMPOS PARA INFORMES:
 *   - Transporte   → numero de pedido (col. "Transporte")
 *   - Denominación → nombre del cliente (col. "Denominación")
 *   - Cajas        → cantidad de cajas, se envía como número (col. "Cajas")
 *   - Destino      → ciudad/planta de destino (col. "Destino")
 *   Requieren haber creado las columnas en la BD
 *   (destino: ver supabase-migracion-destino-kg.sql):
 *     ALTER TABLE transportes
 *       ADD COLUMN IF NOT EXISTS transporte TEXT,
 *       ADD COLUMN IF NOT EXISTS denominacion TEXT,
 *       ADD COLUMN IF NOT EXISTS cajas NUMERIC DEFAULT 0,
 *       ADD COLUMN IF NOT EXISTS destino TEXT;
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
var SHEET_NAME = 'CONSOLIDADO'; // Nombre exacto de la pestaña de operaciones.
var HEADER_CAJAS = 'Cajas originales'; // Nombre exacto de la columna de cajas
var TABLE = 'transportes';
// Clave del UPSERT: el par (llave, placa_origen) identifica la fila.
var UNIQUE_KEY = 'llave,placa_origen';
// Máximo de filas de datos a leer desde el final de la hoja (lo más nuevo está
// abajo). Acota el costo de ejecución cuando la hoja tiene miles de filas.
var MAX_FILAS = 200;

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
  'Olt': 'transportadora',
  'Transporte': 'transporte',     // NÚMERO DE PEDIDO (no es placa ni vehículo)
  'Denominación': 'denominacion', // Nombre del cliente
  'Placa': 'placa',
  'Cajas originales': 'cajas',               // Cantidad de cajas (numérica)
  'KG': 'kg',                     // Peso en KG (numérica, INFORMATIVA)
  'MTS': 'mts',                   // Metros (numérica, INFORMATIVA)
  'Destino': 'destino',           // Ciudad/planta de destino del pedido
  'Region': 'region',             // Región del pedido (region en la BD)
  // 'Cita de entrega' es un campo transitorio: NO se guarda como columna
  // escalar; alimenta la columna detalle_llave (jsonb) del RPC, que el modal de
  // detalle de Planeación lee para mostrar las líneas de la llave.
  'Cita de entrega': 'cita_entrega',
  // "Estado mercancia" alimenta estado_transporte con DESPACHADO/ALISTADO/
  // EN PROCESO (valores que acepta el RPC). El valor CANCELADO no entra en ese
  // CHECK: el RPC lo detecta por la clave 'estatus' y lo traduce a
  // estado_porteria='CANCELADO' (ver normalización en buildRows_). Se usa la
  // clave 'estatus' (no 'estado_transporte') porque es la única que lee el RPC
  // para cancelar y coincide con lo que envía Power Automate.
  'Estado mercancia': 'estatus',
};

// Valor de la columna "Estado mercancia" que cancela la llave en la app.
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

/* ------------------------------- LECTURA ---------------------------------- */

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

  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0]
    .map(function (h) { return String(h).trim(); });

  // La hoja puede tener filas de relleno vacías al final: getLastRow() apunta a
  // ellas y la ventana de las últimas MAX_FILAS filas caería sobre filas SIN
  // llave (0 filas útiles). Se ubica la ÚLTIMA fila CON llave y la ventana
  // termina ahí.
  var lastDataRow = lastRow;
  var llaveCol = headerIndex_(headers, HEADER_LLAVE);
  if (llaveCol >= 0) {
    var llaveVals = sheet.getRange(1, llaveCol + 1, lastRow, 1).getValues();
    for (var i = llaveVals.length - 1; i >= 1; i--) {
      if (String(llaveVals[i][0]).trim() !== '') { lastDataRow = i + 1; break; }
    }
  }
  if (lastDataRow < 2) return [];

  // Solo se leen las últimas MAX_FILAS filas de datos (lo más nuevo está abajo):
  // evita que la ejecución se ralentice con miles de filas. Los encabezados
  // (fila 1) se leen aparte porque quedan fuera de la ventana.
  var firstDataRow = Math.max(2, lastDataRow - MAX_FILAS + 1);
  var nRows = lastDataRow - firstDataRow + 1;
  var values = sheet.getRange(firstDataRow, 1, nRows, lastCol).getValues();

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
  for (var r = 0; r < values.length; r++) {
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
          val = String(raw).toUpperCase().trim().replace(/\s+/g, '');
          if (dbField === 'placa' && val === '') val = '';
        } else if (dbField === 'cajas' || dbField === 'kg' || dbField === 'mts') {
          // NUMERIC en la BD: se envía como número (soporta "1.234" o "1234").
          var num = Number(String(raw).replace(/[.,]/g, '').trim());
          val = isFinite(num) ? Math.round(num) : null;
        } else if (dbField === 'estatus') {
          // "Estado mercancia": se envía bajo la clave 'estatus' (no
          // 'estado_transporte') para que el RPC detecte CANCELADO y ponga
          // estado_porteria='CANCELADO'. Valores aceptados: DESPACHADO/ALISTADO/
          // EN PROCESO + CANCELADO. Cualquier otro se ignora (la BD aplica su
          // DEFAULT 'ALISTADO').
          var est = String(raw).trim().toUpperCase();
          if (est !== CANCELAR_KEYWORD && est !== 'DESPACHADO' &&
              est !== 'ALISTADO' && est !== 'EN PROCESO') {
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

  // NO se deduplica aquí: se envían TODAS las filas leídas (una por línea).
  // El RPC consolida el upsert por (llave, placa) (último valor no vacío + SUMA
  // de cajas) y arma detalle_llave con TODAS las líneas del origen.

return rows; // Sin filtro de contenido: sube las últimas MAX_FILAS filas leídas
}

/* ---------------------------- sincronización ------------------------------ */

/**
 * Lee las últimas MAX_FILAS del Sheets y hace FULL SYNC (upsert + delete) vía
 * RPC sync_transportes_full(_filas, _fecha).
 * El RPC limpia/resetea en BD las filas de HOY que NO están en el payload.
 */
function syncTransportes() {
  var cfg = getConfig_();
  if (!cfg.url || !cfg.key) {
    throw new Error('Faltan SUPABASE_URL / SUPABASE_SERVICE_KEY en las propiedades del script.');
  }

  var rows = buildRows_();
  if (rows.length === 0) {
    Logger.log('syncTransportes: sin filas de hoy para enviar.');
    return 0;
  }

  var hoy = Utilities.formatDate(new Date(), 'America/Bogota', 'yyyy-MM-dd');

  // Usa la función RPC sync_transportes_full (full sync con deletes).
  var baseUrl = cfg.url.replace(/\/+$/, '') + '/rest/v1/rpc/sync_transportes_full';
  var headers = {
    'apikey': cfg.key,
    'Authorization': 'Bearer ' + cfg.key,
    'Content-Type': 'application/json',
  };

  var payload = JSON.stringify({
    _filas: rows,
    _fecha: hoy
  });

  var options = {
    method: 'post',
    contentType: 'application/json',
    headers: headers,
    payload: payload,
    muteHttpExceptions: true,
  };

  var res = UrlFetchApp.fetch(baseUrl, options);
  var code = res.getResponseCode();
  if (code >= 400) {
    throw new Error('syncTransportes_full RPC → Supabase respondió ' + code + ': ' + res.getContentText());
  }

  Logger.log('syncTransportes: ' + rows.length + ' filas sincronizadas vía RPC sync_transportes_full (full sync con deletes).');
  return rows.length;
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

/**
 * Crea el disparador temporal: sincroniza cada 5 minutos desde el Sheets.
 * NO instala onEdit (evita que cada edición dispare el sync inmediatamente).
 */
function installTriggers() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  ScriptApp.getProjectTriggers().forEach(function (t) {
    ScriptApp.deleteTrigger(t);
  });

  ScriptApp.newTrigger('syncTransportes')
    .timeBased()
    .everyMinutes(5)
    .create();

  Logger.log('Disparador creado: syncTransportes cada 5 minutos (sin onEdit).');
}

/**
 * Elimina TODOS los disparadores instalados del proyecto (el temporal de 5
 * minutos) mientras Power Automate (Excel 365) es el sync activo.
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