# Módulo de Administración — estado

## Implementado (primera versión)

- Página: `catalogo.html`, con su lógica en `assets/js/vue/admin.js`.
- API: rutas `/api/admin/...` en `servidor/rutas/administracion.js`, solo para el rol
  `administrador`.
- El administrador crea especialidades y médicos, y reemplaza los horarios de
  atención de cada médico. No se elimina nada.
- Cambiar los horarios no modifica las citas que ya estaban agendadas.

## Pendiente

- Editar o desactivar especialidades y médicos ya creados (H11).
- Crear y administrar las cuentas del personal. Hoy son cuentas de
  demostración con contraseña compartida (H10).
- Descripción de cada especialidad: la columna `descripcion` existe en la
  base de datos, pero ninguna pantalla la usa.
- Duración de la cita por especialidad (H7), varias especialidades por médico
  (H8), festivos y ausencias del médico (H9).
- Avisar cuando un cambio de horarios deja citas ya agendadas fuera de la
  nueva disponibilidad.
