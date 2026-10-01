import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  calcularCsat,
  decisionEncuesta,
  estadoTrasFalloEnvio,
  esAlertaInsatisfaccion,
  generarTokenEncuesta,
  httpTrasUpdateRespuesta,
  muestraSuficiente,
  resumenDesdeConteos,
  origenPublico,
  puedeConsultarSatisfaccion,
  puedeMutarEncuesta,
  tokenEncuestaValido,
  urlEncuestaPublica,
  validarRespuestaEncuesta,
} from "./reglas";

describe("encuesta al cerrar la OT", () => {
  it("OT cerrada y aprobada crea encuesta", () => {
    assert.equal(
      decisionEncuesta({
        existe: false,
        estado: "CERRADO",
        estadoRevision: "APROBADO",
        cierrePorJustificacion: false,
      }),
      "CREAR"
    );
  });

  it("OT abierta no crea encuesta", () => {
    assert.equal(
      decisionEncuesta({
        existe: false,
        estado: "EN_PROCESO",
        estadoRevision: null,
        cierrePorJustificacion: false,
      }),
      "NO_CERRADA"
    );
  });

  it("OT finalizada pendiente de revisión no crea encuesta", () => {
    assert.equal(
      decisionEncuesta({
        existe: false,
        estado: "FINALIZADO",
        estadoRevision: "PENDIENTE_REVISION",
        cierrePorJustificacion: false,
      }),
      "NO_CERRADA"
    );
  });

  it("OT cerrada nuevamente no duplica la encuesta", () => {
    assert.equal(
      decisionEncuesta({
        existe: true,
        estado: "CERRADO",
        estadoRevision: "APROBADO",
        cierrePorJustificacion: false,
      }),
      "YA_EXISTE"
    );
  });
});

describe("token", () => {
  it("genera un token largo, único e impredecible", () => {
    const a = generarTokenEncuesta();
    const b = generarTokenEncuesta();
    assert.equal(tokenEncuestaValido(a), true);
    assert.notEqual(a, b);
    assert.equal(a.includes("."), false);
  });

  it("rechaza un token inválido", () => {
    assert.equal(tokenEncuestaValido("corto"), false);
    assert.equal(tokenEncuestaValido("a".repeat(43) + "!"), false);
  });

  it("la URL pública no incluye el id de la OT", () => {
    const token = generarTokenEncuesta();
    const url = urlEncuestaPublica(token, "https://op.infinity.ec/login?app=tecnico");
    assert.equal(url, `https://op.infinity.ec/satisfaccion/${token}`);
    assert.equal(url.includes("ticket"), false);
    assert.equal(origenPublico("https://op.infinity.ec/login?app=tecnico"), "https://op.infinity.ec");
  });
});

describe("respuesta", () => {
  const base = { ratingGeneral: 5, ratingTecnico: 4, solucionado: "COMPLETAMENTE", comentario: "Bien" };

  it("acepta rating 1 y rating 5", () => {
    assert.equal(validarRespuestaEncuesta({ ...base, ratingGeneral: 1 }).ok, true);
    assert.equal(validarRespuestaEncuesta({ ...base, ratingGeneral: 5 }).ok, true);
  });

  it("rechaza rating 0 y rating 6", () => {
    assert.equal(validarRespuestaEncuesta({ ...base, ratingGeneral: 0 }).ok, false);
    assert.equal(validarRespuestaEncuesta({ ...base, ratingGeneral: 6 }).ok, false);
  });

  it("rechaza un comentario que supera el límite", () => {
    const resultado = validarRespuestaEncuesta({ ...base, comentario: "a".repeat(1001) });
    assert.equal(resultado.ok, false);
  });

  it("el token no permite cambiar ticketId ni tecnicoId", () => {
    assert.equal(validarRespuestaEncuesta({ ...base, ticketId: "otro" }).ok, false);
    assert.equal(validarRespuestaEncuesta({ ...base, tecnicoId: "otro" }).ok, false);
  });

  it("no acepta el CSAT calculado por el cliente", () => {
    assert.equal(validarRespuestaEncuesta({ ...base, csat: 100 }).ok, false);
  });

  it("rechaza fechas y estado enviados por el cliente", () => {
    assert.equal(validarRespuestaEncuesta({ ...base, createdAt: "2020-01-01" }).ok, false);
    assert.equal(validarRespuestaEncuesta({ ...base, answeredAt: "2020-01-01" }).ok, false);
    assert.equal(validarRespuestaEncuesta({ ...base, status: "ANSWERED" }).ok, false);
  });
});

describe("CSAT", () => {
  it("100 respuestas con 80 de 4 o 5 estrellas dan 80%", () => {
    const ratings = [...Array(80).fill(5), ...Array(20).fill(2)];
    assert.equal(calcularCsat(ratings), 80);
    const agregado = resumenDesdeConteos({
      total: 100,
      porEstado: { ANSWERED: 100 },
      porRating: { 5: 80, 2: 20 },
      porSolucion: { COMPLETAMENTE: 90, NO: 10 },
    });
    assert.equal(agregado.csat, 80);
    assert.equal(agregado.promedio, 4.4);
    assert.equal(agregado.solucion, 90);
    assert.equal(agregado.tasaRespuesta, 100);
  });
});

describe("seguridad de roles", () => {
  it("el técnico no puede modificar ni eliminar encuestas", () => {
    assert.equal(puedeMutarEncuesta("TECNICO"), false);
    assert.equal(puedeConsultarSatisfaccion("TECNICO"), false);
  });

  it("un usuario sin permiso no consulta el dashboard", () => {
    assert.equal(puedeConsultarSatisfaccion("HELP_DESK"), false);
    assert.equal(puedeConsultarSatisfaccion("CLIENTE"), false);
    assert.equal(puedeConsultarSatisfaccion(undefined), false);
  });

  it("supervisor y admin consultan", () => {
    assert.equal(puedeConsultarSatisfaccion("SUPERVISOR"), true);
    assert.equal(puedeConsultarSatisfaccion("ADMIN"), true);
  });
});

describe("cierre y envío", () => {
  it("un fallo de WhatsApp deja la encuesta pendiente y no reabre la OT", () => {
    assert.equal(estadoTrasFalloEnvio(), "PENDING");
  });

  it("una calificación baja o sin solución es alerta", () => {
    assert.equal(esAlertaInsatisfaccion({ ratingGeneral: 2, solucionado: "COMPLETAMENTE" }), true);
    assert.equal(esAlertaInsatisfaccion({ ratingGeneral: 5, solucionado: "NO" }), true);
    assert.equal(esAlertaInsatisfaccion({ ratingGeneral: 4, solucionado: "PARCIALMENTE" }), false);
  });

  it("menos de 10 respuestas es muestra insuficiente", () => {
    assert.equal(muestraSuficiente(9), false);
    assert.equal(muestraSuficiente(10), true);
  });
});

describe("concurrencia de respuesta", () => {
  it("una sola actualización gana y la segunda recibe 409", () => {
    assert.equal(httpTrasUpdateRespuesta(1), 200);
    assert.equal(httpTrasUpdateRespuesta(0), 409);
  });
});

describe("unicidad en memoria", () => {
  it("una segunda creación para la misma OT no inserta otra encuesta", () => {
    const store = new Map<string, string>();
    function crear(ticketId: string, cerrada: boolean) {
      const decision = decisionEncuesta({
        existe: store.has(ticketId),
        estado: cerrada ? "CERRADO" : "EN_PROCESO",
        estadoRevision: cerrada ? "APROBADO" : null,
        cierrePorJustificacion: false,
      });
      if (decision !== "CREAR") return decision;
      store.set(ticketId, generarTokenEncuesta());
      return "CREADA";
    }
    assert.equal(crear("ot-1", true), "CREADA");
    assert.equal(crear("ot-1", true), "YA_EXISTE");
    assert.equal(store.size, 1);
  });
});
