/*******************************************************
 * SISTEMA SMA - MÓDULO DE VALIDACIÓN CENTRAL
 *******************************************************/

const MENSAJES_VALIDACION = {
  obligatorio: "Este campo es obligatorio.",
  telefono:    "El teléfono debe contener exactamente 10 dígitos numéricos.",
  correo:      "El correo electrónico ingresado no es válido.",
  curp:        "La CURP ingresada no es válida. Debe tener 18 caracteres.",
  numero:      "Solo se permiten números.",
  entero:      "Solo se permiten números enteros (sin decimales).",
  archivo:     "El formato o tamaño de los archivos no es válido."
};

/**
 * Validador principal para el Bot de WhatsApp y flujos del servidor.
 * @param {Object} pregunta - Objeto de la pregunta configurada en el esquema.
 * @param {string} texto - Texto sin procesar enviado por el usuario.
 * @return {Object} - { valido: boolean, valorLimpio: any, mensaje: string }
 */
function validarRespuestaServidor(pregunta, texto) {
  const valor = (texto !== null && texto !== undefined) ? String(texto).trim() : "";

  // 1. Validación de Obligatoriedad
  if (pregunta.requerido && valor === "") {
    return { valido: false, mensaje: MENSAJES_VALIDACION.obligatorio };
  }

  // Si el campo no es obligatorio y el usuario no envió nada, pasa la validación
  if (!pregunta.requerido && valor === "") {
    return { valido: true, valorLimpio: "" };
  }

  // 2. Enrutamiento por Tipo de Pregunta
  switch (pregunta.tipo) {

    case "CURP":
      return validarCURP(valor);

    case "TELEFONO":
      return validarTelefono(valor);

    case "EMAIL":
    case "CORREO":
      return validarCorreo(valor);

    case "NUMERICO":
      return validarNumerico(valor, pregunta.configNumerico);

    case "OPCION_MULTIPLE":
      return validarOpcionMultiple(valor, pregunta.incisos);

    case "RAMIFICACION":
      return validarRamificacion(valor, pregunta.opciones);

    case "ARCHIVO":
      // El bot recibe de forma asíncrona o simula archivos
      return validarArchivoServidor(pregunta.configArchivo, valor);

    case "OPCIONES_FIJAS":
      return validarMunicipio(valor);
          
    case "TEXTO":
    default:
      return { valido: true, valorLimpio: valor };
  }
}
/*******************************************************
 * VALIDACIONES ESPECÍFICAS
 *******************************************************/

function validarTelefono(valor) {
  const limpio = valor.replace(/\D/g, "");
  if (limpio.length !== 10) {
    return { valido: false, mensaje: MENSAJES_VALIDACION.telefono };
  }
  return { valido: true, valorLimpio: limpio };
}

function validarCorreo(valor) {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!regex.test(valor)) {
    return { valido: false, mensaje: MENSAJES_VALIDACION.correo };
  }
  return { valido: true, valorLimpio: valor };
}

function validarCURP(valor) {
  const limpio = valor.toUpperCase();
  const regex = /^[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d$/;
  if (!regex.test(limpio)) {
    return { valido: false, mensaje: MENSAJES_VALIDACION.curp };
  }
  return { valido: true, valorLimpio: limpio };
}

function validarNumerico(valor, config) {
  const limpio = valor.replace(",", ".");
  const num = Number(limpio);

  if (isNaN(num) || limpio === "") {
    return { valido: false, mensaje: MENSAJES_VALIDACION.numero };
  }

  const permitirDecimal = config ? config.permitirDecimal : false;
  if (!permitirDecimal && !Number.isInteger(num)) {
    return { valido: false, mensaje: MENSAJES_VALIDACION.entero };
  }

  return { valido: true, valorLimpio: num };
}

function validarOpcionMultiple(valor, incisos) {
  if (!incisos || incisos.length === 0) {
    return { valido: true, valorLimpio: valor };
  }

  // Permite ingresar el número (índice + 1) o el texto exacto
  const indicesValidos = incisos.map((_, i) => String(i + 1));
  const incisosUpper = incisos.map(opt => opt.toUpperCase().trim());
  const valorUpper = valor.toUpperCase().trim();

  const idx = indicesValidos.indexOf(valor);
  if (idx !== -1) {
    return { valido: true, valorLimpio: incisos[idx] };
  }

  const matchIdx = incisosUpper.indexOf(valorUpper);
  if (matchIdx !== -1) {
    return { valido: true, valorLimpio: incisos[matchIdx] };
  }

  const lista = incisos.map((opt, i) => `${i + 1}. ${opt}`).join("\n");
  return { 
    valido: false, 
    mensaje: "Elige una opción válida escribiendo el número correspondiente:\n\n" + lista 
  };
}

function validarRamificacion(valor, opciones) {
  if (!opciones || opciones.length === 0) {
    return { valido: true, valorLimpio: valor };
  }

  const indicesValidos = opciones.map((_, i) => String(i + 1));
  const opcionesUpper = opciones.map(opt => opt.texto.toUpperCase().trim());
  const valorUpper = valor.toUpperCase().trim();

  const idx = indicesValidos.indexOf(valor);
  if (idx !== -1) {
    return { valido: true, valorLimpio: opciones[idx].texto };
  }

  const matchIdx = opcionesUpper.indexOf(valorUpper);
  if (matchIdx !== -1) {
    return { valido: true, valorLimpio: opciones[matchIdx].texto };
  }

  const lista = opciones.map((opt, i) => `${i + 1}. ${opt.texto}`).join("\n");
  return { 
    valido: false, 
    textosOpciones: opciones.map(opt => opt.texto),
    mensaje: "Elige una modalidad válida escribiendo el número correspondiente:\n\n" + lista 
  };
}

function validarArchivoServidor(config, respuestaJson) {
  // Si la respuesta es un link de Google Drive generado por el webhook, lo acepta directo
  if (typeof respuestaJson === 'string' && respuestaJson.startsWith('http')) {
    return { valido: true, valorLimpio: respuestaJson };
  }
  
  if (!respuestaJson || respuestaJson === "") {
    return { valido: false, mensaje: MENSAJES_VALIDACION.archivo };
  }


  let archivos;
  try {
    archivos = JSON.parse(respuestaJson);
  } catch (e) {
    return { valido: false, mensaje: "El archivo enviado no tiene un formato válido." };
  }

  if (!Array.isArray(archivos) || archivos.length === 0) {
    return { valido: false, mensaje: MENSAJES_VALIDACION.archivo };
  }

  if (!config) return { valido: true, valorLimpio: respuestaJson };

  if (config.maxArchivos && archivos.length > config.maxArchivos) {
    return { 
      valido: false, 
      mensaje: `Solo tienes permitido subir un máximo de ${config.maxArchivos} archivo(s).` 
    };
  }

  for (const archivo of archivos) {
    const esPDF = archivo.tipo === "application/pdf";
    const esImagen = archivo.tipo && archivo.tipo.startsWith("image/");

    if (config.permitirPdf && !config.permitirImagenes && !esPDF) {
      return { valido: false, mensaje: "Solo se aceptan archivos en formato PDF." };
    }
    if (config.permitirImagenes && !config.permitirPdf && !esImagen) {
      return { valido: false, mensaje: "Solo se aceptan imágenes (JPG, PNG)." };
    }

    if (config.pesoMaxMb) {
      const limiteBytes = config.pesoMaxMb * 1024 * 1024;
      if (archivo.tamano > limiteBytes) {
        return { 
          valido: false, 
          mensaje: `El archivo "${archivo.nombre}" supera el límite de peso de ${config.pesoMaxMb} MB.` 
        };
      }
    }
  }

  return { valido: true, valorLimpio: respuestaJson };
}

