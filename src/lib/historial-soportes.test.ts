import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  construirResumenHistorial,
  evaluarAlertaHistorial,
  normalizarMotivoHistorial,
  paginarLista,
  rangoFechaPreset,
  type TicketHistorialLite,
} from "./historial-soportes";

function t(partial: Partial<TicketHistorialLite> & { id?: string }): TicketHistorialLite {
  return {
    id: partial.id ?? "x",
    codigo: partial.codigo ?? "ST-1",
    tipo: "SOPORTE",
    estado: "CERRADO",
    motivo: partial.motivo ?? "Sin internet",
    createdAt: partial.createdAt ?? new Date(),
    duracionSegundos: partial.duracionSegundos ?? 2800,
    tecnicos: partial.tecnicos ?? ["Juan"],
    creadoMs: partial.creadoMs,
    cerradoMs: partial.cerradoMs,
  };
}

const now = new Date("2026-08-15T12:00:00-05:00");

describe("normalizarMotivoHistorial", () => {
  it("unifica mayúsculas y espacios", () => {
    assert.equal(normalizarMotivoHistorial("  Intermitencia  "), "INTERMITENCIA");
    assert.equal(normalizarMotivoHistorial("intermitencia"), "INTERMITENCIA");
  });
});

describe("rangoFechaPreset", () => {
  it("resuelve 30d y año", () => {
    const r = rangoFechaPreset("30d", now);
    assert.ok(r);
    assert.equal(Math.round((now.getTime() - r.desde.getTime()) / 86400000), 30);
    const y = rangoFechaPreset("anio", now);
    assert.ok(y);
    assert.equal(y.desde.getFullYear(), 2026);
    assert.equal(y.desde.getMonth(), 0);
  });
});

describe("PRUEBA 7 Estadísticas", () => {
  it("cuenta totales, ventanas, promedio y técnico más frecuente", () => {
    const tickets = [
      t({
        id: "1",
        codigo: "ST-1",
        motivo: "Sin internet",
        createdAt: new Date("2026-08-14T10:00:00-05:00"),
        duracionSegundos: 3600,
        tecnicos: ["Juan"],
      }),
      t({
        id: "2",
        codigo: "ST-2",
        motivo: "Intermitencia",
        createdAt: new Date("2026-07-01T10:00:00-05:00"),
        duracionSegundos: 1800,
        tecnicos: ["Pedro"],
      }),
      t({
        id: "3",
        codigo: "ST-3",
        motivo: "Cambio ONU",
        createdAt: new Date("2026-08-01T10:00:00-05:00"),
        duracionSegundos: 2400,
        tecnicos: ["Juan"],
      }),
    ];
    const r = construirResumenHistorial(tickets, now);
    assert.equal(r.total, 3);
    assert.equal(r.ultimos30, 2);
    assert.equal(r.tecnicoMasFrecuente?.nombre, "Juan");
    assert.equal(r.tecnicoMasFrecuente?.cantidad, 2);
    assert.equal(r.tiempoPromedioMin, 43);
  });
});

describe("PRUEBA 9 Paginación", () => {
  it("página historiales grandes sin cargar de más", () => {
    const muchos = Array.from({ length: 1000 }, (_, i) => ({ id: i }));
    const r = paginarLista(muchos, 3, 20);
    assert.equal(r.total, 1000);
    assert.equal(r.pages, 50);
    assert.equal(r.items.length, 20);
    assert.equal(r.items[0].id, 40);
  });
});

describe("PRUEBA 8 Reincidencia", () => {
  it("marca rojo si el mismo motivo se repite", () => {
    const recurrentes = [1, 2, 3, 4].map((n) =>
      t({
        id: String(n),
        motivo: "Intermitencia",
        createdAt: new Date(now.getTime() - n * 2 * 86400000),
        tecnicos: ["Juan"],
      })
    );
    const alertaR = evaluarAlertaHistorial(recurrentes, now);
    assert.equal(alertaR.nivel, "rojo");
    assert.equal(alertaR.reincidencia, true);
    assert.match(alertaR.detalle, /INTERMITENCIA/);
    const resumenR = construirResumenHistorial(recurrentes, now);
    assert.equal(resumenR.reincidencias, 4);
  });

  it("amarillo si hay varios tickets con problemas distintos", () => {
    const distintos = [
      t({ id: "a", motivo: "Sin internet", createdAt: new Date(now.getTime() - 1 * 86400000) }),
      t({ id: "b", motivo: "Cambio clave", createdAt: new Date(now.getTime() - 2 * 86400000) }),
      t({ id: "c", motivo: "Traslado", createdAt: new Date(now.getTime() - 3 * 86400000) }),
      t({ id: "d", motivo: "Visita comercial", createdAt: new Date(now.getTime() - 4 * 86400000) }),
    ];
    const alertaA = evaluarAlertaHistorial(distintos, now);
    assert.equal(alertaA.nivel, "amarillo");
    assert.equal(alertaA.reincidencia, false);
  });

  it("verde sin acumulación reciente", () => {
    const pocos = [
      t({
        id: "z",
        motivo: "ONU dañada",
        createdAt: new Date("2026-01-10T10:00:00-05:00"),
      }),
    ];
    const alertaV = evaluarAlertaHistorial(pocos, now);
    assert.equal(alertaV.nivel, "verde");
  });
});
