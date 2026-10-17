/*
 * reiniciar-bd.js
 * Borra la base de datos local para empezar de cero (npm run reiniciar-bd).
 * La próxima vez que se inicie el servidor se volverá a crear con el
 * catálogo de demostración.
 */

const fs = require("node:fs");
const path = require("node:path");

const RUTA_BD = process.env.RUTA_BD || path.join(__dirname, "datos", "altavida.db");

["", "-wal", "-shm"].forEach((sufijo) => {
  fs.rmSync(RUTA_BD + sufijo, { force: true });
});
console.log("Base de datos eliminada: " + RUTA_BD);
