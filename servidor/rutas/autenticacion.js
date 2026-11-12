/*
 * rutas/autenticacion.js — contexto Identidad y Acceso
 * Registro de pacientes, inicio y cierre de sesión, y datos de la sesión.
 */

const { bd } = require("../bd");
const { generarHash, verificarContrasena } = require("../seguridad");
const { crearSesion, cerrarSesion, requiereSesion } = require("../sesion");
const { texto, error } = require("../http");
const { esCorreo, esTelefono } = require("../validaciones");

function registrarRutasAutenticacion(app) {
  // El registro público solo crea pacientes: el rol nunca se acepta desde el cliente
  app.post("/api/registro", (req, res) => {
    const nombre = texto(req.body.nombre);
    const correo = texto(req.body.correo).toLowerCase();
    const telefono = texto(req.body.telefono);
    const contrasena = typeof req.body.contrasena === "string" ? req.body.contrasena : "";

    const campos = {};
    if (nombre.length < 3) campos.nombre = "Ingresa tu nombre completo.";
    if (!esCorreo(correo)) campos.correo = "Ingresa un correo electrónico válido.";
    if (!esTelefono(telefono)) campos.telefono = "Ingresa un teléfono válido (7 a 15 dígitos).";
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
    cerrarSesion(req, res);
    res.status(204).end();
  });

  app.get("/api/sesion", requiereSesion, (req, res) => {
    res.json(req.usuario);
  });
}

module.exports = { registrarRutasAutenticacion };
