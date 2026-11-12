# Módulo de Recepción — estado

## Implementado (primera versión)

- Página: `citas.html`, con su lógica en `assets/js/vue/recepcion.js`.
- API: rutas `/api/recepcion/...` en `servidor/rutas/personal.js`, solo para el rol
  `recepcionista`.
- La recepcionista ve las citas de todos los pacientes con filtro por estado,
  confirma las pendientes y cancela las pendientes o confirmadas (el horario
  queda libre).

## Pendiente

- Confirmar con la clínica las reglas provisionales: confirmación manual y sin
  plazo (H4) y cancelación sin plazo mínimo (H3). Ver
  `docs/DDD-EVENT-STORMING.md`, sección 9.
- Notificar al paciente cuando se confirma o cancela su cita (H5).
- Vista de "citas del día" y filtros por fecha, médico o paciente. Hoy el
  listado carga todas las citas, sin paginación.
