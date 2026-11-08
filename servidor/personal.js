/*
 * personal.js
 * Rutas de la API para el personal de la clínica:
 *   - Recepción: ver, confirmar y cancelar las citas de cualquier paciente.
 *   - Médico: ver su agenda y marcar citas como atendidas.
 *   - Administración: crear especialidades y médicos, y definir su disponibilidad.
 *
 * Las reglas marcadas como "provisional" dependen de decisiones aún abiertas
 * en docs/DDD-EVENT-STORMING.md (sección 9, hotspots).
 */

const crypto = require("node:crypto");

const HORA_VALIDA = /^([01]\d|2[0-3]):[0-5]\d$/;

function registrarRutasPersonal(app, { bd, enTransaccion, requiereRol, error, texto, fechaHoy }) {
  const CONSULTA_CITA = `
    SELECT c.id, c.fecha, c.horario, c.motivo, c.estado,
           u.nombre AS paciente, u.telefono,
           m.id AS medicoId, m.nombre AS medico, e.nombre AS especialidad
    FROM citas c
    JOIN usuarios u ON u.id = c.paciente_id
    JOIN medicos m ON m.id = c.medico_id
    JOIN especialidades e ON e.id = m.especialidad_id
  `;

  const obtenerCita = (id) => bd.prepare(CONSULTA_CITA + " WHERE c.id = ?").get(Number(id)) || null;

  function cambiarEstado(id, estado) {
    bd.prepare("UPDATE citas SET estado = ?, actualizada_en = datetime('now', 'localtime') WHERE id = ?").run(estado, id);
    return obtenerCita(id);
  }

  /* ---------------------------- Recepción ---------------------------- */

  const recepcion = requiereRol("recepcionista");

  app.get("/api/recepcion/citas", recepcion, (req, res) => {
    res.json(bd.prepare(CONSULTA_CITA + " ORDER BY c.fecha, c.horario").all());
  });

  // Provisional (H4): la recepcionista confirma manualmente las citas pendientes
  app.patch("/api/recepcion/citas/:id/confirmar", recepcion, (req, res) => {
    const cita = obtenerCita(req.params.id);
    if (!cita) return error(res, 404, "La cita no existe.");
    if (cita.estado !== "pendiente") return error(res, 409, "Solo se pueden confirmar citas pendientes.");
    res.json(cambiarEstado(cita.id, "confirmada"));
  });

  // Provisional (H3): sin plazo mínimo para cancelar
  app.patch("/api/recepcion/citas/:id/cancelar", recepcion, (req, res) => {
    const cita = obtenerCita(req.params.id);
    if (!cita) return error(res, 404, "La cita no existe.");
    if (cita.estado !== "pendiente" && cita.estado !== "confirmada") {
      return error(res, 409, "Esta cita ya no se puede cancelar.");
    }
    res.json(cambiarEstado(cita.id, "cancelada"));
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

  app.patch("/api/medico/citas/:id/atender", medico, (req, res) => {
    const cita = obtenerCita(req.params.id);
    if (!cita || cita.medicoId !== req.usuario.medicoId) return error(res, 404, "La cita no existe en tu agenda.");
    if (cita.estado !== "confirmada") return error(res, 409, "Solo se pueden atender citas confirmadas.");
    res.json(cambiarEstado(cita.id, "atendida"));
  });

  /* -------------------------- Administración ------------------------- */

  const administracion = requiereRol("administrador");

  function agruparFranjas(franjas) {
    const porDia = new Map();
    franjas.forEach((f) => {
      if (!porDia.has(f.dia)) porDia.set(f.dia, []);
      porDia.get(f.dia).push(f.hora);
    });
    return [...porDia.entries()].map(([dia, horas]) => ({ dia, horas }));
  }

  app.get("/api/admin/catalogo", administracion, (req, res) => {
    const especialidades = bd.prepare("SELECT id, nombre FROM especialidades ORDER BY nombre").all();
    const franjas = bd.prepare(
      "SELECT medico_id AS medicoId, dia_semana AS dia, hora FROM disponibilidad ORDER BY dia_semana, hora"
    ).all();
    const medicos = bd.prepare("SELECT id, nombre, especialidad_id AS especialidadId FROM medicos ORDER BY nombre")
      .all()
      .map((m) => ({ ...m, disponibilidad: agruparFranjas(franjas.filter((f) => f.medicoId === m.id)) }));
    res.json({ especialidades, medicos });
  });

  app.post("/api/admin/especialidades", administracion, (req, res) => {
    const nombre = texto(req.body.nombre);
    if (nombre.length < 3 || nombre.length > 60) {
      return error(res, 400, "Revisa los datos.", { nombre: "El nombre debe tener entre 3 y 60 caracteres." });
    }
    if (bd.prepare("SELECT 1 FROM especialidades WHERE lower(nombre) = lower(?)").get(nombre)) {
      return error(res, 409, "Esa especialidad ya existe.", { nombre: "Ya existe una especialidad con ese nombre." });
    }
    const id = "esp-" + crypto.randomBytes(4).toString("hex");
    bd.prepare("INSERT INTO especialidades (id, nombre) VALUES (?, ?)").run(id, nombre);
    res.status(201).json({ id, nombre });
  });

  app.post("/api/admin/medicos", administracion, (req, res) => {
    const nombre = texto(req.body.nombre);
    const especialidadId = texto(req.body.especialidadId);
    const campos = {};
    if (nombre.length < 3 || nombre.length > 80) campos.nombre = "El nombre debe tener entre 3 y 80 caracteres.";
    if (!bd.prepare("SELECT 1 FROM especialidades WHERE id = ?").get(especialidadId)) {
      campos.especialidadId = "Selecciona una especialidad válida.";
    }
    if (Object.keys(campos).length) return error(res, 400, "Revisa los datos.", campos);

    const id = "med-" + crypto.randomBytes(4).toString("hex");
    bd.prepare("INSERT INTO medicos (id, nombre, especialidad_id) VALUES (?, ?, ?)").run(id, nombre, especialidadId);
    res.status(201).json({ id, nombre, especialidadId, disponibilidad: [] });
  });

  // Reemplaza todas las franjas del médico. Las citas ya agendadas no se modifican.
  app.put("/api/admin/medicos/:id/disponibilidad", administracion, (req, res) => {
    const medicoId = texto(req.params.id);
    if (!bd.prepare("SELECT 1 FROM medicos WHERE id = ?").get(medicoId)) return error(res, 404, "El médico no existe.");

    const franjas = req.body.franjas;
    if (!Array.isArray(franjas) || franjas.length > 7) return error(res, 400, "Franjas no válidas.");

    const dias = new Set();
    const filas = [];
    for (const franja of franjas) {
      const dia = Number(franja && franja.dia);
      const horas = franja && franja.horas;
      if (!Number.isInteger(dia) || dia < 0 || dia > 6 || dias.has(dia) || !Array.isArray(horas) || horas.length > 24) {
        return error(res, 400, "Franjas no válidas.");
      }
      dias.add(dia);
      for (const hora of horas) {
        if (typeof hora !== "string" || !HORA_VALIDA.test(hora)) {
          return error(res, 400, "Hora no válida: use el formato HH:MM (por ejemplo 08:30).");
        }
        filas.push([dia, hora]);
      }
    }

    enTransaccion(() => {
      bd.prepare("DELETE FROM disponibilidad WHERE medico_id = ?").run(medicoId);
      const insertar = bd.prepare("INSERT OR IGNORE INTO disponibilidad (medico_id, dia_semana, hora) VALUES (?, ?, ?)");
      filas.forEach(([dia, hora]) => insertar.run(medicoId, dia, hora));
    });

    const guardadas = bd.prepare(
      "SELECT dia_semana AS dia, hora FROM disponibilidad WHERE medico_id = ? ORDER BY dia_semana, hora"
    ).all(medicoId);
    res.json({ id: medicoId, disponibilidad: agruparFranjas(guardadas) });
  });
}

module.exports = { registrarRutasPersonal };
