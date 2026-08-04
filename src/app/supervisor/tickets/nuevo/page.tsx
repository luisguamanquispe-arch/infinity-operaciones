"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CheckCircle } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { TIPO_LABELS } from "@/lib/utils";
import { TecnicoMultiSelect } from "@/components/TecnicoMultiSelect";
import { ClientePicker, type ClienteResumen } from "@/components/ClientePicker";
import { inputMayusculasClass } from "@/lib/mayusculas";
import {
  MODALIDAD_SOPORTE_LABELS,
  TRABAJO_EXPRESS_LABELS,
  TRABAJOS_EXPRESS,
} from "@/lib/soporte-express";
import type { ModalidadSoporte, TrabajoExpress } from "@prisma/client";

interface Tecnico {
  id: string;
  nombre: string;
  estado: string;
}

const TIPOS = ["SOPORTE", "INSTALACION", "RECONEXION", "CORTE", "MIGRACION", "RETIRO"] as const;

export default function NuevoTicketPage() {
  const router = useRouter();
  const [tecnicos, setTecnicos] = useState<Tecnico[]>([]);
  const [cliente, setCliente] = useState<ClienteResumen | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [exito, setExito] = useState("");

  const [ticket, setTicket] = useState({
    tipo: "SOPORTE",
    prioridad: "MEDIA",
    motivo: "",
    descripcion: "",
    tecnicoIds: [] as string[],
    programadoEn: "",
    modalidadSoporte: "COMPLETO" as ModalidadSoporte,
    trabajoExpress: "" as TrabajoExpress | "",
    trabajoExpressOtro: "",
  });

  const esSoporte = ticket.tipo === "SOPORTE";
  const esExpress = esSoporte && ticket.modalidadSoporte === "EXPRESS";

  useEffect(() => {
    fetch("/api/tecnicos")
      .then((r) => r.json())
      .then((d) => setTecnicos(d.tecnicos));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!cliente) {
      setError("Debe seleccionar un cliente del CRM antes de crear el ticket");
      return;
    }
    if (esExpress && !ticket.trabajoExpress) {
      setError("Seleccione el trabajo Express a realizar");
      return;
    }
    if (
      esExpress &&
      ticket.trabajoExpress === "OTRO" &&
      ticket.trabajoExpressOtro.trim().length < 3
    ) {
      setError("Indique el detalle del trabajo (Otro)");
      return;
    }
    setLoading(true);
    setError("");
    setExito("");

    const res = await fetch("/api/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clienteId: cliente.id,
        tipo: ticket.tipo,
        prioridad: ticket.prioridad,
        motivo: ticket.motivo,
        descripcion: ticket.descripcion,
        tecnicoIds: ticket.tecnicoIds,
        programadoEn: ticket.programadoEn || null,
        modalidadSoporte: esSoporte ? ticket.modalidadSoporte : "COMPLETO",
        ...(esExpress
          ? {
              trabajoExpress: ticket.trabajoExpress,
              trabajoExpressOtro:
                ticket.trabajoExpress === "OTRO" ? ticket.trabajoExpressOtro : null,
            }
          : {}),
      }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error || "Error al crear ticket");
      return;
    }

    setExito(`Ticket ${data.ticket.codigo} creado y asignado correctamente`);
    setTimeout(() => router.push("/supervisor"), 2000);
  }

  return (
    <div className="min-h-dvh bg-slate-50">
      <AppHeader title="Nuevo ticket" subtitle="Recepción de soporte — Infinity Internet" />

      <main className="max-w-2xl mx-auto p-4 space-y-4">
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

        <form onSubmit={handleSubmit} className="space-y-4">
          <section className="bg-white rounded-xl border p-4 space-y-3">
            <h2 className="font-semibold">1. Seleccionar cliente</h2>
            <p className="text-xs text-slate-500">
              El cliente se gestiona por separado en{" "}
              <Link href="/supervisor/clientes" className="text-infinity-600 hover:underline">
                Clientes CRM
              </Link>
              . Aquí solo elige uno existente.
            </p>
            <ClientePicker value={cliente} onChange={setCliente} />
          </section>

          <section className="bg-white rounded-xl border p-4 space-y-3">
            <h2 className="font-semibold">2. Ticket de soporte</h2>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-500">Tipo de trabajo *</label>
                <select
                  value={ticket.tipo}
                  onChange={(e) => {
                    const tipo = e.target.value;
                    setTicket({
                      ...ticket,
                      tipo,
                      modalidadSoporte:
                        tipo === "SOPORTE" ? ticket.modalidadSoporte : "COMPLETO",
                    });
                  }}
                  className="w-full px-3 py-2 border rounded-lg text-sm mt-0.5"
                  required
                >
                  {TIPOS.map((t) => (
                    <option key={t} value={t}>
                      {TIPO_LABELS[t]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-500">Prioridad *</label>
                <select
                  value={ticket.prioridad}
                  onChange={(e) => setTicket({ ...ticket, prioridad: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm mt-0.5"
                  required
                >
                  <option value="ALTA">Alta (SLA 4h)</option>
                  <option value="MEDIA">Media (SLA 8h)</option>
                  <option value="BAJA">Baja (SLA 24h)</option>
                </select>
              </div>
            </div>

            {esSoporte && (
              <div className="space-y-2">
                <label className="text-xs text-slate-500">Modalidad de soporte *</label>
                <div className="grid grid-cols-2 gap-2">
                  {(["COMPLETO", "EXPRESS"] as ModalidadSoporte[]).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() =>
                        setTicket({
                          ...ticket,
                          modalidadSoporte: m,
                          trabajoExpress: m === "EXPRESS" ? ticket.trabajoExpress : "",
                          trabajoExpressOtro: m === "EXPRESS" ? ticket.trabajoExpressOtro : "",
                        })
                      }
                      className={`px-3 py-2.5 rounded-lg border text-sm font-medium transition ${
                        ticket.modalidadSoporte === m
                          ? m === "EXPRESS"
                            ? "border-amber-500 bg-amber-50 text-amber-900"
                            : "border-infinity-600 bg-infinity-50 text-infinity-800"
                          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                      }`}
                    >
                      {MODALIDAD_SOPORTE_LABELS[m]}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-slate-500">
                  {esExpress
                    ? "El técnico verá un formulario simplificado para trabajos rápidos."
                    : "El técnico completará el formulario técnico completo (diagnóstico, potencias, evidencias)."}
                </p>
              </div>
            )}

            {esExpress && (
              <div className="space-y-2">
                <div>
                  <label className="text-xs text-slate-500">Trabajo Express *</label>
                  <select
                    value={ticket.trabajoExpress}
                    onChange={(e) =>
                      setTicket({
                        ...ticket,
                        trabajoExpress: e.target.value as TrabajoExpress | "",
                      })
                    }
                    className="w-full px-3 py-2 border rounded-lg text-sm mt-0.5"
                    required
                  >
                    <option value="">Seleccionar trabajo…</option>
                    {TRABAJOS_EXPRESS.map((t) => (
                      <option key={t} value={t}>
                        {TRABAJO_EXPRESS_LABELS[t]}
                      </option>
                    ))}
                  </select>
                </div>
                {ticket.trabajoExpress === "OTRO" && (
                  <div>
                    <label className="text-xs text-slate-500">Detalle del trabajo *</label>
                    <input
                      type="text"
                      required
                      placeholder="Describa el trabajo Express"
                      value={ticket.trabajoExpressOtro}
                      onChange={(e) =>
                        setTicket({ ...ticket, trabajoExpressOtro: e.target.value })
                      }
                      className={`w-full px-3 py-2 border rounded-lg text-sm mt-0.5 ${inputMayusculasClass}`}
                    />
                  </div>
                )}
              </div>
            )}

            <div>
              <label className="text-xs text-slate-500">Motivo *</label>
              <input
                type="text"
                required
                placeholder="Ej: Sin servicio, luz roja en ONU"
                value={ticket.motivo}
                onChange={(e) => setTicket({ ...ticket, motivo: e.target.value })}
                className={`w-full px-3 py-2 border rounded-lg text-sm mt-0.5 ${inputMayusculasClass}`}
              />
            </div>

            <div>
              <label className="text-xs text-slate-500">Descripción del problema</label>
              <textarea
                rows={3}
                placeholder="Detalle reportado por el cliente..."
                value={ticket.descripcion}
                onChange={(e) => setTicket({ ...ticket, descripcion: e.target.value })}
                className={`w-full px-3 py-2 border rounded-lg text-sm mt-0.5 resize-none ${inputMayusculasClass}`}
              />
            </div>
          </section>

          <section className="bg-white rounded-xl border p-4 space-y-3">
            <h2 className="font-semibold">3. Programar y asignar</h2>

            <div>
              <label className="text-xs text-slate-500">Fecha y hora de visita</label>
              <input
                type="datetime-local"
                value={ticket.programadoEn}
                onChange={(e) => setTicket({ ...ticket, programadoEn: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm mt-0.5"
              />
            </div>

            <TecnicoMultiSelect
              label="Técnicos asignados (puede seleccionar más de uno)"
              tecnicos={tecnicos}
              selected={ticket.tecnicoIds}
              onChange={(tecnicoIds) => setTicket({ ...ticket, tecnicoIds })}
            />
          </section>

          <button
            type="submit"
            disabled={loading || !cliente}
            className="w-full py-3 bg-infinity-600 hover:bg-infinity-700 text-white font-semibold rounded-xl disabled:opacity-50 transition"
          >
            {loading ? "Creando ticket..." : "Crear ticket de soporte"}
          </button>
        </form>
      </main>
    </div>
  );
}
