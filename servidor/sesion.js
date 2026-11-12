/*
 * sesion.js
 * Sesiones con cookie httpOnly y middlewares de acceso por rol.
 */

const crypto = require("node:crypto");
const { bd } = require("./bd");
const { error } = require("./http");

const COOKIE_SESION = "altavida_sesion";
const DURACION_SESION_HORAS = 8;

function leerCookie(req, nombre) {
  const cookies = req.headers.cookie || "";
  const par = cookies.split(";").map((c) => c.trim()).find((c) => c.startsWith(nombre + "="));
  return par ? decodeURIComponent(par.slice(nombre.length + 1)) : null;
}

// Crea la sesión en la base de datos y envía su token en una cookie que el JavaScript del navegador no puede leer
function crearSesion(res, usuarioId) {
  const token = crypto.randomBytes(32).toString("hex");
  const expira = new Date(Date.now() + DURACION_SESION_HORAS * 3600 * 1000);
  bd.prepare("INSERT INTO sesiones (token, usuario_id, expira_en) VALUES (?, ?, ?)")
    .run(token, usuarioId, expira.toISOString());
  res.cookie(COOKIE_SESION, token, { httpOnly: true, sameSite: "lax", expires: expira, path: "/" });
}

function cerrarSesion(req, res) {
  const token = leerCookie(req, COOKIE_SESION);
  if (token) bd.prepare("DELETE FROM sesiones WHERE token = ?").run(token);
  res.clearCookie(COOKIE_SESION, { path: "/" });
}

function usuarioDeSesion(req) {
  const token = leerCookie(req, COOKIE_SESION);
  if (!token) return null;
  return bd.prepare(`
    SELECT u.id, u.nombre, u.correo, u.rol, u.medico_id AS medicoId
    FROM sesiones s JOIN usuarios u ON u.id = s.usuario_id
    WHERE s.token = ? AND s.expira_en > ?
  `).get(token, new Date().toISOString()) || null;
}

// Middleware: exige una sesión activa y deja el usuario en req.usuario
function requiereSesion(req, res, next) {
  const usuario = usuarioDeSesion(req);
  if (!usuario) return error(res, 401, "Debes iniciar sesión.");
  req.usuario = usuario;
  next();
}

// Middleware: exige una sesión activa con alguno de los roles indicados (403 si no)
function requiereRol(...roles) {
  return [
    requiereSesion,
    (req, res, next) => (roles.includes(req.usuario.rol) ? next() : error(res, 403, "No tienes permiso para esta acción."))
  ];
}

module.exports = { crearSesion, cerrarSesion, requiereSesion, requiereRol };
