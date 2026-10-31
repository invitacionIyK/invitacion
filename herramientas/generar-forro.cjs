const fs = require('fs');
const path = require('path');

const LADO = 240;
const SEMILLA = 11;
const CELDAS = 3;

const PALETA = {
  trazo: '#7d9670',
  relleno: '#d6e0c9',
  rellenoDorado: '#ecdcae',
  centro: '#b9a06a',
};

function mulberry32(semilla) {
  let a = semilla;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const azar = mulberry32(SEMILLA);
const entre = (min, max) => min + azar() * (max - min);
const redondear = (n) => Math.round(n * 100) / 100;

function crearRama(x, y, angulo, largo, pasos) {
  const puntos = [{ x, y, angulo }];
  const paso = largo / pasos;
  let a = angulo;
  for (let i = 0; i < pasos; i += 1) {
    a += entre(-0.3, 0.3);
    x += Math.cos(a) * paso;
    y += Math.sin(a) * paso;
    puntos.push({ x, y, angulo: a });
  }
  return puntos;
}

function trazoSuave(puntos) {
  let d = `M${redondear(puntos[0].x)} ${redondear(puntos[0].y)}`;
  for (let i = 0; i < puntos.length - 1; i += 1) {
    const p0 = puntos[Math.max(0, i - 1)];
    const p1 = puntos[i];
    const p2 = puntos[i + 1];
    const p3 = puntos[Math.min(puntos.length - 1, i + 2)];
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C${redondear(c1x)} ${redondear(c1y)} ${redondear(c2x)} ${redondear(c2y)} ${redondear(p2.x)} ${redondear(p2.y)}`;
  }
  return d;
}

const grados = (rad) => redondear((rad * 180) / Math.PI);

function hoja(x, y, angulo, largo) {
  const l = largo;
  const a = l * 0.28;
  return `<path transform="translate(${redondear(x)} ${redondear(y)}) rotate(${grados(angulo)})" d="M0 0 C${redondear(l * 0.2)} ${redondear(-a)} ${redondear(l * 0.7)} ${redondear(-a)} ${redondear(l)} 0 C${redondear(l * 0.7)} ${redondear(a)} ${redondear(l * 0.2)} ${redondear(a)} 0 0Z" fill="${PALETA.relleno}"/>`;
}

function flor(x, y, angulo, radio) {
  const dorada = azar() < 0.4;
  const r = radio;
  const petalo = `M0 0 C${redondear(-r * 0.75)} ${redondear(-r * 0.5)} ${redondear(-r * 0.55)} ${redondear(-r * 1.3)} 0 ${redondear(-r * 1.4)} C${redondear(r * 0.55)} ${redondear(-r * 1.3)} ${redondear(r * 0.75)} ${redondear(-r * 0.5)} 0 0Z`;
  let petalos = '';
  for (let k = 0; k < 5; k += 1) {
    petalos += `<path transform="rotate(${redondear(k * 72)})" d="${petalo}"/>`;
  }
  return `<g transform="translate(${redondear(x)} ${redondear(y)}) rotate(${grados(angulo)})" fill="${dorada ? PALETA.rellenoDorado : PALETA.relleno}">${petalos}<circle r="${redondear(r * 0.28)}" fill="${PALETA.centro}" stroke="none"/></g>`;
}

function campanilla(x, y, angulo, tamano) {
  const s = tamano;
  return `<path transform="translate(${redondear(x)} ${redondear(y)}) rotate(${grados(angulo)}) scale(${redondear(s)})" d="M0 0 C-2.4 1.2 -3.2 4 -2.4 6.4 C-1.2 5.6 1.2 5.6 2.4 6.4 C3.2 4 2.4 1.2 0 0Z" fill="${PALETA.relleno}"/>`;
}

function capullo(x, y, angulo, tamano) {
  return `<ellipse transform="translate(${redondear(x)} ${redondear(y)}) rotate(${grados(angulo)})" cx="${redondear(tamano)}" cy="0" rx="${redondear(tamano)}" ry="${redondear(tamano * 0.58)}" fill="${PALETA.relleno}"/>`;
}

function ramitaConAdorno(punto, lado) {
  const abertura = entre(0.7, 1.15) * lado;
  const anguloDeSalida = punto.angulo + abertura;
  const largo = entre(8, 17);
  const fin = {
    x: punto.x + Math.cos(anguloDeSalida) * largo,
    y: punto.y + Math.sin(anguloDeSalida) * largo,
  };
  const curvaX = (punto.x + fin.x) / 2 + Math.cos(anguloDeSalida + Math.PI / 2) * lado * 2.2;
  const curvaY = (punto.y + fin.y) / 2 + Math.sin(anguloDeSalida + Math.PI / 2) * lado * 2.2;
  const tallo = `<path d="M${redondear(punto.x)} ${redondear(punto.y)} Q${redondear(curvaX)} ${redondear(curvaY)} ${redondear(fin.x)} ${redondear(fin.y)}" fill="none"/>`;

  const suerte = azar();
  let adorno;
  if (suerte < 0.38) adorno = flor(fin.x, fin.y, azar() * Math.PI * 2, entre(3.1, 4.4));
  else if (suerte < 0.58) adorno = campanilla(fin.x, fin.y, anguloDeSalida - Math.PI / 2 + lado * 0.3, entre(0.8, 1.15));
  else if (suerte < 0.78) adorno = capullo(fin.x, fin.y, anguloDeSalida, entre(2.2, 3.1));
  else adorno = hoja(fin.x, fin.y, anguloDeSalida, entre(8, 12));
  return tallo + adorno;
}

function crearMotivos() {
  let motivos = '';
  const celda = LADO / CELDAS;
  for (let fila = 0; fila < CELDAS; fila += 1) {
    for (let columna = 0; columna < CELDAS; columna += 1) {
      const x = (columna + 0.5) * celda + entre(-celda * 0.25, celda * 0.25);
      const y = (fila + 0.5) * celda + entre(-celda * 0.25, celda * 0.25);
      const angulo = -0.6 + entre(-1.1, 1.1) + ((fila + columna) % 2 === 0 ? 0 : Math.PI);
      const rama = crearRama(x, y, angulo, entre(85, 120), 8);
      motivos += `<path d="${trazoSuave(rama)}" fill="none"/>`;

      rama.forEach((punto, indice) => {
        if (indice === 0) return;
        if (azar() < 0.7) motivos += ramitaConAdorno(punto, indice % 2 === 0 ? 1 : -1);
        if (azar() < 0.2) motivos += ramitaConAdorno(punto, indice % 2 === 0 ? -1 : 1);
      });

      const punta = rama[rama.length - 1];
      motivos += azar() < 0.5 ? hoja(punta.x, punta.y, punta.angulo, entre(9, 13)) : capullo(punta.x, punta.y, punta.angulo, 3);
    }
  }
  return motivos;
}

function crearSvg() {

  let copias = '';
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      copias += `<use href="#motivos" x="${dx * LADO}" y="${dy * LADO}"/>`;
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${LADO}" height="${LADO}" viewBox="0 0 ${LADO} ${LADO}">
  <defs>
    <g id="motivos" stroke="${PALETA.trazo}" stroke-width="0.85" stroke-linecap="round" stroke-linejoin="round">${crearMotivos()}</g>
  </defs>
  ${copias}
</svg>
`;
}

const destino = path.join(__dirname, '..', 'assets', 'img', 'forro.svg');
const svg = crearSvg();
fs.writeFileSync(destino, svg);
console.log(`forro.svg generado (${Math.round(svg.length / 1024)} KB)`);
