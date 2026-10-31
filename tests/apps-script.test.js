import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

const CODIGO = fs.readFileSync(new URL('../herramientas/google-apps-script.gs', import.meta.url), 'utf8');

const CODIGO_SOLO = 'WRAMVFY568JE';
const CODIGO_PAREJA = '3R7NVG5ZHHER';
const CODIGO_FAMILIA = 'Y2ZNQ83W5HYF';

function crearEntorno({ ahora = '2026-11-10T12:00:00Z', invitaciones = null, sinHojaDeInvitaciones = false } = {}) {
  const hojas = new Map();
  const correos = [];

  const crearHoja = (nombre, filas = []) => {
    const hoja = {
      nombre,
      filas,
      congeladas: 0,
      getLastRow: () => hoja.filas.length,
      appendRow: (fila) => hoja.filas.push(fila),
      setFrozenRows: (n) => { hoja.congeladas = n; },
      getRange: (fila, columna, cuantasFilas = 1, cuantasColumnas = 1) => ({

        getValues: () =>
          Array.from({ length: cuantasFilas }, (_, r) => {
            const existente = hoja.filas[fila - 1 + r] || [];
            return Array.from({ length: cuantasColumnas }, (__, i) => (existente[columna - 1 + i] === undefined ? '' : existente[columna - 1 + i]));
          }),
        setValue: (valor) => {
          while (hoja.filas.length < fila) hoja.filas.push([]);
          hoja.filas[fila - 1][columna - 1] = valor;
          return { setFontWeight: () => {} };
        },
      }),
    };
    hojas.set(nombre, hoja);
    return hoja;
  };

  crearHoja('Invitaciones', invitaciones || [
    ['Código', 'Saludo', 'Nombre', 'Espacios'],
    [CODIGO_SOLO, '', '', 1],
    [CODIGO_PAREJA, '', '', 2],
    [CODIGO_FAMILIA, 'Familia Mora', 'Ana Mora Vega', 2],
  ]);

  if (sinHojaDeInvitaciones) hojas.delete('Invitaciones');

  const FechaFija = class extends Date {
    constructor(...argumentos) {
      super(...(argumentos.length ? argumentos : [ahora]));
    }
  };

  const contexto = vm.createContext({
    Date: FechaFija,
    JSON,
    Number,
    String,
    SpreadsheetApp: {
      getActiveSpreadsheet: () => ({
        getSheetByName: (nombre) => hojas.get(nombre) || null,
        insertSheet: (nombre) => crearHoja(nombre),
      }),
    },
    ContentService: {
      MimeType: { JSON: 'json' },
      createTextOutput: (texto) => ({ texto, setMimeType() { return this; } }),
    },
    MailApp: { sendEmail: (correo) => correos.push(correo) },
  });
  vm.runInContext(CODIGO, contexto);

  const llamar = (funcion, argumento) => JSON.parse(vm.runInContext(`${funcion}(__arg).texto`, Object.assign(contexto, { __arg: argumento })));
  return {
    hojas,
    correos,
    consultar: (parametros) => llamar('doGet', { parameter: parametros }),
    enviar: (cuerpo) => llamar('doPost', { postData: { contents: JSON.stringify(cuerpo) } }),
    enviarCrudo: (texto) => llamar('doPost', { postData: { contents: texto } }),
    confirmaciones: () => (hojas.get('Confirmaciones') ? hojas.get('Confirmaciones').filas : []),
  };
}

const confirmacion = (extra = {}) => ({
  nombre: 'Ana María López',
  asistira: true,
  acompanante: { lleva: false, nombre: '' },
  alimentacion: { tiene: false, detalle: '' },
  invitacion: 'Ivan & Katherine',
  codigo: CODIGO_SOLO,
  ...extra,
});

test('sin código, doGet solo confirma que el script está listo', () => {
  const respuesta = crearEntorno().consultar({});
  assert.equal(respuesta.ok, true);
  assert.match(respuesta.mensaje, /lista para recibir/);
  assert.equal(respuesta.encontrado, undefined);
});

test('doGet entrega el cupo, el saludo y el nombre de un código válido', () => {
  const entorno = crearEntorno();
  assert.deepEqual(entorno.consultar({ inv: CODIGO_FAMILIA }), { ok: true, encontrado: true, saludo: 'Familia Mora', nombre: 'Ana Mora Vega', espacios: 2 });
  assert.equal(entorno.consultar({ inv: CODIGO_SOLO }).espacios, 1);
  assert.equal(entorno.consultar({ inv: CODIGO_PAREJA }).espacios, 2);
});

test('doGet no revela nada de un código que no existe', () => {
  const respuesta = crearEntorno().consultar({ inv: 'INVENTADO12345' });
  assert.deepEqual(respuesta, { ok: true, encontrado: false });
});

test('el cupo nunca pasa de 2 aunque la hoja diga otra cosa', () => {
  const entorno = crearEntorno({ invitaciones: [['Código', 'Saludo', 'Nombre', 'Espacios'], ['ABC123XYZ', '', '', 9], ['DEF456UVW', '', '', 'basura']] });
  assert.equal(entorno.consultar({ inv: 'ABC123XYZ' }).espacios, 2);
  assert.equal(entorno.consultar({ inv: 'DEF456UVW' }).espacios, 1);
});

test('un invitado "solo" que confirma sin acompañante queda registrado', () => {
  const entorno = crearEntorno();
  assert.deepEqual(entorno.enviar(confirmacion()), { ok: true });
  const [encabezados, fila] = entorno.confirmaciones();
  assert.equal(encabezados.at(-1), 'Código');
  assert.equal(fila[1], 'Ana María López');
  assert.equal(fila[7], 'Sí');
  assert.equal(fila[8], 1);
  assert.equal(fila[9], CODIGO_SOLO);
});

test('SE RECHAZA un acompañante si el código es de 1 espacio, aunque se salten la página', () => {
  const entorno = crearEntorno();
  const respuesta = entorno.enviar(confirmacion({ acompanante: { lleva: true, nombre: 'Colado Sin Invitacion' } }));
  assert.equal(respuesta.ok, false);
  assert.match(respuesta.error, /no incluye acompañante/);
  assert.equal(entorno.confirmaciones().length, 0, 'no se guardó ninguna fila');
});

test('SE RECHAZA el acompañante si el código no existe o falta', () => {
  for (const codigo of ['INVENTADO12345', '', undefined]) {
    const entorno = crearEntorno();
    const respuesta = entorno.enviar(confirmacion({ codigo, acompanante: { lleva: true, nombre: 'Colado Sin Invitacion' } }));
    assert.equal(respuesta.ok, false, `código ${JSON.stringify(codigo)}`);
    assert.equal(entorno.confirmaciones().length, 0);
  }
});

test('el cupo lo decide la hoja y no lo que diga la página', () => {
  const entorno = crearEntorno();
  entorno.enviar(confirmacion({ espacios: 2 }));
  assert.equal(entorno.confirmaciones()[1][8], 1, 'la fila guarda 1 espacio, no el 2 que mandó la página');
});

test('con un código de 2 espacios sí se acepta el acompañante', () => {
  const entorno = crearEntorno();
  const respuesta = entorno.enviar(confirmacion({ codigo: CODIGO_PAREJA, acompanante: { lleva: true, nombre: 'Luis Mora Vega' } }));
  assert.deepEqual(respuesta, { ok: true });
  const fila = entorno.confirmaciones()[1];
  assert.equal(fila[2], 'Sí');
  assert.equal(fila[3], 'Luis Mora Vega');
  assert.equal(fila[8], 2);
});

test('la fila guarda el saludo de la hoja como invitación', () => {
  const entorno = crearEntorno();
  entorno.enviar(confirmacion({ codigo: CODIGO_FAMILIA, invitacion: 'texto que mandó la página' }));
  assert.equal(entorno.confirmaciones()[1][6], 'Familia Mora');
});

test('quien no podrá asistir queda marcado con "No"', () => {
  const entorno = crearEntorno();
  entorno.enviar(confirmacion({ asistira: false }));
  assert.equal(entorno.confirmaciones()[1][7], 'No');
});

test('pasada la fecha límite no se aceptan confirmaciones', () => {
  const entorno = crearEntorno({ ahora: '2026-11-22T06:00:01Z' });
  const respuesta = entorno.enviar(confirmacion());
  assert.equal(respuesta.ok, false);
  assert.match(respuesta.error, /plazo/);
  assert.equal(entorno.confirmaciones().length, 0);
});

test('justo antes de la fecha límite sí se aceptan', () => {
  const entorno = crearEntorno({ ahora: '2026-11-22T05:59:00Z' });
  assert.deepEqual(entorno.enviar(confirmacion()), { ok: true });
});

test('el campo trampa de los robots se acepta en silencio sin guardar nada', () => {
  const entorno = crearEntorno();
  assert.deepEqual(entorno.enviar(confirmacion({ sitio: 'http://spam.example' })), { ok: true });
  assert.equal(entorno.confirmaciones().length, 0);
});

test('un texto que empieza con = + - @ no se ejecuta como fórmula en la hoja', () => {
  const entorno = crearEntorno();
  entorno.enviar(confirmacion({ alimentacion: { tiene: true, detalle: '=HYPERLINK("http://malo.example")' } }));
  assert.equal(entorno.confirmaciones()[1][5], '\'=HYPERLINK("http://malo.example")');
});

test('un envío que no es JSON devuelve ok:false en vez de caerse', () => {
  const entorno = crearEntorno();
  const respuesta = entorno.enviarCrudo('esto no es json');
  assert.equal(respuesta.ok, false);
  assert.equal(entorno.confirmaciones().length, 0);
});

test('los dos enlaces generales funcionan sin la pestaña "Invitaciones"', () => {
  const entorno = crearEntorno({ sinHojaDeInvitaciones: true });
  assert.deepEqual(entorno.consultar({ inv: 'CXRWMW8J7DUZ' }), { ok: true, encontrado: true, saludo: '', nombre: '', espacios: 1 });
  assert.deepEqual(entorno.consultar({ inv: 'ZDMJDZZY96F5' }), { ok: true, encontrado: true, saludo: '', nombre: '', espacios: 2 });
  assert.deepEqual(entorno.consultar({ inv: 'INVENTADO12345' }), { ok: true, encontrado: false });
});

test('con el enlace general de 2 lugares se acepta acompañante; con el de 1 no', () => {
  const entorno = crearEntorno({ sinHojaDeInvitaciones: true });
  const con = entorno.enviar(confirmacion({ codigo: 'ZDMJDZZY96F5', acompanante: { lleva: true, nombre: 'Luis' } }));
  assert.equal(con.ok, true);
  const sin = entorno.enviar(confirmacion({ codigo: 'CXRWMW8J7DUZ', acompanante: { lleva: true, nombre: 'Luis' } }));
  assert.equal(sin.ok, false);
});
