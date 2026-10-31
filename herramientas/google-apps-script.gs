const NOMBRE_DE_LA_HOJA = 'Confirmaciones';
const NOMBRE_DE_LA_HOJA_DE_INVITACIONES = 'Invitaciones';
const ENCABEZADOS = [
  'Fecha',
  'Nombre',
  'Lleva acompañante',
  'Acompañante',
  'Tiene limitantes',
  'Detalle de la limitante',
  'Asistirá',
  'Espacios',
  'Código',
  'Correo',
  'Veces enviada',
  'Última actualización',
  'ID del dispositivo',
];
const COLUMNA_NOMBRE = 2;
const COLUMNA_CORREO = 10;
const COLUMNA_VECES = 11;
const COLUMNA_DISPOSITIVO = 13;

const INVITACIONES_FIJAS = {
  CXRWMW8J7DUZ: { saludo: '', nombre: '', espacios: 1 },
  ZDMJDZZY96F5: { saludo: '', nombre: '', espacios: 2 },
};
const LARGO_MAXIMO = 5000;
const TAMANO_MAXIMO_DE_SOLICITUD = 30000;
const LARGO_MAXIMO_CORREO = 254;
const FORMATO_DE_CORREO = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)*\.[A-Za-z]{2,}$/;
const COINCIDENCIAS_PARA_REEMPLAZAR = 2;
const ENVIOS_MAXIMOS_POR_MINUTO = 30;
const ENVIOS_MAXIMOS_POR_DISPOSITIVO = 10;
const SEGUNDOS_POR_DISPOSITIVO = 600;
const FORMATO_DE_DISPOSITIVO = /^[A-Za-z0-9-]{8,64}$/;
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
    console.error(String(error));
    return responder({ ok: false, error: 'No se pudo consultar la invitación.' });
  }
}

function doPost(evento) {
  const candado = LockService.getScriptLock();
  let bloqueado = false;

  try {
    const contenido = evento && evento.postData ? String(evento.postData.contents || '') : '';
    if (!contenido || contenido.length > TAMANO_MAXIMO_DE_SOLICITUD) {
      return responder({ ok: false, error: 'Solicitud no válida.' });
    }

    const datos = JSON.parse(contenido);

    if (datos.sitio) return responder({ ok: true });

    if (FECHA_LIMITE && new Date() > new Date(FECHA_LIMITE)) {
      return responder({ ok: false, error: 'El plazo para confirmar terminó.' });
    }

    const invitacion = buscarInvitacion(String(datos.codigo || '').trim());
    if (!invitacion) {
      return responder({ ok: false, error: 'Esta invitación no es válida. Usa el enlace que te enviamos.' });
    }

    const nombre = limpiar(datos.nombre);
    const correo = String(datos.correo || '').trim().toLowerCase();
    if (!nombre || !correoValido(correo)) {
      return responder({ ok: false, error: 'Revisa tu nombre y tu correo electrónico.' });
    }

    const espacios = invitacion.espacios;
    const acompanante = datos.acompanante || {};
    const alimentacion = datos.alimentacion || {};

    if (acompanante.lleva && espacios < 2) {
      return responder({ ok: false, error: 'Esta invitación no incluye acompañante.' });
    }

    candado.waitLock(10000);
    bloqueado = true;

    const dispositivo = FORMATO_DE_DISPOSITIVO.test(String(datos.dispositivo || '')) ? String(datos.dispositivo) : '';

    if (superaElRitmo() || superaElRitmoDelDispositivo(dispositivo)) {
      return responder({ ok: false, error: 'Hay demasiadas solicitudes. Inténtalo de nuevo en unos minutos.' });
    }

    const ahora = new Date();
    const valores = [
      nombre,
      acompanante.lleva ? 'Sí' : 'No',
      limpiar(acompanante.nombre),
      alimentacion.tiene ? 'Sí' : 'No',
      limpiar(alimentacion.detalle),
      datos.asistira === false ? 'No' : 'Sí',
      espacios,
      limpiar(datos.codigo),
      correo,
    ];

    const hoja = obtenerHoja();
    const existente = buscarFila(hoja, { nombre, correo, dispositivo });

    if (existente) {
      const veces = Number(existente.valores[COLUMNA_VECES - 1]) || 1;
      const dispositivoGuardado = dispositivo || String(existente.valores[COLUMNA_DISPOSITIVO - 1] || '');
      hoja.getRange(existente.fila, COLUMNA_NOMBRE, 1, valores.length).setValues([valores]);
      hoja.getRange(existente.fila, COLUMNA_VECES, 1, 3).setValues([[veces + 1, ahora, dispositivoGuardado]]);
    } else {
      hoja.appendRow([ahora, ...valores, 1, ahora, dispositivo]);
    }

    avisarPorCorreo(datos, Boolean(existente));
    return responder({ ok: true });
  } catch (error) {
    console.error(String(error));
    return responder({ ok: false, error: 'No se pudo guardar la confirmación. Inténtalo de nuevo.' });
  } finally {
    if (bloqueado) candado.releaseLock();
  }
}

function correoValido(correo) {
  return correo.length > 0 && correo.length <= LARGO_MAXIMO_CORREO && FORMATO_DE_CORREO.test(correo);
}

function superaElRitmo() {
  const memoria = CacheService.getScriptCache();
  const enviados = Number(memoria.get('envios')) || 0;
  if (enviados >= ENVIOS_MAXIMOS_POR_MINUTO) return true;
  memoria.put('envios', String(enviados + 1), 60);
  return false;
}

function superaElRitmoDelDispositivo(dispositivo) {
  if (!dispositivo) return false;
  const memoria = CacheService.getScriptCache();
  const clave = `dispositivo-${dispositivo}`;
  const enviados = Number(memoria.get(clave)) || 0;
  if (enviados >= ENVIOS_MAXIMOS_POR_DISPOSITIVO) return true;
  memoria.put(clave, String(enviados + 1), SEGUNDOS_POR_DISPOSITIVO);
  return false;
}

function claveDeNombre(valor) {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function claveDeCorreo(valor) {
  return String(valor || '').trim().toLowerCase();
}

function buscarFila(hoja, { nombre, correo, dispositivo }) {
  const ultima = hoja.getLastRow();
  if (ultima < 2) return null;

  const nombreBuscado = claveDeNombre(nombre);
  const correoBuscado = claveDeCorreo(correo);
  const filas = hoja.getRange(2, 1, ultima - 1, ENCABEZADOS.length).getValues();

  for (let i = 0; i < filas.length; i += 1) {
    const mismoDispositivo = Boolean(dispositivo) && String(filas[i][COLUMNA_DISPOSITIVO - 1] || '') === dispositivo;
    const mismoCorreo = claveDeCorreo(filas[i][COLUMNA_CORREO - 1]) === correoBuscado;
    const mismoNombre = claveDeNombre(filas[i][COLUMNA_NOMBRE - 1]) === nombreBuscado;
    const coincidencias = [mismoDispositivo, mismoCorreo, mismoNombre].filter(Boolean).length;
    if (coincidencias >= COINCIDENCIAS_PARA_REEMPLAZAR) return { fila: i + 2, valores: filas[i] };
  }
  return null;
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

function avisarPorCorreo(datos, actualizada) {
  if (CORREOS_A_AVISAR.length === 0) return;

  let cuerpo;
  let asunto;
  const prefijo = actualizada ? 'Actualización: ' : '';
  if (datos.asistira === false) {
    asunto = `${prefijo}No podrá asistir: ${limpiar(datos.nombre)}`;
    cuerpo = `${limpiar(datos.nombre)} avisó que no podrá asistir.`;
  } else {
    const acompanante = datos.acompanante && datos.acompanante.lleva ? limpiar(datos.acompanante.nombre) : 'sin acompañante';
    const limitantes = datos.alimentacion && datos.alimentacion.tiene ? limpiar(datos.alimentacion.detalle) : 'ninguna';
    asunto = `${prefijo}Nueva confirmación: ${limpiar(datos.nombre)}`;
    cuerpo = `${limpiar(datos.nombre)} confirmó su asistencia.\n\nAcompañante: ${acompanante}\nLimitantes con alimentos: ${limitantes}`;
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
