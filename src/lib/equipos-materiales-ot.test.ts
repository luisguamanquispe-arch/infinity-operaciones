import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ERROR_INSTALACION_SIN_USO,
  MARCA_SIN_EQUIPOS,
  erroresLineaUso,
  erroresUsoEnCierre,
  type LineaUsoOt,
} from "./equipos-materiales-ot";

const equipoOk: LineaUsoOt = {
  cantidad: 1,
  marca: "Huawei",
  modelo: "HG8145V5",
  serie: "HWTC12345678",
  inventario: { nombre: "ONU", tipo: "EQUIPO", unidad: "unidad" },
};

const fibraOk: LineaUsoOt = {
  cantidad: 85,
  modelo: "Drop",
  inventario: { nombre: "Fibra óptica", tipo: "CONSUMIBLE", unidad: "metros" },
};

const materialOk: LineaUsoOt = {
  cantidad: 2,
  modelo: "Simple",
  inventario: { nombre: "Roseta", tipo: "CONSUMIBLE", unidad: "unidad" },
};

describe("instalación nueva", () => {
  it("sin equipos ni materiales bloquea el cierre", () => {
    const errores = erroresUsoEnCierre({ esInstalacion: true, materiales: [] });
    assert.ok(errores.includes(ERROR_INSTALACION_SIN_USO));
  });

  it("con equipo permite el cierre", () => {
    assert.deepEqual(erroresUsoEnCierre({ esInstalacion: true, materiales: [equipoOk] }), []);
  });

  it("con material permite el cierre", () => {
    assert.deepEqual(erroresUsoEnCierre({ esInstalacion: true, materiales: [materialOk] }), []);
  });

  it("con equipo y material permite el cierre", () => {
    assert.deepEqual(
      erroresUsoEnCierre({ esInstalacion: true, materiales: [equipoOk, fibraOk] }),
      []
    );
  });
});

describe("equipo", () => {
  it("sin marca, modelo o serie queda bloqueado", () => {
    assert.ok(erroresLineaUso({ ...equipoOk, marca: "" }).some((e) => e.includes("marca")));
    assert.ok(erroresLineaUso({ ...equipoOk, modelo: "" }).some((e) => e.includes("modelo")));
    assert.ok(erroresLineaUso({ ...equipoOk, serie: "" }).some((e) => e.includes("serie")));
  });

  it("cantidad 0 o negativa queda bloqueada", () => {
    assert.ok(erroresLineaUso({ ...equipoOk, cantidad: 0 }).some((e) => e.includes("cantidad")));
    assert.ok(erroresLineaUso({ ...equipoOk, cantidad: -1 }).some((e) => e.includes("cantidad")));
  });

  it("registro completo pasa", () => {
    assert.deepEqual(erroresLineaUso(equipoOk), []);
  });
});

describe("material", () => {
  it("sin elemento o sin tipo queda bloqueado", () => {
    assert.ok(
      erroresLineaUso({ ...materialOk, inventario: { nombre: "", unidad: "unidad" } }).some((e) =>
        e.includes("elemento")
      )
    );
    assert.ok(erroresLineaUso({ ...materialOk, modelo: "" }).some((e) => e.includes("tipo")));
  });

  it("cantidad 0 o negativa queda bloqueada", () => {
    assert.ok(erroresLineaUso({ ...materialOk, cantidad: 0 }).length > 0);
    assert.ok(erroresLineaUso({ ...materialOk, cantidad: -2 }).length > 0);
  });

  it("fibra con metros válidos pasa", () => {
    assert.deepEqual(erroresLineaUso(fibraOk), []);
  });

  it("fibra fuera de metros queda bloqueada", () => {
    assert.ok(
      erroresLineaUso({
        ...fibraOk,
        inventario: { nombre: "Fibra óptica", tipo: "CONSUMIBLE", unidad: "unidad" },
      }).some((e) => e.includes("metros"))
    );
  });
});

describe("soporte express", () => {
  it("cambio de equipo sin equipo queda bloqueado", () => {
    const errores = erroresUsoEnCierre({
      esExpress: true,
      trabajoExpress: "ENTREGA_EQUIPO",
      materiales: [],
    });
    assert.ok(errores.some((e) => e.includes("equipo")));
  });

  it("cambio de material sin material queda bloqueado", () => {
    const errores = erroresUsoEnCierre({
      esExpress: true,
      trabajoExpress: "CAMBIO_PATCH_CORD",
      materiales: [equipoOk],
    });
    assert.ok(errores.some((e) => e.includes("material")));
  });

  it("reparación sin utilización pasa con observación", () => {
    const errores = erroresUsoEnCierre({
      esExpress: true,
      trabajoExpress: "CONFIGURACION_WIFI",
      materiales: [],
      resumenTrabajo: `${MARCA_SIN_EQUIPOS}\nSe ajustó la clave WiFi del equipo existente.`,
    });
    assert.deepEqual(errores, []);
  });

  it("reparación vacía sin declaración queda bloqueada", () => {
    const errores = erroresUsoEnCierre({
      esExpress: true,
      trabajoExpress: "REINICIO_ONU",
      materiales: [],
      resumenTrabajo: "Reinicio",
    });
    assert.ok(errores.some((e) => e.includes(MARCA_SIN_EQUIPOS)));
  });
});
