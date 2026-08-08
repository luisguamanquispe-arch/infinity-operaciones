"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, CheckCircle, Search } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { TIPO_LABELS, ESTADO_LABELS } from "@/lib/utils";
import { toDatetimeLocalValue } from "@/lib/calendario";
import { TecnicoMultiSelect } from "@/components/TecnicoMultiSelect";
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

interface ClienteBusqueda {
  id: string;
  cedula: string;
  nombre: string;
  telefono: string;
  sector: string;
}

const TIPOS = ["SOPORTE", "INFRAESTRUCTURA", "INSTALACION", "RECONEXION", "CORTE", "MIGRACION", "RETIRO"];
const ESTADOS = ["PENDIENTE", "LEIDO", "EN_PROCESO", "FINALIZADO", "CERRADO", "CANCELADO"];

export default function EditarTicketPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [tecnicos, setTecnicos] = useState<Tecnico[]>([]);
  const [codigo, setCodigo] = useState("");
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [exito, setExito] = useState("");
  const [editable, setEditable] = useState(true);

  const clienteInicial = useRef({ id: "", nombre: "" });

  const [clienteId, setClienteId] = useState("");
  const [clienteNombre, setClienteNombre] = useState("");
  const [clienteCedula, setClienteCedula] = useState("");
  const [clienteTelefono, setClienteTelefono] = useState("");
  const [clienteSector, setClienteSector] = useState("");
  const [busquedaCliente, setBusquedaCliente] = useState("");
  const [resultadosCliente, setResultadosCliente] = useState<ClienteBusqueda[]>([]);
  const [buscandoCliente, setBuscandoCliente] = useState(false);

  const [form, setForm] = useState({
    tipo: "SOPORTE",
    prioridad: "MEDIA",
    estado: "PENDIENTE",
    motivo: "",
    descripcion: "",
    tecnicoIds: [] as string[],
    programadoEn: "",
    modalidadSoporte: "COMPLETO" as ModalidadSoporte,
    trabajoExpress: "" as TrabajoExpress | "",
    trabajoExpressOtro: "",
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
      setEditable(t.editable !== false);
      clienteInicial.current = { id: t.cliente.id, nombre: t.cliente.nombre };
      setClienteId(t.cliente.id);
      setClienteNombre(t.cliente.nombre);
      setClienteCedula(t.cliente.cedula);
      setClienteTelefono(t.cliente.telefono);
      setClienteSector(t.cliente.sector);
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
        modalidadSoporte: t.modalidadSoporte === "EXPRESS" ? "EXPRESS" : "COMPLETO",
        trabajoExpress: (t.trabajoExpress as TrabajoExpress | null) || "",
        trabajoExpressOtro: t.trabajoExpressOtro || "",
      });
      setTecnicos(tecData.tecnicos);
      setLoading(false);
    });
  }, [id]);

  async function buscarClientes(q: string) {
    setBusquedaCliente(q);
    if (q.length < 2) {
      setResultadosCliente([]);
      return;
    }
    setBuscandoCliente(true);
    try {
      const res = await fetch(`/api/clientes?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setResultadosCliente(data.clientes ?? []);
    } catch {
      setResultadosCliente([]);
    } finally {
      setBuscandoCliente(false);
    }
  }

  function seleccionarCliente(c: ClienteBusqueda) {
    setClienteId(c.id);
    setClienteNombre(c.nombre);
    setClienteCedula(c.cedula);
    setClienteTelefono(c.telefono);
    setClienteSector(c.sector);
    setResultadosCliente([]);
    setBusquedaCliente("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editable) return;

    const esSoporteSubmit = form.tipo === "SOPORTE";
    const esExpressSubmit = esSoporteSubmit && form.modalidadSoporte === "EXPRESS";
    if (esExpressSubmit && !form.trabajoExpress) {
      setError("Seleccione el trabajo Express a realizar");
      return;
    }
    if (
      esExpressSubmit &&
      form.trabajoExpress === "OTRO" &&
      form.trabajoExpressOtro.trim().length < 3
    ) {
      setError("Indique el detalle del trabajo (Otro)");
      return;
    }

    setGuardando(true);
    setError("");
    setExito("");

    const payload: Record<string, unknown> = {
      tipo: form.tipo,
      prioridad: form.prioridad,
      estado: form.estado,
      motivo: form.motivo,
      descripcion: form.descripcion,
      tecnicoIds: form.tecnicoIds,
      programadoEn: form.programadoEn || null,
      modalidadSoporte: esSoporteSubmit ? form.modalidadSoporte : "COMPLETO",
      trabajoExpress: esExpressSubmit ? form.trabajoExpress : null,
      trabajoExpressOtro:
        esExpressSubmit && form.trabajoExpress === "OTRO"
          ? form.trabajoExpressOtro
          : null,
    };

    const tieneClienteEditableSubmit = form.tipo !== "INFRAESTRUCTURA";

    if (tieneClienteEditableSubmit) {
      if (!clienteNombre.trim()) {
        setError("El nombre del cliente es obligatorio");
        setGuardando(false);
        return;
      }
      if (form.tipo === "SOPORTE" && clienteId !== clienteInicial.current.id) {
        payload.clienteId = clienteId;
      }
      if (clienteNombre.trim() !== clienteInicial.current.nombre) {
        payload.clienteNombre = clienteNombre.trim();
      }
    }

    const res = await fetch(`/api/tickets/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
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

  const esSoporte = form.tipo === "SOPORTE";
  const esExpress = esSoporte && form.modalidadSoporte === "EXPRESS";
  const tieneClienteEditable = form.tipo !== "INFRAESTRUCTURA";

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

        {!editable && (
          <div className="bg-amber-50 text-amber-900 border border-amber-200 p-3 rounded-xl text-sm">
            La orden de servicio está cerrada. Este ticket no se puede modificar.
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-white rounded-xl border p-4 space-y-4">
          <fieldset disabled={!editable} className="space-y-4 disabled:opacity-60">
          {tieneClienteEditable && (
            <section className="space-y-3 pb-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-900">Cliente</h2>
              <p className="text-xs text-slate-500">
                {esSoporte
                  ? "Puede corregir el nombre o buscar otro cliente para reasignar el ticket."
                  : "Puede corregir el nombre del cliente asociado al ticket."}
              </p>

              {esSoporte && (
              <div className="relative">
                <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar otro cliente (cédula, nombre, teléfono)…"
                  value={busquedaCliente}
                  onChange={(e) => void buscarClientes(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border rounded-xl text-sm"
                />
                {buscandoCliente && (
                  <Loader2 className="absolute right-3 top-3 w-4 h-4 animate-spin text-slate-400" />
                )}
                {resultadosCliente.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border rounded-xl shadow-lg max-h-48 overflow-y-auto">
                    {resultadosCliente.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => seleccionarCliente(c)}
                        className="w-full text-left px-4 py-2 hover:bg-slate-50 text-sm border-b last:border-0"
                      >
                        <span className="font-medium">{c.nombre}</span>
                        <span className="text-slate-500 ml-2">{c.cedula}</span>
                        <span className="text-slate-400 block text-xs">{c.sector}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              )}

              <div className="grid grid-cols-2 gap-2 text-xs text-slate-500 bg-slate-50 rounded-lg p-3">
                <p>
                  <span className="text-slate-400">Cédula:</span> {clienteCedula}
                </p>
                <p>
                  <span className="text-slate-400">Teléfono:</span> {clienteTelefono}
                </p>
                <p className="col-span-2">
                  <span className="text-slate-400">Sector:</span> {clienteSector}
                </p>
              </div>

              <div>
                <label className="text-xs text-slate-500">Nombre del cliente</label>
                <input
                  type="text"
                  required
                  value={clienteNombre}
                  onChange={(e) => setClienteNombre(e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg text-sm mt-0.5 ${inputMayusculasClass}`}
                />
              </div>

              {esSoporte && clienteId !== clienteInicial.current.id && (
                <p className="text-xs text-infinity-700 bg-infinity-50 border border-infinity-200 rounded-lg px-3 py-2">
                  El ticket se reasignará al cliente seleccionado al guardar.
                </p>
              )}
            </section>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500">Tipo de trabajo</label>
              <select
                value={form.tipo}
                onChange={(e) => {
                  const tipo = e.target.value;
                  setForm({
                    ...form,
                    tipo,
                    modalidadSoporte:
                      tipo === "SOPORTE" ? form.modalidadSoporte : "COMPLETO",
                    trabajoExpress: tipo === "SOPORTE" ? form.trabajoExpress : "",
                    trabajoExpressOtro: tipo === "SOPORTE" ? form.trabajoExpressOtro : "",
                  });
                }}
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

          {esSoporte && (
            <div className="space-y-2">
              <label className="text-xs text-slate-500">Modalidad de soporte *</label>
              <div className="grid grid-cols-2 gap-2">
                {(["COMPLETO", "EXPRESS"] as ModalidadSoporte[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() =>
                      setForm({
                        ...form,
                        modalidadSoporte: m,
                        trabajoExpress: m === "EXPRESS" ? form.trabajoExpress : "",
                        trabajoExpressOtro: m === "EXPRESS" ? form.trabajoExpressOtro : "",
                      })
                    }
                    className={`px-3 py-2.5 rounded-lg border text-sm font-medium transition ${
                      form.modalidadSoporte === m
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
                  ? "Al guardar, el técnico verá el formulario Express simplificado."
                  : "El técnico completará el formulario técnico completo."}
              </p>
            </div>
          )}

          {esExpress && (
            <div className="space-y-2">
              <div>
                <label className="text-xs text-slate-500">Trabajo Express *</label>
                <select
                  value={form.trabajoExpress}
                  onChange={(e) =>
                    setForm({
                      ...form,
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
              {form.trabajoExpress === "OTRO" && (
                <div>
                  <label className="text-xs text-slate-500">Detalle del trabajo *</label>
                  <input
                    type="text"
                    required
                    placeholder="Describa el trabajo Express"
                    value={form.trabajoExpressOtro}
                    onChange={(e) =>
                      setForm({ ...form, trabajoExpressOtro: e.target.value })
                    }
                    className={`w-full px-3 py-2 border rounded-lg text-sm mt-0.5 ${inputMayusculasClass}`}
                  />
                </div>
              )}
            </div>
          )}

          <div>
            <label className="text-xs text-slate-500">Estado</label>
            <select
              value={form.estado}
              onChange={(e) => setForm({ ...form, estado: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg text-sm mt-0.5"
            >
              {ESTADOS.map((est) => (
                <option key={est} value={est}>{ESTADO_LABELS[est]}</option>
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
              onChange={(e) => setForm({ ...form, motivo: e.target.value })}
              className={`w-full px-3 py-2 border rounded-lg text-sm mt-0.5 ${inputMayusculasClass}`}
            />
          </div>

          <div>
            <label className="text-xs text-slate-500">Descripción</label>
            <textarea
              rows={3}
              value={form.descripcion}
              onChange={(e) =>
                setForm({ ...form, descripcion: e.target.value })
              }
              className={`w-full px-3 py-2 border rounded-lg text-sm mt-0.5 resize-none ${inputMayusculasClass}`}
            />
          </div>

          <button
            type="submit"
            disabled={guardando || !editable}
            className="w-full py-3 bg-infinity-600 hover:bg-infinity-700 text-white font-semibold rounded-xl disabled:opacity-50"
          >
            {guardando ? "Guardando..." : "Guardar cambios"}
          </button>
          </fieldset>
        </form>
      </main>
    </div>
  );
}
