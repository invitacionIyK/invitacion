import assert from 'node:assert/strict';
import { test } from 'node:test';

import { contarPalabras, limitarPalabras } from '../js/rsvp/palabras.js';
import { validarFormulario } from '../js/rsvp/validacion.js';
import { construirMensaje, enlaceWhatsapp, enlaceWhatsappGeneral, enviarAHoja } from '../js/rsvp/envio.js';

const base = () => ({
  nombre: 'Ana María López',
  asistira: true,
  acompanante: { lleva: false, nombre: '' },
  alimentacion: { tiene: false, detalle: '' },
});

const palabras = (n) => Array.from({ length: n }, (_, i) => `p${i + 1}`).join(' ');

test('contarPalabras ignora espacios y saltos de línea repetidos', () => {
  assert.equal(contarPalabras(''), 0);
  assert.equal(contarPalabras('   \n  '), 0);
  assert.equal(contarPalabras('uno'), 1);
  assert.equal(contarPalabras('  uno   dos\n\ntres  '), 3);
});

test('limitarPalabras deja intacto un texto que cabe', () => {
  const texto = 'Alergia a los mariscos,\nsobre todo camarón ';
  assert.equal(limitarPalabras(texto, 500), texto);
});

test('limitarPalabras corta exactamente en la palabra 500', () => {
  const cortado = limitarPalabras(palabras(520), 500);
  assert.equal(contarPalabras(cortado), 500);
  assert.ok(cortado.endsWith('p500'));
});

test('limitarPalabras permite escribir la palabra 500 pero no la 501', () => {
  const justo = palabras(500);
  assert.equal(limitarPalabras(justo, 500), justo);
  assert.equal(limitarPalabras(`${justo} extra`, 500), justo);
});

test('limitarPalabras deja el espacio final mientras no se empiece la palabra 501', () => {
  const justo = palabras(500);
  assert.equal(limitarPalabras(`${justo} `, 500), `${justo} `);
  assert.equal(limitarPalabras(`${justo} x`, 500), justo);
});

test('limitarPalabras conserva los saltos de línea del texto que sí cabe', () => {
  const texto = 'uno\ndos\n\ntres cuatro';
  assert.equal(limitarPalabras(texto, 3), 'uno\ndos\n\ntres');
});

test('un formulario correcto sin acompañante ni limitantes es válido', () => {
  const resultado = validarFormulario(base());
  assert.equal(resultado.valido, true);
  assert.deepEqual(resultado.errores, {});
});

test('el nombre exige nombre y apellido', () => {
  const entrada = { ...base(), nombre: 'Ana' };
  assert.equal(validarFormulario(entrada).errores.nombre, 'Incluye nombre y apellido.');
});

test('el nombre vacío o con números se rechaza', () => {
  assert.ok(validarFormulario({ ...base(), nombre: '   ' }).errores.nombre);
  assert.ok(validarFormulario({ ...base(), nombre: 'Ana 123 Pérez' }).errores.nombre);
});

test('acepta tildes, ñ, apóstrofos y guiones en los nombres', () => {
  assert.equal(validarFormulario({ ...base(), nombre: "José Ñandú O'Brien-Núñez" }).valido, true);
});

test('normaliza los espacios del nombre', () => {
  const resultado = validarFormulario({ ...base(), nombre: '  Ana    María   López ' });
  assert.equal(resultado.datos.nombre, 'Ana María López');
});

test('sin elegir si lleva acompañante o si tiene limitantes, hay error', () => {
  const entrada = { ...base(), acompanante: { lleva: null, nombre: '' }, alimentacion: { tiene: null, detalle: '' } };
  const { errores } = validarFormulario(entrada);
  assert.ok(errores.acompanante);
  assert.ok(errores.alimentacion);
});

test('si lleva acompañante, su nombre completo es obligatorio', () => {
  const sinNombre = { ...base(), acompanante: { lleva: true, nombre: '' } };
  assert.ok(validarFormulario(sinNombre).errores.nombreAcompanante);

  const incompleto = { ...base(), acompanante: { lleva: true, nombre: 'Luis' } };
  assert.equal(validarFormulario(incompleto).errores.nombreAcompanante, 'Incluye nombre y apellido.');

  const completo = { ...base(), acompanante: { lleva: true, nombre: 'Luis Mora Vega' } };
  assert.equal(validarFormulario(completo).valido, true);
});

test('si no lleva acompañante, se descarta cualquier nombre que haya quedado escrito', () => {
  const entrada = { ...base(), acompanante: { lleva: false, nombre: 'Luis Mora Vega' } };
  assert.equal(validarFormulario(entrada).datos.acompanante.nombre, '');
});

test('si tiene limitantes, el detalle es obligatorio', () => {
  const entrada = { ...base(), alimentacion: { tiene: true, detalle: '   ' } };
  assert.equal(validarFormulario(entrada).errores.detalle, 'Cuéntanos cuál es la limitante.');
});

test('el detalle admite hasta 500 palabras y rechaza 501', () => {
  const con = (n) => ({ ...base(), alimentacion: { tiene: true, detalle: palabras(n) } });
  assert.equal(validarFormulario(con(500)).valido, true);
  assert.equal(validarFormulario(con(501)).errores.detalle, 'Máximo 500 palabras.');
});

test('si no tiene limitantes, se descarta el detalle que haya quedado escrito', () => {
  const entrada = { ...base(), alimentacion: { tiene: false, detalle: 'algo' } };
  assert.equal(validarFormulario(entrada).datos.alimentacion.detalle, '');
});

test('sin elegir si podrá asistir, hay error', () => {
  const entrada = { ...base(), asistira: null };
  assert.equal(validarFormulario(entrada).errores.asistira, 'Elige una opción.');
});

test('si no podrá asistir, solo se exige el nombre y lo demás se descarta', () => {
  const entrada = {
    nombre: 'Ana María López',
    asistira: false,
    acompanante: { lleva: null, nombre: 'Luis Mora Vega' },
    alimentacion: { tiene: null, detalle: 'algo' },
  };
  const resultado = validarFormulario(entrada);
  assert.equal(resultado.valido, true);
  assert.equal(resultado.datos.asistira, false);
  assert.deepEqual(resultado.datos.acompanante, { lleva: false, nombre: '' });
  assert.deepEqual(resultado.datos.alimentacion, { tiene: false, detalle: '' });
});

test('si no podrá asistir, el nombre sigue siendo obligatorio', () => {
  const entrada = { ...base(), asistira: false, nombre: 'Ana' };
  assert.ok(validarFormulario(entrada).errores.nombre);
});

test('con un solo espacio nunca se pregunta ni se guarda acompañante', () => {
  const entrada = { ...base(), acompanante: { lleva: null, nombre: 'Luis Mora Vega' } };
  const resultado = validarFormulario(entrada, { permiteAcompanante: false });
  assert.equal(resultado.valido, true);
  assert.deepEqual(resultado.datos.acompanante, { lleva: false, nombre: '' });
});

test('el mensaje de quien no podrá asistir es breve y lleva su nombre', () => {
  const mensaje = construirMensaje({ ...base(), asistira: false });
  assert.match(mensaje, /no podré asistir/);
  assert.match(mensaje, /Nombre: Ana María López/);
  assert.doesNotMatch(mensaje, /Acompañante/);
});

test('en invitaciones de un solo espacio el mensaje no menciona al acompañante', () => {
  const mensaje = construirMensaje({ ...base(), nombre: 'Ana María López' }, { conAcompanante: false });
  assert.doesNotMatch(mensaje, /Acompañante/);
  assert.match(mensaje, /Nombre: Ana María López/);
  assert.match(mensaje, /limitantes con alimentos: Ninguna/);
});

test('el enlace general de WhatsApp lleva el teléfono y un saludo', () => {
  const enlace = enlaceWhatsappGeneral('50683229846');
  assert.ok(enlace.startsWith('https://wa.me/50683229846?text='));
  assert.match(decodeURIComponent(enlace), /asistencia a la boda/);
});

test('el mensaje de WhatsApp incluye nombre, acompañante y limitantes', () => {
  const datos = {
    nombre: 'Ana María López',
    asistira: true,
    acompanante: { lleva: true, nombre: 'Luis Mora Vega' },
    alimentacion: { tiene: true, detalle: 'Alergia al maní' },
  };
  const mensaje = construirMensaje(datos);
  assert.match(mensaje, /Nombre: Ana María López/);
  assert.match(mensaje, /Acompañante: Luis Mora Vega/);
  assert.match(mensaje, /Alergia al maní/);
});

test('el mensaje dice "No" y "Ninguna" cuando no aplica', () => {
  const mensaje = construirMensaje({ ...base(), nombre: 'Ana María López' });
  assert.match(mensaje, /Acompañante: No/);
  assert.match(mensaje, /limitantes con alimentos: Ninguna/);
});

test('el enlace de WhatsApp lleva el teléfono y el mensaje codificado', () => {
  const enlace = enlaceWhatsapp('50683229846', { ...base(), nombre: 'Ana María López' });
  assert.ok(enlace.startsWith('https://wa.me/50683229846?text='));
  assert.equal(decodeURIComponent(enlace.split('?text=')[1]), construirMensaje({ ...base(), nombre: 'Ana María López' }));
});

function conFetch(simulado, prueba) {
  return async () => {
    const original = globalThis.fetch;
    globalThis.fetch = simulado;
    try {
      await prueba();
    } finally {
      globalThis.fetch = original;
    }
  };
}

const respuestaJson = (contenido, extra = {}) => ({
  ok: true,
  status: 200,
  json: async () => contenido,
  ...extra,
});

test('enviarAHoja manda un POST con los datos en JSON y acepta {"ok": true}', async () => {
  const llamadas = [];
  await conFetch(async (url, opciones) => {
    llamadas.push({ url, opciones });
    return respuestaJson({ ok: true });
  }, async () => {
    await enviarAHoja('https://script.example/exec', { nombre: 'Ana María López' }, { invitacion: 'Individual' });
  })();

  assert.equal(llamadas.length, 1);
  assert.equal(llamadas[0].url, 'https://script.example/exec');
  assert.equal(llamadas[0].opciones.method, 'POST');
  assert.equal(llamadas[0].opciones.headers['Content-Type'], 'text/plain;charset=utf-8');
  assert.deepEqual(JSON.parse(llamadas[0].opciones.body), { nombre: 'Ana María López', invitacion: 'Individual' });
});

test('enviarAHoja rechaza una respuesta que no es JSON (script mal publicado)', conFetch(
  async () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError('Unexpected token <'); } }),
  async () => {
    await assert.rejects(() => enviarAHoja('https://script.example/exec', base()), /bien publicado/);
  },
));

test('enviarAHoja rechaza cuando el script contesta {"ok": false}', conFetch(
  async () => respuestaJson({ ok: false, error: 'Falta permiso' }),
  async () => {
    await assert.rejects(() => enviarAHoja('https://script.example/exec', base()), /Falta permiso/);
  },
));

test('enviarAHoja rechaza si falta el campo "ok" en la respuesta', conFetch(
  async () => respuestaJson({}),
  async () => {
    await assert.rejects(() => enviarAHoja('https://script.example/exec', base()), /no guardó/);
  },
));

test('enviarAHoja rechaza un código de error HTTP', conFetch(
  async () => ({ ok: false, status: 500, json: async () => ({}) }),
  async () => {
    await assert.rejects(() => enviarAHoja('https://script.example/exec', base()), /500/);
  },
));

test('enviarAHoja propaga el error de red para que la pantalla lo muestre', conFetch(
  async () => { throw new TypeError('Failed to fetch'); },
  async () => {
    await assert.rejects(() => enviarAHoja('https://script.example/exec', base()), TypeError);
  },
));
