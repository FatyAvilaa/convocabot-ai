const VERIFY_TOKEN_WH = PropertiesService.getScriptProperties().getProperty('VERIFY_TOKEN');

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const entry = body.entry?.[0]?.changes?.[0]?.value;

    if (!entry?.messages) {
      return ContentService.createTextOutput(JSON.stringify({ status: 'ok' })).setMimeType(ContentService.MimeType.JSON);
    }

    const msg = entry.messages[0];

    const cache = CacheService.getScriptCache();
    const claveMsg = 'msg_' + msg.id;
    if (cache.get(claveMsg)) {
      console.log('Webhook duplicado ignorado: ' + msg.id);
      return ContentService.createTextOutput(JSON.stringify({ status: 'ok' })).setMimeType(ContentService.MimeType.JSON);
    }
    cache.put(claveMsg, '1', 600); // 10 minutos es más que suficiente

    const telefono = msg.from;
    const sesion = obtenerSesion(telefono);

    let identificador = telefono;
    let limiteMb = 5;
    let permitePdf = true;
    let permiteImg = true;
    let esPreguntaArchivo = false;

    // Obtener la configuración exacta de la pregunta en curso
    if (sesion && sesion.todasLasPreguntas && sesion.respuestas) {
      const curpPregunta = sesion.todasLasPreguntas.find(q => q.tipo === 'CURP');
      if (curpPregunta && sesion.respuestas[curpPregunta.id]) {
        identificador = sesion.respuestas[curpPregunta.id];
      }

      if (sesion.preguntasActivas && sesion.paso !== undefined) {
        const idActual = sesion.preguntasActivas[sesion.paso];
        const pregActual = sesion.todasLasPreguntas.find(q => q.id === idActual);
        
        if (pregActual && pregActual.tipo === 'ARCHIVO') {
          esPreguntaArchivo = true;
          if (pregActual.configArchivo) {
            limiteMb = pregActual.configArchivo.pesoMaxMb || 5;
            permitePdf = pregActual.configArchivo.permitirPdf;
            permiteImg = pregActual.configArchivo.permitirImagenes;
          }
        }
      }
    }

    if (msg.type === 'text' && msg.text?.body) {
      procesarMensaje(telefono, msg.text.body.trim());

    } else if (msg.type === 'image' && msg.image?.id) {
      if (!esPreguntaArchivo) {
        enviarMensaje(telefono, '❌ En este paso necesito que respondas con texto o selecciones una opción, no envíes imágenes.');
        return ContentService.createTextOutput(JSON.stringify({ status: 'ok' })).setMimeType(ContentService.MimeType.JSON);
      }
      if (!permiteImg) {
        enviarMensaje(telefono, '❌ Formato incorrecto. Esta sección solo acepta documentos en formato *PDF*.');
        return ContentService.createTextOutput(JSON.stringify({ status: 'ok' })).setMimeType(ContentService.MimeType.JSON);
      }

      const folderId = sesion ? obtenerCarpetaArchivoSesion(sesion) : null;
      const url = descargarMediaWA(msg.image.id, msg.image.mime_type, identificador, folderId, limiteMb);
      
      if (url === 'ARCHIVO_MUY_PESADO') enviarMensaje(telefono, `❌ Tu imagen supera el límite de ${limiteMb} MB. Por favor, redúcele el tamaño y envíala de nuevo.`);
      else if (url === 'ERROR_ARCHIVO') enviarMensaje(telefono, '❌ Hubo un error al guardar tu imagen.');
      else procesarMensaje(telefono, url);

    } else if (msg.type === 'document' && msg.document?.id) {
      if (!esPreguntaArchivo) {
        enviarMensaje(telefono, '❌ En este paso necesito que respondas con texto o selecciones una opción, no envíes documentos.');
        return ContentService.createTextOutput(JSON.stringify({ status: 'ok' })).setMimeType(ContentService.MimeType.JSON);
      }
      if (!permitePdf || msg.document.mime_type !== 'application/pdf') {
        enviarMensaje(telefono, '❌ Formato incorrecto. Esta sección solo acepta *Fotografías/Imágenes*. No envíes archivos PDF.');
        return ContentService.createTextOutput(JSON.stringify({ status: 'ok' })).setMimeType(ContentService.MimeType.JSON);
      }

      const folderId = sesion ? obtenerCarpetaArchivoSesion(sesion) : null;
      const url = descargarMediaWA(msg.document.id, msg.document.mime_type, identificador, folderId, limiteMb);
      
      if (url === 'ARCHIVO_MUY_PESADO') enviarMensaje(telefono, `❌ Tu documento supera el límite de ${limiteMb} MB. Por favor, comprímelo y envíalo de nuevo.`);
      else if (url === 'ERROR_ARCHIVO') enviarMensaje(telefono, '❌ Hubo un error al guardar tu documento.');
      else procesarMensaje(telefono, url);

    } else if (msg.type === 'interactive') {
      const respuesta = msg.interactive?.button_reply?.id || msg.interactive?.list_reply?.id || '';
      if (respuesta) procesarMensaje(telefono, respuesta);

    } else if (msg.type === 'unsupported') {
      enviarMensaje(telefono, 'No pude procesar ese tipo de mensaje. Por favor envía texto, una imagen o un PDF.');
    }

  } catch(err) {
    console.log('Error en doPost: ' + err.message);
  }

  return ContentService.createTextOutput(JSON.stringify({ status: 'ok' })).setMimeType(ContentService.MimeType.JSON);
}

function obtenerCarpetaArchivoSesion(sesion) {
  try {
    if (!sesion?.preguntasActivas || !sesion?.paso) return null;
    const idPreguntaActual = sesion.preguntasActivas[sesion.paso];
    if (!idPreguntaActual) return null;

    const ss = SpreadsheetApp.openById(CONFIG.ID_HOJA_MATRIZ);
    const hoja = ss.getSheetByName('MapaCarpetas');
    if (!hoja) return null;

    const datos = hoja.getDataRange().getValues();
    const fila = datos.find(f => String(f[0]) === String(sesion.convId) && String(f[1]) === String(idPreguntaActual));
    return fila ? fila[3] : null;
  } catch(e) {
    return null;
  }
}

function descargarMediaWA(mediaId, mimeType, identificador, folderId, limiteMb) {
  const token = PropertiesService.getScriptProperties().getProperty('WA_TOKEN');

  try {
    // 1. Obtener los metadatos desde Meta (incluye el tamaño)
    const urlMeta = `https://graph.facebook.com/v19.0/${mediaId}`;
    const resMeta = UrlFetchApp.fetch(urlMeta, {
      headers: { 'Authorization': 'Bearer ' + token },
      muteHttpExceptions: true
    });
    const metaJson = JSON.parse(resMeta.getContentText());

    // 2. Verificar el peso ANTES de descargar el archivo a tu Drive
    const limiteBytes = limiteMb * 1024 * 1024;
    if (metaJson.file_size && metaJson.file_size > limiteBytes) {
      return 'ARCHIVO_MUY_PESADO';
    }

    // 3. Descargar el archivo
    const mediaUrl = metaJson.url;
    const resArchivo = UrlFetchApp.fetch(mediaUrl, {
      headers: { 'Authorization': 'Bearer ' + token },
      muteHttpExceptions: true
    });

    const ext = mimeType.includes('pdf') ? '.pdf' : mimeType.includes('jpeg') ? '.jpg' : mimeType.includes('png') ? '.png' : '';

    let carpetaDestino = DriveApp.getRootFolder();
    if (folderId) {
      try { carpetaDestino = DriveApp.getFolderById(folderId); } catch(e) {}
    }

    let contador = 1;
    const archivosExistentes = carpetaDestino.searchFiles("title contains '" + identificador + "'");
    while (archivosExistentes.hasNext()) {
      archivosExistentes.next();
      contador++;
    }

    const nombreFinal = identificador + '_' + contador + ext;
    const blob = resArchivo.getBlob().setName(nombreFinal);

    const archivo = carpetaDestino.createFile(blob);
    archivo.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return archivo.getUrl();

  } catch(err) {
    console.log('Error descargando media: ' + err.message);
    return 'ERROR_ARCHIVO';
  }
}