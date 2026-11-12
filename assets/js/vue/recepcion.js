/*
 * recepcion.js
 * Gestión de citas para la recepcionista con Vue.js: lista las citas de todos
 * los pacientes (GET /api/recepcion/citas), filtra por estado, confirma las
 * pendientes y cancela las que siguen activas.
 */

(function () {
  "use strict";

  var A = window.Altavida;

  function crearApp(citas) {
    return Vue.createApp({
      data: function () {
        return {
          citas: citas,
          estados: A.ESTADOS,
          filtroEstado: "pendiente",
          procesando: null,
          mensaje: "",
          errorGeneral: ""
        };
      },
      computed: {
        citasFiltradas: function () {
          var filtro = this.filtroEstado;
          if (filtro === "todas") return this.citas;
          return this.citas.filter(function (c) { return c.estado === filtro; });
        }
      },
      methods: {
        formatearFecha: A.formatearFecha,
        capitalizar: function (texto) {
          return texto.charAt(0).toUpperCase() + texto.slice(1);
        },
        contarPorEstado: function (estado) {
          return this.citas.filter(function (c) { return c.estado === estado; }).length;
        },
        // Envía la acción una sola vez: los botones de la fila quedan deshabilitados hasta la respuesta
        aplicar: function (cita, enviar, aviso) {
          if (this.procesando) return;
          var vm = this;
          this.mensaje = "";
          this.errorGeneral = "";
          this.procesando = cita.id;
          enviar().then(function (actualizada) {
            cita.estado = actualizada.estado;
            vm.mensaje = aviso;
          }).catch(function (e) {
            vm.errorGeneral = e.mensaje;
          }).finally(function () {
            vm.procesando = null;
          });
        },
        confirmar: function (cita) {
          this.aplicar(cita, function () { return A.Api.confirmarCita(cita.id); },
            "La cita de " + cita.paciente + " fue confirmada.");
        },
        cancelar: function (cita) {
          var pregunta = "¿Cancelar la cita de " + cita.paciente + " del " + A.formatearFecha(cita.fecha) + " a las " + cita.horario + "?";
          if (!window.confirm(pregunta)) return;
          this.aplicar(cita, function () { return A.Api.cancelarCitaRecepcion(cita.id); },
            "La cita de " + cita.paciente + " fue cancelada y el horario quedó libre.");
        }
      }
    });
  }

  A.requerirSesion("../login.html", "recepcionista").then(function (sesion) {
    A.montarFranjaSesion("#franja-sesion", sesion, "../login.html");
    return A.Api.recepcionCitas().then(function (citas) {
      A.registrarComponentes(crearApp(citas)).mount("#app-recepcion");
    });
  }).catch(function (e) {
    if (e && e.estado !== 401) A.mostrarErrorDeCarga("#app-recepcion", e.mensaje);
  });
})();
