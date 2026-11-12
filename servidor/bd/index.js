/*
 * bd/index.js — punto de entrada de la base de datos
 *
 *   conexion.js     abre SQLite y ofrece enTransaccion()
 *   esquema.sql     tablas, claves foráneas, restricciones e índices
 *   migraciones.js  actualiza bases antiguas a la versión de esquema.sql
 *   semillas.js     catálogo y cuentas de demostración
 *   valores.js      valores por defecto compartidos con las rutas
 *
 * Al cargar este módulo la base queda lista: migrada y con datos de demostración.
 * El resto del servidor solo usa require("./bd") o require("../bd").
 */

const { bd, enTransaccion, RUTA_BD } = require("./conexion");
const { migrar } = require("./migraciones");
const { sembrar } = require("./semillas");
const valores = require("./valores");

migrar();
sembrar();

module.exports = { bd, enTransaccion, RUTA_BD, ...valores };
