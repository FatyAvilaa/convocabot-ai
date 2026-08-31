const CACHE_EXPIRACION = 21600; // 6 horas

function obtenerSesion(telefono) {
  // primero intenta el caché rápido
  const cache = CacheService.getScriptCache();
  const enCache = cache.get('SES_' + telefono);
  if (enCache) {
    try { return JSON.parse(enCache); } catch(e) {}
  }

  // si no está en caché busca en Sheets
  const ss = SpreadsheetApp.openById(CONFIG.ID_HOJA_MATRIZ);
  const hoja = ss.getSheetByName('Sesiones');
  if (!hoja) return null;

  const datos = hoja.getDataRange().getValues();
  const fila = datos.find(f => String(f[0]) === String(telefono));
  if (!fila || !fila[1]) return null;

  try {
    const sesion = JSON.parse(fila[1]);
    // restaurar en caché
    cache.put('SES_' + telefono, fila[1], CACHE_EXPIRACION);
    return sesion;
  } catch(e) { return null; }
}

function guardarSesion(telefono, sesion) {
  const json = JSON.stringify(sesion);

  // guardar en caché primero (rápido)
  CacheService.getScriptCache().put('SES_' + telefono, json, CACHE_EXPIRACION);

  // guardar en Sheets como respaldo (persistente)
  const ss = SpreadsheetApp.openById(CONFIG.ID_HOJA_MATRIZ);
  let hoja = ss.getSheetByName('Sesiones');
  if (!hoja) {
    hoja = ss.insertSheet('Sesiones');
    hoja.appendRow(['telefono', 'sesion_json', 'ultima_actividad']);
  }

  const datos = hoja.getDataRange().getValues();
  const filaIdx = datos.findIndex(f => String(f[0]) === String(telefono));
  const ahora = new Date().toISOString();

  if (filaIdx <= 0) {
    hoja.appendRow([telefono, json, ahora]);
  } else {
    hoja.getRange(filaIdx + 1, 2, 1, 2).setValues([[json, ahora]]);
  }
}

function limpiarSesion(telefono) {
  CacheService.getScriptCache().remove('SES_' + telefono);

  const ss = SpreadsheetApp.openById(CONFIG.ID_HOJA_MATRIZ);
  const hoja = ss.getSheetByName('Sesiones');
  if (!hoja) return;

  const datos = hoja.getDataRange().getValues();
  const filaIdx = datos.findIndex(f => String(f[0]) === String(telefono));
  if (filaIdx > 0) {
    hoja.getRange(filaIdx + 1, 2, 1, 2).setValues([['', '']]);
  }
}