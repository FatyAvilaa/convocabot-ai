function obtenerConvocatoriasMatriz() {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.ID_HOJA_MATRIZ);
    const hoja = ss.getSheets()[0];
    const rango = hoja.getDataRange();
    const valores = rango.getValues();
    
    if (valores.length <= 1) {
      return []; 
    }
    
    // Limpiar encabezados: asegura minúsculas y quita espacios accidentales
    const encabezados = valores.shift().map(h => h.toString().trim().toLowerCase());
    const resultado = [];
    
    valores.forEach(fila => {
      // Evitar procesar filas que estén completamente vacías en el Sheets
      if (fila.join("").trim() === "") return;
      
      const objeto = {};
      encabezados.forEach((llave, i) => {
        let valor = fila[i];
        
        // CORRECCIÓN CRÍTICA: Convertir fechas a texto ISO (YYYY-MM-DD) 
        // para que puedan viajar de forma segura al frontend
        if (valor instanceof Date) {
          objeto[llave] = Utilities.formatDate(valor, Session.getScriptTimeZone(), "yyyy-MM-dd");
        } else {
          objeto[llave] = valor;
        }
      });
      resultado.push(objeto);
    });
    
    return resultado;
  } catch (error) {
    Logger.log("Error en obtenerConvocatoriasMatriz: " + error.message);
    throw new Error("No se pudo leer la base de datos central: " + error.message);
  }
}