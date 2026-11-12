/*
 * agenda.js
 * Reglas de la agenda que comparten los contextos de Agendamiento (pacientes)
 * y Órdenes de Empresas: fechas locales y horas libres de un médico.
 * Es el "Shared Kernel" descrito en docs/DDD-EVENT-STORMING.md: un cambio
 * aquí afecta a las citas de pacientes y a la asignación de órdenes.
 */

const { bd } = require("./bd");

/* ----------------------------- Fechas ------------------------------ */

// Fecha local de hoy, "AAAA-MM-DD" (la zona horaria la fija TZ, ver docker-compose.yml)
function fechaHoy() {
  const hoy = new Date();
  hoy.setMinutes(hoy.getMinutes() - hoy.getTimezoneOffset());
  return hoy.toISOString().slice(0, 10);
}

// Hora local actual, "HH:MM"
function horaActual() {
  const ahora = new Date();
  return String(ahora.getHours()).padStart(2, "0") + ":" + String(ahora.getMinutes()).padStart(2, "0");
}

// "2026-11-13" -> 0..6 (0 = domingo). Se calcula en UTC para no depender de la zona horaria.
function diaSemana(fechaISO) {
  return new Date(fechaISO + "T00:00:00Z").getUTCDay();
}

function esFechaValida(valor) {
  return /^\d{4}-\d{2}-\d{2}$/.test(valor) && !isNaN(new Date(valor + "T00:00:00Z"));
}

// "2026-11-13" + 3 -> "2026-11-16"
function sumarDias(fechaISO, dias) {
  const base = new Date(fechaISO + "T00:00:00Z");
  return new Date(base.getTime() + dias * 86400000).toISOString().slice(0, 10);
}

/* --------------------------- Horas libres -------------------------- */

const consultas = {
  cupos: bd.prepare("SELECT cupos_diarios AS cupos FROM medicos WHERE id = ?"),
  horasDelDia: bd.prepare("SELECT hora FROM disponibilidad WHERE medico_id = ? AND dia_semana = ? ORDER BY hora"),
  ocupadas: bd.prepare(`
    SELECT horario FROM citas
    WHERE medico_id = ? AND fecha = ? AND estado <> 'cancelada' AND id <> ?
  `)
};

// Todas las horas del horario de un médico para el día de la semana de esa fecha
function horasDelDia(medicoId, fecha) {
  return consultas.horasDelDia.all(medicoId, diaSemana(fecha)).map((f) => f.hora);
}

/*
 * Horas libres de un médico en una fecha. Descarta:
 *   - las horas ya ocupadas por una cita activa (se puede excluir una cita,
 *     para reprogramarla sin que choque consigo misma);
 *   - si es hoy, las horas que ya pasaron;
 *   - todas, si el médico ya completó sus cupos diarios ese día.
 */
function horariosLibres(medicoId, fecha, excluirCitaId) {
  const medico = consultas.cupos.get(medicoId);
  if (!medico) return [];

  const ocupadas = new Set(consultas.ocupadas.all(medicoId, fecha, excluirCitaId || 0).map((f) => f.horario));
  if (ocupadas.size >= medico.cupos) return [];

  const esHoy = fecha === fechaHoy();
  const ahora = horaActual();
  return horasDelDia(medicoId, fecha).filter((h) => !ocupadas.has(h) && (!esHoy || h > ahora));
}

module.exports = { fechaHoy, horaActual, diaSemana, esFechaValida, sumarDias, horasDelDia, horariosLibres };
