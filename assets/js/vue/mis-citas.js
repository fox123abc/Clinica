/*
 * mis-citas.js
 * Listado de citas del paciente con Vue.js, leídas de la base de datos
 * (GET /api/citas): filtro por estado, cancelación y acceso a reprogramación.
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
          filtroEstado: "todas",
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
        esModificable: function (cita) {
          return cita.estado === "pendiente" || cita.estado === "confirmada";
        },
        cancelar: function (cita) {
          var pregunta = "¿Seguro que deseas cancelar la cita del " + A.formatearFecha(cita.fecha) + " a las " + cita.horario + "?";
          if (!window.confirm(pregunta)) return;
          var vm = this;
          this.mensaje = "";
          this.errorGeneral = "";
          A.Api.cancelarCita(cita.id).then(function (actualizada) {
            cita.estado = actualizada.estado;
            vm.mensaje = "La cita fue cancelada y el horario quedó libre.";
          }).catch(function (e) {
            vm.errorGeneral = e.mensaje;
          });
        }
      }
    });
  }

  A.requerirSesion("../login.html").then(function (sesion) {
    A.montarFranjaSesion("#franja-sesion", sesion, "../login.html");
    return A.Api.listarCitas().then(function (citas) {
      A.registrarComponentes(crearApp(citas)).mount("#app-mis-citas");
    });
  }).catch(function (e) {
    if (e && e.estado !== 401) A.mostrarErrorDeCarga("#app-mis-citas", e.mensaje);
  });
})();
