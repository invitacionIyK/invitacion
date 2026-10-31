import { BODA } from './config.js';

const UNIDADES = ['dias', 'horas', 'minutos', 'segundos'];

function dosDigitos(n) {
  return n < 10 ? `0${n}` : `${n}`;
}

export function calcularRestante(ahora, meta = BODA.fechaUTC) {
  const total = Math.max(0, Math.floor((meta - ahora) / 1000));
  return {
    dias: Math.floor(total / 86400),
    horas: Math.floor(total / 3600) % 24,
    minutos: Math.floor(total / 60) % 60,
    segundos: total % 60,
  };
}

export function iniciarContador() {
  const seccion = document.getElementById('contador');
  if (!seccion) return;

  const nodos = {};
  UNIDADES.forEach((u) => {
    nodos[u] = seccion.querySelector(`[data-unidad="${u}"]`);
  });

  let temporizador = null;

  function pintar() {
    const restante = calcularRestante(Date.now());
    UNIDADES.forEach((u) => {
      if (nodos[u]) nodos[u].textContent = dosDigitos(restante[u]);
    });
  }

  function programar() {
    clearTimeout(temporizador);
    pintar();
    temporizador = setTimeout(programar, 1000 - (Date.now() % 1000) + 5);
  }

  seccion.hidden = false;
  programar();

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) programar();
  });
  window.addEventListener('pageshow', programar);
  window.addEventListener('focus', programar);
}
