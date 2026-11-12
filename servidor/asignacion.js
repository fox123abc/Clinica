/*
 * asignacion.js — política "Asignación por cupos" (Órdenes de Empresas)
 * Cuando una empresa paga su orden, cada renglón (especialidad × cantidad) se
 * convierte en citas confirmadas. Es lógica de dominio pura: no sabe de HTTP,
 * y si no alcanzan los cupos lanza un ErrorDeNegocio.
 */

const { bd } = require("./bd");
const { ErrorDeNegocio } = require("./http");
const { fechaHoy, sumarDias, horariosLibres } = require("./agenda");

const DIAS_MAXIMOS_DE_BUSQUEDA = 120;

const consultas = {
  medicosDe: bd.prepare("SELECT id FROM medicos WHERE especialidad_id = ? ORDER BY nombre"),
  insertarCita: bd.prepare(`
    INSERT INTO citas (orden_id, medico_id, fecha, horario, motivo, estado) VALUES (?, ?, ?, ?, ?, 'confirmada')
  `)
};

/*
 * Asigna las citas de un renglón. Recorre los días desde mañana; en cada día
 * reparte por turnos entre los médicos de la especialidad (uno a uno), tomando
 * la primera hora libre de cada uno, hasta que el día ya no tenga cupos.
 * horariosLibres() descuenta las horas ocupadas y devuelve una lista vacía
 * cuando el médico llegó a su capacidad diaria.
 * Debe llamarse dentro de una transacción: si lanza, no queda nada a medias.
 */
function asignarRenglon(orden, item) {
  const medicos = consultas.medicosDe.all(item.especialidadId);
  const manana = sumarDias(fechaHoy(), 1);
  let asignadas = 0;

  for (let dia = 0; dia < DIAS_MAXIMOS_DE_BUSQUEDA && asignadas < item.cantidad; dia++) {
    const fecha = sumarDias(manana, dia);
    let algunoTomo = true;
    while (asignadas < item.cantidad && algunoTomo) {
      algunoTomo = false;
      for (const medico of medicos) {
        if (asignadas >= item.cantidad) break;
        const libres = horariosLibres(medico.id, fecha, 0);
        if (!libres.length) continue;
        asignadas++;
        const motivo = `Orden N.º ${orden.id} · ${orden.empresa.nombre} · cita ${asignadas} de ${item.cantidad}`;
        consultas.insertarCita.run(orden.id, medico.id, fecha, libres[0], motivo);
        algunoTomo = true;
      }
    }
  }

  if (asignadas < item.cantidad) {
    throw new ErrorDeNegocio(409, `No hay cupos suficientes de ${item.especialidad} en los próximos ` +
      `${DIAS_MAXIMOS_DE_BUSQUEDA} días (faltan ${item.cantidad - asignadas}). ` +
      "Revisa los horarios y la capacidad de sus médicos.");
  }
}

// Asigna todas las citas de la orden (todos sus renglones)
function asignarCitasDeOrden(orden) {
  orden.items.forEach((item) => asignarRenglon(orden, item));
}

module.exports = { asignarCitasDeOrden, DIAS_MAXIMOS_DE_BUSQUEDA };
