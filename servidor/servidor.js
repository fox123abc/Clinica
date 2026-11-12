/*
 * servidor.js — punto de entrada de Clínica Altavida (Express + SQLite)
 * Arma la aplicación: registra las rutas de cada contexto (servidor/rutas/),
 * sirve los archivos del sitio y responde los errores con un formato único.
 *
 * Iniciar con:  npm start   →   http://localhost:3000
 * Las pruebas (npm test) importan { app } sin abrir el puerto.
 */

const path = require("node:path");
const express = require("express");
const { RUTA_BD } = require("./bd");
const { error, ErrorDeNegocio } = require("./http");

const { registrarRutasAutenticacion } = require("./rutas/autenticacion");
const { registrarRutasCatalogo } = require("./rutas/catalogo");
const { registrarRutasCitas } = require("./rutas/citas");
const { registrarRutasPersonal } = require("./rutas/personal");
const { registrarRutasAdministracion } = require("./rutas/administracion");
const { registrarRutasOrdenes } = require("./rutas/ordenes");

const PUERTO = process.env.PUERTO || 3000;
const RAIZ_SITIO = path.join(__dirname, "..");

const app = express();
app.use(express.json({ limit: "20kb" }));

/* ==================================================================
 * API: una función por contexto (ver docs/DDD-EVENT-STORMING.md)
 * ================================================================== */

registrarRutasAutenticacion(app);   // Identidad y Acceso
registrarRutasCatalogo(app);        // Catálogo (lectura pública) y agenda pública
registrarRutasCitas(app);           // Agendamiento: el paciente y sus citas
registrarRutasPersonal(app);        // Agendamiento (recepción) y Atención Médica
registrarRutasAdministracion(app);  // Catálogo (gestión), cupos y panel
registrarRutasOrdenes(app);         // Órdenes de Empresas

app.use("/api", (req, res) => error(res, 404, "Ruta de la API no encontrada."));

/* ==================================================================
 * Archivos del sitio
 * Solo se publican index.html y las carpetas html/ y assets/ (lista blanca).
 * Cualquier otra ruta (código del servidor, base de datos, configuración)
 * responde 404, también con variantes como "/./", "//" o "%2e".
 * ================================================================== */

const RUTA_MARKDOWN = /\.md$/i;

app.use((req, res, next) => {
  let ruta;
  try {
    ruta = decodeURIComponent(req.path);
  } catch {
    return res.status(400).send("Ruta no válida");
  }
  if (RUTA_MARKDOWN.test(ruta)) return res.status(404).send("No encontrado");
  next();
});

app.get(["/", "/index.html"], (req, res) => res.sendFile("index.html", { root: RAIZ_SITIO }));
app.use("/html", express.static(path.join(RAIZ_SITIO, "html"), { extensions: ["html"] }));
app.use("/assets", express.static(path.join(RAIZ_SITIO, "assets")));
app.use((req, res) => res.status(404).send("No encontrado"));

/* ==================================================================
 * Errores
 * Una regla de negocio incumplida (ErrorDeNegocio) responde su estado y
 * mensaje; cualquier otro error responde 500 sin exponer detalles internos.
 * ================================================================== */

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err instanceof ErrorDeNegocio) return error(res, err.estado, err.message, err.campos);
  if (err.type === "entity.parse.failed") return error(res, 400, "El cuerpo de la petición no es JSON válido.");
  console.error(err);
  error(res, 500, "Ocurrió un error inesperado en el servidor.");
});

/* ==================================================================
 * Arranque (solo cuando se ejecuta directamente: npm start)
 * ================================================================== */

if (require.main === module) {
  app.listen(PUERTO, () => {
    console.log("Clínica Altavida en http://localhost:" + PUERTO);
    console.log("Base de datos: " + RUTA_BD);
  }).on("error", (err) => {
    if (err.code !== "EADDRINUSE") throw err;
    console.log("El puerto " + PUERTO + " ya está en uso: probablemente el servidor ya está corriendo.");
    console.log("Abre http://localhost:" + PUERTO + " en el navegador.");
    process.exit(1);
  });
}

module.exports = { app };
