import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  alertaRiesgoBajaActiva,
  esIntencionCancelar,
  prioridadSugeridaPorImpacto,
  validarClienteSituacion,
  validarMotivoEstructurado,
} from "./validacion";
import { esTextoGenerico } from "./catalogo";

describe("motivo técnico estructurado", () => {
  it("acepta motivo completo y genera texto descriptivo", () => {
    const r = validarMotivoEstructurado({
      categoria: "INTERNET_SIN_SERVICIO",
      problema: "SIN_SENAL_OPTICA",
      detalle: "Cliente sin conexion desde las 08:30, ONU sin luz PON en todo el domicilio",
      impacto: "TOTAL_DOMICILIO",
    });
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.match(r.motivoGenerado, /Internet sin servicio/i);
      assert.match(r.motivoGenerado, /sin señal óptica|SIN_SENAL|ONU/i);
      assert.match(r.motivoGenerado, /08:30/);
    }
  });

  it("rechaza motivo genérico", () => {
    const r = validarMotivoEstructurado({
      categoria: "INTERNET_SIN_SERVICIO",
      problema: "SIN_CONEXION",
      detalle: "internet",
      impacto: "PARCIAL",
    });
    assert.equal(r.ok, false);
  });

  it("exige explicación en categoría Otro", () => {
    const r = validarMotivoEstructurado({
      categoria: "OTRO",
      categoriaOtro: "x",
      problema: "OTRO",
      problemaOtro: "falla rara del nodo de acceso en el sector norte",
      detalle: "Cliente reporta caidas cada 10 minutos desde ayer por la tarde",
      impacto: "PARCIAL",
    });
    assert.equal(r.ok, false);
  });

  it("acepta Otro con explicación concreta", () => {
    const r = validarMotivoEstructurado({
      categoria: "OTRO",
      categoriaOtro: "Problema de IPTV en decodificador",
      problema: "OTRO",
      problemaOtro: "Canales en negro tras reinicio",
      detalle: "Decodificador reinicia solo y pierde canales desde anoche",
      impacto: "PARCIAL",
    });
    assert.equal(r.ok, true);
  });

  it("rechaza campos obligatorios faltantes", () => {
    const r = validarMotivoEstructurado({
      categoria: "WIFI",
      problema: "",
      detalle: "",
      impacto: "",
    });
    assert.equal(r.ok, false);
    if (!r.ok) assert.ok(r.faltantes.length >= 2);
  });
});

describe("situación del cliente y prioridad", () => {
  it("detecta intención de cancelar", () => {
    assert.equal(esIntencionCancelar("INTENCION_CANCELAR"), true);
    assert.equal(esIntencionCancelar("CONFORME"), false);
  });

  it("valida situación", () => {
    assert.equal(validarClienteSituacion("INCONFORME").ok, true);
    assert.equal(validarClienteSituacion("").ok, false);
  });

  it("sugiere ALTA en riesgo o interrupción total", () => {
    assert.equal(prioridadSugeridaPorImpacto("TOTAL_DOMICILIO", false), "ALTA");
    assert.equal(prioridadSugeridaPorImpacto("PARCIAL", true), "ALTA");
    assert.equal(prioridadSugeridaPorImpacto("PARCIAL", false), "MEDIA");
    assert.equal(prioridadSugeridaPorImpacto("SIN_IMPACTO_MAYOR", false), "BAJA");
  });
});

describe("esTextoGenerico", () => {
  it("marca textos cortos o genéricos", () => {
    assert.equal(esTextoGenerico("revisar"), true);
    assert.equal(esTextoGenerico("no funciona"), true);
    assert.equal(
      esTextoGenerico("ONU sin señal óptica desde las 08:30 en todo el domicilio"),
      false
    );
  });
});

describe("alertaRiesgoBajaActiva", () => {
  it("activa solo con flag y sin resolución", () => {
    assert.equal(
      alertaRiesgoBajaActiva({
        clienteRiesgoBaja: true,
        clienteRiesgoBajaResueltoEn: null,
      }),
      true
    );
    assert.equal(
      alertaRiesgoBajaActiva({
        clienteRiesgoBaja: true,
        clienteRiesgoBajaResueltoEn: new Date().toISOString(),
      }),
      false
    );
  });
});
