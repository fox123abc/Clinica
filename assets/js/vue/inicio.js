/*
 * inicio.js
 * Carné de citas de la página de inicio con Vue.js. Muestra la agenda real:
 *   - Especialidades y médicos desde GET /api/catalogo.
 *   - Próximos días de atención del médico elegido.
 *   - Horas del día con su estado (GET /api/agenda-publica): libres o tomadas.
 * Al reservar, el horario elegido se guarda (sessionStorage) y se continúa en
 * el formulario de solicitud; si no hay sesión, se pasa antes por el ingreso.
 */

(function () {
  "use strict";

  var A = window.Altavida;
  var DIAS_A_MOSTRAR = 6;
  var SEMANA = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
  var MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

  function aISO(fecha) {
    var copia = new Date(fecha.getTime());
    copia.setMinutes(copia.getMinutes() - copia.getTimezoneOffset());
    return copia.toISOString().slice(0, 10);
  }

  // Próximas fechas (desde hoy) en las que el médico atiende
  function proximosDias(diasSemana) {
    var resultado = [];
    if (!diasSemana || !diasSemana.length) return resultado;
    var fecha = A.fechaLocal(A.fechaHoyISO());
    for (var i = 0; i < 60 && resultado.length < DIAS_A_MOSTRAR; i++) {
      if (diasSemana.indexOf(fecha.getDay()) !== -1) {
        resultado.push({
          iso: aISO(fecha),
          semana: SEMANA[fecha.getDay()],
          numero: fecha.getDate(),
          mes: MESES[fecha.getMonth()]
        });
      }
      fecha.setDate(fecha.getDate() + 1);
    }
    return resultado;
  }

  Vue.createApp({
    data: function () {
      return {
        listo: false,
        errorCarga: "",
        especialidades: [],
        medicos: [],
        especialidadId: "",
        medicoId: "",
        fecha: "",
        horas: [],
        horario: "",
        cargandoHoras: false,
        consulta: 0,
        sello: 0,
        // Al cambiar de médico se salta a su primer día que aún tenga horas libres
        buscarDiaLibre: false
      };
    },
    computed: {
      medicosDeEspecialidad: function () {
        var id = this.especialidadId;
        return this.medicos.filter(function (m) { return m.especialidadId === id; });
      },
      medico: function () {
        return A.buscarPorId(this.medicos, this.medicoId);
      },
      dias: function () {
        return this.medico ? proximosDias(this.medico.dias) : [];
      },
      resumen: function () {
        return A.formatearFecha(this.fecha) + ", " + this.horario;
      }
    },
    watch: {
      especialidadId: function () {
        var primero = this.medicosDeEspecialidad[0];
        this.medicoId = primero ? primero.id : "";
      },
      medicoId: function () {
        this.buscarDiaLibre = true;
        this.fecha = this.dias.length ? this.dias[0].iso : "";
        this.cargarHoras();
      },
      fecha: function () {
        this.cargarHoras();
      }
    },
    mounted: function () {
      var vm = this;
      A.Api.obtenerCatalogo().then(function (catalogo) {
        // Solo se muestran especialidades con médicos que atienden: en las demás no se podría agendar
        vm.especialidades = A.especialidadesAgendables(catalogo);
        // Y solo los médicos que tienen días de atención
        vm.medicos = catalogo.medicos.filter(function (m) { return m.dias.length; });
        if (vm.especialidades.length) vm.especialidadId = vm.especialidades[0].id;
        else vm.errorCarga = "Por ahora no hay especialidades con horarios de atención disponibles.";
      }).catch(function (e) {
        vm.errorCarga = e.mensaje;
      }).finally(function () {
        vm.listo = true;
      });
    },
    methods: {
      cargarHoras: function () {
        var vm = this;
        var consulta = ++this.consulta;
        this.horario = "";
        this.horas = [];
        if (!this.medicoId || !this.fecha) return;
        this.cargandoHoras = true;
        A.Api.agendaPublica(this.medicoId, this.fecha).then(function (horas) {
          if (consulta !== vm.consulta) return;
          vm.horas = horas;
          if (!vm.buscarDiaLibre) return;
          var hayLibre = horas.some(function (h) { return h.libre; });
          var indice = vm.dias.findIndex(function (d) { return d.iso === vm.fecha; });
          if (hayLibre || indice === -1 || indice === vm.dias.length - 1) {
            vm.buscarDiaLibre = false;
          } else {
            vm.fecha = vm.dias[indice + 1].iso; // el watcher de fecha vuelve a consultar
          }
        }).catch(function (e) {
          if (consulta === vm.consulta) vm.errorCarga = e.mensaje;
        }).finally(function () {
          if (consulta === vm.consulta) vm.cargandoHoras = false;
        });
      },
      elegirDia: function (iso) {
        this.buscarDiaLibre = false;
        this.fecha = iso;
      },
      elegir: function (hora) {
        this.horario = hora;
        // Cambia la clave para que el sello vuelva a "caer" con cada elección
        this.sello++;
      },
      reservar: function () {
        if (!this.horario) return;
        A.guardarPreseleccion({
          especialidadId: this.especialidadId,
          medicoId: this.medicoId,
          fecha: this.fecha,
          horario: this.horario
        });
        // Si no hay sesión, la página de solicitud envía al ingreso y, tras ingresar, vuelve aquí
        window.location.href = "html/paciente/solicitud-cita.html";
      }
    }
  }).mount("#app-carne");
})();
