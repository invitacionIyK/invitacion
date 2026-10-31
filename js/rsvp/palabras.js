export function contarPalabras(texto) {
  const limpio = texto.trim();
  return limpio ? limpio.split(/\s+/).length : 0;
}

export function limitarPalabras(texto, maximo) {
  const palabra = /\S+/g;
  let cuenta = 0;
  let fin = 0;
  let coincidencia = palabra.exec(texto);

  while (coincidencia !== null) {
    cuenta += 1;
    if (cuenta > maximo) return texto.slice(0, fin);
    fin = palabra.lastIndex;
    coincidencia = palabra.exec(texto);
  }

  return texto;
}
