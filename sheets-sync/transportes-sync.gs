/*****************************************************************************
 * CCL FLOW — Sincronización Google Sheets → Supabase (tabla "transportes")
 * ---------------------------------------------------------------------------
 * Lee la pestaña de operaciones del Sheets y hace UPSERT de cada fila en la
 * tabla TRANSPORTES de Supabase usando la columna "llave" como clave única.
 *
 * REGLA DE NEGOCIO (columna Y = Placa):
 *   Una LLAVE no puede repetirse en el Sheets con una PLACA distinta. Si en
 *   onEdit alguien introduce una llave que ya existe con otra placa, el cambio
 *   se REVIERTE al instante, se marca "CONFLICTO" en la columna Estatus, se
 *   pinta la fila y se muestra un toast. Esas llaves tampoco se sincronizan a
 *   la BD para no pisar la placa original.
 *
 * UN REGISTRO POR LLAVE:
 *   La BD guarda UN registro por llave. Si el Sheets tiene varias filas con la
 *   misma llave (captura por partes), se consolidan en un solo registro:
 *   las CAJAS se SUMAN y el resto de campos toma el último valor no vacío.
 *
 * CAMPOS PARA INFORMES (nuevos):
 *   - Transporte   → numero de pedido (col. "Transporte")
 *   - Denominación → nombre del cliente (col. "Denominación")
 *   - Cajas        → cantidad de cajas, se envía como número (col. "Cajas")
 *   Requieren haber creado las columnas en la BD:
 *   ALTER TABLE transportes
 *     ADD COLUMN IF NOT EXISTS transporte TEXT,
 *     ADD COLUMN IF NOT EXISTS denominacion TEXT,
 *     ADD COLUMN IF NOT EXISTS cajas NUMERIC DEFAULT 0;
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

// Encabezados relevantes para la regla de negocio:
// una LLAVE no puede repetirse con una PLACA distinta (columna Y en el Sheets).
var HEADER_LLAVE = 'Llave 2';
var HEADER_PLACA = 'Placa';   // columna Y
var HEADER_ESTATUS = 'Estatus';
// Marca escrita en la columna ESTATUS cuando se detecta el conflicto.
var MARCA_CONFLICTO = 'CONFLICTO';

// Cuenta de Google con permiso total para editar/eliminar en el Sheets.
// Se puede sobreescribir con la Script Property ADMIN_EMAIL (sin tocar código).
var ADMIN_EMAIL = 'appstractosas@gmail.com';

/*****************************************************************************
 * MAPEO DE COLUMNAS:  "Encabezado del Sheets"  ->  campo de la BD
 *****************************************************************************/
var MAPPING = {
  'Fecha': 'fecha_hora',          // dd/mm/aaaa
  'Llave 2': 'llave',             // clave única (upsert)
  'Vehículo': 'vehiculo_tipo',
  'Cita de cargue': 'cita_cargue',// dd/mm/aaaa hh:mm
  'Olt Inicial': 'transportadora',
  'Transporte': 'transporte',     // NÚMERO DE PEDIDO (no es placa ni vehículo)
  'Denominación': 'denominacion', // Nombre del cliente
  'Placa': 'placa',
  'Cajas': 'cajas',               // Cantidad de cajas (numérica)
  // 'Estatus' NO alimenta observaciones: solo se usa como señal de CANCELADO
  // (si la celda dice exactamente CANCELADO, la llave pasa a estado CANCELADO).
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

/* ------------------- regla: llave duplicada con placa distinta -------------- */

/**
 * Detecta llaves repetidas en el Sheets que tengan PLACA distinta (columna Y).
 * Devuelve un objeto: { llave: [placasNormalizadas, ...], ... }.
 * REGLA: el conflicto solo aplica entre DOS placas REALES distintas. Una fila
 * sin placa (vacía) no genera conflicto contra una que sí tiene placa, porque
 * la placa se digita fila por fila y una fila vacía es un "pendiente de
 * captura". Dos filas con la misma llave y el MISMO valor de placa (incluido
 * vacío) tampoco generan conflicto.
 */
function detectLlaveConflicto_(values, headers) {
  var normHeaders = headers.map(function (h) { return normalizeHeader_(h); });
  var iLlave = normHeaders.indexOf(normalizeHeader_(HEADER_LLAVE));
  var iPlaca = normHeaders.indexOf(normalizeHeader_(HEADER_PLACA));
  var conflictos = {};
  if (iLlave < 0 || iPlaca < 0) return conflictos;

  var visto = {};
  for (var r = 1; r < values.length; r++) {
    var llave = String(values[r][iLlave] || '').toUpperCase().trim();
    if (!llave) continue;
    var placa = String(values[r][iPlaca] || '').toUpperCase().trim();
    if (!visto[llave]) visto[llave] = {};
    // Solo las placas REALES cuentan como valor. Una fila sin placa (vacía) es
    // un "pendiente de captura" y no debe generar conflicto contra una fila que
    // sí tiene placa: se va digitando fila por fila.
    if (placa) visto[llave][placa] = true;
  }

  // Conflicto solo cuando existen DOS o MÁS placas reales distintas.
  Object.keys(visto).forEach(function (llave) {
    if (Object.keys(visto[llave]).length > 1) {
      conflictos[llave] = Object.keys(visto[llave]);
    }
  });
  return conflictos;
}

/**
 * Devuelve el mensaje de conflicto para la fila editada, o null si no hay.
 * Considera conflicto cuando la llave editada ya existe en OTRAS filas con un
 * valor de placa DISTINTO, y ambas son placas REALES (no vacías). Una fila sin
 * placa se deja pasar: la placa se digita fila por fila y una fila vacía es un
 * "pendiente de captura", no un duplicado real. `fila`/`col` son índices
 * 0-based dentro del arreglo `values` (con headers).
 */
function conflictoParaFila_(values, headers, fila, col) {
  var normHeaders = headers.map(function (h) { return normalizeHeader_(h); });
  var iLlave = normHeaders.indexOf(normalizeHeader_(HEADER_LLAVE));
  var iPlaca = normHeaders.indexOf(normalizeHeader_(HEADER_PLACA));
  if (iLlave < 0 || iPlaca < 0) return null;
  if (col !== iLlave && col !== iPlaca) return null;

  // Valores de la fila afectada por la edición.
  var llave = String(values[fila][iLlave] || '').toUpperCase().trim();
  if (!llave) return null;
  var placa = String(values[fila][iPlaca] || '').toUpperCase().trim();

  var filaOriginal = -1;
  var placaOriginal = '';
  for (var r = 1; r < values.length; r++) {
    if (r === fila) continue;
    if (String(values[r][iLlave] || '').toUpperCase().trim() !== llave) continue;
    var p = String(values[r][iPlaca] || '').toUpperCase().trim();
    if (p === placa) continue; // misma placa (incluidas ambas vacías): no genera conflicto
    // Si cualquiera de las dos filas está SIN placa, se deja pasar: la placa se
    // digita fila por fila y una fila vacía es un "pendiente de captura", no un
    // duplicado real. El conflicto solo aplica entre dos placas reales distintas.
    if (!p || !placa) continue;
    filaOriginal = r + 1;       // +1 por la fila de encabezados
    placaOriginal = p;
    break;
  }

  if (filaOriginal < 0) return null;
  return {
    llave: llave,
    placa: placa,
    placaOriginal: placaOriginal || '(sin placa)',
    filaOriginal: filaOriginal,
    fila: fila + 1,
  };
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

/** Construye los objetos que se enviarán a la BD (una fila por LLAVE). */
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

  // Llaves repetidas con placa distinta: NO se sincronizan para no pisar la BD.
  var conflictos = detectLlaveConflicto_(values, headers);
  if (Object.keys(conflictos).length) {
    Logger.log('buildRows_: llaves en conflicto omitidas (' + Object.keys(conflictos).join(', ') + ')');
  }

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
        } else {
          val = String(raw).trim();
        }

        obj[dbField] = val;
      } else if (normalizeHeader_(headers[c]) === normalizeHeader_(HEADER_ESTATUS)) {
        // Estatus ya no alimenta observaciones: solo cancela la llave si dice CANCELADO.
        var est = String(values[r][c] || '').trim().toUpperCase();
        if (est === CANCELAR_KEYWORD) obj.estado_porteria = 'CANCELADO';
      }
    }

    // Solo se envían filas con llave (necesaria para el upsert).
    if (obj[UNIQUE_KEY]) {
      // La llave está en conflicto por placa distinta: no se envía.
      if (conflictos[obj[UNIQUE_KEY]]) continue;
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

  // CONSOLIDACIÓN POR LLAVE: la BD guarda UN registro por llave. Como el
  // Sheets puede tener VARIAS filas con la misma llave (captura por partes),
  // se fusionan en un solo registro antes de enviar:
  //   - cajas  → se SUMAN: cada fila aporta parte de la carga total de la llave
  //              (ej: 3 filas con 10+15+20 → la BD guarda 45).
  //   - demás campos → gana el ÚLTIMO valor no vacío (una fila vacía no pisa
  //              valor previo: ni placa ni resto de datos), lo que coincide con
  //              el comportamiento del merge-duplicates del upsert.
  var consolidados = {};
  var ordenLlaves = [];
  for (var i = 0; i < rows.length; i++) {
    var filaActual = rows[i];
    var llaveActual = filaActual[UNIQUE_KEY];
    if (!Object.prototype.hasOwnProperty.call(consolidados, llaveActual)) {
      var copia = {};
      for (var k in filaActual) copia[k] = filaActual[k];
      consolidados[llaveActual] = copia;
      ordenLlaves.push(llaveActual);
    } else {
      var base = consolidados[llaveActual];
      for (var k2 in filaActual) {
        var v = filaActual[k2];
        if (k2 === 'cajas') {
          // SUMAR cajas de todas las filas de la misma llave.
          base.cajas = (base.cajas || 0) + (v || 0);
        } else if (v !== null && v !== undefined && v !== '') {
          // Último valor no vacío gana (no se pisan datos con filas vacías).
          base[k2] = v;
        }
      }
    }
  }
  rows = [];
  for (var o = 0; o < ordenLlaves.length; o++) {
    rows.push(consolidados[ordenLlaves[o]]);
  }
  return rows;
}

/* ---------------------------- sincronización ------------------------------ */

/**
 * Lee el Sheets y hace UPSERT a Supabase (inserta o actualiza por LLAVE).
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
  // mismo POST lleven EXACTAMENTE las mismas claves (PGRST102). Como las llaves
  // vacías ya se eliminaron en buildRows_ (solo se envían los campos con valor,
  // más placa siempre), cada fila trae su propio conjunto de columnas. Se agrupan
  // las que comparten la misma firma y se envía UN POST por grupo, en lugar de
  // uno por llave. Así una sincronización completa usa 1-3 llamadas HTTP en vez
  // de N (una por llave), evitando agotar la cuota diaria de urlfetch (~20k/día);
  // el temporal de 1 minuto deja de multiplicarlas por llave.
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

  Logger.log('syncTransportes: ' + enviadas + ' filas sincronizadas en ' + firmas.length + ' lotes (llaves).');
  return enviadas;
}

/**
 * Validación de la regla: si la edición introduce una LLAVE repetida con una
 * PLACA distinta (columna Y), revierte el cambio, marca CONFLICTO en la
 * columna Estatus y notifica al usuario con un toast (sin enviar a la BD).
 * `e` es el evento onEdit; `ss` la SpreadsheetApp (target ya verificado).
 * Devuelve true si hubo conflicto (para no sincronizar esa fila).
 */
function aplicarReglaDuplicadoPlaca_(e, ss) {
  if (!e || !e.range) return false;
  var sheet = e.source.getActiveSheet();
  if (sheet.getName() !== getSheet_().getName()) return false;

  var fila = e.range.getRow();
  var col = e.range.getColumn();
  if (fila < 2 || col < 1) return false;

  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow < 2) return false;

  var values = sheet.getRange(1, 1, lastRow, lastCol).getValues();
  var headers = values[0].map(function (h) { return String(h).trim(); });

  // Índice (0-based) de la columna editada y de la columna Estatus.
  var normHeaders = headers.map(function (h) { return normalizeHeader_(h); });
  var iEstatus = normHeaders.indexOf(normalizeHeader_(HEADER_ESTATUS));

  var conflicto = conflictoParaFila_(values, headers, fila - 1, col - 1);
  if (!conflicto) return false;

  // 1) Revertir la celda editada a su valor anterior (o vacío si no existía).
  var anterior = (e.oldValue !== undefined && e.oldValue !== null) ? e.oldValue : '';
  e.range.setValue(anterior);

  // 2) Marcar CONFLICTO en la columna Estatus de la fila afectada.
  if (iEstatus >= 0) {
    sheet.getRange(fila, iEstatus + 1).setValue(
      MARCA_CONFLICTO + ': llave ' + conflicto.llave + ' con placa ' + conflicto.placa +
      ' repetida (ya existe placa ' + conflicto.placaOriginal + ' fila ' + conflicto.filaOriginal + ')'
    );
  }

  // 3) Notificación visual para la persona que cometió el error.
  ss.toast(
    'La llave ' + conflicto.llave + ' ya está registrada con la placa ' +
    conflicto.placaOriginal + ' (fila ' + conflicto.filaOriginal + '). ' +
    'Se revertió el cambio y no se sincronizará.',
    MARCA_CONFLICTO,
    40
  );

  // 4) Se colorean los encabezados/celda afectados para que quede visible.
  sheet.getRange(fila, 1, 1, lastCol).setBackground('#f4c7c3');

  Logger.log('Duplicado bloqueado: ' + JSON.stringify(conflicto));
  return true;
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
 * No toca las reglas de CONFLICTO ni la sincronización: solo antecede onEdit.
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

      // Regla: bloquear llave repetida con placa distinta (columna Y).
      var bloqueado = aplicarReglaDuplicadoPlaca_(e, e.source);
      if (bloqueado) return; // no se sincroniza la fila con conflicto
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
