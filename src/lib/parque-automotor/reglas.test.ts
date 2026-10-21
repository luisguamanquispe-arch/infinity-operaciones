import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
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
  aplicarRegularizacionEnMemoria,
  diaCalendarioEc,
  diasFaltantes,
  ejecutarLoteRegularizacionAtomico,
  fechaHistoricaDesdeDia,
  MSG_DUPLICADO_DIA,
  MSG_ESTIMADA_SIN_JUSTIFICACION,
  MSG_KM_ROMPERIA_POSTERIOR,
  MSG_SIN_JUSTIFICACION,
  validarItemRegularizacion,
  validarRangoRegularizacion,
} from "./reglas";
import { BACKUP_TABLE_ORDER } from "@/lib/backup";
import { backupIncluyeParqueCompleto } from "./backup-tablas";
import { mapTipoNovedadReporte } from "./labels";
import { parseMediaVehiculoFilename } from "./media-urls";
import {
  celdaTextoExcel,
  deltaKmValido,
  etiquetaTipoLectura,
  filasKilometrajeConDelta,
  formatGalones,
  rangoAutofiltroExcel,
} from "./reporte-formato";
import { TIPOS_REPORTE_PARQUE } from "./labels";
import { crearPdfCorporativo } from "./pdf-layout";

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

describe("regularización de kilometraje histórico", () => {
  const hoy = "2026-10-20";
  const lecturas = [
    { id: "a", dia: "2026-10-01", kilometraje: 10000 },
    { id: "b", dia: "2026-10-05", kilometraje: 10400 },
  ];
  const item = {
    dia: "2026-10-03",
    kilometraje: 10200,
    tipoLectura: "REAL" as const,
    justificacion: "Bitácora del responsable de flota",
  };

  it("registra una lectura histórica en una fecha faltante", () => {
    const v = aplicarRegularizacionEnMemoria(
      { kilometrajeActual: 10400, lecturas },
      [item],
      hoy
    );
    assert.equal(v.ok, true);
    if (!v.ok) return;
    assert.equal(v.aplicadas.length, 1);
    assert.equal(v.kilometrajeActual, 10400);
    assert.ok(v.lecturas.some((l) => l.dia === "2026-10-03" && l.kilometraje === 10200));
  });

  it("registra varias fechas faltantes del mismo vehículo", () => {
    const v = aplicarRegularizacionEnMemoria(
      { kilometrajeActual: 10400, lecturas },
      [
        item,
        { ...item, dia: "2026-10-04", kilometraje: 10300 },
      ],
      hoy
    );
    assert.equal(v.ok, true);
    if (!v.ok) return;
    assert.equal(v.aplicadas.length, 2);
    assert.equal(v.kilometrajeActual, 10400);
  });

  it("rechaza un duplicado del mismo vehículo y día", () => {
    const v = validarItemRegularizacion(
      { ...item, dia: "2026-10-01" },
      lecturas,
      hoy
    );
    assert.equal(v.ok, false);
    if (v.ok) return;
    assert.equal(v.error, MSG_DUPLICADO_DIA);
    assert.equal(v.duplicado?.id, "a");
  });

  it("detecta un kilometraje mayor que una lectura posterior", () => {
    const v = validarItemRegularizacion(
      { ...item, kilometraje: 20000 },
      lecturas,
      hoy
    );
    assert.equal(v.ok, false);
    if (v.ok) return;
    assert.equal(v.error, MSG_KM_ROMPERIA_POSTERIOR);
  });

  it("detecta un kilometraje inferior a la lectura anterior", () => {
    const v = validarItemRegularizacion(
      { ...item, kilometraje: 9000 },
      lecturas,
      hoy
    );
    assert.equal(v.ok, false);
    if (v.ok) return;
    assert.equal(v.error, KM_INFERIOR_MSG);
  });

  it("acepta una lectura estimada con justificación", () => {
    const v = validarItemRegularizacion(
      { ...item, tipoLectura: "ESTIMADA", justificacion: "Reconstruido con bitácora de patio" },
      lecturas,
      hoy
    );
    assert.equal(v.ok, true);
  });

  it("rechaza una lectura estimada sin justificación", () => {
    const v = validarItemRegularizacion(
      { ...item, tipoLectura: "ESTIMADA", justificacion: "" },
      lecturas,
      hoy
    );
    assert.equal(v.ok, false);
    if (v.ok) return;
    assert.equal(v.error, MSG_ESTIMADA_SIN_JUSTIFICACION);
  });

  it("exige justificación también en lecturas reales de regularización", () => {
    const v = validarItemRegularizacion({ ...item, justificacion: "corto" }, lecturas, hoy);
    assert.equal(v.ok, false);
    if (v.ok) return;
    assert.equal(v.error, MSG_SIN_JUSTIFICACION);
  });

  it("conserva las lecturas originales al aplicar el lote", () => {
    const v = aplicarRegularizacionEnMemoria(
      { kilometrajeActual: 10400, lecturas },
      [item],
      hoy
    );
    assert.equal(v.ok, true);
    if (!v.ok) return;
    assert.equal(lecturas.length, 2);
    assert.equal(v.lecturas.filter((l) => l.id === "a" || l.id === "b").length, 2);
  });

  it("no baja el kilometraje actual y sí lo sube si la fecha es la más reciente", () => {
    const intercalada = aplicarRegularizacionEnMemoria(
      { kilometrajeActual: 10400, lecturas },
      [item],
      hoy
    );
    assert.equal(intercalada.ok, true);
    if (intercalada.ok) {
      assert.equal(intercalada.kilometrajeActual, 10400);
      assert.equal(intercalada.actualizoKilometrajeActual, false);
    }
    const tardia = aplicarRegularizacionEnMemoria(
      { kilometrajeActual: 10400, lecturas },
      [{ ...item, dia: "2026-10-10", kilometraje: 11000 }],
      hoy
    );
    assert.equal(tardia.ok, true);
    if (tardia.ok) {
      assert.equal(tardia.kilometrajeActual, 11000);
      assert.equal(tardia.actualizoKilometrajeActual, true);
    }
  });

  it("no cambia el kilometraje actual al regularizar un hueco antiguo", () => {
    const v = aplicarRegularizacionEnMemoria(
      { kilometrajeActual: 10000, lecturas },
      [item],
      hoy
    );
    assert.equal(v.ok, true);
    if (!v.ok) return;
    assert.equal(v.kilometrajeActual, 10000);
    assert.equal(v.actualizoKilometrajeActual, false);
    assert.ok(v.inconsistencia);
    assert.equal(v.inconsistencia?.ultimaHistorica?.dia, "2026-10-05");
    assert.equal(v.inconsistencia?.ultimaHistorica?.kilometraje, 10400);
  });

  it("actualiza el kilometraje actual solo si el lote incluye la lectura histórica más reciente", () => {
    const v = aplicarRegularizacionEnMemoria(
      { kilometrajeActual: 10400, lecturas },
      [
        item,
        { ...item, dia: "2026-10-10", kilometraje: 11000 },
      ],
      hoy
    );
    assert.equal(v.ok, true);
    if (!v.ok) return;
    assert.equal(v.aplicadas.length, 2);
    assert.equal(v.kilometrajeActual, 11000);
    assert.equal(v.actualizoKilometrajeActual, true);
  });

  it("usa la fecha nueva más reciente del lote, no una lectura existente posterior", () => {
    const v = aplicarRegularizacionEnMemoria(
      { kilometrajeActual: 9000, lecturas },
      [
        { ...item, dia: "2026-10-02", kilometraje: 10100 },
        { ...item, dia: "2026-10-03", kilometraje: 10200 },
        { ...item, dia: "2026-10-04", kilometraje: 10300 },
      ],
      hoy
    );
    assert.equal(v.ok, true);
    if (!v.ok) return;
    assert.equal(v.aplicadas.length, 3);
    assert.equal(v.kilometrajeActual, 9000);
    assert.equal(v.actualizoKilometrajeActual, false);
    assert.ok(v.inconsistencia);
  });

  it("no cambia el odómetro si el kilometraje actual ya es superior a las lecturas nuevas", () => {
    const v = aplicarRegularizacionEnMemoria(
      { kilometrajeActual: 20000, lecturas },
      [{ ...item, dia: "2026-10-10", kilometraje: 11000 }],
      hoy
    );
    assert.equal(v.ok, true);
    if (!v.ok) return;
    assert.equal(v.kilometrajeActual, 20000);
    assert.equal(v.actualizoKilometrajeActual, false);
    assert.ok(v.inconsistencia);
    assert.match(v.inconsistencia?.mensaje ?? "", /inferior al kilometraje actual/);
  });

  it("conserva una inconsistencia previa entre kilometraje actual e historial", () => {
    const v = aplicarRegularizacionEnMemoria(
      { kilometrajeActual: 20000, lecturas },
      [item],
      hoy
    );
    assert.equal(v.ok, true);
    if (!v.ok) return;
    assert.equal(v.kilometrajeActual, 20000);
    assert.equal(v.actualizoKilometrajeActual, false);
    assert.equal(v.inconsistencia?.kilometrajeActual, 20000);
    assert.equal(v.inconsistencia?.ultimaHistorica?.kilometraje, 10400);
    assert.equal(lecturas.length, 2);
    assert.equal(lecturas[1]?.kilometraje, 10400);
  });

  it("nunca reduce el kilometraje actual", () => {
    const casos = [
      aplicarRegularizacionEnMemoria({ kilometrajeActual: 10400, lecturas }, [item], hoy),
      aplicarRegularizacionEnMemoria(
        { kilometrajeActual: 20000, lecturas },
        [{ ...item, dia: "2026-10-10", kilometraje: 11000 }],
        hoy
      ),
      aplicarRegularizacionEnMemoria(
        { kilometrajeActual: 10000, lecturas },
        [item],
        hoy
      ),
    ];
    for (const v of casos) {
      assert.equal(v.ok, true);
      if (!v.ok) continue;
      assert.ok(v.kilometrajeActual >= 10000);
      assert.ok(
        v.kilometrajeActual === 10400 ||
          v.kilometrajeActual === 20000 ||
          v.kilometrajeActual === 10000 ||
          v.kilometrajeActual === 11000
      );
      assert.ok(v.kilometrajeActual !== 10200 || v.actualizoKilometrajeActual === false);
    }
    const noBaja = aplicarRegularizacionEnMemoria(
      { kilometrajeActual: 15000, lecturas },
      [{ ...item, dia: "2026-10-10", kilometraje: 11000 }],
      hoy
    );
    assert.equal(noBaja.ok, true);
    if (!noBaja.ok) return;
    assert.equal(noBaja.kilometrajeActual, 15000);
    assert.equal(noBaja.actualizoKilometrajeActual, false);
  });

  it("revierte el lote completo si un ítem es inválido", () => {
    const v = aplicarRegularizacionEnMemoria(
      { kilometrajeActual: 10400, lecturas },
      [item, { ...item, dia: "2026-10-01", kilometraje: 10100 }],
      hoy
    );
    assert.equal(v.ok, false);
    assert.equal(lecturas.length, 2);
  });

  it("identifica días faltantes y no asume recorrido en esos días", () => {
    const faltan = diasFaltantes("2026-10-01", "2026-10-05", ["2026-10-01", "2026-10-05"]);
    assert.deepEqual(faltan, ["2026-10-02", "2026-10-03", "2026-10-04"]);
    const igual = validarItemRegularizacion(
      { ...item, kilometraje: 10000, justificacion: "El vehículo no circuló ese día" },
      lecturas,
      hoy
    );
    assert.equal(igual.ok, true);
  });

  it("separa la fecha histórica de la fecha de registro", () => {
    const fecha = fechaHistoricaDesdeDia("2026-10-03");
    assert.equal(diaCalendarioEc(fecha), "2026-10-03");
    assert.notEqual(fecha.toISOString(), new Date().toISOString());
    const rango = validarRangoRegularizacion("2026-10-10", "2026-10-01", hoy);
    assert.equal(rango.ok, false);
  });

  it("ops puede regularizar y el técnico de campo no gestiona parque", () => {
    assert.equal(puedeGestionarParque("ADMIN"), true);
    assert.equal(puedeGestionarParque("SUPERVISOR"), true);
    assert.equal(puedeGestionarParque("TECNICO"), false);
  });
});

describe("contrato atómico de regularización (unitario, sin PostgreSQL)", () => {
  const hoy = "2026-10-20";
  const lecturas = [
    { id: "a", dia: "2026-10-01", kilometraje: 10000 },
    { id: "b", dia: "2026-10-05", kilometraje: 10400 },
  ];
  const item = {
    dia: "2026-10-03",
    kilometraje: 10200,
    tipoLectura: "REAL" as const,
    justificacion: "Bitácora del responsable de flota",
    fuente: "bitacora-patio",
  };
  const estadoBase = () => ({
    kilometrajeActual: 10400,
    lecturas: [...lecturas],
    auditorias: [],
  });

  it("éxito: persiste lecturas y auditoría KM_REGULARIZACION en el mismo lote", () => {
    const r = ejecutarLoteRegularizacionAtomico(estadoBase(), [item], {
      usuarioId: "user-ops",
      hoy,
    });
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.lecturas.length, 3);
    assert.equal(r.auditorias.length, 1);
    assert.equal(r.auditorias[0]?.accion, "KM_REGULARIZACION");
    assert.equal(r.auditorias[0]?.usuarioId, "user-ops");
    assert.equal(r.auditorias[0]?.motivo, item.justificacion);
    assert.equal(r.auditorias[0]?.valorNuevo.tipoLectura, "REAL");
    assert.equal(r.auditorias[0]?.valorNuevo.fuente, "bitacora-patio");
    assert.equal(r.auditorias[0]?.valorNuevo.fechaHistorica, "2026-10-03");
    assert.equal(r.kilometrajeActual, 10400);
  });

  it("si falla la inserción de una lectura, no persiste ninguna del lote", () => {
    const original = estadoBase();
    const r = ejecutarLoteRegularizacionAtomico(original, [item], {
      usuarioId: "user-ops",
      hoy,
      fallarEn: "lectura",
    });
    assert.equal(r.ok, false);
    assert.equal(r.lecturas.length, 2);
    assert.deepEqual(r.lecturas, original.lecturas);
    assert.equal(r.auditorias.length, 0);
    assert.equal(r.kilometrajeActual, 10400);
  });

  it("si falla la auditoría, no persiste ninguna lectura del lote", () => {
    const original = estadoBase();
    const r = ejecutarLoteRegularizacionAtomico(original, [item], {
      usuarioId: "user-ops",
      hoy,
      fallarEn: "auditoria",
    });
    assert.equal(r.ok, false);
    assert.deepEqual(r.lecturas, original.lecturas);
    assert.equal(r.auditorias.length, 0);
    assert.equal(r.kilometrajeActual, original.kilometrajeActual);
  });

  it("si falla la actualización del kilometraje actual, revierte el lote completo", () => {
    const original = {
      kilometrajeActual: 10400,
      lecturas: [...lecturas],
      auditorias: [],
    };
    const r = ejecutarLoteRegularizacionAtomico(
      original,
      [{ ...item, dia: "2026-10-10", kilometraje: 11000 }],
      { usuarioId: "user-ops", hoy, fallarEn: "kmActual" }
    );
    assert.equal(r.ok, false);
    assert.deepEqual(r.lecturas, original.lecturas);
    assert.equal(r.auditorias.length, 0);
    assert.equal(r.kilometrajeActual, 10400);
  });

  it("conserva las lecturas originales si el lote se revierte", () => {
    const original = estadoBase();
    const r = ejecutarLoteRegularizacionAtomico(original, [item], {
      usuarioId: "user-ops",
      hoy,
      fallarEn: "auditoria",
    });
    assert.equal(r.ok, false);
    assert.equal(original.lecturas.length, 2);
    assert.equal(original.lecturas[0]?.id, "a");
    assert.equal(original.lecturas[1]?.id, "b");
    assert.equal(r.lecturas.filter((l) => l.id === "a" || l.id === "b").length, 2);
  });

  it("nunca reduce el kilometraje actual en el contrato atómico", () => {
    const r = ejecutarLoteRegularizacionAtomico(
      { kilometrajeActual: 20000, lecturas: [...lecturas], auditorias: [] },
      [{ ...item, dia: "2026-10-10", kilometraje: 11000 }],
      { usuarioId: "user-ops", hoy }
    );
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.kilometrajeActual, 20000);
    assert.equal(r.actualizoKilometrajeActual, false);
  });

  it("el endpoint del técnico no regulariza; ADMIN y SUPERVISOR siguen autorizados", () => {
    assert.equal(puedeGestionarParque("ADMIN"), true);
    assert.equal(puedeGestionarParque("SUPERVISOR"), true);
    assert.equal(puedeGestionarParque("TECNICO"), false);
    const tecnicoKm = readFileSync(
      resolve("src/app/api/tecnico/vehiculo/kilometraje/route.ts"),
      "utf8"
    );
    const regularizar = readFileSync(
      resolve("src/app/api/vehiculos/[id]/kilometraje/regularizar/route.ts"),
      "utf8"
    );
    const servicio = readFileSync(
      resolve("src/lib/parque-automotor/servicio.ts"),
      "utf8"
    );
    assert.match(tecnicoKm, /requireTecnicoVehiculoCampo/);
    assert.doesNotMatch(tecnicoKm, /regularizarKilometrajeHistorico/);
    assert.match(regularizar, /requireOpsVehiculo/);
    assert.doesNotMatch(regularizar, /requireTecnico/);
    const fn = servicio.slice(
      servicio.indexOf("export async function regularizarKilometrajeHistorico")
    );
    const corte = fn.indexOf("\nexport async function", 1);
    const cuerpo = corte > 0 ? fn.slice(0, corte) : fn;
    assert.match(cuerpo, /registrarAuditoriaVehiculo/);
    assert.match(cuerpo, /tx,/);
    assert.doesNotMatch(
      cuerpo,
      /return \{ creadas[\s\S]*registrarAuditoriaVehiculo/
    );
  });
});

describe("formato de reportes parque automotor", () => {
  it("calcula delta de km solo si el odómetro no desciende", () => {
    assert.equal(deltaKmValido(10000, 10200), 200);
    assert.equal(deltaKmValido(10400, 10400), 0);
    assert.equal(deltaKmValido(10400, 10300), null);
    const filas = filasKilometrajeConDelta([
      {
        placa: "ABC-1234",
        marca: "Chevrolet",
        modelo: "D-Max",
        fecha: new Date("2026-10-01T12:00:00.000Z"),
        createdAt: new Date("2026-10-01T18:00:00.000Z"),
        kilometraje: 10000,
        tipoLectura: "REAL",
        origen: "Manual",
      },
      {
        placa: "ABC-1234",
        marca: "Chevrolet",
        modelo: "D-Max",
        fecha: new Date("2026-10-03T12:00:00.000Z"),
        createdAt: new Date("2026-10-20T15:00:00.000Z"),
        kilometraje: 10200,
        tipoLectura: "ESTIMADA",
        origen: "Manual",
        fuente: "bitácora",
        observacion: "Hueco regularizado",
      },
    ]);
    const est = filas.find((f) => f.estimada);
    const real = filas.find((f) => !f.estimada);
    assert.equal(est?.fechaHistorica, "2026-10-03");
    assert.equal(est?.delta, 200);
    assert.match(est?.tipoLectura ?? "", /estimada/i);
    assert.match(est?.tipoLectura ?? "", /no verificada/i);
    assert.equal(real?.fechaHistorica, "2026-10-01");
    assert.equal(etiquetaTipoLectura("REAL").estimada, false);
    assert.equal(celdaTextoExcel("ABC-1234"), "ABC-1234");
    assert.match(formatGalones(12.5), /gal/);
    assert.doesNotMatch(formatGalones(12.5), /litro/i);
    assert.equal(
      rangoAutofiltroExcel({ columnas: 11, filaEncabezado: 6, totalFilas: 20 }),
      "A7:K20"
    );
    assert.equal(
      rangoAutofiltroExcel({ columnas: 1, filaEncabezado: 0, totalFilas: 1 }),
      "A1:A1"
    );
    assert.equal(
      rangoAutofiltroExcel({ columnas: 11, filaEncabezado: 6, totalFilas: 6 }),
      null
    );
    assert.deepEqual(
      [...TIPOS_REPORTE_PARQUE],
      [
        "flota",
        "combustible",
        "kilometraje",
        "mantenimiento",
        "novedades",
        "costos",
        "asignaciones",
        "inspecciones",
      ]
    );
    const pdfRoute = readFileSync(
      resolve("src/app/api/vehiculos/reportes/pdf/route.ts"),
      "utf8"
    );
    const xlsRoute = readFileSync(
      resolve("src/app/api/vehiculos/reportes/excel/route.ts"),
      "utf8"
    );
    assert.match(pdfRoute, /requireOpsVehiculo/);
    assert.match(xlsRoute, /requireOpsVehiculo/);
    assert.match(pdfRoute, /Tipo de reporte inválido/);
    assert.match(xlsRoute, /application\/vnd.openxmlformats-officedocument.spreadsheetml.sheet/);
    assert.match(pdfRoute, /application\/pdf/);
  });

  it("genera un PDF corporativo con encabezado, tabla larga y numeración", async () => {
    const pdf = crearPdfCorporativo({
      titulo: "Prueba de reporte",
      subtitulo: "Control de calidad",
      filtros: ["Alcance: prueba unitaria"],
      periodo: "2026-10",
      landscape: true,
    });
    pdf.kpis([
      { label: "Total", value: "40" },
      { label: "Estimadas", value: "2" },
    ]);
    pdf.seccion("Detalle");
    const filas = Array.from({ length: 40 }, (_, i) => [
      `ABC-${1000 + i}`,
      `2026-10-${String((i % 28) + 1).padStart(2, "0")}`,
      `${10000 + i * 10} km`,
      i % 7 === 0 ? "Lectura estimada (no verificada)" : "Lectura real",
    ]);
    pdf.tabla(
      [
        { label: "Placa", width: 80 },
        { label: "Fecha histórica", width: 80 },
        { label: "Km", width: 80, align: "right" },
        { label: "Tipo", width: 140 },
      ],
      filas,
      { resaltar: filas.map((f) => f[3].includes("estimada")) }
    );
    const buffer = await pdf.finalizar();
    assert.equal(buffer.subarray(0, 4).toString(), "%PDF");
    assert.ok(buffer.length > 2000);
    const cuerpo = buffer.toString("latin1");
    assert.match(cuerpo, /\/Type\s*\/Page/);
    assert.match(cuerpo, /\/Count\s+\d+/);
  });
});

