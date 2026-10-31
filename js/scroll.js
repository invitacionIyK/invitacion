export function irAlInicio() {
  const raiz = document.documentElement;
  const comportamiento = raiz.style.scrollBehavior;
  raiz.style.scrollBehavior = 'auto';
  window.scrollTo(0, 0);
  raiz.style.scrollBehavior = comportamiento;
}


export function empezarSiempreArriba() {
  if ('scrollRestoration' in window.history) window.history.scrollRestoration = 'manual';


  if (window.location.hash) {
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }
  irAlInicio();


  window.addEventListener('load', () => {
    if (document.body.classList.contains('con-portada')) irAlInicio();
  });
  window.addEventListener('pageshow', (evento) => {
    if (evento.persisted) irAlInicio();
  });
}
