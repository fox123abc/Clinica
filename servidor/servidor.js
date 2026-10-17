/*
 * servidor.js
 * Servidor local de Clínica Altavida (Express + SQLite).
 *   - Sirve los archivos del sitio (HTML, CSS, JS).
 *   - Expone una API REST en /api que usan las páginas hechas con Vue.js.
 *
 * Iniciar con:  npm start   →   http://localhost:3000
 */

const path = require("node:path");
const crypto = require("node:crypto");
const express = require("express");
const { bd, RUTA_BD } = require("./bd");
const { generarHash, verificarContrasena } = require("./seguridad");

const PUERTO = process.env.PUERTO || 3000;
const RAIZ_SITIO = path.join(__dirname, "..");
const COOKIE_SESION = "altavida_sesion";
const DURACION_SESION_HORAS = 8;
const ESTADOS_MODIFICABLES = ["pendiente", "confirmada"];

const app = express();
app.use(express.json({ limit: "20kb" }));

/* ==================================================================
 * Utilidades
 * ================================================================== */

function leerCookie(req, nombre) {
  const cookies = req.headers.cookie || "";
  const par = cookies.split(";").map((c) => c.trim()).find((c) => c.startsWith(nombre + "="));
  return par ? decodeURIComponent(par.slice(nombre.length + 1)) : null;
}

function fechaHoy() {
  const hoy = new Date();
  hoy.setMinutes(hoy.getMinutes() - hoy.getTimezoneOffset());
  return hoy.toISOString().slice(0, 10);
}

function horaActual() {
  const ahora = new Date();
  return String(ahora.getHours()).padStart(2, "0") + ":" + String(ahora.getMinutes()).padStart(2, "0");
}

function diaSemana(fechaISO) {
  return new Date(fechaISO + "T00:00:00Z").getUTCDay();
}

function esFechaValida(texto) {
  return /^\d{4}-\d{2}-\d{2}$/.test(texto) && !isNaN(new Date(texto + "T00:00:00Z"));
}

function texto(valor) {
  return typeof valor === "string" ? valor.trim() : "";
}

// Responde con un error en formato JSON; "campos" permite marcar errores por campo
function error(res, estado, mensaje, campos) {
  return res.status(estado).json({ error: mensaje, campos: campos || {} });
}

/* ==================================================================
 * Sesión
 * ================================================================== */

function crearSesion(res, usuarioId) {
  const token = crypto.randomBytes(32).toString("hex");
  const expira = new Date(Date.now() + DURACION_SESION_HORAS * 3600 * 1000);
  bd.prepare("INSERT INTO sesiones (token, usuario_id, expira_en) VALUES (?, ?, ?)")
    .run(token, usuarioId, expira.toISOString());
  res.cookie(COOKIE_SESION, token, { httpOnly: true, sameSite: "lax", expires: expira, path: "/" });
}

function usuarioDeSesion(req) {
  const token = leerCookie(req, COOKIE_SESION);
  if (!token) return null;
  return bd.prepare(`
    SELECT u.id, u.nombre, u.correo, u.rol
    FROM sesiones s JOIN usuarios u ON u.id = s.usuario_id
    WHERE s.token = ? AND s.expira_en > ?
  `).get(token, new Date().toISOString()) || null;
}

// Middleware: exige una sesión activa
function requiereSesion(req, res, next) {
  const usuario = usuarioDeSesion(req);
  if (!usuario) return error(res, 401, "Debes iniciar sesión.");
  req.usuario = usuario;
  next();
}

/* ==================================================================
 * Autenticación
 * ================================================================== */

app.post("/api/registro", (req, res) => {
  const nombre = texto(req.body.nombre);
  const correo = texto(req.body.correo).toLowerCase();
  const telefono = texto(req.body.telefono);
  const contrasena = typeof req.body.contrasena === "string" ? req.body.contrasena : "";

  const campos = {};
  if (nombre.length < 3) campos.nombre = "Ingresa tu nombre completo.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(correo)) campos.correo = "Ingresa un correo electrónico válido.";
  const digitos = telefono.replace(/\D/g, "").length;
  if (digitos < 7 || digitos > 15) campos.telefono = "Ingresa un teléfono válido (7 a 15 dígitos).";
  if (contrasena.length < 8) campos.contrasena = "La contraseña debe tener al menos 8 caracteres.";
  if (Object.keys(campos).length) return error(res, 400, "Revisa los datos del formulario.", campos);

  if (bd.prepare("SELECT 1 FROM usuarios WHERE correo = ?").get(correo)) {
    return error(res, 409, "Ya existe una cuenta registrada con este correo.", { correo: "Este correo ya está registrado." });
  }

  const resultado = bd.prepare(
    "INSERT INTO usuarios (nombre, correo, telefono, contrasena_hash) VALUES (?, ?, ?, ?)"
  ).run(nombre, correo, telefono, generarHash(contrasena));

  res.status(201).json({ id: Number(resultado.lastInsertRowid), nombre, correo });
});

app.post("/api/login", (req, res) => {
  const correo = texto(req.body.correo).toLowerCase();
  const contrasena = typeof req.body.contrasena === "string" ? req.body.contrasena : "";

  const usuario = bd.prepare("SELECT id, nombre, correo, rol, contrasena_hash FROM usuarios WHERE correo = ?").get(correo);
  if (!usuario || !verificarContrasena(contrasena, usuario.contrasena_hash)) {
    return error(res, 401, "Correo o contraseña incorrectos.");
  }

  crearSesion(res, usuario.id);
  res.json({ id: usuario.id, nombre: usuario.nombre, correo: usuario.correo, rol: usuario.rol });
});

app.post("/api/logout", (req, res) => {
  const token = leerCookie(req, COOKIE_SESION);
  if (token) bd.prepare("DELETE FROM sesiones WHERE token = ?").run(token);
  res.clearCookie(COOKIE_SESION, { path: "/" });
  res.status(204).end();
});

app.get("/api/sesion", requiereSesion, (req, res) => {
  res.json(req.usuario);
});

/* ==================================================================
 * Catálogo (especialidades y médicos)
 * ================================================================== */

app.get("/api/catalogo", (req, res) => {
  const especialidades = bd.prepare("SELECT id, nombre FROM especialidades ORDER BY nombre").all();
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

/* ==================================================================
 * Horarios disponibles
 * ================================================================== */

// Horas libres de un médico en una fecha (descarta las ocupadas y, si es hoy, las ya pasadas)
function horariosLibres(medicoId, fecha, excluirCitaId) {
  const horas = bd.prepare(
    "SELECT hora FROM disponibilidad WHERE medico_id = ? AND dia_semana = ? ORDER BY hora"
  ).all(medicoId, diaSemana(fecha)).map((f) => f.hora);

  const ocupadas = new Set(bd.prepare(`
    SELECT horario FROM citas
    WHERE medico_id = ? AND fecha = ? AND estado <> 'cancelada' AND id <> ?
  `).all(medicoId, fecha, excluirCitaId || 0).map((f) => f.horario));

  const esHoy = fecha === fechaHoy();
  const ahora = horaActual();
  return horas.filter((h) => !ocupadas.has(h) && (!esHoy || h > ahora));
}

app.get("/api/horarios-disponibles", requiereSesion, (req, res) => {
  const medicoId = texto(req.query.medicoId);
  const fecha = texto(req.query.fecha);
  if (!medicoId || !esFechaValida(fecha)) return error(res, 400, "Médico y fecha son obligatorios.");
  if (fecha < fechaHoy()) return res.json([]);
  res.json(horariosLibres(medicoId, fecha, Number(req.query.excluir) || 0));
});

/* ==================================================================
 * Citas
 * ================================================================== */

const CONSULTA_CITA = `
  SELECT c.id, c.fecha, c.horario, c.motivo, c.estado, c.creada_en AS creadaEn,
         c.paciente_id AS pacienteId,
         m.id AS medicoId, m.nombre AS medico,
         e.id AS especialidadId, e.nombre AS especialidad
  FROM citas c
  JOIN medicos m ON m.id = c.medico_id
  JOIN especialidades e ON e.id = m.especialidad_id
`;

function obtenerCitaDelPaciente(id, pacienteId) {
  return bd.prepare(CONSULTA_CITA + " WHERE c.id = ? AND c.paciente_id = ?").get(Number(id), pacienteId) || null;
}

// Valida especialidad, médico, fecha y horario; devuelve { campos } con errores o { medico }
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
  else if (!campos.medicoId && !campos.fecha && horariosLibres(medicoId, fecha, excluirCitaId).indexOf(horario) === -1) {
    campos.horario = "El horario seleccionado ya no está disponible. Elige otro.";
  }

  const motivo = texto(cuerpo.motivo).slice(0, 300);
  return { campos, datos: { medicoId, fecha, horario, motivo } };
}

function esConflictoDeHorario(e) {
  return /UNIQUE constraint failed/i.test(e.message);
}

app.get("/api/citas", requiereSesion, (req, res) => {
  const citas = bd.prepare(CONSULTA_CITA + " WHERE c.paciente_id = ? ORDER BY c.fecha, c.horario").all(req.usuario.id);
  res.json(citas);
});

app.get("/api/citas/:id", requiereSesion, (req, res) => {
  const cita = obtenerCitaDelPaciente(req.params.id, req.usuario.id);
  if (!cita) return error(res, 404, "La cita no existe o no pertenece a tu cuenta.");
  res.json(cita);
});

app.post("/api/citas", requiereSesion, (req, res) => {
  const { campos, datos } = validarDatosCita(req.body, 0);
  if (Object.keys(campos).length) return error(res, 400, "Revisa los datos de la cita.", campos);

  try {
    const resultado = bd.prepare(
      "INSERT INTO citas (paciente_id, medico_id, fecha, horario, motivo) VALUES (?, ?, ?, ?, ?)"
    ).run(req.usuario.id, datos.medicoId, datos.fecha, datos.horario, datos.motivo || null);
    res.status(201).json(obtenerCitaDelPaciente(resultado.lastInsertRowid, req.usuario.id));
  } catch (e) {
    if (esConflictoDeHorario(e)) return error(res, 409, "Otro paciente acaba de tomar ese horario. Elige otro.", { horario: "Horario no disponible." });
    throw e;
  }
});

// Reprogramar: cambia médico/fecha/horario y la cita vuelve a quedar pendiente
app.put("/api/citas/:id", requiereSesion, (req, res) => {
  const cita = obtenerCitaDelPaciente(req.params.id, req.usuario.id);
  if (!cita) return error(res, 404, "La cita no existe o no pertenece a tu cuenta.");
  if (ESTADOS_MODIFICABLES.indexOf(cita.estado) === -1) return error(res, 409, "Esta cita ya no se puede reprogramar.");

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
    if (esConflictoDeHorario(e)) return error(res, 409, "Otro paciente acaba de tomar ese horario. Elige otro.", { horario: "Horario no disponible." });
    throw e;
  }
});

app.patch("/api/citas/:id/cancelar", requiereSesion, (req, res) => {
  const cita = obtenerCitaDelPaciente(req.params.id, req.usuario.id);
  if (!cita) return error(res, 404, "La cita no existe o no pertenece a tu cuenta.");
  if (ESTADOS_MODIFICABLES.indexOf(cita.estado) === -1) return error(res, 409, "Esta cita ya no se puede cancelar.");

  bd.prepare("UPDATE citas SET estado = 'cancelada', actualizada_en = datetime('now', 'localtime') WHERE id = ?").run(cita.id);
  res.json(obtenerCitaDelPaciente(cita.id, req.usuario.id));
});

app.use("/api", (req, res) => error(res, 404, "Ruta de la API no encontrada."));

/* ==================================================================
 * Archivos del sitio
 * Se bloquean las carpetas y archivos internos para que nunca se
 * descarguen por el navegador (código del servidor, base de datos, etc.).
 * ================================================================== */

const RUTAS_PRIVADAS = /^\/(servidor|node_modules)(\/|$)|^\/(package(-lock)?\.json|Dockerfile)$|\.md$/i;

app.use((req, res, next) => {
  if (RUTAS_PRIVADAS.test(decodeURIComponent(req.path))) return res.status(404).send("No encontrado");
  next();
});
app.use(express.static(RAIZ_SITIO, { extensions: ["html"] }));

// Errores no controlados: respuesta genérica sin exponer detalles internos
app.use((err, req, res, next) => {
  if (err.type === "entity.parse.failed") return error(res, 400, "El cuerpo de la petición no es JSON válido.");
  console.error(err);
  error(res, 500, "Ocurrió un error inesperado en el servidor.");
});

app.listen(PUERTO, () => {
  console.log("Clínica Altavida en http://localhost:" + PUERTO);
  console.log("Base de datos: " + RUTA_BD);
});
