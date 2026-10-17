/*
 * solicitud-cita.js
 * Formulario de solicitud (y reprogramación) de citas con Vue.js:
 *   - Especialidades y médicos se cargan de la base de datos (GET /api/catalogo).
 *   - La fecha solo acepta días de atención del médico y no permite fechas pasadas.
 *   - Los horarios libres se consultan al servidor (GET /api/horarios-disponibles).
 * Para reprogramar se abre con ?reprogramar=<id de la cita>.
 */

(function () {
  "use strict";

  var A = window.Altavida;
  var NOMBRES_DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
  var MAX_MOTIVO = 300;

  function crearApp(sesion, catalogo, cita) {
    return Vue.createApp({
      data: function () {
        return {
          especialidades: catalogo.especialidades,
          medicos: catalogo.medicos,
          hoy: A.fechaHoyISO(),
          maxMotivo: MAX_MOTIVO,
          citaReprogramada: cita,
          formulario: {
            especialidadId: cita ? cita.especialidadId : "",
            medicoId: cita ? cita.medicoId : "",
            fecha: cita ? cita.fecha : "",
            horario: cita ? cita.horario : "",
            motivo: cita ? cita.motivo || "" : ""
          },
          horariosDisponibles: [],
          cargandoHorarios: false,
          consultaHorarios: 0,
          errores: {},
          errorGeneral: "",
          enviando: false
        };
      },

      computed: {
        medicosDisponibles: function () {
          var especialidadId = this.formulario.especialidadId;
          return this.medicos.filter(function (m) { return m.especialidadId === especialidadId; });
        },
        medico: function () {
          return A.buscarPorId(this.medicos, this.formulario.medicoId);
        },
        especialidad: function () {
          return A.buscarPorId(this.especialidades, this.formulario.especialidadId);
        },
        diasAtencionTexto: function () {
          if (!this.medico) return "";
          return this.medico.dias.map(function (d) { return NOMBRES_DIAS[d]; }).join(", ");
        },
        ayudaMedico: function () {
          if (!this.formulario.especialidadId) return "Primero selecciona una especialidad.";
          if (this.medico) return "Atiende los días: " + this.diasAtencionTexto + ".";
          return "Las opciones se limitan según la especialidad seleccionada.";
        },
        fechaLegible: function () {
          return A.formatearFecha(this.formulario.fecha);
        },
        errorFecha: function () {
          var fecha = this.formulario.fecha;
          if (!fecha) return "Este campo es obligatorio.";
          if (fecha < this.hoy) return "No es posible solicitar citas en fechas pasadas.";
          if (this.medico && this.medico.dias.indexOf(A.fechaLocal(fecha).getDay()) === -1) {
            return "El médico no atiende ese día. Días de atención: " + this.diasAtencionTexto + ".";
          }
          return "";
        },
        ayudaHorario: function () {
          if (!this.medico || !this.formulario.fecha) return "Selecciona médico y fecha para ver los horarios libres.";
          if (this.errorFecha) return "";
          if (this.cargandoHorarios) return "Consultando horarios disponibles…";
          if (!this.horariosDisponibles.length) return "No quedan horarios libres para esta fecha. Prueba con otro día.";
          return "Solo se muestran los horarios aún no ocupados para el médico elegido.";
        }
      },

      watch: {
        // Al cambiar una selección se limpian las que dependen de ella
        "formulario.especialidadId": function () {
          this.formulario.medicoId = "";
          this.errores.especialidadId = "";
        },
        "formulario.medicoId": function () {
          this.formulario.horario = "";
          this.errores.medicoId = "";
          this.errores.fecha = this.formulario.fecha ? this.errorFecha : "";
          this.cargarHorarios();
        },
        "formulario.fecha": function () {
          this.errores.fecha = this.formulario.fecha ? this.errorFecha : "";
          this.cargarHorarios();
        },
        "formulario.horario": function () {
          this.errores.horario = "";
        }
      },

      mounted: function () {
        this.cargarHorarios();
      },

      methods: {
        cargarHorarios: function () {
          var vm = this;
          // Contador para descartar respuestas viejas si el usuario cambia rápido de fecha
          var consulta = ++this.consultaHorarios;
          if (!this.medico || this.errorFecha) {
            this.horariosDisponibles = [];
            return Promise.resolve();
          }
          this.cargandoHorarios = true;
          return A.Api.horariosDisponibles(
            this.medico.id, this.formulario.fecha, this.citaReprogramada ? this.citaReprogramada.id : null
          ).then(function (horas) {
            if (consulta !== vm.consultaHorarios) return;
            vm.horariosDisponibles = horas;
            if (horas.indexOf(vm.formulario.horario) === -1) vm.formulario.horario = "";
          }).catch(function (e) {
            if (consulta === vm.consultaHorarios) vm.errorGeneral = e.mensaje;
          }).finally(function () {
            if (consulta === vm.consultaHorarios) vm.cargandoHorarios = false;
          });
        },
        validarFormulario: function () {
          var errores = A.validar(this.formulario, {
            especialidadId: [A.Reglas.obligatorio],
            medicoId: [A.Reglas.obligatorio],
            horario: [A.Reglas.obligatorio]
          });
          if (this.errorFecha) errores.fecha = this.errorFecha;
          this.errores = errores;
          return !Object.keys(errores).length;
        },
        enviar: function () {
          this.errorGeneral = "";
          if (!this.validarFormulario()) return;

          var vm = this;
          var datos = {
            especialidadId: this.formulario.especialidadId,
            medicoId: this.formulario.medicoId,
            fecha: this.formulario.fecha,
            horario: this.formulario.horario,
            motivo: this.formulario.motivo.trim()
          };
          var peticion = this.citaReprogramada
            ? A.Api.reprogramarCita(this.citaReprogramada.id, datos)
            : A.Api.crearCita(datos);

          this.enviando = true;
          peticion.then(function (citaGuardada) {
            window.location.href = "confirmacion.html?id=" + encodeURIComponent(citaGuardada.id);
          }).catch(function (e) {
            vm.errorGeneral = e.mensaje;
            vm.errores = Object.assign({}, vm.errores, e.campos);
            vm.enviando = false;
            // Si el horario fue tomado por otra persona, se refresca la lista
            if (e.campos && e.campos.horario) vm.cargarHorarios();
          });
        }
      }
    });
  }

  // Si viene ?reprogramar=id, se carga la cita (solo si aún se puede modificar)
  function cargarCitaAReprogramar() {
    var id = new URLSearchParams(window.location.search).get("reprogramar");
    if (!id) return Promise.resolve(null);
    return A.Api.obtenerCita(id)
      .then(function (cita) {
        return cita.estado === "pendiente" || cita.estado === "confirmada" ? cita : null;
      })
      .catch(function () { return null; });
  }

  A.requerirSesion("../login.html").then(function (sesion) {
    A.montarFranjaSesion("#franja-sesion", sesion, "../login.html");
    return Promise.all([A.Api.obtenerCatalogo(), cargarCitaAReprogramar()]).then(function (resultados) {
      A.registrarComponentes(crearApp(sesion, resultados[0], resultados[1])).mount("#app-solicitud");
    });
  }).catch(function (e) {
    if (e && e.estado !== 401) A.mostrarErrorDeCarga("#app-solicitud", e.mensaje);
  });
})();
