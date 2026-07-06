"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CheckCircle } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { ClienteForm, clienteFormVacio, formToPayload } from "@/components/ClienteForm";
import { mensajeCedulaInvalida, normalizarCedula, validarCedulaEcuatoriana } from "@/lib/cedula-ec";

export default function NuevoClientePageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextUrl = searchParams.get("next") || "/supervisor/clientes";
  const [form, setForm] = useState(clienteFormVacio());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [exito, setExito] = useState("");
  const [cedulaError, setCedulaError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setCedulaError("");
    const cedulaNorm = normalizarCedula(form.cedula);
    if (!validarCedulaEcuatoriana(cedulaNorm)) {
      setCedulaError(mensajeCedulaInvalida());
      return;
    }
    setLoading(true);
    const res = await fetch("/api/clientes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...formToPayload(form), cedula: cedulaNorm }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "Error al crear cliente");
      return;
    }
    setExito("Cliente creado correctamente");
    setTimeout(
      () =>
        router.push(
          nextUrl.includes("tickets/nuevo") ? nextUrl : `/supervisor/clientes/${data.cliente.id}`
        ),
      1200
    );
  }

  return (
    <div className="min-h-dvh bg-slate-50">
      <AppHeader title="Nuevo cliente" subtitle="Registro en CRM (sin ticket)" />

      <main className="max-w-2xl mx-auto p-4 space-y-4">
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
            disabled={loading}
            className="w-full py-3 bg-infinity-600 hover:bg-infinity-700 text-white font-semibold rounded-xl disabled:opacity-50"
          >
            {loading ? "Guardando..." : "Crear cliente"}
          </button>
        </form>
      </main>
    </div>
  );
}
