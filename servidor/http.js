/*
 * http.js
 * Utilidades de entrada y salida HTTP compartidas por todas las rutas:
 * limpiar textos del cuerpo, responder errores con un formato único y
 * representar errores de negocio.
 */

// Texto recibido del cliente, sin espacios sobrantes ("" si no es texto)
function texto(valor) {
  return typeof valor === "string" ? valor.trim() : "";
}

// Responde { error, campos }: "campos" marca el error de cada campo del formulario
function error(res, estado, mensaje, campos) {
  return res.status(estado).json({ error: mensaje, campos: campos || {} });
}

/*
 * Error de una regla del negocio (por ejemplo, "no hay cupos suficientes").
 * Se lanza desde la lógica del dominio y la ruta lo convierte en una respuesta.
 */
class ErrorDeNegocio extends Error {
  constructor(estado, mensaje, campos) {
    super(mensaje);
    this.name = "ErrorDeNegocio";
    this.estado = estado;
    this.campos = campos || {};
  }
}

// SQLite rechazó un INSERT/UPDATE por el índice único (horario ya tomado, NIT repetido…)
function esViolacionDeUnicidad(e) {
  return /UNIQUE constraint failed/i.test(e && e.message);
}

module.exports = { texto, error, ErrorDeNegocio, esViolacionDeUnicidad };
