const MUNICIPIOS_TLAXCALA = [
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

function obtenerMenuMunicipios() {
  return MUNICIPIOS_TLAXCALA
    .map((m, i) => `*${i + 1}.* ${m}`)
    .join('\n');
}

function validarMunicipio(valor) {
  if (!valor) {
    return {
      valido: false,
      mensaje: 'Por favor ingresa el número o nombre de tu municipio:\n\n' + obtenerMenuMunicipios()
    };
  }

  const strValor = String(valor).trim();

  // 1. Validar si el usuario envió un número (ejemplo: "5")
  const num = parseInt(strValor, 10);
  if (!isNaN(num) && num >= 1 && num <= MUNICIPIOS_TLAXCALA.length) {
    return { valido: true, valorLimpio: MUNICIPIOS_TLAXCALA[num - 1] };
  }

  // 2. Validar si el usuario escribió el nombre (ignora mayúsculas y acentos)
  const normInput = normalizarTexto(strValor);
  const match = MUNICIPIOS_TLAXCALA.find(
    m => normalizarTexto(m) === normInput
  );

  if (match) {
    return { valido: true, valorLimpio: match };
  }

  return {
    valido: false,
    mensaje: '❌ Municipio no válido. Escribe el número de tu municipio:\n\n' + obtenerMenuMunicipios()
  };
}