const fs = require('fs');
const path = require('path');

const PAPEL = '#faf8f2';
const ORO = '#b39a58';
const ORO_CLARO = '#d9c58a';

const r = (n) => Math.round(n * 100) / 100;
const destino = (nombre) => path.join(__dirname, '..', 'assets', 'img', nombre);



const ANCHO_RAMA = 220;
const ALTO_RAMA = 280;
const CURVA = [
  { x: 14, y: 272 },
  { x: 22, y: 200 },
  { x: 62, y: 108 },
  { x: 156, y: 16 },
];

function puntoDeLaCurva(t) {
  const [a, b, c, d] = CURVA;
  const u = 1 - t;
  const x = u ** 3 * a.x + 3 * u ** 2 * t * b.x + 3 * u * t ** 2 * c.x + t ** 3 * d.x;
  const y = u ** 3 * a.y + 3 * u ** 2 * t * b.y + 3 * u * t ** 2 * c.y + t ** 3 * d.y;
  const dx = 3 * u ** 2 * (b.x - a.x) + 6 * u * t * (c.x - b.x) + 3 * t ** 2 * (d.x - c.x);
  const dy = 3 * u ** 2 * (b.y - a.y) + 6 * u * t * (c.y - b.y) + 3 * t ** 2 * (d.y - c.y);
  return { x, y, angulo: Math.atan2(dy, dx) };
}


function hoja(x, y, angulo, largo, relleno) {
  const ancho = largo * 0.21;
  const g = (n) => r(n);
  return (
    `<g transform="translate(${g(x)} ${g(y)}) rotate(${r((angulo * 180) / Math.PI)})">` +
    `<path d="M0 0 C${g(largo * 0.22)} ${g(-ancho)} ${g(largo * 0.68)} ${g(-ancho * 1.1)} ${g(largo)} 0 C${g(largo * 0.68)} ${g(ancho * 0.85)} ${g(largo * 0.22)} ${g(ancho)} 0 0Z" fill="url(#${relleno})" stroke="#8d9b78" stroke-opacity="0.55" stroke-width="0.6"/>` +
    `<path d="M${g(largo * 0.08)} 0 L${g(largo * 0.9)} 0" fill="none" stroke="#ffffff" stroke-opacity="0.55" stroke-width="0.7"/>` +
    '</g>'
  );
}

function destello(x, y, tamano) {
  const t = tamano;
  return `<path transform="translate(${x} ${y})" d="M0 ${-t} L${r(t * 0.2)} ${r(-t * 0.2)} L${t} 0 L${r(t * 0.2)} ${r(t * 0.2)} L0 ${t} L${r(-t * 0.2)} ${r(t * 0.2)} L${-t} 0 L${r(-t * 0.2)} ${r(-t * 0.2)}Z" fill="${ORO}"/>`;
}

function crearRama() {
  const rellenos = ['verde', 'oliva', 'champan'];
  let hojas = '';
  const nodos = [0.16, 0.27, 0.38, 0.49, 0.6, 0.71, 0.82, 0.93];

  nodos.forEach((t, indice) => {
    const punto = puntoDeLaCurva(t);
    const lado = indice % 2 === 0 ? 1 : -1;
    const largo = 20 + 30 * Math.sin(Math.PI * Math.min(1, t * 1.05)) ** 0.7;
    hojas += hoja(punto.x, punto.y, punto.angulo + lado * 0.95, largo, rellenos[indice % 3]);
    if (indice % 2 === 1) hojas += hoja(punto.x, punto.y, punto.angulo - lado * 0.8, largo * 0.72, rellenos[(indice + 1) % 3]);
  });

  const punta = puntoDeLaCurva(1);
  hojas += hoja(punta.x, punta.y, punta.angulo, 30, 'oliva');

  const [a, b, c, d] = CURVA;
  const tallo = `<path d="M${a.x} ${a.y} C${b.x} ${b.y} ${c.x} ${c.y} ${d.x} ${d.y}" fill="none" stroke="#7f8f6a" stroke-width="1.6" stroke-linecap="round"/>`;
  const destellos = destello(30, 96, 4.5) + destello(176, 70, 3.2) + destello(112, 160, 2.6) + `<circle cx="196" cy="34" r="1.3" fill="${ORO}"/><circle cx="52" cy="40" r="1.1" fill="${ORO}"/>`;

  const contenido = `${tallo}${hojas}${destellos}`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${ANCHO_RAMA}" height="${ALTO_RAMA}" viewBox="0 0 ${ANCHO_RAMA} ${ALTO_RAMA}">
  <defs>
    <linearGradient id="verde" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#a7b690"/><stop offset="1" stop-color="#d4d8b8"/></linearGradient>
    <linearGradient id="oliva" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#b9c0a0"/><stop offset="1" stop-color="#8f9f78"/></linearGradient>
    <linearGradient id="champan" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#d8d3b0"/><stop offset="1" stop-color="#b3b793"/></linearGradient>
  </defs>
  ${contenido}
</svg>
`;
}



function crearFlor() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="26" viewBox="0 0 64 26">
  <defs><linearGradient id="oro" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${ORO_CLARO}"/><stop offset="1" stop-color="${ORO}"/></linearGradient></defs>
  <rect x="14" y="3" width="36" height="20" rx="10" fill="${PAPEL}"/>
  <g transform="translate(32 13)" fill="url(#oro)">
    <path d="M0 -9 C3.4 -5 3.4 -1 0 4 C-3.4 -1 -3.4 -5 0 -9Z"/>
    <path d="M-3.5 1.5 C-9 -4.5 -14 -2 -12.5 2.5 C-9.5 4.5 -6 3.5 -3.5 1.5Z"/>
    <path d="M3.5 1.5 C9 -4.5 14 -2 12.5 2.5 C9.5 4.5 6 3.5 3.5 1.5Z"/>
    <path d="M-2.5 5 L0 9 L2.5 5 Z"/>
    <circle cx="-20" cy="0" r="1.1"/><circle cx="20" cy="0" r="1.1"/>
    <circle cx="-24" cy="0" r="0.8"/><circle cx="24" cy="0" r="0.8"/>
  </g>
</svg>
`;
}

function crearLateral() {
  const puntos = [10, 16, 22, 58, 64, 70].map((y) => `<circle cx="7" cy="${y}" r="0.9" fill="${ORO}"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="80" viewBox="0 0 14 80">
  <rect x="0" y="30" width="14" height="20" rx="7" fill="${PAPEL}"/>
  <path transform="translate(7 40)" d="M0 -6.5 L1.4 -1.4 L6.5 0 L1.4 1.4 L0 6.5 L-1.4 1.4 L-6.5 0 L-1.4 -1.4Z" fill="${ORO}"/>
  ${puntos}
</svg>
`;
}

fs.writeFileSync(destino('rama.svg'), crearRama());
fs.writeFileSync(destino('adorno-flor.svg'), crearFlor());
fs.writeFileSync(destino('adorno-lateral.svg'), crearLateral());
console.log('Adornos generados en assets/img/: rama, adorno-flor, adorno-lateral');
