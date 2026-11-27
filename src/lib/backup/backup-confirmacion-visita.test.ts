import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  BACKUP_FORMAT_VERSION,
  BACKUP_KIND,
  BACKUP_TABLE_ORDER,
  BackupConfirmationRequiredError,
  BackupFullReplaceConfirmationRequiredError,
  BackupRestoreCancelledError,
  RESTORE_CONFIRM_PHRASE,
  analizarCompatibilidadBackup,
  buildBackup,
  getBackupStatus,
  restoreBackup,
  sanitizarMensajeErrorBackup,
  type BackupTableDelegate,
  type BackupTableName,
} from "./index";

type Row = Record<string, unknown>;

function crearDbBackupEnMemoria(
  inicial: Partial<Record<BackupTableName, Row[]>> = {},
  opts?: {
    fallarAlInsertarTabla?: { tabla: BackupTableName; error: Error };
  }
) {
  const store = new Map<BackupTableName, Row[]>();
  for (const name of BACKUP_TABLE_ORDER) {
    store.set(name, [...(inicial[name] ?? [])]);
  }

  const logDeleteOrder: BackupTableName[] = [];
  const logInsertOrder: BackupTableName[] = [];

  function idsDe(name: BackupTableName): Set<string> {
    return new Set((store.get(name) ?? []).map((r) => String(r.id)));
  }

  function validarFks(name: BackupTableName, row: Row) {
    if (name === "Ticket") {
      if (row.clienteId && !idsDe("Cliente").has(String(row.clienteId))) {
        throw new Error(`FK violation: Ticket.clienteId=${String(row.clienteId)} no existe`);
      }
      if (row.tecnicoId && !idsDe("Tecnico").has(String(row.tecnicoId))) {
        throw new Error(`FK violation: Ticket.tecnicoId=${String(row.tecnicoId)} no existe`);
      }
    }
    if (name === "TicketConfirmacionVisita") {
      if (!row.ticketId || !idsDe("Ticket").has(String(row.ticketId))) {
        throw new Error(
          `FK violation: TicketConfirmacionVisita.ticketId=${String(row.ticketId)} no existe`
        );
      }
      for (const fkUser of [
        "confirmadoPorUsuarioId",
        "exentoPorUsuarioId",
        "enCaminoPorUsuarioId",
      ]) {
        if (row[fkUser] != null && !idsDe("Usuario").has(String(row[fkUser]))) {
          throw new Error(`FK violation: ${fkUser} no existe`);
        }
      }
      if (
        row.enCaminoPorTecnicoId != null &&
        !idsDe("Tecnico").has(String(row.enCaminoPorTecnicoId))
      ) {
        throw new Error(`FK violation: enCaminoPorTecnicoId no existe`);
      }
    }
  }

  function esDuplicado(name: BackupTableName, existentes: Row[], row: Row): boolean {
    if (existentes.some((e) => e.id != null && e.id === row.id)) return true;
    if (name === "TicketConfirmacionVisita") {
      if (existentes.some((e) => e.ticketId != null && e.ticketId === row.ticketId)) return true;
      if (row.token != null && existentes.some((e) => e.token === row.token)) return true;
    }
    return false;
  }

  const getDelegate = (name: BackupTableName): BackupTableDelegate => ({
    async findMany() {
      return [...(store.get(name) ?? [])];
    },
    async count() {
      return (store.get(name) ?? []).length;
    },
    async deleteMany() {
      logDeleteOrder.push(name);
      // Verifica integridad referencial al borrar: no se puede borrar Ticket si aún hay TicketConfirmacionVisita
      if (name === "Ticket" && (store.get("TicketConfirmacionVisita")?.length ?? 0) > 0) {
        throw new Error("FK violation: no se puede borrar Ticket antes que TicketConfirmacionVisita");
      }
      if (name === "Usuario" && (store.get("TicketConfirmacionVisita")?.length ?? 0) > 0) {
        throw new Error("FK violation: no se puede borrar Usuario antes que TicketConfirmacionVisita");
      }
      if (name === "Tecnico" && (store.get("TicketConfirmacionVisita")?.length ?? 0) > 0) {
        throw new Error("FK violation: no se puede borrar Tecnico antes que TicketConfirmacionVisita");
      }
      const prev = store.get(name) ?? [];
      store.set(name, []);
      return { count: prev.length };
    },
    async createMany({ data, skipDuplicates }) {
      logInsertOrder.push(name);
      if (opts?.fallarAlInsertarTabla?.tabla === name) {
        throw opts.fallarAlInsertarTabla.error;
      }
      const current = store.get(name) ?? [];
      let inserted = 0;
      for (const rawRow of data) {
        const row = rawRow as Row;
        validarFks(name, row);
        if (esDuplicado(name, current, row)) {
          if (skipDuplicates) continue;
          throw new Error(`Unique constraint failed on ${name}`);
        }
        current.push({ ...row });
        inserted++;
      }
      store.set(name, current);
      return { count: inserted };
    },
  });

  return { store, getDelegate, logDeleteOrder, logInsertOrder };
}

function datosSinteticosCompletos(): Partial<Record<BackupTableName, Row[]>> {
  const ahora = new Date("2026-11-27T15:00:00.000Z");
  return {
    Usuario: [
      { id: "usr_sup_test", nombre: "Supervisor Test", email: "sup@test.local", rol: "SUPERVISOR" },
      { id: "usr_tec_test", nombre: "Tecnico Test", email: "tec@test.local", rol: "TECNICO" },
    ],
    Tecnico: [{ id: "tec_test_1", usuarioId: "usr_tec_test", nombre: "Tecnico Uno" }],
    Cliente: [{ id: "cli_test_1", nombre: "Cliente Sintético S.A.", telefono: "0990000001" }],
    Ticket: [
      {
        id: "tk_test_1",
        codigo: "ST-TEST-01",
        tipo: "SOPORTE",
        estado: "PENDIENTE",
        clienteId: "cli_test_1",
        tecnicoId: "tec_test_1",
        programadoEn: new Date("2026-11-28T15:00:00.000Z"),
        createdAt: ahora,
      },
      {
        id: "tk_test_2",
        codigo: "ST-TEST-02",
        tipo: "CORTE",
        estado: "PENDIENTE",
        clienteId: "cli_test_1",
        tecnicoId: "tec_test_1",
        programadoEn: new Date("2026-11-28T16:00:00.000Z"),
        createdAt: ahora,
      },
    ],
    TicketConfirmacionVisita: [
      {
        id: "cv_test_1",
        ticketId: "tk_test_1",
        estado: "CONFIRMADO",
        requierePresencia: true,
        exentoMotivo: null,
        exentoPorUsuarioId: null,
        exentoEn: null,
        token: "tok_sintetico_confirmacion_visita_9876543210abcdef",
        tokenExpiraEn: new Date("2026-11-28T19:00:00.000Z"),
        tokenRevocadoEn: null,
        programadoEnConfirmado: new Date("2026-11-28T15:00:00.000Z"),
        confirmadoEn: new Date("2026-11-27T15:30:00.000Z"),
        confirmadoPorCanal: "WHATSAPP_ENLACE",
        confirmadoPorUsuarioId: "usr_sup_test",
        confirmadoPorNombre: "Supervisor Test",
        personaRecibe: "Persona Prueba",
        horarioSolicitado: null,
        observacionCliente: "Timbrar al llegar",
        respondidoEn: new Date("2026-11-27T15:30:00.000Z"),
        enCaminoEn: new Date("2026-11-28T14:30:00.000Z"),
        enCaminoPorTecnicoId: "tec_test_1",
        enCaminoPorUsuarioId: "usr_tec_test",
        ultimoEnvioEn: new Date("2026-11-27T15:05:00.000Z"),
        ultimoEnvioCanal: "WHATSAPP",
        ultimoEnvioEstado: "ENVIADO",
        enviosCount: 2,
        createdAt: ahora,
        updatedAt: ahora,
      },
      {
        id: "cv_test_2",
        ticketId: "tk_test_2",
        estado: "EXENTO",
        requierePresencia: false,
        exentoMotivo: "Corte exterior en poste NAP",
        exentoPorUsuarioId: "usr_sup_test",
        exentoEn: new Date("2026-11-27T15:10:00.000Z"),
        token: null,
        tokenExpiraEn: null,
        tokenRevocadoEn: new Date("2026-11-27T15:10:00.000Z"),
        programadoEnConfirmado: new Date("2026-11-28T16:00:00.000Z"),
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
        createdAt: ahora,
        updatedAt: ahora,
      },
    ],
  };
}

describe("Backup y restauración JSON de Gerencia — TicketConfirmacionVisita", () => {
  it("1) el orden de BACKUP_TABLE_ORDER respeta claves foráneas en inserción y eliminación", () => {
    const idxUsuario = BACKUP_TABLE_ORDER.indexOf("Usuario");
    const idxTecnico = BACKUP_TABLE_ORDER.indexOf("Tecnico");
    const idxCliente = BACKUP_TABLE_ORDER.indexOf("Cliente");
    const idxTicket = BACKUP_TABLE_ORDER.indexOf("Ticket");
    const idxConfirm = BACKUP_TABLE_ORDER.indexOf("TicketConfirmacionVisita");

    assert.ok(idxConfirm > -1, "TicketConfirmacionVisita debe estar en BACKUP_TABLE_ORDER");
    assert.ok(idxUsuario < idxConfirm, "Usuario debe insertarse antes que TicketConfirmacionVisita");
    assert.ok(idxTecnico < idxConfirm, "Tecnico debe insertarse antes que TicketConfirmacionVisita");
    assert.ok(idxCliente < idxConfirm, "Cliente debe insertarse antes que TicketConfirmacionVisita");
    assert.ok(idxTicket < idxConfirm, "Ticket debe insertarse antes que TicketConfirmacionVisita");
  });

  it("2) la exportación y el estado incluyen TicketConfirmacionVisita con todos sus campos", async () => {
    const origen = crearDbBackupEnMemoria(datosSinteticosCompletos());

    const status = await getBackupStatus({ getDelegate: origen.getDelegate });
    assert.equal(status.tables.TicketConfirmacionVisita, 2);

    const payload = await buildBackup({ includeMedia: true, getDelegate: origen.getDelegate });
    assert.equal(payload.formatVersion, BACKUP_FORMAT_VERSION);
    assert.equal(payload.kind, BACKUP_KIND);
    assert.equal(payload.counts.TicketConfirmacionVisita, 2);
    assert.equal(payload.tables.TicketConfirmacionVisita.length, 2);

    const fila1 = payload.tables.TicketConfirmacionVisita[0] as Row;
    assert.equal(fila1.id, "cv_test_1");
    assert.equal(fila1.ticketId, "tk_test_1");
    assert.equal(fila1.estado, "CONFIRMADO");
    assert.equal(fila1.token, "tok_sintetico_confirmacion_visita_9876543210abcdef");
    assert.equal(fila1.tokenExpiraEn, "2026-11-28T19:00:00.000Z");
    assert.equal(fila1.confirmadoPorCanal, "WHATSAPP_ENLACE");
    assert.equal(fila1.confirmadoPorUsuarioId, "usr_sup_test");
    assert.equal(fila1.personaRecibe, "Persona Prueba");
    assert.equal(fila1.enCaminoEn, "2026-11-28T14:30:00.000Z");
    assert.equal(fila1.enCaminoPorTecnicoId, "tec_test_1");
    assert.equal(fila1.enCaminoPorUsuarioId, "usr_tec_test");
    assert.equal(fila1.enviosCount, 2);

    const fila2 = payload.tables.TicketConfirmacionVisita[1] as Row;
    assert.equal(fila2.estado, "EXENTO");
    assert.equal(fila2.requierePresencia, false);
    assert.equal(fila2.exentoMotivo, "Corte exterior en poste NAP");
    assert.equal(fila2.exentoPorUsuarioId, "usr_sup_test");
    assert.equal(fila2.tokenRevocadoEn, "2026-11-27T15:10:00.000Z");
  });

  it("3) la restauración reconstruye campos Date y relaciones respetando el orden FK", async () => {
    const origen = crearDbBackupEnMemoria(datosSinteticosCompletos());
    const payload = await buildBackup({ includeMedia: true, getDelegate: origen.getDelegate });
    // Simula paso real por JSON.stringify / JSON.parse
    const deserializado = JSON.parse(JSON.stringify(payload));

    const destino = crearDbBackupEnMemoria(datosSinteticosCompletos());
    const result = await restoreBackup(deserializado, {
      confirmPhrase: RESTORE_CONFIRM_PHRASE,
      confirmarReemplazoCompleto: true,
      getDelegate: destino.getDelegate,
    });

    assert.equal(result.inserted.TicketConfirmacionVisita, 2);
    assert.equal(result.deleted.TicketConfirmacionVisita, 2);

    // Orden real de delete: TicketConfirmacionVisita antes que Ticket, Tecnico y Usuario
    assert.ok(
      destino.logDeleteOrder.indexOf("TicketConfirmacionVisita") <
        destino.logDeleteOrder.indexOf("Ticket")
    );
    // Orden real de insert: Ticket, Tecnico y Usuario antes que TicketConfirmacionVisita
    assert.ok(
      destino.logInsertOrder.indexOf("Ticket") <
        destino.logInsertOrder.indexOf("TicketConfirmacionVisita")
    );

    const restauradas = destino.store.get("TicketConfirmacionVisita")!;
    assert.equal(restauradas.length, 2);
    assert.ok(restauradas[0].tokenExpiraEn instanceof Date);
    assert.ok(restauradas[0].enCaminoEn instanceof Date);
    assert.ok(restauradas[0].confirmadoEn instanceof Date);
    assert.equal(restauradas[0].ticketId, "tk_test_1");
    assert.equal(restauradas[0].confirmadoPorUsuarioId, "usr_sup_test");
    assert.equal(restauradas[0].enCaminoPorTecnicoId, "tec_test_1");
    assert.equal(restauradas[0].enCaminoPorUsuarioId, "usr_tec_test");
    assert.ok(restauradas[1].exentoEn instanceof Date);
    assert.equal(restauradas[1].exentoPorUsuarioId, "usr_sup_test");
  });

  it("4) backup antiguo sin TicketConfirmacionVisita: exige confirmación previa, advierte y restaura solo si se confirma", async () => {
    const origen = crearDbBackupEnMemoria(datosSinteticosCompletos());
    const payloadAntiguo = JSON.parse(
      JSON.stringify(await buildBackup({ includeMedia: true, getDelegate: origen.getDelegate }))
    );
    delete payloadAntiguo.tables.TicketConfirmacionVisita;
    delete payloadAntiguo.counts.TicketConfirmacionVisita;

    // 4a. Análisis previo detecta backup antiguo y genera advertencias explícitas
    const analisis = analizarCompatibilidadBackup(payloadAntiguo);
    assert.equal(analisis.faltaConfirmacionVisita, true);
    assert.equal(analisis.confirmacionesEnBackup, null);
    assert.equal(analisis.requiereConfirmacionBackupAntiguo, true);
    assert.ok(
      analisis.advertenciasPreRestauracion.some((w) => w.includes("reemplazo completo")),
      "Debe advertir reemplazo completo"
    );
    assert.ok(
      analisis.advertenciasPreRestauracion.some((w) =>
        w.includes("TicketConfirmacionVisita") && w.includes("eliminadas")
      ),
      "Debe advertir que las confirmaciones actuales serán eliminadas"
    );
    assert.ok(
      analisis.advertenciasPreRestauracion.some((w) =>
        w.includes("enlaces públicos de confirmación vigentes")
      ),
      "Debe advertir que los enlaces vigentes dejarán de funcionar"
    );

    // 4b. Con reemplazo completo aceptado pero SIN confirmación de backup antiguo → rechaza ANTES de deleteMany
    const destinoSinConfirm = crearDbBackupEnMemoria(datosSinteticosCompletos());
    await assert.rejects(
      () =>
        restoreBackup(payloadAntiguo, {
          confirmPhrase: RESTORE_CONFIRM_PHRASE,
          confirmarReemplazoCompleto: true,
          getDelegate: destinoSinConfirm.getDelegate,
        }),
      (err: unknown) => err instanceof BackupConfirmationRequiredError
    );
    assert.equal(
      destinoSinConfirm.logDeleteOrder.length,
      0,
      "No debe ejecutar deleteMany si falta confirmación explícita de backup antiguo"
    );
    assert.equal(destinoSinConfirm.store.get("TicketConfirmacionVisita")!.length, 2);

    // 4c. Con confirmación explícita → reemplaza completo, restaura 0 confirmaciones y emite warning
    const destino = crearDbBackupEnMemoria(datosSinteticosCompletos());
    const res = await restoreBackup(payloadAntiguo, {
      confirmPhrase: RESTORE_CONFIRM_PHRASE,
      confirmarReemplazoCompleto: true,
      confirmarBackupAntiguoSinConfirmaciones: true,
      getDelegate: destino.getDelegate,
    });

    assert.equal(res.mode, "replace");
    assert.equal(res.inserted.Ticket, 2);
    assert.equal(res.deleted.TicketConfirmacionVisita, 2);
    assert.equal(res.inserted.TicketConfirmacionVisita, 0);
    assert.equal(destino.store.get("TicketConfirmacionVisita")!.length, 0);
    assert.ok(
      res.warnings.some(
        (w) =>
          w.includes("Backup antiguo sin tabla TicketConfirmacionVisita") &&
          w.includes("se eliminaron 2 confirmaciones actuales") &&
          w.includes("enlaces de confirmación vigentes")
      )
    );
  });

  it("5) backup con TicketConfirmacionVisita vacía ([]) restaura explícitamente 0 registros", async () => {
    const sinConfirm = datosSinteticosCompletos();
    sinConfirm.TicketConfirmacionVisita = [];
    const origen = crearDbBackupEnMemoria(sinConfirm);
    const payload = await buildBackup({ includeMedia: true, getDelegate: origen.getDelegate });
    assert.equal(payload.counts.TicketConfirmacionVisita, 0);

    const analisis = analizarCompatibilidadBackup(payload);
    assert.equal(analisis.faltaConfirmacionVisita, false);
    assert.equal(analisis.confirmacionesEnBackup, 0);
    assert.equal(analisis.requiereConfirmacionBackupAntiguo, false);
    assert.ok(
      analisis.advertenciasPreRestauracion.some((w) => w.includes("0 registros"))
    );

    // Contra BD con confirmaciones previas → reemplaza por 0 registros y avisa cuántas se eliminaron
    const destino = crearDbBackupEnMemoria(datosSinteticosCompletos());
    const res = await restoreBackup(payload, {
      confirmPhrase: RESTORE_CONFIRM_PHRASE,
      confirmarReemplazoCompleto: true,
      getDelegate: destino.getDelegate,
    });

    assert.equal(res.deleted.TicketConfirmacionVisita, 2);
    assert.equal(res.inserted.TicketConfirmacionVisita, 0);
    assert.ok(
      res.warnings.some((w) => w.includes("el backup contenía 0 registros"))
    );
  });

  it("6) la restauración evita duplicados (por id, ticketId y token) usando skipDuplicates", async () => {
    const origen = crearDbBackupEnMemoria(datosSinteticosCompletos());
    const payload = JSON.parse(
      JSON.stringify(await buildBackup({ includeMedia: true, getDelegate: origen.getDelegate }))
    );
    // Inyectamos un duplicado exacto y otro con mismo ticketId
    payload.tables.TicketConfirmacionVisita.push({
      ...payload.tables.TicketConfirmacionVisita[0],
    });
    payload.tables.TicketConfirmacionVisita.push({
      ...payload.tables.TicketConfirmacionVisita[0],
      id: "cv_test_dup_ticket",
      token: "tok_distinto_pero_ticket_duplicado_1234567890abcdef",
    });

    const destino = crearDbBackupEnMemoria();
    const res = await restoreBackup(payload, {
      confirmPhrase: RESTORE_CONFIRM_PHRASE,
      confirmarReemplazoCompleto: true,
      getDelegate: destino.getDelegate,
    });

    assert.equal(res.inserted.TicketConfirmacionVisita, 2);
    assert.equal(destino.store.get("TicketConfirmacionVisita")!.length, 2);
    assert.ok(
      res.warnings.some((w) => w.includes("TicketConfirmacionVisita: insertados 2 de 4"))
    );
  });

  it("7) no imprime tokens en console ni los expone en mensajes de error", async () => {
    const tokenSecreto = "tok_publico_secreto_no_filtrar_9876543210abcdef123456";
    const datos = datosSinteticosCompletos();
    datos.TicketConfirmacionVisita![0].token = tokenSecreto;

    const logsCapturados: string[] = [];
    const origLog = console.log;
    const origErr = console.error;
    console.log = (...args: unknown[]) => logsCapturados.push(args.map(String).join(" "));
    console.error = (...args: unknown[]) => logsCapturados.push(args.map(String).join(" "));

    try {
      const origen = crearDbBackupEnMemoria(datos);
      const payload = await buildBackup({ includeMedia: true, getDelegate: origen.getDelegate });

      // Fuerza un error cuyo mensaje crudo de Prisma contiene el token
      const destinoConError = crearDbBackupEnMemoria(
        {},
        {
          fallarAlInsertarTabla: {
            tabla: "TicketConfirmacionVisita",
            error: new Error(
              `Unique constraint failed on token: "${tokenSecreto}" (raw=${tokenSecreto})`
            ),
          },
        }
      );

      let mensajeError = "";
      try {
        await restoreBackup(payload, {
          confirmPhrase: RESTORE_CONFIRM_PHRASE,
          confirmarReemplazoCompleto: true,
          getDelegate: destinoConError.getDelegate,
        });
      } catch (err) {
        mensajeError = err instanceof Error ? err.message : String(err);
      }

      assert.ok(mensajeError.includes("Fallo al restaurar tabla TicketConfirmacionVisita"));
      assert.equal(
        mensajeError.includes(tokenSecreto),
        false,
        "El mensaje de error NO debe exponer el token público"
      );
      assert.ok(mensajeError.includes("[REDACTED]"));

      // Tampoco debe haber aparecido en logs de consola durante export/restore
      const todoLog = logsCapturados.join("\n");
      assert.equal(todoLog.includes(tokenSecreto), false);

      // Verificación directa de la función sanitizadora
      const sanitizado = sanitizarMensajeErrorBackup(
        "TicketConfirmacionVisita",
        `value token="${tokenSecreto}"`
      );
      assert.equal(sanitizado.includes(tokenSecreto), false);
    } finally {
      console.log = origLog;
      console.error = origErr;
    }
  });

  it("8) la confirmación de advertencia ocurre ANTES de iniciar deleteMany", async () => {
    const origen = crearDbBackupEnMemoria(datosSinteticosCompletos());
    const payload = JSON.parse(
      JSON.stringify(await buildBackup({ includeMedia: true, getDelegate: origen.getDelegate }))
    );

    const destino = crearDbBackupEnMemoria(datosSinteticosCompletos());
    let deletesAlMomentoDeConfirmar = -1;
    let vioAdvertenciaReemplazo = false;

    const res = await restoreBackup(payload, {
      confirmPhrase: RESTORE_CONFIRM_PHRASE,
      confirmarReemplazoCompleto: true,
      getDelegate: destino.getDelegate,
      onBeforeDestructive: (analisis) => {
        deletesAlMomentoDeConfirmar = destino.logDeleteOrder.length;
        vioAdvertenciaReemplazo = analisis.advertenciasPreRestauracion.some((w) =>
          w.includes("reemplazo completo")
        );
        return true;
      },
    });

    assert.equal(
      deletesAlMomentoDeConfirmar,
      0,
      "onBeforeDestructive debe ejecutarse antes de cualquier deleteMany"
    );
    assert.equal(vioAdvertenciaReemplazo, true);
    assert.equal(res.inserted.TicketConfirmacionVisita, 2);
  });

  it("9) cancelar la confirmación NO ejecuta deleteMany ni modifica ningún dato", async () => {
    const origen = crearDbBackupEnMemoria(datosSinteticosCompletos());
    const payload = JSON.parse(
      JSON.stringify(await buildBackup({ includeMedia: true, getDelegate: origen.getDelegate }))
    );

    const destino = crearDbBackupEnMemoria(datosSinteticosCompletos());
    const confirmacionesAntes = JSON.stringify(destino.store.get("TicketConfirmacionVisita"));
    const ticketsAntes = JSON.stringify(destino.store.get("Ticket"));

    await assert.rejects(
      () =>
        restoreBackup(payload, {
          confirmPhrase: RESTORE_CONFIRM_PHRASE,
          getDelegate: destino.getDelegate,
          onBeforeDestructive: () => false,
        }),
      (err: unknown) => err instanceof BackupRestoreCancelledError
    );

    assert.equal(destino.logDeleteOrder.length, 0, "No debe ejecutar ningún deleteMany al cancelar");
    assert.equal(destino.logInsertOrder.length, 0, "No debe ejecutar ningún createMany al cancelar");
    assert.equal(
      JSON.stringify(destino.store.get("TicketConfirmacionVisita")),
      confirmacionesAntes
    );
    assert.equal(JSON.stringify(destino.store.get("Ticket")), ticketsAntes);
  });

  it("10) exige aceptación explícita de reemplazo completo incluso para backups CON TicketConfirmacionVisita (con registros o [])", async () => {
    // 10a. Backup con registros de TicketConfirmacionVisita sin confirmarReemplazoCompleto
    const origenCon = crearDbBackupEnMemoria(datosSinteticosCompletos());
    const payloadCon = JSON.parse(
      JSON.stringify(await buildBackup({ includeMedia: true, getDelegate: origenCon.getDelegate }))
    );

    const destinoCon = crearDbBackupEnMemoria(datosSinteticosCompletos());
    await assert.rejects(
      () =>
        restoreBackup(payloadCon, {
          confirmPhrase: RESTORE_CONFIRM_PHRASE,
          getDelegate: destinoCon.getDelegate,
        }),
      (err: unknown) => err instanceof BackupFullReplaceConfirmationRequiredError
    );
    assert.equal(
      destinoCon.logDeleteOrder.length,
      0,
      "No debe ejecutar deleteMany sin aceptación explícita de reemplazo completo"
    );
    assert.equal(destinoCon.store.get("TicketConfirmacionVisita")!.length, 2);

    // 10b. Backup con TicketConfirmacionVisita: [] sin confirmarReemplazoCompleto
    const datosVacios = datosSinteticosCompletos();
    datosVacios.TicketConfirmacionVisita = [];
    const origenVacio = crearDbBackupEnMemoria(datosVacios);
    const payloadVacio = JSON.parse(
      JSON.stringify(
        await buildBackup({ includeMedia: true, getDelegate: origenVacio.getDelegate })
      )
    );

    const destinoVacio = crearDbBackupEnMemoria(datosSinteticosCompletos());
    await assert.rejects(
      () =>
        restoreBackup(payloadVacio, {
          confirmPhrase: RESTORE_CONFIRM_PHRASE,
          getDelegate: destinoVacio.getDelegate,
        }),
      (err: unknown) => err instanceof BackupFullReplaceConfirmationRequiredError
    );
    assert.equal(
      destinoVacio.logDeleteOrder.length,
      0,
      "No debe ejecutar deleteMany en backup con tabla vacía sin aceptación explícita"
    );
    assert.equal(destinoVacio.store.get("TicketConfirmacionVisita")!.length, 2);
  });
});
