/*
 * login.js
 * Formulario de inicio de sesión con Vue.js: validación de campos y
 * verificación de credenciales contra la base de datos (POST /api/login).
 */

(function () {
  "use strict";

  var A = window.Altavida;

  var esquema = {
    correo: [A.Reglas.obligatorio, A.Reglas.correo],
    contrasena: [A.Reglas.obligatorio]
  };

  var app = Vue.createApp({
    data: function () {
      var parametros = new URLSearchParams(window.location.search);
      return {
        formulario: { correo: parametros.get("correo") || "", contrasena: "" },
        errores: {},
        errorGeneral: "",
        mensajeExito: parametros.get("registro") === "ok" ? "Tu cuenta fue creada. Ya puedes ingresar." : "",
        verContrasena: false,
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
      // Rellena el formulario con el usuario de demostración (servidor/bd.js)
      usarUsuarioPrueba: function () {
        this.formulario.correo = "paciente@altavida.com";
        this.formulario.contrasena = "Altavida2026";
        this.errores = {};
      },
      validarCampo: function (campo) {
        var parcial = {};
        parcial[campo] = esquema[campo];
        var resultado = A.validar(this.formulario, parcial);
        this.errores[campo] = resultado[campo] || "";
      },
      enviar: function () {
        this.errorGeneral = "";
        this.errores = A.validar(this.formulario, esquema);
        if (Object.keys(this.errores).length) return;

        this.enviando = true;
        var vm = this;
        A.Api.iniciarSesion(this.formulario.correo, this.formulario.contrasena)
          .then(function () {
            window.location.href = "paciente/mis-citas.html";
          })
          .catch(function (e) {
            vm.errorGeneral = e.mensaje;
            vm.enviando = false;
          });
      }
    }
  });

  A.registrarComponentes(app).mount("#app-login");
})();
