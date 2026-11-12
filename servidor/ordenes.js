/*
 * ordenes.js
 * Órdenes de empresas (recepción y administración):
 *   1. Una empresa pide citas: se arma una orden en "borrador" agregando
 *      especialidades y la cantidad de citas de cada una.
 *   2. Al rectificarla se "emite" la orden de pago: los precios quedan fijos
 *      y se calcula el total que se envía a la empresa.
 *   3. Al registrar el pago, el sistema asigna las citas: reparte entre los
 *      médicos de cada especialidad, respeta su horario y su capacidad diaria
 *      (cupos_diarios) y, si un día se llena, sigue con el siguiente.
 * Los precios son valores de ejemplo de la demostración académica.
 */

const DIAS_MAXIMOS_DE_BUSQUEDA = 120;
const MAX_CANTIDAD = 200;

function registrarRutasOrdenes(app, { bd, enTransaccion, requiereRol, error, texto, fechaHoy, horariosLibres }) {
  const personal = requiereRol("recepcionista", "administrador");

  /* ----------------------------- Consultas ----------------------------- */

  function obtenerEmpresa(id) {
    return bd.prepare("SELECT id, nombre, nit, contacto, correo, telefono FROM empresas WHERE id = ?").get(Number(id)) || null;
  }

  function obtenerOrden(id) {
    const orden = bd.prepare(`
      SELECT o.id, o.estado, o.total, o.creada_en AS creadaEn, o.emitida_en AS emitidaEn, o.pagada_en AS pagadaEn,
             o.empresa_id AS empresaId
      FROM ordenes o WHERE o.id = ?
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
    if (orden.estado === "borrador") orden.total = orden.items.reduce((s, i) => s + i.subtotal, 0);

    orden.citas = bd.prepare(`
      SELECT c.id, c.fecha, c.horario, c.estado, m.nombre AS medico, e.nombre AS especialidad
      FROM citas c JOIN medicos m ON m.id = c.medico_id JOIN especialidades e ON e.id = m.especialidad_id
      WHERE c.orden_id = ? ORDER BY c.fecha, c.horario
    `).all(orden.id);
    return orden;
  }

  /* ------------------------------ Empresas ----------------------------- */

  app.get("/api/empresas", personal, (req, res) => {
    res.json(bd.prepare(`
      SELECT e.id, e.nombre, e.nit, e.contacto, e.correo, e.telefono, e.creada_en AS creadaEn,
             (SELECT COUNT(*) FROM ordenes o WHERE o.empresa_id = e.id AND o.estado <> 'anulada') AS ordenes
      FROM empresas e ORDER BY e.nombre
    `).all());
  });

  // Valida los datos de una empresa; devuelve { datos, campos }
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
    if (!/^[0-9.\-\s]{5,20}$/.test(datos.nit)) campos.nit = "Escribe un NIT válido (solo números, puntos y guion).";
    if (datos.contacto.length < 3 || datos.contacto.length > 80) campos.contacto = "Escribe el nombre de la persona de contacto.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(datos.correo)) campos.correo = "Ingresa un correo electrónico válido.";
    const digitos = datos.telefono.replace(/\D/g, "");
    if (digitos.length < 7 || digitos.length > 15) campos.telefono = "Ingresa un teléfono válido (7 a 15 dígitos).";
    return { datos, campos };
  }

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

  // Corregir los datos de una empresa (las órdenes ya emitidas muestran los datos actualizados)
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

  /* ------------------------------ Órdenes ------------------------------ */

  app.get("/api/ordenes", personal, (req, res) => {
    const ordenes = bd.prepare(`
      SELECT o.id, o.estado, o.total, o.creada_en AS creadaEn, emp.nombre AS empresa, emp.nit,
             (SELECT COALESCE(SUM(cantidad), 0) FROM orden_items WHERE orden_id = o.id) AS citasPedidas,
             (SELECT COALESCE(SUM(i.cantidad * e.precio), 0) FROM orden_items i
                JOIN especialidades e ON e.id = i.especialidad_id WHERE i.orden_id = o.id) AS totalBorrador
      FROM ordenes o JOIN empresas emp ON emp.id = o.empresa_id
      ORDER BY o.id DESC
    `).all().map((o) => ({ ...o, total: o.estado === "borrador" ? o.totalBorrador : o.total, totalBorrador: undefined }));
    res.json(ordenes);
  });

  app.get("/api/ordenes/:id", personal, (req, res) => {
    const orden = obtenerOrden(req.params.id);
    if (!orden) return error(res, 404, "La orden no existe.");
    res.json(orden);
  });

  app.post("/api/ordenes", personal, (req, res) => {
    const empresa = obtenerEmpresa(req.body.empresaId);
    if (!empresa) return error(res, 400, "Selecciona una empresa.", { empresaId: "Selecciona una empresa." });
    const r = bd.prepare("INSERT INTO ordenes (empresa_id, creada_por) VALUES (?, ?)").run(empresa.id, req.usuario.id);
    res.status(201).json(obtenerOrden(r.lastInsertRowid));
  });

  // Reemplaza los renglones de una orden en borrador: [{ especialidadId, cantidad }]
  app.put("/api/ordenes/:id/items", personal, (req, res) => {
    const orden = obtenerOrden(req.params.id);
    if (!orden) return error(res, 404, "La orden no existe.");
    if (orden.estado !== "borrador") return error(res, 409, "Solo se pueden modificar órdenes en borrador.");

    const items = req.body.items;
    if (!Array.isArray(items) || items.length > 50) return error(res, 400, "Renglones no válidos.");
    const vistos = new Set();
    for (const item of items) {
      const especialidadId = texto(item && item.especialidadId);
      const cantidad = Number(item && item.cantidad);
      if (!bd.prepare("SELECT 1 FROM especialidades WHERE id = ?").get(especialidadId) || vistos.has(especialidadId)) {
        return error(res, 400, "Hay una especialidad no válida o repetida en la orden.");
      }
      if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > MAX_CANTIDAD) {
        return error(res, 400, "La cantidad de citas debe ser un número entre 1 y " + MAX_CANTIDAD + ".");
      }
      // Sin médicos con horario no habría cupos para asignar estas citas al pagar
      const tieneMedicos = bd.prepare(`
        SELECT 1 FROM medicos m JOIN disponibilidad d ON d.medico_id = m.id WHERE m.especialidad_id = ? LIMIT 1
      `).get(especialidadId);
      if (!tieneMedicos) {
        return error(res, 400, "Esa especialidad aún no tiene médicos con horarios de atención; no se pueden agendar citas en ella.");
      }
      vistos.add(especialidadId);
    }

    enTransaccion(() => {
      bd.prepare("DELETE FROM orden_items WHERE orden_id = ?").run(orden.id);
      const insertar = bd.prepare("INSERT INTO orden_items (orden_id, especialidad_id, cantidad) VALUES (?, ?, ?)");
      items.forEach((i) => insertar.run(orden.id, texto(i.especialidadId), Number(i.cantidad)));
    });
    res.json(obtenerOrden(orden.id));
  });

  // Rectificada la orden: los precios quedan fijos y se emite la orden de pago
  app.patch("/api/ordenes/:id/emitir", personal, (req, res) => {
    const orden = obtenerOrden(req.params.id);
    if (!orden) return error(res, 404, "La orden no existe.");
    if (orden.estado !== "borrador") return error(res, 409, "Esta orden ya fue emitida.");
    if (!orden.items.length) return error(res, 400, "Agrega al menos una especialidad antes de emitir la orden de pago.");

    enTransaccion(() => {
      const fijar = bd.prepare("UPDATE orden_items SET precio_unitario = ? WHERE orden_id = ? AND especialidad_id = ?");
      orden.items.forEach((i) => fijar.run(i.precioUnitario, orden.id, i.especialidadId));
      bd.prepare(`
        UPDATE ordenes SET estado = 'emitida', total = ?, emitida_en = datetime('now', 'localtime') WHERE id = ?
      `).run(orden.total, orden.id);
    });
    res.json(obtenerOrden(orden.id));
  });

  // Corregir la empresa de una orden en borrador (por si se eligió la equivocada)
  app.put("/api/ordenes/:id/empresa", personal, (req, res) => {
    const orden = obtenerOrden(req.params.id);
    if (!orden) return error(res, 404, "La orden no existe.");
    if (orden.estado !== "borrador") return error(res, 409, "Solo se puede cambiar la empresa de una orden en borrador.");
    const empresa = obtenerEmpresa(req.body.empresaId);
    if (!empresa) return error(res, 400, "Selecciona una empresa.", { empresaId: "Selecciona una empresa." });
    bd.prepare("UPDATE ordenes SET empresa_id = ? WHERE id = ?").run(empresa.id, orden.id);
    res.json(obtenerOrden(orden.id));
  });

  // Editar una orden ya emitida: vuelve a borrador para corregirla y emitirla de nuevo.
  // La orden de pago anterior deja de valer; los precios se recalculan al volver a emitir.
  // Una orden pagada no se reabre: sus citas ya están en las agendas de los médicos.
  app.patch("/api/ordenes/:id/reabrir", personal, (req, res) => {
    const orden = obtenerOrden(req.params.id);
    if (!orden) return error(res, 404, "La orden no existe.");
    if (orden.estado !== "emitida") {
      return error(res, 409, orden.estado === "pagada"
        ? "Una orden pagada no se puede editar: sus citas ya están asignadas. Cancela en recepción las citas que sobren."
        : "Solo se pueden reabrir órdenes emitidas.");
    }
    enTransaccion(() => {
      bd.prepare("UPDATE orden_items SET precio_unitario = 0 WHERE orden_id = ?").run(orden.id);
      bd.prepare("UPDATE ordenes SET estado = 'borrador', total = 0, emitida_en = NULL WHERE id = ?").run(orden.id);
    });
    res.json(obtenerOrden(orden.id));
  });

  // Fechas a partir de mañana, en formato AAAA-MM-DD
  function fechasDesdeManana(cantidadDias) {
    const fechas = [];
    const base = new Date(fechaHoy() + "T00:00:00Z");
    for (let i = 1; i <= cantidadDias; i++) {
      const f = new Date(base.getTime() + i * 86400000);
      fechas.push(f.toISOString().slice(0, 10));
    }
    return fechas;
  }

  /*
   * Asigna "cantidad" citas de una especialidad. Recorre los días desde mañana;
   * en cada día reparte por turnos entre los médicos de la especialidad (uno a
   * uno), tomando la primera hora libre de cada uno, hasta que el día no tenga
   * más cupos. horariosLibres() ya descuenta las horas ocupadas y devuelve una
   * lista vacía cuando el médico llegó a su capacidad diaria.
   */
  function asignarCitas(orden, item, empresa) {
    const medicos = bd.prepare("SELECT id FROM medicos WHERE especialidad_id = ? ORDER BY nombre").all(item.especialidadId);
    const insertar = bd.prepare(`
      INSERT INTO citas (orden_id, medico_id, fecha, horario, motivo, estado) VALUES (?, ?, ?, ?, ?, 'confirmada')
    `);
    let asignadas = 0;

    for (const fecha of fechasDesdeManana(DIAS_MAXIMOS_DE_BUSQUEDA)) {
      let algunoTomo = true;
      while (asignadas < item.cantidad && algunoTomo) {
        algunoTomo = false;
        for (const medico of medicos) {
          if (asignadas >= item.cantidad) break;
          const libres = horariosLibres(medico.id, fecha, 0);
          if (!libres.length) continue;
          asignadas++;
          const motivo = "Orden N.º " + orden.id + " · " + empresa.nombre + " · cita " + asignadas + " de " + item.cantidad;
          insertar.run(orden.id, medico.id, fecha, libres[0], motivo);
          algunoTomo = true;
        }
      }
      if (asignadas >= item.cantidad) return;
    }
    const faltan = item.cantidad - asignadas;
    throw { conflicto: true, mensaje: "No hay cupos suficientes de " + item.especialidad + " en los próximos " +
      DIAS_MAXIMOS_DE_BUSQUEDA + " días (faltan " + faltan + "). Revisa los horarios y la capacidad de sus médicos." };
  }

  // La empresa pagó: se registra el pago y se asignan todas las citas de la orden
  app.patch("/api/ordenes/:id/pagar", personal, (req, res) => {
    const orden = obtenerOrden(req.params.id);
    if (!orden) return error(res, 404, "La orden no existe.");
    if (orden.estado !== "emitida") return error(res, 409, "Solo se puede registrar el pago de una orden emitida.");

    try {
      enTransaccion(() => {
        orden.items.forEach((item) => asignarCitas(orden, item, orden.empresa));
        bd.prepare("UPDATE ordenes SET estado = 'pagada', pagada_en = datetime('now', 'localtime') WHERE id = ?").run(orden.id);
      });
    } catch (e) {
      if (e && e.conflicto) return error(res, 409, e.mensaje);
      throw e;
    }
    res.json(obtenerOrden(orden.id));
  });

  // Anular: solo antes del pago (después, las citas se cancelan una por una en recepción)
  app.patch("/api/ordenes/:id/anular", personal, (req, res) => {
    const orden = obtenerOrden(req.params.id);
    if (!orden) return error(res, 404, "La orden no existe.");
    if (orden.estado !== "borrador" && orden.estado !== "emitida") {
      return error(res, 409, "Solo se pueden anular órdenes que aún no se han pagado.");
    }
    bd.prepare("UPDATE ordenes SET estado = 'anulada' WHERE id = ?").run(orden.id);
    res.json(obtenerOrden(orden.id));
  });
}

module.exports = { registrarRutasOrdenes };
