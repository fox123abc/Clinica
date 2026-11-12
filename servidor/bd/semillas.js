/*
 * bd/semillas.js
 * Datos de demostración: catálogo (especialidades, médicos y horarios) y una
 * cuenta por rol. Solo para la demostración académica: un sistema real no
 * debe traer credenciales fijas.
 *
 * Se puede ejecutar en cada arranque: el catálogo se carga solo si la base
 * está vacía y cada cuenta solo si su correo todavía no existe.
 */

const { bd, enTransaccion } = require("./conexion");
const { PRECIOS_EJEMPLO } = require("./migraciones");
const { PRECIO_EJEMPLO_POR_DEFECTO } = require("./valores");
const { generarHash } = require("../seguridad");

// Los nombres son marcadores de posición (ver README: "Contenido pendiente de confirmar")
const CATALOGO = {
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

// Todas las cuentas de demostración usan esta contraseña
const CONTRASENA_DEMO = "Altavida2026";

const CUENTAS_DEMO = [
  { nombre: "Paciente Demo", correo: "paciente@altavida.com", telefono: "3001234567", rol: "paciente" },
  { nombre: "Recepción Demo", correo: "recepcion@altavida.com", telefono: "3001230001", rol: "recepcionista" },
  { nombre: "Administrador Demo", correo: "admin@altavida.com", telefono: "3001230003", rol: "administrador" },
  { nombre: "Médico Demo", correo: "medico@altavida.com", telefono: "3001230002", rol: "medico", medicoId: "medico-1" },
  { nombre: "Médico 2 Demo", correo: "medico2@altavida.com", telefono: "3001230004", rol: "medico", medicoId: "medico-2" },
  { nombre: "Médico 3 Demo", correo: "medico3@altavida.com", telefono: "3001230005", rol: "medico", medicoId: "medico-3" },
  { nombre: "Médico 4 Demo", correo: "medico4@altavida.com", telefono: "3001230006", rol: "medico", medicoId: "medico-4" },
  { nombre: "Médico 5 Demo", correo: "medico5@altavida.com", telefono: "3001230007", rol: "medico", medicoId: "medico-5" }
];

function cargarCatalogo() {
  if (bd.prepare("SELECT COUNT(*) AS total FROM especialidades").get().total > 0) return;

  const insEspecialidad = bd.prepare("INSERT INTO especialidades (id, nombre, precio) VALUES (?, ?, ?)");
  const insMedico = bd.prepare("INSERT INTO medicos (id, nombre, especialidad_id) VALUES (?, ?, ?)");
  const insFranja = bd.prepare("INSERT INTO disponibilidad (medico_id, dia_semana, hora) VALUES (?, ?, ?)");

  CATALOGO.especialidades.forEach((e) => insEspecialidad.run(e.id, e.nombre, PRECIOS_EJEMPLO[e.id] || PRECIO_EJEMPLO_POR_DEFECTO));
  CATALOGO.medicos.forEach((m) => {
    insMedico.run(m.id, m.nombre, m.especialidadId);
    m.dias.forEach((dia) => m.horas.forEach((hora) => insFranja.run(m.id, dia, hora)));
  });
  console.log("Catálogo de demostración cargado en la base de datos.");
}

function cargarCuentas() {
  const existe = bd.prepare("SELECT 1 FROM usuarios WHERE correo = ?");
  // Si el médico ya no existe o ya tiene otra cuenta, esa cuenta de demostración no se crea
  const medicoLibre = bd.prepare(
    "SELECT 1 FROM medicos m WHERE m.id = ? AND NOT EXISTS (SELECT 1 FROM usuarios u WHERE u.medico_id = m.id)"
  );
  const insertar = bd.prepare(
    "INSERT INTO usuarios (nombre, correo, telefono, contrasena_hash, rol, medico_id) VALUES (?, ?, ?, ?, ?, ?)"
  );
  CUENTAS_DEMO.forEach((c) => {
    if (existe.get(c.correo)) return;
    if (c.medicoId && !medicoLibre.get(c.medicoId)) return;
    insertar.run(c.nombre, c.correo, c.telefono, generarHash(CONTRASENA_DEMO), c.rol, c.medicoId || null);
    console.log(`Cuenta de demostración: ${c.correo} / ${CONTRASENA_DEMO}`);
  });
}

function sembrar() {
  enTransaccion(() => {
    cargarCatalogo();
    cargarCuentas();
  });
}

module.exports = { sembrar, CONTRASENA_DEMO };
