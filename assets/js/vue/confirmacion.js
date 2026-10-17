/*
 * confirmacion.js
 * Muestra el resumen de la cita recién registrada (confirmacion.html?id=<id>),
 * consultándola en la base de datos (GET /api/citas/:id).
 */

(function () {
  "use strict";

  var A = window.Altavida;

  function crearApp(cita) {
    return Vue.createApp({
      data: function () {
        return { cita: cita };
      },
      computed: {
        fechaLegible: function () {
          return A.formatearFecha(this.cita.fecha);
        }
      }
    });
  }

  A.requerirSesion("../login.html").then(function (sesion) {
    A.montarFranjaSesion("#franja-sesion", sesion, "../login.html");
    var id = new URLSearchParams(window.location.search).get("id");
    var cargarCita = id
      ? A.Api.obtenerCita(id).catch(function (e) {
          if (e.estado === 404) return null;
          throw e;
        })
      : Promise.resolve(null);
    return cargarCita.then(function (cita) {
      A.registrarComponentes(crearApp(cita)).mount("#app-confirmacion");
    });
  }).catch(function (e) {
    if (e && e.estado !== 401) A.mostrarErrorDeCarga("#app-confirmacion", e.mensaje);
  });
})();
