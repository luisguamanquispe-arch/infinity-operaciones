"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { inputMayusculasClass } from "@/lib/mayusculas";
import {
  SR_ESTADOS,
  SR_ESTADO_LABELS,
  SR_RESULTADOS,
  SR_RESULTADO_LABELS,
  SR_TIPOS_SOPORTE,
  SR_TIPO_SOPORTE_LABELS,
} from "@/lib/soporte-remoto/labels";

type Operador = { id: string; nombre: string; rol: string };
type ClienteHit = { id: string; nombre: string; cedula: string; telefono: string };

export default function NuevoSrTicketPage() {
  const router = useRouter();
  const [operadores, setOperadores] = useState<Operador[]>([]);
  const [clientes, setClientes] = useState<ClienteHit[]>([]);
  const [busquedaCliente, setBusquedaCliente] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [rol, setRol] = useState("");

  const [form, setForm] = useState({
    fecha: new Date().toISOString().slice(0, 10),
    horaInicio: new Date().toTimeString().slice(0, 5),
    horaFin: "",
    operadorId: "",
    clienteId: "",
    clienteNombre: "",
    clienteCodigo: "",
    telefono: "",
    estado: "EN_PROCESO",
    tipoSoporte: "ASESORIA_TELEFONICA",
    tipoSoporteOtro: "",
    descripcionProblema: "",
    solucionAplicada: "",
    resultado: "",
    observaciones: "",
  });

  useEffect(() => {
    void fetch("/api/soporte-remoto/catalogo")
      .then((r) => r.json())
      .then((d) => {
        setOperadores(d.operadores || []);
        setRol(d.session?.rol || "");
        if (d.session?.id) {
          setForm((f) => ({ ...f, operadorId: d.session.id }));
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (busquedaCliente.trim().length < 2) {
      setClientes([]);
      return;
    }
    const t = window.setTimeout(() => {
      void fetch(
        `/api/soporte-remoto/catalogo?q=${encodeURIComponent(busquedaCliente.trim())}`
      )
        .then((r) => r.json())
        .then((d) => setClientes(d.clientes || []))
        .catch(() => setClientes([]));
    }, 300);
    return () => window.clearTimeout(t);
  }, [busquedaCliente]);

  function setField(key: string, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function elegirCliente(c: ClienteHit) {
    setForm((f) => ({
      ...f,
      clienteId: c.id,
      clienteNombre: c.nombre,
      clienteCodigo: c.cedula,
      telefono: c.telefono,
    }));
    setBusquedaCliente("");
    setClientes([]);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const body = {
        ...form,
        fecha: form.fecha ? new Date(form.fecha + "T12:00:00").toISOString() : undefined,
        horaInicio: form.horaInicio
          ? new Date(`${form.fecha}T${form.horaInicio}:00`).toISOString()
          : null,
        horaFin: form.horaFin
          ? new Date(`${form.fecha}T${form.horaFin}:00`).toISOString()
          : null,
        resultado: form.resultado || null,
        clienteId: form.clienteId || null,
        operadorId: form.operadorId || undefined,
      };
      const res = await fetch("/api/soporte-remoto/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo crear");
      router.push(`/soporte-remoto/${data.ticket.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
      setSaving(false);
    }
  }

  const puedeElegirOperador = rol === "ADMIN" || rol === "SUPERVISOR";

  return (
    <div className="min-h-dvh bg-slate-50">
      <AppHeader title="Nuevo soporte remoto" subtitle="Registro de atención desde oficina" />
      <main className="max-w-3xl mx-auto p-4 space-y-4">
        <Link
          href="/soporte-remoto"
          className="inline-flex items-center gap-1 text-sm text-teal-700 hover:underline"
        >
          <ArrowLeft className="w-4 h-4" /> Listado
        </Link>

        {error && (
          <div className="bg-red-50 text-red-700 text-sm p-3 rounded-xl border border-red-200">
            {error}
          </div>
        )}

        <form onSubmit={submit} className="bg-white rounded-xl border p-4 space-y-4">
          <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className="text-sm space-y-1">
              <span className="text-slate-600">Fecha</span>
              <input
                type="date"
                required
                value={form.fecha}
                onChange={(e) => setField("fecha", e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
              />
            </label>
            <label className="text-sm space-y-1">
              <span className="text-slate-600">Hora inicio</span>
              <input
                type="time"
                value={form.horaInicio}
                onChange={(e) => setField("horaInicio", e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
              />
            </label>
            <label className="text-sm space-y-1">
              <span className="text-slate-600">Hora fin</span>
              <input
                type="time"
                value={form.horaFin}
                onChange={(e) => setField("horaFin", e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
              />
            </label>
          </section>

          {puedeElegirOperador && (
            <label className="block text-sm space-y-1">
              <span className="text-slate-600">Operador responsable</span>
              <select
                value={form.operadorId}
                onChange={(e) => setField("operadorId", e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
              >
                {operadores.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.nombre} ({o.rol})
                  </option>
                ))}
              </select>
            </label>
          )}

          <section className="space-y-2 border-t pt-4">
            <p className="font-medium text-sm">Cliente</p>
            <input
              value={busquedaCliente}
              onChange={(e) => setBusquedaCliente(e.target.value)}
              placeholder="Buscar en CRM (nombre, cédula, teléfono)…"
              className="w-full px-3 py-2 border rounded-lg text-sm"
            />
            {clientes.length > 0 && (
              <ul className="border rounded-lg divide-y max-h-40 overflow-auto text-sm">
                {clientes.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => elegirCliente(c)}
                      className="w-full text-left px-3 py-2 hover:bg-slate-50"
                    >
                      <span className="font-medium">{c.nombre}</span>
                      <span className="text-slate-500"> · {c.cedula} · {c.telefono}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <label className="text-sm space-y-1 sm:col-span-2">
                <span className="text-slate-600">Nombre</span>
                <input
                  required
                  value={form.clienteNombre}
                  onChange={(e) => setField("clienteNombre", e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg ${inputMayusculasClass}`}
                />
              </label>
              <label className="text-sm space-y-1">
                <span className="text-slate-600">Código / cédula</span>
                <input
                  required
                  value={form.clienteCodigo}
                  onChange={(e) => setField("clienteCodigo", e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </label>
              <label className="text-sm space-y-1 sm:col-span-3">
                <span className="text-slate-600">Teléfono</span>
                <input
                  required
                  value={form.telefono}
                  onChange={(e) => setField("telefono", e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </label>
            </div>
          </section>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="text-sm space-y-1">
              <span className="text-slate-600">Estado</span>
              <select
                value={form.estado}
                onChange={(e) => setField("estado", e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
              >
                {SR_ESTADOS.map((e) => (
                  <option key={e} value={e}>
                    {SR_ESTADO_LABELS[e]}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm space-y-1">
              <span className="text-slate-600">Tipo de soporte</span>
              <select
                value={form.tipoSoporte}
                onChange={(e) => setField("tipoSoporte", e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
              >
                {SR_TIPOS_SOPORTE.map((t) => (
                  <option key={t} value={t}>
                    {SR_TIPO_SOPORTE_LABELS[t]}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {form.tipoSoporte === "OTRO" && (
            <label className="block text-sm space-y-1">
              <span className="text-slate-600">Especifique otro</span>
              <input
                value={form.tipoSoporteOtro}
                onChange={(e) => setField("tipoSoporteOtro", e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg ${inputMayusculasClass}`}
              />
            </label>
          )}

          <label className="block text-sm space-y-1">
            <span className="text-slate-600">Descripción del problema</span>
            <textarea
              required
              rows={3}
              value={form.descripcionProblema}
              onChange={(e) => setField("descripcionProblema", e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
            />
          </label>

          <label className="block text-sm space-y-1">
            <span className="text-slate-600">Solución aplicada</span>
            <textarea
              rows={3}
              value={form.solucionAplicada}
              onChange={(e) => setField("solucionAplicada", e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
            />
          </label>

          <label className="block text-sm space-y-1">
            <span className="text-slate-600">Resultado</span>
            <select
              value={form.resultado}
              onChange={(e) => setField("resultado", e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
            >
              <option value="">— Sin definir —</option>
              {SR_RESULTADOS.map((r) => (
                <option key={r} value={r}>
                  {SR_RESULTADO_LABELS[r]}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm space-y-1">
            <span className="text-slate-600">Observaciones</span>
            <textarea
              rows={2}
              value={form.observaciones}
              onChange={(e) => setField("observaciones", e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
            />
          </label>

          <button
            type="submit"
            disabled={saving}
            className="w-full py-3 bg-teal-700 hover:bg-teal-800 text-white font-semibold rounded-xl disabled:opacity-50 inline-flex items-center justify-center gap-2"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {saving ? "Guardando…" : "Crear ticket"}
          </button>
        </form>
      </main>
    </div>
  );
}
