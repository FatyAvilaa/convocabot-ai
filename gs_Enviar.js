/*******************************************************
 * ENVIAR MENSAJE A WHATSAPP
 *******************************************************/
function enviarMensaje(telefono, texto) {
  const props = PropertiesService.getScriptProperties();
  const token = props.getProperty('WA_TOKEN');
  const phoneId = props.getProperty('WA_PHONE_ID');

  const url = `https://graph.facebook.com/v19.0/${phoneId}/messages`;

  const respuesta = UrlFetchApp.fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json'
    },
    payload: JSON.stringify({
      messaging_product: 'whatsapp',
      to: telefono,
      type: 'text',
      text: { body: texto }
    }),
    muteHttpExceptions: true
  });

  const codigo = respuesta.getResponseCode();
  const cuerpo = respuesta.getContentText();

  if (codigo !== 200) {
    console.log('Error al enviar mensaje: ' + codigo + ' — ' + cuerpo);
  }

  return codigo === 200;
}


function enviarBotones(telefono, texto, opciones) {
  const props = PropertiesService.getScriptProperties();
  const token = props.getProperty('WA_TOKEN');
  const phoneId = props.getProperty('WA_PHONE_ID');

  // Si hay más de 3 opciones usar lista, si hay 2-3 usar botones
  const url = `https://graph.facebook.com/v19.0/${phoneId}/messages`;

  let payload;

  if (opciones.length <= 3) {
    // botones (máximo 3)
    payload = {
      messaging_product: 'whatsapp',
      to: telefono,
      type: 'interactive',
      interactive: {
        type: 'button',
        body: { text: texto },
        action: {
          buttons: opciones.map((op, i) => ({
            type: 'reply',
            reply: {
              id: op.valor || op,
              title: (op.etiqueta || op).substring(0, 20)
            }
          }))
        }
      }
    };
  } else {
    // lista (máximo 10)
    payload = {
      messaging_product: 'whatsapp',
      to: telefono,
      type: 'interactive',
      interactive: {
        type: 'list',
        body: { text: texto },
        action: {
          button: 'Ver opciones',
          sections: [{
            title: 'Opciones',
            rows: opciones.slice(0, 10).map((op, i) => ({
              id: op.valor || op,
              title: (op.etiqueta || op).substring(0, 24)
            }))
          }]
        }
      }
    };
  }

  UrlFetchApp.fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json'
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
}


