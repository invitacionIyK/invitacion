import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';

const { crearCodigo, leerInvitados, separar } = createRequire(import.meta.url)('../herramientas/generar-enlaces.cjs');

const fila = { saludo: 'Familia Mora', nombre: '', espacios: 2, nota: '' };

test('el código siempre es el mismo con los mismos datos y la misma clave', () => {
  assert.equal(crearCodigo('clave-secreta', fila), crearCodigo('clave-secreta', { ...fila }));
});

test('el código cambia si cambia la clave, los espacios, el saludo o la nota', () => {
  const base = crearCodigo('clave-secreta', fila);
  assert.notEqual(crearCodigo('otra-clave', fila), base);
  assert.notEqual(crearCodigo('clave-secreta', { ...fila, espacios: 1 }), base);
  assert.notEqual(crearCodigo('clave-secreta', { ...fila, saludo: 'Familia Mora ' }), base);
  assert.notEqual(crearCodigo('clave-secreta', { ...fila, nota: 'otra' }), base);
});

test('el código tiene 12 caracteres, sin letras ni números que se confundan', () => {
  const codigo = crearCodigo('clave-secreta', fila);
  assert.match(codigo, /^[A-HJKMNP-Z2-9]{12}$/);
});

test('no se repiten códigos entre muchas invitaciones', () => {
  const codigos = new Set();
  for (let i = 0; i < 2000; i += 1) codigos.add(crearCodigo('clave-secreta', { saludo: `Invitado ${i}`, nombre: '', espacios: 1, nota: '' }));
  assert.equal(codigos.size, 2000);
});

test('separar respeta las comas dentro de comillas', () => {
  assert.deepEqual(separar('"Luis, y Carmen",,2'), ['Luis, y Carmen', '', '2']);
});

test('leerInvitados lee la lista y acepta filas sin saludo ni nombre', () => {
  const filas = leerInvitados('saludo,nombre,espacios,nota\n,,1,Solos\n,,2,Con acompañante\nFamilia Mora,,2,\n');
  assert.equal(filas.length, 3);
  assert.deepEqual(filas[0], { saludo: '', nombre: '', espacios: 1, nota: 'Solos' });
  assert.equal(filas[2].saludo, 'Familia Mora');
});

test('leerInvitados rechaza espacios distintos de 1 o 2', () => {
  assert.throws(() => leerInvitados('saludo,nombre,espacios\nAna,,5\n'), /"espacios" debe ser 1 o 2/);
  assert.throws(() => leerInvitados('saludo,nombre,espacios\nAna,,\n'), /"espacios" debe ser 1 o 2/);
});

test('leerInvitados rechaza filas repetidas y pide una nota distinta', () => {
  assert.throws(() => leerInvitados('saludo,nombre,espacios\nAna,,1\nAna,,1\n'), /repetida/);
  assert.doesNotThrow(() => leerInvitados('saludo,nombre,espacios,nota\nAna,,1,a\nAna,,1,b\n'));
});

test('leerInvitados rechaza una lista sin las columnas necesarias o vacía', () => {
  assert.throws(() => leerInvitados('nombre,cupo\nAna,1\n'), /saludo,nombre,espacios/);
  assert.throws(() => leerInvitados('saludo,nombre,espacios\n'), /no tiene invitados/);
});

test('leerInvitados acepta el archivo tal como lo guarda Excel (con BOM y CRLF)', () => {
  const filas = leerInvitados('\uFEFFsaludo,nombre,espacios\r\nAna López,,1\r\n');
  assert.equal(filas[0].saludo, 'Ana López');
});
