/*
 * navegacion.js
 * Comportamiento del menú de navegación (sin lógica de datos):
 *   - Muestra/oculta el menú en pantallas angostas.
 *   - Marca con aria-current="page" el enlace de la página actual.
 */

document.addEventListener("DOMContentLoaded", function () {
  var botonMenu = document.querySelector(".nav-toggle");
  var enlacesMenu = document.querySelector(".nav-principal__enlaces");

  if (!botonMenu || !enlacesMenu) {
    return;
  }

  var paginaActual = window.location.pathname.split("/").pop() || "index.html";
  enlacesMenu.querySelectorAll("a").forEach(function (enlace) {
    var destino = enlace.getAttribute("href").split("/").pop();
    if (destino === paginaActual || destino === paginaActual + ".html") {
      enlace.setAttribute("aria-current", "page");
    }
  });

  botonMenu.addEventListener("click", function () {
    var estaAbierto = enlacesMenu.classList.toggle("esta-abierto");
    botonMenu.setAttribute("aria-expanded", estaAbierto ? "true" : "false");
  });
});
