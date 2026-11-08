/*
 * admin.js
 * Administración del catálogo con Vue.js: crear especialidades y médicos, y
 * editar los horarios de atención de cada médico
 * (GET /api/admin/catalogo y rutas /api/admin/...).
 */

(function () {
  "use strict";

  var A = window.Altavida;
  var DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
  var ORDEN_DIAS = [1, 2, 3, 4, 5, 6, 0];
  var HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

  function crearApp(catalogo) {
    return Vue.createApp({
      data: function () {
        return {
          catalogo: catalogo,
          nuevaEspecialidad: "",
          nuevoMedico: { nombre: "", especialidadId: "" },
          errores: {},
          mensaje: "",
          errorGeneral: "",
          enviando: false,
          editando: null,
          filas: [],
          errorEditor: ""
        };
      },
      methods: {
        nombreEspecialidad: function (id) {
          var e = A.buscarPorId(this.catalogo.especialidades, id);
          return e ? e.nombre : "—";
        },
        resumen: function (medico) {
          if (!medico.disponibilidad.length) return "Sin horarios";
          return medico.disponibilidad.map(function (f) {
            return DIAS[f.dia].slice(0, 3) + " " + f.horas.join(", ");
          }).join(" · ");
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
          var errores = A.validar(this.nuevoMedico, {
            nombre: [A.Reglas.obligatorio],
            especialidadId: [A.Reglas.obligatorio]
          });
          if (Object.keys(errores).length) {
            this.errores = { medicoNombre: errores.nombre, medicoEspecialidad: errores.especialidadId };
            return;
          }
          var vm = this;
          this.enviando = true;
          A.Api.crearMedico(this.nuevoMedico).then(function (creado) {
            vm.nuevoMedico = { nombre: "", especialidadId: "" };
            vm.mensaje = "El médico \"" + creado.nombre + "\" fue agregado. Define sus horarios para que los pacientes puedan agendar.";
            return vm.recargar();
          }).catch(function (e) {
            vm.reportar(e, { nombre: "medicoNombre", especialidadId: "medicoEspecialidad" });
          }).finally(function () { vm.enviando = false; });
        },
        editar: function (medico) {
          this.limpiarAvisos();
          this.errorEditor = "";
          this.editando = medico;
          this.filas = ORDEN_DIAS.map(function (dia) {
            var franja = medico.disponibilidad.find(function (f) { return f.dia === dia; });
            return { dia: dia, nombre: DIAS[dia], texto: franja ? franja.horas.join(", ") : "" };
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
          var vm = this;
          var medico = this.editando;
          this.enviando = true;
          A.Api.guardarDisponibilidad(medico.id, franjas).then(function () {
            vm.mensaje = "Los horarios de " + medico.nombre + " fueron actualizados.";
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
