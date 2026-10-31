const CLASE_OCULTA = 'revelar';
const CLASE_VISIBLE = 'revelar--visible';


export function iniciarRevelado(raiz = document.getElementById('invitacion')) {
  const sinMovimiento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!raiz || sinMovimiento || !('IntersectionObserver' in window)) return;

  const altoDePantalla = window.innerHeight;
  const observador = new IntersectionObserver(
    (entradas) => {
      entradas.forEach((entrada) => {
        if (!entrada.isIntersecting) return;
        entrada.target.classList.add(CLASE_VISIBLE);
        observador.unobserve(entrada.target);
      });
    },
    { threshold: 0.06, rootMargin: '0px 0px -6% 0px' },
  );

  raiz.querySelectorAll(':scope > .seccion').forEach((seccion) => {

    if (seccion.getBoundingClientRect().top < altoDePantalla) return;
    seccion.classList.add(CLASE_OCULTA);
    observador.observe(seccion);
  });
}
