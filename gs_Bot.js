/*******************************************************
 * gs_Bot.gs — Motor de conversación SMA
 * VERSIÓN CORREGIDA — ver notas "// FIX:" para cada cambio
 *******************************************************/

const BOT_CONFIG = {
  MAX_INTENTOS_FALLIDOS: 3,
  TIMEOUT_SESION_HORAS: 6,
};

/*******************************************************
 * PUNTO DE ENTRADA PRINCIPAL
 *******************************************************/
function procesarMensaje(telefono, texto, tipoArchivo) {
  const textoNorm = texto ? texto.toUpperCase().trim() : '';

  // ── Comandos globales ──────────────────────────────
  if (textoNorm === 'CANCELAR') {
    limpiarSesion(telefono);
    enviarMensaje(telefono,
      '❌ Registro cancelado.\n\n' +
      'Escribe cualquier mensaje para comenzar de nuevo cuando quieras.'
    );
    return;
  }

  if (textoNorm === 'AYUDA') {
    enviarMensaje(telefono,
      '🌿 *Sistema de Registro — SMA Tlaxcala*\n\n' +
      'Comandos disponibles:\n\n' +
      '• Escribe cualquier mensaje para *iniciar un registro*\n' +
      '• *ESTATUS [folio]* — consulta el estado de tu trámite\n' +
      '• *CANCELAR* — cancela el registro en curso\n' +
      '• *CONTINUAR* — retoma un registro pendiente\n' +
      '• *AYUDA* — muestra este menú'
    );

    // FIX: si hay un registro en curso, recordamos cuál era la pregunta
    // pendiente. Antes, escribir AYUDA a mitad del flujo dejaba al usuario
    // "perdido": su siguiente mensaje normal se evaluaba contra la pregunta
    // que ya estaba pendiente (sin volver a verla), y parecía un error random.
    const sesionEnCurso = obtenerSesion(telefono);
    if (
      sesionEnCurso &&
      !sesionEnCurso.expirada &&
      !sesionExpirada(sesionEnCurso) &&
      !sesionEnCurso.esperandoConvocatoria
    ) {
      const preguntaPendiente = sesionEnCurso.todasLasPreguntas.find(
        q => q.id === sesionEnCurso.preguntasActivas[sesionEnCurso.paso]
      );
      if (preguntaPendiente) {
        enviarMensaje(telefono, '📝 Tienes un registro en curso. Esto es lo que te preguntamos:');
        enviarPregunta(telefono, preguntaPendiente);
      }
    }
    return;
  }

  if (textoNorm === 'CONTINUAR') {
    const sesion = obtenerSesion(telefono);
    if (sesion) {
      // FIX: antes, si la sesión ya estaba marcada `expirada: true`,
      // este bloque caía al `else` y decía "no tienes registro activo",
      // aunque el propio bot acababa de invitar a escribir CONTINUAR.
      // Ahora CONTINUAR sí puede reactivar una sesión expirada.
      sesion.expirada = false;
      sesion.iniciadoEn = new Date().toISOString();
      guardarSesion(telefono, sesion);

      const pregunta = sesion.todasLasPreguntas.find(
        q => q.id === sesion.preguntasActivas[sesion.paso]
      );
      enviarMensaje(telefono, '↩️ Continuando tu registro. Última pregunta pendiente:');
      if (pregunta) enviarPregunta(telefono, pregunta);
    } else {
      enviarMensaje(telefono,
        'No tienes un registro en curso activo.\n\n' +
        'Escribe cualquier mensaje para comenzar uno nuevo.'
      );
    }
    return;
  }

  if (textoNorm.startsWith('ESTATUS')) {
    const partes = textoNorm.split(' ');
    if (partes.length < 2 || partes[1].trim() === '') {
      enviarMensaje(telefono,
        '⚠️ Formato incorrecto.\n\nEscribe: *ESTATUS [tu folio]*\n\nEjemplo:\n*ESTATUS SMA-2026-000001*'
      );
      return;
    }
    consultarEstatusFolio(telefono, partes[1].trim());
    return;
  }

  const sesion = obtenerSesion(telefono);

  // ── Manejar selección de convocatoria múltiple ────────
  if (sesion && sesion.esperandoConvocatoria) {
    const idx = parseInt(textoNorm, 10) - 1;
    const activas = apiObtenerConvocatoriasActivas();
    
    if (!isNaN(idx) && idx >= 0 && idx < activas.length) {
      limpiarSesion(telefono);
      iniciarSesionConvocatoria(telefono, activas[idx]);
    } else {
      enviarMensaje(telefono, '❌ Opción inválida. Responde con el número correcto de la lista.');
    }
    return;
  }

  if (!sesion) {
    iniciarFlujo(telefono);
    return;
  }

  // FIX: bug del bucle infinito de "sesión expirada".
  // Antes este bloque hacía limpiarSesion(telefono) y AL TIRO volvía a
  // guardar la misma sesión vieja (con expirada:true). Como iniciadoEn
  // nunca cambiaba, sesionExpirada() seguía devolviendo true por siempre,
  // así que CUALQUIER mensaje futuro repetía este mismo aviso sin fin
  // (ni CONTINUAR ni "cualquier otro mensaje" lograban salir de aquí).
  //
  // Ahora: la primera vez que detectamos la expiración solo avisamos y
  // marcamos la sesión (sin borrarla, para que CONTINUAR pueda
  // recuperarla). Si el usuario ya fue avisado (sesion.expirada === true)
  // y escribe cualquier cosa que no sea CONTINUAR (eso ya se maneja arriba),
  // entonces sí reiniciamos el flujo de verdad.
  if (sesionExpirada(sesion) && !sesion.expirada) {
    enviarMensaje(telefono,
      '⏰ Tu sesión expiró por inactividad.\n\n' +
      'Escribe *CONTINUAR* para retomar donde te quedaste, ' +
      'o cualquier otro mensaje para empezar de nuevo.'
    );
    guardarSesion(telefono, { ...sesion, expirada: true });
    return;
  }

  if (sesion.expirada) {
    limpiarSesion(telefono);
    iniciarFlujo(telefono);
    return;
  }

  continuarFlujo(telefono, texto, sesion, tipoArchivo);
}

/*******************************************************
 * INICIAR FLUJO
 *******************************************************/
function iniciarFlujo(telefono) {
  const activas = apiObtenerConvocatoriasActivas();

  if (!activas || activas.length === 0) {
    enviarMensaje(telefono, '⚠️ No hay convocatorias disponibles en este momento.\n\nIntenta más tarde.');
    return;
  }

  if (activas.length > 1) {
    guardarSesion(telefono, { esperandoConvocatoria: true });
    const lista = activas.map((c, i) => `*${i+1}.* ${c.nombre}`).join('\n');
    enviarMensaje(telefono,
      '🌿 Tenemos varias convocatorias abiertas. Responde con el número de la que deseas aplicar:\n\n' +
      lista +
      // FIX: este era el único primer-mensaje que se quedaba sin el
      // recordatorio de CANCELAR/AYUDA (el caso de una sola convocatoria
      // ya lo tenía). Ahora, sin importar si hay una o varias
      // convocatorias abiertas, el primer mensaje que ve el usuario
      // siempre incluye este recordatorio.
      '\n\n_Escribe *CANCELAR* en cualquier momento para salir, o *AYUDA* para ver los comandos disponibles._'
    );
    return;
  }

  iniciarSesionConvocatoria(telefono, activas[0]);
}

function iniciarSesionConvocatoria(telefono, conv) {
  const esquema           = JSON.parse(conv.esquemaFormulario);
  const todasLasPreguntas = aplanarPreguntas(esquema);
  const preguntasActivas  = todasLasPreguntas
    .filter(q => q._seccionId === 'sec_principal')
    .map(q => q.id);

  if (preguntasActivas.length === 0) {
    enviarMensaje(telefono, '⚠️ La convocatoria no tiene preguntas configuradas aún.');
    return;
  }

  const sesion = {
    paso:              0,
    convId:            conv.id,
    sheetId:           conv.sheetId,
    todasLasPreguntas,
    preguntasActivas,
    respuestas:        {},
    archivosRecibidos: {},
    intentosFallidos:  0,
    iniciadoEn:        new Date().toISOString()
  };

  guardarSesion(telefono, sesion);

  // FIX: antes, si `conv.mensajeBienvenida` estaba configurado, reemplazaba
  // por completo el texto por defecto — incluyendo el aviso de CANCELAR.
  // Es decir, en cualquier convocatoria con bienvenida personalizada el
  // usuario nunca se enteraba de que podía escribir CANCELAR o AYUDA.
  // Ahora el recordatorio se agrega siempre, sin importar si hay mensaje
  // personalizado o no.
  const recordatorioComandos =
    '_Escribe *CANCELAR* en cualquier momento para salir, o *AYUDA* para ver los comandos disponibles._';

  const textoBienvenida = conv.mensajeBienvenida
    ? `${conv.mensajeBienvenida}\n\n${recordatorioComandos}`
    : `🌿 *Bienvenido al Sistema de Registro*\n\n` +
      `${conv.nombre || 'Programa SMA Tlaxcala'}\n\n` +
      `Responde cada pregunta para completar tu registro.\n\n` +
      `${recordatorioComandos}`;

  enviarMensaje(telefono, textoBienvenida);

  // FIX: misma protección que en continuarFlujo — si falla el envío de la
  // primera pregunta, se lo hacemos saber al usuario en vez de dejarlo con
  // una sesión creada pero sin ninguna pregunta visible.
  const primera = todasLasPreguntas.find(q => q.id === preguntasActivas[0]);
  if (primera) {
    try {
      enviarPregunta(telefono, primera);
    } catch (err) {
      console.error('Error enviando la primera pregunta ' + primera.id + ': ' + err.message);
      enviarMensaje(telefono,
        '⚠️ Tuvimos un problema técnico al mostrarte la primera pregunta.\n\n' +
        'Escribe *CONTINUAR* para intentar de nuevo.'
      );
    }
  }
}

/*******************************************************
 * CONTINUAR FLUJO
 *******************************************************/
function continuarFlujo(telefono, texto, sesion, tipoArchivo) {
  const estadoActual = apiObtenerEstadoPorId(sesion.convId);
  if (estadoActual === 'PAUSADA') {
    enviarMensaje(telefono, '⏸️ El registro está temporalmente pausado. Intenta más tarde.');
    return;
  }
  if (estadoActual === 'CERRADA') {
    limpiarSesion(telefono);
    enviarMensaje(telefono, '🔒 El período de registro ha concluido.');
    return;
  }

  const idPreguntaActual = sesion.preguntasActivas[sesion.paso];
  const pregunta = sesion.todasLasPreguntas.find(q => q.id === idPreguntaActual);

  if (!pregunta) {
    limpiarSesion(telefono);
    enviarMensaje(telefono,
      '⚠️ Error en el flujo de registro.\n\nEscribe cualquier mensaje para reiniciar.'
    );
    return;
  }

  // ── 1. DEFINIR CANTIDAD DE ARCHIVOS POR EL USUARIO ────────
  const cfg = pregunta.configArchivo || {};
  const maxPermitido = cfg.maxArchivos || 1;

  if (pregunta.tipo === 'ARCHIVO' && maxPermitido > 1) {
    if (!sesion.cantidadDefinida) sesion.cantidadDefinida = {};

    if (!sesion.cantidadDefinida[pregunta.id]) {
      const cant = parseInt(texto, 10);
      
      if (isNaN(cant) || cant < 1 || cant > maxPermitido) {
        enviarMensaje(telefono, `⚠️ Por favor, responde con un número del 1 al ${maxPermitido} para indicar cuántos archivos vas a subir en total.`);
        return;
      }
      
      sesion.cantidadDefinida[pregunta.id] = cant;
      guardarSesion(telefono, sesion);
      enviarMensaje(telefono, `Entendido. Por favor, envía el archivo 1 de ${cant}.`);
      return; 
    }
  }

  // ── 2. VALIDACIÓN DE TIPO DE ARCHIVO ────────────────────────
  if (pregunta.tipo === 'ARCHIVO' && tipoArchivo) {
    const esImagen = tipoArchivo.startsWith('image/');
    const esPDF    = tipoArchivo === 'application/pdf';
    const soloPDF  = cfg.permitirPdf && !cfg.permitirImagenes;
    const soloImg  = cfg.permitirImagenes && !cfg.permitirPdf;

    if (soloPDF && !esPDF) {
      sesion.intentosFallidos = (sesion.intentosFallidos || 0) + 1;
      guardarSesion(telefono, sesion);
      enviarMensaje(telefono,
        '❌ Este campo requiere un *documento PDF*.\n\n' +
        'Recibí una imagen. Por favor envía el archivo en formato PDF.'
      );
      return;
    }

    if (soloImg && !esImagen) {
      sesion.intentosFallidos = (sesion.intentosFallidos || 0) + 1;
      guardarSesion(telefono, sesion);
      enviarMensaje(telefono,
        '❌ Este campo requiere una *fotografía*.\n\n' +
        'Recibí un PDF. Por favor envía una foto directamente desde tu cámara o galería.'
      );
      return;
    }
  }

  // ── CONVERSIÓN PREVIA DE NÚMERO A TEXTO (ANTES DE VALIDAR) ──
  let textoAValidar = texto ? String(texto).trim() : '';

  if (textoAValidar && !isNaN(textoAValidar)) {
    const idx = parseInt(textoAValidar, 10) - 1;

    if (pregunta.tipo === 'OPCIONES_FIJAS' && typeof MUNICIPIOS_TLAXCALA !== 'undefined') {
      if (idx >= 0 && idx < MUNICIPIOS_TLAXCALA.length) {
        textoAValidar = MUNICIPIOS_TLAXCALA[idx];
      }
    } else if (pregunta.tipo === 'RAMIFICACION' && pregunta.opciones) {
      if (idx >= 0 && idx < pregunta.opciones.length) {
        textoAValidar = pregunta.opciones[idx].texto;
      }
    } else if (pregunta.tipo === 'OPCION_MULTIPLE' && pregunta.incisos) {
      if (idx >= 0 && idx < pregunta.incisos.length) {
        textoAValidar = pregunta.incisos[idx];
      }
    }
  }

  // ── 3. VALIDAR RESPUESTA DEL SERVIDOR ──────────────────────
  const validacion = validarRespuestaServidor(pregunta, textoAValidar);

  if (!validacion.valido) {
    sesion.intentosFallidos = (sesion.intentosFallidos || 0) + 1;
    guardarSesion(telefono, sesion);

    let mensajeError = '❌ ' + validacion.mensaje;
    if (sesion.intentosFallidos >= BOT_CONFIG.MAX_INTENTOS_FALLIDOS) {
      mensajeError += '\n\n💡 Si tienes dificultades, escribe *CANCELAR* para salir y volver a intentarlo más tarde.';
      sesion.intentosFallidos = 0;
      guardarSesion(telefono, sesion);
    }
    enviarMensaje(telefono, mensajeError);
    return;
  }

  sesion.intentosFallidos = 0;

  // ── 4. GUARDAR RESPUESTA ────────────────────────────────────
  if (pregunta.tipo === 'ARCHIVO') {
    if (!sesion.archivosRecibidos) sesion.archivosRecibidos = {};
    if (!sesion.archivosRecibidos[pregunta.id]) sesion.archivosRecibidos[pregunta.id] = [];

    sesion.archivosRecibidos[pregunta.id].push(validacion.valorLimpio);
    
    const recibidos = sesion.archivosRecibidos[pregunta.id].length;
    const totalEsperado = (sesion.cantidadDefinida && sesion.cantidadDefinida[pregunta.id]) ? sesion.cantidadDefinida[pregunta.id] : 1;

    if (recibidos < totalEsperado) {
      guardarSesion(telefono, sesion);
      enviarMensaje(telefono,
        `✅ Archivo ${recibidos} de ${totalEsperado} recibido.\n\n` +
        `Envía el archivo ${recibidos + 1} de ${totalEsperado}.`
      );
      return;
    }

    sesion.respuestas[pregunta.id] = sesion.archivosRecibidos[pregunta.id];
    delete sesion.archivosRecibidos[pregunta.id];
    if (sesion.cantidadDefinida) delete sesion.cantidadDefinida[pregunta.id];

  } else {
    sesion.respuestas[pregunta.id] = validacion.valorLimpio;
  }

  // ── 5. RAMIFICACIÓN ROBUSTA (Salto de secciones) ───────────
  if (pregunta.tipo === 'RAMIFICACION') {
    const valLimpio = String(validacion.valorLimpio).trim().toUpperCase();
    const opcionElegida = (pregunta.opciones || []).find(
      o => String(o.texto).trim().toUpperCase() === valLimpio
    );
    
    if (opcionElegida && opcionElegida.saltoSeccion && opcionElegida.saltoSeccion !== 'siguiente') {
      const pDeSeccion = sesion.todasLasPreguntas
        .filter(q => q._seccionId === opcionElegida.saltoSeccion)
        .map(q => q.id);
        
      if (pDeSeccion.length > 0) {
        const preguntasAInyectar = pDeSeccion.filter(id => !sesion.preguntasActivas.includes(id));
        sesion.preguntasActivas.splice(sesion.paso + 1, 0, ...preguntasAInyectar);
      }
    }
  }

  const siguientePaso = sesion.paso + 1;

  // ── 6. FINALIZACIÓN (Guardado directo) ─────────────────────
  if (siguientePaso >= sesion.preguntasActivas.length) {
    const convActual = apiObtenerConvocatoriaPorId(sesion.convId);
    
    if (convActual && convActual.limiteRegistros > 0) {
      try {
        const sheet = SpreadsheetApp.openById(convActual.sheetId).getActiveSheet();
        const totalRegistros = Math.max(0, sheet.getLastRow() - 2);
        if (totalRegistros >= convActual.limiteRegistros) {
          apiCambiarEstadoConvocatoria(convActual.id, 'CERRADA');
          limpiarSesion(telefono);
          enviarMensaje(telefono, '🔒 Lo sentimos, el cupo del programa se completó justo antes de terminar tu registro.');
          return;
        }
      } catch(e) {}
    }

    enviarMensaje(telefono, '⏳ Guardando tu registro...');
    const folio = guardarRespuestaConLock(sesion, telefono);
    limpiarSesion(telefono);

    if (folio === 'ERROR') {
      enviarMensaje(telefono, '⚠️ Hubo un problema técnico al guardar. Por favor intenta de nuevo.');
      return;
    }

    const msgExito = convActual?.mensajeExito || '✅ *¡Registro completado exitosamente!*';
    enviarMensaje(telefono,
      `${msgExito}\n\n📋 *Tu folio es:*\n*${folio}*\n\nGuarda este número para consultar el estado escribiendo:\n*ESTATUS ${folio}*`
    );
    return;
  }

  // FIX: antes se guardaba `sesion.paso` avanzado ANTES de intentar enviar
  // la siguiente pregunta. Si enviarPregunta() tronaba por cualquier motivo
  // (una excepción armando el mensaje, un error de la API de WhatsApp, etc.),
  // la sesión quedaba guardada como si el usuario ya hubiera visto esa
  // pregunta — sin que realmente le hubiera llegado. El resultado: el
  // usuario escribía cualquier cosa y el bot la evaluaba contra una
  // pregunta que nunca le mostramos (p. ej. "número de municipio inválido"
  // apareciendo de la nada).
  //
  // Ahora solo confirmamos el avance de sesión (guardarSesion) si el envío
  // de la siguiente pregunta fue exitoso. Si falla, avisamos del problema
  // técnico y dejamos la sesión en el paso anterior, para que el usuario
  // pueda reintentar con CONTINUAR en vez de quedar atascado sin saber qué
  // se le está preguntando.
  const siguiente = sesion.todasLasPreguntas.find(
    q => q.id === sesion.preguntasActivas[siguientePaso]
  );

  if (!siguiente) {
    enviarMensaje(telefono,
      '⚠️ Error en el flujo de registro.\n\n' +
      'Escribe *CONTINUAR* para intentar de nuevo o *CANCELAR* para reiniciar.'
    );
    return;
  }

  try {
    enviarPregunta(telefono, siguiente);
  } catch (err) {
    console.error('Error enviando la pregunta ' + siguiente.id + ': ' + err.message);
    enviarMensaje(telefono,
      '⚠️ Tuvimos un problema técnico al mostrarte la siguiente pregunta.\n\n' +
      'Escribe *CONTINUAR* para intentar de nuevo.'
    );
    return; // no guardamos sesion.paso avanzado: evitamos dejarte "trabado"
  }

  sesion.paso = siguientePaso;
  guardarSesion(telefono, sesion);
}

/*******************************************************
 * GUARDADO ATÓMICO (CON MAPEO Y FORMULAS)
 *******************************************************/
function guardarRespuestaConLock(sesion, telefono) {
  if (!sesion.sheetId) return 'ERROR';

  const lock = LockService.getScriptLock();
  const success = lock.tryLock(15000);
  if (!success) return 'ERROR';

  try {
    const convActual = apiObtenerConvocatoriaPorId(sesion.convId);
    const props  = PropertiesService.getScriptProperties();
    const key    = 'FOLIO_' + sesion.convId;
    const actual = parseInt(props.getProperty(key) || '0', 10) + 1;
    props.setProperty(key, String(actual));
    
    const prefijo = (convActual && convActual.prefijoFolio) ? convActual.prefijoFolio : 'SMA';
    const folio = prefijo + '-' + new Date().getFullYear() + '-' + String(actual).padStart(6, '0');

    const sheet       = SpreadsheetApp.openById(sesion.sheetId).getActiveSheet();
    const encabezados = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

    const preguntaCurp = sesion.todasLasPreguntas.find(p => p.tipo === 'CURP');
    let identificador = (preguntaCurp && sesion.respuestas[preguntaCurp.id]) 
                          ? String(sesion.respuestas[preguntaCurp.id]).toUpperCase().trim() 
                          : telefono;
                          
    identificador = identificador.replace(/"/g, '');

    // FIX: el nombre del archivo en Drive se decide en el momento de la
    // subida (descargarMediaWA, en doPost.gs), usando el CURP SOLO SI ya
    // había sido contestado en ese momento. Como el orden de las preguntas
    // cambia por convocatoria — a veces CURP va antes del archivo, a veces
    // después — un archivo podía quedar nombrado con el teléfono en vez
    // del CURP sin que hubiera nada mal configurado; simplemente dependía
    // del orden de esa convocatoria en particular.
    //
    // Aquí, ya con el registro completo (todas las respuestas disponibles,
    // incluido el CURP si existe), recorremos TODOS los archivos de la
    // sesión —sin importar en qué pregunta ni en qué momento se subieron—
    // y los renombramos en Drive para que siempre terminen con el
    // identificador correcto. Así el orden de las preguntas deja de
    // importar. Si solo hay un archivo en todo el registro se llama
    // "identificador"; si hay varios, "identificador_1", "identificador_2", etc.
    const archivosOrdenados = [];
    sesion.todasLasPreguntas.forEach(p => {
      if (p.tipo !== 'ARCHIVO') return;
      const resp = sesion.respuestas[p.id];
      if (!resp) return;
      const urls = Array.isArray(resp) ? resp : [resp];
      urls.forEach(url => archivosOrdenados.push({ preguntaId: p.id, url }));
    });

    const totalArchivos = archivosOrdenados.length;
    const etiquetaPorUrl = {};

    archivosOrdenados.forEach((item, idx) => {
      const etiqueta = totalArchivos > 1 ? `${identificador}_${idx + 1}` : identificador;
      etiquetaPorUrl[item.url] = etiqueta;

      const fileId = extraerIdDrive(item.url);
      if (!fileId) return;
      try {
        const archivo = DriveApp.getFileById(fileId);
        const nombreActual = archivo.getName();
        const ext = nombreActual.includes('.') ? nombreActual.substring(nombreActual.lastIndexOf('.')) : '';
        archivo.setName(etiqueta + ext);
      } catch (e) {
        console.error('No se pudo renombrar archivo ' + fileId + ' en Drive: ' + e.message);
      }
    });

    const esquema = JSON.parse(convActual.esquemaFormulario);
    const mapaColumnas = {};
    
    esquema.secciones.forEach(sec => {
      const esPrincipal = sec.id === 'sec_principal';
      let tagSec = '';
      if (!esPrincipal) {
        const tituloLimpio = extraerPalabrasClave(sec.titulo);
        tagSec = tituloLimpio ? ` (${tituloLimpio})` : '';
      }
      sec.preguntas.forEach(q => {
        let tituloCol = q.etiqueta.trim();
        if (!esPrincipal) tituloCol += tagSec;
        if (q.tipo === 'ARCHIVO') tituloCol += ' (Enlace Drive)';
        mapaColumnas[normalizarTexto(tituloCol)] = q.id;
      });
    });

    const celdasRichText = [];

    const fila = encabezados.map((h, colIdx) => {
      const hLimpioStr = normalizarTexto(h.toString());

      if (hLimpioStr === 'folio')             return folio;
      if (hLimpioStr === 'fecha de registro') return new Date().toISOString();
      if (hLimpioStr === 'canal')             return 'WhatsApp';
      if (hLimpioStr === 'estatus')           return 'REGISTRADO';
      if (hLimpioStr === 'telefono')          return telefono;

      const idAsignado = mapaColumnas[hLimpioStr];
      if (!idAsignado) return '';

      const pregunta = sesion.todasLasPreguntas.find(q => q.id === idAsignado);
      if (!pregunta) return '';

      const respuesta = sesion.respuestas[pregunta.id];
      if (respuesta === undefined || respuesta === null || respuesta === '') return '';

      if (pregunta.tipo === 'ARCHIVO') {
        const urls = Array.isArray(respuesta) ? respuesta : [respuesta];

        if (urls.length === 1) {
          const etiqueta = etiquetaPorUrl[urls[0]] || identificador;
          return `=HYPERLINK("${urls[0]}"; "${etiqueta}")`;
        }

        // FIX: varios archivos en la misma celda ahora quedan como texto
        // enriquecido — cada uno es su propio link clicable, etiquetado
        // como "identificador_1", "identificador_2", etc. (lo que
        // pediste antes) en vez del bloque de texto plano con la URL
        // completa repetida en cada línea. Sheets solo permite UNA
        // fórmula por celda, así que esto se llena después de
        // appendRow con setRichTextValue.
        celdasRichText.push({
          colIdx,
          items: urls.map(url => ({ etiqueta: etiquetaPorUrl[url] || identificador, url }))
        });
        return '';
      }

      return String(respuesta);
    });

    sheet.appendRow(fila);

    if (celdasRichText.length > 0) {
      const filaIdx = sheet.getLastRow();
      celdasRichText.forEach(({ colIdx, items }) => {
        try {
          sheet.getRange(filaIdx, colIdx + 1).setRichTextValue(construirRichTextMultiArchivo(items));
        } catch (e) {
          console.error('No se pudo aplicar texto enriquecido: ' + e.message);
        }
      });
    }

    return folio;

  } catch(err) {
    console.error('Error en guardarRespuestaConLock: ' + err.message);
    return 'ERROR';
  } finally {
    lock.releaseLock();
  }
}

/*******************************************************
 * FUNCIONES DE APOYO Y NORMALIZACIÓN
 *******************************************************/

// Extrae el ID de archivo de Drive de una URL como
// https://drive.google.com/file/d/FILE_ID/view?usp=drivesdk
function extraerIdDrive(url) {
  const match = String(url).match(/\/d\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

// Construye un valor de texto enriquecido con un link independiente por
// cada archivo (usado cuando una celda tiene 2+ documentos).
function construirRichTextMultiArchivo(items) {
  const texto = items.map(it => it.etiqueta).join('\n');
  const builder = SpreadsheetApp.newRichTextValue().setText(texto);

  let cursor = 0;
  items.forEach(it => {
    builder.setLinkUrl(cursor, cursor + it.etiqueta.length, it.url);
    cursor += it.etiqueta.length + 1; // +1 por el salto de línea
  });

  return builder.build();
}

function normalizarTexto(texto) {
  if (!texto) return '';
  return String(texto)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') 
    .replace(/[^a-z0-9\s]/g, ' ')   
    .replace(/\s+/g, ' ')
    .trim();
}

function verificarRegistroDuplicado(telefono) {
  try {
    const conv = apiObtenerConvocatoriaReciente();
    if (!conv || !conv.sheetId || conv.estado !== 'ACTIVA') return false;

    const sheet  = SpreadsheetApp.openById(conv.sheetId).getActiveSheet();
    const datos  = sheet.getDataRange().getValues();
    const enc    = datos[0];
    const idxTel = enc.findIndex(h => normalizarTexto(h) === 'telefono');

    if (idxTel === -1) return false;

    const filaExistente = datos.slice(2).find(
      f => String(f[idxTel]) === String(telefono)
    );

    if (filaExistente) {
      const folioExistente = filaExistente[0];
      enviarMensaje(telefono,
        `ℹ️ Ya tienes un registro en esta convocatoria.\n\n` +
        `*Tu folio es:* ${folioExistente}\n\n` +
        `Para consultar el estado escribe:\n*ESTATUS ${folioExistente}*`
      );
      return true;
    }
  } catch(e) {
    console.log('Error verificando duplicado: ' + e.message);
  }
  return false;
}

function sesionExpirada(sesion) {
  if (!sesion?.iniciadoEn) return false;
  const horas = (new Date() - new Date(sesion.iniciadoEn)) / 3600000;
  return horas > BOT_CONFIG.TIMEOUT_SESION_HORAS;
}

function consultarEstatusFolio(telefono, folioBuscado) {
  const conv = apiObtenerConvocatoriaReciente();
  if (!conv || !conv.sheetId) {
    enviarMensaje(telefono, 'No hay convocatorias disponibles para consultar.');
    return;
  }

  try {
    const sheet  = SpreadsheetApp.openById(conv.sheetId).getActiveSheet();
    const datos  = sheet.getDataRange().getValues();
    const enc    = datos[0];
    const idxEst = enc.findIndex(h => normalizarTexto(h) === 'estatus');
    const fila   = datos.slice(2).find(f => String(f[0]) === String(folioBuscado));

    if (!fila) {
      enviarMensaje(telefono,
        `❌ No encontramos el folio *${folioBuscado}*.\n\n` +
        `Verifica que esté escrito exactamente igual.\n` +
        `Ejemplo: *SMA-2026-000001*`
      );
      return;
    }

    const estatus = idxEst !== -1 ? fila[idxEst] : 'No disponible';
    const emojis  = { REGISTRADO:'📋', ASIGNADO:'📅', ENTREGADO:'✅', CANCELADO:'❌' };

    enviarMensaje(telefono,
      `🔍 *Consulta de Registro*\n\n` +
      `*Folio:* ${folioBuscado}\n` +
      `*Estado:* ${emojis[estatus] || '🔄'} ${estatus}\n\n` +
      `_Para más información comunícate con el Departamento de Cambio Climático de la SMA._`
    );
  } catch(e) {
    enviarMensaje(telefono, '⚠️ Error al consultar. Intenta más tarde.');
  }
}

function aplanarPreguntas(esquema) {
  const resultado = [];
  esquema.secciones.forEach(sec => {
    sec.preguntas.forEach(q => {
      resultado.push({ ...q, _seccionId: sec.id });
    });
  });
  return resultado;
}

function enviarPregunta(telefono, pregunta) {
  switch (pregunta.tipo) {
    case 'RAMIFICACION':
      if (pregunta.opciones?.length && pregunta.opciones.length <= 3) {
        enviarBotones(telefono, pregunta.etiqueta,
          pregunta.opciones.map(o => ({ valor: o.texto, etiqueta: o.texto }))
        );
      } else {
        enviarMensaje(telefono, construirTextoPregunta(pregunta));
      }
      break;

    case 'OPCION_MULTIPLE':
      if (pregunta.incisos?.length && pregunta.incisos.length <= 3) {
        enviarBotones(telefono, pregunta.etiqueta,
          pregunta.incisos.map(o => ({ valor: o, etiqueta: o }))
        );
      } else {
        enviarMensaje(telefono, construirTextoPregunta(pregunta));
      }
      break;

    case 'OPCIONES_FIJAS':
      let textoOpciones = pregunta.etiqueta + '\n\n';
      if (typeof MUNICIPIOS_TLAXCALA !== 'undefined') {
        textoOpciones += MUNICIPIOS_TLAXCALA.map((m, i) => `*${i+1}.* ${m}`).join('\n');
        textoOpciones += '\n\n_Escribe el número de tu opción:_';
      } else {
        textoOpciones += '\n\n_Escribe el número de tu opción:_';
      }
      enviarMensaje(telefono, textoOpciones);
      break;

    default:
      enviarMensaje(telefono, construirTextoPregunta(pregunta));
  } 
}

function construirTextoPregunta(pregunta) {
  if (!pregunta?.etiqueta) return '⚠️ Error de configuración.';

  let texto = pregunta.etiqueta;

  if (pregunta.tipo === 'RAMIFICACION' && pregunta.opciones?.length > 3) {
    const lista = pregunta.opciones.map((o, i) => `*${i+1}.* ${o.texto}`).join('\n');
    texto += '\n\nEscribe el número de tu opción:\n\n' + lista;

  } else if (pregunta.tipo === 'OPCION_MULTIPLE' && pregunta.incisos?.length > 3) {
    const lista = pregunta.incisos.map((o, i) => `*${i+1}.* ${o}`).join('\n');
    texto += '\n\nEscribe el número de tu opción:\n\n' + lista;

  } else if (pregunta.tipo === 'ARCHIVO') {
    const cfg      = pregunta.configArchivo || {};
    const max      = cfg.maxArchivos || 1;
    const formatos = [];
    
    if (cfg.permitirPdf)      formatos.push('PDF');
    if (cfg.permitirImagenes) formatos.push('imagen JPG o PNG');
    
    const fmtStr = formatos.length ? ` en formato ${formatos.join(' o ')}` : '';

    if (max > 1) {
      texto += `\n\n📌 Puedes subir hasta *${max} archivos*${fmtStr} para este apartado.\n\n¿Cuántos archivos vas a enviar en total?\n_Responde con un número (ejemplo: 2)_`;
    } else {
      texto += `\n\n📎 Envía tu archivo${fmtStr} directamente en el chat.`;
    }

  } else if (pregunta.tipo === 'CURP') {
    texto += '\n\n_Formato: 18 caracteres. Ejemplo: HEGG560427MVZRRL04_';

  } else if (pregunta.tipo === 'TELEFONO') {
    texto += '\n\n_10 dígitos sin espacios ni guiones._';

  } else if (pregunta.tipo === 'EMAIL') {
    texto += '\n\n_Ejemplo: nombre@correo.com_';
  }
  
  return texto;
}