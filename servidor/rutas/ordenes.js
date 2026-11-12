/*
 * rutas/ordenes.js — contexto Órdenes de Empresas (recepción y administración)
 *   1. Una empresa pide citas: se arma una orden en "borrador" con
 *      especialidades y la cantidad de citas de cada una.
 *   2. Al rectificarla se "emite" la orden de pago: los precios quedan fijos.
 *   3. Al registrar el pago, el sistema asigna las citas (ver asignacion.js).
 * Ciclo de vida: borrador -> emitida -> pagada, o anulada (antes del pago);
 * una emitida puede reabrirse a borrador para corregirla.
 * Los precios son valores de ejemplo de la demostración académica.
 */

const { bd, enTransaccion } = require("../bd");
const { requiereRol } = require("../sesion");
const { texto, error, ErrorDeNegocio } = require("../http");
const { esCorreo, esNit, esTelefono, esEnteroEntre } = require("../validaciones");
const { asignarCitasDeOrden } = require("../asignacion");

const MAX_CANTIDAD = 200;
const MAX_RENGLONES = 50;

/* ------------------------------ Consultas ------------------------------ */

function obtenerEmpresa(id) {
  return bd.prepare("SELECT id, nombre, nit, contacto, correo, telefono FROM empresas WHERE id = ?").get(Number(id)) || null;
}

// La orden completa: empresa, renglones con subtotal y citas asignadas
function obtenerOrden(id) {
  const orden = bd.prepare(`
    SELECT id, estado, total, creada_en AS creadaEn, emitida_en AS emitidaEn, pagada_en AS pagadaEn,
           empresa_id AS empresaId
    FROM ordenes WHERE id = ?
  `).get(Number(id));
  if (!orden) return null;

  orden.empresa = obtenerEmpresa(orden.empresaId);
  // En borrador se cotiza con el precio vigente; al emitir, el precio queda fijo en el renglón
  orden.items = bd.prepare(`
    SELECT i.especialidad_id AS especialidadId, e.nombre AS especialidad, i.cantidad,
           CASE WHEN ? = 'borrador' THEN e.precio ELSE i.precio_unitario END AS precioUnitario
    FROM orden_items i JOIN especialidades e ON e.id = i.especialidad_id
    WHERE i.orden_id = ? ORDER BY e.nombre
  `).all(orden.estado, orden.id).map((i) => ({ ...i, subtotal: i.cantidad * i.precioUnitario }));
  if (orden.estado === "borrador") orden.total = orden.items.reduce((suma, i) => suma + i.subtotal, 0);

  orden.citas = bd.prepare(`
    SELECT c.id, c.fecha, c.horario, c.estado, m.nombre AS medico, e.nombre AS especialidad
    FROM citas c JOIN medicos m ON m.id = c.medico_id JOIN especialidades e ON e.id = m.especialidad_id
    WHERE c.orden_id = ? ORDER BY c.fecha, c.horario
  `).all(orden.id);
  return orden;
}

/* ---------------------------- Validaciones ----------------------------- */

// Datos de una empresa limpios + errores por campo
function validarEmpresa(cuerpo) {
  const datos = {
    nombre: texto(cuerpo.nombre),
    nit: texto(cuerpo.nit),
    contacto: texto(cuerpo.contacto),
    correo: texto(cuerpo.correo).toLowerCase(),
    telefono: texto(cuerpo.telefono)
  };
  const campos = {};
  if (datos.nombre.length < 3 || datos.nombre.length > 100) campos.nombre = "Escribe el nombre de la empresa (3 a 100 caracteres).";
  if (!esNit(datos.nit)) campos.nit = "Escribe un NIT válido (solo números, puntos y guion).";
  if (datos.contacto.length < 3 || datos.contacto.length > 80) campos.contacto = "Escribe el nombre de la persona de contacto.";
  if (!esCorreo(datos.correo)) campos.correo = "Ingresa un correo electrónico válido.";
  if (!esTelefono(datos.telefono)) campos.telefono = "Ingresa un teléfono válido (7 a 15 dígitos).";
  return { datos, campos };
}

// Renglones [{ especialidadId, cantidad }] válidos y agendables; lanza ErrorDeNegocio si no
function validarRenglones(items) {
  if (!Array.isArray(items) || items.length > MAX_RENGLONES) throw new ErrorDeNegocio(400, "Renglones no válidos.");
  const existe = bd.prepare("SELECT 1 FROM especialidades WHERE id = ?");
  // Sin médicos con horario no habría cupos para asignar estas citas al pagar
  const agendable = bd.prepare(`
    SELECT 1 FROM medicos m JOIN disponibilidad d ON d.medico_id = m.id WHERE m.especialidad_id = ? LIMIT 1
  `);
  const vistos = new Set();
  return items.map((item) => {
    const especialidadId = texto(item && item.especialidadId);
    const cantidad = Number(item && item.cantidad);
    if (!existe.get(especialidadId) || vistos.has(especialidadId)) {
      throw new ErrorDeNegocio(400, "Hay una especialidad no válida o repetida en la orden.");
    }
    if (!esEnteroEntre(cantidad, 1, MAX_CANTIDAD)) {
      throw new ErrorDeNegocio(400, `La cantidad de citas debe ser un número entre 1 y ${MAX_CANTIDAD}.`);
    }
    if (!agendable.get(especialidadId)) {
      throw new ErrorDeNegocio(400, "Esa especialidad aún no tiene médicos con horarios de atención; no se pueden agendar citas en ella.");
    }
    vistos.add(especialidadId);
    return { especialidadId, cantidad };
  });
}

/* ----------------------------- Middlewares ----------------------------- */

// Carga la orden de :id en req.orden (404 si no existe)
function cargarOrden(req, res, next) {
  req.orden = obtenerOrden(req.params.id);
  if (!req.orden) return error(res, 404, "La orden no existe.");
  next();
}

// Regla del ciclo de vida: la acción solo vale en ciertos estados (409 si no)
function exigirEstado(orden, permitidos, mensaje) {
  if (!permitidos.includes(orden.estado)) throw new ErrorDeNegocio(409, mensaje);
}

/* -------------------------------- Rutas -------------------------------- */

function registrarRutasOrdenes(app) {
  const personal = requiereRol("recepcionista", "administrador");
  const conOrden = [personal, cargarOrden];

  /* Empresas clientes */

  app.get("/api/empresas", personal, (req, res) => {
    res.json(bd.prepare(`
      SELECT e.id, e.nombre, e.nit, e.contacto, e.correo, e.telefono, e.creada_en AS creadaEn,
             (SELECT COUNT(*) FROM ordenes o WHERE o.empresa_id = e.id AND o.estado <> 'anulada') AS ordenes
      FROM empresas e ORDER BY e.nombre
    `).all());
  });

  app.post("/api/empresas", personal, (req, res) => {
    const { datos, campos } = validarEmpresa(req.body);
    if (Object.keys(campos).length) return error(res, 400, "Revisa los datos de la empresa.", campos);
    if (bd.prepare("SELECT 1 FROM empresas WHERE nit = ?").get(datos.nit)) {
      return error(res, 409, "Ya existe una empresa con ese NIT.", { nit: "Ya existe una empresa con ese NIT." });
    }
    const r = bd.prepare("INSERT INTO empresas (nombre, nit, contacto, correo, telefono) VALUES (?, ?, ?, ?, ?)")
      .run(datos.nombre, datos.nit, datos.contacto, datos.correo, datos.telefono);
    res.status(201).json(obtenerEmpresa(r.lastInsertRowid));
  });

  // Corregir los datos de una empresa (las órdenes muestran siempre los datos actuales)
  app.put("/api/empresas/:id", personal, (req, res) => {
    const empresa = obtenerEmpresa(req.params.id);
    if (!empresa) return error(res, 404, "La empresa no existe.");
    const { datos, campos } = validarEmpresa(req.body);
    if (Object.keys(campos).length) return error(res, 400, "Revisa los datos de la empresa.", campos);
    if (bd.prepare("SELECT 1 FROM empresas WHERE nit = ? AND id <> ?").get(datos.nit, empresa.id)) {
      return error(res, 409, "Ya existe otra empresa con ese NIT.", { nit: "Ya existe otra empresa con ese NIT." });
    }
    bd.prepare("UPDATE empresas SET nombre = ?, nit = ?, contacto = ?, correo = ?, telefono = ? WHERE id = ?")
      .run(datos.nombre, datos.nit, datos.contacto, datos.correo, datos.telefono, empresa.id);
    res.json(obtenerEmpresa(empresa.id));
  });

  /* Órdenes */

  app.get("/api/ordenes", personal, (req, res) => {
    res.json(bd.prepare(`
      SELECT o.id, o.estado, o.creada_en AS creadaEn, emp.nombre AS empresa, emp.nit,
             (SELECT COALESCE(SUM(cantidad), 0) FROM orden_items WHERE orden_id = o.id) AS citasPedidas,
             CASE WHEN o.estado = 'borrador'
                  THEN (SELECT COALESCE(SUM(i.cantidad * e.precio), 0) FROM orden_items i
                        JOIN especialidades e ON e.id = i.especialidad_id WHERE i.orden_id = o.id)
                  ELSE o.total END AS total
      FROM ordenes o JOIN empresas emp ON emp.id = o.empresa_id
      ORDER BY o.id DESC
    `).all());
  });

  app.get("/api/ordenes/:id", conOrden, (req, res) => res.json(req.orden));

  app.post("/api/ordenes", personal, (req, res) => {
    const empresa = obtenerEmpresa(req.body.empresaId);
    if (!empresa) return error(res, 400, "Selecciona una empresa.", { empresaId: "Selecciona una empresa." });
    const r = bd.prepare("INSERT INTO ordenes (empresa_id, creada_por) VALUES (?, ?)").run(empresa.id, req.usuario.id);
    res.status(201).json(obtenerOrden(r.lastInsertRowid));
  });

  // Reemplaza los renglones de una orden en borrador
  app.put("/api/ordenes/:id/items", conOrden, (req, res) => {
    exigirEstado(req.orden, ["borrador"], "Solo se pueden modificar órdenes en borrador.");
    const renglones = validarRenglones(req.body.items);
    enTransaccion(() => {
      bd.prepare("DELETE FROM orden_items WHERE orden_id = ?").run(req.orden.id);
      const insertar = bd.prepare("INSERT INTO orden_items (orden_id, especialidad_id, cantidad) VALUES (?, ?, ?)");
      renglones.forEach((r) => insertar.run(req.orden.id, r.especialidadId, r.cantidad));
    });
    res.json(obtenerOrden(req.orden.id));
  });

  // Corregir la empresa de una orden en borrador (por si se eligió la equivocada)
  app.put("/api/ordenes/:id/empresa", conOrden, (req, res) => {
    exigirEstado(req.orden, ["borrador"], "Solo se puede cambiar la empresa de una orden en borrador.");
    const empresa = obtenerEmpresa(req.body.empresaId);
    if (!empresa) return error(res, 400, "Selecciona una empresa.", { empresaId: "Selecciona una empresa." });
    bd.prepare("UPDATE ordenes SET empresa_id = ? WHERE id = ?").run(empresa.id, req.orden.id);
    res.json(obtenerOrden(req.orden.id));
  });

  // Rectificada la orden: los precios y el total quedan fijos y se emite la orden de pago
  app.patch("/api/ordenes/:id/emitir", conOrden, (req, res) => {
    const orden = req.orden;
    exigirEstado(orden, ["borrador"], "Esta orden ya fue emitida.");
    if (!orden.items.length) throw new ErrorDeNegocio(400, "Agrega al menos una especialidad antes de emitir la orden de pago.");
    enTransaccion(() => {
      const fijar = bd.prepare("UPDATE orden_items SET precio_unitario = ? WHERE orden_id = ? AND especialidad_id = ?");
      orden.items.forEach((i) => fijar.run(i.precioUnitario, orden.id, i.especialidadId));
      bd.prepare("UPDATE ordenes SET estado = 'emitida', total = ?, emitida_en = datetime('now', 'localtime') WHERE id = ?")
        .run(orden.total, orden.id);
    });
    res.json(obtenerOrden(orden.id));
  });

  // Editar una orden emitida: vuelve a borrador; la orden de pago anterior deja de valer.
  // Una orden pagada no se reabre: sus citas ya están en las agendas de los médicos.
  app.patch("/api/ordenes/:id/reabrir", conOrden, (req, res) => {
    exigirEstado(req.orden, ["emitida"], req.orden.estado === "pagada"
      ? "Una orden pagada no se puede editar: sus citas ya están asignadas. Cancela en recepción las citas que sobren."
      : "Solo se pueden reabrir órdenes emitidas.");
    enTransaccion(() => {
      bd.prepare("UPDATE orden_items SET precio_unitario = 0 WHERE orden_id = ?").run(req.orden.id);
      bd.prepare("UPDATE ordenes SET estado = 'borrador', total = 0, emitida_en = NULL WHERE id = ?").run(req.orden.id);
    });
    res.json(obtenerOrden(req.orden.id));
  });

  // La empresa pagó: todas las citas se asignan o ninguna (una sola transacción)
  app.patch("/api/ordenes/:id/pagar", conOrden, (req, res) => {
    exigirEstado(req.orden, ["emitida"], "Solo se puede registrar el pago de una orden emitida.");
    enTransaccion(() => {
      asignarCitasDeOrden(req.orden);
      bd.prepare("UPDATE ordenes SET estado = 'pagada', pagada_en = datetime('now', 'localtime') WHERE id = ?").run(req.orden.id);
    });
    res.json(obtenerOrden(req.orden.id));
  });

  // Anular: solo antes del pago (después, las citas se cancelan una por una en recepción)
  app.patch("/api/ordenes/:id/anular", conOrden, (req, res) => {
    exigirEstado(req.orden, ["borrador", "emitida"], "Solo se pueden anular órdenes que aún no se han pagado.");
    bd.prepare("UPDATE ordenes SET estado = 'anulada' WHERE id = ?").run(req.orden.id);
    res.json(obtenerOrden(req.orden.id));
  });
}

module.exports = { registrarRutasOrdenes };
