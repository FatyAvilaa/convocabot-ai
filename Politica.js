function crearAvisoPrivacidad() {
  const doc = DocumentApp.create('Aviso de Privacidad - SMA');
  const body = doc.getBody();
  
  body.insertParagraph(0, 'Aviso de Privacidad - Sistema de Registro SMA Tlaxcala').setHeading(DocumentApp.ParagraphHeading.HEADING1);
  
  body.appendParagraph('1. Responsable del tratamiento de los datos').setHeading(DocumentApp.ParagraphHeading.HEADING2);
  body.appendParagraph('La Secretaría de Medio Ambiente (SMA) del Estado de Tlaxcala es responsable del uso y protección de los datos personales recabados a través de este asistente virtual (Bot de WhatsApp) para el programa "Tlaxcala Resiliente SMA 2026".');
  
  body.appendParagraph('2. Datos personales que se recaban').setHeading(DocumentApp.ParagraphHeading.HEADING2);
  body.appendParagraph('Para llevar a cabo los registros, recabaremos los siguientes datos:\n- Nombre completo.\n- Número de teléfono (obtenido a través de WhatsApp).\n- Clave Única de Registro de Población (CURP).\n- Municipio de residencia.\n- Archivos adjuntos solicitados en la convocatoria (fotografías, identificaciones, croquis, comprobantes).');
  
  body.appendParagraph('3. Finalidad del tratamiento').setHeading(DocumentApp.ParagraphHeading.HEADING2);
  body.appendParagraph('Los datos personales serán utilizados exclusivamente para:\n- Gestionar el registro y validación de los solicitantes al programa.\n- Almacenar los expedientes digitales en los servidores de la institución.\n- Notificar al usuario sobre el estatus de su solicitud y entrega de especies vegetales.');
  
  body.appendParagraph('4. Eliminación de datos y Derechos ARCO').setHeading(DocumentApp.ParagraphHeading.HEADING2);
  body.appendParagraph('Usted tiene derecho a conocer qué datos tenemos (Acceso), solicitar correcciones (Rectificación), pedir que los eliminemos (Cancelación) u oponerse a su uso (Oposición). Para ejercer estos derechos o solicitar la eliminación manual de su expediente digital, puede contactar a la Secretaría de Medio Ambiente del Estado de Tlaxcala a través del correo oficial o sus oficinas físicas.');
  
  body.appendParagraph('5. Cambios al aviso de privacidad').setHeading(DocumentApp.ParagraphHeading.HEADING2);
  body.appendParagraph('Este aviso de privacidad puede sufrir modificaciones derivadas de nuevos requerimientos legales o de las reglas de operación del programa.');
  
  body.appendParagraph('\nÚltima actualización: Julio de 2026').setItalic(true);
  
  Logger.log('¡Listo! Tu documento está aquí: ' + doc.getUrl());
}