/*
 * api.test.js — pruebas de las reglas del negocio a través de la API
 * Ejecutar con: npm test
 * Cada ejecución usa una base de datos temporal nueva (no toca la real).
 */

const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

// La base temporal debe definirse ANTES de cargar el servidor (servidor/bd la lee al iniciar)
const RUTA_BD = path.join(os.tmpdir(), `altavida-test-${process.pid}-${Date.now()}.db`);
process.env.RUTA_BD = RUTA_BD;
const { app } = require("../servidor/servidor");
const { bd } = require("../servidor/bd");

const CONTRASENA = "Altavida2026";
let servidor;
let base;

before(async () => {
  servidor = app.listen(0);
  await new Promise((listo) => servidor.once("listening", listo));
  base = `http://localhost:${servidor.address().port}/api`;
});

after(async () => {
  await new Promise((listo) => servidor.close(listo));
  // En Windows un archivo abierto no se puede borrar: primero se cierra la base
  bd.close();
  ["", "-wal", "-shm"].forEach((s) => fs.rmSync(RUTA_BD + s, { force: true }));
});

/* ------------------------------ Ayudas ------------------------------ */

// Cliente con su propia cookie de sesión
function cliente() {
  let cookie = "";
  async function pedir(metodo, ruta, cuerpo) {
    const respuesta = await fetch(base + ruta, {
      method: metodo,
      headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo)
    });
    const nueva = respuesta.headers.get("set-cookie");
    if (nueva) cookie = nueva.split(";")[0];
    const datos = respuesta.status === 204 ? null : await respuesta.json();
    return { estado: respuesta.status, datos };
  }
  return {
    get: (ruta) => pedir("GET", ruta),
    post: (ruta, cuerpo) => pedir("POST", ruta, cuerpo),
    put: (ruta, cuerpo) => pedir("PUT", ruta, cuerpo),
    patch: (ruta, cuerpo) => pedir("PATCH", ruta, cuerpo)
  };
}

async function ingresar(rol) {
  const c = cliente();
  const r = await c.post("/login", { correo: `${rol}@altavida.com`, contrasena: CONTRASENA });
  assert.equal(r.estado, 200, `no pudo ingresar ${rol}`);
  return c;
}

// Próxima fecha (desde mañana) en que el médico atiende, "AAAA-MM-DD"
async function proximoDiaDeAtencion(medicoId) {
  const { datos } = await cliente().get("/catalogo");
  const dias = datos.medicos.find((m) => m.id === medicoId).dias;
  const fecha = new Date();
  for (let i = 1; i <= 14; i++) {
    fecha.setDate(fecha.getDate() + 1);
    if (dias.includes(fecha.getDay())) {
      fecha.setMinutes(fecha.getMinutes() - fecha.getTimezoneOffset());
      return fecha.toISOString().slice(0, 10);
    }
  }
  throw new Error("El médico no atiende en las próximas dos semanas");
}

/* ------------------------------ Acceso ------------------------------ */

test("sin sesión no se accede a rutas privadas (401)", async () => {
  const r = await cliente().get("/citas");
  assert.equal(r.estado, 401);
});

test("cada rol solo entra a su área (403)", async () => {
  const recepcion = await ingresar("recepcion");
  assert.equal((await recepcion.get("/admin/resumen")).estado, 403);
  const paciente = await ingresar("paciente");
  assert.equal((await paciente.get("/ordenes")).estado, 403);
  assert.equal((await paciente.get("/recepcion/citas")).estado, 403);
});

test("el registro público siempre crea pacientes", async () => {
  const c = cliente();
  const r = await c.post("/registro", {
    nombre: "Prueba Rol", correo: "rol@prueba.co", telefono: "3001112233", contrasena: "clave-segura", rol: "administrador"
  });
  assert.equal(r.estado, 201);
  const sesion = await c.post("/login", { correo: "rol@prueba.co", contrasena: "clave-segura" });
  assert.equal(sesion.datos.rol, "paciente");
});

/* ----------------------------- Agendamiento ----------------------------- */

test("una hora no se puede reservar dos veces y cancelar la libera", async () => {
  const paciente = await ingresar("paciente");
  const fecha = await proximoDiaDeAtencion("medico-2");
  const cita = { especialidadId: "especialidad-1", medicoId: "medico-2", fecha, horario: "14:00" };

  const primera = await paciente.post("/citas", cita);
  assert.equal(primera.estado, 201);
  assert.equal(primera.datos.estado, "pendiente");

  const repetida = await paciente.post("/citas", cita);
  assert.equal(repetida.estado, 400);
  assert.ok(repetida.datos.campos.horario);

  await paciente.patch(`/citas/${primera.datos.id}/cancelar`);
  const libres = await paciente.get(`/horarios-disponibles?medicoId=medico-2&fecha=${fecha}`);
  assert.ok(libres.datos.includes("14:00"), "cancelar debe liberar la hora");
});

test("la agenda pública no expone datos de pacientes", async () => {
  const fecha = await proximoDiaDeAtencion("medico-1");
  const r = await cliente().get(`/agenda-publica?medicoId=medico-1&fecha=${fecha}`);
  assert.equal(r.estado, 200);
  for (const hora of r.datos) assert.deepEqual(Object.keys(hora).sort(), ["hora", "libre"]);
});

test("un médico no recibe más citas que sus cupos diarios", async () => {
  const admin = await ingresar("admin");
  assert.equal((await admin.put("/admin/medicos/medico-5/cupos", { cupos: 1 })).estado, 200);

  const paciente = await ingresar("paciente");
  const fecha = await proximoDiaDeAtencion("medico-5");
  const r = await paciente.post("/citas", { especialidadId: "especialidad-4", medicoId: "medico-5", fecha, horario: "09:00" });
  assert.equal(r.estado, 201);

  const libres = await paciente.get(`/horarios-disponibles?medicoId=medico-5&fecha=${fecha}`);
  assert.deepEqual(libres.datos, [], "con el cupo lleno no debe quedar ninguna hora libre");

  await admin.put("/admin/medicos/medico-5/cupos", { cupos: 4 });
});

/* --------------------------- Órdenes de empresas --------------------------- */

async function ordenEmitida(recepcion, empresaId, items) {
  const orden = await recepcion.post("/ordenes", { empresaId });
  assert.equal(orden.estado, 201);
  assert.equal((await recepcion.put(`/ordenes/${orden.datos.id}/items`, { items })).estado, 200);
  const emitida = await recepcion.patch(`/ordenes/${orden.datos.id}/emitir`);
  assert.equal(emitida.datos.estado, "emitida");
  return emitida.datos;
}

test("ciclo completo de una orden: cotizar, emitir, pagar y asignar por cupos", async () => {
  const recepcion = await ingresar("recepcion");
  const empresa = await recepcion.post("/empresas", {
    nombre: "Empresa Prueba", nit: "900111222-3", contacto: "Ana Paz", correo: "ana@prueba.co", telefono: "3001112233"
  });
  assert.equal(empresa.estado, 201);

  const duplicada = await recepcion.post("/empresas", { ...empresa.datos, nombre: "Otra" });
  assert.equal(duplicada.estado, 409, "el NIT debe ser único");

  const orden = await ordenEmitida(recepcion, empresa.datos.id, [{ especialidadId: "especialidad-2", cantidad: 5 }]);
  assert.equal(orden.total, 5 * 85000);

  const pagada = await recepcion.patch(`/ordenes/${orden.id}/pagar`);
  assert.equal(pagada.estado, 200);
  assert.equal(pagada.datos.estado, "pagada");
  assert.equal(pagada.datos.citas.length, 5);
  assert.ok(pagada.datos.citas.every((c) => c.estado === "confirmada"));

  // Ningún día supera los cupos (4 por defecto) del médico
  const porDia = {};
  pagada.datos.citas.forEach((c) => { porDia[c.fecha + c.medico] = (porDia[c.fecha + c.medico] || 0) + 1; });
  assert.ok(Object.values(porDia).every((n) => n <= 4));

  // Una orden pagada no se reabre ni se anula
  assert.equal((await recepcion.patch(`/ordenes/${orden.id}/reabrir`)).estado, 409);
  assert.equal((await recepcion.patch(`/ordenes/${orden.id}/anular`)).estado, 409);
});

test("editar una orden emitida la devuelve a borrador", async () => {
  const recepcion = await ingresar("recepcion");
  const empresas = (await recepcion.get("/empresas")).datos;
  const orden = await ordenEmitida(recepcion, empresas[0].id, [{ especialidadId: "especialidad-3", cantidad: 1 }]);

  const reabierta = await recepcion.patch(`/ordenes/${orden.id}/reabrir`);
  assert.equal(reabierta.datos.estado, "borrador");
  const corregida = await recepcion.put(`/ordenes/${orden.id}/items`, { items: [{ especialidadId: "especialidad-3", cantidad: 2 }] });
  assert.equal(corregida.datos.total, 2 * 95000);
});

test("si no alcanzan los cupos no se asigna ninguna cita (todo o nada)", async () => {
  const recepcion = await ingresar("recepcion");
  const empresas = (await recepcion.get("/empresas")).datos;
  // [Médico 4] atiende 2 días por semana con 3 horas: 200 citas no caben en 120 días
  const orden = await ordenEmitida(recepcion, empresas[0].id, [{ especialidadId: "especialidad-3", cantidad: 200 }]);

  const pago = await recepcion.patch(`/ordenes/${orden.id}/pagar`);
  assert.equal(pago.estado, 409);
  assert.match(pago.datos.error, /No hay cupos suficientes/);

  const despues = await recepcion.get(`/ordenes/${orden.id}`);
  assert.equal(despues.datos.estado, "emitida");
  assert.equal(despues.datos.citas.length, 0);
});

test("no se puede pedir una especialidad sin médicos con horario", async () => {
  const admin = await ingresar("admin");
  const nueva = await admin.post("/admin/especialidades", { nombre: "Especialidad sin médicos" });
  const recepcion = await ingresar("recepcion");
  const empresas = (await recepcion.get("/empresas")).datos;
  const orden = await recepcion.post("/ordenes", { empresaId: empresas[0].id });
  const r = await recepcion.put(`/ordenes/${orden.datos.id}/items`, { items: [{ especialidadId: nueva.datos.id, cantidad: 1 }] });
  assert.equal(r.estado, 400);
});

/* ------------------------------ Panel ------------------------------ */

test("el panel resume citas, órdenes y avisos", async () => {
  const admin = await ingresar("admin");
  const r = await admin.get("/admin/resumen");
  assert.equal(r.estado, 200);
  assert.ok(r.datos.montoPagado >= 5 * 85000);
  assert.ok(r.datos.avisos.especialidadesSinMedicos.includes("Especialidad sin médicos"));
});

/* ------------------------- Base de datos ------------------------- */

test("la base queda en la última versión y sin referencias rotas", () => {
  const { VERSION_ACTUAL } = require("../servidor/bd/migraciones");
  assert.equal(bd.prepare("PRAGMA user_version").get().user_version, VERSION_ACTUAL);
  assert.equal(bd.prepare("PRAGMA foreign_keys").get().foreign_keys, 1);
  assert.deepEqual(bd.prepare("PRAGMA foreign_key_check").all(), []);
  // Las restricciones del esquema rechazan datos que no cumplen el modelo
  assert.throws(() => bd.prepare("INSERT INTO medicos (id, nombre, especialidad_id) VALUES ('x', 'X', 'no-existe')").run(), /FOREIGN KEY/);
  assert.throws(() => bd.prepare("UPDATE usuarios SET medico_id = 'medico-2' WHERE correo = 'paciente@altavida.com'").run(), /CHECK/);
});

test("cada médico de demostración tiene su cuenta y ve solo su agenda", async () => {
  const medicos = bd.prepare("SELECT medico_id FROM usuarios WHERE rol = 'medico' ORDER BY medico_id").all().map((u) => u.medico_id);
  assert.deepEqual(medicos, ["medico-1", "medico-2", "medico-3", "medico-4", "medico-5"]);
  const r = await (await ingresar("medico2")).get("/medico/agenda");
  assert.equal(r.estado, 200);
});

test("el administrador crea un médico con su cuenta de acceso", async () => {
  const admin = await ingresar("admin");
  const cuenta = { correo: "nuevo.medico@altavida.com", telefono: "3009998877", contrasena: "Segura2026" };

  // Datos de cuenta inválidos: no se crea ni el médico ni la cuenta
  const malo = await admin.post("/admin/medicos", { nombre: "Médico Nuevo", especialidadId: "especialidad-2", cuenta: { ...cuenta, contrasena: "corta" } });
  assert.equal(malo.estado, 400);
  assert.ok(malo.datos.campos.contrasena);

  const creado = await admin.post("/admin/medicos", { nombre: "Médico Nuevo", especialidadId: "especialidad-2", cuenta });
  assert.equal(creado.estado, 201);
  assert.equal(creado.datos.cuenta, cuenta.correo);
  assert.equal(bd.prepare("SELECT COUNT(*) AS n FROM medicos WHERE nombre = 'Médico Nuevo'").get().n, 1);

  // Puede ingresar y llega con rol médico
  const login = await cliente().post("/login", { correo: cuenta.correo, contrasena: cuenta.contrasena });
  assert.equal(login.datos.rol, "medico");

  // Un médico tiene una sola cuenta
  const otra = await admin.post(`/admin/medicos/${creado.datos.id}/cuenta`, { ...cuenta, correo: "otra@altavida.com" });
  assert.equal(otra.estado, 409);
});

test("un médico sin cuenta puede recibirla después", async () => {
  const admin = await ingresar("admin");
  const creado = await admin.post("/admin/medicos", { nombre: "Médico Sin Cuenta", especialidadId: "especialidad-3" });
  assert.equal(creado.datos.cuenta, null);

  const catalogo = await admin.get("/admin/catalogo");
  assert.equal(catalogo.datos.medicos.find((m) => m.id === creado.datos.id).cuenta, null);

  const repetido = await admin.post(`/admin/medicos/${creado.datos.id}/cuenta`, { correo: "medico@altavida.com", telefono: "3001112233", contrasena: "Segura2026" });
  assert.equal(repetido.estado, 400);
  assert.ok(repetido.datos.campos.correo);

  const r = await admin.post(`/admin/medicos/${creado.datos.id}/cuenta`, { correo: "sincuenta@altavida.com", telefono: "3001112233", contrasena: "Segura2026" });
  assert.equal(r.estado, 201);
  assert.equal(r.datos.cuenta, "sincuenta@altavida.com");
});
