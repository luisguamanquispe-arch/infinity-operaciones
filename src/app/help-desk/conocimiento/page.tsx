"use client";

import { useEffect, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { fetchJson } from "@/lib/fetch-json-client";

type Articulo = {
  id: string;
  titulo: string;
  categoria: string;
  marca: string | null;
  contenido: string;
  tags: string;
};

export default function ConocimientoHelpDeskPage() {
  const [items, setItems] = useState<Articulo[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Articulo | null>(null);

  async function load(query = q) {
    setLoading(true);
    const url = query ? `/api/help-desk/conocimiento?q=${encodeURIComponent(query)}` : "/api/help-desk/conocimiento";
    let { data } = await fetchJson<{ items: Articulo[] }>(url);
    if (!data?.items?.length) {
      await fetchJson("/api/help-desk/conocimiento", { method: "POST" });
      ({ data } = await fetchJson<{ items: Articulo[] }>(url));
    }
    if (data?.items) setItems(data.items);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <h1 className="text-xl font-bold mb-1">Base de conocimiento</h1>
      <p className="text-sm text-slate-500 mb-4">Manuales Huawei, Mikrotik, TP-Link, GPON y procedimientos ISP</p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          load(q);
        }}
        className="flex gap-2 mb-6"
      >
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por título, marca o tema…"
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border dark:bg-slate-900 dark:border-slate-700"
          />
        </div>
        <button type="submit" className="px-4 py-2 rounded-xl bg-teal-600 text-white text-sm">
          Buscar
        </button>
      </form>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
        </div>
      ) : (
        <div className="grid lg:grid-cols-2 gap-4">
          <div className="space-y-2">
            {items.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => setSelected(a)}
                className={`w-full text-left p-4 rounded-xl border transition ${
                  selected?.id === a.id
                    ? "border-teal-500 bg-teal-50 dark:bg-teal-950/30"
                    : "border-slate-200 dark:border-slate-700 hover:border-teal-300"
                }`}
              >
                <p className="font-semibold text-sm">{a.titulo}</p>
                <p className="text-xs text-slate-500 mt-1">
                  {a.categoria}
                  {a.marca ? ` · ${a.marca}` : ""}
                </p>
              </button>
            ))}
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 min-h-[300px]">
            {selected ? (
              <>
                <h2 className="font-bold text-lg">{selected.titulo}</h2>
                <p className="text-xs text-slate-500 mb-4">{selected.tags}</p>
                <pre className="whitespace-pre-wrap text-sm leading-relaxed">{selected.contenido}</pre>
              </>
            ) : (
              <p className="text-slate-500 text-sm">Seleccione un artículo para leer.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
