/**
 * Integración real PostgreSQL (dev/staging local) — motivo técnico + riesgo de baja.
 * Uso: DATABASE_URL=... npx tsx scripts/motivo-riesgo-pg-itest.ts
 * NO apuntar a producción.
 */
import Module from "node:module";
import path from "node:path";

const orig = (Module as unknown as { _resolveFilename: Function })._resolveFilename;
(Module as unknown as { _resolveFilename: Function })._resolveFilename = function (
  request: string,
  parent: unknown,
  isMain: boolean,
  options: unknown
) {
  if (request === "server-only") {
    return path.join(
      process.cwd(),
      "node_modules/next/dist/compiled/server-only/empty.js"
    );
  }
  return orig.call(this, request, parent, isMain, options);
};

function assertUrlDev(url: string) {
  if (!url.startsWith("postgresql://") && !url.startsWith("postgres://")) {
    throw new Error("DATABASE_URL debe ser PostgreSQL");
  }
  if (/render\.com|railway\.app|amazonaws\.com|neon\.tech/i.test(url)) {
    throw new Error("REFUSED: URL parece remota/producción");
  }
  if (!/127\.0\.0\.1:55433|localhost:55433/.test(url)) {
    throw new Error("REFUSED: solo se permite Postgres local docker :55433 en este script");
  }
}

async function main() {
  const url = process.env.DATABASE_URL || "";
  assertUrlDev(url);

  const { PrismaClient } = await import("@prisma/client");
  type Prioridad = import("@prisma/client").Prioridad;
  const {
    activarRiesgoBaja,
    registrarGestionRiesgoBaja,
    ACCION_ALERTA_RIESGO_BAJA,
    ACCION_RIESGO_BAJA_RESUELTO,
  } = await import("../src/lib/motivo-tecnico/riesgo-baja");
  const { validarPrioridadConRiesgoActivo } = await import(
    "../src/lib/motivo-tecnico/reglas-patch"
  );

  const prisma = new PrismaClient();
  const results: Array<{ name: string; ok: boolean; detail: string }> = [];
  const pass = (name: string, detail: string) => {
    results.push({ name, ok: true, detail });
    console.log(`PASS  ${name} — ${detail}`);
  };
  const fail = (name: string, detail: string) => {
    results.push({ name, ok: false, detail });
    console.error(`FAIL  ${name} — ${detail}`);
  };

  try {
    const usuario = await prisma.usuario.findFirst({
      where: { rol: { in: ["SUPERVISOR", "ADMIN"] } },
    });
    const cliente = await prisma.cliente.findFirst({ where: { activo: true } });
    const tecnico = await prisma.tecnico.findFirst();
    if (!usuario || !cliente || !tecnico) {
      throw new Error(
        "Faltan Usuario SUPERVISOR/ADMIN, Cliente activo o Tecnico en la BD local"
      );
    }

    // 1. Crear + activar en TX
    const codigo = `ITEST-RB-${Date.now()}`;
    try {
      const ticket = await prisma.$transaction(async (tx) => {
        const created = await tx.ticket.create({
          data: {
            codigo,
            clienteId: cliente.id,
            tecnicoId: tecnico.id,
            tipo: "SOPORTE",
            prioridad: "ALTA",
            estado: "PENDIENTE",
            motivo:
              "INTERNET SIN SERVICIO — EQUIPO SIN SEÑAL ÓPTICA — ONU SIN LUZ PON DESDE LAS 08:30",
            motivoCategoria: "INTERNET_SIN_SERVICIO",
            motivoProblema: "SIN_SENAL_OPTICA",
            motivoDetalle: "ONU SIN LUZ PON DESDE LAS 08:30 EN TODO EL DOMICILIO",
            motivoImpacto: "TOTAL_DOMICILIO",
            clienteSituacion: "INTENCION_CANCELAR",
            tecnicos: { create: [{ tecnicoId: tecnico.id }] },
          },
        });
        await tx.eventoTicket.create({
          data: {
            ticketId: created.id,
            usuarioId: usuario.id,
            accion: "TICKET_CREADO",
            metadata: JSON.stringify({ codigo, test: true }),
          },
        });
        await activarRiesgoBaja({
          ticketId: created.id,
          usuarioId: usuario.id,
          motivoInconformidad: "CLIENTE AMENAZA CON CANCELAR POR FALTA DE ATENCION",
          db: tx,
        });
        return created;
      });
      const fresh = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
      const alertas = await prisma.eventoTicket.count({
        where: { ticketId: ticket.id, accion: ACCION_ALERTA_RIESGO_BAJA },
      });
      if (
        fresh.clienteRiesgoBaja &&
        fresh.prioridad === "ALTA" &&
        fresh.clienteSituacion === "INTENCION_CANCELAR" &&
        alertas === 1 &&
        !fresh.clienteRiesgoBajaResueltoEn
      ) {
        pass(
          "crear_intencion_cancelar",
          `ticket=${fresh.codigo} prioridad=${fresh.prioridad} alertas=${alertas}`
        );
      } else {
        fail(
          "crear_intencion_cancelar",
          JSON.stringify({
            riesgo: fresh.clienteRiesgoBaja,
            prioridad: fresh.prioridad,
            situacion: fresh.clienteSituacion,
            alertas,
          })
        );
      }
    } catch (e) {
      fail("crear_intencion_cancelar", e instanceof Error ? e.message : String(e));
    }

    // 2. Rollback
    const codigoRollback = `ITEST-RB-ROLL-${Date.now()}`;
    try {
      let threw = false;
      try {
        await prisma.$transaction(async (tx) => {
          const created = await tx.ticket.create({
            data: {
              codigo: codigoRollback,
              clienteId: cliente.id,
              tecnicoId: tecnico.id,
              tipo: "SOPORTE",
              prioridad: "ALTA",
              estado: "PENDIENTE",
              motivo: "ROLLBACK TEST MOTIVO ESTRUCTURADO CON DETALLE CONCRETO",
              motivoCategoria: "LENTITUD",
              motivoProblema: "VELOCIDAD_BAJA",
              motivoDetalle: "VELOCIDAD INFERIOR A LA CONTRATADA DESDE AYER POR LA TARDE",
              motivoImpacto: "PARCIAL",
              clienteSituacion: "INTENCION_CANCELAR",
              tecnicos: { create: [{ tecnicoId: tecnico.id }] },
            },
          });
          await tx.eventoTicket.create({
            data: {
              ticketId: created.id,
              usuarioId: usuario.id,
              accion: "TICKET_CREADO",
              metadata: "{}",
            },
          });
          throw new Error("FALLO_CONTROLADO_ACTIVACION");
        });
      } catch (e) {
        threw = e instanceof Error && e.message.includes("FALLO_CONTROLADO_ACTIVACION");
        if (!threw) throw e;
      }
      const orphan = await prisma.ticket.findFirst({ where: { codigo: codigoRollback } });
      if (threw && !orphan) {
        pass("rollback_activacion", "ticket no persistió tras fallo en la TX");
      } else {
        fail("rollback_activacion", `threw=${threw} orphan=${orphan?.id ?? "none"}`);
      }
    } catch (e) {
      fail("rollback_activacion", e instanceof Error ? e.message : String(e));
    }

    // 3. Activaciones concurrentes
    try {
      const t = await prisma.ticket.create({
        data: {
          codigo: `ITEST-RB-CONC-A-${Date.now()}`,
          clienteId: cliente.id,
          tecnicoId: tecnico.id,
          tipo: "SOPORTE",
          prioridad: "MEDIA",
          estado: "PENDIENTE",
          motivo: "CONCURRENCIA ACTIVACION CON DETALLE TECNICO SUFICIENTE",
          motivoCategoria: "INTERMITENCIA",
          motivoProblema: "INTERMITENTE",
          motivoDetalle: "CORTES CADA 10 MINUTOS DESDE ESTA MAÑANA EN TODO EL HOGAR",
          motivoImpacto: "PARCIAL",
          clienteSituacion: "INTENCION_CANCELAR",
          tecnicos: { create: [{ tecnicoId: tecnico.id }] },
        },
      });
      await Promise.all([
        activarRiesgoBaja({
          ticketId: t.id,
          usuarioId: usuario.id,
          motivoInconformidad: "MOTIVO INCONFORMIDAD CONCURRENTE A",
        }),
        activarRiesgoBaja({
          ticketId: t.id,
          usuarioId: usuario.id,
          motivoInconformidad: "MOTIVO INCONFORMIDAD CONCURRENTE B",
        }),
        activarRiesgoBaja({
          ticketId: t.id,
          usuarioId: usuario.id,
          motivoInconformidad: "MOTIVO INCONFORMIDAD CONCURRENTE C",
        }),
      ]);
      const fresh = await prisma.ticket.findUniqueOrThrow({ where: { id: t.id } });
      const alertas = await prisma.eventoTicket.count({
        where: { ticketId: t.id, accion: ACCION_ALERTA_RIESGO_BAJA },
      });
      if (fresh.clienteRiesgoBaja && fresh.prioridad === "ALTA" && alertas === 1) {
        pass("activaciones_concurrentes", `alertas=${alertas} prioridad=${fresh.prioridad}`);
      } else {
        fail(
          "activaciones_concurrentes",
          `alertas=${alertas} riesgo=${fresh.clienteRiesgoBaja} prio=${fresh.prioridad}`
        );
      }
    } catch (e) {
      fail("activaciones_concurrentes", e instanceof Error ? e.message : String(e));
    }

    // 4 + 6. RECUPERADO concurrente + gestión post-resuelto
    try {
      const t = await prisma.ticket.create({
        data: {
          codigo: `ITEST-RB-CONC-R-${Date.now()}`,
          clienteId: cliente.id,
          tecnicoId: tecnico.id,
          tipo: "SOPORTE",
          prioridad: "ALTA",
          estado: "PENDIENTE",
          motivo: "CONCURRENCIA RECUPERADO CON DETALLE TECNICO SUFICIENTE",
          motivoCategoria: "ATENCION_PENDIENTE",
          motivoProblema: "OTRO",
          motivoProblemaOtro: "SEGUIMIENTO DE ATENCION PENDIENTE",
          motivoDetalle: "CLIENTE ESPERA RESPUESTA TECNICA DESDE HACE TRES DIAS",
          motivoImpacto: "URGENTE_RIESGO",
          clienteSituacion: "INTENCION_CANCELAR",
          clienteRiesgoBaja: true,
          clienteRiesgoBajaMotivo: "AMENAZA CANCELACION POR DEMORA",
          clienteRiesgoBajaActivadoEn: new Date(),
          clienteRiesgoBajaActivadoPorId: usuario.id,
          tecnicos: { create: [{ tecnicoId: tecnico.id }] },
        },
      });
      await prisma.eventoTicket.create({
        data: {
          ticketId: t.id,
          usuarioId: usuario.id,
          accion: ACCION_ALERTA_RIESGO_BAJA,
          metadata: "{}",
        },
      });

      const settled = await Promise.allSettled([
        registrarGestionRiesgoBaja({
          ticketId: t.id,
          usuarioId: usuario.id,
          usuarioNombre: usuario.nombre,
          resultado: "RECUPERADO",
          observaciones: "Cliente recuperado tras visita y explicacion del plan",
        }),
        registrarGestionRiesgoBaja({
          ticketId: t.id,
          usuarioId: usuario.id,
          usuarioNombre: usuario.nombre,
          resultado: "RECUPERADO",
          observaciones: "Cliente recuperado tras visita y explicacion del plan",
        }),
      ]);
      const ok = settled.filter((s) => s.status === "fulfilled").length;
      const rejected = settled.filter((s) => s.status === "rejected").length;
      const fresh = await prisma.ticket.findUniqueOrThrow({ where: { id: t.id } });
      const resoluciones = await prisma.eventoTicket.count({
        where: { ticketId: t.id, accion: ACCION_RIESGO_BAJA_RESUELTO },
      });
      if (
        ok === 1 &&
        rejected === 1 &&
        resoluciones === 1 &&
        fresh.clienteRiesgoBajaResueltoEn &&
        fresh.clienteRiesgoBajaResueltoPorId
      ) {
        pass(
          "recuperado_concurrente",
          `ok=${ok} rejected=${rejected} resoluciones=${resoluciones}`
        );
      } else {
        fail(
          "recuperado_concurrente",
          `ok=${ok} rejected=${rejected} resoluciones=${resoluciones} resueltoEn=${String(fresh.clienteRiesgoBajaResueltoEn)}`
        );
      }

      try {
        await registrarGestionRiesgoBaja({
          ticketId: t.id,
          usuarioId: usuario.id,
          usuarioNombre: usuario.nombre,
          resultado: "CONTINUA_RIESGO",
          observaciones: "Intento posterior ilegal",
        });
        fail("gestion_post_resuelto", "debió rechazar pero aceptó");
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (/ya fue resuelto|no se aceptan/i.test(msg)) {
          pass("gestion_post_resuelto", msg);
        } else {
          fail("gestion_post_resuelto", msg);
        }
      }
    } catch (e) {
      fail("recuperado_concurrente", e instanceof Error ? e.message : String(e));
    }

    // 5. Prioridad bloqueada
    try {
      await prisma.ticket.create({
        data: {
          codigo: `ITEST-RB-PRIO-${Date.now()}`,
          clienteId: cliente.id,
          tecnicoId: tecnico.id,
          tipo: "SOPORTE",
          prioridad: "ALTA",
          estado: "PENDIENTE",
          motivo: "PRIORIDAD BLOQUEADA CON DETALLE TECNICO SUFICIENTE AQUI",
          motivoCategoria: "ONU_ONT",
          motivoProblema: "EQUIPO_APAGADO",
          motivoDetalle: "ONU SIN ENERGIA DESDE LAS 07:00 SEGUN EL CLIENTE",
          motivoImpacto: "TOTAL_DOMICILIO",
          clienteSituacion: "INTENCION_CANCELAR",
          clienteRiesgoBaja: true,
          clienteRiesgoBajaMotivo: "QUIERE CANCELAR",
          clienteRiesgoBajaActivadoEn: new Date(),
          clienteRiesgoBajaActivadoPorId: usuario.id,
          tecnicos: { create: [{ tecnicoId: tecnico.id }] },
        },
      });
      const check = validarPrioridadConRiesgoActivo({
        ticket: {
          clienteRiesgoBaja: true,
          clienteRiesgoBajaResueltoEn: null,
          prioridad: "ALTA",
        },
        prioridadNueva: "MEDIA",
      });
      if (!check.ok) {
        pass("prioridad_bloqueada", check.error);
      } else {
        fail("prioridad_bloqueada", "la regla permitió MEDIA con riesgo activo");
      }
    } catch (e) {
      fail("prioridad_bloqueada", e instanceof Error ? e.message : String(e));
    }

    const failed = results.filter((r) => !r.ok);
    console.log("\n=== RESUMEN ===");
    console.log(
      `total=${results.length} pass=${results.length - failed.length} fail=${failed.length}`
    );
    if (failed.length) process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
