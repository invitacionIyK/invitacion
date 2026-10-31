const TIEMPO_MAXIMO_MS = 15000;


export function construirMensaje(datos, { conAcompanante = true } = {}) {
  if (!datos.asistira) {
    return [
      'Hola, lamento avisar que no podré asistir a la boda de Ivan y Katherine.',
      '',
      `Nombre: ${datos.nombre}`,
    ].join('\n');
  }

  const acompanante = datos.acompanante.lleva ? datos.acompanante.nombre : 'No';
  const limitantes = datos.alimentacion.tiene ? datos.alimentacion.detalle : 'Ninguna';

  return [
    '¡Hola! Confirmo mi asistencia a la boda de Ivan y Katherine.',
    '',
    `Nombre: ${datos.nombre}`,
    ...(conAcompanante ? [`Acompañante: ${acompanante}`] : []),
    `Alergias o limitantes con alimentos: ${limitantes}`,
  ].join('\n');
}

export function enlaceWhatsapp(telefono, datos, opciones) {
  return `https://wa.me/${telefono}?text=${encodeURIComponent(construirMensaje(datos, opciones))}`;
}

export function enlaceWhatsappGeneral(telefono) {
  const texto = 'Hola, quiero avisarles sobre mi asistencia a la boda de Ivan y Katherine.';
  return `https://wa.me/${telefono}?text=${encodeURIComponent(texto)}`;
}


export async function enviarAHoja(url, datos, extra = {}) {
  const controlador = new AbortController();
  const temporizador = setTimeout(() => controlador.abort(), TIEMPO_MAXIMO_MS);

  try {
    const respuesta = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ ...datos, ...extra }),
      signal: controlador.signal,
    });

    if (!respuesta.ok) throw new Error(`El servicio respondió con el código ${respuesta.status}.`);

    let resultado;
    try {
      resultado = await respuesta.json();
    } catch (error) {
      throw new Error('El servicio no respondió lo esperado: revisa que el script esté bien publicado.');
    }

    if (!resultado || resultado.ok !== true) {
      throw new Error((resultado && resultado.error) || 'El servicio no guardó la confirmación.');
    }
  } finally {
    clearTimeout(temporizador);
  }
}
