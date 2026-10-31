const fs = require('fs');
const path = require('path');

const direccion = (process.argv[2] || '').trim().replace(/\/+$/, '');

if (!/^https:\/\/[^\s/]+(\/[^\s]*)?$/.test(direccion)) {
  console.error('Falta la dirección o no es válida. Ejemplo:');
  console.error('  node herramientas/fijar-direccion.cjs https://usuario.github.io/nombre-del-repositorio');
  process.exit(1);
}

const archivo = path.join(__dirname, '..', 'index.html');
const html = fs.readFileSync(archivo, 'utf8');

let cambios = 0;
const nuevo = html.replace(/<(meta|link)\b[^>]*\bdata-ruta="([^"]*)"[^>]*>/g, (etiqueta, tipo, ruta) => {
  cambios += 1;
  const atributo = tipo === 'meta' ? 'content' : 'href';
  return etiqueta.replace(new RegExp(`${atributo}="[^"]*"`), `${atributo}="${direccion}${ruta}"`);
});

if (cambios === 0) {
  console.error('No se encontraron etiquetas con data-ruta en index.html.');
  process.exit(1);
}

fs.writeFileSync(archivo, nuevo);
console.log(`${cambios} etiquetas actualizadas con ${direccion}`);
