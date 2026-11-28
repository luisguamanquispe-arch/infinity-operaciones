import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { TipoTrabajo } from "@prisma/client";
import { TIPO_LABELS } from "./utils";
import { ticketEliminableEnGerencia } from "./ticket-gerencia";
import {
  EQUIPOS_INSTALACION,
  MATERIALES_CONSUMIBLES_INSTALACION,
  normalizarNumeroContratoInstalar,
  validarFinalizacionNuevaInstalacion,
  validarMaterialesInstalacion,
  validarNumeroContratoInstalar,
} from "./nueva-instalacion";
import { readFileSync } from "node:fs";
import path from "node:path";

describe("TipoTrabajo — Cambio de domicilio, Migración de servicio a fibra y Nueva instalación", () => {
  it("expone los valores en el enum TipoTrabajo de Prisma", () => {
    assert.equal(TipoTrabajo.CAMBIO_DOMICILIO, "CAMBIO_DOMICILIO");
    assert.equal(TipoTrabajo.MIGRACION_SERVICIO_FIBRA, "MIGRACION_SERVICIO_FIBRA");
    assert.equal(TipoTrabajo.NUEVA_INSTALACION, "NUEVA_INSTALACION");
  });

  it("mantiene las etiquetas existentes y agrega Nueva instalación en TIPO_LABELS", () => {
    assert.equal(TIPO_LABELS.SOPORTE, "Soporte");
    assert.equal(TIPO_LABELS.INSTALACION, "Instalación");
    assert.equal(TIPO_LABELS.RECONEXION, "Reconexión");
    assert.equal(TIPO_LABELS.CORTE, "Corte");
    assert.equal(TIPO_LABELS.MIGRACION, "Migración");
    assert.equal(TIPO_LABELS.RETIRO, "Retiro de equipo");
    assert.equal(TIPO_LABELS.CAMBIO_DOMICILIO, "Cambio de domicilio");
    assert.equal(
      TIPO_LABELS.MIGRACION_SERVICIO_FIBRA,
      "Migración de servicio a fibra"
    );
    assert.equal(TIPO_LABELS.NUEVA_INSTALACION, "Nueva instalación");
  });

  it("permite gestión en gerencia para los tipos de cliente", () => {
    assert.equal(ticketEliminableEnGerencia(TipoTrabajo.CAMBIO_DOMICILIO), true);
    assert.equal(
      ticketEliminableEnGerencia(TipoTrabajo.MIGRACION_SERVICIO_FIBRA),
      true
    );
    assert.equal(ticketEliminableEnGerencia(TipoTrabajo.NUEVA_INSTALACION), true);
  });
});

describe("Nueva instalación — Número de contrato a instalar", () => {
  it("exige número de contrato cuando el tipo de trabajo es NUEVA_INSTALACION", () => {
    for (const invalido of [undefined, null, "", "   ", "\t\n"]) {
      const res = validarNumeroContratoInstalar("NUEVA_INSTALACION", invalido);
      assert.equal(res.ok, false);
    }
  });

  it("acepta un número de contrato válido y normaliza espacios al inicio y al final", () => {
    const res = validarNumeroContratoInstalar("NUEVA_INSTALACION", "   CTR-2026-04512   ");
    assert.equal(res.ok, true);
    if (res.ok) {
      assert.equal(res.numeroContratoInstalar, "CTR-2026-04512");
    }
    assert.equal(normalizarNumeroContratoInstalar("  998877  "), "998877");
  });

  it("otros tipos de trabajo no exigen número de contrato", () => {
    for (const tipo of [
      "SOPORTE",
      "INSTALACION",
      "RECONEXION",
      "CORTE",
      "MIGRACION",
      "RETIRO",
      "CAMBIO_DOMICILIO",
      "MIGRACION_SERVICIO_FIBRA",
    ]) {
      const res = validarNumeroContratoInstalar(tipo, "");
      assert.equal(res.ok, true);
      if (res.ok) {
        assert.equal(res.numeroContratoInstalar, null);
      }
    }
  });

  it("conserva y expone el número de contrato en el detalle del ticket al guardar y editar", () => {
    const creacion = validarNumeroContratoInstalar("NUEVA_INSTALACION", "  INF-CT-7788  ");
    assert.equal(creacion.ok, true);
    const ticketGuardado = {
      id: "tk_nuevo_inst_1",
      codigo: "ST-9001",
      tipo: TipoTrabajo.NUEVA_INSTALACION,
      numeroContratoInstalar: creacion.ok ? creacion.numeroContratoInstalar : null,
    };
    assert.equal(ticketGuardado.numeroContratoInstalar, "INF-CT-7788");

    // Al editar otros campos sin reenviar numeroContratoInstalar, se preserva el valor guardado
    const edicion = validarNumeroContratoInstalar(
      ticketGuardado.tipo,
      ticketGuardado.numeroContratoInstalar
    );
    assert.equal(edicion.ok, true);
    if (edicion.ok) {
      assert.equal(edicion.numeroContratoInstalar, "INF-CT-7788");
    }
  });
});

describe("Nueva instalación — Materiales y equipos utilizados (sin Kardex)", () => {
  it("expone el catálogo inicial de consumibles y equipos", () => {
    const consumibles = MATERIALES_CONSUMIBLES_INSTALACION.map((m) => m.label);
    const equipos = EQUIPOS_INSTALACION.map((e) => e.label);
    for (const req of [
      "Fibra óptica",
      "Roseta óptica",
      "Patch cord",
      "Pigteles",
      "Adaptadores",
      "Conectores",
      "Grapas y accesorios",
      "Otros materiales utilizados",
    ]) {
      assert.ok(consumibles.includes(req), `Falta consumible: ${req}`);
    }
    for (const req of ["Router", "Bridge", "ONU/ONT", "Otros equipos utilizados"]) {
      assert.ok(equipos.includes(req), `Falta equipo: ${req}`);
    }
  });

  it("exige registrar al menos un material o equipo al finalizar Nueva instalación", () => {
    const resVacio = validarFinalizacionNuevaInstalacion({
      tipo: "NUEVA_INSTALACION",
      numeroContratoInstalar: "CTR-1001",
      materialesInstalacion: [],
    });
    assert.equal(resVacio.ok, false);
  });

  it("exige cantidad válida (> 0) y rechaza 0, negativa o vacía", () => {
    for (const cant of [0, -5, "", null, undefined]) {
      const res = validarMaterialesInstalacion([
        { categoria: "MATERIAL", item: "Fibra óptica", cantidad: cant as number, unidad: "metros" },
      ]);
      assert.equal(res.ok, false);
    }
  });

  it("exige marca y serie para equipos y valida que cantidad coincida con series individuales", () => {
    // Sin marca
    const sinMarca = validarMaterialesInstalacion([
      {
        categoria: "EQUIPO",
        item: "Router",
        cantidad: 1,
        unidad: "unidades",
        marca: "",
        series: ["ABC123456"],
      },
    ]);
    assert.equal(sinMarca.ok, false);

    // Sin serie
    const sinSerie = validarMaterialesInstalacion([
      {
        categoria: "EQUIPO",
        item: "Router",
        cantidad: 1,
        unidad: "unidades",
        marca: "Huawei",
        series: [],
      },
    ]);
    assert.equal(sinSerie.ok, false);

    // Cantidad = 2 pero solo 1 serie
    const seriesIncompletas = validarMaterialesInstalacion([
      {
        categoria: "EQUIPO",
        item: "Bridge",
        cantidad: 2,
        unidad: "unidades",
        marca: "TP-Link",
        series: ["DEF789012"],
      },
    ]);
    assert.equal(seriesIncompletas.ok, false);

    // Cantidad = 2 con 2 series individuales válidas
    const valido = validarMaterialesInstalacion([
      {
        categoria: "EQUIPO",
        item: "Router",
        cantidad: 1,
        unidad: "unidades",
        marca: "Huawei",
        series: ["ABC123456"],
      },
      {
        categoria: "EQUIPO",
        item: "Bridge",
        cantidad: 2,
        unidad: "unidades",
        marca: "TP-Link",
        series: ["DEF789012", "DEF789013"],
      },
    ]);
    assert.equal(valido.ok, true);
    if (valido.ok) {
      assert.equal(valido.items.length, 2);
      assert.deepEqual(valido.items[1].series, ["DEF789012", "DEF789013"]);
    }
  });

  it("los materiales consumibles no exigen marca ni número de serie", () => {
    const res = validarMaterialesInstalacion([
      { categoria: "MATERIAL", item: "Fibra óptica", cantidad: 120.5, unidad: "metros" },
      { categoria: "MATERIAL", item: "Roseta óptica", cantidad: 1, unidad: "unidades" },
      { categoria: "MATERIAL", item: "Patch cord", cantidad: 2, unidad: "unidades" },
    ]);
    assert.equal(res.ok, true);
    if (res.ok) {
      assert.equal(res.items[0].marca, null);
      assert.deepEqual(res.items[0].series, []);
    }
  });

  it("otros tipos de trabajo no exigen contrato ni materiales de instalación", () => {
    for (const tipo of ["SOPORTE", "CORTE", "RECONEXION", "CAMBIO_DOMICILIO"]) {
      const res = validarFinalizacionNuevaInstalacion({
        tipo,
        numeroContratoInstalar: null,
        materialesInstalacion: [],
      });
      assert.equal(res.ok, true);
    }
  });

  it("no modifica ni genera movimientos en Inventario / Kardex", () => {
    const routeCode = readFileSync(
      path.join(
        process.cwd(),
        "src",
        "app",
        "api",
        "tickets",
        "[id]",
        "materiales-instalacion",
        "route.ts"
      ),
      "utf8"
    );
    assert.equal(/prisma\.inventario\./.test(routeCode), false);
    assert.equal(/materialUtilizado/i.test(routeCode), false);
  });
});
