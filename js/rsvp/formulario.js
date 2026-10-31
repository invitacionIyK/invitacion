import { RSVP } from '../config.js';
import { enlaceWhatsapp, enlaceWhatsappGeneral, enviarAHoja } from './envio.js';
import { crearModal } from './modal.js';
import { crearIcono } from '../iconos.js';
import { contarPalabras, limitarPalabras } from './palabras.js';
import { validarFormulario } from './validacion.js';


const CLAVE_DE_DISPOSITIVO = 'invitacion-dispositivo';
const ORDEN_DE_CAMPOS = ['nombre', 'asistira', 'correo', 'acompanante', 'nombreAcompanante', 'alimentacion', 'detalle'];

export function iniciarRsvp({ invitado = { saludo: '', nombre: '', espacios: 1, codigo: '' } } = {}) {
  const raiz = document.getElementById('rsvp');
  if (!raiz) return;

  const principal = document.getElementById('invitacion');
  const modal = crearModal(raiz, { fondo: [principal] });
  const formulario = raiz.querySelector('#rsvp-formulario');

  const campos = {
    nombre: formulario.elements.nombre,
    correo: formulario.elements.correo,
    nombreAcompanante: formulario.elements.nombreAcompanante,
    detalle: formulario.elements.detalle,
    sitio: formulario.elements.sitio,
  };
  const partes = {
    detalles: raiz.querySelector('#rsvp-detalles'),
    grupoAcompanante: raiz.querySelector('#rsvp-grupo-acompanante'),
    bloqueAcompanante: raiz.querySelector('#rsvp-bloque-acompanante'),
    bloqueAlimentacion: raiz.querySelector('#rsvp-bloque-alimentacion'),
  };
  const contador = raiz.querySelector('#rsvp-contador');
  const botonEnviar = raiz.querySelector('#rsvp-enviar');
  const errorGeneral = raiz.querySelector('#rsvp-error-general');
  const botonAlternativa = raiz.querySelector('#rsvp-alternativa');
  const textoDelBoton = botonEnviar.textContent;


  const permiteAcompanante = () => invitado.espacios >= 2;
  const enviaAHoja = () => RSVP.destino === 'hoja' && Boolean(RSVP.urlHoja);
  const plazoTerminado = () => RSVP.cerrarDespuesDeLimite && Date.now() > RSVP.fechaLimiteUTC;
  let ultimosDatos = null;



  function opcionElegida(nombre) {
    const marcada = formulario.querySelector(`input[name="${nombre}"]:checked`);
    return marcada ? marcada.value === 'si' : null;
  }

  function leerEntrada() {
    return {
      nombre: campos.nombre.value,
      asistira: opcionElegida('asistira'),
      correo: campos.correo.value,
      acompanante: { lleva: permiteAcompanante() ? opcionElegida('acompanante') : false, nombre: campos.nombreAcompanante.value },
      alimentacion: { tiene: opcionElegida('alimentacion'), detalle: campos.detalle.value },
    };
  }



  function mostrar(elemento, visible, controles = []) {
    const estabaOculto = elemento.hidden;
    elemento.hidden = !visible;
    if (elemento.tagName === 'FIELDSET') elemento.disabled = !visible;
    controles.forEach((control) => {
      control.disabled = !visible;
    });
    return visible && estabaOculto;
  }

  function actualizarCondicionales({ avisar = false } = {}) {
    const asistira = opcionElegida('asistira') === true;
    const revelados = {
      detalles: mostrar(partes.detalles, asistira),
      grupoAcompanante: mostrar(partes.grupoAcompanante, asistira && permiteAcompanante()),
      bloqueAcompanante: mostrar(
        partes.bloqueAcompanante,
        asistira && permiteAcompanante() && opcionElegida('acompanante') === true,
        [campos.nombreAcompanante],
      ),
      bloqueAlimentacion: mostrar(partes.bloqueAlimentacion, asistira && opcionElegida('alimentacion') === true, [campos.detalle]),
    };

    if (!avisar) return;
    const nuevo = ['bloqueAlimentacion', 'bloqueAcompanante', 'grupoAcompanante', 'detalles'].find((clave) => revelados[clave]);
    if (nuevo) partes[nuevo].scrollIntoView({ block: 'nearest' });
  }

  function actualizarContador() {
    const limitado = limitarPalabras(campos.detalle.value, RSVP.maxPalabras);
    if (limitado !== campos.detalle.value) campos.detalle.value = limitado;

    const palabras = contarPalabras(limitado);
    contador.textContent = `${palabras} / ${RSVP.maxPalabras} palabras`;
    contador.classList.toggle('campo__contador--cerca', palabras >= RSVP.maxPalabras * 0.9 && palabras < RSVP.maxPalabras);
    contador.classList.toggle('campo__contador--limite', palabras >= RSVP.maxPalabras);
  }



  function elementoDe(clave) {
    return campos[clave] || formulario.querySelector(`input[name="${clave}"]`);
  }

  function limpiarErrorDe(clave) {
    const mensaje = raiz.querySelector(`[data-error-de="${clave}"]`);
    if (mensaje) mensaje.textContent = '';
    if (campos[clave]) campos[clave].removeAttribute('aria-invalid');
    else {
      const grupo = elementoDe(clave) && elementoDe(clave).closest('.opciones');
      if (grupo) grupo.removeAttribute('data-invalido');
    }
  }

  function limpiarErrores() {
    ORDEN_DE_CAMPOS.forEach(limpiarErrorDe);
    errorGeneral.textContent = '';
    botonAlternativa.hidden = true;
  }

  function mostrarErrores(errores) {
    limpiarErrores();
    Object.entries(errores).forEach(([clave, mensaje]) => {
      raiz.querySelector(`[data-error-de="${clave}"]`).textContent = mensaje;
      if (campos[clave]) campos[clave].setAttribute('aria-invalid', 'true');
      else elementoDe(clave).closest('.opciones').setAttribute('data-invalido', '');
    });

    const primero = ORDEN_DE_CAMPOS.find((clave) => errores[clave]);
    const elemento = elementoDe(primero);
    elemento.focus({ preventScroll: true });
    elemento.scrollIntoView({ block: 'center' });
  }



  function mostrarVista(nombre) {
    raiz.querySelectorAll('[data-vista]').forEach((vista) => {
      vista.hidden = vista.dataset.vista !== nombre;
    });
    modal.panel.scrollTop = 0;

    const titulo = raiz.querySelector(`[data-vista="${nombre}"] h2[tabindex]`);
    (titulo || modal.panel).focus({ preventScroll: true });
  }

  function agregarFila(lista, titulo, valor) {
    const dt = document.createElement('dt');
    dt.textContent = titulo;
    const dd = document.createElement('dd');
    dd.textContent = valor;
    lista.append(dt, dd);
  }

  function crearEnlaceDeWhatsapp(texto, href) {
    const enlace = document.createElement('a');
    enlace.className = 'boton';
    enlace.href = href;
    enlace.target = '_blank';
    enlace.rel = 'noopener noreferrer';

    const etiqueta = document.createElement('span');
    etiqueta.textContent = texto;
    enlace.append(crearIcono('chat'), etiqueta);
    return enlace;
  }

  function mostrarResumen(datos) {
    const lista = raiz.querySelector('#rsvp-resumen');
    lista.textContent = '';
    agregarFila(lista, 'Nombre', datos.nombre);
    if (datos.asistira) {
      agregarFila(lista, 'Asistencia', 'Sí, ahí estaré');
      if (permiteAcompanante()) agregarFila(lista, 'Acompañante', datos.acompanante.lleva ? datos.acompanante.nombre : 'No');
      agregarFila(lista, 'Alergias o limitantes', datos.alimentacion.tiene ? datos.alimentacion.detalle : 'Ninguna');
    } else {
      agregarFila(lista, 'Asistencia', 'No podré asistir');
    }

    const acciones = raiz.querySelector('#rsvp-acciones');
    acciones.textContent = '';
    RSVP.contactos.forEach((contacto) => {
      acciones.append(crearEnlaceDeWhatsapp(`Enviar por WhatsApp a ${contacto.nombre}`, enlaceWhatsapp(contacto.telefono, datos, { conAcompanante: permiteAcompanante() })));
    });

    mostrarVista('resumen');
  }

  function mostrarGracias(datos) {
    const primerNombre = datos.nombre.split(' ')[0];
    raiz.querySelector('#rsvp-gracias-texto').textContent = datos.asistira
      ? `${primerNombre}, recibimos tu confirmación. Nos hace muchísima ilusión verte el 13 de febrero.`
      : `${primerNombre}, gracias por avisarnos. Te vamos a extrañar y te llevamos en el corazón ese día.`;
    mostrarVista('gracias');
  }

  function mostrarPlazoTerminado() {
    const acciones = raiz.querySelector('#rsvp-acciones-cerrado');
    acciones.textContent = '';
    RSVP.contactos.forEach((contacto) => {
      acciones.append(crearEnlaceDeWhatsapp(`Escribir a ${contacto.nombre}`, enlaceWhatsappGeneral(contacto.telefono)));
    });
    mostrarVista('cerrado');
  }

  function crearCodigoAleatorio() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
    const bytes = new Uint8Array(16);
    if (window.crypto && typeof window.crypto.getRandomValues === 'function') window.crypto.getRandomValues(bytes);
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  }

  function obtenerCodigoDeDispositivo() {
    try {
      let codigo = window.localStorage.getItem(CLAVE_DE_DISPOSITIVO);
      if (!codigo) {
        codigo = crearCodigoAleatorio();
        window.localStorage.setItem(CLAVE_DE_DISPOSITIVO, codigo);
      }
      return codigo;
    } catch (error) {
      return '';
    }
  }

  function reiniciar() {
    formulario.reset();
    campos.nombre.value = invitado.nombre;
    limpiarErrores();
    actualizarCondicionales();
    actualizarContador();
  }



  async function enviarPorHoja(datos) {
    botonEnviar.disabled = true;
    botonEnviar.textContent = 'Enviando…';

    try {
      await enviarAHoja(RSVP.urlHoja, datos, {
        codigo: invitado.codigo,
        dispositivo: obtenerCodigoDeDispositivo(),
        espacios: invitado.espacios,
        enviadoEn: new Date().toISOString(),
      });
      mostrarGracias(datos);
      reiniciar();
    } catch (error) {
      errorGeneral.textContent = 'No pudimos enviar tu confirmación. Revisa tu conexión e inténtalo de nuevo, o envíala por WhatsApp.';
      botonAlternativa.hidden = false;
    } finally {
      botonEnviar.disabled = false;
      botonEnviar.textContent = textoDelBoton;
    }
  }

  formulario.addEventListener('submit', (evento) => {
    evento.preventDefault();
    if (campos.sitio.value) return;

    const { valido, errores, datos } = validarFormulario(leerEntrada(), { maxPalabras: RSVP.maxPalabras, permiteAcompanante: permiteAcompanante() });
    if (!valido) {
      mostrarErrores(errores);
      return;
    }

    limpiarErrores();
    ultimosDatos = datos;
    if (enviaAHoja()) enviarPorHoja(datos);
    else mostrarResumen(datos);
  });



  formulario.addEventListener('input', (evento) => {
    if (evento.target.name) limpiarErrorDe(evento.target.name);
    if (evento.target === campos.detalle) actualizarContador();
  });

  formulario.addEventListener('change', (evento) => {
    if (evento.target.type === 'radio') actualizarCondicionales({ avisar: true });
  });

  botonAlternativa.addEventListener('click', () => {
    if (ultimosDatos) mostrarResumen(ultimosDatos);
  });

  raiz.querySelector('[data-volver-al-formulario]').addEventListener('click', () => mostrarVista('formulario'));

  document.querySelectorAll('[data-abrir-rsvp]').forEach((boton) => {
    boton.addEventListener('click', (evento) => {
      evento.preventDefault();
      if (plazoTerminado()) mostrarPlazoTerminado();
      else mostrarVista('formulario');
      modal.abrir(evento.currentTarget);
    });
  });

  campos.nombre.value = invitado.nombre;
  actualizarCondicionales();
  actualizarContador();

  return {
    
    invitadoActualizado() {
      if (!campos.nombre.value && invitado.nombre) campos.nombre.value = invitado.nombre;
      actualizarCondicionales();
    },
  };
}
