function copiarConSeleccion(texto) {
  const campo = document.createElement('textarea');
  campo.value = texto;
  campo.setAttribute('readonly', '');
  campo.style.cssText = 'position:fixed;top:0;left:0;opacity:0;font-size:16px';
  document.body.appendChild(campo);
  campo.focus();
  campo.select();
  campo.setSelectionRange(0, texto.length);

  let copiado = false;
  try {
    copiado = document.execCommand('copy');
  } catch (error) {
    copiado = false;
  }
  document.body.removeChild(campo);
  return copiado;
}

async function copiar(texto) {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(texto);
      return true;
    } catch (error) {
      return copiarConSeleccion(texto);
    }
  }
  return copiarConSeleccion(texto);
}

export function iniciarRegalos() {
  const mensaje = document.getElementById('regalo-mensaje');
  if (!mensaje) return;

  document.querySelectorAll('[data-numero]').forEach((boton) => {
    boton.addEventListener('click', async () => {
      const numero = boton.dataset.numero;
      const exito = await copiar(numero);
      mensaje.textContent = exito
        ? `Número copiado: ${numero}`
        : `Mantén presionado el número para copiarlo: ${numero}`;
    });
  });
}
