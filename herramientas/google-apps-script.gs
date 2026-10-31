const NOMBRE_DE_LA_HOJA = 'Confirmaciones';
const NOMBRE_DE_LA_HOJA_DE_INVITACIONES = 'Invitaciones';
const ENCABEZADOS = [
  'Fecha',
  'Nombre',
  'Lleva acompañante',
  'Acompañante',
  'Tiene limitantes',
  'Detalle de la limitante',
  'Invitación',
  'Asistirá',
  'Espacios',
  'Código',
];
const INVITACIONES_FIJAS = {
  CXRWMW8J7DUZ: { saludo: '', nombre: '', espacios: 1 },
  ZDMJDZZY96F5: { saludo: '', nombre: '', espacios: 2 },
};
const LARGO_MAXIMO = 5000;
const CORREOS_A_AVISAR = [];

const FECHA_LIMITE = '2026-11-22T05:59:59Z';

function doGet(evento) {
  const codigo = evento && evento.parameter ? String(evento.parameter.inv || '').trim() : '';
  if (!codigo) {
    return responder({ ok: true, mensaje: 'La hoja de confirmaciones está lista para recibir respuestas.' });
  }

  try {
    const invitacion = buscarInvitacion(codigo);
    if (!invitacion) return responder({ ok: true, encontrado: false });
    return responder({ ok: true, encontrado: true, saludo: invitacion.saludo, nombre: invitacion.nombre, espacios: invitacion.espacios });
  } catch (error) {
    return responder({ ok: false, error: String(error) });
  }
}

function doPost(evento) {
  try {
    const datos = JSON.parse(evento.postData.contents);

    if (datos.sitio) return responder({ ok: true });

    if (FECHA_LIMITE && new Date() > new Date(FECHA_LIMITE)) {
      return responder({ ok: false, error: 'El plazo para confirmar terminó.' });
    }

    const invitacion = buscarInvitacion(String(datos.codigo || '').trim());
    const espacios = invitacion ? invitacion.espacios : 1;

    const acompanante = datos.acompanante || {};
    const alimentacion = datos.alimentacion || {};

    if (acompanante.lleva && espacios < 2) {
      return responder({ ok: false, error: 'Esta invitación no incluye acompañante.' });
    }

    obtenerHoja().appendRow([
      new Date(),
      limpiar(datos.nombre),
      acompanante.lleva ? 'Sí' : 'No',
      limpiar(acompanante.nombre),
      alimentacion.tiene ? 'Sí' : 'No',
      limpiar(alimentacion.detalle),
      limpiar(invitacion && invitacion.saludo ? invitacion.saludo : datos.invitacion),
      datos.asistira === false ? 'No' : 'Sí',
      espacios,
      limpiar(datos.codigo),
    ]);

    avisarPorCorreo(datos);
    return responder({ ok: true });
  } catch (error) {
    return responder({ ok: false, error: String(error) });
  }
}

function buscarInvitacion(codigo) {
  if (!codigo) return null;

  if (Object.prototype.hasOwnProperty.call(INVITACIONES_FIJAS, codigo)) return INVITACIONES_FIJAS[codigo];

  const hoja = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(NOMBRE_DE_LA_HOJA_DE_INVITACIONES);
  if (!hoja || hoja.getLastRow() < 2) return null;

  const filas = hoja.getRange(2, 1, hoja.getLastRow() - 1, 4).getValues();
  for (let i = 0; i < filas.length; i += 1) {
    if (String(filas[i][0]).trim() === codigo) {
      const espacios = Number(filas[i][3]);
      return {
        saludo: String(filas[i][1] || '').trim(),
        nombre: String(filas[i][2] || '').trim(),
        espacios: espacios >= 2 ? 2 : 1,
      };
    }
  }
  return null;
}

function obtenerHoja() {
  const libro = SpreadsheetApp.getActiveSpreadsheet();
  let hoja = libro.getSheetByName(NOMBRE_DE_LA_HOJA);

  if (!hoja) {
    hoja = libro.insertSheet(NOMBRE_DE_LA_HOJA);
    hoja.setFrozenRows(1);
  }

  const actuales = hoja.getRange(1, 1, 1, ENCABEZADOS.length).getValues()[0];
  ENCABEZADOS.forEach((encabezado, indice) => {
    if (!actuales[indice]) {
      hoja.getRange(1, indice + 1).setValue(encabezado).setFontWeight('bold');
    }
  });

  return hoja;
}

function avisarPorCorreo(datos) {
  if (CORREOS_A_AVISAR.length === 0) return;

  let cuerpo;
  let asunto;
  if (datos.asistira === false) {
    asunto = `No podrá asistir: ${datos.nombre}`;
    cuerpo = `${datos.nombre} avisó que no podrá asistir.`;
  } else {
    const acompanante = datos.acompanante && datos.acompanante.lleva ? datos.acompanante.nombre : 'sin acompañante';
    const limitantes = datos.alimentacion && datos.alimentacion.tiene ? datos.alimentacion.detalle : 'ninguna';
    asunto = `Nueva confirmación: ${datos.nombre}`;
    cuerpo = `${datos.nombre} confirmó su asistencia.\n\nAcompañante: ${acompanante}\nLimitantes con alimentos: ${limitantes}`;
  }

  MailApp.sendEmail({ to: CORREOS_A_AVISAR.join(','), subject: asunto, body: cuerpo });
}

function limpiar(valor) {
  const texto = String(valor || '').trim().slice(0, LARGO_MAXIMO);
  return /^[=+\-@]/.test(texto) ? `'${texto}` : texto;
}

function responder(objeto) {
  return ContentService.createTextOutput(JSON.stringify(objeto)).setMimeType(ContentService.MimeType.JSON);
}
