/*******************************************************
 * SISTEMA SMA
 * PUNTO DE ENTRADA Y LÓGICA DE BACKEND
 *******************************************************/

const VERIFY_TOKEN = 'cambio-climatico-tlaxcala';

/*******************************************************
 * FUNCIONES UTILITARIAS Y NORMALIZACIÓN
 *******************************************************/
function normalizarTexto(texto) {
  return String(texto || '')
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, ' ');
}

function limpiarCelda(texto) {
  if (!texto) return '';
  return String(texto)
    .replace(/[\r\n]+/g, ' ')
    .replace(/"/g, "'")
    .replace(/,/g, ' ');
}

function extraerPalabrasClave(texto) {
  // 1. Forzamos conversión a texto para evitar que colapse con números u objetos
  const textoSeguro = String(texto || '').trim();
  if (!textoSeguro) return "Archivo";

  // 2. Limpieza total a minúsculas, sin acentos
  let limpio = textoSeguro.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  
  // 3. Permitimos letras, la Ñ y NÚMEROS (por si piden "Archivo 1", "Archivo 2")
  limpio = limpio.replace(/[^a-z0-9ñ\s]/g, ' ').trim();

  const palabrasIgnoradas = new Set([
    'adjunta','adjunte','adjuntar','envia','envie','enviar','sube','suba','subir',
    'carga','cargue','cargar','proporciona','proporcione','proporcionar','ingresa',
    'ingrese','ingresar','escanea','escanee','escanear','manda','mande','mandar',
    'el','la','los','las','un','una','unos','unas','de','del','para','por','en',
    'con','y','o','cual','es','tu','su','mi','que','al','se','lo','como',
    'documento','copia','fotografia','foto','archivo','imagen','pdf','formato',
    'seccion','flujo','opc','opcional','favor'
  ]);

  // 4. Separar todas las palabras de más de 1 letra (para que "ID" pase)
  const todasLasPalabras = limpio.split(/\s+/).filter(p => p.length > 1);
  
  // 5. Aplicar el filtro de exclusión (máximo 3 palabras)
  const palabrasFiltradas = todasLasPalabras
    .filter(p => !palabrasIgnoradas.has(p)) 
    .slice(0, 3); 

  // 6. MECANISMO DE RESCATE: Si la pregunta era solo "SUBE TU PDF", el filtro borraba todo.
  // Con esto, rescatamos la última palabra original ("pdf")
  let palabrasFinales = palabrasFiltradas;
  if (palabrasFinales.length === 0 && todasLasPalabras.length > 0) {
    palabrasFinales = [todasLasPalabras[todasLasPalabras.length - 1]];
  } else if (palabrasFinales.length === 0) {
    return "Archivo";
  }

  // 7. Formato (Primera letra Mayúscula y guion bajo)
  return palabrasFinales.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join('_');
}
/*******************************************************
 * ABRIR APLICACIÓN & WEBHOOK
 *******************************************************/
function doGet(e) {
  if (e && e.parameter && e.parameter['hub.verify_token']) {
    const token = e.parameter['hub.verify_token'];
    const challenge = e.parameter['hub.challenge'];
    
    if (token === VERIFY_TOKEN) {
      return ContentService.createTextOutput(challenge);
    }
    return ContentService.createTextOutput('Token inválido');
  }
  
  return HtmlService
    .createTemplateFromFile("ui_Index")
    .evaluate()
    .setTitle("SMA Tlaxcala")
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function incluir(nombre) {
  try {
    return HtmlService.createTemplateFromFile(nombre).evaluate().getContent();
  } catch(e) {
    return ``;
  }
}

/*******************************************************
 * POBLAR BASE PRUEBA DE 200 REGISTROS
 *******************************************************/
function poblarBaseCon200Registros() {
  const sheetId = CONFIG.ID_HOJA_MATRIZ;
  const sheet = SpreadsheetApp.openById(sheetId).getSheets()[0];

  const ultimaFila = sheet.getLastRow();
  if (ultimaFila >= 3) {
    sheet.getRange(3, 1, ultimaFila - 2, 22).clearContent();
  }

  const municipios = [
    'Acuamanala de Miguel Hidalgo','Amaxac de Guerrero','Apetatitlán de Antonio Carvajal',
    'Apizaco','Atlangatepec','Atltzayanca','Benito Juárez','Calpulalpan','Chiautempan',
    'Contla de Juan Cuamatzi','Cuapiaxtla','Cuaxomulco','El Carmen Tequexquitla',
    'Emiliano Zapata','Españita','Huamantla','Hueyotlipan','Ixtacuixtla de Mariano Matamoros',
    'Ixtenco','La Magdalena Tlaltelulco','Lázaro Cárdenas','Mazatecochco de José María Morelos',
    'Muñoz de Domingo Arenas','Nanacamilpa de Mariano Arista','Natívitas','Panotla',
    'Papalotla de Xicohténcatl','San Damián Texóloc','San Francisco Tetlanohcan',
    'San Jerónimo Zacualpan','San José Teacalco','San Juan Huactzinco','San Lorenzo Axocomanitla',
    'San Lucas Tecopilco','San Pablo del Monte','Sanctórum de Lázaro Cárdenas',
    'Santa Ana Nopalucan','Santa Apolonia Teacalco','Santa Catarina Ayometla',
    'Santa Cruz Quilehtla','Santa Cruz Tlaxcala','Santa Isabel Xiloxoxtla','Tenancingo',
    'Teolocholco','Tepetitla de Lardizábal','Tepeyanco','Terrenate','Tetla de la Solidaridad',
    'Tetlatlahuca','Tlaxcala','Tlaxco','Tocatlán','Totolac','Tzompantepec','Xaloztoc',
    'Xaltocan','Xicohtzinco','Yauhquemehcan','Zacatelco','Ziltlaltépec de Trinidad Sánchez Santos'
  ];

  const nombresH = ['Carlos','Juan','José','Luis','Miguel','David','Jorge','Alejandro','Daniel','Jesús','Fernando','Ricardo','Eduardo','Gabriel','Roberto'];
  const nombresM = ['María','Ana','Laura','Patricia','Guadalupe','Sofia','Andrea','Carmen','Rosa','Fernanda','Claudia','Adriana','Verónica','Lilia','Martha'];
  const apellidos = ['Hernández','López','Martínez','González','Pérez','Rodríguez','Sánchez','Ramírez','Cruz','Flores','Gómez','Morales','Vázquez','Reyes','Jiménez','Torres','Díaz','García','Mendoza','Aguilar'];
  const colonias = ['Centro','San Miguel','La Joya','El Carmen','San José','Reforma','Santa Cruz','Lomas del Sur','Adolfo López Mateos','Progreso'];

  const tiposEscuelas = [
    { prefijo: 'COBAT Plantel', minEst: 350, maxEst: 1200 },
    { prefijo: 'CECyTE Plantel', minEst: 250, maxEst: 900 },
    { prefijo: 'CBTis No.', minEst: 500, maxEst: 1800 },
    { prefijo: 'Escuela Secundaria Técnica No.', minEst: 200, maxEst: 750 },
    { prefijo: 'Telesecundaria No.', minEst: 80, maxEst: 300 },
    { prefijo: 'CONALEP Plantel', minEst: 400, maxEst: 1100 },
    { prefijo: 'Universidad Politécnica de Tlaxcala', minEst: 1200, maxEst: 2500 }
  ];

  const ladasTlaxcala = ['246', '241', '247', '248', '276', '749'];
  const estatusOpts = ['REGISTRADO', 'ASIGNADO', 'ENTREGADO', 'CANCELADO'];
  const canales = ['WhatsApp', 'Web'];

  const rows = [];

  for (let i = 1; i <= 200; i++) {
    const numFolio = String(i).padStart(3, '0');
    const folio = `FOL-${numFolio}`;
    
    const dia = Math.floor(Math.random() * 21) + 1;
    const hora = Math.floor(Math.random() * 10) + 8;
    const min = Math.floor(Math.random() * 60);
    const fecha = `2026-07-${String(dia).padStart(2, '0')} ${String(hora).padStart(2, '0')}:${String(min).padStart(2, '0')}:00`;

    const canal = canales[Math.floor(Math.random() * canales.length)];
    const estatus = estatusOpts[Math.floor(Math.random() * estatusOpts.length)];
    const lada = ladasTlaxcala[Math.floor(Math.random() * ladasTlaxcala.length)];
    const telefono = lada + String(Math.floor(1000000 + Math.random() * 9000000));

    const esHombre = Math.random() > 0.5;
    const sexo = esHombre ? 'H' : 'M';
    const nom = esHombre ? nombresH[Math.floor(Math.random() * nombresH.length)] : nombresM[Math.floor(Math.random() * nombresM.length)];
    const ap1 = apellidos[Math.floor(Math.random() * apellidos.length)];
    const ap2 = apellidos[Math.floor(Math.random() * apellidos.length)];
    const nombreCompleto = `${nom} ${ap1} ${ap2}`;
    
    const dominios = ['gmail.com', 'yahoo.com.mx', 'hotmail.com', 'outlook.com', 'edutlax.gob.mx'];
    const email = `${nom.toLowerCase().replace(/ /g,'')}.${ap1.toLowerCase()}${i}@${dominios[Math.floor(Math.random()*dominios.length)]}`;
    
    const municipio = municipios[Math.floor(Math.random() * municipios.length)];
    const col = colonias[Math.floor(Math.random() * colonias.length)];
    const direccion = `Calle ${ap2} #${Math.floor(Math.random() * 150) + 1}, Col. ${col}`;

    const ao = Math.floor(Math.random() * 25) + 75;
    const mes = String(Math.floor(Math.random() * 12) + 1).padStart(2, '0');
    const diaNac = String(Math.floor(Math.random() * 28) + 1).padStart(2, '0');
    
    const c1 = ap1.charAt(0).toUpperCase();
    const c2 = (ap1.substring(1).match(/[AEIOU]/i) || ['A'])[0].toUpperCase();
    const c3 = ap2.charAt(0).toUpperCase();
    const c4 = nom.charAt(0).toUpperCase();
    const cons1 = (ap1.substring(1).match(/[BCDFGHJKLMNPQRSTVWXYZ]/i) || ['X'])[0].toUpperCase();
    const cons2 = (ap2.substring(1).match(/[BCDFGHJKLMNPQRSTVWXYZ]/i) || ['X'])[0].toUpperCase();
    const cons3 = (nom.substring(1).match(/[BCDFGHJKLMNPQRSTVWXYZ]/i) || ['X'])[0].toUpperCase();
    
    const curp = `${c1}${c2}${c3}${c4}${String(ao).slice(-2)}${mes}${diaNac}${sexo}TL${cons1}${cons2}${cons3}0${i%10}`;

    const randMod = Math.random();
    let modalidad = '';
    let m2Arboles = "", aguaArboles = "", integrantesArboles = "";
    let nombreEscuela = "", dirEscuela = "", compromisoEscuela = "", estudiantesEscuela = "", transporteEscuela = "", m2Jardin = "";
    let aguaHuertos = "", personasHuertos = "";

    if (randMod < 0.45) {
      modalidad = 'Modalidad A. Árboles frutales';
      m2Arboles = Math.floor(Math.random() * 103) + 18;
      aguaArboles = Math.random() > 0.12 ? 'Sí' : 'No';
      integrantesArboles = Math.floor(Math.random() * 6) + 2;
    } else if (randMod < 0.75) {
      modalidad = 'Modalidad B. Jardines Polinizadores';
      const tipo = tiposEscuelas[Math.floor(Math.random() * tiposEscuelas.length)];
      const numPlantel = Math.floor(Math.random() * 30) + 1;
      nombreEscuela = `${tipo.prefijo} ${numPlantel}`;
      dirEscuela = `Av. Principal S/N, ${municipio}`;
      compromisoEscuela = 'Sí';
      estudiantesEscuela = Math.floor(Math.random() * (tipo.maxEst - tipo.minEst)) + tipo.minEst;
      transporteEscuela = Math.random() > 0.25 ? 'Sí' : 'No';
      m2Jardin = Math.floor(Math.random() * 201) + 50;
    } else {
      modalidad = 'Modalidad C. Huertos comunitarios';
      aguaHuertos = Math.random() > 0.15 ? 'Sí' : 'No';
      personasHuertos = Math.floor(Math.random() * 18) + 4;
    }

    rows.push([
      folio, fecha, canal, estatus, telefono,
      nombreCompleto, email, direccion, curp, municipio,
      modalidad,
      m2Arboles, aguaArboles, integrantesArboles,
      nombreEscuela, dirEscuela, compromisoEscuela, estudiantesEscuela, transporteEscuela, m2Jardin,
      aguaHuertos, personasHuertos
    ]);
  }

  sheet.getRange(3, 1, rows.length, rows[0].length).setValues(rows);
}

/*******************************************************
 * GESTIÓN DE CONVOCATORIAS
 *******************************************************/
function apiGuardarConvocatoria(draft) {
  const ss = SpreadsheetApp.openById(CONFIG.ID_HOJA_MATRIZ);
  let hoja = ss.getSheetByName('Convocatorias');

  if (!hoja) {
    hoja = ss.insertSheet('Convocatorias');
    hoja.appendRow([
      'id','nombre','descripcion','prefijoFolio','fechaInicio','fechaFin',
      'limiteRegistros','mensajeBienvenida','mensajeExito',
      'estado','esquemaFormulario','sheetId','folderId','fechaCreacion'
    ]);
  }

  if (draft.id && draft.id !== '') {
    const datos = hoja.getDataRange().getValues();
    
    for (let i = 1; i < datos.length; i++) {
      if (datos[i][0] === draft.id) { 
        const fila = i + 1; 
        
        hoja.getRange(fila, 2).setValue(draft.nombre);
        hoja.getRange(fila, 3).setValue(draft.descripcion || '');
        hoja.getRange(fila, 4).setValue(draft.prefijoFolio || 'SMA');
        hoja.getRange(fila, 5).setValue(draft.fechaInicio);
        hoja.getRange(fila, 6).setValue(draft.fechaFin);
        hoja.getRange(fila, 7).setValue(draft.limiteRegistros || 0);
        hoja.getRange(fila, 8).setValue(draft.mensajes.bienvenida || '');
        hoja.getRange(fila, 9).setValue(draft.mensajes.exito || '');
        hoja.getRange(fila, 11).setValue(JSON.stringify(draft.esquemaFormulario));
        
        return { ok: true, id: draft.id };
      }
    }
    return { ok: false, error: "No se encontró la convocatoria para actualizar." };
  }

  const idNuevo = 'CONV_' + new Date().getTime();

  hoja.appendRow([
    idNuevo,
    draft.nombre,
    draft.descripcion || '',
    draft.prefijoFolio || 'SMA',
    draft.fechaInicio,
    draft.fechaFin,
    draft.limiteRegistros || 0,
    draft.mensajes.bienvenida || '',
    draft.mensajes.exito || '',
    'ACTIVA',
    JSON.stringify(draft.esquemaFormulario),
    '', 
    '', 
    new Date().toISOString()
  ]);

  return { ok: true, id: idNuevo };
}

function apiDeployConvocatoria(convId, nombreConv, esquemaJson) {
  const esquema = JSON.parse(esquemaJson);

  const nombreMaster = 'SMA_convocatorias';
  const iteradorMaster = DriveApp.getFoldersByName(nombreMaster);
  let carpetaMaster = iteradorMaster.hasNext() ? iteradorMaster.next() : DriveApp.createFolder(nombreMaster);

  const nombreCarpeta = 'SMA_' + nombreConv.replace(/[^a-zA-Z0-9 ]/g, '').trim();
  const carpetaRaiz = carpetaMaster.createFolder(nombreCarpeta);

  const mapaCarpetas = {};
  const cacheCarpetasDrive = {}; 

  esquema.secciones.forEach(sec => {
    const esPrincipal = sec.id === 'sec_principal';
    let sufijoRama = '';
    if (!esPrincipal) {
      const tituloLimpio = extraerPalabrasClave(sec.titulo);
      sufijoRama = tituloLimpio ? '_' + tituloLimpio : ('_' + sec.id.substring(0,6));
    }

    sec.preguntas.forEach(q => {
      if (q.tipo === 'ARCHIVO') {
        const nombreBase = extraerPalabrasClave(q.etiqueta);
        const nombreFinalCarpeta = nombreBase + sufijoRama; 
        
        let folderId;
        if (cacheCarpetasDrive[nombreFinalCarpeta]) {
          folderId = cacheCarpetasDrive[nombreFinalCarpeta];
        } else {
          const subcarpeta = carpetaRaiz.createFolder(nombreFinalCarpeta);
          folderId = subcarpeta.getId();
          cacheCarpetasDrive[nombreFinalCarpeta] = folderId; 
        }
        
        mapaCarpetas[q.id] = {
          nombre: nombreFinalCarpeta,
          folderId: folderId
        };
      }
    });
  });

  const sheetResp = SpreadsheetApp.create('Respuestas_' + nombreConv);
  const hojaResp = sheetResp.getActiveSheet();
  const encabezados = ['Folio', 'Fecha de Registro', 'Canal', 'Estatus', 'Teléfono'];
  
  esquema.secciones.forEach(sec => {
    const esPrincipal = sec.id === 'sec_principal';
    let tagSec = (!esPrincipal && extraerPalabrasClave(sec.titulo)) ? ` (${extraerPalabrasClave(sec.titulo)})` : '';

    sec.preguntas.forEach(q => {
      let tituloColumna = q.etiqueta.trim() + tagSec;
      if (q.tipo === 'ARCHIVO') tituloColumna += ' (Enlace Drive)';
      encabezados.push(tituloColumna);
    });
  });
  
  hojaResp.appendRow(encabezados);
  formatearHojaRespuestas(hojaResp, encabezados);

  const archivoSheet = DriveApp.getFileById(sheetResp.getId());
  archivoSheet.moveTo(carpetaRaiz);

  const ss = SpreadsheetApp.openById(CONFIG.ID_HOJA_MATRIZ);
  let hojaMapas = ss.getSheetByName('MapaCarpetas');
  if (!hojaMapas) {
    hojaMapas = ss.insertSheet('MapaCarpetas');
    hojaMapas.appendRow(['convId', 'preguntaId', 'nombreCarpeta', 'folderId']);
  }
  Object.entries(mapaCarpetas).forEach(([qId, info]) => {
    hojaMapas.appendRow([convId, qId, info.nombre, info.folderId]);
  });

  const hojaConv = ss.getSheetByName('Convocatorias');
  const datos = hojaConv.getDataRange().getValues();
  const filaIdx = datos.findIndex(f => f[0] === convId);
  
  if (filaIdx !== -1) {
    // CORRECCIÓN EXACTA DE COLUMNAS (12 = SheetId, 13 = FolderId)
    hojaConv.getRange(filaIdx + 1, 12).setValue(sheetResp.getId());
    hojaConv.getRange(filaIdx + 1, 13).setValue(carpetaRaiz.getId());
  }

  return {
    ok: true,
    sheetId: sheetResp.getId(),
    folderId: carpetaRaiz.getId(),
    sheetUrl: 'https://docs.google.com/spreadsheets/d/' + sheetResp.getId() + '/edit',
    folderUrl: 'https://drive.google.com/drive/folders/' + carpetaRaiz.getId()
  };
}

function formatearHojaRespuestas(hoja, encabezados) {
  const totalCols = encabezados.length;

  const rangoEncabezado = hoja.getRange(1, 1, 1, totalCols);
  rangoEncabezado
    .setBackground('#1B4D35')
    .setFontColor('#FFFFFF')
    .setFontWeight('bold')
    .setFontSize(10)
    .setFontFamily('Inter')
    .setVerticalAlignment('middle')
    .setWrap(true);

  hoja.setRowHeight(1, 40);

  const COLS_SISTEMA = 5;
  const colorsSistema = ['#2D7A4F','#2D7A4F','#2D7A4F','#2D7A4F','#2D7A4F'];
  colorsSistema.forEach((color, i) => hoja.getRange(1, i + 1).setBackground(color));

  for (let i = COLS_SISTEMA; i < totalCols; i++) {
    const encabezado = encabezados[i] || '';
    let color = encabezado.includes('(Enlace Drive)') ? '#1565C0' : (i % 2 === 0 ? '#3a9c64' : '#4CAF7D');
    hoja.getRange(1, i + 1).setBackground(color);
  }

  const tiposAyuda = ['ID único', 'ISO 8601', 'WhatsApp/Web', 'REGISTRADO', '10 dígitos'];
  
  encabezados.slice(COLS_SISTEMA).forEach(enc => {
    const encLower = enc.toLowerCase();

    if (encLower.includes('curp')) {
      tiposAyuda.push('18 caracteres');
    } else if (encLower.includes('enlace drive')) {
      tiposAyuda.push('URL de Drive');
    } else if (encLower.includes('teléfono') || encLower.includes('telefono') || encLower.includes('celular')) {
      tiposAyuda.push('10 dígitos');
    } else if (encLower.includes('correo') || encLower.includes('email')) {
      tiposAyuda.push('Email');
    } else if (encLower.includes('edad') || encLower.includes('código postal') || encLower.includes('codigo postal') || encLower.includes('cuánt') || encLower.includes('cantidad')) {
      tiposAyuda.push('Numérico');
    } else if (encLower.includes('municipio') || encLower.includes('modalidad') || encLower.includes('opción')) {
      tiposAyuda.push('Selección de lista');
    } else {
      tiposAyuda.push('Texto');
    }
  });

  hoja.insertRowAfter(1);
  const rangoAyuda = hoja.getRange(2, 1, 1, totalCols);
  rangoAyuda.setValues([tiposAyuda.slice(0, totalCols)]);
  rangoAyuda
    .setBackground('#d6f0e3')
    .setFontColor('#1B4D35')
    .setFontSize(8)
    .setFontStyle('italic')
    .setVerticalAlignment('middle');
  hoja.setRowHeight(2, 22);

  hoja.setFrozenRows(2);
  hoja.setFrozenColumns(1);

  hoja.setColumnWidth(1, 160);
  hoja.setColumnWidth(2, 180);
  hoja.setColumnWidth(3, 90);
  hoja.setColumnWidth(4, 100);
  hoja.setColumnWidth(5, 110);

  for (let i = COLS_SISTEMA + 1; i <= totalCols; i++) {
    const enc = encabezados[i - 1] || '';
    hoja.setColumnWidth(i, enc.includes('Enlace Drive') ? 280 : (enc.length > 40 ? 220 : 160));
  }

  const reglaEstatus = SpreadsheetApp.newDataValidation()
    .requireValueInList(['REGISTRADO', 'ASIGNADO', 'ENTREGADO', 'CANCELADO'], true)
    .setAllowInvalid(false)
    .build();

  hoja.getRange(3, 4, 1000, 1).setDataValidation(reglaEstatus);

  const colEstatus = hoja.getRange('D3:D1000');
  const estilos = [
    { valor: 'REGISTRADO', fondo: '#EBF5FF', texto: '#1565C0' },
    { valor: 'ASIGNADO',   fondo: '#FFF8E1', texto: '#F57F17' },
    { valor: 'ENTREGADO',  fondo: '#E8F5E9', texto: '#2E7D32' },
    { valor: 'CANCELADO',  fondo: '#FFEBEE', texto: '#C62828' },
  ];

  const reglas = estilos.map(e => 
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo(e.valor)
      .setBackground(e.fondo)
      .setFontColor(e.texto)
      .setBold(true)
      .setRanges([colEstatus])
      .build()
  );

  hoja.setConditionalFormatRules(reglas);

  try {
    const proteccion = hoja.getRange('1:2').protect();
    proteccion.setDescription('Encabezados del sistema — no modificar');
    proteccion.setWarningOnly(true);
  } catch(e) {
    console.log('No se pudo proteger encabezado: ' + e.message);
  }

  hoja.setName('Registros');
}

/*******************************************************
 * CONSULTAS Y ESTADÍSTICAS
 *******************************************************/
function apiObtenerConvocatoriaReciente() {
  const hoja = SpreadsheetApp.openById(CONFIG.ID_HOJA_MATRIZ).getSheetByName('Convocatorias');
  if (!hoja) return null;

  const datos = hoja.getDataRange().getValues();
  if (datos.length <= 1) return null;

  const enc = datos[0];
  const filas = datos.slice(1);

  const idxEstado = enc.indexOf('estado');
  const activa  = filas.find(f => f[idxEstado] === 'ACTIVA');
  const pausada = filas.find(f => f[idxEstado] === 'PAUSADA');
  const fila    = activa || pausada || filas[filas.length - 1];

  if (!fila) return null;
  const obj = {};
  enc.forEach((h, i) => obj[h] = fila[i]);
  return obj;
}

function apiObtenerConvocatoriaPorId(convId) {
  const hoja = SpreadsheetApp.openById(CONFIG.ID_HOJA_MATRIZ).getSheetByName('Convocatorias');
  if (!hoja) return null;

  const datos = hoja.getDataRange().getValues();
  const enc   = datos[0];
  const fila  = datos.slice(1).find(f => String(f[0]) === String(convId));
  if (!fila) return null;

  const obj = {};
  enc.forEach((h, i) => obj[h] = fila[i]);
  return obj;
}

function apiObtenerConvocatoriasActivas() {
  const hoja = SpreadsheetApp.openById(CONFIG.ID_HOJA_MATRIZ).getSheetByName('Convocatorias');
  if (!hoja) return [];
  
  const datos = hoja.getDataRange().getValues();
  if (datos.length <= 1) return [];

  const enc = datos[0];
  const idxEstado = enc.indexOf('estado');
  
  return datos.slice(1)
    .filter(f => f[idxEstado] === 'ACTIVA')
    .map(f => {
      const obj = {};
      enc.forEach((h, i) => obj[h] = f[i]);
      return obj;
    });
}

function apiObtenerEstadoPorId(convId) {
  try {
    const hoja = SpreadsheetApp.openById(CONFIG.ID_HOJA_MATRIZ).getSheetByName('Convocatorias');
    if (!hoja) return null;
    const datos = hoja.getDataRange().getValues();
    const idxEstado = datos[0].indexOf('estado');
    const fila = datos.find(f => String(f[0]) === String(convId));
    return fila ? fila[idxEstado] : null;
  } catch(e) {
    return null;
  }
}

function apiObtenerEstadisticasConvocatoria(sheetId) {
  if (!sheetId) return { total: 0, porEstatus: {} };

  try {
    const sheet = SpreadsheetApp.openById(sheetId).getActiveSheet();
    const datos = sheet.getDataRange().getValues();
    if (datos.length <= 2) return { total: 0, porEstatus: {} };

    const enc = datos[0];
    const idxEstatus = enc.findIndex(h => normalizarTexto(h) === 'estatus');

    const porEstatus = {};
    datos.slice(2).forEach(fila => {
      const est = fila[idxEstatus] || 'DESCONOCIDO';
      porEstatus[est] = (porEstatus[est] || 0) + 1;
    });

    return { total: datos.length - 2, porEstatus };
  } catch(e) {
    return { total: 0, porEstatus: {}, error: e.message };
  }
}

function apiCambiarEstadoConvocatoria(convId, nuevoEstado) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.ID_HOJA_MATRIZ);
    const hoja = ss.getSheetByName('Convocatorias');
    const datos = hoja.getDataRange().getValues();
    const idxEstado = datos[0].indexOf('estado');

    for (let i = 1; i < datos.length; i++) {
      if (String(datos[i][0]) === String(convId)) {
        hoja.getRange(i + 1, idxEstado + 1).setValue(nuevoEstado);
        return { ok: true };
      }
    }
    return { ok: false, error: 'No encontrada' };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

function apiActualizarConvocatoria(convId, draft) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.ID_HOJA_MATRIZ);
    const hoja = ss.getSheetByName('Convocatorias');
    const datos = hoja.getDataRange().getValues();
    
    const idBuscar = String(convId).trim();
    
    if (idBuscar === 'undefined' || idBuscar === '') {
      return { ok: false, error: 'El ID llegó vacío.' };
    }

    const filaIdx = datos.findIndex(f => String(f[0]).trim() === idBuscar);

    if (filaIdx === -1) {
      return { ok: false, error: `No existe fila con el ID [${idBuscar}].` };
    }

    const filaReal = filaIdx + 1;
    
    hoja.getRange(filaReal, 2).setValue(draft.nombre);
    hoja.getRange(filaReal, 3).setValue(draft.descripcion || '');
    hoja.getRange(filaReal, 4).setValue(draft.prefijoFolio || 'SMA'); 
    hoja.getRange(filaReal, 5).setValue(draft.fechaInicio);
    hoja.getRange(filaReal, 6).setValue(draft.fechaFin);
    hoja.getRange(filaReal, 7).setValue(draft.limiteRegistros || 0);
    hoja.getRange(filaReal, 8).setValue(draft.mensajes.bienvenida || '');
    hoja.getRange(filaReal, 9).setValue(draft.mensajes.exito || '');
    hoja.getRange(filaReal, 11).setValue(JSON.stringify(draft.esquemaFormulario));

    return { ok: true };
  } catch(e) {
    return { ok: false, error: 'Fallo interno: ' + e.message };
  }
}

function apiEliminarConvocatoria(convId) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.ID_HOJA_MATRIZ);
    const hoja = ss.getSheetByName('Convocatorias');
    const datos = hoja.getDataRange().getValues();
    
    const idBuscar = String(convId).trim();
    const filaIdx = datos.findIndex(f => String(f[0]).trim() === idBuscar);

    if (filaIdx === -1) {
      return { ok: false, error: 'No se encontró la convocatoria en la base de datos.' };
    }

    hoja.deleteRow(filaIdx + 1);
    
    return { ok: true };
  } catch (e) {
    return { ok: false, error: 'Fallo interno en el servidor: ' + e.message };
  }
}

function apiVerificarEdicion(convId) {
  try {
    const conv = apiObtenerConvocatoriaPorId(convId);
    if (!conv || !conv.sheetId) {
      return { bloqueado: false, totalRegistros: 0 };
    }

    const sheet = SpreadsheetApp.openById(conv.sheetId).getActiveSheet();
    const totalRegistros = Math.max(0, sheet.getLastRow() - 2);

    return {
      bloqueado: totalRegistros > 0,
      totalRegistros: totalRegistros
    };
  } catch (e) {
    return { bloqueado: false, totalRegistros: 0 };
  }
}

/*******************************************************
 * INICIALIZAR Y GUARDAR HISTORIAL DE ANALÍTICA IA
 *******************************************************/
function inicializarHojaHistorialIA() {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.ID_HOJA_MATRIZ);
    let hoja = ss.getSheetByName('DB_Historial_IA');

    if (!hoja) {
      hoja = ss.insertSheet('DB_Historial_IA');
      const encabezados = [
        'id_consulta',
        'id_convocatoria',
        'fecha_hora',
        'pregunta_usuario',
        'tipo_grafica',
        'json_chart_data',
        'respuesta_texto'
      ];

      hoja.appendRow(encabezados);

      const rango = hoja.getRange(1, 1, 1, encabezados.length);
      rango.setBackground('#0F172A')
           .setFontColor('#FFFFFF')
           .setFontWeight('bold')
           .setFontFamily('Inter');
      
      hoja.setRowHeight(1, 35);
      hoja.setFrozenRows(1);
    }

    return { ok: true, mensaje: 'Hoja DB_Historial_IA lista' };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

function guardarConsultaEnHistorial(idConvocatoria, pregunta, respuestaIA) {
  const ss = SpreadsheetApp.openById(CONFIG.ID_HOJA_MATRIZ);
  let sheet = ss.getSheetByName('DB_Historial_IA');

  if (!sheet) {
    inicializarHojaHistorialIA();
    sheet = ss.getSheetByName('DB_Historial_IA');
  }

  const idConsulta = 'CONS-' + Date.now();
  const fechaHora = Utilities.formatDate(new Date(), 'GMT-6', 'yyyy-MM-dd HH:mm:ss');
  const chartDataStr = respuestaIA.chartData ? JSON.stringify(respuestaIA.chartData) : '';

  sheet.appendRow([
    idConsulta,
    idConvocatoria,
    fechaHora,
    pregunta,
    respuestaIA.tipo_grafica,
    chartDataStr,
    respuestaIA.respuesta_texto
  ]);

  return { ok: true, idConsulta: idConsulta, fechaHora: fechaHora };
}

function obtenerCSVDesinfectado(sheetId) {
  if (!sheetId) return "";
  try {
    const sheet = SpreadsheetApp.openById(sheetId).getActiveSheet();
    const datos = sheet.getDataRange().getValues();
    
    if (datos.length < 2) return ""; 

    const encabezados = datos[0];
    const filasDatos = datos.slice(1);

    const palabrasSensibles = [
      'nombre', 'curp', 'rfc', 'correo', 'email', 'telefono', 
      'direccion', 'calle', 'domicilio', 'colonia', 'enlace drive', 
      'archivo', 'fotografia', 'foto', 'adjunt'
    ];

    const columnasPermitidas = [];

    encabezados.forEach((header, index) => {
      const headerLimpio = normalizarTexto(header);
      const esControlValido = (headerLimpio.includes('folio') || 
                               headerLimpio.includes('fecha') || 
                               headerLimpio.includes('canal') || 
                               headerLimpio.includes('estatus') ||
                               headerLimpio.includes('municipio') ||
                               headerLimpio.includes('registro')) 
                              && !headerLimpio.includes('telefono');

      const esSensible = palabrasSensibles.some(p => headerLimpio.includes(p));

      if (esControlValido || !esSensible) {
        columnasPermitidas.push(index);
      }
    });

    const matrizFiltrada = [
      columnasPermitidas.map(idx => limpiarCelda(encabezados[idx]))
    ];

    filasDatos.forEach(fila => {
      const primeraColumna = String(fila[0] || '').trim().toLowerCase();
      const esFilaMetadatos = primeraColumna.includes('id unico') || 
                              primeraColumna.includes('iso') ||
                              primeraColumna.includes('texto');

      const filaVacia = fila.every(celda => String(celda).trim() === '');

      if (!filaVacia && !esFilaMetadatos) {
        matrizFiltrada.push(
          columnasPermitidas.map(idx => limpiarCelda(fila[idx]))
        );
      }
    });

    if (matrizFiltrada.length <= 1) return "";

    return matrizFiltrada.map(f => f.join(',')).join('\n');
  } catch (e) {
    console.error("Error al sanitizar CSV: " + e.message);
    return "";
  }
}

function consultarGeminiIA(pregunta, csvDatos) {
  const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!apiKey) {
    throw new Error("No se ha configurado la clave GEMINI_API_KEY en las Propiedades del Proyecto.");
  }

  const systemPrompt = `Eres un analista de datos experto. A continuación tienes la base de datos completa en formato CSV:

--- INICIO DATOS ---
${csvDatos}
--- FIN DATOS ---

Pregunta del usuario: "${pregunta}"

INSTRUCCIÓN: Lee y analiza TODAS las filas de datos para responder de manera precisa.

REGLAS DE SALIDA:
Responde ÚNICAMENTE con un objeto JSON estricto (sin bloques de código markdown) con esta estructura exacta:
{
  "respuesta_texto": "Explicación clara y sintética de los hallazgos en formato texto.",
  "tipo_grafica": "bar" | "pie" | "doughnut" | "line" | "none",
  "chartData": {
    "labels": ["Categoría 1", "Categoría 2"],
    "datasets": [
      {
        "label": "Total de Registros",
        "data": [10, 20]
      }
    ]
  }
}
Si no requiere gráfica, usa "tipo_grafica": "none" y "chartData": null.`;

  const payload = {
    contents: [{ parts: [{ text: systemPrompt }] }],
    generationConfig: {
      temperature: 0.1,
      responseMimeType: "application/json"
    }
  };

  const options = {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  const cache = CacheService.getScriptCache();
  const modeloCacheado = cache.get('gemini_modelo_activo');

  if (modeloCacheado) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modeloCacheado}:generateContent?key=${apiKey}`;
    const response = UrlFetchApp.fetch(url, options);
    if (response.getResponseCode() === 200) {
      return procesarRespuestaGemini(response.getContentText());
    }
    cache.remove('gemini_modelo_activo');
  }

  const candidatos = [
    'gemini-flash-latest',
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
    'gemini-3.5-flash'
  ];
  let ultimoError = null;

  for (const modelo of candidatos) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${apiKey}`;
    const response = UrlFetchApp.fetch(url, options);
    const resCode = response.getResponseCode();

    if (resCode === 200) {
      cache.put('gemini_modelo_activo', modelo, 21600);
      return procesarRespuestaGemini(response.getContentText());
    }

    if (resCode === 404 || resCode === 429) {
      ultimoError = `(${resCode}) ${modelo}`;
      continue;
    }

    throw new Error("Error en Gemini API (" + resCode + "): " + response.getContentText());
  }

  throw new Error("Ningún modelo disponible respondió. Último error: " + ultimoError);
}

function procesarRespuestaGemini(resText) {
  const jsonRes = JSON.parse(resText);
  let rawOutput = jsonRes.candidates[0].content.parts[0].text;
  rawOutput = rawOutput.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  const parsedData = JSON.parse(rawOutput);

  return {
    respuesta_texto: parsedData.respuesta_texto || parsedData.analisis || "Análisis completado.",
    tipo_grafica: parsedData.tipo_grafica || "none",
    chartData: parsedData.chartData || null
  };
}

function apiEjecutarConsultaAnalitica(idConvocatoria, pregunta) {
  try {
    const conv = apiObtenerConvocatoriaPorId(idConvocatoria);
    if (!conv || !conv.sheetId) {
      return { ok: false, error: "Convocatoria no encontrada o sin hoja de respuestas." };
    }

    const csvSanitizado = obtenerCSVDesinfectado(conv.sheetId);
    if (!csvSanitizado) {
      return { ok: false, error: "La convocatoria no tiene registros suficientes para analizar aún." };
    }

    const respuestaIA = consultarGeminiIA(pregunta, csvSanitizado);
    const guardado = guardarConsultaEnHistorial(idConvocatoria, pregunta, respuestaIA);

    return {
      ok: true,
      resultado: respuestaIA,
      idConsulta: guardado.idConsulta,
      fechaHora: guardado.fechaHora
    };

  } catch (e) {
    return { ok: false, error: e.message };
  }
}

function apiObtenerHistorialIA(idConvocatoria) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.ID_HOJA_MATRIZ);
    const hoja = ss.getSheetByName('DB_Historial_IA');
    if (!hoja) return [];

    const datos = hoja.getDataRange().getValues();
    if (datos.length <= 1) return [];

    const idBuscado = String(idConvocatoria || '').trim().toLowerCase();
    const historial = [];

    for (let i = 1; i < datos.length; i++) {
      const idFila = String(datos[i][1] || '').trim().toLowerCase();
      
      if (idFila === idBuscado) {
        let chartParsed = null;
        if (datos[i][5]) {
          try {
            chartParsed = typeof datos[i][5] === 'string' ? JSON.parse(datos[i][5]) : datos[i][5];
          } catch (eChart) {
            console.warn("Error parseando chartData en fila " + i + ": " + eChart.message);
          }
        }

        let fechaStr = datos[i][2];
        if (fechaStr instanceof Date) {
          fechaStr = Utilities.formatDate(fechaStr, 'GMT-6', 'yyyy-MM-dd HH:mm:ss');
        } else {
          fechaStr = String(fechaStr || '');
        }

        historial.push({
          idConsulta: String(datos[i][0] || ''),
          idConvocatoria: String(datos[i][1] || ''),
          fechaHora: fechaStr,
          pregunta: String(datos[i][3] || ''),
          tipoGrafica: String(datos[i][4] || ''),
          chartData: chartParsed,
          respuestaTexto: String(datos[i][6] || '')
        });
      }
    }

    return historial.reverse().slice(0, 20);

  } catch (e) {
    console.error("Error al leer historial: " + e.message);
    return [];
  }
}