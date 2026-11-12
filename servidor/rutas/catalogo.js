/*
 * rutas/catalogo.js — lecturas públicas del Catálogo y de la agenda
 * Especialidades y médicos, horas libres (con sesión) y agenda pública
 * de la portada (sin sesión y sin datos de pacientes).
 */

const { bd } = require("../bd");
const { requiereSesion } = require("../sesion");
const { texto, error } = require("../http");
const { fechaHoy, esFechaValida, horasDelDia, horariosLibres } = require("../agenda");

// Lee y valida ?medicoId=&fecha=; responde 400 y devuelve null si faltan
function leerMedicoYFecha(req, res) {
  const medicoId = texto(req.query.medicoId);
  const fecha = texto(req.query.fecha);
  if (!medicoId || !esFechaValida(fecha)) {
    error(res, 400, "Médico y fecha son obligatorios.");
    return null;
  }
  return { medicoId, fecha };
}

function registrarRutasCatalogo(app) {
  app.get("/api/catalogo", (req, res) => {
    const especialidades = bd.prepare("SELECT id, nombre, precio FROM especialidades ORDER BY nombre").all();
    const medicos = bd.prepare(`
      SELECT m.id, m.nombre, m.especialidad_id AS especialidadId,
             (SELECT GROUP_CONCAT(DISTINCT d.dia_semana) FROM disponibilidad d WHERE d.medico_id = m.id) AS dias
      FROM medicos m ORDER BY m.nombre
    `).all().map((m) => ({
      id: m.id,
      nombre: m.nombre,
      especialidadId: m.especialidadId,
      dias: m.dias ? m.dias.split(",").map(Number).sort() : []
    }));
    res.json({ especialidades, medicos });
  });

  // Solo las horas libres (formulario de solicitud del paciente)
  app.get("/api/horarios-disponibles", requiereSesion, (req, res) => {
    const consulta = leerMedicoYFecha(req, res);
    if (!consulta) return;
    if (consulta.fecha < fechaHoy()) return res.json([]);
    res.json(horariosLibres(consulta.medicoId, consulta.fecha, Number(req.query.excluir) || 0));
  });

  // Portada: todas las horas del día con libre true/false; nunca dice quién ocupa una hora
  app.get("/api/agenda-publica", (req, res) => {
    const consulta = leerMedicoYFecha(req, res);
    if (!consulta) return;
    if (consulta.fecha < fechaHoy()) return res.json([]);
    const libres = new Set(horariosLibres(consulta.medicoId, consulta.fecha, 0));
    res.json(horasDelDia(consulta.medicoId, consulta.fecha).map((hora) => ({ hora, libre: libres.has(hora) })));
  });
}

module.exports = { registrarRutasCatalogo };
