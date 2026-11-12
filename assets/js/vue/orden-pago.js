/*
 * orden-pago.js
 * Documento imprimible de la orden de pago de una empresa (GET /api/ordenes/:id).
 * Recepción o administración lo imprime o lo guarda en PDF para enviarlo.
 */

(function () {
  "use strict";

  var A = window.Altavida;
  var id = new URLSearchParams(window.location.search).get("id");

  function montar(orden, error) {
    Vue.createApp({
      data: function () {
        return { orden: orden, error: error };
      },
      computed: {
        numero: function () {
          return "N.º " + String(this.orden.id).padStart(4, "0");
        }
      },
      methods: {
        pesos: A.formatearPesos,
        // "2026-11-12 10:30:00" -> "jueves, 12 de noviembre de 2026"
        fecha: function (fechaHora) {
          return fechaHora ? A.formatearFecha(fechaHora.slice(0, 10)) : "—";
        },
        imprimir: function () {
          window.print();
        }
      },
      mounted: function () {
        if (this.orden) document.title = "Orden de pago " + this.numero + " | Clínica Altavida";
      }
    }).mount("#app-orden-pago");
  }

  A.requerirSesion("../login.html", ["recepcionista", "administrador"]).then(function () {
    if (!id) return montar(null, "Falta el número de la orden.");
    return A.Api.obtenerOrden(id).then(function (orden) {
      if (orden.estado === "borrador") return montar(null, "Esta orden aún está en borrador: emítela primero para generar la orden de pago.");
      montar(orden, "");
    });
  }).catch(function (e) {
    if (e && e.estado !== 401) montar(null, e.mensaje);
  });
})();
