import { irAlInicio } from './scroll.js';
import { calcularVentana, colocarEnCarta, crearReplica } from './replica.js';

const DURACION = {
  sello: 380,
  banda: 750,
  retrasoBanda: 400,
  puertas: 1100,
  retrasoPuertas: 900,
  carta: 600,
  retrasoCarta: 1600,
  zoom: 1700,
};


const PUNTO_DE_GIRO = 90 / 172;

const EASING = {
  banda: 'cubic-bezier(.5, 0, .75, .4)',
  puertas: 'cubic-bezier(.4, 0, .2, 1)',
  carta: 'cubic-bezier(.3, .1, .2, 1)',
  zoom: 'cubic-bezier(.65, 0, .25, 1)',
};

function sinAnimaciones() {
  const reducirMovimiento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  return reducirMovimiento || typeof Element.prototype.animate !== 'function';
}

function animar(elemento, fotogramas, opciones) {
  return elemento.animate(fotogramas, { fill: 'forwards', ...opciones }).finished;
}

function leerInclinacion(portada) {
  const valor = getComputedStyle(portada).getPropertyValue('--inclinacion');
  return parseFloat(valor) || 0;
}


function hacerZoom({ portada, fondo, contenido, carta, replica, ventana, pantalla, inclinacion }) {
  const caja = carta.getBoundingClientRect();
  const centroX = caja.left + caja.width / 2;
  const centroY = caja.top + caja.height / 2;
  const izquierda = centroX - carta.clientWidth / 2;
  const arriba = centroY - carta.clientHeight / 2;

  const capa = replica.cloneNode(true);
  capa.classList.add('replica--zoom');
  portada.appendChild(capa);

  const girar = (grados) => `translate(${centroX}px, ${centroY}px) rotate(${grados}deg) translate(${-centroX}px, ${-centroY}px)`;
  const inicio = `${girar(inclinacion)} translate(${izquierda - ventana.x * ventana.escala}px, ${arriba - ventana.y * ventana.escala}px) scale(${ventana.escala})`;
  const final = `${girar(0)} translate(0px, 0px) scale(1)`;

  const recorteInicial = `inset(${ventana.y}px ${pantalla.ancho - ventana.x - ventana.ancho}px ${pantalla.alto - ventana.y - ventana.alto}px ${ventana.x}px)`;
  const recorteFinal = 'inset(0px 0px 0px 0px)';
  const base = { duration: DURACION.zoom, easing: EASING.zoom };

  capa.style.transform = inicio;
  capa.style.clipPath = recorteInicial;
  capa.style.webkitClipPath = recorteInicial;

  return Promise.all([
    animar(capa, [{ transform: inicio, clipPath: recorteInicial }, { transform: final, clipPath: recorteFinal }], base),
    animar(fondo, [{ opacity: 1 }, { opacity: 1, offset: 0.25 }, { opacity: 0 }], base),
    animar(contenido, [{ opacity: 1 }, { opacity: 1, offset: 0.2 }, { opacity: 0, offset: 0.7 }, { opacity: 0 }], base),
  ]);
}


function abrirTarjeta({ sello, grieta, banda, puertaIzquierda, puertaDerecha, caras, reversos, sombrasPuertas, sombraCarta, carta }) {
  const puertas = { duration: DURACION.puertas, delay: DURACION.retrasoPuertas, easing: EASING.puertas };


  const giro = PUNTO_DE_GIRO;
  const sombras = [
    ...caras.map((cara) =>
      animar(cara, [{ opacity: 1 }, { opacity: 1, offset: giro }, { opacity: 0, offset: giro + 0.01 }, { opacity: 0 }], puertas),
    ),
    ...reversos.map((reverso) =>
      animar(reverso, [{ opacity: 0 }, { opacity: 0, offset: giro }, { opacity: 1, offset: giro + 0.01 }, { opacity: 1 }], puertas),
    ),
    ...sombrasPuertas.map((sombra) =>
      animar(sombra, [{ opacity: 0 }, { opacity: 0, offset: giro }, { opacity: 0.6, offset: giro + 0.01 }, { opacity: 0 }], puertas),
    ),
    animar(sombraCarta, [{ opacity: 0 }, { opacity: 1, offset: 0.45 }, { opacity: 0 }], puertas),
  ];

  return Promise.all([
    ...sombras,
    animar(
      sello,
      [{ transform: 'scale(1)' }, { transform: 'scale(0.9)', offset: 0.4 }, { transform: 'scale(1.06)' }],
      { duration: DURACION.sello, easing: 'ease-out' },
    ),
    animar(grieta, [{ opacity: 0 }, { opacity: 1 }], { duration: DURACION.sello * 0.6, delay: DURACION.sello * 0.3 }),
    animar(
      banda,
      [
        { transform: 'translateY(0)', opacity: 1 },
        { transform: 'translateY(45%)', opacity: 1, offset: 0.5 },
        { transform: 'translateY(110%)', opacity: 0 },
      ],
      { duration: DURACION.banda, delay: DURACION.retrasoBanda, easing: EASING.banda },
    ),
    animar(puertaIzquierda, [{ transform: 'rotateY(0deg)' }, { transform: 'rotateY(-172deg)' }], puertas),
    animar(puertaDerecha, [{ transform: 'rotateY(0deg)' }, { transform: 'rotateY(172deg)' }], puertas),
    animar(carta, [{ transform: 'translateY(0)' }, { transform: 'translateY(-3%)' }], {
      duration: DURACION.carta,
      delay: DURACION.retrasoCarta,
      easing: EASING.carta,
    }),
  ]);
}

export function iniciarPortada() {
  const portada = document.getElementById('portada');
  if (!portada) return;

  const sobre = document.getElementById('sobre');
  const principal = document.getElementById('invitacion');
  const carta = document.getElementById('carta');
  const piezas = {
    sello: document.getElementById('sello'),
    grieta: document.getElementById('grieta'),
    banda: document.getElementById('banda'),
    puertaIzquierda: document.getElementById('puerta-izquierda'),
    puertaDerecha: document.getElementById('puerta-derecha'),
    caras: Array.from(portada.querySelectorAll('.sobre__cara')),
    reversos: Array.from(portada.querySelectorAll('.sobre__reverso')),
    sombrasPuertas: Array.from(portada.querySelectorAll('.sobre__reverso-sombra')),
    sombraCarta: portada.querySelector('.carta__sombra'),
    carta,
  };

  let abierta = false;

  function terminar() {
    document.getAnimations().forEach((animacion) => {
      const objetivo = animacion.effect && animacion.effect.target;
      if (objetivo && principal.contains(objetivo)) animacion.cancel();
    });
    document.body.classList.remove('con-portada');
    portada.remove();
    irAlInicio();
    principal.setAttribute('tabindex', '-1');
    principal.focus({ preventScroll: true });
    document.dispatchEvent(new CustomEvent('invitacion:abierta'));
  }

  
  function prepararCarta() {
    const { replica, anchoPantalla, altoPantalla } = crearReplica(principal);
    const ventana = calcularVentana({
      anchoPantalla,
      altoPantalla,
      anchoCarta: carta.clientWidth,
      altoCarta: carta.clientHeight,
      principal,
    });
    colocarEnCarta(carta, replica, ventana);
    return { replica, ventana, pantalla: { ancho: anchoPantalla, alto: altoPantalla } };
  }

  async function abrir() {
    if (abierta) return;
    abierta = true;
    portada.classList.add('portada--abriendo');

    if (sinAnimaciones()) {
      terminar();
      return;
    }

    try {
      const { replica, ventana, pantalla } = prepararCarta();
      const inclinacion = leerInclinacion(portada);
      const fondo = portada.querySelector('.portada__fondo');
      const contenido = portada.querySelector('.portada__contenido');

      await abrirTarjeta(piezas);
      await hacerZoom({ portada, fondo, contenido, carta, replica, ventana, pantalla, inclinacion });
    } catch (error) {
      console.error('La animación no se pudo completar:', error);
    } finally {
      terminar();
    }
  }

  sobre.addEventListener('click', abrir);
}
