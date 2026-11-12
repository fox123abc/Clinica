/*
 * panel.js
 * Panel de administración con Vue.js (GET /api/admin/resumen): avisos de lo
 * que impide agendar, citas de hoy y de la semana, citas y órdenes por estado,
 * montos de órdenes y ocupación de cada médico en los próximos 7 días.
 */

(function () {
  "use strict";

  var A = window.Altavida;
  var MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

  function crearApp(resumen) {
    return Vue.createApp({
      data: function () {
        return {
          r: resumen,
          estados: ["pendiente", "confirmada", "atendida", "cancelada"],
          estadosOrden: ["borrador", "emitida", "pagada", "anulada"],
          cargando: false,
          errorGeneral: ""
        };
      },
      computed: {
        hayAvisos: function () {
          var a = this.r.avisos;
          return a.especialidadesSinMedicos.length || a.medicosSinHorario.length || a.pendientesPorConfirmar;
        },
        // Los más ocupados primero: es lo que hay que vigilar
        ocupacionOrdenada: function () {
          var vm = this;
          return this.r.ocupacion.slice().sort(function (a, b) { return vm.porcentaje(b) - vm.porcentaje(a); });
        }
      },
      methods: {
        pesos: A.formatearPesos,
        fechaLarga: A.formatearFecha,
        fechaCorta: function (iso) {
          if (!iso) return "";
          var f = A.fechaLocal(iso);
          return f.getDate() + " " + MESES[f.getMonth()];
        },
        porcentaje: function (m) {
          return m.capacidad ? Math.min(100, Math.round(m.usadas / m.capacidad * 100)) : 0;
        },
        recargar: function () {
          var vm = this;
          this.cargando = true;
          this.errorGeneral = "";
          A.Api.resumenAdmin().then(function (r) { vm.r = r; })
            .catch(function (e) { vm.errorGeneral = e.mensaje; })
            .finally(function () { vm.cargando = false; });
        }
      }
    });
  }

  A.requerirSesion("../login.html", "administrador").then(function (sesion) {
    A.montarFranjaSesion("#franja-sesion", sesion, "../login.html");
    return A.Api.resumenAdmin().then(function (resumen) {
      A.registrarComponentes(crearApp(resumen)).mount("#app-panel");
    });
  }).catch(function (e) {
    if (e && e.estado !== 401) A.mostrarErrorDeCarga("#app-panel", e.mensaje);
  });
})();
