# Clínica Altavida — Gestión de citas médicas

Sitio en HTML y CSS con **Vue.js 3** para los formularios y las pantallas
dinámicas, y un **servidor local (Node.js + Express)** con una **base de
datos SQLite** donde se guardan usuarios, sesiones, especialidades, médicos,
disponibilidad y citas. Incluye áreas separadas para **pacientes**,
**recepción**, **médicos** y **administración**, cada una con su propio acceso.

## Documentación

| Documento | Contenido |
| --- | --- |
| [docs/DDD-EVENT-STORMING.md](docs/DDD-EVENT-STORMING.md) | Contextualización del dominio con **DDD y Event Storming**: eventos, comandos, políticas, agregados, bounded contexts, context map y glosario. |
| [docs/VUE.md](docs/VUE.md) | Guía visual de **dónde y cómo se usa Vue.js**: mapa de páginas, directivas, componentes y flujo de datos. |

## Cómo ejecutarlo

Requisito: **Node.js 22.13 o superior** (se usa el módulo integrado
`node:sqlite`, así que no hay que instalar ningún motor de base de datos).

```bash
npm install     # solo la primera vez
npm start       # abre http://localhost:3000
```

La base de datos se crea sola en `servidor/datos/altavida.db` la primera
vez, con el catálogo de demostración y **usuarios de prueba** (todos con la
contraseña `Altavida2026`):

| Correo | Rol | Entra a |
| --- | --- | --- |
| `paciente@altavida.com` | Paciente | `html/paciente/mis-citas.html` |
| `recepcion@altavida.com` | Recepcionista | `html/recepcion/citas.html` |
| `medico@altavida.com` | Médico (vinculado a `[Médico 1]`) | `html/medico/agenda.html` |
| `admin@altavida.com` | Administrador | `html/admin/catalogo.html` |

El rol lo define la cuenta, no el formulario: tras iniciar sesión cada usuario
llega a su propia página y no puede abrir las de otro rol.

> Estas cuentas son **solo de demostración** y se crean solas en una base de
> datos nueva. No se deben usar credenciales fijas en un despliegue real.

**Con Docker** (sin instalar Node.js): `docker compose up -d --build` y abrir
http://localhost:8080. Detalles en [DOCKER_SETUP.md](DOCKER_SETUP.md).

Para **empezar de cero** con el servidor local (borra la base de datos):

```bash
npm run reiniciar-bd
```

> Ya no basta con abrir los HTML con Live Server: las páginas necesitan la
> API, así que siempre se deben abrir desde `http://localhost:3000`.

Flujos de prueba sugeridos:

- **Paciente:** Registrarme → Ingresar → Solicitar cita → Confirmación →
  Mis citas (filtrar, reprogramar o cancelar).
- **Recepción:** ingresar como recepcionista → filtrar las citas pendientes →
  confirmar o cancelar.
- **Médico:** ingresar como médico → ver la agenda → marcar como atendida una
  cita confirmada.
- **Administración:** ingresar como administrador → crear una especialidad o un
  médico y definir sus horarios; el paciente los ve al solicitar una cita.

## Estructura de carpetas

```
clinica-altavida/
├── package.json            Dependencias y scripts (npm start)
├── docker-compose.yml      Levanta todo con Docker (puerto 8080)
├── servidor/
│   ├── servidor.js         API REST + archivos del sitio (Express)
│   ├── bd.js               Conexión SQLite, tablas, catálogo y usuario de demostración
│   ├── personal.js         Rutas de la API para recepción, médico y administración
│   ├── seguridad.js        Hash de contraseñas (scrypt)
│   ├── reiniciar-bd.js     Borra la base de datos (npm run reiniciar-bd)
│   └── datos/              altavida.db (se crea sola, no se sube a git)
├── index.html              Página pública de inicio (entrada del sitio)
├── html/                   Todas las demás páginas HTML
│   ├── especialidades.html     Página pública de especialidades
│   ├── login.html              Inicio de sesión
│   ├── registro.html           Registro de paciente
│   ├── paciente/               Área interna del paciente (tras iniciar sesión)
│   │   ├── solicitud-cita.html     Formulario de solicitud de cita
│   │   ├── confirmacion.html       Resumen posterior a la solicitud
│   │   └── mis-citas.html          Consulta de citas del paciente
│   ├── recepcion/              Área de recepción (rol recepcionista)
│   │   └── citas.html              Confirmar y cancelar las citas de los pacientes
│   ├── medico/                 Área médica (rol médico)
│   │   └── agenda.html             Agenda del médico y registro de citas atendidas
│   └── admin/                  Área de administración (rol administrador)
│       └── catalogo.html           Especialidades, médicos y horarios de atención
└── assets/
    ├── css/
    │   ├── variables.css     Tokens: color, tipografía, espaciado
    │   ├── base.css          Reinicio y tipografía base
    │   ├── layout.css        Contenedor, encabezado, navegación, pie de página
    │   ├── componentes.css   Botones, formularios, tablas, etiquetas de estado
    │   ├── publico.css       Estilos exclusivos del sitio público
    │   └── privado.css       Estilos exclusivos del área de paciente
    ├── js/
    │   ├── navegacion.js     Menú móvil y marca de la página actual
    │   └── vue/              Lógica con Vue.js (una app por página)
    │       ├── comun.js           Cliente de la API, validaciones y
    │       │                      componentes reutilizables
    │       ├── login.js           Formulario de inicio de sesión
    │       ├── registro.js        Formulario de registro
    │       ├── solicitud-cita.js  Formulario de solicitud / reprogramación de cita
    │       ├── confirmacion.js    Resumen de la cita registrada
    │       ├── mis-citas.js       Listado, filtro por estado y cancelación
    │       ├── recepcion.js       Gestión de citas de recepción
    │       ├── medico.js          Agenda del médico
    │       └── admin.js           Administración del catálogo
    └── img/                  Reservada (ver PENDIENTE.md)
```

## Alcance cubierto

- **Etapa 1 y 2:** sitio público (`index.html`, `html/especialidades.html`) con
  navegación responsive y acceso a la aplicación clínica interna.
- **Etapa 3:** módulo de citas del paciente: registro, inicio de sesión,
  formulario de solicitud, confirmación y consulta de "Mis citas".
- **Personal de la clínica (primera versión):** recepción (confirmar y cancelar
  citas), agenda médica (marcar citas atendidas) y administración (especialidades,
  médicos y horarios), con acceso separado por rol.

## Uso de Vue.js

Vue se carga desde CDN (`vue@3.4.38`, build global), sin herramientas de
compilación, para que el sitio se sirva directamente desde el servidor
Express (o desde Docker), sin un paso de construcción. Se usa **solo donde aporta**: formularios y
pantallas con datos. Las páginas públicas (`index.html`,
`html/especialidades.html`) siguen siendo HTML estático.

Las plantillas se escriben directamente en el HTML (directivas `v-model`,
`v-if`, `v-for`, `@submit.prevent`, etc.) y cada página monta su propia
aplicación desde su archivo en `assets/js/vue/`.

| Página | Qué hace Vue |
| --- | --- |
| `html/registro.html` | Validación por campo (nombre, correo, teléfono, contraseña y confirmación), detección de correo duplicado y creación de la cuenta. |
| `html/login.html` | Validación, verificación de credenciales, mostrar/ocultar contraseña e inicio de sesión. |
| `html/paciente/solicitud-cita.html` | Médicos filtrados por especialidad, fecha restringida a días de atención del médico y sin fechas pasadas, horarios que excluyen los ya ocupados, contador del motivo. Con `?reprogramar=<id>` reprograma una cita existente. |
| `html/paciente/confirmacion.html` | Muestra los datos reales de la cita recién registrada. |
| `html/paciente/mis-citas.html` | Lista las citas del paciente, filtro real por estado, cancelación (libera el horario) y enlace a reprogramar. |
| `html/recepcion/citas.html` | Lista las citas de todos los pacientes, filtro por estado, confirmar las pendientes y cancelar las activas. |
| `html/medico/agenda.html` | Agenda del médico (próximas y de hoy) y marcar como atendida una cita confirmada. |
| `html/admin/catalogo.html` | Crear especialidades y médicos y editar los horarios de atención de cada médico. |
| Franja de sesión | Muestra el nombre del usuario y su rol, y cierra sesión. Las páginas internas redirigen al login si no hay sesión, o a la página de su propio rol si la cuenta es de otro tipo. |

Componentes reutilizables (en `comun.js`):

- `<campo-formulario>`: etiqueta, campo, texto de ayuda y mensaje de error
  con las clases existentes (`campo`, `campo--obligatorio`, `campo__ayuda`).
- `<etiqueta-estado>`: etiqueta de color según el estado de la cita.

Todas las llamadas al servidor están centralizadas en el objeto `Api` de
`comun.js`.

## Base de datos (SQLite)

| Tabla | Contenido |
| --- | --- |
| `especialidades` | Especialidades médicas |
| `medicos` | Médicos y la especialidad a la que pertenecen |
| `disponibilidad` | Franjas de atención: médico + día de la semana + hora |
| `usuarios` | Cuentas con su rol (paciente, recepcionista, médico o administrador). `medico_id` vincula la cuenta de un médico con su registro en `medicos`. El registro público solo crea pacientes |
| `sesiones` | Sesiones activas (cookie `HttpOnly`, duran 8 horas) |
| `citas` | Citas con su estado: pendiente, confirmada, cancelada o atendida |

Reglas que garantiza la propia base de datos o el servidor:

- Las contraseñas se guardan con hash **scrypt** y sal aleatoria, nunca en texto plano.
- Un índice único impide que dos citas activas ocupen el mismo médico, fecha y
  horario (aunque dos personas reserven a la vez). Una cita cancelada libera el cupo.
- El servidor vuelve a validar todo lo que valida el formulario (no se confía
  solo en el navegador). Cada paciente solo ve y modifica sus propias citas, y cada
  rol solo accede a su área: el servidor responde 403 a las demás.
- El servidor solo publica `index.html` y las carpetas `html/` y `assets/`; el
  resto (`servidor/`, `node_modules/`, la base de datos, archivos `.md` y de
  configuración) no se puede descargar desde el navegador.

### API REST

| Método | Ruta | Descripción |
| --- | --- | --- |
| POST | `/api/registro` | Crea una cuenta de paciente |
| POST | `/api/login` | Inicia sesión |
| POST | `/api/logout` | Cierra sesión |
| GET | `/api/sesion` | Usuario de la sesión activa |
| GET | `/api/catalogo` | Especialidades y médicos (con días de atención) |
| GET | `/api/horarios-disponibles?medicoId=&fecha=` | Horas libres de un médico en una fecha |
| GET | `/api/citas` | Citas del paciente |
| GET | `/api/citas/:id` | Detalle de una cita |
| POST | `/api/citas` | Solicita una cita |
| PUT | `/api/citas/:id` | Reprograma una cita (vuelve a quedar pendiente) |
| PATCH | `/api/citas/:id/cancelar` | Cancela una cita |

Las rutas de `/api/citas` son solo para pacientes. El personal usa estas, y
cada una responde 403 si la cuenta no tiene el rol indicado:

| Método | Ruta | Rol | Descripción |
| --- | --- | --- | --- |
| GET | `/api/recepcion/citas` | Recepcionista | Citas de todos los pacientes |
| PATCH | `/api/recepcion/citas/:id/confirmar` | Recepcionista | Confirma una cita pendiente |
| PATCH | `/api/recepcion/citas/:id/cancelar` | Recepcionista | Cancela una cita pendiente o confirmada |
| GET | `/api/medico/agenda` | Médico | Citas del médico desde hoy (sin canceladas) |
| PATCH | `/api/medico/citas/:id/atender` | Médico | Marca como atendida una cita confirmada |
| GET | `/api/admin/catalogo` | Administrador | Especialidades y médicos con su disponibilidad |
| POST | `/api/admin/especialidades` | Administrador | Crea una especialidad |
| POST | `/api/admin/medicos` | Administrador | Crea un médico |
| PUT | `/api/admin/medicos/:id/disponibilidad` | Administrador | Reemplaza los horarios de atención del médico |

## Decisiones de diseño (paleta y tipografía)

- **Color:** verde pino (`--color-pino`) como color de marca, verde salvia
  como acento secundario, sienna como color de llamada a la acción y un
  fondo hueso cálido. Se definieron intencionalmente para evitar combinaciones
  genéricas (crema + terracota) y transmitir calma y confianza clínica.
- **Tipografía:** Newsreader (serif) para titulares, IBM Plex Sans para
  texto e interfaz.
- Los estados de una cita (pendiente, confirmada, cancelada, atendida)
  tienen colores propios y consistentes en toda la aplicación. Las etiquetas
  usan fondo suave y texto oscuro del mismo tono para que se lean bien.
- Tarjetas con bordes redondeados y sombras suaves, encabezado fijo con la
  página actual resaltada y logotipo dibujado solo con CSS.
- Inicio de sesión y registro a dos columnas (beneficios + formulario).
- En la solicitud de cita los horarios se eligen con botones y un resumen
  lateral se actualiza en vivo mientras se llena el formulario.
- En pantallas angostas la tabla de "Mis citas" se convierte en tarjetas,
  para que no haya desplazamiento horizontal.

## Contenido pendiente de confirmar

Los siguientes elementos se dejaron como marcadores de posición
(`[texto entre corchetes]`) 

- Descripción institucional de la clínica (misión, historia, cobertura).
- Nombres reales de especialidades médicas.
- Nombres de médicos y horarios reales de atención.
- Campos adicionales de registro (ej. tipo/número de documento), si se
  requieren.

## Pendiente de alcance (no incluido aún)

Los módulos de **Recepción**, **Agenda médica** y **Administración** ya
existen como primera versión funcional. Algunas reglas son **provisionales**
porque dependen de decisiones abiertas con la clínica
(hotspots H2 a H4 en [docs/DDD-EVENT-STORMING.md](docs/DDD-EVENT-STORMING.md)):

- La recepcionista confirma las citas manualmente (H4).
- No hay plazo mínimo para cancelar ni límite de citas activas por paciente (H2 y H3).
- Los usuarios de personal son cuentas de demostración con una contraseña
  compartida; todavía no existe una pantalla para crear personal nuevo.
- Administración crea especialidades y médicos y edita horarios, pero no
  elimina nada. Cambiar los horarios no modifica las citas ya agendadas.
