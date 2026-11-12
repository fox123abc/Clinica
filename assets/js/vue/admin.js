/*
 * admin.js
 * Administración del catálogo con Vue.js: crear especialidades y médicos (con
 * su cuenta de acceso), y editar los horarios de atención de cada médico
 * (GET /api/admin/catalogo y rutas /api/admin/...).
 */

(function () {
  "use strict";

  var A = window.Altavida;
  var DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
  var ORDEN_DIAS = [1, 2, 3, 4, 5, 6, 0];
  var HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

  function cuentaVacia() {
    return { correo: "", telefono: "", contrasena: "" };
  }

  function medicoVacio() {
    return { nombre: "", especialidadId: "", conCuenta: true, cuenta: cuentaVacia() };
  }

  // Errores del servidor { correo, telefono, contrasena } -> claves del formulario
  var CAMPOS_CUENTA = { correo: "cuentaCorreo", telefono: "cuentaTelefono", contrasena: "cuentaContrasena" };

  function validarCuenta(cuenta) {
    var errores = A.validar(cuenta, {
      correo: [A.Reglas.obligatorio, A.Reglas.correo],
      telefono: [A.Reglas.obligatorio, A.Reglas.telefono],
      contrasena: [A.Reglas.obligatorio, A.Reglas.contrasena]
    });
    var claves = {};
    Object.keys(errores).forEach(function (c) { claves[CAMPOS_CUENTA[c]] = errores[c]; });
    return claves;
  }

  function crearApp(catalogo) {
    return Vue.createApp({
      data: function () {
        return {
          catalogo: catalogo,
          nuevaEspecialidad: "",
          nuevoMedico: medicoVacio(),
          cuentaPara: null,
          nuevaCuenta: cuentaVacia(),
          erroresCuenta: {},
          errores: {},
          mensaje: "",
          errorGeneral: "",
          enviando: false,
          editando: null,
          filas: [],
          cupos: 4,
          errorEditor: ""
        };
      },
      methods: {
        nombreEspecialidad: function (id) {
          var e = A.buscarPorId(this.catalogo.especialidades, id);
          return e ? e.nombre : "—";
        },
        diaCorto: function (dia) {
          return DIAS[dia].slice(0, 3);
        },
        recargar: function () {
          var vm = this;
          return A.Api.catalogoAdmin().then(function (datos) {
            vm.catalogo = datos;
          });
        },
        reportar: function (e, claveCampo) {
          this.errorGeneral = e.mensaje;
          this.errores = {};
          if (claveCampo) {
            for (var campo in claveCampo) {
              if (e.campos && e.campos[campo]) this.errores[claveCampo[campo]] = e.campos[campo];
            }
          }
        },
        limpiarAvisos: function () {
          this.mensaje = "";
          this.errorGeneral = "";
          this.errores = {};
        },
        crearEspecialidad: function () {
          this.limpiarAvisos();
          if (!this.nuevaEspecialidad) {
            this.errores = { especialidad: "Este campo es obligatorio." };
            return;
          }
          var vm = this;
          this.enviando = true;
          A.Api.crearEspecialidad(this.nuevaEspecialidad).then(function (creada) {
            vm.nuevaEspecialidad = "";
            vm.mensaje = "La especialidad \"" + creada.nombre + "\" fue agregada.";
            return vm.recargar();
          }).catch(function (e) {
            vm.reportar(e, { nombre: "especialidad" });
          }).finally(function () { vm.enviando = false; });
        },
        crearMedico: function () {
          this.limpiarAvisos();
          var medico = this.nuevoMedico;
          var errores = A.validar(medico, {
            nombre: [A.Reglas.obligatorio],
            especialidadId: [A.Reglas.obligatorio]
          });
          var claves = { medicoNombre: errores.nombre, medicoEspecialidad: errores.especialidadId };
          if (medico.conCuenta) Object.assign(claves, validarCuenta(medico.cuenta));
          if (Object.keys(claves).some(function (c) { return claves[c]; })) {
            this.errores = claves;
            return;
          }
          var vm = this;
          this.enviando = true;
          A.Api.crearMedico({
            nombre: medico.nombre,
            especialidadId: medico.especialidadId,
            cuenta: medico.conCuenta ? medico.cuenta : null
          }).then(function (creado) {
            vm.nuevoMedico = medicoVacio();
            vm.mensaje = "El médico \"" + creado.nombre + "\" fue agregado" +
              (creado.cuenta ? " y puede ingresar con " + creado.cuenta : "") +
              ". Define sus horarios para que los pacientes puedan agendar.";
            return vm.recargar();
          }).catch(function (e) {
            vm.reportar(e, Object.assign({ nombre: "medicoNombre", especialidadId: "medicoEspecialidad" }, CAMPOS_CUENTA));
          }).finally(function () { vm.enviando = false; });
        },
        abrirCuenta: function (medico) {
          this.limpiarAvisos();
          this.editando = null;
          this.cuentaPara = medico;
          this.nuevaCuenta = cuentaVacia();
          this.erroresCuenta = {};
          var vm = this;
          this.$nextTick(function () {
            var form = vm.$refs.formCuenta;
            if (!form) return;
            form.scrollIntoView({ behavior: "auto", block: "start" });
            form.querySelector("input").focus({ preventScroll: true });
          });
        },
        cerrarCuenta: function () {
          this.cuentaPara = null;
          this.erroresCuenta = {};
        },
        guardarCuenta: function () {
          this.limpiarAvisos();
          this.erroresCuenta = validarCuenta(this.nuevaCuenta);
          if (Object.keys(this.erroresCuenta).length) return;
          var vm = this;
          var medico = this.cuentaPara;
          this.enviando = true;
          A.Api.crearCuentaMedico(medico.id, this.nuevaCuenta).then(function (r) {
            vm.mensaje = medico.nombre + " ya puede ingresar con " + r.cuenta + ".";
            vm.cuentaPara = null;
            return vm.recargar();
          }).catch(function (e) {
            var claves = {};
            Object.keys(CAMPOS_CUENTA).forEach(function (c) {
              if (e.campos && e.campos[c]) claves[CAMPOS_CUENTA[c]] = e.campos[c];
            });
            vm.erroresCuenta = claves;
            if (!Object.keys(claves).length) vm.errorGeneral = e.mensaje;
          }).finally(function () { vm.enviando = false; });
        },
        editar: function (medico) {
          this.limpiarAvisos();
          this.errorEditor = "";
          this.cuentaPara = null;
          this.editando = medico;
          this.cupos = medico.cupos;
          this.filas = ORDEN_DIAS.map(function (dia) {
            var franja = medico.disponibilidad.find(function (f) { return f.dia === dia; });
            return { dia: dia, nombre: DIAS[dia], texto: franja ? franja.horas.join(", ") : "" };
          });
          // El editor aparece debajo de la tabla: se lleva a la vista y se enfoca el primer día
          var vm = this;
          this.$nextTick(function () {
            var editor = vm.$refs.editor;
            if (!editor) return;
            var suave = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
            editor.scrollIntoView({ behavior: suave ? "smooth" : "auto", block: "start" });
            var primero = editor.querySelector("input");
            if (primero) primero.focus({ preventScroll: true });
          });
        },
        cancelarEdicion: function () {
          this.editando = null;
          this.errorEditor = "";
        },
        guardarHorarios: function () {
          this.errorEditor = "";
          var franjas = [];
          for (var i = 0; i < this.filas.length; i++) {
            var fila = this.filas[i];
            var horas = fila.texto.split(/[,\s]+/).filter(Boolean);
            for (var j = 0; j < horas.length; j++) {
              if (!HORA.test(horas[j])) {
                this.errorEditor = fila.nombre + ": \"" + horas[j] + "\" no es una hora válida (use HH:MM).";
                return;
              }
            }
            if (horas.length) franjas.push({ dia: fila.dia, horas: horas });
          }
          var cupos = Number(this.cupos);
          if (!Number.isInteger(cupos) || cupos < 1 || cupos > 40) {
            this.errorEditor = "Los cupos por día deben ser un número entre 1 y 40.";
            return;
          }
          var vm = this;
          var medico = this.editando;
          this.enviando = true;
          A.Api.guardarDisponibilidad(medico.id, franjas).then(function () {
            return A.Api.guardarCupos(medico.id, cupos);
          }).then(function () {
            vm.mensaje = "Los horarios y los cupos de " + medico.nombre + " fueron actualizados.";
            vm.editando = null;
            return vm.recargar();
          }).catch(function (e) {
            vm.errorEditor = e.mensaje;
          }).finally(function () { vm.enviando = false; });
        }
      }
    });
  }

  A.requerirSesion("../login.html", "administrador").then(function (sesion) {
    A.montarFranjaSesion("#franja-sesion", sesion, "../login.html");
    return A.Api.catalogoAdmin().then(function (catalogo) {
      A.registrarComponentes(crearApp(catalogo)).mount("#app-admin");
    });
  }).catch(function (e) {
    if (e && e.estado !== 401) A.mostrarErrorDeCarga("#app-admin", e.mensaje);
  });
})();
