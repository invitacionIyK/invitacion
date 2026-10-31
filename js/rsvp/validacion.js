import { contarPalabras } from './palabras.js';

const LARGO_MAXIMO_NOMBRE = 100;
const SOLO_LETRAS_Y_SIGNOS_DE_NOMBRE = /^[\p{L}\p{M}'’.\- ]+$/u;

function normalizar(texto) {
  return String(texto || '').replace(/\s+/g, ' ').trim();
}

function errorDeNombre(nombre, quien) {
  if (!nombre) return `Escribe el nombre completo ${quien}.`;
  if (nombre.length > LARGO_MAXIMO_NOMBRE) return 'El nombre es demasiado largo.';
  if (!SOLO_LETRAS_Y_SIGNOS_DE_NOMBRE.test(nombre)) return 'Usa solo letras en el nombre.';
  if (nombre.split(' ').length < 2) return 'Incluye nombre y apellido.';
  return '';
}


export function validarFormulario(entrada, { maxPalabras = 500, permiteAcompanante = true } = {}) {
  const errores = {};

  const nombre = normalizar(entrada.nombre);
  const mensajeNombre = errorDeNombre(nombre, 'de quien confirma');
  if (mensajeNombre) errores.nombre = mensajeNombre;

  const asistira = entrada.asistira;
  if (asistira === null || asistira === undefined) errores.asistira = 'Elige una opción.';

  const datos = {
    nombre,
    asistira: asistira === true,
    acompanante: { lleva: false, nombre: '' },
    alimentacion: { tiene: false, detalle: '' },
  };

  if (asistira !== true) {
    return { valido: Object.keys(errores).length === 0, errores, datos };
  }

  if (permiteAcompanante) {
    const llevaAcompanante = entrada.acompanante.lleva;
    if (llevaAcompanante === null || llevaAcompanante === undefined) {
      errores.acompanante = 'Elige una opción.';
    } else if (llevaAcompanante) {
      const nombreAcompanante = normalizar(entrada.acompanante.nombre);
      const mensaje = errorDeNombre(nombreAcompanante, 'del acompañante');
      if (mensaje) errores.nombreAcompanante = mensaje;
      datos.acompanante = { lleva: true, nombre: nombreAcompanante };
    }
  }

  const tieneLimitante = entrada.alimentacion.tiene;
  if (tieneLimitante === null || tieneLimitante === undefined) {
    errores.alimentacion = 'Elige una opción.';
  } else if (tieneLimitante) {
    const detalle = String(entrada.alimentacion.detalle || '').trim();
    if (!detalle) errores.detalle = 'Cuéntanos cuál es la limitante.';
    else if (contarPalabras(detalle) > maxPalabras) errores.detalle = `Máximo ${maxPalabras} palabras.`;
    datos.alimentacion = { tiene: true, detalle };
  }

  return { valido: Object.keys(errores).length === 0, errores, datos };
}
