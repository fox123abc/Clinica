/*
 * ordenes.js
 * Órdenes de empresas con Vue.js (recepción y administración):
 * listado, nueva orden (con registro de empresa), cotización en borrador,
 * emisión de la orden de pago, registro del pago (el servidor asigna las
 * citas según la capacidad de los médicos) y anulación.
 */

(function () {
  "use strict";

  var A = window.Altavida;
  var ROLES = ["recepcionista", "administrador"];
  var MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  var SEMANA = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

  function empresaVacia() {
    return { nombre: "", nit: "", contacto: "", correo: "", telefono: "" };
  }

  // Muestra en el menú solo los enlaces del rol que inició sesión
  function ajustarMenu(rol) {
    document.querySelectorAll("#menu-principal [data-rol]").forEach(function (li) {
      li.hidden = li.getAttribute("data-rol") !== rol;
    });
  }

  function crearApp(datos) {
    return Vue.createApp({
      data: function () {
        return {
          ordenes: datos.ordenes,
          empresas: datos.empresas,
          especialidades: datos.especialidades,
          orden: null,
          modo: "",
          registrandoEmpresa: false,
          empresaId: "",
          empresa: empresaVacia(),
          nuevoItem: { especialidadId: "", cantidad: 1 },
          cambiandoEmpresa: false,
          empresaNueva: "",
          errores: {},
          mensaje: "",
          errorGeneral: "",
          enviando: false
        };
      },
      computed: {
        // No se ofrece una especialidad que ya está en la orden: se cambia su cantidad
        especialidadesDisponibles: function () {
          var usadas = this.orden ? this.orden.items.map(function (i) { return i.especialidadId; }) : [];
          return this.especialidades.filter(function (e) { return usadas.indexOf(e.id) === -1; });
        }
      },
      mounted: function () {
        var id = new URLSearchParams(window.location.search).get("orden");
        if (id) this.abrir(id);
      },
      methods: {
        pesos: A.formatearPesos,
        numero: function (id) {
          return "N.º " + String(id).padStart(4, "0");
        },
        fechaCorta: function (iso) {
          var f = A.fechaLocal(iso);
          return SEMANA[f.getDay()] + " " + f.getDate() + " " + MESES[f.getMonth()];
        },
        limpiar: function () {
          this.mensaje = "";
          this.errorGeneral = "";
          this.errores = {};
        },
        llevarAlPanel: function () {
          var vm = this;
          // En pantallas angostas el panel queda debajo del listado
          this.$nextTick(function () {
            if (window.matchMedia("(max-width: 60rem)").matches && vm.$refs.panel) {
              vm.$refs.panel.scrollIntoView({ behavior: "smooth", block: "start" });
            }
          });
        },
        recargarListado: function () {
          var vm = this;
          return A.Api.listarOrdenes().then(function (ordenes) { vm.ordenes = ordenes; });
        },
        actualizar: function (orden, aviso) {
          this.orden = orden;
          if (aviso) this.mensaje = aviso;
          history.replaceState(null, "", "?orden=" + orden.id);
          return this.recargarListado();
        },
        fallo: function (e) {
          this.errorGeneral = e.mensaje;
          this.errores = e.campos || {};
        },
        ejecutar: function (peticion, aviso) {
          var vm = this;
          this.limpiar();
          this.enviando = true;
          return peticion().then(function (orden) {
            return vm.actualizar(orden, aviso);
          }).catch(vm.fallo).finally(function () { vm.enviando = false; });
        },

        abrirNueva: function () {
          this.limpiar();
          this.orden = null;
          this.modo = "nueva";
          this.registrandoEmpresa = !this.empresas.length;
          this.empresaId = "";
          this.llevarAlPanel();
        },
        abrir: function (id) {
          var vm = this;
          this.limpiar();
          A.Api.obtenerOrden(id).then(function (orden) {
            vm.modo = "";
            vm.orden = orden;
            vm.nuevoItem = { especialidadId: "", cantidad: 1 };
            vm.cambiandoEmpresa = false;
            history.replaceState(null, "", "?orden=" + orden.id);
            vm.llevarAlPanel();
          }).catch(vm.fallo);
        },

        registrarEmpresa: function () {
          var vm = this;
          this.limpiar();
          this.enviando = true;
          A.Api.crearEmpresa(this.empresa).then(function (creada) {
            vm.empresas.push(creada);
            vm.empresas.sort(function (a, b) { return a.nombre.localeCompare(b.nombre); });
            vm.empresaId = creada.id;
            vm.empresa = empresaVacia();
            vm.registrandoEmpresa = false;
            vm.mensaje = "La empresa " + creada.nombre + " quedó registrada. Ya puedes crear su orden.";
          }).catch(vm.fallo).finally(function () { vm.enviando = false; });
        },
        crearOrden: function () {
          if (!this.empresaId) {
            this.errores = { empresaId: "Selecciona una empresa." };
            return;
          }
          var vm = this;
          this.ejecutar(function () { return A.Api.crearOrden(vm.empresaId); },
            "Orden creada. Agrega las especialidades que pide la empresa.").then(function () { vm.modo = ""; });
        },

        guardarItems: function (items, aviso) {
          var id = this.orden.id;
          return this.ejecutar(function () { return A.Api.guardarItemsOrden(id, items); }, aviso);
        },
        itemsActuales: function () {
          return this.orden.items.map(function (i) { return { especialidadId: i.especialidadId, cantidad: i.cantidad }; });
        },
        agregarItem: function () {
          var cantidad = Number(this.nuevoItem.cantidad);
          if (!this.nuevoItem.especialidadId) return;
          if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > 200) {
            this.errorGeneral = "La cantidad de citas debe ser un número entre 1 y 200.";
            return;
          }
          var items = this.itemsActuales();
          items.push({ especialidadId: this.nuevoItem.especialidadId, cantidad: cantidad });
          var vm = this;
          this.guardarItems(items).then(function () { vm.nuevoItem = { especialidadId: "", cantidad: 1 }; });
        },
        cambiarCantidad: function (item, valor) {
          var cantidad = Number(valor);
          if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > 200) {
            this.errorGeneral = "La cantidad de citas debe ser un número entre 1 y 200.";
            return;
          }
          var items = this.itemsActuales().map(function (i) {
            return i.especialidadId === item.especialidadId ? { especialidadId: i.especialidadId, cantidad: cantidad } : i;
          });
          this.guardarItems(items);
        },
        quitarItem: function (item) {
          var items = this.itemsActuales().filter(function (i) { return i.especialidadId !== item.especialidadId; });
          this.guardarItems(items);
        },

        empezarCambioEmpresa: function () {
          this.limpiar();
          this.empresaNueva = this.orden.empresaId;
          this.cambiandoEmpresa = true;
        },
        guardarEmpresa: function () {
          var id = this.orden.id;
          var empresaId = this.empresaNueva;
          var vm = this;
          if (empresaId === this.orden.empresaId) {
            this.cambiandoEmpresa = false;
            return;
          }
          this.ejecutar(function () { return A.Api.cambiarEmpresaOrden(id, empresaId); },
            "La orden quedó a nombre de la empresa correcta.").then(function () { vm.cambiandoEmpresa = false; });
        },
        // Una orden emitida vuelve a borrador para corregirla; luego se emite otra vez
        reabrir: function () {
          var id = this.orden.id;
          var aviso = "¿Editar esta orden? Volverá a borrador y la orden de pago que ya se envió dejará de valer. " +
            "Cuando termines de corregirla, emítela de nuevo y envía la nueva orden de pago a la empresa.";
          if (!window.confirm(aviso)) return;
          this.ejecutar(function () { return A.Api.reabrirOrden(id); },
            "La orden volvió a borrador. Corrige especialidades, cantidades o empresa y vuelve a emitirla.");
        },
        emitir: function () {
          var id = this.orden.id;
          var total = this.pesos(this.orden.total);
          if (!window.confirm("¿Emitir la orden de pago por " + total + "? Después ya no se podrán cambiar las especialidades ni las cantidades.")) return;
          this.ejecutar(function () { return A.Api.emitirOrden(id); },
            "Orden de pago emitida. Ábrela con «Ver orden de pago» para imprimirla o guardarla en PDF y enviarla a la empresa.");
        },
        pagar: function () {
          var id = this.orden.id;
          if (!window.confirm("¿Confirmas que la empresa pagó la orden? Se asignarán las fechas de todas las citas.")) return;
          var vm = this;
          this.ejecutar(function () { return A.Api.pagarOrden(id); }).then(function () {
            if (vm.orden && vm.orden.estado === "pagada") {
              vm.mensaje = "Pago registrado. Se asignaron " + vm.orden.citas.length + " citas según la capacidad de los médicos.";
            }
          });
        },
        anular: function () {
          var id = this.orden.id;
          if (!window.confirm("¿Anular esta orden? No se podrá recuperar.")) return;
          this.ejecutar(function () { return A.Api.anularOrden(id); }, "La orden fue anulada.");
        }
      }
    });
  }

  A.requerirSesion("../login.html", ROLES).then(function (sesion) {
    ajustarMenu(sesion.rol);
    A.montarFranjaSesion("#franja-sesion", sesion, "../login.html");
    return Promise.all([A.Api.listarOrdenes(), A.Api.listarEmpresas(), A.Api.obtenerCatalogo()]).then(function (r) {
      // Solo especialidades con médicos que atienden: sin ellos no habría cupos para asignar las citas
      A.registrarComponentes(crearApp({ ordenes: r[0], empresas: r[1], especialidades: A.especialidadesAgendables(r[2]) })).mount("#app-ordenes");
    });
  }).catch(function (e) {
    if (e && e.estado !== 401) A.mostrarErrorDeCarga("#app-ordenes", e.mensaje);
  });
})();
