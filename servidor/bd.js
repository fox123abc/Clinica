/*
 * bd.js
 * Conexión a la base de datos local SQLite (archivo servidor/datos/altavida.db).
 * Usa el módulo integrado de Node.js "node:sqlite", por lo que no requiere
 * instalar ningún motor de base de datos aparte.
 *
 * Al iniciar crea las tablas si no existen y carga el catálogo de
 * demostración (especialidades, médicos y disponibilidad) la primera vez.
 */

const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");

const CARPETA_DATOS = path.join(__dirname, "datos");
const RUTA_BD = process.env.RUTA_BD || path.join(CARPETA_DATOS, "altavida.db");

fs.mkdirSync(path.dirname(RUTA_BD), { recursive: true });

const bd = new DatabaseSync(RUTA_BD);

bd.exec(`
  PRAGMA foreign_keys = ON;
  PRAGMA journal_mode = WAL;

  CREATE TABLE IF NOT EXISTS especialidades (
    id          TEXT PRIMARY KEY,
    nombre      TEXT NOT NULL,
    descripcion TEXT
  );

  CREATE TABLE IF NOT EXISTS medicos (
    id              TEXT PRIMARY KEY,
    nombre          TEXT NOT NULL,
    especialidad_id TEXT NOT NULL REFERENCES especialidades(id)
  );

  -- Franjas de atención: un registro por médico, día de la semana y hora
  CREATE TABLE IF NOT EXISTS disponibilidad (
    medico_id   TEXT    NOT NULL REFERENCES medicos(id),
    dia_semana  INTEGER NOT NULL CHECK (dia_semana BETWEEN 0 AND 6), -- 0 = domingo
    hora        TEXT    NOT NULL,                                    -- "HH:MM"
    PRIMARY KEY (medico_id, dia_semana, hora)
  );

  CREATE TABLE IF NOT EXISTS usuarios (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre          TEXT NOT NULL,
    correo          TEXT NOT NULL UNIQUE,
    telefono        TEXT NOT NULL,
    contrasena_hash TEXT NOT NULL,
    rol             TEXT NOT NULL DEFAULT 'paciente'
                    CHECK (rol IN ('paciente', 'recepcionista', 'medico', 'administrador')),
    creado_en       TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
  );

  CREATE TABLE IF NOT EXISTS sesiones (
    token      TEXT PRIMARY KEY,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    expira_en  TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS citas (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    paciente_id     INTEGER NOT NULL REFERENCES usuarios(id),
    medico_id       TEXT    NOT NULL REFERENCES medicos(id),
    fecha           TEXT    NOT NULL,  -- "AAAA-MM-DD"
    horario         TEXT    NOT NULL,  -- "HH:MM"
    motivo          TEXT,
    estado          TEXT    NOT NULL DEFAULT 'pendiente'
                    CHECK (estado IN ('pendiente', 'confirmada', 'cancelada', 'atendida')),
    creada_en       TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
    actualizada_en  TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
  );

  -- Un mismo horario de un médico no puede tener dos citas activas
  CREATE UNIQUE INDEX IF NOT EXISTS ux_citas_horario_activo
    ON citas (medico_id, fecha, horario) WHERE estado <> 'cancelada';

  CREATE INDEX IF NOT EXISTS ix_citas_paciente ON citas (paciente_id);
`);

/* ------------------------------------------------------------------
 * Catálogo de demostración (los nombres siguen siendo marcadores de
 * posición, ver README: "Contenido pendiente de confirmar").
 * ------------------------------------------------------------------ */
const CATALOGO_INICIAL = {
  especialidades: [
    { id: "especialidad-1", nombre: "[Especialidad 1]" },
    { id: "especialidad-2", nombre: "[Especialidad 2]" },
    { id: "especialidad-3", nombre: "[Especialidad 3]" },
    { id: "especialidad-4", nombre: "[Especialidad 4]" }
  ],
  medicos: [
    { id: "medico-1", nombre: "[Médico 1]", especialidadId: "especialidad-1", dias: [1, 3, 5], horas: ["08:00", "08:30", "09:00", "09:30", "10:00"] },
    { id: "medico-2", nombre: "[Médico 2]", especialidadId: "especialidad-1", dias: [2, 4], horas: ["14:00", "14:30", "15:00", "15:30"] },
    { id: "medico-3", nombre: "[Médico 3]", especialidadId: "especialidad-2", dias: [1, 2, 3, 4, 5], horas: ["07:00", "07:30", "08:00"] },
    { id: "medico-4", nombre: "[Médico 4]", especialidadId: "especialidad-3", dias: [1, 4], horas: ["10:00", "11:00", "12:00"] },
    { id: "medico-5", nombre: "[Médico 5]", especialidadId: "especialidad-4", dias: [3, 5, 6], horas: ["09:00", "09:30", "10:00", "10:30"] }
  ]
};

function cargarCatalogoInicial() {
  const { total } = bd.prepare("SELECT COUNT(*) AS total FROM especialidades").get();
  if (total > 0) return;

  const insEspecialidad = bd.prepare("INSERT INTO especialidades (id, nombre) VALUES (?, ?)");
  const insMedico = bd.prepare("INSERT INTO medicos (id, nombre, especialidad_id) VALUES (?, ?, ?)");
  const insDisponibilidad = bd.prepare("INSERT INTO disponibilidad (medico_id, dia_semana, hora) VALUES (?, ?, ?)");

  enTransaccion(() => {
    CATALOGO_INICIAL.especialidades.forEach((e) => insEspecialidad.run(e.id, e.nombre));
    CATALOGO_INICIAL.medicos.forEach((m) => {
      insMedico.run(m.id, m.nombre, m.especialidadId);
      m.dias.forEach((dia) => m.horas.forEach((hora) => insDisponibilidad.run(m.id, dia, hora)));
    });
  });
  console.log("Catálogo de demostración cargado en la base de datos.");
}

// node:sqlite no trae un helper de transacciones, así que se hace a mano
function enTransaccion(fn) {
  bd.exec("BEGIN");
  try {
    const resultado = fn();
    bd.exec("COMMIT");
    return resultado;
  } catch (error) {
    bd.exec("ROLLBACK");
    throw error;
  }
}

cargarCatalogoInicial();

module.exports = { bd, enTransaccion, RUTA_BD };
