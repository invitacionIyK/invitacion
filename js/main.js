import { FUENTES_PORTADA, IMAGENES_PORTADA, RSVP } from './config.js';
import { iniciarPortada } from './portada.js';
import { iniciarContador } from './contador.js';
import { iniciarRegalos } from './regalos.js';
import { precargarImagenes } from './precarga.js';
import { iniciarRsvp } from './rsvp/formulario.js';
import { aplicarInvitado, consultarInvitado, INVITADO_BASE, leerCodigo, leerInvitado } from './invitado.js';
import { marcarConsultando, marcarImagenesCargando } from './esqueleto.js';
import { iniciarRevelado } from './revelado.js';
import { empezarSiempreArriba } from './scroll.js';

empezarSiempreArriba();

const principal = document.getElementById('invitacion');
marcarImagenesCargando(principal);


const alAbrirLaInvitacion = () => {
  document.title = 'Ivan & Katherine · Nuestra boda';
  iniciarRevelado(principal);
};

try {
  iniciarContador();
  iniciarRegalos();
  iniciarPortada();

  const portada = document.getElementById('portada');
  if (portada) {
    document.addEventListener('invitacion:abierta', alAbrirLaInvitacion, { once: true });
    precargarImagenes(IMAGENES_PORTADA, FUENTES_PORTADA).then(() => {
      portada.classList.remove('portada--cargando');
      portada.removeAttribute('aria-busy');
    });
  } else {
    alAbrirLaInvitacion();
  }
} catch (error) {

  console.error(error);
  document.documentElement.classList.remove('js');
  document.body.classList.remove('con-portada');
  alAbrirLaInvitacion();
}


try {
  const usaHoja = RSVP.destino === 'hoja' && Boolean(RSVP.urlHoja);
  const invitado = { ...(RSVP.permitirParametrosEnElEnlace ? leerInvitado() : INVITADO_BASE), codigo: leerCodigo() };
  aplicarInvitado(invitado);
  const formulario = iniciarRsvp({ invitado });


  if (usaHoja && invitado.codigo) {
    const seccion = document.getElementById('tu-invitacion');
    marcarConsultando(seccion, true);

    consultarInvitado(RSVP.urlHoja, invitado.codigo)
      .then((datos) => {
        if (!datos) return;
        Object.assign(invitado, datos);
        aplicarInvitado(invitado);
        if (formulario) formulario.invitadoActualizado();
      })
      .finally(() => marcarConsultando(seccion, false));
  }
} catch (error) {
  console.error(error);
}
