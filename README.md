# Clínica Altavida — Maquetado frontend (Etapas 1, 2 y 3)

Prototipo de maquetado en HTML y CSS puro (sin frameworks), correspondiente
únicamente al frontend. No incluye backend, base de datos ni validación
real de formularios: esto queda pendiente para ser desarrollado durante las 
etapas posteriores en su debido momento de acuerdo a los respectivos cortes 
del semestre acádemico.

## Estructura de carpetas

```
clinica-altavida/
├── index.html              Página pública de inicio
├── especialidades.html     Página pública de especialidades
├── login.html              Inicio de sesión
├── registro.html           Registro de paciente
├── paciente/                Área interna del paciente (tras iniciar sesión)
│   ├── solicitud-cita.html  Formulario de solicitud de cita
│   ├── confirmacion.html    Resumen posterior a la solicitud
│   └── mis-citas.html       Consulta de citas del paciente
├── recepcion/                Reservada — módulo aún no maquetado (ver PENDIENTE.md)
├── medico/                   Reservada — módulo aún no maquetado (ver PENDIENTE.md)
├── admin/                    Reservada — módulo aún no maquetado (ver PENDIENTE.md)
└── assets/
    ├── css/
    │   ├── variables.css     Tokens: color, tipografía, espaciado
    │   ├── base.css          Reinicio y tipografía base
    │   ├── layout.css        Contenedor, encabezado, navegación, pie de página
    │   ├── componentes.css   Botones, formularios, tablas, etiquetas de estado
    │   ├── publico.css       Estilos exclusivos del sitio público
    │   └── privado.css       Estilos exclusivos del área de paciente
    ├── js/
    │   └── navegacion.js     Solo abre/cierra el menú móvil (aun no contiene lógica de datos)
    └── img/                  Reservada (ver PENDIENTE.md)
```

## Alcance cubierto

- **Etapa 1 y 2:** sitio público (`index.html`, `especialidades.html`) con
  navegación responsive y acceso a la aplicación clínica interna.
- **Etapa 3:** módulo de citas del paciente: registro, inicio de sesión,
  formulario de solicitud, confirmación y consulta de "Mis citas".

## Decisiones de diseño (paleta y tipografía)

- **Color:** verde pino (`--color-pino`) como color de marca, verde salvia
  como acento secundario, sienna como color de llamada a la acción y un
  fondo hueso cálido. Se definieron intencionalmente para evitar combinaciones
  genéricas (crema + terracota) y transmitir calma y confianza clínica.
- **Tipografía:** Newsreader (serif) para titulares, IBM Plex Sans para
  texto e interfaz.
- Los estados de una cita (pendiente, confirmada, cancelada, atendida)
  tienen colores propios y consistentes en toda la aplicación.

## Contenido pendiente de confirmar

Los siguientes elementos se dejaron como marcadores de posición
(`[texto entre corchetes]`) porque el documento del proyecto no especifica
su contenido real, y no se quiso inventar información no solicitada:

- Descripción institucional de la clínica (misión, historia, cobertura).
- Nombres reales de especialidades médicas.
- Nombres de médicos y horarios reales de atención.
- Campos adicionales de registro (ej. tipo/número de documento), si se
  requieren.

## Pendiente de alcance (no incluido aún)

Los módulos de **Recepción**, **Agenda médica** y **Administración**
(usuarios recepcionista, médico y administrador) no se maquetaron todavía.
Según el propio documento de definición, corresponden a etapas posteriores
a la 3 y "no han sido incluidas puesto que todavía no son requeridas". Las
carpetas quedaron creadas y documentadas para no romper la estructura del
proyecto cuando se aborden.

## Cómo previsualizar

Al ser HTML y CSS puro, basta con abrir `index.html` directamente en un
navegador, o servir la carpeta con un servidor estático simple
(por ejemplo, la extensión "Live Server" de VS Code) para que las rutas
relativas funcionen correctamente.
