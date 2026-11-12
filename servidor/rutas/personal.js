/*
 * rutas/personal.js — citas vistas por el personal
 *   - Recepción (Agendamiento): ver, confirmar y cancelar las citas de cualquier paciente o empresa.
 *   - Médico (Atención Médica): ver su agenda y marcar citas como atendidas.
 * Las reglas marcadas como "provisional" dependen de decisiones aún abiertas
 * en docs/DDD-EVENT-STORMING.md (sección 9, hotspots).
 */

const { bd } = require("../bd");
const { requiereRol } = require("../sesion");
const { error } = require("../http");
const { fechaHoy } = require("../agenda");

// Una cita es de un paciente o de una orden de empresa: "paciente" muestra quién corresponda
const CONSULTA_CITA = `
  SELECT c.id, c.fecha, c.horario, c.motivo, c.estado, c.orden_id AS ordenId,
         COALESCE(u.nombre, emp.nombre) AS paciente,
         COALESCE(u.telefono, emp.telefono) AS telefono,
         m.id AS medicoId, m.nombre AS medico, e.nombre AS especialidad
  FROM citas c
  LEFT JOIN usuarios u ON u.id = c.paciente_id
  LEFT JOIN ordenes o ON o.id = c.orden_id
  LEFT JOIN empresas emp ON emp.id = o.empresa_id
  JOIN medicos m ON m.id = c.medico_id
  JOIN especialidades e ON e.id = m.especialidad_id
`;

const obtenerCita = (id) => bd.prepare(CONSULTA_CITA + " WHERE c.id = ?").get(Number(id)) || null;

function cambiarEstado(id, estado) {
  bd.prepare("UPDATE citas SET estado = ?, actualizada_en = datetime('now', 'localtime') WHERE id = ?").run(estado, id);
  return obtenerCita(id);
}

// Carga la cita de :id en req.cita (404 si no existe)
function cargarCita(req, res, next) {
  req.cita = obtenerCita(req.params.id);
  if (!req.cita) return error(res, 404, "La cita no existe.");
  next();
}

function registrarRutasPersonal(app) {
  /* ---------------------------- Recepción ---------------------------- */

  const recepcion = requiereRol("recepcionista");

  app.get("/api/recepcion/citas", recepcion, (req, res) => {
    res.json(bd.prepare(CONSULTA_CITA + " ORDER BY c.fecha, c.horario").all());
  });

  // Provisional (H4): la recepcionista confirma manualmente las citas pendientes
  app.patch("/api/recepcion/citas/:id/confirmar", recepcion, cargarCita, (req, res) => {
    if (req.cita.estado !== "pendiente") return error(res, 409, "Solo se pueden confirmar citas pendientes.");
    res.json(cambiarEstado(req.cita.id, "confirmada"));
  });

  // Provisional (H3): sin plazo mínimo para cancelar
  app.patch("/api/recepcion/citas/:id/cancelar", recepcion, cargarCita, (req, res) => {
    if (!["pendiente", "confirmada"].includes(req.cita.estado)) return error(res, 409, "Esta cita ya no se puede cancelar.");
    res.json(cambiarEstado(req.cita.id, "cancelada"));
  });

  /* ------------------------------ Médico ----------------------------- */

  const medico = [
    ...requiereRol("medico"),
    (req, res, next) => (req.usuario.medicoId ? next() : error(res, 403, "Tu usuario no está vinculado a un médico."))
  ];

  app.get("/api/medico/agenda", medico, (req, res) => {
    res.json(bd.prepare(
      CONSULTA_CITA + " WHERE c.medico_id = ? AND c.estado <> 'cancelada' AND c.fecha >= ? ORDER BY c.fecha, c.horario"
    ).all(req.usuario.medicoId, fechaHoy()));
  });

  // Un médico solo atiende citas confirmadas de su propia agenda
  app.patch("/api/medico/citas/:id/atender", medico, (req, res) => {
    const cita = obtenerCita(req.params.id);
    if (!cita || cita.medicoId !== req.usuario.medicoId) return error(res, 404, "La cita no existe en tu agenda.");
    if (cita.estado !== "confirmada") return error(res, 409, "Solo se pueden atender citas confirmadas.");
    res.json(cambiarEstado(cita.id, "atendida"));
  });
}

module.exports = { registrarRutasPersonal };
