function limitar(valor, minimo, maximo) {
  return Math.min(Math.max(valor, minimo), maximo);
}

function medirBarraDeScroll() {
  const sonda = document.createElement('div');
  sonda.style.cssText = 'position:absolute;top:-9999px;width:100px;height:100px;overflow:scroll';
  document.body.appendChild(sonda);
  const ancho = sonda.offsetWidth - sonda.clientWidth;
  sonda.remove();
  return ancho;
}

function volverDecorativo(copia) {
  copia.removeAttribute('id');
  copia.removeAttribute('tabindex');
  copia.querySelectorAll('[id]').forEach((nodo) => nodo.removeAttribute('id'));
  copia.querySelectorAll('a, button').forEach((nodo) => nodo.setAttribute('tabindex', '-1'));
  copia.setAttribute('aria-hidden', 'true');
  copia.inert = true;
}


export function crearReplica(principal) {
  const anchoPantalla = document.documentElement.clientWidth;
  const altoPantalla = window.innerHeight;

  const copia = principal.cloneNode(true);
  volverDecorativo(copia);


  const ancho = anchoPantalla - medirBarraDeScroll();

  const pagina = document.createElement('div');
  pagina.className = 'replica__pagina';
  pagina.style.width = `${ancho}px`;
  pagina.appendChild(copia);

  const replica = document.createElement('div');
  replica.className = 'replica';
  replica.style.width = `${ancho}px`;
  replica.style.height = `${altoPantalla}px`;
  replica.appendChild(pagina);

  return { replica, anchoPantalla: ancho, altoPantalla };
}


export function calcularVentana({ anchoPantalla, altoPantalla, anchoCarta, altoCarta, principal }) {
  const escala = Math.max(anchoCarta / anchoPantalla, altoCarta / altoPantalla);
  const anchoVentana = anchoCarta / escala;
  const altoVentana = altoCarta / escala;

  const inicio = principal.querySelector('[data-portada="inicio"]');
  const fin = principal.querySelector('[data-portada="fin"]');
  const centroDelBloque =
    inicio && fin ? (inicio.getBoundingClientRect().top + fin.getBoundingClientRect().bottom) / 2 : altoVentana / 2;

  return {
    escala,
    x: (anchoPantalla - anchoVentana) / 2,
    y: limitar(centroDelBloque - altoVentana / 2, 0, altoPantalla - altoVentana),
    ancho: anchoVentana,
    alto: altoVentana,
  };
}


export function colocarEnCarta(carta, replica, ventana) {
  replica.style.transform = `translate(${-ventana.x * ventana.escala}px, ${-ventana.y * ventana.escala}px) scale(${ventana.escala})`;
  carta.prepend(replica);
}
