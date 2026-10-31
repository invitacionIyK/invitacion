export function marcarImagenesCargando(raiz) {
  raiz.querySelectorAll('img').forEach((imagen) => {
    if (imagen.complete && imagen.naturalWidth > 0) return;

    imagen.dataset.cargando = '';
    const terminar = () => imagen.removeAttribute('data-cargando');
    imagen.addEventListener('load', terminar, { once: true });
    imagen.addEventListener('error', terminar, { once: true });
  });
}

export function marcarConsultando(raiz, activo) {
  if (raiz) raiz.toggleAttribute('data-consultando', activo);
}
