"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Search, UserPlus } from "lucide-react";

export type ClienteResumen = {
  id: string;
  cedula: string;
  nombre: string;
  telefono: string;
  plan: string;
  direccion: string;
  sector: string;
  referencia: string | null;
  nodo: string | null;
};

interface ClientePickerProps {
  value: ClienteResumen | null;
  onChange: (cliente: ClienteResumen | null) => void;
  nuevoClienteHref?: string;
}

export function ClientePicker({ value, onChange, nuevoClienteHref = "/supervisor/clientes/nuevo?next=/supervisor/tickets/nuevo" }: ClientePickerProps) {
  const [busqueda, setBusqueda] = useState("");
  const [resultados, setResultados] = useState<ClienteResumen[]>([]);
  const [buscando, setBuscando] = useState(false);

  useEffect(() => {
    if (value) return;
    const q = busqueda.trim();
    if (q.length < 1) {
      setResultados([]);
      return;
    }
    const t = setTimeout(async () => {
      setBuscando(true);
      const res = await fetch(`/api/clientes?q=${encodeURIComponent(q)}&take=15`);
      const data = await res.json();
      setResultados(data.clientes || []);
      setBuscando(false);
    }, 300);
    return () => clearTimeout(t);
  }, [busqueda, value]);

  if (value) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-semibold">{value.nombre}</p>
            <p className="text-sm text-slate-600">{value.cedula} · {value.telefono}</p>
            <p className="text-xs text-slate-500">{value.sector} — {value.plan}</p>
            <p className="text-xs text-slate-500 mt-1">{value.direccion}</p>
          </div>
          <button
            type="button"
            onClick={() => onChange(null)}
            className="text-infinity-600 text-xs font-medium shrink-0"
          >
            Cambiar
          </button>
        </div>
        <Link href={`/supervisor/clientes/${value.id}`} className="text-xs text-infinity-600 hover:underline">
          Editar datos del cliente
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Buscar cliente por cédula, nombre, teléfono o sector..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 border rounded-xl text-sm"
        />
        {buscando && <Loader2 className="absolute right-3 top-3 w-4 h-4 animate-spin text-slate-400" />}
        {resultados.length > 0 && (
          <div className="absolute z-10 w-full mt-1 bg-white border rounded-xl shadow-lg max-h-56 overflow-y-auto">
            {resultados.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  onChange(c);
                  setBusqueda("");
                  setResultados([]);
                }}
                className="w-full text-left px-4 py-2.5 hover:bg-slate-50 text-sm border-b last:border-0"
              >
                <span className="font-medium">{c.nombre}</span>
                <span className="text-slate-500 ml-2">{c.cedula}</span>
                <span className="text-slate-400 block text-xs">{c.sector} · {c.telefono}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <Link
        href={nuevoClienteHref}
        className="inline-flex items-center gap-1.5 text-sm text-infinity-600 font-medium hover:underline"
      >
        <UserPlus className="w-4 h-4" />
        Crear cliente nuevo (independiente del ticket)
      </Link>
    </div>
  );
}
