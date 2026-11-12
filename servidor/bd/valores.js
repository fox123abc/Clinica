/*
 * bd/valores.js
 * Valores por defecto del modelo que también usan las rutas.
 * Si cambian, actualizar los DEFAULT y CHECK de esquema.sql.
 */

// Precio de ejemplo (COP) de una especialidad nueva; no son tarifas reales
const PRECIO_EJEMPLO_POR_DEFECTO = 80000;

// Pacientes que atiende un médico por día, y el máximo permitido
const CUPOS_DIARIOS_POR_DEFECTO = 4;
const CUPOS_DIARIOS_MAXIMOS = 40;

module.exports = { PRECIO_EJEMPLO_POR_DEFECTO, CUPOS_DIARIOS_POR_DEFECTO, CUPOS_DIARIOS_MAXIMOS };
