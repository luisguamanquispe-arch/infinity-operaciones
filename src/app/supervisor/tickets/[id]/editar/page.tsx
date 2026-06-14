"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, CheckCircle } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { TIPO_LABELS, ESTADO_LABELS, PRIORIDAD_LABELS } from "@/lib/utils";
import { toDatetimeLocalValue } from "@/lib/calendario";
import { TecnicoMultiSelect } from "@/components/TecnicoMultiSelect";
import { enMayusculas, inputMayusculasClass } from "@/lib/mayusculas";

interface Tecnico {
  id: string;
  nombre: string;
  estado: string;
}

const TIPOS = ["SOPORTE", "INFRAESTRUCTURA", "INSTALACION", "RECONEXION", "CORTE", "MIGRACION", "RETIRO"];
const ESTADOS = ["PENDIENTE", "EN_PROCESO", "FINALIZADO", "CERRADO", "CANCELADO"];

export default function EditarTicketPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [tecnicos, setTecnicos] = useState<Tecnico[]>([]);
  const [codigo, setCodigo] = useState("");
  const [clienteNombre, setClienteNombre] = useState("");
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [exito, setExito] = useState("");

  const [form, setForm] = useState({
    tipo: "SOPORTE",
    prioridad: "MEDIA",
    estado: "PENDIENTE",
    motivo: "",
    descripcion: "",
    tecnicoIds: [] as string[],
    programadoEn: "",
  });

  useEffect(() => {
    Promise.all([
      fetch(`/api/tickets/${id}`).then((r) => r.json()),
      fetch("/api/tecnicos").then((r) => r.json()),
    ]).then(([ticketData, tecData]) => {
      if (ticketData.error) {
        setError(ticketData.error);
        setLoading(false);
        return;
      }
      const t = ticketData.ticket;
      setCodigo(t.codigo);
      setClienteNombre(t.cliente.nombre);
      setForm({
        tipo: t.tipo,
        prioridad: t.prioridad,
        estado: t.estado,
        motivo: t.motivo || "",
        descripcion: t.descripcion || "",
        tecnicoIds: t.tecnicoIds?.length
          ? t.tecnicoIds
          : t.tecnicoId
            ? [t.tecnicoId]
            : [],
        programadoEn: toDatetimeLocalValue(t.programadoEn),
      });
      setTecnicos(tecData.tecnicos);
      setLoading(false);
    });
  }, [id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setGuardando(true);
    setError("");
    setExito("");

    const res = await fetch(`/api/tickets/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        tecnicoIds: form.tecnicoIds,
        programadoEn: form.programadoEn || null,
      }),
    });

    const data = await res.json();
    setGuardando(false);

    if (!res.ok) {
      setError(data.error || "Error al guardar");
      return;
    }

    setExito("Ticket actualizado correctamente");
    setTimeout(() => router.push("/supervisor"), 1500);
  }

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-infinity-600" />
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-slate-50">
      <AppHeader title={`Editar ${codigo}`} subtitle={clienteNombre} />

      <main className="max-w-lg mx-auto p-4 space-y-4">
        <Link
          href="/supervisor"
          className="inline-flex items-center gap-1 text-sm text-infinity-600 hover:underline"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver al panel
        </Link>

        {error && (
          <div className="bg-red-50 text-red-700 p-3 rounded-xl text-sm">{error}</div>
        )}
        {exito && (
          <div className="bg-emerald-50 text-emerald-700 p-3 rounded-xl text-sm flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            {exito}
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-white rounded-xl border p-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500">Tipo de trabajo</label>
              <select
                value={form.tipo}
                onChange={(e) => setForm({ ...form, tipo: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm mt-0.5"
              >
                {TIPOS.map((t) => (
                  <option key={t} value={t}>{TIPO_LABELS[t]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500">Prioridad</label>
              <select
                value={form.prioridad}
                onChange={(e) => setForm({ ...form, prioridad: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm mt-0.5"
              >
                <option value="ALTA">Alta (SLA 4h)</option>
                <option value="MEDIA">Media (SLA 8h)</option>
                <option value="BAJA">Baja (SLA 24h)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-500">Estado</label>
            <select
              value={form.estado}
              onChange={(e) => setForm({ ...form, estado: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg text-sm mt-0.5"
            >
              {ESTADOS.map((e) => (
                <option key={e} value={e}>{ESTADO_LABELS[e]}</option>
              ))}
            </select>
            <p className="text-xs text-slate-400 mt-1">
              Usa &quot;Cancelado&quot; para anular. Cambia a &quot;Pendiente&quot; para reabrir.
            </p>
          </div>

          <TecnicoMultiSelect
            label="Técnicos asignados"
            tecnicos={tecnicos}
            selected={form.tecnicoIds}
            onChange={(tecnicoIds) => setForm({ ...form, tecnicoIds })}
          />

          <div>
            <label className="text-xs text-slate-500">Fecha y hora programada</label>
            <input
              type="datetime-local"
              value={form.programadoEn}
              onChange={(e) => setForm({ ...form, programadoEn: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg text-sm mt-0.5"
            />
          </div>

          <div>
            <label className="text-xs text-slate-500">Motivo</label>
            <input
              type="text"
              value={form.motivo}
              onChange={(e) => setForm({ ...form, motivo: enMayusculas(e.target.value) })}
              className={`w-full px-3 py-2 border rounded-lg text-sm mt-0.5 ${inputMayusculasClass}`}
            />
          </div>

          <div>
            <label className="text-xs text-slate-500">Descripción</label>
            <textarea
              rows={3}
              value={form.descripcion}
              onChange={(e) =>
                setForm({ ...form, descripcion: enMayusculas(e.target.value) })
              }
              className={`w-full px-3 py-2 border rounded-lg text-sm mt-0.5 resize-none ${inputMayusculasClass}`}
            />
          </div>

          <button
            type="submit"
            disabled={guardando}
            className="w-full py-3 bg-infinity-600 hover:bg-infinity-700 text-white font-semibold rounded-xl disabled:opacity-50"
          >
            {guardando ? "Guardando..." : "Guardar cambios"}
          </button>
        </form>
      </main>
    </div>
  );
}
