/*
 * registro.js
 * Formulario de registro de paciente con Vue.js: validación por campo
 * (al salir del campo y al enviar) y creación de la cuenta en la base de
 * datos (POST /api/registro).
 */

(function () {
  "use strict";

  var A = window.Altavida;

  function coincideContrasena(valor, datos) {
    return valor === datos.contrasena ? "" : "Las contraseñas no coinciden.";
  }

  var esquema = {
    nombre: [A.Reglas.obligatorio, A.Reglas.nombre],
    correo: [A.Reglas.obligatorio, A.Reglas.correo],
    telefono: [A.Reglas.obligatorio, A.Reglas.telefono],
    contrasena: [A.Reglas.obligatorio, A.Reglas.contrasena],
    confirmar: [A.Reglas.obligatorio, coincideContrasena]
  };

  var app = Vue.createApp({
    data: function () {
      return {
        formulario: { nombre: "", correo: "", telefono: "", contrasena: "", confirmar: "" },
        errores: {},
        errorGeneral: "",
        enviando: false
      };
    },
    watch: {
      // Si un campo ya muestra un error, se revalida mientras el usuario escribe
      formulario: {
        deep: true,
        handler: function () {
          Object.keys(this.errores).forEach(function (campo) {
            if (this.errores[campo]) this.validarCampo(campo);
          }, this);
        }
      }
    },
    methods: {
      validarCampo: function (campo) {
        var parcial = {};
        parcial[campo] = esquema[campo];
        this.errores[campo] = A.validar(this.formulario, parcial)[campo] || "";
      },
      enviar: function () {
        this.errorGeneral = "";
        this.errores = A.validar(this.formulario, esquema);
        if (Object.keys(this.errores).length) return;

        this.enviando = true;
        var vm = this;
        A.Api.registrar(this.formulario)
          .then(function (usuario) {
            window.location.href = "login.html?registro=ok&correo=" + encodeURIComponent(usuario.correo);
          })
          .catch(function (e) {
            vm.errorGeneral = e.mensaje;
            vm.errores = Object.assign({}, vm.errores, e.campos);
            vm.enviando = false;
          });
      }
    }
  });

  A.registrarComponentes(app).mount("#app-registro");
})();
