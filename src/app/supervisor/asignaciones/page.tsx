"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Loader2,
  UserCheck,
  AlertTriangle,
  RefreshCw,
  CheckCircle,
} from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { TecnicoMultiSelect } from "@/components/TecnicoMultiSelect";
import { TicketSemaforo } from "@/components/TicketSemaforo";
import { PRIORIDAD_LABELS, TIPO_LABELS, formatDateTime } from "@/lib/utils";

type TecnicoOpt = {
  id: string;
  nombre: string;
  email?: string;
  estado: string;
};

type TicketAsig = {
  id: string;
  codigo: string;
  tipo: string;
  prioridad: string;
  estado: string;
  programadoEn: string | null;
  motivo: string | null;
  cliente: { id: string; nombre: string; sector: string; direccion: string };
  tecnicoIds: string[];
  tecnicosLabel: string;
  sinAsignar: boolean;
};

export default function AsignacionesPage() {
  const [tickets, setTickets] = useState<TicketAsig[]>([]);
  const [tecnicos, setTecnicos] = useState<TecnicoOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, string[]>>({});
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");
  const [soloSinAsignar, setSoloSinAsignar] = useState(false);
  const [syncInfo, setSyncInfo] = useState("");
  const [publicando, setPublicando] = useState(false);
  const [porTecnico, setPorTecnico] = useState<
    { nombre: string; email: string; codigos: string[] }[]
  >([]);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/supervisor/asignaciones", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo cargar");
      setTickets(data.tickets || []);
      setTecnicos(data.tecnicos || []);
      const d: Record<string, string[]> = {};
      for (const t of data.tickets || []) d[t.id] = t.tecnicoIds || [];
      setDraft(d);
      if (data.sync) {
        setSyncInfo(
          `Sincronizados ${data.sync.revisados} activos · reparados ${data.sync.reparados} · sin asignar ${data.sync.sinAsignar}`
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar");
    } finally {
      setLoading(false);
    }
  }, []);

  const publicarApps = useCallback(async () => {
    setPublicando(true);
    setError("");
    setMensaje("");
    try {
      const res = await fetch("/api/supervisor/asignaciones", {
        method: "POST",
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo publicar");
      setMensaje(data.mensaje || "Órdenes publicadas a las apps");
      setPorTecnico(data.porTecnico || []);
      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al publicar");
    } finally {
      setPublicando(false);
    }
  }, [cargar]);

  useEffect(() => {
    void (async () => {
      await cargar();
      // Al abrir la pantalla, republica automáticamente a las apps
      try {
        const res = await fetch("/api/supervisor/asignaciones", {
          method: "POST",
          cache: "no-store",
        });
        const data = await res.json();
        if (res.ok) {
          setMensaje(data.mensaje || "Órdenes actualizadas en apps");
          setPorTecnico(data.porTecnico || []);
          await cargar();
        }
      } catch {
        /* la lista ya cargó; el botón manual queda disponible */
      }
    })();
  }, [cargar]);

  async function destinar(ticketId: string) {
    const tecnicoIds = draft[ticketId] || [];
    if (tecnicoIds.length === 0) {
      setError("Seleccione al menos un técnico");
      return;
    }
    setSavingId(ticketId);
    setError("");
    setMensaje("");
    try {
      const res = await fetch("/api/supervisor/asignaciones", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticketId, tecnicoIds }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo destinar");
      setMensaje(data.mensaje || "Ticket destinado");
      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al destinar");
    } finally {
      setSavingId(null);
    }
  }

  const visibles = soloSinAsignar ? tickets.filter((t) => t.sinAsignar) : tickets;

  return (
    <div className="min-h-dvh bg-slate-50">
      <AppHeader
        title="Destinar tickets"
        subtitle="Asigne tickets activos a técnicos — aparecen en su app de trabajo"
      />

      <main className="max-w-5xl mx-auto p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/supervisor"
            className="inline-flex items-center gap-1 text-sm text-infinity-600 hover:underline"
          >
            <ArrowLeft className="w-4 h-4" /> Panel supervisor
          </Link>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void publicarApps()}
              disabled={loading || publicando}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold disabled:opacity-50"
            >
              {publicando ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <UserCheck className="w-4 h-4" />
              )}
              Actualizar y enviar a apps
            </button>
            <button
              type="button"
              onClick={() => void cargar()}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium hover:bg-white disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              Actualizar lista
            </button>
          </div>
        </div>

        <div className="bg-sky-50 border border-sky-200 rounded-xl p-4 text-sm text-sky-950 space-y-1">
          <p className="font-semibold flex items-center gap-2">
            <UserCheck className="w-4 h-4" />
            Cómo funciona
          </p>
          <ol className="list-decimal pl-4 text-xs space-y-1 text-sky-900">
            <li>Seleccione uno o más técnicos en cada ticket activo.</li>
            <li>
              Pulse <strong>Destinar a app</strong>. El ticket queda asignado y se sincroniza.
            </li>
            <li>
              Pulse <strong>Actualizar y enviar a apps</strong> para republicar todas las órdenes
              activas (ej. ST-1002) a Kevin, David, Sergio, etc.
            </li>
            <li>
              Cada técnico refresca su app:{" "}
              <code className="bg-white/80 px-1 rounded">/login?app=tecnico</code> → Mis órdenes.
            </li>
          </ol>
          {syncInfo && <p className="text-xs text-sky-800 pt-1">{syncInfo}</p>}
        </div>

        {porTecnico.length > 0 && (
          <div className="bg-white rounded-xl border p-4 space-y-2">
            <p className="font-semibold text-sm">Qué verá cada técnico en Mis órdenes</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {porTecnico.map((t) => (
                <div key={t.email} className="rounded-lg border p-3 text-sm">
                  <p className="font-medium">{t.nombre}</p>
                  <p className="text-xs text-slate-500">{t.email}</p>
                  <p className="text-xs mt-1">
                    {t.codigos.length === 0 ? (
                      <span className="text-amber-700">Sin órdenes activas</span>
                    ) : (
                      <span className="text-emerald-700 font-medium">
                        {t.codigos.join(", ")}
                      </span>
                    )}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        <label className="inline-flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={soloSinAsignar}
            onChange={(e) => setSoloSinAsignar(e.target.checked)}
          />
          Solo sin asignar
          <span className="text-xs text-slate-400">
            ({tickets.filter((t) => t.sinAsignar).length} de {tickets.length})
          </span>
        </label>

        {mensaje && (
          <div className="bg-emerald-50 text-emerald-800 text-sm p-3 rounded-xl border border-emerald-200 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 shrink-0" />
            {mensaje}
          </div>
        )}
        {error && (
          <div className="bg-red-50 text-red-800 text-sm p-3 rounded-xl border border-red-200 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-infinity-600" />
          </div>
        ) : visibles.length === 0 ? (
          <p className="text-center text-slate-400 py-12 text-sm">
            No hay tickets activos{soloSinAsignar ? " sin asignar" : ""}.
          </p>
        ) : (
          <div className="space-y-3">
            {visibles.map((t) => (
              <div
                key={t.id}
                className={`bg-white rounded-xl border p-4 space-y-3 ${
                  t.sinAsignar ? "border-amber-300" : "border-slate-200"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link
                        href={`/supervisor/tickets/${t.id}/editar`}
                        className="font-semibold text-infinity-700 hover:underline"
                      >
                        {t.codigo}
                      </Link>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                        {TIPO_LABELS[t.tipo] ?? t.tipo}
                      </span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          t.prioridad === "ALTA"
                            ? "bg-red-100 text-red-800"
                            : t.prioridad === "MEDIA"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {PRIORIDAD_LABELS[t.prioridad]}
                      </span>
                      <TicketSemaforo estado={t.estado} />
                      {t.sinAsignar && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 font-medium">
                          Sin técnico
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-700 mt-1">
                      {t.cliente.nombre} · {t.cliente.sector}
                    </p>
                    <p className="text-xs text-slate-500">
                      {t.programadoEn
                        ? `Programado: ${formatDateTime(t.programadoEn)}`
                        : "Sin fecha programada"}
                      {t.tecnicosLabel ? ` · Actual: ${t.tecnicosLabel}` : ""}
                    </p>
                  </div>
                </div>

                <div className="grid sm:grid-cols-[1fr_auto] gap-3 items-end">
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Técnicos designados</p>
                    <TecnicoMultiSelect
                      tecnicos={tecnicos}
                      selected={draft[t.id] || []}
                      onChange={(tecnicoIds) =>
                        setDraft((prev) => ({ ...prev, [t.id]: tecnicoIds }))
                      }
                    />
                  </div>
                  <button
                    type="button"
                    disabled={savingId === t.id || (draft[t.id] || []).length === 0}
                    onClick={() => void destinar(t.id)}
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold disabled:opacity-50"
                  >
                    {savingId === t.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <UserCheck className="w-4 h-4" />
                    )}
                    Destinar a app
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
