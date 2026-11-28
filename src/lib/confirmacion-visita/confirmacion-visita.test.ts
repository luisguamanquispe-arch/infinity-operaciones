import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  calcularExpiracionConfirmacion,
  derivarVistaConfirmacionVisita,
  esTokenConfirmacionActivo,
  evaluarDesplazamientoTicket,
  FECHA_ACTIVACION_CONFIRMACION_VISITA,
  MARCA_HISTORICO_EN_CAMINO,
  mensajeWhatsappConfirmacion,
  tokenConfirmacionValido,
} from "./reglas";
import {
  asegurarSolicitudConfirmacionVisita,
  cancelarConfirmacionSupervisor,
  confirmarManualSupervisor,
  consultarConfirmacionPorToken,
  invalidarConfirmacionPorCambioHorario,
  marcarExentoPresenciaSupervisor,
  marcarSinRespuestaSupervisor,
  registrarEnCaminoTecnico,
  responderConfirmacionPorToken,
  sincronizarConfirmacionPorCambioTicket,
  type ConfirmacionRowLike,
  type ConfirmacionVisitaDbLike,
  type TicketParaConfirmacionLike,
} from "./servicio";
import { generarTokenConfirmacion, urlConfirmacionVisitaPublica } from "./token";
import {
  IP_FALLBACK_SEGURA,
  ipConfiableDeRequest,
  limitarTasaConfirmacion,
  limpiarRateLimitConfirmacionParaTests,
} from "./rate-limit";

function crearDbConfirmacionEnMemoria(
  ticketsIniciales: TicketParaConfirmacionLike[],
  opts?: {
    inyectarP2002EnSiguienteUpsert?: boolean;
    inyectarP2002EnSiguienteCreate?: boolean;
    antesDeUpdateMany?: () => Promise<void> | void;
  }
) {
  const tickets = new Map<string, TicketParaConfirmacionLike>();
  for (const t of ticketsIniciales) tickets.set(t.id, { ...t });
  const rowsByTicket = new Map<string, ConfirmacionRowLike>();
  const eventos: { ticketId: string; usuarioId: string | null; accion: string; metadata?: string }[] = [];
  let seq = 0;
  let pendingP2002Upsert = Boolean(opts?.inyectarP2002EnSiguienteUpsert);
  let pendingP2002Create = Boolean(opts?.inyectarP2002EnSiguienteCreate);
  let hookAntesDeUpdateMany = opts?.antesDeUpdateMany;
  let enHookUpdateMany = false;

  function makeRow(
    ticketId: string,
    data: Record<string, unknown>,
    prev?: ConfirmacionRowLike
  ): ConfirmacionRowLike {
    const base: ConfirmacionRowLike = prev ?? {
      id: `cv_${++seq}`,
      ticketId,
      estado: "PENDIENTE_CONFIRMACION",
      requierePresencia: true,
      exentoMotivo: null,
      exentoPorUsuarioId: null,
      exentoEn: null,
      token: null,
      tokenExpiraEn: null,
      tokenRevocadoEn: null,
      programadoEnConfirmado: null,
      confirmadoEn: null,
      confirmadoPorCanal: null,
      confirmadoPorUsuarioId: null,
      confirmadoPorNombre: null,
      personaRecibe: null,
      horarioSolicitado: null,
      observacionCliente: null,
      respondidoEn: null,
      enCaminoEn: null,
      enCaminoPorTecnicoId: null,
      enCaminoPorUsuarioId: null,
      ultimoEnvioEn: null,
      ultimoEnvioCanal: null,
      ultimoEnvioEstado: null,
      enviosCount: 0,
    };
    return { ...base, ...(data as Partial<ConfirmacionRowLike>) };
  }

  function matchWhere(row: ConfirmacionRowLike, where: Record<string, unknown>): boolean {
    const tk = tickets.get(row.ticketId);
    for (const [k, cond] of Object.entries(where)) {
      if (k === "ticket" && cond && typeof cond === "object") {
        if (!tk) return false;
        for (const [tkKey, tkCond] of Object.entries(cond as Record<string, unknown>)) {
          const val = (tk as unknown as Record<string, unknown>)[tkKey];
          if (tkCond && typeof tkCond === "object" && "notIn" in tkCond) {
            if ((tkCond as { notIn: unknown[] }).notIn.includes(val)) return false;
          } else if (tkCond instanceof Date) {
            if (!(val instanceof Date) || val.getTime() !== tkCond.getTime()) return false;
          } else if (val !== tkCond) {
            return false;
          }
        }
        continue;
      }

      const val = (row as unknown as Record<string, unknown>)[k];
      if (cond && typeof cond === "object" && "notIn" in cond) {
        if ((cond as { notIn: unknown[] }).notIn.includes(val)) return false;
      } else if (cond instanceof Date) {
        if (!(val instanceof Date) || val.getTime() !== cond.getTime()) return false;
      } else if (val !== cond) {
        return false;
      }
    }
    return true;
  }

  const db: ConfirmacionVisitaDbLike = {
    async $transaction(fn) {
      return fn(db);
    },
    ticket: {
      async findUnique({ where }) {
        const t = tickets.get(where.id);
        if (!t) return null;
        return { ...t, confirmacionVisita: rowsByTicket.get(t.id) ?? null };
      },
    },
    ticketConfirmacionVisita: {
      async findUnique({ where }) {
        let row: ConfirmacionRowLike | undefined;
        if (where.ticketId) {
          row = rowsByTicket.get(where.ticketId);
        } else if (where.token) {
          for (const r of rowsByTicket.values()) {
            if (r.token === where.token) {
              row = r;
              break;
            }
          }
        }
        if (!row) return null;
        const tk = tickets.get(row.ticketId);
        return { ...row, ticket: tk ? { ...tk } : undefined };
      },
      async create({ data }) {
        const ticketId = String(data.ticketId);
        if (pendingP2002Create) {
          pendingP2002Create = false;
          // Simula que otra request concurrente insertó justo antes
          if (!rowsByTicket.has(ticketId)) {
            rowsByTicket.set(ticketId, makeRow(ticketId, data));
          }
          const err = new Error("Unique constraint failed") as Error & { code?: string };
          err.code = "P2002";
          throw err;
        }
        if (rowsByTicket.has(ticketId)) {
          const err = new Error("Unique constraint failed") as Error & { code?: string };
          err.code = "P2002";
          throw err;
        }
        const next = makeRow(ticketId, data);
        rowsByTicket.set(ticketId, next);
        return { ...next };
      },
      async upsert({ where, create, update }) {
        if (pendingP2002Upsert) {
          pendingP2002Upsert = false;
          // Simula creación concurrente por otra transacción justo antes del INSERT
          if (!rowsByTicket.has(where.ticketId)) {
            rowsByTicket.set(where.ticketId, makeRow(where.ticketId, create));
          }
          const err = new Error("Unique constraint failed") as Error & { code?: string };
          err.code = "P2002";
          throw err;
        }
        const prev = rowsByTicket.get(where.ticketId);
        const next = prev ? makeRow(where.ticketId, update, prev) : makeRow(where.ticketId, create);
        rowsByTicket.set(where.ticketId, next);
        return { ...next };
      },
      async update({ where, data }) {
        const prev = rowsByTicket.get(where.ticketId);
        if (!prev) throw new Error("Row not found");
        const next = makeRow(where.ticketId, data, prev);
        rowsByTicket.set(where.ticketId, next);
        return { ...next };
      },
      async updateMany({ where, data }) {
        if (hookAntesDeUpdateMany && !enHookUpdateMany) {
          enHookUpdateMany = true;
          try {
            await hookAntesDeUpdateMany();
          } finally {
            enHookUpdateMany = false;
          }
        }
        let count = 0;
        for (const [tid, row] of rowsByTicket.entries()) {
          if (matchWhere(row, where)) {
            rowsByTicket.set(tid, makeRow(tid, data, row));
            count++;
          }
        }
        return { count };
      },
    },
    eventoTicket: {
      async create({ data }) {
        eventos.push(data);
      },
    },
  };

  return { db, tickets, rowsByTicket, eventos };
}

const tProgramado = new Date("2026-11-27T15:00:00-05:00");
const ahoraBase = new Date("2026-11-27T09:00:00-05:00");
const createdNuevo = new Date("2026-11-27T08:30:00-05:00");
const createdHistorico = new Date("2026-11-20T10:00:00-05:00");

function baseTicket(overrides: Partial<TicketParaConfirmacionLike> = {}): TicketParaConfirmacionLike {
  return {
    id: "tk_1",
    codigo: "ST-2001",
    tipo: "SOPORTE",
    estado: "PENDIENTE",
    programadoEn: tProgramado,
    createdAt: createdNuevo,
    clienteId: "cli_1",
    tecnicoId: "tec_1",
    tecnicos: [{ tecnicoId: "tec_1" }],
    ...overrides,
  };
}

describe("Confirmación de disponibilidad del cliente — auditoría y reglas completas", () => {
  it("1) ticket NUEVO sin fecha programada nace bloqueado y NO puede desplazarse", async () => {
    const tk = baseTicket({ programadoEn: null });
    const { db, rowsByTicket } = crearDbConfirmacionEnMemoria([tk]);

    const row = await asegurarSolicitudConfirmacionVisita({
      ticketId: tk.id,
      programadoEn: null,
      tipo: tk.tipo,
      usuarioId: "sup_1",
      ahora: ahoraBase,
      db,
    });
    assert.ok(row, "Debe crear fila incluso con programadoEn = null");
    assert.equal(row!.estado, "PENDIENTE_CONFIRMACION");
    assert.equal(row!.token, null);

    const res = await registrarEnCaminoTecnico({
      ticket: { ...tk, confirmacionVisita: rowsByTicket.get(tk.id) ?? null },
      session: { id: "u_tec1", rol: "TECNICO", tecnicoId: "tec_1" },
      ahora: ahoraBase,
      db,
    });
    assert.equal(res.ok, false);
    if (!res.ok) {
      assert.equal(res.status, 409);
      assert.equal(res.codigo, "SIN_HORARIO_PROGRAMADO");
    }
  });

  it("2) ticket NUEVO creado desde App Cliente (sin programadoEn) requiere confirmación", async () => {
    const tk = baseTicket({ id: "tk_app", codigo: "ST-APP1", programadoEn: null });
    const { db, rowsByTicket } = crearDbConfirmacionEnMemoria([tk]);
    await asegurarSolicitudConfirmacionVisita({
      ticketId: tk.id,
      programadoEn: null,
      tipo: "SOPORTE",
      usuarioId: "cli_user_1",
      ahora: ahoraBase,
      db,
    });

    const evalRes = evaluarDesplazamientoTicket(tk, rowsByTicket.get(tk.id) ?? null, ahoraBase);
    assert.equal(evalRes.permitido, false);
    assert.equal(evalRes.esHistorico, false);
  });

  it("3) ticket escalado desde Soporte Remoto (sin programadoEn) requiere confirmación", async () => {
    const tk = baseTicket({ id: "tk_sr", codigo: "ST-SR1", programadoEn: null });
    const { db, rowsByTicket } = crearDbConfirmacionEnMemoria([tk]);
    await asegurarSolicitudConfirmacionVisita({
      ticketId: tk.id,
      programadoEn: null,
      tipo: "SOPORTE",
      usuarioId: "hd_1",
      ahora: ahoraBase,
      db,
    });

    const evalRes = evaluarDesplazamientoTicket(tk, rowsByTicket.get(tk.id) ?? null, ahoraBase);
    assert.equal(evalRes.permitido, false);
    assert.equal(evalRes.esHistorico, false);
  });

  it("4) fail-closed: si un ticket NUEVO carece de fila TicketConfirmacionVisita (error BD), NO queda habilitado", async () => {
    const tkNuevo = baseTicket({ id: "tk_sin_fila", createdAt: createdNuevo });
    const evalNuevo = evaluarDesplazamientoTicket(tkNuevo, null, ahoraBase);
    assert.equal(evalNuevo.permitido, false);
    assert.equal(evalNuevo.esHistorico, false);
    assert.equal(evalNuevo.codigoBloqueo, "SIN_SOLICITUD_CONFIRMACION");

    // Incluso si createdAt no está presente (indeterminado), fail-closed
    const tkSinFecha = baseTicket({ id: "tk_sin_created", createdAt: undefined });
    const evalSinFecha = evaluarDesplazamientoTicket(tkSinFecha, null, ahoraBase);
    assert.equal(evalSinFecha.permitido, false);
    assert.equal(evalSinFecha.esHistorico, false);
  });

  it("5) condición de carrera TOCTOU: token antiguo NO puede sobrescribir reprogramación concurrente", async () => {
    const tk = baseTicket();
    const nuevoHorario = new Date("2026-11-28T11:00:00-05:00");
    let solInicialToken = "";

    const { db, tickets, rowsByTicket } = crearDbConfirmacionEnMemoria([tk], {
      antesDeUpdateMany: async () => {
        // Justo entre la lectura del cliente y su updateMany, el supervisor reprograma
        tickets.set(tk.id, { ...tk, programadoEn: nuevoHorario });
        await invalidarConfirmacionPorCambioHorario({
          ticketId: tk.id,
          tipo: tk.tipo,
          programadoEnAnterior: tProgramado,
          programadoEnNuevo: nuevoHorario,
          usuarioId: "sup_1",
          ahora: new Date(ahoraBase.getTime() + 1000),
          db,
        });
      },
    });

    const sol = await asegurarSolicitudConfirmacionVisita({
      ticketId: tk.id,
      programadoEn: tk.programadoEn,
      tipo: tk.tipo,
      usuarioId: "sup_1",
      ahora: ahoraBase,
      db,
    });
    solInicialToken = sol!.token!;

    const res = await responderConfirmacionPorToken({
      token: solInicialToken,
      accion: "CONFIRMAR",
      personaRecibe: "María Pérez",
      ahora: new Date(ahoraBase.getTime() + 2000),
      db,
      omitirNotificacionTecnico: true,
    });
    assert.equal(res.ok, false);
    if (!res.ok) assert.equal(res.status, 410);

    // La fila conserva la reprogramación del supervisor (PENDIENTE con nuevo token y nuevo horario)
    const filaFinal = rowsByTicket.get(tk.id)!;
    assert.equal(filaFinal.estado, "PENDIENTE_CONFIRMACION");
    assert.notEqual(filaFinal.token, solInicialToken);
    assert.equal(filaFinal.programadoEnConfirmado?.toISOString(), nuevoHorario.toISOString());
  });

  it("6) dos respuestas simultáneas del cliente NO duplican eventos", async () => {
    const tk = baseTicket();
    const { db, eventos } = crearDbConfirmacionEnMemoria([tk]);
    const sol = await asegurarSolicitudConfirmacionVisita({
      ticketId: tk.id,
      programadoEn: tk.programadoEn,
      tipo: tk.tipo,
      usuarioId: "sup_1",
      ahora: ahoraBase,
      db,
    });

    const [r1, r2] = await Promise.all([
      responderConfirmacionPorToken({
        token: sol!.token!,
        accion: "CONFIRMAR",
        personaRecibe: "Carlos Vera",
        ahora: ahoraBase,
        db,
        omitirNotificacionTecnico: true,
      }),
      responderConfirmacionPorToken({
        token: sol!.token!,
        accion: "CONFIRMAR",
        personaRecibe: "Carlos Vera",
        ahora: ahoraBase,
        db,
        omitirNotificacionTecnico: true,
      }),
    ]);

    assert.equal(r1.ok, true);
    assert.equal(r2.ok, true);
    const confirmEventos = eventos.filter((e) => e.accion === "CONFIRMACION_VISITA_CONFIRMADA");
    assert.equal(confirmEventos.length, 1);
  });

  it("7) exención revocada al cambiar tipo de trabajo (CORTE exento → INSTALACION y INFRAESTRUCTURA → SOPORTE)", async () => {
    const tkCorte = baseTicket({ id: "tk_corte", tipo: "CORTE" });
    const { db, tickets, rowsByTicket } = crearDbConfirmacionEnMemoria([tkCorte]);

    const ex = await marcarExentoPresenciaSupervisor({
      ticket: tkCorte,
      usuarioId: "sup_1",
      usuarioNombre: "Supervisor",
      rol: "SUPERVISOR",
      motivo: "Corte en caja NAP externa",
      ahora: ahoraBase,
      db,
    });
    assert.equal(ex.ok, true);

    // Incluso si la fila aún dijera EXENTO, evaluarDesplazamientoTicket revalida el tipo actual
    const tkMutado = { ...tkCorte, tipo: "INSTALACION" };
    const evalSinSync = evaluarDesplazamientoTicket(
      tkMutado,
      rowsByTicket.get(tkCorte.id) ?? null,
      ahoraBase
    );
    assert.equal(evalSinSync.permitido, false);
    assert.equal(evalSinSync.codigoBloqueo, "EXENCION_NO_VALIDA_PARA_TIPO");

    // Y sincronizarConfirmacionPorCambioTicket revoca la exención y crea solicitud nueva
    tickets.set(tkCorte.id, tkMutado);
    const sync = await sincronizarConfirmacionPorCambioTicket({
      ticketId: tkCorte.id,
      tipoAnterior: "CORTE",
      tipoNuevo: "INSTALACION",
      programadoEnAnterior: tProgramado,
      programadoEnNuevo: tProgramado,
      usuarioId: "sup_1",
      ahora: ahoraBase,
      db,
    });
    assert.equal(sync.invalidada, true);
    assert.equal(rowsByTicket.get(tkCorte.id)?.estado, "PENDIENTE_CONFIRMACION");
    assert.equal(rowsByTicket.get(tkCorte.id)?.requierePresencia, true);
    assert.equal(rowsByTicket.get(tkCorte.id)?.exentoMotivo, null);

    // También: INFRAESTRUCTURA → SOPORTE crea fila bloqueada
    const tkInfra = baseTicket({ id: "tk_inf", tipo: "INFRAESTRUCTURA" });
    tickets.set(tkInfra.id, { ...tkInfra, tipo: "SOPORTE" });
    const syncInf = await sincronizarConfirmacionPorCambioTicket({
      ticketId: tkInfra.id,
      tipoAnterior: "INFRAESTRUCTURA",
      tipoNuevo: "SOPORTE",
      programadoEnAnterior: tProgramado,
      programadoEnNuevo: tProgramado,
      usuarioId: "sup_1",
      ahora: ahoraBase,
      db,
    });
    assert.equal(syncInf.invalidada, true);
    assert.equal(rowsByTicket.get(tkInfra.id)?.estado, "PENDIENTE_CONFIRMACION");
  });

  it("8) cambio de clienteId invalida confirmación otorgada por el cliente anterior", async () => {
    const tk = baseTicket({ clienteId: "cli_1" });
    const { db, tickets, rowsByTicket } = crearDbConfirmacionEnMemoria([tk]);
    const sol = await asegurarSolicitudConfirmacionVisita({
      ticketId: tk.id,
      programadoEn: tk.programadoEn,
      tipo: tk.tipo,
      ahora: ahoraBase,
      db,
    });
    await responderConfirmacionPorToken({
      token: sol!.token!,
      accion: "CONFIRMAR",
      personaRecibe: "Cliente Viejo",
      ahora: ahoraBase,
      db,
      omitirNotificacionTecnico: true,
    });
    assert.equal(rowsByTicket.get(tk.id)?.estado, "CONFIRMADO");

    tickets.set(tk.id, { ...tk, clienteId: "cli_2" });
    const sync = await sincronizarConfirmacionPorCambioTicket({
      ticketId: tk.id,
      tipoAnterior: tk.tipo,
      tipoNuevo: tk.tipo,
      programadoEnAnterior: tProgramado,
      programadoEnNuevo: tProgramado,
      clienteIdAnterior: "cli_1",
      clienteIdNuevo: "cli_2",
      usuarioId: "sup_1",
      ahora: new Date(ahoraBase.getTime() + 60_000),
      db,
    });

    assert.equal(sync.invalidada, true);
    assert.equal(rowsByTicket.get(tk.id)?.estado, "PENDIENTE_CONFIRMACION");
    assert.equal(rowsByTicket.get(tk.id)?.personaRecibe, null);
    assert.notEqual(rowsByTicket.get(tk.id)?.token, sol!.token);
  });

  it("9) confirmación manual exige horario programado válido, coincidente y no vencido", async () => {
    const tkSinHorario = baseTicket({ programadoEn: null });
    const { db } = crearDbConfirmacionEnMemoria([tkSinHorario]);

    const sinHor = await confirmarManualSupervisor({
      ticket: tkSinHorario,
      usuarioId: "sup_1",
      usuarioNombre: "Supervisor",
      rol: "SUPERVISOR",
      personaRecibe: "Luis Gómez",
      ahora: ahoraBase,
      db,
    });
    assert.equal(sinHor.ok, false);
    if (!sinHor.ok) assert.equal(sinHor.status, 400);

    // Horario esperado distinto → 409
    const tk = baseTicket();
    const mismatch = await confirmarManualSupervisor({
      ticket: tk,
      usuarioId: "sup_1",
      usuarioNombre: "Supervisor",
      rol: "SUPERVISOR",
      personaRecibe: "Luis Gómez",
      programadoEnEsperado: new Date("2026-11-28T10:00:00-05:00"),
      ahora: ahoraBase,
      db,
    });
    assert.equal(mismatch.ok, false);
    if (!mismatch.ok) assert.equal(mismatch.status, 409);

    // Horario ya vencido hace >2h → 400
    const vencido = await confirmarManualSupervisor({
      ticket: baseTicket({ programadoEn: new Date("2026-11-26T10:00:00-05:00") }),
      usuarioId: "sup_1",
      usuarioNombre: "Supervisor",
      rol: "SUPERVISOR",
      personaRecibe: "Luis Gómez",
      ahora: ahoraBase,
      db,
    });
    assert.equal(vencido.ok, false);
    if (!vencido.ok) assert.equal(vencido.status, 400);
  });

  it("10) confirmación manual revoca token público anterior e impide que enlace antiguo la modifique", async () => {
    const tk = baseTicket();
    const { db, rowsByTicket } = crearDbConfirmacionEnMemoria([tk]);
    const sol = await asegurarSolicitudConfirmacionVisita({
      ticketId: tk.id,
      programadoEn: tk.programadoEn,
      tipo: tk.tipo,
      ahora: ahoraBase,
      db,
    });
    const tokenViejo = sol!.token!;

    const manual = await confirmarManualSupervisor({
      ticket: tk,
      usuarioId: "sup_1",
      usuarioNombre: "Ana Supervisora",
      rol: "SUPERVISOR",
      personaRecibe: "Pedro Ruiz",
      nota: "Confirmó por llamada",
      programadoEnEsperado: tProgramado,
      ahora: ahoraBase,
      db,
    });
    assert.equal(manual.ok, true);
    if (manual.ok) {
      assert.equal(manual.vista.puedeIniciarDesplazamiento, true);
      assert.equal(manual.vista.confirmadoPorCanal, "TELEFONICA_SUPERVISOR");
      assert.equal(manual.vista.confirmadoPorNombre, "Ana Supervisora");
    }

    // Token público antiguo ya no funciona (404/410) y no modifica la confirmación manual
    const intentoPublico = await responderConfirmacionPorToken({
      token: tokenViejo,
      accion: "NO_DISPONIBLE",
      ahora: new Date(ahoraBase.getTime() + 60_000),
      db,
      omitirNotificacionTecnico: true,
    });
    assert.equal(intentoPublico.ok, false);
    assert.equal(rowsByTicket.get(tk.id)?.estado, "CONFIRMADO");
    assert.ok(rowsByTicket.get(tk.id)?.tokenRevocadoEn);
  });

  it("11) no se puede responder después de EN CAMINO o EN_PROCESO y nunca borra enCaminoEn", async () => {
    const tk = baseTicket();
    const { db, tickets, rowsByTicket } = crearDbConfirmacionEnMemoria([tk]);
    const sol = await asegurarSolicitudConfirmacionVisita({
      ticketId: tk.id,
      programadoEn: tk.programadoEn,
      tipo: tk.tipo,
      ahora: ahoraBase,
      db,
    });
    await responderConfirmacionPorToken({
      token: sol!.token!,
      accion: "CONFIRMAR",
      personaRecibe: "Elena Mora",
      ahora: ahoraBase,
      db,
      omitirNotificacionTecnico: true,
    });

    const ec = await registrarEnCaminoTecnico({
      ticket: { ...tk, confirmacionVisita: rowsByTicket.get(tk.id) ?? null },
      session: { id: "u_tec1", rol: "TECNICO", tecnicoId: "tec_1" },
      ahora: new Date(ahoraBase.getTime() + 5 * 60_000),
      db,
    });
    assert.equal(ec.ok, true);
    const enCaminoInicial = rowsByTicket.get(tk.id)!.enCaminoEn!.toISOString();

    // GET público muestra puedeResponder = false
    const consulta = await consultarConfirmacionPorToken(sol!.token!, {
      ahora: new Date(ahoraBase.getTime() + 6 * 60_000),
      db,
    });
    assert.equal(consulta.ok, true);
    if (consulta.ok) assert.equal(consulta.puedeResponder, false);

    // POST público tras EN CAMINO devuelve 409 y conserva enCaminoEn intacto
    const tardia = await responderConfirmacionPorToken({
      token: sol!.token!,
      accion: "NO_DISPONIBLE",
      ahora: new Date(ahoraBase.getTime() + 6 * 60_000),
      db,
      omitirNotificacionTecnico: true,
    });
    assert.equal(tardia.ok, false);
    if (!tardia.ok) assert.equal(tardia.status, 409);
    assert.equal(rowsByTicket.get(tk.id)!.enCaminoEn?.toISOString(), enCaminoInicial);
    assert.equal(rowsByTicket.get(tk.id)!.estado, "CONFIRMADO");

    // Ticket en estado EN_PROCESO también bloquea respuesta pública (409)
    const tkProc = baseTicket({ id: "tk_proc", estado: "EN_PROCESO" });
    tickets.set(tkProc.id, tkProc);
    const solProc = await asegurarSolicitudConfirmacionVisita({
      ticketId: tkProc.id,
      programadoEn: tkProc.programadoEn,
      tipo: tkProc.tipo,
      ahora: ahoraBase,
      db,
    });
    const resProc = await responderConfirmacionPorToken({
      token: solProc!.token!,
      accion: "NO_DISPONIBLE",
      ahora: ahoraBase,
      db,
      omitirNotificacionTecnico: true,
    });
    assert.equal(resProc.ok, false);
    if (!resProc.ok) assert.equal(resProc.status, 409);
  });

  it("12) confirmar sin persona receptora devuelve error 400", async () => {
    const tk = baseTicket();
    const { db } = crearDbConfirmacionEnMemoria([tk]);
    const sol = await asegurarSolicitudConfirmacionVisita({
      ticketId: tk.id,
      programadoEn: tk.programadoEn,
      tipo: tk.tipo,
      ahora: ahoraBase,
      db,
    });
    const res = await responderConfirmacionPorToken({
      token: sol!.token!,
      accion: "CONFIRMAR",
      personaRecibe: " ",
      ahora: ahoraBase,
      db,
      omitirNotificacionTecnico: true,
    });
    assert.equal(res.ok, false);
    if (!res.ok) assert.equal(res.status, 400);
  });

  it("13) solicitar reprogramación sin horario sugerido devuelve error 400", async () => {
    const tk = baseTicket();
    const { db } = crearDbConfirmacionEnMemoria([tk]);
    const sol = await asegurarSolicitudConfirmacionVisita({
      ticketId: tk.id,
      programadoEn: tk.programadoEn,
      tipo: tk.tipo,
      ahora: ahoraBase,
      db,
    });
    const res = await responderConfirmacionPorToken({
      token: sol!.token!,
      accion: "SOLICITA_REPROGRAMACION",
      horarioSolicitado: "",
      ahora: ahoraBase,
      db,
      omitirNotificacionTecnico: true,
    });
    assert.equal(res.ok, false);
    if (!res.ok) assert.equal(res.status, 400);
  });

  it("14) expiración coherente con la cita (mismo día, futura, vencida) y token expirado bloqueado", async () => {
    // Mismo día: ahora 09:00, cita 11:00 → vence 13:00 (NO mañana a las 09:00)
    const citaHoy = new Date("2026-11-27T11:00:00-05:00");
    const expHoy = calcularExpiracionConfirmacion(citaHoy, ahoraBase);
    assert.equal(expHoy.toISOString(), new Date("2026-11-27T13:00:00-05:00").toISOString());

    // Cita futura: en 3 días a las 15:00 → vence en 3 días a las 17:00
    const citaFutura = new Date("2026-11-30T15:00:00-05:00");
    const expFutura = calcularExpiracionConfirmacion(citaFutura, ahoraBase);
    assert.equal(expFutura.toISOString(), new Date("2026-11-30T17:00:00-05:00").toISOString());

    // Cita vencida: ayer 10:00 → expira ayer 12:00 (<= ahoraBase)
    const citaVencida = new Date("2026-11-26T10:00:00-05:00");
    const expVencida = calcularExpiracionConfirmacion(citaVencida, ahoraBase);
    assert.ok(expVencida.getTime() < ahoraBase.getTime());

    // Token expirado no puede responder (410)
    const tk = baseTicket({ programadoEn: citaHoy });
    const { db } = crearDbConfirmacionEnMemoria([tk]);
    const sol = await asegurarSolicitudConfirmacionVisita({
      ticketId: tk.id,
      programadoEn: citaHoy,
      tipo: tk.tipo,
      ahora: ahoraBase,
      db,
    });
    const despues = new Date("2026-11-27T13:05:00-05:00");
    const res = await responderConfirmacionPorToken({
      token: sol!.token!,
      accion: "CONFIRMAR",
      personaRecibe: "Sofía Luna",
      ahora: despues,
      db,
      omitirNotificacionTecnico: true,
    });
    assert.equal(res.ok, false);
    if (!res.ok) assert.equal(res.status, 410);
  });

  it("15) EXENTO limpia/revoca token, no permite reenvío y servicio valida estados terminales", async () => {
    const tkCorte = baseTicket({ id: "tk_ex", tipo: "CORTE" });
    const { db, rowsByTicket } = crearDbConfirmacionEnMemoria([tkCorte]);
    await asegurarSolicitudConfirmacionVisita({
      ticketId: tkCorte.id,
      programadoEn: tkCorte.programadoEn,
      tipo: tkCorte.tipo,
      ahora: ahoraBase,
      db,
    });

    const ex = await marcarExentoPresenciaSupervisor({
      ticket: tkCorte,
      usuarioId: "sup_1",
      usuarioNombre: "Supervisor",
      rol: "SUPERVISOR",
      motivo: "Trabajo en poste exterior",
      ahora: ahoraBase,
      db,
    });
    assert.equal(ex.ok, true);
    const filaEx = rowsByTicket.get(tkCorte.id)!;
    assert.equal(filaEx.token, null);
    assert.ok(filaEx.tokenRevocadoEn);
    assert.equal(esTokenConfirmacionActivo(tkCorte, filaEx, ahoraBase), false);

    // Reintentar asegurarSolicitud sobre EXENTO no regenera token
    const post = await asegurarSolicitudConfirmacionVisita({
      ticketId: tkCorte.id,
      programadoEn: tkCorte.programadoEn,
      tipo: tkCorte.tipo,
      forzarNuevoToken: true,
      ahora: ahoraBase,
      db,
    });
    assert.equal(post?.estado, "EXENTO");
    assert.equal(post?.token, null);

    // M-2: ticket cerrado no puede marcarse exento en servicio
    const exCerrado = await marcarExentoPresenciaSupervisor({
      ticket: baseTicket({ tipo: "CORTE", estado: "CERRADO" }),
      usuarioId: "sup_1",
      usuarioNombre: "Supervisor",
      rol: "SUPERVISOR",
      motivo: "Motivo válido largo",
      ahora: ahoraBase,
      db,
    });
    assert.equal(exCerrado.ok, false);
    if (!exCerrado.ok) assert.equal(exCerrado.status, 409);
  });

  it("16) EN CAMINO idempotente en requests repetidos y concurrentes (normal e histórico)", async () => {
    const tk = baseTicket();
    const { db, rowsByTicket, eventos } = crearDbConfirmacionEnMemoria([tk]);
    const sol = await asegurarSolicitudConfirmacionVisita({
      ticketId: tk.id,
      programadoEn: tk.programadoEn,
      tipo: tk.tipo,
      ahora: ahoraBase,
      db,
    });
    await responderConfirmacionPorToken({
      token: sol!.token!,
      accion: "CONFIRMAR",
      personaRecibe: "Raúl Paredes",
      ahora: ahoraBase,
      db,
      omitirNotificacionTecnico: true,
    });

    const t1 = new Date(ahoraBase.getTime() + 60_000);
    const t2 = new Date(ahoraBase.getTime() + 120_000);
    const [e1, e2] = await Promise.all([
      registrarEnCaminoTecnico({
        ticket: { ...tk, confirmacionVisita: rowsByTicket.get(tk.id) ?? null },
        session: { id: "u_tec1", rol: "TECNICO", tecnicoId: "tec_1" },
        ahora: t1,
        db,
      }),
      registrarEnCaminoTecnico({
        ticket: { ...tk, confirmacionVisita: rowsByTicket.get(tk.id) ?? null },
        session: { id: "u_tec1", rol: "TECNICO", tecnicoId: "tec_1" },
        ahora: t2,
        db,
      }),
    ]);

    assert.equal(e1.ok, true);
    assert.equal(e2.ok, true);
    if (e1.ok && e2.ok) {
      assert.equal(e1.enCaminoEn, t1.toISOString());
      assert.equal(e2.enCaminoEn, t1.toISOString());
      assert.equal(e2.yaEnCamino, true);
    }
    const eventosEnCamino = eventos.filter((e) => e.accion === "TECNICO_EN_CAMINO");
    assert.equal(eventosEnCamino.length, 1);
  });

  it("17) colisión concurrente P2002 manejada sin error ni inconsistencia", async () => {
    const tk = baseTicket();
    const { db, rowsByTicket } = crearDbConfirmacionEnMemoria([tk], {
      inyectarP2002EnSiguienteUpsert: true,
    });

    const sol = await asegurarSolicitudConfirmacionVisita({
      ticketId: tk.id,
      programadoEn: tk.programadoEn,
      tipo: tk.tipo,
      ahora: ahoraBase,
      db,
    });
    assert.ok(sol?.token);
    assert.equal(rowsByTicket.get(tk.id)?.estado, "PENDIENTE_CONFIRMACION");

    // P2002 en create concurrente de EN CAMINO sobre ticket histórico
    const tkHist = baseTicket({ id: "tk_h_p2002", createdAt: createdHistorico });
    const mem2 = crearDbConfirmacionEnMemoria([tkHist], {
      inyectarP2002EnSiguienteCreate: true,
    });
    const ec = await registrarEnCaminoTecnico({
      ticket: { ...tkHist, confirmacionVisita: null },
      session: { id: "u_tec1", rol: "TECNICO", tecnicoId: "tec_1" },
      ahora: ahoraBase,
      db: mem2.db,
    });
    assert.equal(ec.ok, true);
    if (ec.ok) assert.equal(ec.yaEnCamino, true);
  });

  it("18) reprogramación limpia todos los datos de la confirmación anterior sin borrar auditoría", async () => {
    const tk = baseTicket();
    const { db, tickets, rowsByTicket, eventos } = crearDbConfirmacionEnMemoria([tk]);
    const sol = await asegurarSolicitudConfirmacionVisita({
      ticketId: tk.id,
      programadoEn: tk.programadoEn,
      tipo: tk.tipo,
      ahora: ahoraBase,
      db,
    });
    await responderConfirmacionPorToken({
      token: sol!.token!,
      accion: "CONFIRMAR",
      personaRecibe: "Rosa Delgado",
      observacionCliente: "Timbre dañado",
      ahora: ahoraBase,
      db,
      omitirNotificacionTecnico: true,
    });

    const nuevoHorario = new Date("2026-11-28T10:00:00-05:00");
    tickets.set(tk.id, { ...tk, programadoEn: nuevoHorario });
    await invalidarConfirmacionPorCambioHorario({
      ticketId: tk.id,
      tipo: tk.tipo,
      programadoEnAnterior: tProgramado,
      programadoEnNuevo: nuevoHorario,
      usuarioId: "sup_1",
      ahora: new Date(ahoraBase.getTime() + 60_000),
      db,
    });

    const fila = rowsByTicket.get(tk.id)!;
    assert.equal(fila.estado, "PENDIENTE_CONFIRMACION");
    assert.equal(fila.personaRecibe, null);
    assert.equal(fila.observacionCliente, null);
    assert.equal(fila.horarioSolicitado, null);
    assert.equal(fila.respondidoEn, null);
    assert.equal(fila.confirmadoEn, null);
    assert.equal(fila.confirmadoPorCanal, null);
    assert.equal(fila.enCaminoEn, null);
    // Auditoría histórica conservada
    assert.ok(eventos.some((e) => e.accion === "CONFIRMACION_VISITA_CONFIRMADA"));
    assert.ok(eventos.some((e) => e.accion === "CONFIRMACION_VISITA_INVALIDADA"));
  });

  it("19) tickets históricos legítimos conservan comportamiento y persisten EN CAMINO idempotente", async () => {
    const tkHist = baseTicket({ id: "tk_hist", createdAt: createdHistorico });
    assert.ok(createdHistorico.getTime() < FECHA_ACTIVACION_CONFIRMACION_VISITA.getTime());

    const vista = derivarVistaConfirmacionVisita(tkHist, null, ahoraBase);
    assert.equal(vista.estado, "HISTORICO_SIN_CONTROL");
    assert.equal(vista.esHistorico, true);
    assert.equal(vista.puedeIniciarDesplazamiento, true);

    const { db, rowsByTicket, eventos } = crearDbConfirmacionEnMemoria([tkHist]);
    const r1 = await registrarEnCaminoTecnico({
      ticket: { ...tkHist, confirmacionVisita: null },
      session: { id: "u_tec1", rol: "TECNICO", tecnicoId: "tec_1" },
      ahora: ahoraBase,
      db,
    });
    assert.equal(r1.ok, true);
    if (r1.ok) {
      assert.equal(r1.yaEnCamino, false);
      assert.equal(r1.vista.estado, "HISTORICO_SIN_CONTROL");
      assert.equal(r1.vista.enCaminoEn, ahoraBase.toISOString());
    }
    assert.equal(rowsByTicket.get(tkHist.id)?.exentoMotivo, MARCA_HISTORICO_EN_CAMINO);

    // Segunda pulsación: idempotente, no crea segundo evento
    const r2 = await registrarEnCaminoTecnico({
      ticket: { ...tkHist, confirmacionVisita: rowsByTicket.get(tkHist.id) ?? null },
      session: { id: "u_tec1", rol: "TECNICO", tecnicoId: "tec_1" },
      ahora: new Date(ahoraBase.getTime() + 60_000),
      db,
    });
    assert.equal(r2.ok, true);
    if (r2.ok) assert.equal(r2.yaEnCamino, true);
    assert.equal(eventos.filter((e) => e.accion === "TECNICO_EN_CAMINO").length, 1);
  });

  it("20) privacidad pública, rate-limit confiable, token seguro y sin regresión de estado principal", async () => {
    // Privacidad: GET público NO expone personaRecibe ni datos de confirmación manual
    const tk = baseTicket();
    const { db } = crearDbConfirmacionEnMemoria([tk]);
    const sol = await asegurarSolicitudConfirmacionVisita({
      ticketId: tk.id,
      programadoEn: tk.programadoEn,
      tipo: tk.tipo,
      ahora: ahoraBase,
      db,
    });
    await responderConfirmacionPorToken({
      token: sol!.token!,
      accion: "CONFIRMAR",
      personaRecibe: "Nombre Privado Sensible",
      observacionCliente: "Dato interno privado",
      ahora: ahoraBase,
      db,
      omitirNotificacionTecnico: true,
    });

    const pub = await consultarConfirmacionPorToken(sol!.token!, { ahora: ahoraBase, db });
    assert.equal(pub.ok, true);
    if (pub.ok) {
      assert.equal("personaRecibe" in pub, false);
      assert.equal("horarioSolicitado" in pub, false);
      assert.equal("observacionCliente" in pub, false);
      assert.equal("confirmadoPorNombre" in pub, false);
      assert.equal(JSON.stringify(pub).includes("Nombre Privado Sensible"), false);
    }

    // Rate limit no confía en el primer valor forjado de X-Forwarded-For
    limpiarRateLimitConfirmacionParaTests();
    const reqSpoof = new Request("https://app.infinity.ec/api/test", {
      headers: { "x-forwarded-for": "1.2.3.4, 203.0.113.55" },
    });
    assert.equal(ipConfiableDeRequest(reqSpoof), "203.0.113.55");
    assert.equal(limitarTasaConfirmacion("test:k", 2, 60_000, 1000), true);
    assert.equal(limitarTasaConfirmacion("test:k", 2, 60_000, 1001), true);
    assert.equal(limitarTasaConfirmacion("test:k", 2, 60_000, 1002), false);

    // Token seguro y URL sin PII
    const tok = generarTokenConfirmacion();
    assert.equal(tokenConfirmacionValido(tok), true);
    const url = urlConfirmacionVisitaPublica(tok, "https://infinity-operaciones-b3ij.onrender.com");
    assert.equal(url, `https://infinity-operaciones-b3ij.onrender.com/confirmar-visita/${tok}`);
    const msgConHorario = mensajeWhatsappConfirmacion(url, "27 nov 2026, 15:00");
    assert.ok(msgConHorario.includes("🔔 *INFINITY INTERNET | CONFIRMACIÓN DE VISITA TÉCNICA*"));
    assert.ok(msgConHorario.includes(`🟦 *CONFIRME AQUÍ SU VISITA* 👇\n\n${url}\n\n`));
    assert.ok(msgConHorario.includes("📅 *Fecha:* 27 nov 2026\n🕒 *Hora:* 15:00"));
    assert.ok(msgConHorario.includes("*INFINITY INTERNET*\nConectamos lo que más importa."));
    assert.equal(/<[^>]+>/.test(msgConHorario), false, "No debe contener HTML");

    const msgConDate = mensajeWhatsappConfirmacion(url, tProgramado);
    assert.ok(msgConDate.includes(`\n\n${url}\n\n`));
    assert.ok(msgConDate.includes("📅 *Fecha:* "));
    assert.ok(msgConDate.includes("🕒 *Hora:* "));

    const msgSinHorario = mensajeWhatsappConfirmacion(url);
    assert.ok(msgSinHorario.includes(`\n\n${url}\n\n`));
    assert.equal(msgSinHorario.includes("📅 *Fecha:*"), false);

    // Estado principal del ticket NO cambia al hacer EN CAMINO
    const estadoAntes = tk.estado;
    await registrarEnCaminoTecnico({
      ticket: tk,
      session: { id: "u_tec1", rol: "TECNICO", tecnicoId: "tec_1" },
      ahora: ahoraBase,
      db,
    });
    assert.equal(tk.estado, estadoAntes);
  });

  it("21) D-1: reprogramación concurrente mientras el técnico intenta EN CAMINO → 409 y 0 eventos TECNICO_EN_CAMINO", async () => {
    const tk = baseTicket();
    const nuevoHorario = new Date("2026-11-28T10:00:00-05:00");
    let reprogramarAlIntentarEnCamino = false;

    const { db, tickets, rowsByTicket, eventos } = crearDbConfirmacionEnMemoria([tk], {
      antesDeUpdateMany: async () => {
        if (!reprogramarAlIntentarEnCamino) return;
        reprogramarAlIntentarEnCamino = false;
        tickets.set(tk.id, { ...tk, programadoEn: nuevoHorario });
        await invalidarConfirmacionPorCambioHorario({
          ticketId: tk.id,
          tipo: tk.tipo,
          programadoEnAnterior: tProgramado,
          programadoEnNuevo: nuevoHorario,
          usuarioId: "sup_1",
          ahora: new Date(ahoraBase.getTime() + 5000),
          db,
        });
      },
    });

    const sol = await asegurarSolicitudConfirmacionVisita({
      ticketId: tk.id,
      programadoEn: tk.programadoEn,
      tipo: tk.tipo,
      ahora: ahoraBase,
      db,
    });
    await responderConfirmacionPorToken({
      token: sol!.token!,
      accion: "CONFIRMAR",
      personaRecibe: "Marta Paz",
      ahora: ahoraBase,
      db,
      omitirNotificacionTecnico: true,
    });

    const snapshotConfirmado = { ...rowsByTicket.get(tk.id)! };
    reprogramarAlIntentarEnCamino = true;

    const res = await registrarEnCaminoTecnico({
      ticket: { ...tk, confirmacionVisita: snapshotConfirmado },
      session: { id: "u_tec1", rol: "TECNICO", tecnicoId: "tec_1" },
      ahora: new Date(ahoraBase.getTime() + 6000),
      db,
    });

    assert.equal(res.ok, false);
    if (!res.ok) assert.equal(res.status, 409);
    assert.equal(rowsByTicket.get(tk.id)?.enCaminoEn, null);
    assert.equal(eventos.filter((e) => e.accion === "TECNICO_EN_CAMINO").length, 0);
  });

  it("22) D-1: cancelación concurrente mientras el técnico intenta EN CAMINO → 409 y 0 eventos TECNICO_EN_CAMINO", async () => {
    const tk = baseTicket();
    let cancelarAlIntentarEnCamino = false;

    const { db, rowsByTicket, eventos } = crearDbConfirmacionEnMemoria([tk], {
      antesDeUpdateMany: async () => {
        if (!cancelarAlIntentarEnCamino) return;
        cancelarAlIntentarEnCamino = false;
        await cancelarConfirmacionSupervisor({
          ticket: tk,
          usuarioId: "sup_1",
          usuarioNombre: "Supervisor",
          rol: "SUPERVISOR",
          motivo: "Cliente avisó cancelación por teléfono",
          ahora: new Date(ahoraBase.getTime() + 5000),
          db,
          omitirNotificacionTecnico: true,
        });
      },
    });

    const sol = await asegurarSolicitudConfirmacionVisita({
      ticketId: tk.id,
      programadoEn: tk.programadoEn,
      tipo: tk.tipo,
      ahora: ahoraBase,
      db,
    });
    await responderConfirmacionPorToken({
      token: sol!.token!,
      accion: "CONFIRMAR",
      personaRecibe: "Jorge León",
      ahora: ahoraBase,
      db,
      omitirNotificacionTecnico: true,
    });

    const snapshotConfirmado = { ...rowsByTicket.get(tk.id)! };
    cancelarAlIntentarEnCamino = true;

    const res = await registrarEnCaminoTecnico({
      ticket: { ...tk, confirmacionVisita: snapshotConfirmado },
      session: { id: "u_tec1", rol: "TECNICO", tecnicoId: "tec_1" },
      ahora: new Date(ahoraBase.getTime() + 6000),
      db,
    });

    assert.equal(res.ok, false);
    if (!res.ok) assert.equal(res.status, 409);
    assert.equal(rowsByTicket.get(tk.id)?.estado, "CANCELADO");
    assert.equal(rowsByTicket.get(tk.id)?.enCaminoEn, null);
    assert.equal(eventos.filter((e) => e.accion === "TECNICO_EN_CAMINO").length, 0);
  });

  it("23) D-1: respuesta NO_DISPONIBLE concurrente mientras el técnico intenta EN CAMINO → 409 y 0 eventos TECNICO_EN_CAMINO", async () => {
    const tk = baseTicket();
    let noDispAlIntentarEnCamino = false;
    let tokenActivo = "";

    const { db, rowsByTicket, eventos } = crearDbConfirmacionEnMemoria([tk], {
      antesDeUpdateMany: async () => {
        if (!noDispAlIntentarEnCamino) return;
        noDispAlIntentarEnCamino = false;
        await responderConfirmacionPorToken({
          token: tokenActivo,
          accion: "NO_DISPONIBLE",
          observacionCliente: "Tuve que salir de urgencia",
          ahora: new Date(ahoraBase.getTime() + 5000),
          db,
          omitirNotificacionTecnico: true,
        });
      },
    });

    const sol = await asegurarSolicitudConfirmacionVisita({
      ticketId: tk.id,
      programadoEn: tk.programadoEn,
      tipo: tk.tipo,
      ahora: ahoraBase,
      db,
    });
    tokenActivo = sol!.token!;
    await responderConfirmacionPorToken({
      token: tokenActivo,
      accion: "CONFIRMAR",
      personaRecibe: "Lucía Vega",
      ahora: ahoraBase,
      db,
      omitirNotificacionTecnico: true,
    });

    const snapshotConfirmado = { ...rowsByTicket.get(tk.id)! };
    noDispAlIntentarEnCamino = true;

    const res = await registrarEnCaminoTecnico({
      ticket: { ...tk, confirmacionVisita: snapshotConfirmado },
      session: { id: "u_tec1", rol: "TECNICO", tecnicoId: "tec_1" },
      ahora: new Date(ahoraBase.getTime() + 6000),
      db,
    });

    assert.equal(res.ok, false);
    if (!res.ok) assert.equal(res.status, 409);
    assert.equal(rowsByTicket.get(tk.id)?.estado, "NO_DISPONIBLE");
    assert.equal(rowsByTicket.get(tk.id)?.enCaminoEn, null);
    assert.equal(eventos.filter((e) => e.accion === "TECNICO_EN_CAMINO").length, 0);
  });

  it("24) D-2: ticket EXENTO cancelado limpia exención y ya NO permite desplazamiento", async () => {
    const tkCorte = baseTicket({ id: "tk_ex_cancel", tipo: "CORTE" });
    const { db, rowsByTicket } = crearDbConfirmacionEnMemoria([tkCorte]);

    const ex = await marcarExentoPresenciaSupervisor({
      ticket: tkCorte,
      usuarioId: "sup_1",
      usuarioNombre: "Supervisor",
      rol: "SUPERVISOR",
      motivo: "Trabajo exterior en caja NAP",
      ahora: ahoraBase,
      db,
    });
    assert.equal(ex.ok, true);
    assert.equal(
      evaluarDesplazamientoTicket(tkCorte, rowsByTicket.get(tkCorte.id) ?? null, ahoraBase)
        .permitido,
      true
    );

    const cancel = await cancelarConfirmacionSupervisor({
      ticket: tkCorte,
      usuarioId: "sup_1",
      usuarioNombre: "Supervisor",
      rol: "SUPERVISOR",
      motivo: "Ahora requiere ingreso al domicilio",
      ahora: new Date(ahoraBase.getTime() + 60_000),
      db,
      omitirNotificacionTecnico: true,
    });
    assert.equal(cancel.ok, true);
    const fila = rowsByTicket.get(tkCorte.id)!;
    assert.equal(fila.estado, "CANCELADO");
    assert.equal(fila.requierePresencia, true);
    assert.equal(fila.exentoMotivo, null);
    assert.equal(fila.exentoPorUsuarioId, null);
    assert.equal(fila.exentoEn, null);
    assert.equal(fila.token, null);
    assert.ok(fila.tokenRevocadoEn);

    const evalPost = evaluarDesplazamientoTicket(tkCorte, fila, ahoraBase);
    assert.equal(evalPost.permitido, false);
    assert.equal(evalPost.estadoEfectivo, "CANCELADO");

    const enCamino = await registrarEnCaminoTecnico({
      ticket: { ...tkCorte, confirmacionVisita: fila },
      session: { id: "u_tec1", rol: "TECNICO", tecnicoId: "tec_1" },
      ahora: ahoraBase,
      db,
    });
    assert.equal(enCamino.ok, false);
    if (!enCamino.ok) assert.equal(enCamino.status, 409);
  });

  it("25) D-2: ticket EXENTO marcado SIN_RESPUESTA limpia exención, revoca token y bloquea desplazamiento", async () => {
    const tkRecon = baseTicket({ id: "tk_ex_sr", tipo: "RECONEXION" });
    const { db, rowsByTicket } = crearDbConfirmacionEnMemoria([tkRecon]);

    await marcarExentoPresenciaSupervisor({
      ticket: tkRecon,
      usuarioId: "sup_1",
      usuarioNombre: "Supervisor",
      rol: "SUPERVISOR",
      motivo: "Reconexión externa en poste",
      ahora: ahoraBase,
      db,
    });

    const sr = await marcarSinRespuestaSupervisor({
      ticket: tkRecon,
      usuarioId: "sup_1",
      usuarioNombre: "Supervisor",
      rol: "SUPERVISOR",
      nota: "Se requiere ingreso para revisar ONU y cliente no contesta",
      ahora: new Date(ahoraBase.getTime() + 60_000),
      db,
    });
    assert.equal(sr.ok, true);
    const fila = rowsByTicket.get(tkRecon.id)!;
    assert.equal(fila.estado, "SIN_RESPUESTA");
    assert.equal(fila.requierePresencia, true);
    assert.equal(fila.exentoMotivo, null);
    assert.equal(fila.exentoPorUsuarioId, null);
    assert.equal(fila.exentoEn, null);
    assert.equal(fila.token, null);
    assert.ok(fila.tokenRevocadoEn);

    const evalPost = evaluarDesplazamientoTicket(tkRecon, fila, ahoraBase);
    assert.equal(evalPost.permitido, false);
    assert.equal(evalPost.estadoEfectivo, "SIN_RESPUESTA");

    const enCamino = await registrarEnCaminoTecnico({
      ticket: { ...tkRecon, confirmacionVisita: fila },
      session: { id: "u_tec1", rol: "TECNICO", tecnicoId: "tec_1" },
      ahora: ahoraBase,
      db,
    });
    assert.equal(enCamino.ok, false);
    if (!enCamino.ok) assert.equal(enCamino.status, 409);
  });

  it("26) D-3a: dos supervisores editando simultáneamente horario/tipo/cliente leen prev real dentro de tx", async () => {
    const t1 = tProgramado;
    const t2 = new Date("2026-11-28T14:00:00-05:00");
    const tk = baseTicket({ tipo: "CORTE", clienteId: "cli_1", programadoEn: t1 });
    const { db, tickets, rowsByTicket } = crearDbConfirmacionEnMemoria([tk]);

    // Supervisor 1 crea exención en CORTE y programa T2; luego se confirma T2
    const sol1 = await asegurarSolicitudConfirmacionVisita({
      ticketId: tk.id,
      programadoEn: t1,
      tipo: "CORTE",
      ahora: ahoraBase,
      db,
    });
    assert.ok(sol1?.token);

    // Transacción A (Supervisor A): lee prevTx = (CORTE, t1, cli_1), cambia horario a t2
    const prevA = { ...tickets.get(tk.id)! };
    tickets.set(tk.id, { ...prevA, programadoEn: t2 });
    await sincronizarConfirmacionPorCambioTicket({
      ticketId: tk.id,
      tipoAnterior: prevA.tipo,
      tipoNuevo: prevA.tipo,
      programadoEnAnterior: prevA.programadoEn,
      programadoEnNuevo: t2,
      clienteIdAnterior: prevA.clienteId,
      clienteIdNuevo: prevA.clienteId,
      usuarioId: "sup_A",
      ahora: new Date(ahoraBase.getTime() + 1000),
      db,
    });
    // Cliente confirma t2
    const tokenT2 = rowsByTicket.get(tk.id)!.token!;
    await responderConfirmacionPorToken({
      token: tokenT2,
      accion: "CONFIRMAR",
      personaRecibe: "Cliente T2",
      ahora: new Date(ahoraBase.getTime() + 2000),
      db,
      omitirNotificacionTecnico: true,
    });
    assert.equal(rowsByTicket.get(tk.id)?.estado, "CONFIRMADO");

    // Transacción B (Supervisor B) que había cargado la página cuando estaba en t1
    // pero al entrar a $transaction lee prevTx real = (CORTE, t2, cli_1) y guarda (SOPORTE, t1, cli_2):
    const prevB = { ...tickets.get(tk.id)! };
    tickets.set(tk.id, { ...prevB, tipo: "SOPORTE", programadoEn: t1, clienteId: "cli_2" });
    const resB = await sincronizarConfirmacionPorCambioTicket({
      ticketId: tk.id,
      tipoAnterior: prevB.tipo,
      tipoNuevo: "SOPORTE",
      programadoEnAnterior: prevB.programadoEn,
      programadoEnNuevo: t1,
      clienteIdAnterior: prevB.clienteId,
      clienteIdNuevo: "cli_2",
      usuarioId: "sup_B",
      ahora: new Date(ahoraBase.getTime() + 3000),
      db,
    });

    assert.equal(resB.invalidada, true);
    assert.equal(rowsByTicket.get(tk.id)?.estado, "PENDIENTE_CONFIRMACION");
    assert.equal(rowsByTicket.get(tk.id)?.programadoEnConfirmado?.toISOString(), t1.toISOString());
    assert.notEqual(rowsByTicket.get(tk.id)?.token, tokenT2);
  });

  it("27) D-3b: headers de IP manipulados (x-real-ip, x-forwarded-for, hops, cf-connecting-ip) no evaden rate limit", () => {
    limpiarRateLimitConfirmacionParaTests();

    // 1. Spoofing de x-real-ip cuando existe x-forwarded-for (sin TRUST_X_REAL_IP) → ignora x-real-ip y prefijo XFF
    const rSpoof1 = new Request("https://app.infinity.ec/api/public", {
      headers: {
        "x-real-ip": "10.0.0.1",
        "x-forwarded-for": "1.1.1.1, 203.0.113.88",
      },
    });
    const rSpoof2 = new Request("https://app.infinity.ec/api/public", {
      headers: {
        "x-real-ip": "10.0.0.2",
        "x-forwarded-for": "2.2.2.2, 203.0.113.88",
      },
    });
    const ip1 = ipConfiableDeRequest(rSpoof1, { isProduction: true, trustedProxyHops: 1 });
    const ip2 = ipConfiableDeRequest(rSpoof2, { isProduction: true, trustedProxyHops: 1 });
    assert.equal(ip1, "203.0.113.88");
    assert.equal(ip2, "203.0.113.88");
    assert.equal(limitarTasaConfirmacion(`spoof:${ip1}`, 1, 60_000, 1000), true);
    assert.equal(limitarTasaConfirmacion(`spoof:${ip2}`, 1, 60_000, 1001), false);

    // 2. En producción sin X-Forwarded-For ni TRUST_X_REAL_IP, rotar x-real-ip cae al fallback constante
    const rProdReal1 = new Request("https://app.infinity.ec/api/public", {
      headers: { "x-real-ip": "10.9.0.1" },
    });
    const rProdReal2 = new Request("https://app.infinity.ec/api/public", {
      headers: { "x-real-ip": "10.9.0.2" },
    });
    assert.equal(ipConfiableDeRequest(rProdReal1, { isProduction: true }), IP_FALLBACK_SEGURA);
    assert.equal(ipConfiableDeRequest(rProdReal2, { isProduction: true }), IP_FALLBACK_SEGURA);

    // 3. TRUST_X_REAL_IP explícito=true sí acepta x-real-ip confiable
    assert.equal(
      ipConfiableDeRequest(rProdReal1, { isProduction: true, trustXRealIp: true }),
      "10.9.0.1"
    );

    // 4. Múltiples hops confiables (TRUSTED_PROXY_HOPS=2): ignora spoof inicial y edge final
    const rMultiHop = new Request("https://app.infinity.ec/api/public", {
      headers: { "x-forwarded-for": "9.9.9.9, 198.51.100.42, 172.70.1.5" },
    });
    assert.equal(
      ipConfiableDeRequest(rMultiHop, { isProduction: true, trustedProxyHops: 2 }),
      "198.51.100.42"
    );

    // 5. cf-connecting-ip en modo strict exige cf-ray; si falta cf-ray, cae a x-forwarded-for
    const rCfSinRay = new Request("https://app.infinity.ec/api/public", {
      headers: {
        "cf-connecting-ip": "8.8.8.8",
        "x-forwarded-for": "203.0.113.77",
      },
    });
    assert.equal(
      ipConfiableDeRequest(rCfSinRay, { isProduction: true, trustCfConnectingIp: "strict" }),
      "203.0.113.77"
    );
    const rCfConRay = new Request("https://app.infinity.ec/api/public", {
      headers: {
        "cf-connecting-ip": "198.51.100.9",
        "cf-ray": "8f123abc-GYE",
        "x-forwarded-for": "203.0.113.77",
      },
    });
    assert.equal(
      ipConfiableDeRequest(rCfConRay, { isProduction: true, trustCfConnectingIp: "strict" }),
      "198.51.100.9"
    );
  });

  it("28) históricos legítimos conservan comportamiento tras D-1 (EN CAMINO idempotente y sin alterar estado)", async () => {
    const tkHist = baseTicket({
      id: "tk_hist_d1",
      estado: "LEIDO",
      createdAt: createdHistorico,
    });
    const { db, rowsByTicket, eventos } = crearDbConfirmacionEnMemoria([tkHist]);

    const r1 = await registrarEnCaminoTecnico({
      ticket: { ...tkHist, confirmacionVisita: null },
      session: { id: "u_tec1", rol: "TECNICO", tecnicoId: "tec_1" },
      ahora: ahoraBase,
      db,
    });
    assert.equal(r1.ok, true);
    if (r1.ok) {
      assert.equal(r1.yaEnCamino, false);
      assert.equal(r1.vista.estado, "HISTORICO_SIN_CONTROL");
      assert.equal(r1.vista.esHistorico, true);
      assert.equal(r1.vista.puedeIniciarDesplazamiento, true);
    }
    assert.equal(tkHist.estado, "LEIDO");

    // Reintento concurrente/repetido con la fila ya persistida: idempotente
    const r2 = await registrarEnCaminoTecnico({
      ticket: { ...tkHist, confirmacionVisita: rowsByTicket.get(tkHist.id) ?? null },
      session: { id: "u_tec1", rol: "TECNICO", tecnicoId: "tec_1" },
      ahora: new Date(ahoraBase.getTime() + 30_000),
      db,
    });
    assert.equal(r2.ok, true);
    if (r2.ok) {
      assert.equal(r2.yaEnCamino, true);
      assert.equal(r2.enCaminoEn, ahoraBase.toISOString());
    }
    assert.equal(eventos.filter((e) => e.accion === "TECNICO_EN_CAMINO").length, 1);
  });
});
