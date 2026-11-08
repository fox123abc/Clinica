/*
 * medico.js
 * Agenda del médico con Vue.js: sus citas próximas (GET /api/medico/agenda),
 * filtro "Hoy" y marcar como atendida una cita confirmada.
 */

(function () {
  "use strict";

  var A = window.Altavida;

  function crearApp(citas, sesion) {
    return Vue.createApp({
      data: function () {
        return {
          citas: citas,
          hoy: A.fechaHoyISO(),
          filtro: "proximas",
          nombreMedico: sesion.nombre,
          mensaje: "",
          errorGeneral: ""
        };
      },
      computed: {
        citasHoy: function () {
          var hoy = this.hoy;
          return this.citas.filter(function (c) { return c.fecha === hoy; }).length;
        },
        citasFiltradas: function () {
          var hoy = this.hoy;
          if (this.filtro === "hoy") return this.citas.filter(function (c) { return c.fecha === hoy; });
          return this.citas;
        }
      },
      methods: {
        formatearFecha: A.formatearFecha,
        atender: function (cita) {
          var vm = this;
          this.mensaje = "";
          this.errorGeneral = "";
          A.Api.atenderCita(cita.id).then(function (actualizada) {
            cita.estado = actualizada.estado;
            vm.mensaje = "La cita de " + cita.paciente + " quedó registrada como atendida.";
          }).catch(function (e) {
            vm.errorGeneral = e.mensaje;
          });
        }
      }
    });
  }

  A.requerirSesion("../login.html", "medico").then(function (sesion) {
    A.montarFranjaSesion("#franja-sesion", sesion, "../login.html");
    return A.Api.agendaMedico().then(function (citas) {
      A.registrarComponentes(crearApp(citas, sesion)).mount("#app-agenda");
    });
  }).catch(function (e) {
    if (e && e.estado !== 401) A.mostrarErrorDeCarga("#app-agenda", e.mensaje);
  });
})();
