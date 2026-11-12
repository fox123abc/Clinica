/*
 * bd/conexion.js
 * Abre la base SQLite (servidor/datos/altavida.db, o la ruta de RUTA_BD)
 * con el módulo integrado "node:sqlite": no hay que instalar ningún motor aparte.
 */

const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");

const RUTA_BD = process.env.RUTA_BD || path.join(__dirname, "..", "datos", "altavida.db");

fs.mkdirSync(path.dirname(RUTA_BD), { recursive: true });

const bd = new DatabaseSync(RUTA_BD);

// foreign_keys: SQLite solo hace cumplir las claves foráneas si se activa en cada conexión
// journal_mode WAL: lecturas y escrituras simultáneas sin bloquearse
bd.exec(`
  PRAGMA foreign_keys = ON;
  PRAGMA journal_mode = WAL;
`);

// node:sqlite no trae un helper de transacciones, así que se hace a mano
function enTransaccion(fn) {
  bd.exec("BEGIN");
  try {
    const resultado = fn();
    bd.exec("COMMIT");
    return resultado;
  } catch (error) {
    bd.exec("ROLLBACK");
    throw error;
  }
}

// Nombres de las columnas de una tabla ([] si la tabla no existe)
function columnas(tabla) {
  return bd.prepare(`PRAGMA table_info(${tabla})`).all().map((c) => c.name);
}

module.exports = { bd, enTransaccion, columnas, RUTA_BD };
