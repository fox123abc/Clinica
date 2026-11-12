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
const { PRECIO_EJEMPLO_POR_DEFECTO, CUPOS_DIARIOS_POR_DEFECTO } = require("./bd");

function registrarRutasPersonal(app, { bd, enTransaccion, requiereRol, error, texto, fechaHoy }) {
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

  // Panel de administración: cifras del día a día en una sola consulta
  app.get("/api/admin/resumen", administracion, (req, res) => {
    const hoy = fechaHoy();
    const base = new Date(hoy + "T00:00:00Z");
    const semana = Array.from({ length: 7 }, (_, i) => new Date(base.getTime() + i * 86400000).toISOString().slice(0, 10));
    const finSemana = semana[6];

    const porEstado = { pendiente: 0, confirmada: 0, atendida: 0, cancelada: 0 };
    bd.prepare("SELECT estado, COUNT(*) AS total FROM citas GROUP BY estado").all()
      .forEach((f) => { porEstado[f.estado] = f.total; });

    const activas = "estado <> 'cancelada'";
    const citasHoy = bd.prepare(`SELECT COUNT(*) AS n FROM citas WHERE fecha = ? AND ${activas}`).get(hoy).n;
    const citasSemana = bd.prepare(`SELECT COUNT(*) AS n FROM citas WHERE fecha BETWEEN ? AND ? AND ${activas}`).get(hoy, finSemana).n;

    // Ocupación de los próximos 7 días: citas activas frente a la capacidad real de cada día
    // (lo menor entre sus cupos diarios y las horas de su horario ese día de la semana)
    const horasPorDia = bd.prepare("SELECT COUNT(*) AS n FROM disponibilidad WHERE medico_id = ? AND dia_semana = ?");
    const usadasPorDia = bd.prepare(`SELECT COUNT(*) AS n FROM citas WHERE medico_id = ? AND fecha = ? AND ${activas}`);
    const ocupacion = bd.prepare(`
      SELECT m.id, m.nombre, m.cupos_diarios AS cupos, e.nombre AS especialidad
      FROM medicos m JOIN especialidades e ON e.id = m.especialidad_id ORDER BY m.nombre
    `).all().map((m) => {
      let capacidad = 0;
      let usadas = 0;
      semana.forEach((fecha) => {
        const horas = horasPorDia.get(m.id, new Date(fecha + "T00:00:00Z").getUTCDay()).n;
        capacidad += Math.min(m.cupos, horas);
        usadas += usadasPorDia.get(m.id, fecha).n;
      });
      return { id: m.id, medico: m.nombre, especialidad: m.especialidad, usadas, capacidad };
    }).filter((m) => m.capacidad > 0);

    const ordenes = { borrador: 0, emitida: 0, pagada: 0, anulada: 0 };
    bd.prepare("SELECT estado, COUNT(*) AS total FROM ordenes GROUP BY estado").all()
      .forEach((f) => { ordenes[f.estado] = f.total; });
    const montoPagado = bd.prepare("SELECT COALESCE(SUM(total), 0) AS s FROM ordenes WHERE estado = 'pagada'").get().s;
    const montoPorCobrar = bd.prepare("SELECT COALESCE(SUM(total), 0) AS s FROM ordenes WHERE estado = 'emitida'").get().s;

    // Lo que impide agendar o queda pendiente de otra persona
    const especialidadesSinMedicos = bd.prepare(`
      SELECT e.nombre FROM especialidades e
      WHERE NOT EXISTS (SELECT 1 FROM medicos m JOIN disponibilidad d ON d.medico_id = m.id WHERE m.especialidad_id = e.id)
      ORDER BY e.nombre
    `).all().map((f) => f.nombre);
    const medicosSinHorario = bd.prepare(`
      SELECT m.nombre FROM medicos m WHERE NOT EXISTS (SELECT 1 FROM disponibilidad d WHERE d.medico_id = m.id) ORDER BY m.nombre
    `).all().map((f) => f.nombre);

    res.json({
      hoy, finSemana, porEstado, citasHoy, citasSemana, ocupacion,
      ordenes, montoPagado, montoPorCobrar,
      avisos: { especialidadesSinMedicos, medicosSinHorario, pendientesPorConfirmar: porEstado.pendiente }
    });
  });

  app.get("/api/admin/catalogo", administracion, (req, res) => {
    const especialidades = bd.prepare("SELECT id, nombre, precio FROM especialidades ORDER BY nombre").all();
    const franjas = bd.prepare(
      "SELECT medico_id AS medicoId, dia_semana AS dia, hora FROM disponibilidad ORDER BY dia_semana, hora"
    ).all();
    const medicos = bd.prepare(
      "SELECT id, nombre, especialidad_id AS especialidadId, cupos_diarios AS cupos FROM medicos ORDER BY nombre"
    )
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
    // Las especialidades nuevas toman el valor de ejemplo por defecto para las órdenes de empresas
    bd.prepare("INSERT INTO especialidades (id, nombre, precio) VALUES (?, ?, ?)").run(id, nombre, PRECIO_EJEMPLO_POR_DEFECTO);
    res.status(201).json({ id, nombre, precio: PRECIO_EJEMPLO_POR_DEFECTO });
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
    res.status(201).json({ id, nombre, especialidadId, cupos: CUPOS_DIARIOS_POR_DEFECTO, disponibilidad: [] });
  });

  // Capacidad diaria: cuántos pacientes atiende el médico como máximo en un día
  app.put("/api/admin/medicos/:id/cupos", administracion, (req, res) => {
    const medicoId = texto(req.params.id);
    if (!bd.prepare("SELECT 1 FROM medicos WHERE id = ?").get(medicoId)) return error(res, 404, "El médico no existe.");
    const cupos = Number(req.body.cupos);
    if (!Number.isInteger(cupos) || cupos < 1 || cupos > 40) {
      return error(res, 400, "Revisa los datos.", { cupos: "La capacidad diaria debe ser un número entre 1 y 40." });
    }
    bd.prepare("UPDATE medicos SET cupos_diarios = ? WHERE id = ?").run(cupos, medicoId);
    res.json({ id: medicoId, cupos });
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
