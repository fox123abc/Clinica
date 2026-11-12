---
name: Clínica Altavida
description: El carné de citas impreso de la clínica, donde cada horario es una casilla y cada cambio de estado, un sello de goma.
colors:
  cartulina: "#BFD6EA"
  cartulina-honda: "#A9C7E1"
  cara: "#E8F1F9"
  papel: "#F7FAFD"
  blanco: "#FFFFFF"
  tinta: "#14181F"
  tinta-suave: "#3A4452"
  linea: "rgba(20, 24, 31, 0.85)"
  linea-tenue: "rgba(20, 24, 31, 0.28)"
  sello-pendiente: "#5B3FA0"
  sello-confirmada: "#1F6B45"
  sello-atendida: "#1E4E8C"
  sello-cancelada: "#B42E28"
typography:
  display:
    fontFamily: "Archivo, Arial Narrow, Arial, sans-serif"
    fontSize: "clamp(3.2rem, 6.4vw + 0.5rem, 6.25rem)"
    fontWeight: 900
    lineHeight: 0.88
    letterSpacing: "-0.015em"
    fontVariation: "'wdth' 70"
  headline:
    fontFamily: "Archivo, Arial Narrow, Arial, sans-serif"
    fontSize: "clamp(2.4rem, 4vw + 1rem, 4.25rem)"
    fontWeight: 900
    lineHeight: 0.92
    fontVariation: "'wdth' 72"
  title:
    fontFamily: "Archivo, Arial Narrow, Arial, sans-serif"
    fontSize: "1.1rem"
    fontWeight: 800
    letterSpacing: "0.12em"
    fontVariation: "'wdth' 115"
  stamp:
    fontFamily: "Archivo, Arial Narrow, Arial, sans-serif"
    fontSize: "1.6rem"
    fontWeight: 900
    lineHeight: 1
    letterSpacing: "0.08em"
    fontVariation: "'wdth' 85"
  label:
    fontFamily: "Archivo, Arial Narrow, Arial, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 700
    letterSpacing: "0.14em"
  action:
    fontFamily: "Archivo, Arial Narrow, Arial, sans-serif"
    fontSize: "0.95rem"
    fontWeight: 700
    letterSpacing: "0.06em"
  body-lead:
    fontFamily: "Public Sans, Segoe UI, Arial, sans-serif"
    fontSize: "clamp(1.1rem, 0.6vw + 0.95rem, 1.35rem)"
    fontWeight: 400
    lineHeight: 1.45
  body:
    fontFamily: "Public Sans, Segoe UI, Arial, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.55
  body-small:
    fontFamily: "Public Sans, Segoe UI, Arial, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  typed:
    fontFamily: "Courier Prime, Courier New, monospace"
    fontSize: "1.1rem"
    fontWeight: 700
    fontFeature: "'tnum' 1"
rounded:
  muestra: "3px"
  casilla: "6px"
  boton: "8px"
  bloque: "10px"
  talonario: "12px"
  carne: "14px"
spacing:
  casilla-gap: "0.5rem"
  campo: "0.9rem clamp(1rem, 3vw, 2rem) 1.1rem"
  bloque: "1.5rem"
  margen: "clamp(1rem, 4vw, 4rem)"
  seccion: "clamp(3rem, 7vw, 6rem)"
  ancho: "84rem"
components:
  boton-tinta:
    backgroundColor: "{colors.tinta}"
    textColor: "{colors.blanco}"
    typography: "{typography.action}"
    rounded: "{rounded.boton}"
    padding: "1rem 1.6rem"
  boton-tinta-hover:
    backgroundColor: "{colors.sello-pendiente}"
    textColor: "{colors.blanco}"
  boton-tinta-disabled:
    backgroundColor: "transparent"
    textColor: "{colors.tinta-suave}"
  nav-enlace:
    backgroundColor: "transparent"
    textColor: "{colors.tinta}"
    typography: "{typography.action}"
    rounded: "{rounded.casilla}"
    padding: "0.5rem 0.9rem"
  nav-enlace-destacado:
    backgroundColor: "{colors.tinta}"
    textColor: "{colors.blanco}"
    rounded: "{rounded.casilla}"
    padding: "0.5rem 0.9rem"
  nav-enlace-destacado-hover:
    backgroundColor: "{colors.sello-pendiente}"
  carne:
    backgroundColor: "{colors.cara}"
    textColor: "{colors.tinta}"
    rounded: "{rounded.carne}"
  campo-control:
    backgroundColor: "transparent"
    textColor: "{colors.tinta}"
    typography: "{typography.typed}"
    padding: "0.25rem 1.6rem 0.35rem 0"
  casilla-dia:
    backgroundColor: "{colors.papel}"
    textColor: "{colors.tinta}"
    rounded: "{rounded.casilla}"
    padding: "0.5rem 0.25rem 0.55rem"
  casilla-dia-elegida:
    backgroundColor: "{colors.tinta}"
    textColor: "{colors.blanco}"
  casilla-hora:
    backgroundColor: "{colors.blanco}"
    textColor: "{colors.tinta}"
    typography: "{typography.typed}"
    rounded: "{rounded.casilla}"
    padding: "0.65rem 0.25rem"
  casilla-hora-hover:
    backgroundColor: "{colors.cartulina}"
  casilla-hora-elegida:
    backgroundColor: "{colors.sello-pendiente}"
    textColor: "{colors.blanco}"
  casilla-hora-tomada:
    backgroundColor: "{colors.cara}"
    textColor: "{colors.tinta-suave}"
  sello-pendiente:
    backgroundColor: "transparent"
    textColor: "{colors.sello-pendiente}"
    typography: "{typography.stamp}"
    rounded: "{rounded.casilla}"
    padding: "0.35rem 0.8rem 0.3rem"
  sello-confirmada:
    textColor: "{colors.sello-confirmada}"
  sello-atendida:
    textColor: "{colors.sello-atendida}"
  sello-cancelada:
    textColor: "{colors.sello-cancelada}"
  talonario:
    backgroundColor: "{colors.cara}"
    textColor: "{colors.tinta}"
    rounded: "{rounded.talonario}"
    padding: "1.5rem"
  normas:
    backgroundColor: "{colors.cara}"
    textColor: "{colors.tinta}"
    typography: "{typography.body-small}"
    rounded: "{rounded.bloque}"
    padding: "1.5rem"
---

# Design System: Clínica Altavida

## Overview

**Creative North Star: "El carné de citas"**

Clínica Altavida se viste como el carné de citas impreso de una clínica: cartulina celeste que inunda regiones enteras, una cara más pálida donde se escribe, tinta de imprenta casi negra para filetes y letras, y cuatro tintas de sello de goma, una por cada estado de la cita. Cada horario es una casilla impresa; cada cambio de estado, una impresión de sello. La interfaz no describe el mecanismo: lo muestra funcionando sobre el formulario.

La densidad es la de un impreso administrativo: campos numerados en orden fijo (01, 02, 03…), filetes de tinta de 1.5–2px que dividen el espacio en lugar de tarjetas flotantes, líneas perforadas discontinuas que separan el cuerpo del talón, casillas ocupadas tachadas con rayado diagonal y letra pequeña densa a dos columnas en el reverso. La tipografía es la de una imprenta: Archivo en anchos extremos (condensada para titulares, expandida para rótulos) frente a Courier Prime para todo lo que "se escribe a máquina" en el carné (valores, fechas, horas).

El movimiento es único y físico: el sello cae una sola vez, de golpe, sin fundido. El resto del sistema es estático y responde con cambios de tinta, no con animación.

**Alcance.** Todo el sitio usa este mundo. La portada (`index.html`) tiene su hoja independiente `assets/css/inicio.css`; el resto de páginas (ingreso, registro, especialidades y los paneles de paciente, recepción, médico y administración) comparten `assets/css/variables.css` (tokens), `base.css`, `layout.css` (membrete y pie), `componentes.css` (botones, campos, casillas, registros, sellos, avisos), `publico.css` y `privado.css`, con los mismos valores. En `variables.css` los nombres antiguos (`--color-pino`, `--color-hueso`, `--color-sienna`…) solo sobreviven como alias de los tokens nuevos; el código nuevo usa los nombres del carné (`--tinta`, `--cartulina`, `--sello-*`).

**En las pantallas de trabajo** (paneles con sesión) el mundo se aplica con más sobriedad: los formularios son carnés (cara, borde de 2px, radio 14px), los estados de cita en tablas y en la confirmación son sellos (`.etiqueta-estado`, variante `--grande`), los filtros son casillas con contador a máquina y los resúmenes son talones con perforación.

**Key Characteristics:**
- Cartulina celeste a sangre; la cara del carné un tono más pálida.
- Filetes de tinta, campos numerados 01–05, líneas perforadas, casillas tachadas.
- Archivo en anchos extremos + Public Sans para leer + Courier Prime para lo "escrito".
- Cuatro tintas de sello, una por estado: pendiente, confirmada, atendida, cancelada.
- Una sola animación: el golpe del sello, sin fundido.

## Colors

Cartulina fría y tinta casi negra como base; el color saturado aparece solo como tinta de sello y siempre significa un estado de la cita.

### Primary
- **Tinta de imprenta** (`tinta`): texto, filetes de 2px, botón principal, casilla de día elegida, franja del pie. Es la voz por defecto de todo el impreso.

### Secondary
- **Violeta de sello pendiente** (`sello-pendiente`): el estado *pendiente* y, por extensión, la acción del visitante en curso: hora elegida, hover del botón principal y del enlace destacado, anillo de foco, `accent-color`, `caret-color` y selección de texto.

### Tertiary (tintas de estado)
- **Verde de sello confirmada** (`sello-confirmada`): solo el sello *Confirmada*.
- **Azul de sello atendida** (`sello-atendida`): solo el sello *Atendida*.
- **Rojo de sello cancelada** (`sello-cancelada`): sello *Cancelada*, avisos de error del carné y el cuadrado del logo con la cruz.

### Neutral
- **Cartulina celeste** (`cartulina`): fondo de página; inunda la portada y el membrete. También es `theme-color` y el hover de la casilla de hora libre.
- **Cartulina honda** (`cartulina-honda`): la banda de los talonarios, para separar regiones sin recurrir a sombras.
- **Cara del carné** (`cara`): superficie del carné, del reverso, de las normas y de los talonarios; fondo bajo el rayado de casillas tomadas.
- **Papel** (`papel`): casillas de día y menú móvil desplegado.
- **Blanco** (`blanco`): casillas de hora libres y texto sobre tinta o sobre sello. En la CSS aparece como literal `#FFFFFF`.
- **Tinta suave** (`tinta-suave`): etiquetas de campo, notas, ayudas, texto secundario de tablas.
- **Línea** (`linea`) y **línea tenue** (`linea-tenue`): filetes entre campos y perforaciones; renglón discontinuo bajo los selects, rayado de casillas tomadas y filas del registro.

### Named Rules
**La Regla de la Tinta con Significado.** Las cuatro tintas de sello se reservan para los estados de la cita (y el violeta, para la acción en curso del visitante). Nunca se usan como decoración, fondo de sección ni acento de marca genérico. Única extensión: en la orden de pago imprimible, el sello **PAGADA** usa la tinta verde y **ANULADA** la roja. Los estados de una orden en pantalla (borrador, emitida, pagada, anulada) no usan tintas de sello: son rótulos a máquina cuyo borde pasa de discontinuo (borrador) a sólido (emitida), a bloque de tinta (pagada) y a tachado (anulada).

**La Regla de la Cartulina a Sangre.** La cartulina inunda regiones completas de borde a borde; las zonas se distinguen por cambio de tono de cartulina (`cartulina` → `cara` → `cartulina-honda`) y filetes de tinta, no por tarjetas sueltas sobre blanco.

## Typography

**Display Font:** Archivo (con Arial Narrow, Arial), eje de ancho 62–125
**Body Font:** Public Sans (con Segoe UI, Arial)
**Label/Mono Font:** Courier Prime (con Courier New) para valores escritos

**Character:** Archivo hace de tipo de imprenta: aplastado y pesado en los titulares, ensanchado y espaciado en los rótulos del formulario. Courier Prime es la máquina de escribir que rellena el carné; Public Sans lee el resto sin hacerse notar.

### Hierarchy
- **Display** (900, ancho 70%, `clamp(3.2rem, 6.4vw + 0.5rem, 6.25rem)`, 0.88, mayúsculas): solo el titular de la primera pantalla.
- **Headline** (900, ancho 72%, `clamp(2.4rem, 4vw + 1rem, 4.25rem)`, 0.92, mayúsculas): titulares de sección (reverso, talonarios).
- **Title** (800, ancho 112–115%, 0.95–1.15rem, tracking 0.08–0.14em, mayúsculas): cabecera del carné, rol de cada talón, título de normas, marca del membrete.
- **Stamp** (900, ancho 85%, 1.6rem; 1.2rem en tablas; hasta 2.4rem sobre el carné, tracking 0.08em, mayúsculas): texto de los sellos.
- **Label** (700, 0.75rem, tracking 0.14em, mayúsculas, `tinta-suave` con número en `tinta`): rótulos de campo numerados y cabeceras de tabla.
- **Action** (700–800, 0.95–1.05rem, tracking 0.06em, mayúsculas): navegación, botones y enlaces de acción.
- **Typed** (Courier Prime 700, 1.1–1.15rem; 1.5rem para el número del día, cifras tabulares): valores de selects, horas, fecha del estado, numeración de normas.
- **Body-lead** (400, `clamp(1.1rem, 0.6vw + 0.95rem, 1.35rem)`, 1.45, máx. 30ch): subtítulo de portada.
- **Body** (400, 1rem, 1.55): lectura general; párrafos de sección hasta 52ch.
- **Body-small** (0.8125–0.875rem): notas, ayudas, normas, leyendas, pie; ayudas hasta 44ch.

### Named Rules
**La Regla de la Máquina de Escribir.** Todo valor que el carné "rellena" (especialidad, médico, día, hora, fecha resultante) va en Courier Prime con cifras tabulares. Los rótulos impresos que lo enmarcan van en Archivo. Nunca al revés.

**La Regla del Ancho Extremo.** Archivo se usa en los extremos de su eje: condensado (70–85%) para titulares y sellos, expandido (105–115%) para rótulos y marca. El ancho medio por defecto queda para enlaces y acciones.

## Layout

Contenedor de `84rem` centrado con margen lateral fluido `clamp(1rem, 4vw, 4rem)`; las bandas de color (membrete, reverso, talonarios, pie) van a sangre y solo su interior se limita. Las secciones respiran con `clamp(3rem, 7vw, 6rem)` en vertical.

- **Portada** (≥64rem): rejilla asimétrica `0.8fr / 1.2fr`; el texto queda fijo (`sticky`, top 2rem) mientras el carné ocupa la columna ancha. Bajo 64rem, una sola columna con el texto encima.
- **Carné**: rejilla de dos columnas para los campos 01 y 02 (separadas por filete vertical); 03, 04, 05 y la acción ocupan el ancho completo. Bajo 40rem, una columna.
- **Casillas**: días en 6 columnas (3 bajo 40rem); horas en `repeat(auto-fill, minmax(5.5rem, 1fr))`; separación de `0.5rem`.
- **Reverso** (≥64rem): `1.15fr / 0.85fr`, registro de estados a la izquierda y normas a la derecha; normas a dos columnas con regla central, una columna bajo 40rem.
- **Talonarios**: 4 columnas, 2 bajo 60rem, 1 bajo 40rem; la perforación cambia de vertical a horizontal al apilarse.
- **Registro** (tabla): bajo 40rem cada fila pasa a rejilla `auto / 1fr` y la cabecera se oculta visualmente.
- **Puntos de corte**: 40rem, 60rem, 64rem.

## Elevation & Depth

El sistema es plano y se ordena con tono de cartulina y filetes de tinta. Solo el carné se levanta del fondo, como una tarjeta física apoyada sobre la mesa; el botón principal tiene una sombra mínima de pieza impresa, y el menú móvil desplegado flota sobre el contenido.

### Shadow Vocabulary
- **Carné apoyado** (`box-shadow: 0 2px 4px rgba(20, 24, 31, 0.1), 0 24px 48px -16px rgba(20, 24, 31, 0.35)`): exclusivo del carné interactivo.
- **Botón de tinta** (`box-shadow: 0 2px 4px rgba(20, 24, 31, 0.25)`): botón principal en reposo; desaparece al deshabilitarse.
- **Menú desplegado** (`box-shadow: 0 10px 24px rgba(20, 24, 31, 0.18)`): panel de navegación móvil abierto.

### Named Rules
**La Regla del Único Objeto.** Solo el carné proyecta sombra amplia. Reverso, normas, talonarios y casillas se separan con filetes y cambios de cartulina, nunca con sombra.

## Shapes

Esquinas suavemente redondeadas de pieza troquelada, crecientes con el tamaño del objeto: muestra de leyenda 3px, casillas, sellos, logo y enlaces de navegación 6px, botón y menú 8px, normas 10px, talonarios 12px, carné 14px. Los bordes son de tinta sólida: 2px para contornos de objeto y divisiones mayores, 1.5px para casillas y campos, 1px para filas tenues. Los selects no tienen caja: son un renglón con borde inferior discontinuo y radio 0.

Formas recurrentes del mundo:
- **Perforación**: borde discontinuo de 2px en `linea` entre el cuerpo del carné y su talón de acción, y entre talonarios.
- **Tachado a mano**: rayado diagonal a 135° (`linea-tenue` cada 7–8.5px) más texto tachado para casillas ocupadas o pasadas.
- **Sello**: doble borde de 4px en el color de la tinta, girado −7° (−4° en tablas), con máscara de tinta irregular (`assets/img/tinta-sello.svg`) desplazada por estado para que ningún sello salga idéntico.
- **Logo**: cuadrado de 6px de radio en `sello-cancelada` con cruz blanca construida en CSS.

## Components

### Buttons
Contundentes y de imprenta: bloque de tinta con rótulo en mayúsculas.
- **Shape:** esquinas suaves (8px), borde de 2px del mismo color del fondo.
- **Primary (`boton-tinta`):** fondo `tinta`, texto blanco, Archivo 800 al 105% de ancho, 1.05rem, tracking 0.06em, padding `1rem 1.6rem`. Ancho completo bajo 40rem.
- **Hover / Focus:** el fondo y el borde pasan a `sello-pendiente` (150ms); al pulsar baja 1px. Foco: contorno de 3px `sello-pendiente` separado 3px.
- **Disabled:** fondo transparente, texto `tinta-suave`, borde `linea-tenue`, sin sombra.

### Chips (casillas de agenda)
Las casillas son el componente central: botones con `aria-pressed`.
- **Día:** fondo `papel`, borde 1.5px `tinta`, 6px; día de la semana y mes en Archivo 0.75rem mayúsculas, número en Courier Prime 1.5rem. Hover a blanco; elegido en `tinta` con texto blanco.
- **Hora libre:** fondo blanco, borde 1.5px `tinta`, Courier Prime 700 1.1rem. Hover a `cartulina`; elegida en `sello-pendiente` con texto blanco.
- **Hora tomada o pasada:** rayado diagonal sobre `cara`, borde `linea-tenue`, texto `tinta-suave` tachado, deshabilitada.
- Transiciones de color de 120ms; una leyenda con muestras (libre / ocupada) acompaña la rejilla de horas.

### Cards / Containers
- **Carné:** fondo `cara`, borde 2px `tinta`, radio 14px, sombra "carné apoyado". Cabecera con título en Archivo expandido y nota pequeña; campos numerados separados por filetes de 1.5px; el estado cierra con perforación antes de la acción.
- **Normas:** fondo `cara`, borde 2px, radio 10px, padding 1.5rem; letra pequeña numerada en Courier Prime a dos columnas con regla tenue.
- **Talonarios:** una sola tira de fondo `cara`, borde 2px, radio 12px; cada talón con padding 1.5rem separado del siguiente por perforación.
- **Registro:** tabla sin caja, con filete superior de 2px, cabecera en estilo Label y filas separadas por `linea-tenue`.

### Inputs / Fields
- **Campo numerado:** rótulo en estilo Label con el número (`01`…`05`) en `tinta` y el nombre en `tinta-suave`.
- **Select como renglón:** sin caja ni fondo, Courier Prime 700 1.15rem, borde inferior discontinuo 1.5px `linea-tenue`, chevron SVG en `tinta` a la derecha. Hover: el renglón pasa a `tinta`. Disabled: texto `tinta-suave`, cursor no permitido.
- **Error:** aviso en `sello-cancelada` 600 dentro del carné (`role="alert"`).

### Navigation
- **Membrete:** franja sobre la cartulina cerrada por filete inferior de 2px `tinta`; marca en Archivo 800 expandido, mayúsculas, con el logo de la cruz.
- **Enlaces:** Archivo 700 0.95rem mayúsculas, padding `0.5rem 0.9rem`, borde transparente de 1.5px que aparece en `tinta` al pasar, radio 6px.
- **Destacado** (registro): bloque de `tinta` con texto blanco; hover a `sello-pendiente`.
- **Móvil (<40rem):** botón "Menú" con borde de tinta; el panel se despliega en `papel` con borde 2px, radio 8px y sombra de menú.

### Sello de goma (componente firma)
El sello comunica el estado de una cita. Archivo 900 condensado al 85%, mayúsculas, doble borde de 4px en `currentColor`, radio 6px, rotación −7°, máscara de tinta irregular con posición distinta por estado. Variantes: `pendiente`, `confirmada`, `atendida`, `cancelada`, y `fijo` (1.2rem, −4°) para tablas y listados. Sobre el carné cae una sola vez: animación `golpe-sello` de 140ms (`cubic-bezier(0.5, 0, 0.75, 0)`, escala 1.25 → 0.98 → 1), reiniciada con cada elección de hora y desactivada con `prefers-reduced-motion`. Es decorativo (`aria-hidden`); el estado se anuncia en texto con `aria-live`.

## Do's and Don'ts

### Do:
- **Do** tomar tokens y componentes de este documento para toda pantalla nueva o rediseñada.
- **Do** expresar cada estado de cita con su sello y su tinta: pendiente violeta, confirmada verde, atendida azul, cancelada roja.
- **Do** escribir los valores del carné (fechas, horas, selecciones) en Courier Prime con cifras tabulares, y sus rótulos en Archivo mayúsculas con tracking 0.14em.
- **Do** dividir el espacio con filetes de tinta (1.5–2px), perforaciones discontinuas y cambios de cartulina antes que con tarjetas o sombras.
- **Do** numerar los campos de un formulario de citas en orden fijo (01, 02, 03…) cuando el orden importa.
- **Do** marcar lo no disponible con el tachado diagonal y deshabilitarlo, en lugar de ocultarlo.
- **Do** mantener el foco visible: contorno de 3px `sello-pendiente` con separación de 3px (blanco sobre el pie).

### Don't:
- **Don't** usar las tintas de sello como decoración, fondos de sección o acentos sin significado de estado.
- **Don't** animar el sello con fundidos ni repetir la animación en sellos de tablas; el golpe ocurre una sola vez y solo al elegir.
- **Don't** volver a la paleta anterior (pino, salvia, siena sobre hueso) ni a Newsreader o IBM Plex Sans; los alias `--color-*` de `variables.css` existen solo por compatibilidad.
- **Don't** usar los alias antiguos en código nuevo: usa `--tinta`, `--cartulina`, `--cara`, `--sello-*`.
- **Don't** dar sombra amplia a nada que no sea el carné.
- **Don't** poner valores rellenados en Public Sans ni rótulos impresos en Courier Prime.
- **Don't** inventar datos de la clínica para poblar el carné o los talonarios; los datos de demostración deben leerse como ejemplo.
