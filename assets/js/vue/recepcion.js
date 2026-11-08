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
        aplicar: function (cita, peticion, aviso) {
          var vm = this;
          this.mensaje = "";
          this.errorGeneral = "";
          peticion.then(function (actualizada) {
            cita.estado = actualizada.estado;
            vm.mensaje = aviso;
          }).catch(function (e) {
            vm.errorGeneral = e.mensaje;
          });
        },
        confirmar: function (cita) {
          this.aplicar(cita, A.Api.confirmarCita(cita.id), "La cita de " + cita.paciente + " fue confirmada.");
        },
        cancelar: function (cita) {
          var pregunta = "¿Cancelar la cita de " + cita.paciente + " del " + A.formatearFecha(cita.fecha) + " a las " + cita.horario + "?";
          if (!window.confirm(pregunta)) return;
          this.aplicar(cita, A.Api.cancelarCitaRecepcion(cita.id), "La cita fue cancelada y el horario quedó libre.");
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
