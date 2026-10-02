"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { StatCard } from "@/components/StatCard";
import { TIPOS_SERVICIO_ENCUESTA } from "@/lib/satisfaccion/constantes";

type EncuestaEnlace = {
  id: string;
  status: string;
  deliveryStatus: string | null;
  tipoServicio: string;
  zona: string | null;
  createdAt: string;
  cliente: { nombre: string };
  tecnico: { usuario: { nombre: string } } | null;
  ticket: { codigo: string };
};

type Dashboard = {
  kpis: {
    csat: number | null;
    enviadas: number;
    respondidas: number;
    tasaRespuesta: number | null;
    promedio: number | null;
    total: number;
    pendientes: number;
    solucion: number | null;
  };
  distribucion: { estrella: number; cantidad: number; pct: number }[];
  porTecnico: {
    tecnico: string;
    encuestas: number;
    respuestas: number;
    promedio: number | null;
    csat: number | null;
    solucion: number | null;
    muestra: string;
  }[];
  porServicio: {
    tipoServicio: string;
    encuestas: number;
    respuestas: number;
    tasaRespuesta: number | null;
    promedio: number | null;
    csat: number | null;
    solucion: number | null;
    muestra: string;
  }[];
  porZona: {
    zona: string;
    encuestas: number;
    respuestas: number;
    csat: number | null;
    promedio: number | null;
    muestra: string;
  }[];
  oportunidades: {
    servicioMenorCsat: { tipoServicio: string; csat: number | null; respuestas: number } | null;
    zonaMenorCsat: { zona: string; csat: number | null; respuestas: number } | null;
    pctNoSolucionado: number | null;
    pctCalificacionBaja: number | null;
  };
  comentariosFrecuentes: { texto: string; veces: number }[];
  nota: string;
};

export default function SatisfaccionPage() {
  const [filtros, setFiltros] = useState({
    desde: "",
    hasta: "",
    tecnicoId: "",
    tipoServicio: "",
    zona: "",
    status: "",
    rating: "",
    solucionado: "",
  });
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState("");
  const [encuestas, setEncuestas] = useState<EncuestaEnlace[]>([]);
  const [soloPendientes, setSoloPendientes] = useState(true);
  const [codigo, setCodigo] = useState("");
  const [enlace, setEnlace] = useState<Record<string, string>>({});
  const [copiado, setCopiado] = useState("");

  function query() {
    const params = new URLSearchParams();
    for (const [clave, valor] of Object.entries(filtros)) {
      if (valor) params.set(clave, valor);
    }
    return params.toString();
  }

  useEffect(() => {
    const params = new URLSearchParams({ pageSize: "30" });
    if (soloPendientes) params.set("status", "PENDING");
    const ot = codigo.trim();
    if (ot) params.set("codigo", ot);
    fetch(`/api/satisfaccion?${params.toString()}`)
      .then(async (res) => {
        if (!res.ok) throw new Error("No se pudieron cargar los enlaces");
        const lista = await res.json();
        setEncuestas(lista.filas);
      })
      .catch((err: Error) => setError(err.message));
  }, [soloPendientes, codigo]);

  async function copiarEnlace(id: string) {
    const res = await fetch(`/api/satisfaccion/${id}/enlace`);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error || "No se pudo obtener el enlace");
      return;
    }
    setEnlace((actual) => ({ ...actual, [id]: body.url }));
    try {
      await navigator.clipboard.writeText(body.url);
      setCopiado(id);
    } catch {
      setCopiado("");
      setError("El enlace está visible. Cópielo desde el campo.");
    }
  }

  useEffect(() => {
    const q = query();
    fetch(`/api/satisfaccion/dashboard${q ? `?${q}` : ""}`)
      .then(async (res) => {
        if (!res.ok) throw new Error("No se pudo cargar el dashboard");
        setData(await res.json());
        setError("");
      })
      .catch((err: Error) => setError(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtros]);

  const exportBase = query();

  return (
    <>
      <AppHeader title="Satisfacción del cliente" />
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6">
        <div className="flex flex-wrap gap-3 text-sm">
          <Link className="font-medium text-infinity-700" href="/supervisor/satisfaccion/alertas">
            Clientes insatisfechos
          </Link>
          <Link className="font-medium text-infinity-700" href="/supervisor/satisfaccion/mensual">
            Comparativo mensual
          </Link>
          <a className="text-slate-600" href={`/api/satisfaccion/export?formato=csv&${exportBase}`}>
            CSV
          </a>
          <a className="text-slate-600" href={`/api/satisfaccion/export?formato=xlsx&${exportBase}`}>
            Excel
          </a>
          <a className="text-slate-600" href={`/api/satisfaccion/export?formato=pdf&${exportBase}`}>
            PDF
          </a>
        </div>
        <form className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-4">
          <Campo label="Desde" type="date" value={filtros.desde} onChange={(v) => setFiltros({ ...filtros, desde: v })} />
          <Campo label="Hasta" type="date" value={filtros.hasta} onChange={(v) => setFiltros({ ...filtros, hasta: v })} />
          <Campo label="Técnico" value={filtros.tecnicoId} onChange={(v) => setFiltros({ ...filtros, tecnicoId: v })} />
          <label className="text-xs text-slate-600">
            Tipo de servicio
            <select
              className="mt-1 w-full rounded-lg border px-2 py-2 text-sm"
              value={filtros.tipoServicio}
              onChange={(e) => setFiltros({ ...filtros, tipoServicio: e.target.value })}
            >
              <option value="">Todos</option>
              {TIPOS_SERVICIO_ENCUESTA.map((tipo) => (
                <option key={tipo} value={tipo}>
                  {tipo}
                </option>
              ))}
            </select>
          </label>
          <Campo label="Zona" value={filtros.zona} onChange={(v) => setFiltros({ ...filtros, zona: v })} />
          <Campo label="Estado" value={filtros.status} onChange={(v) => setFiltros({ ...filtros, status: v })} />
          <Campo label="Calificación" value={filtros.rating} onChange={(v) => setFiltros({ ...filtros, rating: v })} />
          <Campo label="Solucionado" value={filtros.solucionado} onChange={(v) => setFiltros({ ...filtros, solucionado: v })} />
        </form>
        {error && <p className="text-sm text-red-700">{error}</p>}
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">Enlace para el cliente</h2>
              <p className="mt-1 text-xs text-slate-500">
                El enlace no se envía por WhatsApp. Cópielo y entréguelo al cliente.
              </p>
            </div>
            <label className="text-xs text-slate-600">
              Buscar OT
              <input
                className="mt-1 block w-36 rounded-lg border px-2 py-2 text-sm"
                placeholder="ST-1219"
                value={codigo}
                onChange={(event) => setCodigo(event.target.value)}
              />
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={soloPendientes}
                onChange={(event) => setSoloPendientes(event.target.checked)}
              />
              Solo pendientes
            </label>
          </div>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead>
                <tr className="border-b text-xs uppercase text-slate-500">
                  {["OT", "Cliente", "Zona", "Servicio", "Estado", "Enlace"].map((col) => (
                    <th key={col} className="py-2 pr-3 font-medium">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {encuestas.length === 0 && (
                  <tr>
                    <td className="py-3 text-slate-500" colSpan={6}>
                      No hay encuestas para mostrar.
                    </td>
                  </tr>
                )}
                {encuestas.map((fila) => {
                  const puedeCopiar = fila.status === "PENDING" || fila.status === "SENT" || fila.status === "OPENED";
                  return (
                    <tr key={fila.id} className="border-b border-slate-100 align-top">
                      <td className="py-2 pr-3">{fila.ticket.codigo}</td>
                      <td className="py-2 pr-3">{fila.cliente.nombre}</td>
                      <td className="py-2 pr-3">{fila.zona || "—"}</td>
                      <td className="py-2 pr-3">{fila.tipoServicio}</td>
                      <td className="py-2 pr-3">{etiquetaEstado(fila.status)}</td>
                      <td className="py-2 pr-3">
                        {puedeCopiar ? (
                          <div className="flex flex-col gap-2">
                            <button
                              type="button"
                              className="w-fit rounded-lg bg-infinity-700 px-3 py-1.5 text-xs font-medium text-white"
                              onClick={() => copiarEnlace(fila.id)}
                            >
                              {copiado === fila.id ? "Enlace copiado" : "Copiar enlace"}
                            </button>
                            {enlace[fila.id] && (
                              <input
                                readOnly
                                className="w-full min-w-[16rem] rounded border px-2 py-1 text-xs"
                                value={enlace[fila.id]}
                                onFocus={(event) => event.currentTarget.select()}
                              />
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400">Sin enlace</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
        {data && (
          <>
            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="CSAT" value={pct(data.kpis.csat)} color="green" />
              <StatCard label="Encuestas enviadas" value={data.kpis.enviadas} color="blue" />
              <StatCard label="Encuestas respondidas" value={data.kpis.respondidas} />
              <StatCard label="Tasa de respuesta" value={pct(data.kpis.tasaRespuesta)} />
              <StatCard label="Promedio general" value={data.kpis.promedio == null ? "s/d" : `${data.kpis.promedio} / 5`} />
              <StatCard label="Pendientes de envío" value={data.kpis.pendientes} color="yellow" />
              <StatCard label="Solución completa" value={pct(data.kpis.solucion)} />
              <StatCard label="Encuestas creadas" value={data.kpis.total} />
            </section>
            <section className="rounded-xl border border-slate-200 bg-white p-4">
              <h2 className="text-sm font-semibold">Distribución</h2>
              <ul className="mt-3 space-y-2">
                {data.distribucion.map((item) => (
                  <li key={item.estrella} className="grid grid-cols-[4rem_1fr_3rem] items-center gap-2 text-sm">
                    <span>{item.estrella} ★</span>
                    <span className="h-2 rounded bg-slate-100">
                      <span className="block h-2 rounded bg-amber-400" style={{ width: `${item.pct}%` }} />
                    </span>
                    <span className="text-right">{item.pct}%</span>
                  </li>
                ))}
              </ul>
            </section>
            <Tabla
              titulo="Análisis por técnico"
              nota={data.nota}
              columnas={["Técnico", "Encuestas", "Respuestas", "Promedio", "CSAT", "Solución", "Muestra"]}
              filas={data.porTecnico.map((fila) => [
                fila.tecnico,
                fila.encuestas,
                fila.respuestas,
                fila.promedio ?? "s/d",
                pct(fila.csat),
                pct(fila.solucion),
                fila.muestra === "SUFICIENTE" ? "Representativa" : "Indicador no concluyente",
              ])}
            />
            <Tabla
              titulo="Análisis por servicio"
              columnas={["Servicio", "Encuestas", "Respuestas", "Tasa", "Promedio", "CSAT", "Solución", "Muestra"]}
              filas={data.porServicio.map((fila) => [
                fila.tipoServicio,
                fila.encuestas,
                fila.respuestas,
                pct(fila.tasaRespuesta),
                fila.promedio ?? "s/d",
                pct(fila.csat),
                pct(fila.solucion),
                fila.muestra === "SUFICIENTE" ? "Representativa" : "Muestra insuficiente",
              ])}
            />
            <Tabla
              titulo="Análisis por zona"
              columnas={["Zona", "Encuestas", "Respuestas", "CSAT", "Promedio", "Muestra"]}
              filas={data.porZona.map((fila) => [
                fila.zona,
                fila.encuestas,
                fila.respuestas,
                pct(fila.csat),
                fila.promedio ?? "s/d",
                fila.muestra === "SUFICIENTE" ? "Representativa" : "Muestra insuficiente",
              ])}
            />
            <section className="rounded-xl border border-slate-200 bg-white p-4">
              <h2 className="text-sm font-semibold">Oportunidades de mejora</h2>
              <ul className="mt-3 space-y-2 text-sm text-slate-700">
                <li>
                  Servicio con menor CSAT: {data.oportunidades.servicioMenorCsat
                    ? `${data.oportunidades.servicioMenorCsat.tipoServicio} (${pct(data.oportunidades.servicioMenorCsat.csat)})`
                    : "Muestra insuficiente"}
                </li>
                <li>
                  Zona con menor CSAT: {data.oportunidades.zonaMenorCsat
                    ? `${data.oportunidades.zonaMenorCsat.zona} (${pct(data.oportunidades.zonaMenorCsat.csat)})`
                    : "Muestra insuficiente"}
                </li>
                <li>No solucionado: {pct(data.oportunidades.pctNoSolucionado)}</li>
                <li>Calificaciones 1-2: {pct(data.oportunidades.pctCalificacionBaja)}</li>
              </ul>
              <h3 className="mt-4 text-sm font-semibold">Comentarios repetidos</h3>
              {data.comentariosFrecuentes.length === 0 ? (
                <p className="mt-2 text-sm text-slate-500">Todavía no hay comentarios repetidos.</p>
              ) : (
                <ul className="mt-2 space-y-1 text-sm">
                  {data.comentariosFrecuentes.map((item) => (
                    <li key={item.texto}>
                      {item.veces}× {item.texto}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </main>
    </>
  );
}

function pct(valor: number | null) {
  return valor == null ? "s/d" : `${valor}%`;
}

function etiquetaEstado(status: string) {
  const etiquetas: Record<string, string> = {
    PENDING: "Pendiente de envío",
    SENT: "Enviada",
    OPENED: "Abierta",
    ANSWERED: "Respondida",
    EXPIRED: "Vencida",
    CANCELLED: "Cancelada",
  };
  return etiquetas[status] || status;
}

function Campo({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (valor: string) => void;
  type?: string;
}) {
  return (
    <label className="text-xs text-slate-600">
      {label}
      <input
        type={type}
        className="mt-1 w-full rounded-lg border px-2 py-2 text-sm"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function Tabla({
  titulo,
  columnas,
  filas,
  nota,
}: {
  titulo: string;
  columnas: string[];
  filas: (string | number)[][];
  nota?: string;
}) {
  return (
    <section className="overflow-x-auto rounded-xl border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-semibold">{titulo}</h2>
      {nota && <p className="mt-1 text-xs text-slate-500">{nota}</p>}
      <table className="mt-3 w-full min-w-[640px] text-left text-sm">
        <thead>
          <tr className="border-b text-xs uppercase text-slate-500">
            {columnas.map((col) => (
              <th key={col} className="py-2 pr-3 font-medium">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.length === 0 && (
            <tr>
              <td className="py-3 text-slate-500" colSpan={columnas.length}>
                Sin datos para el filtro.
              </td>
            </tr>
          )}
          {filas.map((fila, i) => (
            <tr key={i} className="border-b border-slate-100">
              {fila.map((celda, j) => (
                <td key={j} className="py-2 pr-3">
                  {celda}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
