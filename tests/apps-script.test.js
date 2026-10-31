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
        setValues: (matriz) => {
          matriz.forEach((valores, r) => {
            while (hoja.filas.length < fila + r) hoja.filas.push([]);
            valores.forEach((valor, i) => { hoja.filas[fila - 1 + r][columna - 1 + i] = valor; });
          });
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

  const memoria = new Map();

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
    LockService: { getScriptLock: () => ({ waitLock: () => {}, releaseLock: () => {} }) },
    CacheService: { getScriptCache: () => ({ get: (clave) => (memoria.has(clave) ? memoria.get(clave) : null), put: (clave, valor) => memoria.set(clave, valor) }) },
    console: { error: () => {} },
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
  correo: 'ana@example.com',
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
  assert.equal(encabezados.at(-1), 'ID del dispositivo');
  assert.equal(encabezados.at(-2), 'Última actualización');
  assert.equal(fila[1], 'Ana María López');
  assert.equal(fila[6], 'Sí');
  assert.equal(fila[7], 1);
  assert.equal(fila[8], CODIGO_SOLO);
  assert.equal(fila[9], 'ana@example.com');
  assert.equal(fila[10], 1);
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
  assert.equal(entorno.confirmaciones()[1][7], 1, 'la fila guarda 1 espacio, no el 2 que mandó la página');
});

test('con un código de 2 espacios sí se acepta el acompañante', () => {
  const entorno = crearEntorno();
  const respuesta = entorno.enviar(confirmacion({ codigo: CODIGO_PAREJA, acompanante: { lleva: true, nombre: 'Luis Mora Vega' } }));
  assert.deepEqual(respuesta, { ok: true });
  const fila = entorno.confirmaciones()[1];
  assert.equal(fila[2], 'Sí');
  assert.equal(fila[3], 'Luis Mora Vega');
  assert.equal(fila[7], 2);
});

test('la hoja no tiene columna "Invitación"', () => {
  const entorno = crearEntorno();
  entorno.enviar(confirmacion({ codigo: CODIGO_FAMILIA, invitacion: 'texto que mandó la página' }));
  const [encabezados, fila] = entorno.confirmaciones();
  assert.ok(!encabezados.includes('Invitación'));
  assert.ok(!fila.includes('Familia Mora') && !fila.includes('texto que mandó la página'));
});

test('quien no podrá asistir queda marcado con "No"', () => {
  const entorno = crearEntorno();
  entorno.enviar(confirmacion({ asistira: false }));
  assert.equal(entorno.confirmaciones()[1][6], 'No');
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

test('un código inventado o ausente no puede guardar nada', () => {
  for (const codigo of ['INVENTADO12345', '', undefined]) {
    const entorno = crearEntorno();
    const respuesta = entorno.enviar(confirmacion({ codigo }));
    assert.equal(respuesta.ok, false, `código ${JSON.stringify(codigo)}`);
    assert.match(respuesta.error, /no es válida/);
    assert.equal(entorno.confirmaciones().length, 0);
  }
});


test('el correo es obligatorio y debe tener un formato válido', () => {
  for (const correo of ['', undefined, 'sin-arroba', 'a@b', 'a@@b.com', 'a b@c.com', 'a@b.c', `${'x'.repeat(250)}@mail.com`]) {
    const entorno = crearEntorno();
    const respuesta = entorno.enviar(confirmacion({ correo }));
    assert.equal(respuesta.ok, false, `correo ${JSON.stringify(correo)}`);
    assert.equal(entorno.confirmaciones().length, 0);
  }
});

test('el correo se guarda en minúsculas', () => {
  const entorno = crearEntorno();
  entorno.enviar(confirmacion({ correo: '  Ana.Lopez@Example.COM ' }));
  assert.equal(entorno.confirmaciones()[1][9], 'ana.lopez@example.com');
});

const D1 = 'dispositivo-uno-1234';
const D2 = 'dispositivo-dos-5678';

test('mismo dispositivo y mismo correo reemplazan la fila, aunque cambien el nombre', () => {
  const entorno = crearEntorno();
  entorno.enviar(confirmacion({ nombre: 'Ana Maria Lopes', dispositivo: D1 }));
  const fechaOriginal = entorno.confirmaciones()[1][0];
  entorno.enviar(confirmacion({ nombre: 'Ana María López', asistira: false, dispositivo: D1 }));
  assert.equal(entorno.confirmaciones().length, 2);
  const fila = entorno.confirmaciones()[1];
  assert.equal(fila[1], 'Ana María López');
  assert.equal(fila[6], 'No');
  assert.equal(fila[10], 2);
  assert.equal(fila[0], fechaOriginal);
});

test('mismo dispositivo y mismo nombre reemplazan la fila, aunque cambien el correo', () => {
  const entorno = crearEntorno();
  entorno.enviar(confirmacion({ correo: 'ana@viejo.com', dispositivo: D1 }));
  entorno.enviar(confirmacion({ correo: 'ana@nuevo.com', dispositivo: D1 }));
  assert.equal(entorno.confirmaciones().length, 2);
  assert.equal(entorno.confirmaciones()[1][9], 'ana@nuevo.com');
});

test('mismo correo y mismo nombre desde otro dispositivo reemplazan la fila', () => {
  const entorno = crearEntorno();
  entorno.enviar(confirmacion({ dispositivo: D1 }));
  entorno.enviar(confirmacion({ dispositivo: D2, asistira: false }));
  assert.equal(entorno.confirmaciones().length, 2);
  assert.equal(entorno.confirmaciones()[1][6], 'No');
  assert.equal(entorno.confirmaciones()[1][12], D2);
});

test('mayúsculas, tildes y espacios en el nombre no crean otra persona', () => {
  const entorno = crearEntorno();
  entorno.enviar(confirmacion({ nombre: 'Ana María López', dispositivo: D1 }));
  entorno.enviar(confirmacion({ nombre: '  ana   maria LOPEZ ', dispositivo: D1 }));
  assert.equal(entorno.confirmaciones().length, 2);
});

test('una familia en el mismo teléfono (mismo dispositivo) no se sobrescribe entre sí', () => {
  const entorno = crearEntorno();
  entorno.enviar(confirmacion({ nombre: 'Ana María López', correo: 'ana@example.com', dispositivo: D1 }));
  entorno.enviar(confirmacion({ nombre: 'Luis Mora Vega', correo: 'luis@example.com', dispositivo: D1 }));
  entorno.enviar(confirmacion({ nombre: 'Sofía Mora López', correo: 'sofia@example.com', dispositivo: D1 }));
  assert.equal(entorno.confirmaciones().length, 4);
});

test('una pareja que comparte correo no se sobrescribe entre sí', () => {
  const entorno = crearEntorno();
  entorno.enviar(confirmacion({ nombre: 'Ana María López', correo: 'familia@example.com', dispositivo: D1 }));
  entorno.enviar(confirmacion({ nombre: 'Luis Mora Vega', correo: 'familia@example.com', dispositivo: D2 }));
  assert.equal(entorno.confirmaciones().length, 3);
});

test('dos personas con el mismo nombre pero distinto correo y dispositivo son invitados distintos', () => {
  const entorno = crearEntorno();
  entorno.enviar(confirmacion({ correo: 'ana1@example.com', dispositivo: D1 }));
  entorno.enviar(confirmacion({ correo: 'ana2@example.com', dispositivo: D2 }));
  assert.equal(entorno.confirmaciones().length, 3);
});

test('si coincide solo una de las tres señales se crea una fila nueva', () => {
  const entorno = crearEntorno();
  entorno.enviar(confirmacion({ nombre: 'Ana María López', correo: 'ana@example.com', dispositivo: D1 }));
  entorno.enviar(confirmacion({ nombre: 'Luis Mora Vega', correo: 'ana@example.com', dispositivo: D2 }));
  entorno.enviar(confirmacion({ nombre: 'Sofía Mora López', correo: 'sofia@example.com', dispositivo: D1 }));
  entorno.enviar(confirmacion({ nombre: 'Ana María López', correo: 'otra@example.com', dispositivo: D2 }));
  assert.equal(entorno.confirmaciones().length, 5);
});

test('sin ID de dispositivo, correo y nombre iguales siguen reemplazando', () => {
  const entorno = crearEntorno();
  entorno.enviar(confirmacion());
  entorno.enviar(confirmacion({ asistira: false }));
  assert.equal(entorno.confirmaciones().length, 2);
  assert.equal(entorno.confirmaciones()[1][10], 2);
});

test('al reemplazar sin ID nuevo se conserva el ID guardado', () => {
  const entorno = crearEntorno();
  entorno.enviar(confirmacion({ dispositivo: D1 }));
  entorno.enviar(confirmacion({ dispositivo: undefined }));
  assert.equal(entorno.confirmaciones()[1][12], D1);
});

test('la respuesta no revela si esa persona ya había confirmado', () => {
  const entorno = crearEntorno();
  assert.deepEqual(entorno.enviar(confirmacion()), { ok: true });
  assert.deepEqual(entorno.enviar(confirmacion()), { ok: true });
});

test('hay un límite de envíos por minuto contra el spam', () => {
  const entorno = crearEntorno();
  let rechazado = null;
  for (let i = 0; i < 40; i += 1) {
    const respuesta = entorno.enviar(confirmacion({ nombre: `Persona Numero ${'abcdefghijklmnopqrstuvwxyz'[i % 26]}${'x'.repeat(i)}`, correo: `persona${i}@example.com` }));
    if (!respuesta.ok) {
      rechazado = respuesta;
      break;
    }
  }
  assert.ok(rechazado, 'en algún momento se frena');
  assert.match(rechazado.error, /demasiadas solicitudes/);
  assert.ok(entorno.confirmaciones().length - 1 <= 30);
});

test('una solicitud gigante se rechaza sin procesarla', () => {
  const entorno = crearEntorno();
  const respuesta = entorno.enviar(confirmacion({ alimentacion: { tiene: true, detalle: 'a'.repeat(40000) } }));
  assert.equal(respuesta.ok, false);
  assert.equal(entorno.confirmaciones().length, 0);
});

test('los errores no muestran detalles internos del script', () => {
  const respuesta = crearEntorno().enviarCrudo('esto no es json');
  assert.equal(respuesta.ok, false);
  assert.doesNotMatch(respuesta.error, /SyntaxError|JSON|at /);
});

test('guarda el ID del dispositivo que hizo el envío', () => {
  const entorno = crearEntorno();
  entorno.enviar(confirmacion({ dispositivo: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' }));
  assert.equal(entorno.confirmaciones()[1][12], 'f47ac10b-58cc-4372-a567-0e02b2c3d479');
});

test('un ID de dispositivo con formato raro se descarta', () => {
  const entorno = crearEntorno();
  entorno.enviar(confirmacion({ dispositivo: '<script>alert(1)</script>' }));
  assert.equal(entorno.confirmaciones()[1][12], '');
});

test('un mismo dispositivo no puede enviar más de 10 veces en 10 minutos', () => {
  const entorno = crearEntorno();
  let rechazada = null;
  for (let i = 0; i < 15; i += 1) {
    const respuesta = entorno.enviar(confirmacion({ nombre: `Persona Numero ${'abcdefghijklmnopqrstuvwxyz'[i]}`, correo: `p${i}@example.com`, dispositivo: 'dispositivo-abusivo-1' }));
    if (!respuesta.ok) {
      rechazada = { respuesta, enviosAntes: i };
      break;
    }
  }
  assert.ok(rechazada, 'se frena');
  assert.equal(rechazada.enviosAntes, 10);
  assert.match(rechazada.respuesta.error, /demasiadas solicitudes/);
  assert.equal(entorno.enviar(confirmacion({ nombre: 'Otra Persona Mas', correo: 'otra@example.com', dispositivo: 'otro-dispositivo-2' })).ok, true);
});
