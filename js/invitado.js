const MAX_ESPACIOS = 2;

function limpiar(texto) {
  return String(texto || '').replace(/\s+/g, ' ').trim().slice(0, 80);
}

const CODIGO_VALIDO = /^[A-Za-z0-9_-]{6,40}$/;
const TIEMPO_DE_CONSULTA_MS = 6000;

export const INVITADO_BASE = Object.freeze({ saludo: '', nombre: '', espacios: 1, codigo: '' });


export function leerCodigo(busqueda = window.location.search) {
  const codigo = (new URLSearchParams(busqueda).get('c') || '').trim();
  return CODIGO_VALIDO.test(codigo) ? codigo : '';
}


export async function consultarInvitado(urlHoja, codigo, { limiteMs = TIEMPO_DE_CONSULTA_MS, consultar = globalThis.fetch } = {}) {
  const controlador = new AbortController();
  const temporizador = setTimeout(() => controlador.abort(), limiteMs);

  try {
    const respuesta = await consultar(`${urlHoja}?inv=${encodeURIComponent(codigo)}`, { signal: controlador.signal });
    if (!respuesta.ok) return null;

    const datos = await respuesta.json();
    if (!datos || datos.ok !== true || datos.encontrado !== true) return null;

    const espacios = Number.parseInt(datos.espacios, 10);
    return {
      saludo: limpiar(datos.saludo),
      nombre: limpiar(datos.nombre),
      espacios: Number.isFinite(espacios) ? Math.min(MAX_ESPACIOS, Math.max(1, espacios)) : 1,
    };
  } catch (error) {
    return null;
  } finally {
    clearTimeout(temporizador);
  }
}


export function leerInvitado(busqueda = window.location.search) {
  const parametros = new URLSearchParams(busqueda);
  const pedidos = Number.parseInt(parametros.get('espacios'), 10);
  const espacios = Number.isFinite(pedidos) ? Math.min(MAX_ESPACIOS, Math.max(1, pedidos)) : 1;

  return {
    saludo: limpiar(parametros.get('para')),
    nombre: limpiar(parametros.get('nombre')),
    espacios,
  };
}

export function textosDeEspacios(espacios) {
  if (espacios >= 2) {
    return {
      titulo: 'Dos lugares para ustedes',
      nota: 'Hemos reservado dos lugares: uno para ti y otro para la persona que quieras que te acompañe.',
    };
  }
  return {
    titulo: 'Un lugar para ti',
    nota: 'Hemos reservado un lugar para ti en nuestra celebración, para compartir este día tan especial.',
  };
}


export function aplicarInvitado(invitado, raiz = document) {
  const { titulo, nota } = textosDeEspacios(invitado.espacios);
  raiz.querySelectorAll('[data-espacios-titulo]').forEach((nodo) => {
    nodo.textContent = titulo;
  });
  raiz.querySelectorAll('[data-espacios-nota]').forEach((nodo) => {
    nodo.textContent = nota;
  });
  raiz.querySelectorAll('[data-lugares]').forEach((nodo) => {
    nodo.replaceChildren(
      ...Array.from({ length: invitado.espacios >= 2 ? 2 : 1 }, () => {
        const lugar = document.createElement('span');
        lugar.className = 'lugar';
        return lugar;
      }),
    );
  });

  if (!invitado.saludo) return;

  raiz.querySelectorAll('[data-saludo]').forEach((nodo) => {
    nodo.textContent = `Para ${invitado.saludo}`;
    nodo.hidden = false;
  });
  raiz.querySelectorAll('[data-saludo-portada]').forEach((nodo) => {
    nodo.textContent = `Una invitación para ${invitado.saludo}`;
  });
}
