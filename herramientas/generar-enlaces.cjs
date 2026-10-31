const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ALFABETO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const LARGO_DEL_CODIGO = 12;

function crearCodigo(secreto, fila) {
  const huella = crypto.createHmac('sha256', secreto).update(JSON.stringify([fila.saludo, fila.nombre, fila.espacios, fila.nota])).digest();
  let codigo = '';
  for (let i = 0; i < LARGO_DEL_CODIGO; i += 1) codigo += ALFABETO[huella[i] % ALFABETO.length];
  return codigo;
}

function separar(linea) {
  const campos = [];
  let actual = '';
  let entreComillas = false;
  for (let i = 0; i < linea.length; i += 1) {
    const caracter = linea[i];
    if (caracter === '"' && linea[i + 1] === '"') {
      actual += '"';
      i += 1;
    } else if (caracter === '"') {
      entreComillas = !entreComillas;
    } else if (caracter === ',' && !entreComillas) {
      campos.push(actual.trim());
      actual = '';
    } else {
      actual += caracter;
    }
  }
  campos.push(actual.trim());
  return campos;
}

function leerInvitados(texto) {
  const lineas = texto.replace(/^﻿/, '').split(/\r?\n/).filter((linea) => linea.trim());
  if (lineas.length < 2) throw new Error('invitados.csv no tiene invitados.');

  const encabezados = separar(lineas[0]).map((titulo) => titulo.toLowerCase());
  const columna = (nombre) => encabezados.indexOf(nombre);
  if (['saludo', 'nombre', 'espacios'].some((nombre) => columna(nombre) === -1)) {
    throw new Error('La primera fila de invitados.csv debe incluir: saludo,nombre,espacios');
  }

  const problemas = [];
  const vistas = new Set();
  const filas = lineas.slice(1).map((linea, indice) => {
    const campos = separar(linea);
    const dato = (nombre) => (columna(nombre) === -1 ? '' : campos[columna(nombre)] || '');
    const fila = { saludo: dato('saludo'), nombre: dato('nombre'), espacios: Number.parseInt(dato('espacios'), 10), nota: dato('nota') };
    const referencia = `Fila ${indice + 2}${fila.saludo ? ` (${fila.saludo})` : ''}`;

    if (![1, 2].includes(fila.espacios)) problemas.push(`${referencia}: "espacios" debe ser 1 o 2.`);
    const llave = JSON.stringify([fila.saludo, fila.nombre, fila.espacios, fila.nota]);
    if (vistas.has(llave)) problemas.push(`${referencia}: está repetida. Si es otra invitación igual, agrega una "nota" distinta.`);
    vistas.add(llave);
    return fila;
  });

  if (problemas.length > 0) throw new Error(problemas.join('\n'));
  return filas;
}

const entreComillas = (texto) => `"${String(texto).replace(/"/g, '""')}"`;
const escribirCsv = (archivo, filas) => fs.writeFileSync(archivo, `﻿${filas.map((fila) => fila.map(entreComillas).join(',')).join('\r\n')}\r\n`);

function leerOCrearSecreto(archivo) {
  if (fs.existsSync(archivo)) return fs.readFileSync(archivo, 'utf8').trim();
  const secreto = crypto.randomBytes(32).toString('hex');
  fs.writeFileSync(archivo, `${secreto}\n`);
  console.log('Se creó herramientas/.secreto. Guárdalo (no se sube a git): sin él, los códigos cambiarían.');
  return secreto;
}

function principal() {
  const direccion = (process.argv[2] || '').trim().replace(/\/+$/, '');
  if (!/^https?:\/\/[^\s/]+(\/[^\s]*)?$/.test(direccion)) {
    console.error('Falta la dirección del sitio. Ejemplo:');
    console.error('  node herramientas/generar-enlaces.cjs https://usuario.github.io/nombre-del-repositorio');
    process.exit(1);
  }

  const entrada = path.join(__dirname, 'invitados.csv');
  if (!fs.existsSync(entrada)) {
    console.error('No existe herramientas/invitados.csv. Copia invitados.ejemplo.csv y edítalo.');
    process.exit(1);
  }

  let filas;
  try {
    filas = leerInvitados(fs.readFileSync(entrada, 'utf8'));
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }

  const secreto = leerOCrearSecreto(path.join(__dirname, '.secreto'));
  const conCodigo = filas.map((fila) => ({ ...fila, codigo: crearCodigo(secreto, fila) }));

  escribirCsv(path.join(__dirname, 'enlaces.csv'), [
    ['nota', 'saludo', 'nombre', 'espacios', 'enlace'],
    ...conCodigo.map((f) => [f.nota, f.saludo, f.nombre, f.espacios, `${direccion}/?c=${f.codigo}`]),
  ]);
  escribirCsv(path.join(__dirname, 'invitaciones-hoja.csv'), [
    ['Código', 'Saludo', 'Nombre', 'Espacios'],
    ...conCodigo.map((f) => [f.codigo, f.saludo, f.nombre, f.espacios]),
  ]);

  console.log(`${conCodigo.length} invitaciones.`);
  console.log('  herramientas/enlaces.csv            → los enlaces para mandar');
  console.log('  herramientas/invitaciones-hoja.csv  → pegar en la pestaña "Invitaciones" de la hoja de Google');
}

if (require.main === module) principal();

module.exports = { crearCodigo, leerInvitados, separar };
