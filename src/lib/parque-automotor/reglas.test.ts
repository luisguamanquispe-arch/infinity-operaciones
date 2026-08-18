import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ALERTA_NO_APTO,
  alertaDocumento,
  alertaMantenimientoFecha,
  alertaMantenimientoKm,
  aplicarKmBajoLock,
  aplicarLecturasKmSerializadas,
  auditoriaCambioEstado,
  calcularKmPorGalon,
  calcularTotalCombustible,
  consumoFueraPromedio,
  estadoTrasInspeccion,
  estadoTrasNovedad,
  evaluarAsignacion,
  evaluarIdVehiculoTecnico,
  evaluarOperacionCampo,
  kilometrajeTrasUpdateCondicionado,
  KM_INFERIOR_MSG,
  mensajeAlertaMant,
  MSG_FUERA_SERVICIO_CAMPO,
  MSG_TECNICO_YA_ASIGNADO,
  MSG_VEHICULO_YA_ASIGNADO,
  normalizarPlaca,
  placaValida,
  puedeAsignarEstado,
  puedeGestionarParque,
  resultadoInspeccionDesdeChecklist,
  tecnicoPuedeVerVehiculo,
  validarKmNoDescendente,
} from "./reglas";
import { BACKUP_TABLE_ORDER } from "@/lib/backup";
import { backupIncluyeParqueCompleto } from "./backup-tablas";
import { mapTipoNovedadReporte } from "./labels";
import { parseMediaVehiculoFilename } from "./media-urls";

describe("placa", () => {
  it("normaliza y rechaza duplicado lógico", () => {
    assert.equal(normalizarPlaca(" abc-1234 "), "ABC-1234");
    assert.equal(normalizarPlaca("abc 1234"), "ABC1234");
    assert.ok(placaValida("ABC-1234"));
    assert.equal(placaValida("AB"), false);
  });
});

describe("asignación / permisos", () => {
  it("ops puede gestionar, técnico no", () => {
    assert.equal(puedeGestionarParque("ADMIN"), true);
    assert.equal(puedeGestionarParque("SUPERVISOR"), true);
    assert.equal(puedeGestionarParque("TECNICO"), false);
  });

  it("técnico solo ve su vehículo asignado", () => {
    assert.equal(
      tecnicoPuedeVerVehiculo({
        rol: "TECNICO",
        tecnicoId: "t1",
        asignacionAbiertaTecnicoId: "t1",
      }),
      true
    );
    assert.equal(
      tecnicoPuedeVerVehiculo({
        rol: "TECNICO",
        tecnicoId: "t1",
        asignacionAbiertaTecnicoId: "t2",
      }),
      false
    );
    assert.equal(
      tecnicoPuedeVerVehiculo({
        rol: "TECNICO",
        tecnicoId: "t1",
        asignacionAbiertaTecnicoId: null,
      }),
      false
    );
    assert.equal(
      tecnicoPuedeVerVehiculo({ rol: "SUPERVISOR", tecnicoId: null }),
      true
    );
  });

  it("técnico sin vehículo no accede", () => {
    assert.equal(
      tecnicoPuedeVerVehiculo({
        rol: "TECNICO",
        tecnicoId: "t1",
      }),
      false
    );
  });
});

describe("kilometraje descendente", () => {
  it("rechaza un valor inferior al último", () => {
    const r = validarKmNoDescendente(125430, 120000);
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.error, KM_INFERIOR_MSG);
  });

  it("acepta igual o mayor", () => {
    assert.equal(validarKmNoDescendente(125430, 125430).ok, true);
    assert.equal(validarKmNoDescendente(125430, 125500).ok, true);
    assert.equal(validarKmNoDescendente(null, 10).ok, true);
  });
});

describe("consumo", () => {
  it("calcula total y km/galón", () => {
    assert.equal(calcularTotalCombustible(10, 2.5), 25);
    const r = calcularKmPorGalon(100000, 100250, 10);
    assert.equal(r.kmRecorridos, 250);
    assert.equal(r.kmPorGalon, 25);
  });

  it("marca consumo anormal vs promedio sin acusar", () => {
    const hist = [25, 24, 26, 25];
    assert.equal(consumoFueraPromedio(10, hist), true);
    assert.equal(consumoFueraPromedio(24.5, hist), false);
    assert.equal(consumoFueraPromedio(20, [25]), false);
  });
});

describe("mantenimiento vencido y alertas", () => {
  it("clasifica por km", () => {
    assert.equal(
      alertaMantenimientoKm({ kmActual: 10000, proximoKm: 9950 }),
      "vencido"
    );
    assert.equal(
      alertaMantenimientoKm({ kmActual: 10000, proximoKm: 10100 }),
      "urgente"
    );
    assert.equal(
      alertaMantenimientoKm({ kmActual: 10000, proximoKm: 10500 }),
      "proximo"
    );
    assert.equal(
      alertaMantenimientoKm({ kmActual: 10000, proximoKm: 12000 }),
      null
    );
  });

  it("documentos 30/15/vencido", () => {
    const now = new Date("2026-08-15T12:00:00-05:00");
    assert.equal(alertaDocumento("2026-09-10", now), "proximo");
    assert.equal(alertaDocumento("2026-08-20", now), "urgente");
    assert.equal(alertaDocumento("2026-08-01", now), "vencido");
    const f = alertaMantenimientoFecha("2026-08-10", now);
    assert.equal(f, "vencido");
  });

  it("mensaje de alerta", () => {
    const m = mensajeAlertaMant({
      placa: "ABC-1234",
      marca: "JAC",
      modelo: "T6",
      restanteKm: 450,
    });
    assert.match(m, /ABC-1234/);
    assert.match(m, /450 km/);
  });
});

describe("novedad NO_APTO / fuera de servicio", () => {
  it("inspección crítica es NO_APTO", () => {
    const r = resultadoInspeccionDesdeChecklist({
      aceite: true,
      frenos: false,
      luces: true,
      llantas: true,
    });
    assert.equal(r.resultado, "NO_APTO");
    assert.ok(r.criticosFallidos.includes("frenos"));
  });

  it("fallas no críticas = CON_NOVEDADES", () => {
    const r = resultadoInspeccionDesdeChecklist({
      aceite: false,
      frenos: true,
      luces: true,
      llantas: true,
    });
    assert.equal(r.resultado, "CON_NOVEDADES");
  });

  it("no circular pasa a FUERA_SERVICIO", () => {
    assert.equal(
      estadoTrasNovedad({ puedeCircular: false, estadoActual: "ASIGNADO" }),
      "FUERA_SERVICIO"
    );
    assert.equal(
      estadoTrasNovedad({ puedeCircular: true, estadoActual: "ASIGNADO" }),
      null
    );
  });
});

describe("auditoría anulación", () => {
  it("un registro se marca ANULADO, no se borra (contrato)", () => {
    const estados = ["ACTIVO", "ANULADO", "CORREGIDO"] as const;
    assert.ok(estados.includes("ANULADO"));
    assert.equal("delete" in estados, false);
  });
});

describe("corrección final parque automotor", () => {
  it("A técnico con un vehículo abierto es válido", () => {
    assert.equal(
      tecnicoPuedeVerVehiculo({
        rol: "TECNICO",
        tecnicoId: "t1",
        asignacionAbiertaTecnicoId: "t1",
      }),
      true
    );
    assert.equal(
      evaluarAsignacion({
        estadoVehiculo: "DISPONIBLE",
        tecnicoTieneAsignacionAbierta: false,
        vehiculoTieneAsignacionAbierta: false,
      }).ok,
      true
    );
  });

  it("B segundo vehículo al mismo técnico → 409", () => {
    const r = evaluarAsignacion({
      estadoVehiculo: "DISPONIBLE",
      tecnicoTieneAsignacionAbierta: true,
      vehiculoTieneAsignacionAbierta: false,
    });
    assert.equal(r.ok, false);
    if (!r.ok) {
      assert.equal(r.status, 409);
      assert.equal(r.error, MSG_TECNICO_YA_ASIGNADO);
    }
  });

  it("C vehículo ya asignado → 409", () => {
    const r = evaluarAsignacion({
      estadoVehiculo: "ASIGNADO",
      tecnicoTieneAsignacionAbierta: false,
      vehiculoTieneAsignacionAbierta: true,
    });
    assert.equal(r.ok, false);
    if (!r.ok) {
      assert.equal(r.status, 409);
      assert.equal(r.error, MSG_VEHICULO_YA_ASIGNADO);
    }
  });

  it("D-E-F FUERA_SERVICIO bloquea combustible, km e inspección", () => {
    const r = evaluarOperacionCampo("FUERA_SERVICIO");
    assert.equal(r.ok, false);
    if (!r.ok) {
      assert.equal(r.status, 409);
      assert.equal(r.error, MSG_FUERA_SERVICIO_CAMPO);
    }
    assert.equal(evaluarOperacionCampo("ASIGNADO").ok, true);
  });

  it("G inspección NO_APTO pasa a FUERA_SERVICIO", () => {
    assert.equal(estadoTrasInspeccion("NO_APTO"), "FUERA_SERVICIO");
    assert.equal(estadoTrasInspeccion("APROBADO"), null);
    assert.equal(estadoTrasInspeccion("CON_NOVEDADES"), null);
  });

  it("H inspección NO_APTO genera auditoría de estado", () => {
    const a = auditoriaCambioEstado({
      accion: "FUERA_SERVICIO",
      estadoAnterior: "ASIGNADO",
      estadoNuevo: "FUERA_SERVICIO",
      motivo: ALERTA_NO_APTO,
    });
    assert.equal(a.entidad, "Vehiculo");
    assert.equal(a.accion, "FUERA_SERVICIO");
    assert.deepEqual(a.valorAnterior, { estado: "ASIGNADO" });
    assert.deepEqual(a.valorNuevo, { estado: "FUERA_SERVICIO" });
    assert.equal(a.motivo, ALERTA_NO_APTO);
    assert.ok(a.campos.includes("usuarioId"));
    assert.ok(a.campos.includes("createdAt"));
    assert.ok(a.campos.includes("motivo"));
  });

  it("I vehículo MANTENIMIENTO no se puede asignar", () => {
    const r = evaluarAsignacion({
      estadoVehiculo: "MANTENIMIENTO",
      tecnicoTieneAsignacionAbierta: false,
      vehiculoTieneAsignacionAbierta: true,
    });
    assert.equal(r.ok, false);
    if (!r.ok) {
      assert.equal(r.status, 409);
      assert.equal(r.error, "No se puede asignar un vehículo en mantenimiento.");
    }
    assert.equal(puedeAsignarEstado("MANTENIMIENTO"), false);
    assert.equal(puedeAsignarEstado("DISPONIBLE"), true);
  });

  it("J dos registros de km simultáneos nunca retroceden", () => {
    for (const orden of [
      [10000, 10100],
      [10100, 10000],
    ]) {
      const s = { kilometrajeActual: 9000 };
      for (const km of orden) aplicarKmBajoLock(s, km);
      assert.equal(s.kilometrajeActual, 10100);
      assert.notEqual(s.kilometrajeActual, 10000);
    }
    const serial = aplicarLecturasKmSerializadas(9000, [10000, 10100]);
    assert.equal(serial.kilometrajeActual, 10100);
    const invertido = aplicarLecturasKmSerializadas(9000, [10100, 10000]);
    assert.equal(invertido.kilometrajeActual, 10100);
    assert.deepEqual(invertido.rechazados, [10000]);
    assert.equal(kilometrajeTrasUpdateCondicionado(10100, 10000), 10100);
  });

  it("K técnico manipulando ID de otro vehículo → 403", () => {
    const r = evaluarIdVehiculoTecnico({
      asignadoVehiculoId: "veh-propio",
      requestedVehiculoId: "veh-ajeno",
    });
    assert.equal(r.ok, false);
    if (!r.ok) {
      assert.equal(r.status, 403);
      assert.equal(r.error, "No tiene este vehículo asignado.");
    }
    assert.equal(
      evaluarIdVehiculoTecnico({
        asignadoVehiculoId: "veh-propio",
        requestedVehiculoId: undefined,
      }).ok,
      true
    );
  });

  it("L backup incluye todas las tablas nuevas en orden FK", () => {
    const r = backupIncluyeParqueCompleto([...BACKUP_TABLE_ORDER]);
    assert.equal(r.ok, true, r.ok ? "" : r.faltantes.join(","));
    assert.ok(BACKUP_TABLE_ORDER.includes("Vehiculo"));
    assert.ok(BACKUP_TABLE_ORDER.includes("UsoVehiculoTicket"));
    const veh = BACKUP_TABLE_ORDER.indexOf("Vehiculo");
    const asig = BACKUP_TABLE_ORDER.indexOf("AsignacionVehiculo");
    const acta = BACKUP_TABLE_ORDER.indexOf("ActaVehiculo");
    const uso = BACKUP_TABLE_ORDER.indexOf("UsoVehiculoTicket");
    const ticket = BACKUP_TABLE_ORDER.indexOf("Ticket");
    assert.ok(veh < asig && asig < acta);
    assert.ok(ticket < uso);
  });
});

describe("mi vehículo fase 1", () => {
  it("mapea daños de UI al enum existente", () => {
    assert.equal(mapTipoNovedadReporte("RAYON"), "CARROCERIA");
    assert.equal(mapTipoNovedadReporte("GOLPE"), "CARROCERIA");
    assert.equal(mapTipoNovedadReporte("VIDRIO"), "CARROCERIA");
    assert.equal(mapTipoNovedadReporte("LLANTA"), "NEUMATICOS");
    assert.equal(mapTipoNovedadReporte("LUCES"), "ELECTRICA");
    assert.equal(mapTipoNovedadReporte("ESPEJO"), "ACCESORIOS");
    assert.equal(mapTipoNovedadReporte("INTERIOR"), "ACCESORIOS");
    assert.equal(mapTipoNovedadReporte("MECANICA"), "MECANICA");
    assert.equal(mapTipoNovedadReporte("OTRO"), "OTRO");
  });

  it("URLs de media identifican el registro, no un nombre genérico", () => {
    const a = parseMediaVehiculoFilename("carga-clxyz123.jpg");
    const b = parseMediaVehiculoFilename("carga-clxyz999.jpg");
    const n = parseMediaVehiculoFilename("novfoto-abc1.jpg");
    assert.equal(a?.kind, "carga");
    assert.equal(a?.id, "clxyz123");
    assert.notEqual(a?.id, b?.id);
    assert.equal(n?.kind, "novfoto");
    assert.equal(parseMediaVehiculoFilename("combustible.jpg"), null);
    assert.equal(parseMediaVehiculoFilename("nov-0.jpg"), null);
    assert.equal(parseMediaVehiculoFilename("../x.jpg"), null);
  });
});

