/*
 * empresas.js
 * Empresas clientes con Vue.js (administración): listado, registro y
 * edición (GET/POST /api/empresas, PUT /api/empresas/:id).
 */

(function () {
  "use strict";

  var A = window.Altavida;

  function vacia() {
    return { nombre: "", nit: "", contacto: "", correo: "", telefono: "" };
  }

  function crearApp(empresas) {
    return Vue.createApp({
      data: function () {
        return {
          empresas: empresas,
          formulario: vacia(),
          editandoId: null,
          errores: {},
          mensaje: "",
          errorGeneral: "",
          enviando: false
        };
      },
      methods: {
        limpiar: function () {
          this.mensaje = "";
          this.errorGeneral = "";
          this.errores = {};
        },
        enfocarFormulario: function () {
          var vm = this;
          this.$nextTick(function () {
            if (window.matchMedia("(max-width: 60rem)").matches && vm.$refs.panel) {
              vm.$refs.panel.scrollIntoView({ behavior: "smooth", block: "start" });
            }
            if (vm.$refs.primerCampo) vm.$refs.primerCampo.focus({ preventScroll: true });
          });
        },
        nueva: function () {
          this.limpiar();
          this.editandoId = null;
          this.formulario = vacia();
          this.enfocarFormulario();
        },
        editar: function (empresa) {
          this.limpiar();
          this.editandoId = empresa.id;
          this.formulario = {
            nombre: empresa.nombre, nit: empresa.nit, contacto: empresa.contacto,
            correo: empresa.correo, telefono: empresa.telefono
          };
          this.enfocarFormulario();
        },
        recargar: function () {
          var vm = this;
          return A.Api.listarEmpresas().then(function (lista) { vm.empresas = lista; });
        },
        guardar: function () {
          var vm = this;
          var editando = this.editandoId;
          this.limpiar();
          this.enviando = true;
          var peticion = editando
            ? A.Api.actualizarEmpresa(editando, this.formulario)
            : A.Api.crearEmpresa(this.formulario);
          peticion.then(function (empresa) {
            vm.mensaje = editando
              ? "Los datos de " + empresa.nombre + " fueron actualizados."
              : "La empresa " + empresa.nombre + " quedó registrada. Ya puedes crearle órdenes.";
            vm.editandoId = null;
            vm.formulario = vacia();
            return vm.recargar();
          }).catch(function (e) {
            vm.errorGeneral = e.mensaje;
            vm.errores = e.campos || {};
          }).finally(function () { vm.enviando = false; });
        }
      }
    });
  }

  A.requerirSesion("../login.html", "administrador").then(function (sesion) {
    A.montarFranjaSesion("#franja-sesion", sesion, "../login.html");
    return A.Api.listarEmpresas().then(function (empresas) {
      A.registrarComponentes(crearApp(empresas)).mount("#app-empresas");
    });
  }).catch(function (e) {
    if (e && e.estado !== 401) A.mostrarErrorDeCarga("#app-empresas", e.mensaje);
  });
})();
