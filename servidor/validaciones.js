/*
 * validaciones.js
 * Reglas de formato reutilizadas por varias rutas (registro de pacientes,
 * empresas clientes, horarios). Cada función devuelve true si el valor es válido.
 */

const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;          // "HH:MM" de 00:00 a 23:59
const NIT = /^[0-9.\-\s]{5,20}$/;                  // números, puntos y guion

const esCorreo = (valor) => CORREO.test(valor);
const esHora = (valor) => typeof valor === "string" && HORA.test(valor);
const esNit = (valor) => NIT.test(valor);

// Teléfono de 7 a 15 dígitos (se ignoran espacios, guiones y paréntesis)
function esTelefono(valor) {
  const digitos = String(valor).replace(/\D/g, "").length;
  return digitos >= 7 && digitos <= 15;
}

// Entero dentro de un rango, incluidos los extremos
function esEnteroEntre(valor, minimo, maximo) {
  return Number.isInteger(valor) && valor >= minimo && valor <= maximo;
}

module.exports = { esCorreo, esHora, esNit, esTelefono, esEnteroEntre };
