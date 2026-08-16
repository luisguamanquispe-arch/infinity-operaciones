"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { ParqueSubnav } from "@/components/parque/ParqueSubnav";
import { ACTA_ITEMS } from "@/lib/parque-automotor/labels";

type Ficha = {
  id: string;
  placa: string;
  marca: string;
  modelo: string;
  anio: number;
  estado: string;
  kilometrajeActual: number;
  responsable: { nombre: string; tecnicoId: string; asignacionId: string } | null;
  asignaciones: { id: string; tecnicoNombre: string; fechaInicio: string; fechaFin: string | null }[];
  cargasCombustible: { id: string; fecha: string; total: number; galones: number; consumoFueraPromedio: boolean; estacion: string }[];
  lecturasKm: { id: string; kilometraje: number; createdAt: string; origen: string }[];
  mantenimientos: { id: string; fecha: string; tipo: string; costo: number; descripcion: string }[];
  novedades: { id: string; fecha: string; tipo: string; estado: string; descripcion: string }[];
  inspecciones: { id: string; fecha: string; resultado: string }[];
  documentos: { id: string; tipo: string; numero: string | null; fechaVencimiento: string | null }[];
  ticketsAtendidos: { id: string; codigo: string; estado: string; createdAt: string }[];
  costos: { totalMes: number; totalAnio: number; combustibleMes: number; mantenimientoMes: number };
  docsAlertas: { tipo: string; alerta: string }[];
  alertaMant: string | null;
  alertaNoApto?: string | null;
  actas?: unknown[];
};

export default function VehiculoFichaPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [ficha, setFicha] = useState<Ficha | null>(null);
  const [error, setError] = useState("");
  const [tecnicos, setTecnicos] = useState<{ id: string; nombre: string }[]>([]);
  const [asig, setAsig] = useState({
    tecnicoId: "",
    kilometrajeEntrega: 0,
    combustibleEntrega: 100,
    observaciones: "",
  });
  const [tab, setTab] = useState("datos");

  async function cargar() {
    const r = await fetch(`/api/vehiculos/${id}`);
    const j = await r.json();
    if (!r.ok) setError(j.error || "Error");
    else {
      setFicha(j);
      setAsig((s) => ({ ...s, kilometrajeEntrega: j.kilometrajeActual || 0 }));
    }
  }

  useEffect(() => {
    void cargar();
    fetch("/api/tecnicos")
      .then((r) => r.json())
      .then((j) =>
        setTecnicos((j.tecnicos || []).map((t: { id: string; nombre?: string; usuario?: { nombre: string } }) => ({
          id: t.id,
          nombre: t.nombre || t.usuario?.nombre || t.id,
        })))
      );
  }, [id]);

  async function asignar(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch(`/api/vehiculos/${id}/asignar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...asig,
        checklist: Object.fromEntries(ACTA_ITEMS.map((i) => [i.key, true])),
      }),
    });
    const j = await r.json();
    if (!r.ok) setError(j.error || "No se pudo asignar");
    else await cargar();
  }

  async function recibir() {
    const km = Number(prompt("Kilometraje de recepción", String(ficha?.kilometrajeActual ?? 0)));
    if (!Number.isFinite(km)) return;
    const r = await fetch(`/api/vehiculos/${id}/recibir`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kilometrajeRecepcion: km,
        combustibleRecepcion: 50,
        checklist: Object.fromEntries(ACTA_ITEMS.map((i) => [i.key, true])),
      }),
    });
    const j = await r.json();
    if (!r.ok) setError(j.error || "No se pudo recibir");
    else await cargar();
  }

  async function postJson(path: string, body: unknown) {
    setError("");
    const r = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const j = await r.json();
    if (!r.ok) setError(j.error || j.mensajeAnormal || "Error");
    else {
      if (j.mensajeAnormal) setError(j.mensajeAnormal);
      await cargar();
    }
    return j;
  }

  if (!ficha) {
    return (
      <div>
        <AppHeader title="Hoja de vida" subtitle="Parque automotor" />
        <main className="p-4">Cargando…</main>
      </div>
    );
  }

  const tabs = [
    "datos",
    "asignaciones",
    "km",
    "combustible",
    "mantenimiento",
    "novedades",
    "inspecciones",
    "documentos",
    "tickets",
    "costos",
  ];

  return (
    <div>
      <AppHeader title="Hoja de vida" subtitle="Parque automotor" />
      <main className="max-w-6xl mx-auto p-4 space-y-4">
        <h1 className="text-xl font-semibold">
          {ficha.placa} · {ficha.marca} {ficha.modelo}
        </h1>
        <ParqueSubnav />
        {error && <p className="text-amber-800 text-sm bg-amber-50 border border-amber-200 rounded p-2">{error}</p>}
        <p className="text-sm text-slate-600">
          Estado {ficha.estado} · {ficha.kilometrajeActual} km · Responsable:{" "}
          {ficha.responsable?.nombre ?? "sin asignar"}
        </p>
        {ficha.alertaNoApto && (
          <p className="text-sm text-red-800 bg-red-50 border border-red-200 rounded p-2 font-medium">
            {ficha.alertaNoApto}
          </p>
        )}
        {ficha.alertaMant && (
          <p className="text-sm text-amber-900">Alerta mantenimiento: {ficha.alertaMant}</p>
        )}
        <div className="flex gap-2 flex-wrap">
          {tabs.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-1 rounded border text-sm ${tab === t ? "bg-infinity-600 text-white" : ""}`}
            >
              {t}
            </button>
          ))}
          <a className="px-3 py-1 rounded border text-sm" href={`/api/vehiculos/${id}/pdf`}>
            PDF hoja de vida
          </a>
          <a className="px-3 py-1 rounded border text-sm" href={`/api/vehiculos/${id}/acta/pdf`}>
            PDF acta
          </a>
        </div>

        {tab === "datos" && (
          <section className="border rounded-xl p-4 bg-white space-y-3">
            <form onSubmit={asignar} className="grid sm:grid-cols-4 gap-2">
              <select
                className="border rounded px-2 py-1"
                value={asig.tecnicoId}
                onChange={(e) => setAsig({ ...asig, tecnicoId: e.target.value })}
                required
                disabled={ficha.estado !== "DISPONIBLE"}
              >
                <option value="">Técnico</option>
                {tecnicos.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nombre}
                  </option>
                ))}
              </select>
              <input
                type="number"
                className="border rounded px-2 py-1"
                value={asig.kilometrajeEntrega}
                onChange={(e) => setAsig({ ...asig, kilometrajeEntrega: Number(e.target.value) })}
              />
              <input
                type="number"
                className="border rounded px-2 py-1"
                value={asig.combustibleEntrega}
                onChange={(e) => setAsig({ ...asig, combustibleEntrega: Number(e.target.value) })}
                placeholder="% combustible"
              />
              <button className="bg-infinity-600 text-white rounded" disabled={ficha.estado !== "DISPONIBLE"}>
                Asignar / entregar
              </button>
            </form>
            {ficha.estado !== "DISPONIBLE" && (
              <p className="text-xs text-slate-600">
                Solo se asignan vehículos en estado DISPONIBLE. Si está en mantenimiento u otro estado, conserve el historial de la asignación abierta.
              </p>
            )}
            {ficha.responsable && (
              <button onClick={recibir} className="px-3 py-1 border rounded">
                Recibir vehículo
              </button>
            )}
          </section>
        )}

        {tab === "asignaciones" && (
          <ul className="text-sm space-y-1">
            {ficha.asignaciones.map((a) => (
              <li key={a.id}>
                {a.tecnicoNombre} · {new Date(a.fechaInicio).toLocaleString("es-EC")} →{" "}
                {a.fechaFin ? new Date(a.fechaFin).toLocaleString("es-EC") : "abierta"}
              </li>
            ))}
          </ul>
        )}

        {tab === "km" && (
          <KmForm
            km={ficha.kilometrajeActual}
            historial={ficha.lecturasKm}
            onSubmit={(kilometraje, observacion) =>
              postJson(`/api/vehiculos/${id}/kilometraje`, { kilometraje, observacion })
            }
          />
        )}

        {tab === "combustible" && (
          <CombForm
            km={ficha.kilometrajeActual}
            rows={ficha.cargasCombustible}
            onSubmit={(body) => postJson(`/api/vehiculos/${id}/combustible`, body)}
          />
        )}

        {tab === "mantenimiento" && (
          <MantForm
            km={ficha.kilometrajeActual}
            rows={ficha.mantenimientos}
            onSubmit={(body) => postJson(`/api/vehiculos/${id}/mantenimientos`, body)}
            onOperativo={() => postJson(`/api/vehiculos/${id}/mantenimientos`, { accion: "OPERATIVO" })}
          />
        )}

        {tab === "novedades" && (
          <ul className="text-sm space-y-2">
            {ficha.novedades.map((n) => (
              <li key={n.id} className="border rounded p-2">
                {n.tipo} · {n.estado} · {n.descripcion}
                {n.estado !== "RESUELTA" && (
                  <button
                    className="ml-2 text-infinity-700"
                    onClick={() =>
                      postJson(`/api/vehiculos/${id}/novedades`, {
                        novedadId: n.id,
                        estado: "RESUELTA",
                      })
                    }
                  >
                    Marcar resuelta
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        {tab === "inspecciones" && (
          <ul className="text-sm">
            {ficha.inspecciones.map((i) => (
              <li key={i.id}>
                {new Date(i.fecha).toLocaleString("es-EC")} · {i.resultado}
              </li>
            ))}
          </ul>
        )}

        {tab === "documentos" && (
          <DocsForm
            rows={ficha.documentos}
            alertas={ficha.docsAlertas}
            onSubmit={(body) => postJson(`/api/vehiculos/${id}/documentos`, body)}
          />
        )}

        {tab === "tickets" && (
          <ul className="text-sm">
            {ficha.ticketsAtendidos.length === 0 && <li>Sin tickets en ventanas de asignación.</li>}
            {ficha.ticketsAtendidos.map((t) => (
              <li key={t.id}>
                {t.codigo} · {t.estado} · {new Date(t.createdAt).toLocaleString("es-EC")}
              </li>
            ))}
          </ul>
        )}

        {tab === "costos" && (
          <div className="text-sm space-y-1">
            <p>Combustible mes: ${ficha.costos.combustibleMes}</p>
            <p>Mantenimiento mes: ${ficha.costos.mantenimientoMes}</p>
            <p>Total mes: ${ficha.costos.totalMes}</p>
            <p>Total año: ${ficha.costos.totalAnio}</p>
          </div>
        )}
      </main>
    </div>
  );
}

function KmForm({
  km,
  historial,
  onSubmit,
}: {
  km: number;
  historial: Ficha["lecturasKm"];
  onSubmit: (km: number, obs?: string) => void;
}) {
  const [v, setV] = useState(km);
  return (
    <div className="space-y-2">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(v);
        }}
      >
        <input type="number" className="border rounded px-2" value={v} onChange={(e) => setV(Number(e.target.value))} />
        <button className="bg-infinity-600 text-white rounded px-3">Registrar km</button>
      </form>
      <ul className="text-sm">
        {historial.map((h) => (
          <li key={h.id}>
            {h.kilometraje} · {h.origen}
          </li>
        ))}
      </ul>
    </div>
  );
}

function CombForm({
  km,
  rows,
  onSubmit,
}: {
  km: number;
  rows: Ficha["cargasCombustible"];
  onSubmit: (b: Record<string, unknown>) => void;
}) {
  const [f, setF] = useState({ estacion: "", kilometraje: km, galones: 0, precioPorGalon: 0 });
  return (
    <div className="space-y-2">
      <form
        className="grid sm:grid-cols-5 gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(f);
        }}
      >
        <input className="border rounded px-2" placeholder="Estación" value={f.estacion} onChange={(e) => setF({ ...f, estacion: e.target.value })} required />
        <input type="number" className="border rounded px-2" value={f.kilometraje} onChange={(e) => setF({ ...f, kilometraje: Number(e.target.value) })} />
        <input type="number" step="0.01" className="border rounded px-2" placeholder="Galones" value={f.galones} onChange={(e) => setF({ ...f, galones: Number(e.target.value) })} />
        <input type="number" step="0.01" className="border rounded px-2" placeholder="$/gal" value={f.precioPorGalon} onChange={(e) => setF({ ...f, precioPorGalon: Number(e.target.value) })} />
        <button className="bg-infinity-600 text-white rounded">Cargar</button>
      </form>
      <ul className="text-sm">
        {rows.map((c) => (
          <li key={c.id}>
            {c.estacion} · {c.galones} gal · ${c.total}
            {c.consumoFueraPromedio ? " · Consumo fuera del promedio." : ""}
          </li>
        ))}
      </ul>
    </div>
  );
}

function MantForm({
  km,
  rows,
  onSubmit,
  onOperativo,
}: {
  km: number;
  rows: Ficha["mantenimientos"];
  onSubmit: (b: Record<string, unknown>) => void;
  onOperativo: () => void;
}) {
  const [f, setF] = useState({
    kilometraje: km,
    clase: "PREVENTIVO",
    tipo: "ACEITE",
    descripcion: "",
    costo: 0,
    proximoKm: km + 5000,
  });
  return (
    <div className="space-y-2">
      <form
        className="grid sm:grid-cols-3 gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(f);
        }}
      >
        <select className="border rounded px-2" value={f.clase} onChange={(e) => setF({ ...f, clase: e.target.value })}>
          <option>PREVENTIVO</option>
          <option>CORRECTIVO</option>
        </select>
        <input className="border rounded px-2" placeholder="Descripción" value={f.descripcion} onChange={(e) => setF({ ...f, descripcion: e.target.value })} required />
        <input type="number" className="border rounded px-2" value={f.costo} onChange={(e) => setF({ ...f, costo: Number(e.target.value) })} />
        <input type="number" className="border rounded px-2" value={f.kilometraje} onChange={(e) => setF({ ...f, kilometraje: Number(e.target.value) })} />
        <input type="number" className="border rounded px-2" value={f.proximoKm} onChange={(e) => setF({ ...f, proximoKm: Number(e.target.value) })} />
        <button className="bg-infinity-600 text-white rounded">Registrar</button>
      </form>
      <button className="border rounded px-3 py-1 text-sm" onClick={onOperativo}>
        Volver a operativo
      </button>
      <ul className="text-sm">
        {rows.map((m) => (
          <li key={m.id}>
            {m.tipo} · ${m.costo} · {m.descripcion}
          </li>
        ))}
      </ul>
    </div>
  );
}

function DocsForm({
  rows,
  alertas,
  onSubmit,
}: {
  rows: Ficha["documentos"];
  alertas: Ficha["docsAlertas"];
  onSubmit: (b: Record<string, unknown>) => void;
}) {
  const [f, setF] = useState({ tipo: "MATRICULA", numero: "", fechaVencimiento: "" });
  return (
    <div className="space-y-2">
      {alertas.length > 0 && (
        <p className="text-sm text-amber-800">
          Docs con alerta: {alertas.map((a) => `${a.tipo} (${a.alerta})`).join(", ")}
        </p>
      )}
      <form
        className="flex gap-2 flex-wrap"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(f);
        }}
      >
        <select className="border rounded px-2" value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value })}>
          <option>MATRICULA</option>
          <option>REVISION</option>
          <option>SEGURO</option>
          <option>PERMISO</option>
          <option>OTRO</option>
        </select>
        <input className="border rounded px-2" placeholder="Número" value={f.numero} onChange={(e) => setF({ ...f, numero: e.target.value })} />
        <input type="date" className="border rounded px-2" value={f.fechaVencimiento} onChange={(e) => setF({ ...f, fechaVencimiento: e.target.value })} />
        <button className="bg-infinity-600 text-white rounded px-3">Guardar</button>
      </form>
      <ul className="text-sm">
        {rows.map((d) => (
          <li key={d.id}>
            {d.tipo} {d.numero} {d.fechaVencimiento ? `vence ${d.fechaVencimiento.slice(0, 10)}` : ""}
          </li>
        ))}
      </ul>
    </div>
  );
}
