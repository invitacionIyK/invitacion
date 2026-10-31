const ESPACIO_DE_NOMBRES = 'http://www.w3.org/2000/svg';

export function crearIcono(nombre) {
  const svg = document.createElementNS(ESPACIO_DE_NOMBRES, 'svg');
  svg.setAttribute('class', 'icono');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');

  const uso = document.createElementNS(ESPACIO_DE_NOMBRES, 'use');
  uso.setAttribute('href', `#i-${nombre}`);
  svg.append(uso);
  return svg;
}
