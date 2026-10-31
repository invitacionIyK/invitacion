const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const FUENTES = path.join(__dirname, 'fuentes');
const SALIDA = path.join(__dirname, '..', 'assets', 'img');


const TEXTURAS = [
  { fuente: 'papel.svg', salida: 'papel.jpg', ancho: 520, alto: 520, recorte: { x: 4, y: 4, width: 512, height: 512 }, tipo: 'jpeg' },
  { fuente: 'cinta.svg', salida: 'cinta.jpg', ancho: 520, alto: 520, recorte: { x: 4, y: 4, width: 512, height: 512 }, tipo: 'jpeg' },
  { fuente: 'sello.html', salida: 'sello.png', ancho: 512, alto: 512, recorte: { x: 0, y: 0, width: 512, height: 512 }, tipo: 'png' },
  { fuente: 'ramita.svg', salida: 'ramita.png', ancho: 1060, alto: 520, recorte: { x: 0, y: 0, width: 1060, height: 520 }, tipo: 'png' },
  { fuente: 'vista-previa.html', salida: 'vista-previa.jpg', ancho: 1200, alto: 630, recorte: { x: 0, y: 0, width: 1200, height: 630 }, tipo: 'jpeg' },
  { fuente: 'icono.html', salida: 'icono.png', ancho: 180, alto: 180, recorte: { x: 0, y: 0, width: 180, height: 180 }, tipo: 'png' },
];

(async () => {
  const navegador = await chromium.launch({ channel: 'msedge' });

  for (const textura of TEXTURAS) {
    const pagina = await navegador.newPage({ viewport: { width: textura.ancho, height: textura.alto } });
    const origen = path.join(FUENTES, textura.fuente);
    if (textura.fuente.endsWith('.html')) {
      await pagina.goto(pathToFileURL(origen).href);
      await pagina.evaluate(() => document.fonts.ready);
    } else {
      const svg = fs.readFileSync(origen, 'utf8');
      await pagina.setContent(`<!doctype html><body style="margin:0;background:transparent">${svg}</body>`);
    }

    const destino = path.join(SALIDA, textura.salida);
    await pagina.screenshot({
      path: destino,
      clip: textura.recorte,
      type: textura.tipo,
      omitBackground: textura.tipo === 'png',
      ...(textura.tipo === 'jpeg' ? { quality: 88 } : {}),
    });

    console.log(textura.salida, `${Math.round(fs.statSync(destino).size / 1024)} KB`);
    await pagina.close();
  }

  await navegador.close();
})();
