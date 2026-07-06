"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CheckCircle, Clock, Loader2 } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { ClienteForm, clienteToForm, formToPayload } from "@/components/ClienteForm";
import { CAMPOS_CLIENTE_LABELS } from "@/lib/cliente-crud";
import { mensajeCedulaInvalida, normalizarCedula, validarCedulaEcuatoriana } from "@/lib/cedula-ec";

type HistorialItem = {
  id: string;
  accion: string;
  createdAt: string;
  usuario: { nombre: string; email: string } | null;
  cambios: { campo: string; anterior: string | null; nuevo: string | null }[];
};

export default function EditarClientePage() {
  const params = useParams();
  const id = params.id as string;
  const [form, setForm] = useState(clienteToForm({
    cedula: "", nombre: "", telefono: "", plan: "", direccion: "", sector: "",
    referencia: null, nodo: null, activo: true,
  }));
  const [historial, setHistorial] = useState<HistorialItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [exito, setExito] = useState("");
  const [cedulaError, setCedulaError] = useState("");

  async function cargar() {
    const [resCliente, resHist] = await Promise.all([
      fetch(`/api/clientes/${id}`),
      fetch(`/api/clientes/${id}/historial`),
    ]);
    const dataCliente = await resCliente.json();
    const dataHist = await resHist.json();
    if (resCliente.ok && dataCliente.cliente) {
      setForm(clienteToForm(dataCliente.cliente));
    }
    if (resHist.ok) setHistorial(dataHist.historial || []);
    setLoading(false);
  }

  useEffect(() => {
    cargar();
  }, [id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setCedulaError("");
    const cedulaNorm = normalizarCedula(form.cedula);
    if (!validarCedulaEcuatoriana(cedulaNorm)) {
      setCedulaError(mensajeCedulaInvalida());
      return;
    }
    setGuardando(true);
    const res = await fetch(`/api/clientes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...formToPayload(form), cedula: cedulaNorm }),
    });
    const data = await res.json();
    setGuardando(false);
    if (!res.ok) {
      setError(data.error || "Error al guardar");
      return;
    }
    setExito("Cambios guardados en el historial");
    setForm(clienteToForm(data.cliente));
    const resHist = await fetch(`/api/clientes/${id}/historial`);
    const dataHist = await resHist.json();
    if (resHist.ok) setHistorial(dataHist.historial || []);
    setTimeout(() => setExito(""), 3000);
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
      <AppHeader title="Editar cliente" subtitle="Todos los campos — con historial de cambios" />

      <main className="max-w-3xl mx-auto p-4 space-y-4">
        <Link href="/supervisor/clientes" className="inline-flex items-center gap-1 text-sm text-infinity-600 hover:underline">
          <ArrowLeft className="w-4 h-4" /> Volver a clientes
        </Link>

        {error && <div className="bg-red-50 text-red-700 p-3 rounded-xl text-sm">{error}</div>}
        {exito && (
          <div className="bg-emerald-50 text-emerald-700 p-3 rounded-xl text-sm flex items-center gap-2">
            <CheckCircle className="w-4 h-4" /> {exito}
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-white rounded-xl border p-4 space-y-4">
          <ClienteForm form={form} onChange={setForm} cedulaError={cedulaError} />
          <button
            type="submit"
            disabled={guardando}
            className="w-full py-3 bg-infinity-600 hover:bg-infinity-700 text-white font-semibold rounded-xl disabled:opacity-50"
          >
            {guardando ? "Guardando..." : "Guardar cambios"}
          </button>
        </form>

        <section className="bg-white rounded-xl border p-4">
          <h2 className="font-semibold flex items-center gap-2 mb-4">
            <Clock className="w-4 h-4" /> Historial de modificaciones
          </h2>
          {historial.length === 0 ? (
            <p className="text-sm text-slate-500">Sin cambios registrados aún.</p>
          ) : (
            <div className="space-y-4">
              {historial.map((h) => (
                <div key={h.id} className="border-b last:border-0 pb-4 last:pb-0">
                  <div className="flex flex-wrap justify-between gap-2 text-xs text-slate-500 mb-2">
                    <span className="font-medium text-slate-700">{h.accion}</span>
                    <span>{new Date(h.createdAt).toLocaleString("es-EC")}</span>
                  </div>
                  {h.usuario && (
                    <p className="text-xs text-slate-400 mb-2">Por: {h.usuario.nombre}</p>
                  )}
                  <ul className="space-y-1 text-sm">
                    {h.cambios.map((c, i) => (
                      <li key={i} className="bg-slate-50 rounded-lg px-3 py-2">
                        <span className="font-medium">{CAMPOS_CLIENTE_LABELS[c.campo] || c.campo}:</span>{" "}
                        <span className="text-red-600 line-through">{c.anterior ?? "—"}</span>
                        {" → "}
                        <span className="text-emerald-700">{c.nuevo ?? "—"}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
