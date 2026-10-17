/*
 * comun.js
 * Piezas compartidas por todas las páginas que usan Vue.js:
 *   1. Cliente de la API REST del servidor local (servidor/servidor.js),
 *      que guarda usuarios, sesiones y citas en una base de datos SQLite.
 *   2. (El catálogo de especialidades y médicos ahora viene de la API.)
 *   3. Reglas de validación reutilizables.
 *   4. Componentes Vue reutilizables (campo de formulario, etiqueta de estado
 *      y franja de sesión).
 *
 * Requiere que vue.global.prod.js se cargue antes que este archivo.
 */

(function () {
  "use strict";

  /* ------------------------------------------------------------------
   * 1. Cliente de la API (servidor Express + base de datos SQLite)
   * Todas las peticiones devuelven una promesa. Si el servidor responde
   * con error, se lanza un objeto { estado, mensaje, campos }.
   * ------------------------------------------------------------------ */
  function api(metodo, ruta, cuerpo) {
    var opciones = { method: metodo, headers: {}, credentials: "same-origin" };
    if (cuerpo !== undefined) {
      opciones.headers["Content-Type"] = "application/json";
      opciones.body = JSON.stringify(cuerpo);
    }
    return fetch("/api" + ruta, opciones)
      .catch(function () {
        throw { estado: 0, mensaje: "No hay conexión con el servidor. Verifica que esté iniciado (npm start).", campos: {} };
      })
      .then(function (respuesta) {
        if (respuesta.status === 204) return null;
        // Si la respuesta no es JSON, la página no se abrió desde el servidor de la clínica
        // (por ejemplo, con Live Server), que es el único que tiene la API.
        var tipo = respuesta.headers.get("Content-Type") || "";
        if (tipo.indexOf("application/json") === -1) {
          throw {
            estado: respuesta.status,
            mensaje: "Esta página no está conectada al servidor de la clínica. Ejecuta \"npm start\" y ábrela desde http://localhost:3000",
            campos: {}
          };
        }
        return respuesta.json().catch(function () { return {}; }).then(function (datos) {
          if (!respuesta.ok) {
            throw { estado: respuesta.status, mensaje: datos.error || "Ocurrió un error.", campos: datos.campos || {} };
          }
          return datos;
        });
      });
  }

  var Api = {
    registrar: function (datos) { return api("POST", "/registro", datos); },
    iniciarSesion: function (correo, contrasena) { return api("POST", "/login", { correo: correo, contrasena: contrasena }); },
    cerrarSesion: function () { return api("POST", "/logout"); },
    obtenerSesion: function () { return api("GET", "/sesion"); },
    obtenerCatalogo: function () { return api("GET", "/catalogo"); },
    horariosDisponibles: function (medicoId, fecha, excluirCitaId) {
      var consulta = "?medicoId=" + encodeURIComponent(medicoId) + "&fecha=" + encodeURIComponent(fecha) +
        (excluirCitaId ? "&excluir=" + encodeURIComponent(excluirCitaId) : "");
      return api("GET", "/horarios-disponibles" + consulta);
    },
    listarCitas: function () { return api("GET", "/citas"); },
    obtenerCita: function (id) { return api("GET", "/citas/" + encodeURIComponent(id)); },
    crearCita: function (datos) { return api("POST", "/citas", datos); },
    reprogramarCita: function (id, datos) { return api("PUT", "/citas/" + encodeURIComponent(id), datos); },
    cancelarCita: function (id) { return api("PATCH", "/citas/" + encodeURIComponent(id) + "/cancelar"); }
  };

  var ESTADOS = ["pendiente", "confirmada", "cancelada", "atendida"];

  function buscarPorId(lista, id) {
    return lista.find(function (elemento) { return elemento.id === id; }) || null;
  }

  /* ------------------------------------------------------------------
   * 3. Validaciones reutilizables
   * Cada regla recibe el valor y devuelve un mensaje de error o "".
   * ------------------------------------------------------------------ */
  var Reglas = {
    obligatorio: function (valor) {
      return String(valor == null ? "" : valor).trim() ? "" : "Este campo es obligatorio.";
    },
    correo: function (valor) {
      return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(valor).trim()) ? "" : "Ingresa un correo electrónico válido.";
    },
    telefono: function (valor) {
      var digitos = String(valor).replace(/\D/g, "");
      return digitos.length >= 7 && digitos.length <= 15 ? "" : "Ingresa un teléfono válido (7 a 15 dígitos).";
    },
    contrasena: function (valor) {
      return String(valor).length >= 8 ? "" : "La contraseña debe tener al menos 8 caracteres.";
    },
    nombre: function (valor) {
      return String(valor).trim().length >= 3 ? "" : "Ingresa tu nombre completo.";
    }
  };

  // Aplica las reglas de cada campo y devuelve { campo: "mensaje" } solo con los errores
  function validar(datos, esquema) {
    var errores = {};
    Object.keys(esquema).forEach(function (campo) {
      for (var i = 0; i < esquema[campo].length; i++) {
        var mensaje = esquema[campo][i](datos[campo], datos);
        if (mensaje) {
          errores[campo] = mensaje;
          break;
        }
      }
    });
    return errores;
  }

  /* ------------------------------------------------------------------
   * Utilidades de fecha
   * ------------------------------------------------------------------ */
  function fechaHoyISO() {
    var hoy = new Date();
    hoy.setMinutes(hoy.getMinutes() - hoy.getTimezoneOffset());
    return hoy.toISOString().slice(0, 10);
  }

  // "2026-10-17" -> Date local (evita el desfase de zona horaria de new Date("2026-10-17"))
  function fechaLocal(iso) {
    var partes = iso.split("-").map(Number);
    return new Date(partes[0], partes[1] - 1, partes[2]);
  }

  function formatearFecha(iso) {
    if (!iso) return "";
    return fechaLocal(iso).toLocaleDateString("es-CO", {
      weekday: "long", year: "numeric", month: "long", day: "numeric"
    });
  }

  /* ------------------------------------------------------------------
   * 4. Componentes Vue reutilizables
   * ------------------------------------------------------------------ */

  // Envuelve label + control + ayuda + mensaje de error con las clases del proyecto
  var CampoFormulario = {
    props: {
      id: { type: String, required: true },
      etiqueta: { type: String, required: true },
      obligatorio: { type: Boolean, default: false },
      error: { type: String, default: "" },
      ayuda: { type: String, default: "" }
    },
    template:
      '<div class="campo" :class="{ \'campo--obligatorio\': obligatorio, \'campo--error\': error }">' +
      '  <label :for="id" :id="id + \'-etiqueta\'">{{ etiqueta }}</label>' +
      '  <slot></slot>' +
      '  <p v-if="error" class="campo__error" :id="id + \'-error\'" role="alert">{{ error }}</p>' +
      '  <p v-else-if="ayuda" class="campo__ayuda">{{ ayuda }}</p>' +
      '</div>'
  };

  var EtiquetaEstado = {
    props: { estado: { type: String, required: true } },
    computed: {
      texto: function () {
        return this.estado.charAt(0).toUpperCase() + this.estado.slice(1);
      }
    },
    template: '<span class="etiqueta-estado" :class="\'etiqueta-estado--\' + estado">{{ texto }}</span>'
  };

  function registrarComponentes(app) {
    app.component("campo-formulario", CampoFormulario);
    app.component("etiqueta-estado", EtiquetaEstado);
    return app;
  }

  /*
   * Protege las páginas del área de paciente: consulta la sesión al
   * servidor y, si no hay una activa, redirige al inicio de sesión.
   * Devuelve una promesa con los datos del usuario.
   */
  function requerirSesion(rutaLogin) {
    return Api.obtenerSesion().catch(function (e) {
      if (e.estado === 401) window.location.replace(rutaLogin);
      throw e;
    });
  }

  // Monta la franja superior "Sesión iniciada como: ..." en las páginas privadas
  function montarFranjaSesion(selector, sesion, rutaLogin) {
    Vue.createApp({
      data: function () {
        return { nombre: sesion.nombre };
      },
      computed: {
        inicial: function () {
          return (this.nombre || "?").trim().charAt(0).toUpperCase();
        }
      },
      methods: {
        salir: function () {
          Api.cerrarSesion().finally(function () {
            window.location.href = rutaLogin;
          });
        }
      }
    }).mount(selector);
  }

  // Si la página no pudo cargar sus datos (p. ej. servidor apagado), muestra el motivo
  function mostrarErrorDeCarga(selector, mensaje) {
    var contenedor = document.querySelector(selector);
    if (!contenedor) return;
    var aviso = document.createElement("p");
    aviso.className = "aviso aviso--error";
    aviso.setAttribute("role", "alert");
    aviso.textContent = mensaje || "No fue posible cargar la información.";
    contenedor.innerHTML = "";
    contenedor.appendChild(aviso);
    contenedor.removeAttribute("v-cloak");
  }

  window.Altavida = {
    mostrarErrorDeCarga: mostrarErrorDeCarga,
    Api: Api,
    ESTADOS: ESTADOS,
    buscarPorId: buscarPorId,
    Reglas: Reglas,
    validar: validar,
    fechaHoyISO: fechaHoyISO,
    fechaLocal: fechaLocal,
    formatearFecha: formatearFecha,
    registrarComponentes: registrarComponentes,
    requerirSesion: requerirSesion,
    montarFranjaSesion: montarFranjaSesion
  };
})();
