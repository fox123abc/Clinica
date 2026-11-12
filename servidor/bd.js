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
const { generarHash } = require("./seguridad");

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

// Solo para demostración académica: no usar credenciales fijas en un sistema real
const USUARIO_DEMO = {
  nombre: "Paciente Demo",
  correo: "paciente@altavida.com",
  telefono: "3001234567",
  contrasena: "Altavida2026"
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

  // Paciente de demostración, para que cualquier copia del proyecto
  // (local o Docker) tenga el mismo usuario para probar
  bd.prepare("INSERT INTO usuarios (nombre, correo, telefono, contrasena_hash) VALUES (?, ?, ?, ?)")
    .run(USUARIO_DEMO.nombre, USUARIO_DEMO.correo, USUARIO_DEMO.telefono, generarHash(USUARIO_DEMO.contrasena));
  console.log("Usuario de demostración: " + USUARIO_DEMO.correo + " / " + USUARIO_DEMO.contrasena);
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

// Usuarios de demostración del personal (misma contraseña que el paciente de prueba)
const PERSONAL_DEMO = [
  { nombre: "Recepción Demo", correo: "recepcion@altavida.com", telefono: "3001230001", rol: "recepcionista", medicoId: null },
  { nombre: "Médico Demo", correo: "medico@altavida.com", telefono: "3001230002", rol: "medico", medicoId: "medico-1" },
  { nombre: "Administrador Demo", correo: "admin@altavida.com", telefono: "3001230003", rol: "administrador", medicoId: null }
];

// Agrega usuarios.medico_id si falta (bases creadas antes de los roles) y carga el personal de demostración
function prepararPersonal() {
  const columnas = bd.prepare("PRAGMA table_info(usuarios)").all().map((c) => c.name);
  if (!columnas.includes("medico_id")) {
    bd.exec("ALTER TABLE usuarios ADD COLUMN medico_id TEXT REFERENCES medicos(id)");
  }
  const existe = bd.prepare("SELECT 1 FROM usuarios WHERE correo = ?");
  const hayMedico = bd.prepare("SELECT 1 FROM medicos WHERE id = ?");
  const insertar = bd.prepare(
    "INSERT INTO usuarios (nombre, correo, telefono, contrasena_hash, rol, medico_id) VALUES (?, ?, ?, ?, ?, ?)"
  );
  PERSONAL_DEMO.forEach((p) => {
    if (existe.get(p.correo)) return;
    const medicoId = p.medicoId && hayMedico.get(p.medicoId) ? p.medicoId : null;
    insertar.run(p.nombre, p.correo, p.telefono, generarHash(USUARIO_DEMO.contrasena), p.rol, medicoId);
  });
}

/* ------------------------------------------------------------------
 * Órdenes de empresas
 * Una empresa pide citas por especialidad; recepción o administración
 * arma la orden, emite la orden de pago y, al registrar el pago, el
 * sistema asigna las citas según la capacidad diaria de cada médico.
 * ------------------------------------------------------------------ */

// Valores de ejemplo (COP) para la demostración académica; no son tarifas reales
const PRECIOS_EJEMPLO = {
  "especialidad-1": 60000,
  "especialidad-2": 85000,
  "especialidad-3": 95000,
  "especialidad-4": 120000
};
const PRECIO_EJEMPLO_POR_DEFECTO = 80000;
const CUPOS_DIARIOS_POR_DEFECTO = 4;

function columnas(tabla) {
  return bd.prepare(`PRAGMA table_info(${tabla})`).all().map((c) => c.name);
}

function prepararOrdenes() {
  bd.exec(`
    CREATE TABLE IF NOT EXISTS empresas (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre    TEXT NOT NULL,
      nit       TEXT NOT NULL UNIQUE,
      contacto  TEXT NOT NULL,
      correo    TEXT NOT NULL,
      telefono  TEXT NOT NULL,
      creada_en TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS ordenes (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      empresa_id  INTEGER NOT NULL REFERENCES empresas(id),
      estado      TEXT    NOT NULL DEFAULT 'borrador'
                  CHECK (estado IN ('borrador', 'emitida', 'pagada', 'anulada')),
      total       INTEGER NOT NULL DEFAULT 0,
      creada_por  INTEGER REFERENCES usuarios(id),
      creada_en   TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
      emitida_en  TEXT,
      pagada_en   TEXT
    );

    -- Cada renglón: una especialidad y cuántas citas pide la empresa
    CREATE TABLE IF NOT EXISTS orden_items (
      orden_id        INTEGER NOT NULL REFERENCES ordenes(id) ON DELETE CASCADE,
      especialidad_id TEXT    NOT NULL REFERENCES especialidades(id),
      cantidad        INTEGER NOT NULL CHECK (cantidad BETWEEN 1 AND 200),
      precio_unitario INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (orden_id, especialidad_id)
    );
  `);

  // Precio de ejemplo por especialidad
  if (!columnas("especialidades").includes("precio")) {
    bd.exec("ALTER TABLE especialidades ADD COLUMN precio INTEGER");
  }
  const sinPrecio = bd.prepare("SELECT id FROM especialidades WHERE precio IS NULL").all();
  const fijarPrecio = bd.prepare("UPDATE especialidades SET precio = ? WHERE id = ?");
  sinPrecio.forEach((e) => fijarPrecio.run(PRECIOS_EJEMPLO[e.id] || PRECIO_EJEMPLO_POR_DEFECTO, e.id));

  // Capacidad diaria de cada médico (pacientes por día)
  if (!columnas("medicos").includes("cupos_diarios")) {
    bd.exec(`ALTER TABLE medicos ADD COLUMN cupos_diarios INTEGER NOT NULL DEFAULT ${CUPOS_DIARIOS_POR_DEFECTO}`);
  }

  // Las citas de una orden no tienen paciente registrado: citas.paciente_id pasa a ser
  // opcional y se agrega citas.orden_id. SQLite no permite cambiar una columna,
  // así que la tabla se reconstruye una sola vez conservando todos los datos.
  if (!columnas("citas").includes("orden_id")) {
    enTransaccion(() => {
      bd.exec(`
        CREATE TABLE citas_nueva (
          id              INTEGER PRIMARY KEY AUTOINCREMENT,
          paciente_id     INTEGER REFERENCES usuarios(id),
          orden_id        INTEGER REFERENCES ordenes(id),
          medico_id       TEXT    NOT NULL REFERENCES medicos(id),
          fecha           TEXT    NOT NULL,
          horario         TEXT    NOT NULL,
          motivo          TEXT,
          estado          TEXT    NOT NULL DEFAULT 'pendiente'
                          CHECK (estado IN ('pendiente', 'confirmada', 'cancelada', 'atendida')),
          creada_en       TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
          actualizada_en  TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
          CHECK (paciente_id IS NOT NULL OR orden_id IS NOT NULL)
        );
        INSERT INTO citas_nueva (id, paciente_id, medico_id, fecha, horario, motivo, estado, creada_en, actualizada_en)
          SELECT id, paciente_id, medico_id, fecha, horario, motivo, estado, creada_en, actualizada_en FROM citas;
        DROP TABLE citas;
        ALTER TABLE citas_nueva RENAME TO citas;
        CREATE UNIQUE INDEX ux_citas_horario_activo ON citas (medico_id, fecha, horario) WHERE estado <> 'cancelada';
        CREATE INDEX ix_citas_paciente ON citas (paciente_id);
        CREATE INDEX ix_citas_orden ON citas (orden_id);
      `);
    });
  }
}

cargarCatalogoInicial();
prepararPersonal();
prepararOrdenes();

module.exports = { bd, enTransaccion, RUTA_BD, PRECIO_EJEMPLO_POR_DEFECTO, CUPOS_DIARIOS_POR_DEFECTO };
