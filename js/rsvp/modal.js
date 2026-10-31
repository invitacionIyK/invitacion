const ENFOCABLES = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'textarea:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');


export function crearModal(raiz, { fondo = [] } = {}) {
  const panel = raiz.querySelector('[role="dialog"]');
  let enfocadoAntes = null;
  let abierto = false;

  function enfocables() {
    return Array.from(panel.querySelectorAll(ENFOCABLES)).filter((elemento) => !elemento.closest('[hidden]'));
  }

  function alTeclear(evento) {
    if (evento.key === 'Escape') {
      cerrar();
      return;
    }
    if (evento.key !== 'Tab') return;

    const lista = enfocables();
    if (lista.length === 0) return;
    const primero = lista[0];
    const ultimo = lista[lista.length - 1];

    if (evento.shiftKey && document.activeElement === primero) {
      evento.preventDefault();
      ultimo.focus();
    } else if (!evento.shiftKey && document.activeElement === ultimo) {
      evento.preventDefault();
      primero.focus();
    }
  }


  function abrir(disparador) {
    if (abierto) return;
    abierto = true;
    enfocadoAntes = disparador || document.activeElement;

    raiz.hidden = false;
    document.body.classList.add('modal-abierto');
    fondo.forEach((elemento) => {
      elemento.inert = true;
    });
    document.addEventListener('keydown', alTeclear);

    requestAnimationFrame(() => {
      raiz.classList.add('rsvp--visible');
      panel.focus({ preventScroll: true });
    });
  }

  function cerrar() {
    if (!abierto) return;
    abierto = false;

    raiz.classList.remove('rsvp--visible');
    raiz.hidden = true;
    document.body.classList.remove('modal-abierto');
    fondo.forEach((elemento) => {
      elemento.inert = false;
    });
    document.removeEventListener('keydown', alTeclear);

    if (enfocadoAntes && typeof enfocadoAntes.focus === 'function') {
      enfocadoAntes.focus({ preventScroll: true });
    }
  }

  raiz.querySelectorAll('[data-cerrar-rsvp]').forEach((elemento) => {
    elemento.addEventListener('click', cerrar);
  });

  return { abrir, cerrar, panel, estaAbierto: () => abierto };
}
