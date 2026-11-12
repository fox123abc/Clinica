-- =====================================================================
-- esquema.sql — modelo relacional de Clínica Altavida (SQLite)
--
-- Es la versión vigente y completa de la base. Una base nueva se crea
-- ejecutando este archivo; una base antigua primero se actualiza con
-- migraciones.js y luego este archivo agrega lo que falte (todo usa
-- IF NOT EXISTS, así que ejecutarlo de nuevo no cambia nada).
--
-- Convenciones:
--   * Tablas en plural y en español; columnas en snake_case.
--   * Claves foráneas terminadas en _id; SQLite las hace cumplir porque
--     la conexión activa PRAGMA foreign_keys = ON (ver conexion.js).
--   * Fechas "AAAA-MM-DD", horas "HH:MM" y marcas de tiempo en hora local.
--   * Precios en pesos colombianos, enteros (sin decimales).
--   * Los valores por defecto deben coincidir con valores.js.
-- =====================================================================


-- ---------------------------------------------------------------------
-- Catálogo clínico: qué se atiende, quién lo atiende y cuándo
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS especialidades (
  id          TEXT    PRIMARY KEY,
  nombre      TEXT    NOT NULL,
  descripcion TEXT,
  precio      INTEGER NOT NULL DEFAULT 80000 CHECK (precio >= 0)   -- valor por cita en órdenes de empresas
);

CREATE TABLE IF NOT EXISTS medicos (
  id              TEXT    PRIMARY KEY,
  nombre          TEXT    NOT NULL,
  especialidad_id TEXT    NOT NULL REFERENCES especialidades(id),
  cupos_diarios   INTEGER NOT NULL DEFAULT 4 CHECK (cupos_diarios BETWEEN 1 AND 40)  -- pacientes por día
);

CREATE INDEX IF NOT EXISTS ix_medicos_especialidad ON medicos (especialidad_id);

-- Franjas de atención: un registro por médico, día de la semana y hora
CREATE TABLE IF NOT EXISTS disponibilidad (
  medico_id   TEXT    NOT NULL REFERENCES medicos(id) ON DELETE CASCADE,
  dia_semana  INTEGER NOT NULL CHECK (dia_semana BETWEEN 0 AND 6),  -- 0 = domingo
  hora        TEXT    NOT NULL,                                     -- "HH:MM"
  PRIMARY KEY (medico_id, dia_semana, hora)
);


-- ---------------------------------------------------------------------
-- Identidad y acceso: cuentas, roles y sesiones
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS usuarios (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre          TEXT    NOT NULL,
  correo          TEXT    NOT NULL UNIQUE,
  telefono        TEXT    NOT NULL,
  contrasena_hash TEXT    NOT NULL,                                 -- scrypt "sal:hash", nunca texto plano
  rol             TEXT    NOT NULL DEFAULT 'paciente'
                  CHECK (rol IN ('paciente', 'recepcionista', 'medico', 'administrador')),
  medico_id       TEXT    REFERENCES medicos(id),                   -- solo en cuentas con rol "medico"
  creado_en       TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
  CHECK (medico_id IS NULL OR rol = 'medico')
);

-- Un médico tiene como máximo una cuenta de acceso
CREATE UNIQUE INDEX IF NOT EXISTS ux_usuarios_medico ON usuarios (medico_id) WHERE medico_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS sesiones (
  token      TEXT    PRIMARY KEY,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  expira_en  TEXT    NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_sesiones_usuario ON sesiones (usuario_id);


-- ---------------------------------------------------------------------
-- Órdenes de empresas: la empresa pide citas por especialidad y paga
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS empresas (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre    TEXT    NOT NULL,
  nit       TEXT    NOT NULL UNIQUE,
  contacto  TEXT    NOT NULL,
  correo    TEXT    NOT NULL,
  telefono  TEXT    NOT NULL,
  creada_en TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS ordenes (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  empresa_id  INTEGER NOT NULL REFERENCES empresas(id),
  estado      TEXT    NOT NULL DEFAULT 'borrador'
              CHECK (estado IN ('borrador', 'emitida', 'pagada', 'anulada')),
  total       INTEGER NOT NULL DEFAULT 0,                           -- suma de los renglones al emitir
  creada_por  INTEGER REFERENCES usuarios(id),
  creada_en   TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
  emitida_en  TEXT,
  pagada_en   TEXT
);

CREATE INDEX IF NOT EXISTS ix_ordenes_empresa ON ordenes (empresa_id);

-- Cada renglón: una especialidad, cuántas citas pide la empresa y a qué precio
CREATE TABLE IF NOT EXISTS orden_items (
  orden_id        INTEGER NOT NULL REFERENCES ordenes(id) ON DELETE CASCADE,
  especialidad_id TEXT    NOT NULL REFERENCES especialidades(id),
  cantidad        INTEGER NOT NULL CHECK (cantidad BETWEEN 1 AND 200),
  precio_unitario INTEGER NOT NULL DEFAULT 0,                       -- precio congelado al emitir
  PRIMARY KEY (orden_id, especialidad_id)
);


-- ---------------------------------------------------------------------
-- Agenda: las citas, de un paciente o de una orden de empresa
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS citas (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  paciente_id     INTEGER REFERENCES usuarios(id),                  -- cita pedida por un paciente…
  orden_id        INTEGER REFERENCES ordenes(id),                   -- …o asignada a una orden de empresa
  medico_id       TEXT    NOT NULL REFERENCES medicos(id),
  fecha           TEXT    NOT NULL,                                 -- "AAAA-MM-DD"
  horario         TEXT    NOT NULL,                                 -- "HH:MM"
  motivo          TEXT,
  estado          TEXT    NOT NULL DEFAULT 'pendiente'
                  CHECK (estado IN ('pendiente', 'confirmada', 'cancelada', 'atendida')),
  creada_en       TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
  actualizada_en  TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
  CHECK (paciente_id IS NOT NULL OR orden_id IS NOT NULL)
);

-- Un mismo horario de un médico no puede tener dos citas activas
CREATE UNIQUE INDEX IF NOT EXISTS ux_citas_horario_activo
  ON citas (medico_id, fecha, horario) WHERE estado <> 'cancelada';

CREATE INDEX IF NOT EXISTS ix_citas_paciente ON citas (paciente_id);
CREATE INDEX IF NOT EXISTS ix_citas_orden    ON citas (orden_id);
