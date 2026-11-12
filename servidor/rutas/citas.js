/*
 * rutas/citas.js — contexto Agendamiento de Citas (Core), lado del paciente
 * Solicitar, consultar, reprogramar y cancelar sus propias citas.
 */

const { bd } = require("../bd");
const { requiereRol } = require("../sesion");
const { texto, error, esViolacionDeUnicidad } = require("../http");
const { fechaHoy, esFechaValida, horariosLibres } = require("../agenda");

// Estados en los que el paciente todavía puede reprogramar o cancelar
const ESTADOS_MODIFICABLES = ["pendiente", "confirmada"];
const MAX_MOTIVO = 300;

const CONSULTA_CITA = `
  SELECT c.id, c.fecha, c.horario, c.motivo, c.estado, c.creada_en AS creadaEn,
         c.paciente_id AS pacienteId,
         m.id AS medicoId, m.nombre AS medico,
         e.id AS especialidadId, e.nombre AS especialidad
  FROM citas c
  JOIN medicos m ON m.id = c.medico_id
  JOIN especialidades e ON e.id = m.especialidad_id
`;

// Un paciente solo ve sus citas: toda consulta filtra por paciente_id
function obtenerCitaDelPaciente(id, pacienteId) {
  return bd.prepare(CONSULTA_CITA + " WHERE c.id = ? AND c.paciente_id = ?").get(Number(id), pacienteId) || null;
}

// Valida especialidad, médico, fecha y horario; devuelve { campos } con los errores y { datos } limpios
function validarDatosCita(cuerpo, excluirCitaId) {
  const campos = {};
  const especialidadId = texto(cuerpo.especialidadId);
  const medicoId = texto(cuerpo.medicoId);
  const fecha = texto(cuerpo.fecha);
  const horario = texto(cuerpo.horario);

  const medico = bd.prepare("SELECT id, especialidad_id FROM medicos WHERE id = ?").get(medicoId);
  if (!especialidadId) campos.especialidadId = "Este campo es obligatorio.";
  if (!medico) campos.medicoId = "Selecciona un médico válido.";
  else if (medico.especialidad_id !== especialidadId) campos.medicoId = "El médico no pertenece a la especialidad elegida.";

  if (!esFechaValida(fecha)) campos.fecha = "Este campo es obligatorio.";
  else if (fecha < fechaHoy()) campos.fecha = "No es posible solicitar citas en fechas pasadas.";

  if (!horario) campos.horario = "Este campo es obligatorio.";
  else if (!campos.medicoId && !campos.fecha && !horariosLibres(medicoId, fecha, excluirCitaId).includes(horario)) {
    campos.horario = "El horario seleccionado ya no está disponible. Elige otro.";
  }

  const motivo = texto(cuerpo.motivo).slice(0, MAX_MOTIVO);
  return { campos, datos: { medicoId, fecha, horario, motivo } };
}

// Dos pacientes tomaron la misma hora al mismo tiempo: el índice único rechazó el segundo
function responderConflictoDeHorario(res) {
  return error(res, 409, "Otro paciente acaba de tomar ese horario. Elige otro.", { horario: "Horario no disponible." });
}

function registrarRutasCitas(app) {
  app.use("/api/citas", requiereRol("paciente"));

  app.get("/api/citas", (req, res) => {
    res.json(bd.prepare(CONSULTA_CITA + " WHERE c.paciente_id = ? ORDER BY c.fecha, c.horario").all(req.usuario.id));
  });

  app.get("/api/citas/:id", (req, res) => {
    const cita = obtenerCitaDelPaciente(req.params.id, req.usuario.id);
    if (!cita) return error(res, 404, "La cita no existe o no pertenece a tu cuenta.");
    res.json(cita);
  });

  // Toda cita nueva queda pendiente hasta que recepción la confirme
  app.post("/api/citas", (req, res) => {
    const { campos, datos } = validarDatosCita(req.body, 0);
    if (Object.keys(campos).length) return error(res, 400, "Revisa los datos de la cita.", campos);

    try {
      const resultado = bd.prepare(
        "INSERT INTO citas (paciente_id, medico_id, fecha, horario, motivo) VALUES (?, ?, ?, ?, ?)"
      ).run(req.usuario.id, datos.medicoId, datos.fecha, datos.horario, datos.motivo || null);
      res.status(201).json(obtenerCitaDelPaciente(resultado.lastInsertRowid, req.usuario.id));
    } catch (e) {
      if (esViolacionDeUnicidad(e)) return responderConflictoDeHorario(res);
      throw e;
    }
  });

  // Reprogramar: cambia médico, fecha u horario y la cita vuelve a quedar pendiente
  app.put("/api/citas/:id", (req, res) => {
    const cita = obtenerCitaDelPaciente(req.params.id, req.usuario.id);
    if (!cita) return error(res, 404, "La cita no existe o no pertenece a tu cuenta.");
    if (!ESTADOS_MODIFICABLES.includes(cita.estado)) return error(res, 409, "Esta cita ya no se puede reprogramar.");

    const { campos, datos } = validarDatosCita(req.body, cita.id);
    if (Object.keys(campos).length) return error(res, 400, "Revisa los datos de la cita.", campos);

    try {
      bd.prepare(`
        UPDATE citas SET medico_id = ?, fecha = ?, horario = ?, motivo = ?, estado = 'pendiente',
                         actualizada_en = datetime('now', 'localtime')
        WHERE id = ?
      `).run(datos.medicoId, datos.fecha, datos.horario, datos.motivo || null, cita.id);
      res.json(obtenerCitaDelPaciente(cita.id, req.usuario.id));
    } catch (e) {
      if (esViolacionDeUnicidad(e)) return responderConflictoDeHorario(res);
      throw e;
    }
  });

  // Cancelar libera el horario (las canceladas no cuentan en el índice único ni en los cupos)
  app.patch("/api/citas/:id/cancelar", (req, res) => {
    const cita = obtenerCitaDelPaciente(req.params.id, req.usuario.id);
    if (!cita) return error(res, 404, "La cita no existe o no pertenece a tu cuenta.");
    if (!ESTADOS_MODIFICABLES.includes(cita.estado)) return error(res, 409, "Esta cita ya no se puede cancelar.");

    bd.prepare("UPDATE citas SET estado = 'cancelada', actualizada_en = datetime('now', 'localtime') WHERE id = ?").run(cita.id);
    res.json(obtenerCitaDelPaciente(cita.id, req.usuario.id));
  });
}

module.exports = { registrarRutasCitas };
