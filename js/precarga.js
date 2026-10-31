function cargarImagen(url) {
  return new Promise((resolve) => {
    const imagen = new Image();
    imagen.onload = () => resolve(true);
    imagen.onerror = () => resolve(false);
    imagen.src = url;

    if (typeof imagen.decode === 'function') {
      imagen.decode().then(() => resolve(true), () => resolve(false));
    }
  });
}

function cargarFuentes(fuentes) {
  if (!document.fonts || typeof document.fonts.load !== 'function') return Promise.resolve();
  return Promise.all(fuentes.map((fuente) => document.fonts.load(fuente).catch(() => null)));
}


export function precargarImagenes(urls, fuentes = [], limiteMs = 8000) {
  const todas = Promise.all([...urls.map(cargarImagen), cargarFuentes(fuentes)]);
  const limite = new Promise((resolve) => setTimeout(resolve, limiteMs));
  return Promise.race([todas, limite]);
}
