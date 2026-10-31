import assert from 'node:assert/strict';
import { test } from 'node:test';

import { leerInvitado, textosDeEspacios } from '../js/invitado.js';

test('sin datos en el enlace: invitación de 1 espacio, sin saludo ni nombre', () => {
  assert.deepEqual(leerInvitado(''), { saludo: '', nombre: '', espacios: 1 });
});

test('lee el saludo, el nombre y los espacios del enlace', () => {
  const invitado = leerInvitado('?para=Familia%20Mora&nombre=Ana%20Mora%20Vega&espacios=2');
  assert.deepEqual(invitado, { saludo: 'Familia Mora', nombre: 'Ana Mora Vega', espacios: 2 });
});

test('entiende los signos + y los acentos', () => {
  assert.equal(leerInvitado('?para=Mar%C3%ADa+L%C3%B3pez').saludo, 'María López');
});

test('los espacios se limitan a 1 o 2 y lo inválido cuenta como 1', () => {
  assert.equal(leerInvitado('?espacios=0').espacios, 1);
  assert.equal(leerInvitado('?espacios=-3').espacios, 1);
  assert.equal(leerInvitado('?espacios=7').espacios, 2);
  assert.equal(leerInvitado('?espacios=dos').espacios, 1);
  assert.equal(leerInvitado('?espacios=').espacios, 1);
});

test('el saludo se limpia y se recorta a 80 caracteres', () => {
  const invitado = leerInvitado(`?para=${encodeURIComponent('  Ana    María  ')}`);
  assert.equal(invitado.saludo, 'Ana María');
  assert.equal(leerInvitado(`?para=${'x'.repeat(200)}`).saludo.length, 80);
});

test('el texto de los espacios cambia con la cantidad', () => {
  assert.equal(textosDeEspacios(1).titulo, 'Un lugar para ti');
  assert.match(textosDeEspacios(1).nota, /un lugar para ti/);
  assert.equal(textosDeEspacios(2).titulo, 'Dos lugares para ustedes');
  assert.match(textosDeEspacios(2).nota, /dos lugares/);
});

import { consultarInvitado, INVITADO_BASE, leerCodigo } from '../js/invitado.js';

const respuesta = (cuerpo, extra = {}) => ({ ok: true, json: async () => cuerpo, ...extra });

test('leerCodigo acepta un código largo con letras y números', () => {
  assert.equal(leerCodigo('?c=Y2ZNQ83W5HYF'), 'Y2ZNQ83W5HYF');
  assert.equal(leerCodigo('?otro=1&c=abc_DEF-123'), 'abc_DEF-123');
});

test('leerCodigo ignora lo que no parece un código', () => {
  assert.equal(leerCodigo(''), '');
  assert.equal(leerCodigo('?c='), '');
  assert.equal(leerCodigo('?c=corto'), '');
  assert.equal(leerCodigo('?c=con espacios y <b>etiquetas</b>'), '');
  assert.equal(leerCodigo(`?c=${'A'.repeat(41)}`), '');
});

test('la invitación base es la más restrictiva: 1 espacio, sin saludo', () => {
  assert.deepEqual({ ...INVITADO_BASE }, { saludo: '', nombre: '', espacios: 1, codigo: '' });
  assert.equal(Object.isFrozen(INVITADO_BASE), true);
});

test('consultarInvitado devuelve los datos de un código que existe', async () => {
  const llamadas = [];
  const datos = await consultarInvitado('https://script.example/exec', 'ABC123XYZ', {
    consultar: async (url) => {
      llamadas.push(url);
      return respuesta({ ok: true, encontrado: true, saludo: 'Familia Mora', nombre: '', espacios: 2 });
    },
  });
  assert.deepEqual(datos, { saludo: 'Familia Mora', nombre: '', espacios: 2 });
  assert.equal(llamadas[0], 'https://script.example/exec?inv=ABC123XYZ');
});

test('consultarInvitado devuelve null si el código no existe', async () => {
  const datos = await consultarInvitado('https://script.example/exec', 'ABC123XYZ', {
    consultar: async () => respuesta({ ok: true, encontrado: false }),
  });
  assert.equal(datos, null);
});

test('consultarInvitado devuelve null si el script viejo no conoce los códigos', async () => {
  const datos = await consultarInvitado('https://script.example/exec', 'ABC123XYZ', {
    consultar: async () => respuesta({ ok: true, mensaje: 'La hoja de confirmaciones está lista' }),
  });
  assert.equal(datos, null);
});

test('consultarInvitado devuelve null ante errores de red, de HTTP o de formato', async () => {
  const casos = [
    async () => { throw new TypeError('Failed to fetch'); },
    async () => ({ ok: false, status: 500, json: async () => ({}) }),
    async () => ({ ok: true, json: async () => { throw new SyntaxError('Unexpected token <'); } }),
  ];
  for (const consultar of casos) {
    assert.equal(await consultarInvitado('https://script.example/exec', 'ABC123XYZ', { consultar }), null);
  }
});

test('consultarInvitado se rinde si el script tarda demasiado', async () => {
  const datos = await consultarInvitado('https://script.example/exec', 'ABC123XYZ', {
    limiteMs: 20,
    consultar: (url, { signal }) => new Promise((resolver, rechazar) => {
      signal.addEventListener('abort', () => rechazar(new Error('abortado')));
    }),
  });
  assert.equal(datos, null);
});

test('el cupo que devuelve el script se limita a 1 o 2 y el texto se limpia', async () => {
  const con = (espacios) => consultarInvitado('https://script.example/exec', 'ABC123XYZ', {
    consultar: async () => respuesta({ ok: true, encontrado: true, saludo: '  Ana    López ', espacios }),
  });
  assert.equal((await con(9)).espacios, 2);
  assert.equal((await con(0)).espacios, 1);
  assert.equal((await con('basura')).espacios, 1);
  assert.equal((await con(2)).saludo, 'Ana López');
});
