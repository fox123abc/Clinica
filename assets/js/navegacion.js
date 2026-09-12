/*
 * navegacion.js
 * Único propósito: mostrar/ocultar el menú de navegación en pantallas
 * angostas. No contiene lógica de datos, validaciones ni comunicación
 * con ningún backend: eso se abordará mediante las etapas posteriores
 * abordadas en las siguientes entregas.
 */

document.addEventListener("DOMContentLoaded", function () {
  var botonMenu = document.querySelector(".nav-toggle");
  var enlacesMenu = document.querySelector(".nav-principal__enlaces");

  if (!botonMenu || !enlacesMenu) {
    return;
  }

  botonMenu.addEventListener("click", function () {
    var estaAbierto = enlacesMenu.classList.toggle("esta-abierto");
    botonMenu.setAttribute("aria-expanded", estaAbierto ? "true" : "false");
  });
});
