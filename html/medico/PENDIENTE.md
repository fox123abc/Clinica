# Módulo de Agenda Médica — estado

## Implementado (primera versión)

- Página: `agenda.html`, con su lógica en `assets/js/vue/medico.js`.
- API: `/api/medico/agenda` y `/api/medico/citas/:id/atender` en
  `servidor/rutas/personal.js`, solo para el rol `medico`.
- El médico ve sus citas desde hoy (sin las canceladas), con filtro "Hoy", y
  marca como atendida una cita confirmada de su propia agenda.
- La cuenta debe estar vinculada a un médico del catálogo
  (`usuarios.medico_id`).

## Pendiente

- Decidir si existe el estado "no asistió" (H6).
- Historial de citas pasadas: hoy la agenda muestra solo desde hoy en adelante.
- Registro de la consulta atendida. Hoy solo se cambia el estado de la cita.
- Definir cómo se crean las cuentas de médico y cómo se vinculan con el
  catálogo (H10). Por ahora solo existe la cuenta de demostración.
