"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Plus, Search, Users } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";

type Cliente = {
  id: string;
  cedula: string;
  nombre: string;
  telefono: string;
  sector: string;
  plan: string;
  activo: boolean;
};

export default function ClientesListPage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [incluirInactivos, setIncluirInactivos] = useState(false);

  async function cargar(query = q) {
    setLoading(true);
    const params = new URLSearchParams({ take: "50" });
    if (query.trim()) params.set("q", query.trim());
    if (incluirInactivos) params.set("incluirInactivos", "1");
    const res = await fetch(`/api/clientes?${params}`);
    const data = await res.json();
    setClientes(data.clientes || []);
    setLoading(false);
  }

  useEffect(() => {
    cargar();
  }, [incluirInactivos]);

  return (
    <div className="min-h-dvh bg-slate-50">
      <AppHeader title="Clientes" subtitle="CRM — gestión independiente de tickets" />

      <main className="max-w-4xl mx-auto p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/supervisor" className="inline-flex items-center gap-1 text-sm text-infinity-600 hover:underline">
            <ArrowLeft className="w-4 h-4" /> Panel supervisor
          </Link>
          <Link
            href="/supervisor/clientes/nuevo"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-infinity-600 text-white text-sm font-medium"
          >
            <Plus className="w-4 h-4" /> Nuevo cliente
          </Link>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            cargar();
          }}
          className="flex gap-2"
        >
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por cédula, nombre, teléfono..."
              className="w-full pl-10 pr-4 py-2.5 border rounded-xl text-sm"
            />
          </div>
          <button type="submit" className="px-4 py-2 rounded-xl bg-slate-800 text-white text-sm">
            Buscar
          </button>
        </form>

        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={incluirInactivos}
            onChange={(e) => setIncluirInactivos(e.target.checked)}
          />
          Incluir clientes inactivos
        </label>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-infinity-600" />
          </div>
        ) : clientes.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <Users className="w-10 h-10 mx-auto mb-2 opacity-40" />
            <p>No hay clientes que coincidan.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {clientes.map((c) => (
              <Link
                key={c.id}
                href={`/supervisor/clientes/${c.id}`}
                className="block bg-white rounded-xl border p-4 hover:border-infinity-400 transition"
              >
                <div className="flex justify-between gap-2">
                  <div>
                    <p className="font-semibold">{c.nombre}</p>
                    <p className="text-sm text-slate-500">{c.cedula} · {c.telefono}</p>
                    <p className="text-xs text-slate-400">{c.sector} — {c.plan}</p>
                  </div>
                  {!c.activo && (
                    <span className="text-xs px-2 py-1 rounded-full bg-red-100 text-red-700 h-fit">Inactivo</span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
