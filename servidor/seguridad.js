/*
 * seguridad.js
 * Hash y verificación de contraseñas con scrypt y sal aleatoria
 * (nunca se guardan en texto plano). Lo usan las rutas de autenticación y administración, y bd/semillas.js.
 */

const crypto = require("node:crypto");

function generarHash(contrasena) {
  const sal = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(contrasena, sal, 64).toString("hex");
  return sal + ":" + hash;
}

function verificarContrasena(contrasena, guardado) {
  const [sal, hash] = guardado.split(":");
  const calculado = crypto.scryptSync(contrasena, sal, 64);
  return crypto.timingSafeEqual(calculado, Buffer.from(hash, "hex"));
}

module.exports = { generarHash, verificarContrasena };
