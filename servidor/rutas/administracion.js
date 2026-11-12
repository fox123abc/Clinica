/*
 * rutas/administracion.js — contexto Catálogo Clínico (gestión) y panel
 * Especialidades, médicos, horarios, cupos diarios y cuentas de acceso de los
 * médicos; y el resumen del panel
 * de administración (solo lectura, reúne datos de todos los contextos).
 */

const crypto = require("node:crypto");
const { bd, enTransaccion, PRECIO_EJEMPLO_POR_DEFECTO, CUPOS_DIARIOS_POR_DEFECTO, CUPOS_DIARIOS_MAXIMOS } = require("../bd");
const { generarHash } = require("../seguridad");
const { requiereRol } = require("../sesion");
const { texto, error, esViolacionDeUnicidad } = require("../http");
const { esCorreo, esHora, esTelefono, esEnteroEntre } = require("../validaciones");
const { fechaHoy, sumarDias, diaSemana } = require("../agenda");

/*
 * Datos de la cuenta de acceso de un médico: { correo, telefono, contrasena }.
 * Devuelve { cuenta } con los datos limpios o { campos } con los errores.
 */
function validarCuenta(datos) {
  const correo = texto(datos && datos.correo).toLowerCase();
  const telefono = texto(datos && datos.telefono);
  const contrasena = datos && typeof datos.contrasena === "string" ? datos.contrasena : "";
  const campos = {};
  if (!esCorreo(correo)) campos.correo = "Ingresa un correo electrónico válido.";
  else if (bd.prepare("SELECT 1 FROM usuarios WHERE correo = ?").get(correo)) campos.correo = "Este correo ya está registrado.";
  if (!esTelefono(telefono)) campos.telefono = "Ingresa un teléfono válido (7 a 15 dígitos).";
  if (contrasena.length < 8) campos.contrasena = "La contraseña debe tener al menos 8 caracteres.";
  return Object.keys(campos).length ? { campos } : { cuenta: { correo, telefono, contrasena } };
}

// Crea la cuenta con rol "medico" enlazada al médico (usuarios.medico_id)
function crearCuentaDeMedico(medicoId, nombre, cuenta) {
  bd.prepare(
    "INSERT INTO usuarios (nombre, correo, telefono, contrasena_hash, rol, medico_id) VALUES (?, ?, ?, ?, 'medico', ?)"
  ).run(nombre, cuenta.correo, cuenta.telefono, generarHash(cuenta.contrasena), medicoId);
  return cuenta.correo;
}

// [{ dia, hora }] -> [{ dia, horas: [...] }]
function agruparFranjas(franjas) {
  const porDia = new Map();
  franjas.forEach((f) => {
    if (!porDia.has(f.dia)) porDia.set(f.dia, []);
    porDia.get(f.dia).push(f.hora);
  });
  return [...porDia.entries()].map(([dia, horas]) => ({ dia, horas }));
}

// Cuenta filas agrupadas por estado partiendo de todos los estados en 0
function contarPorEstado(sql, estados) {
  const conteo = Object.fromEntries(estados.map((e) => [e, 0]));
  bd.prepare(sql).all().forEach((f) => { conteo[f.estado] = f.total; });
  return conteo;
}

/* ------------------------- Panel: resumen ------------------------- */

function resumenDelPanel() {
  const hoy = fechaHoy();
  const semana = Array.from({ length: 7 }, (_, i) => sumarDias(hoy, i));
  const finSemana = semana.at(-1);
  const activas = "estado <> 'cancelada'";

  const porEstado = contarPorEstado("SELECT estado, COUNT(*) AS total FROM citas GROUP BY estado",
    ["pendiente", "confirmada", "atendida", "cancelada"]);
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
      capacidad += Math.min(m.cupos, horasPorDia.get(m.id, diaSemana(fecha)).n);
      usadas += usadasPorDia.get(m.id, fecha).n;
    });
    return { id: m.id, medico: m.nombre, especialidad: m.especialidad, usadas, capacidad };
  }).filter((m) => m.capacidad > 0);

  const ordenes = contarPorEstado("SELECT estado, COUNT(*) AS total FROM ordenes GROUP BY estado",
    ["borrador", "emitida", "pagada", "anulada"]);
  const sumaDe = (estado) => bd.prepare("SELECT COALESCE(SUM(total), 0) AS s FROM ordenes WHERE estado = ?").get(estado).s;

  // Lo que impide agendar o queda pendiente de otra persona
  const especialidadesSinMedicos = bd.prepare(`
    SELECT e.nombre FROM especialidades e
    WHERE NOT EXISTS (SELECT 1 FROM medicos m JOIN disponibilidad d ON d.medico_id = m.id WHERE m.especialidad_id = e.id)
    ORDER BY e.nombre
  `).all().map((f) => f.nombre);
  const medicosSinHorario = bd.prepare(`
    SELECT m.nombre FROM medicos m WHERE NOT EXISTS (SELECT 1 FROM disponibilidad d WHERE d.medico_id = m.id) ORDER BY m.nombre
  `).all().map((f) => f.nombre);

  return {
    hoy, finSemana, porEstado, citasHoy, citasSemana, ocupacion,
    ordenes, montoPagado: sumaDe("pagada"), montoPorCobrar: sumaDe("emitida"),
    avisos: { especialidadesSinMedicos, medicosSinHorario, pendientesPorConfirmar: porEstado.pendiente }
  };
}

/* ----------------------------- Rutas ------------------------------ */

function registrarRutasAdministracion(app) {
  const administracion = requiereRol("administrador");

  // Carga el médico de :id (404 si no existe)
  function cargarMedico(req, res, next) {
    req.medicoId = texto(req.params.id);
    if (!bd.prepare("SELECT 1 FROM medicos WHERE id = ?").get(req.medicoId)) return error(res, 404, "El médico no existe.");
    next();
  }

  app.get("/api/admin/resumen", administracion, (req, res) => res.json(resumenDelPanel()));

  app.get("/api/admin/catalogo", administracion, (req, res) => {
    const especialidades = bd.prepare("SELECT id, nombre, precio FROM especialidades ORDER BY nombre").all();
    const franjas = bd.prepare(
      "SELECT medico_id AS medicoId, dia_semana AS dia, hora FROM disponibilidad ORDER BY dia_semana, hora"
    ).all();
    // LEFT JOIN: los médicos sin cuenta de acceso también aparecen (cuenta = null)
    const medicos = bd.prepare(`
      SELECT m.id, m.nombre, m.especialidad_id AS especialidadId, m.cupos_diarios AS cupos, u.correo AS cuenta
      FROM medicos m LEFT JOIN usuarios u ON u.medico_id = m.id
      ORDER BY m.nombre
    `).all().map((m) => ({ ...m, disponibilidad: agruparFranjas(franjas.filter((f) => f.medicoId === m.id)) }));
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

    // La cuenta de acceso es opcional: se crea si llega un correo
    let cuenta = null;
    if (req.body.cuenta && texto(req.body.cuenta.correo)) {
      const validada = validarCuenta(req.body.cuenta);
      if (validada.campos) Object.assign(campos, validada.campos);
      cuenta = validada.cuenta;
    }
    if (Object.keys(campos).length) return error(res, 400, "Revisa los datos.", campos);

    const id = "med-" + crypto.randomBytes(4).toString("hex");
    // Médico y cuenta se guardan juntos: si falla uno, no queda ninguno
    const correo = enTransaccion(() => {
      bd.prepare("INSERT INTO medicos (id, nombre, especialidad_id) VALUES (?, ?, ?)").run(id, nombre, especialidadId);
      return cuenta ? crearCuentaDeMedico(id, nombre, cuenta) : null;
    });
    res.status(201).json({ id, nombre, especialidadId, cupos: CUPOS_DIARIOS_POR_DEFECTO, cuenta: correo, disponibilidad: [] });
  });

  // Cuenta de acceso para un médico que todavía no tiene una
  app.post("/api/admin/medicos/:id/cuenta", administracion, cargarMedico, (req, res) => {
    if (bd.prepare("SELECT 1 FROM usuarios WHERE medico_id = ?").get(req.medicoId)) {
      return error(res, 409, "Este médico ya tiene una cuenta de acceso.");
    }
    const validada = validarCuenta(req.body);
    if (validada.campos) return error(res, 400, "Revisa los datos.", validada.campos);
    const { nombre } = bd.prepare("SELECT nombre FROM medicos WHERE id = ?").get(req.medicoId);
    try {
      res.status(201).json({ id: req.medicoId, cuenta: crearCuentaDeMedico(req.medicoId, nombre, validada.cuenta) });
    } catch (e) {
      // Dos solicitudes a la vez: el índice único de la base rechaza la segunda
      if (esViolacionDeUnicidad(e)) return error(res, 409, "Ese correo o ese médico ya tienen una cuenta.");
      throw e;
    }
  });

  // Capacidad diaria: cuántos pacientes atiende el médico como máximo en un día
  app.put("/api/admin/medicos/:id/cupos", administracion, cargarMedico, (req, res) => {
    const cupos = Number(req.body.cupos);
    if (!esEnteroEntre(cupos, 1, CUPOS_DIARIOS_MAXIMOS)) {
      return error(res, 400, "Revisa los datos.", { cupos: `La capacidad diaria debe ser un número entre 1 y ${CUPOS_DIARIOS_MAXIMOS}.` });
    }
    bd.prepare("UPDATE medicos SET cupos_diarios = ? WHERE id = ?").run(cupos, req.medicoId);
    res.json({ id: req.medicoId, cupos });
  });

  // Reemplaza todas las franjas del médico. Las citas ya agendadas no se modifican.
  app.put("/api/admin/medicos/:id/disponibilidad", administracion, cargarMedico, (req, res) => {
    const franjas = req.body.franjas;
    if (!Array.isArray(franjas) || franjas.length > 7) return error(res, 400, "Franjas no válidas.");

    const dias = new Set();
    const filas = [];
    for (const franja of franjas) {
      const dia = Number(franja && franja.dia);
      const horas = franja && franja.horas;
      if (!esEnteroEntre(dia, 0, 6) || dias.has(dia) || !Array.isArray(horas) || horas.length > 24) {
        return error(res, 400, "Franjas no válidas.");
      }
      if (!horas.every(esHora)) return error(res, 400, "Hora no válida: use el formato HH:MM (por ejemplo 08:30).");
      dias.add(dia);
      horas.forEach((hora) => filas.push([dia, hora]));
    }

    enTransaccion(() => {
      bd.prepare("DELETE FROM disponibilidad WHERE medico_id = ?").run(req.medicoId);
      const insertar = bd.prepare("INSERT OR IGNORE INTO disponibilidad (medico_id, dia_semana, hora) VALUES (?, ?, ?)");
      filas.forEach(([dia, hora]) => insertar.run(req.medicoId, dia, hora));
    });

    const guardadas = bd.prepare(
      "SELECT dia_semana AS dia, hora FROM disponibilidad WHERE medico_id = ? ORDER BY dia_semana, hora"
    ).all(req.medicoId);
    res.json({ id: req.medicoId, disponibilidad: agruparFranjas(guardadas) });
  });
}

module.exports = { registrarRutasAdministracion };
