/*
 * bd/migraciones.js
 * Lleva cualquier base a la versión de esquema.sql.
 *
 * La versión se guarda en la propia base (PRAGMA user_version):
 *   * Base nueva (sin tablas): se ejecuta esquema.sql y queda en la última versión.
 *   * Base antigua: se aplican en orden las migraciones pendientes y después
 *     esquema.sql, que crea las tablas e índices que todavía no existan.
 * Todo ocurre en una transacción: si algo falla, la base queda como estaba.
 *
 * Las bases creadas antes de este archivo tienen user_version = 0, por eso
 * cada migración revisa primero si su cambio ya está hecho.
 */

const fs = require("node:fs");
const path = require("node:path");
const { bd, enTransaccion, columnas } = require("./conexion");
const { PRECIO_EJEMPLO_POR_DEFECTO, CUPOS_DIARIOS_POR_DEFECTO } = require("./valores");

const ESQUEMA = fs.readFileSync(path.join(__dirname, "esquema.sql"), "utf8");

// Precios de ejemplo de las especialidades de demostración
const PRECIOS_EJEMPLO = {
  "especialidad-1": 60000,
  "especialidad-2": 85000,
  "especialidad-3": 95000,
  "especialidad-4": 120000
};

const MIGRACIONES = [
  {
    version: 1,
    descripcion: "Roles del personal: usuarios.medico_id enlaza la cuenta con su médico",
    aplicar() {
      if (!columnas("usuarios").includes("medico_id")) {
        bd.exec("ALTER TABLE usuarios ADD COLUMN medico_id TEXT REFERENCES medicos(id)");
      }
    }
  },
  {
    version: 2,
    descripcion: "Órdenes de empresas: precio por especialidad, cupos diarios y citas de órdenes",
    aplicar() {
      if (!columnas("especialidades").includes("precio")) {
        bd.exec("ALTER TABLE especialidades ADD COLUMN precio INTEGER");
      }
      const fijarPrecio = bd.prepare("UPDATE especialidades SET precio = ? WHERE id = ?");
      bd.prepare("SELECT id FROM especialidades WHERE precio IS NULL").all()
        .forEach((e) => fijarPrecio.run(PRECIOS_EJEMPLO[e.id] || PRECIO_EJEMPLO_POR_DEFECTO, e.id));

      if (!columnas("medicos").includes("cupos_diarios")) {
        bd.exec(`ALTER TABLE medicos ADD COLUMN cupos_diarios INTEGER NOT NULL DEFAULT ${CUPOS_DIARIOS_POR_DEFECTO}`);
      }

      // citas.paciente_id pasa a ser opcional y se agrega citas.orden_id. SQLite no
      // permite cambiar una columna, así que la tabla se reconstruye conservando los datos.
      if (!columnas("citas").includes("orden_id")) {
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
        `);
      }
    }
  },
  {
    version: 3,
    descripcion: "Índices de claves foráneas y una sola cuenta por médico",
    // Los índices los crea esquema.sql; aquí solo se revisa que los datos los cumplan
    aplicar() {
      const repetidos = bd.prepare(
        "SELECT medico_id FROM usuarios WHERE medico_id IS NOT NULL GROUP BY medico_id HAVING COUNT(*) > 1"
      ).all();
      if (repetidos.length) {
        throw new Error("Hay médicos con más de una cuenta: " + repetidos.map((r) => r.medico_id).join(", "));
      }
    }
  }
];

const VERSION_ACTUAL = MIGRACIONES.at(-1).version;

function migrar() {
  const version = bd.prepare("PRAGMA user_version").get().user_version;
  if (version >= VERSION_ACTUAL) return;

  const esBaseNueva = columnas("usuarios").length === 0;
  enTransaccion(() => {
    if (!esBaseNueva) {
      MIGRACIONES.filter((m) => m.version > version).forEach((m) => {
        m.aplicar();
        console.log(`Base de datos: migración ${m.version} aplicada (${m.descripcion}).`);
      });
    }
    bd.exec(ESQUEMA);
    bd.exec(`PRAGMA user_version = ${VERSION_ACTUAL}`);
  });

  // Toda base, nueva o migrada, debe terminar sin referencias rotas
  const rotas = bd.prepare("PRAGMA foreign_key_check").all();
  if (rotas.length) {
    throw new Error("La base tiene referencias rotas: " + JSON.stringify(rotas));
  }
}

module.exports = { migrar, VERSION_ACTUAL, PRECIOS_EJEMPLO };
