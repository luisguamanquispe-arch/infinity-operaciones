"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { ParqueSubnav } from "@/components/parque/ParqueSubnav";
import { Campo, campoControl } from "@/components/parque/Campo";
import {
  ACTA_ITEMS,
  CLASE_MANT_LABELS,
  TIPO_DOC_LABELS,
  TIPO_MANT_LABELS,
} from "@/lib/parque-automotor/labels";

type Ficha = {
  id: string;
  placa: string;
  marca: string;
  modelo: string;
  anio: number;
  estado: string;
  kilometrajeActual: number;
  responsable: { nombre: string; tecnicoId: string; asignacionId: string } | null;
  asignaciones: {
    id: string;
    tecnicoNombre: string;
    fechaInicio: string;
    fechaFin: string | null;
    actas?: { id: string; tipo: string }[];
  }[];
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
  actas?: { id: string; tipo: string; createdAt: string; kilometraje: number; combustible: number }[];
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
  const [recepcion, setRecepcion] = useState({
    kilometrajeRecepcion: 0,
    combustibleRecepcion: 50,
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
      setRecepcion((s) => ({
        ...s,
        kilometrajeRecepcion: j.kilometrajeActual || 0,
      }));
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

  async function recibir(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch(`/api/vehiculos/${id}/recibir`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kilometrajeRecepcion: recepcion.kilometrajeRecepcion,
        combustibleRecepcion: recepcion.combustibleRecepcion,
        observaciones: recepcion.observaciones,
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

  const tabs: { id: string; label: string }[] = [
    { id: "datos", label: "Datos" },
    { id: "asignaciones", label: "Asignaciones" },
    { id: "km", label: "Kilometraje" },
    { id: "combustible", label: "Combustible" },
    { id: "mantenimiento", label: "Mantenimiento" },
    { id: "novedades", label: "Novedades" },
    { id: "inspecciones", label: "Inspecciones" },
    { id: "documentos", label: "Documentos" },
    { id: "tickets", label: "Tickets" },
    { id: "costos", label: "Costos" },
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
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-3 py-1 rounded border text-sm ${tab === t.id ? "bg-infinity-600 text-white" : ""}`}
            >
              {t.label}
            </button>
          ))}
          <a className="px-3 py-1 rounded border text-sm" href={`/api/vehiculos/${id}/pdf`}>
            PDF hoja de vida
          </a>
          {(ficha.actas?.length ?? 0) > 0 ? (
            <a
              className="px-3 py-1 rounded border text-sm"
              href={`/api/vehiculos/${id}/acta/pdf?actaId=${encodeURIComponent(ficha.actas![0].id)}`}
              target="_blank"
              rel="noreferrer"
            >
              PDF última acta
            </a>
          ) : (
            <span
              className="px-3 py-1 rounded border text-sm text-slate-400"
              title="El acta se genera al asignar o recibir el vehículo"
            >
              PDF acta (sin acta)
            </span>
          )}
        </div>

        {tab === "datos" && (
          <section className="border rounded-xl p-4 bg-white space-y-4">
            <h2 className="font-semibold">Entregar vehículo</h2>
            <p className="text-xs text-slate-600">
              Al entregar se genera el acta de entrega (PDF). Al recibir se genera el de recepción.
            </p>
            <form onSubmit={asignar} className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <Campo label="Técnico">
                <select
                  className={campoControl}
                  value={asig.tecnicoId}
                  onChange={(e) => setAsig({ ...asig, tecnicoId: e.target.value })}
                  required
                  disabled={ficha.estado !== "DISPONIBLE"}
                >
                  <option value="">Seleccione un técnico</option>
                  {tecnicos.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.nombre}
                    </option>
                  ))}
                </select>
              </Campo>
              <Campo label="Kilometraje de entrega">
                <input
                  type="number"
                  min={0}
                  className={campoControl}
                  value={asig.kilometrajeEntrega}
                  onChange={(e) => setAsig({ ...asig, kilometrajeEntrega: Number(e.target.value) })}
                  required
                  disabled={ficha.estado !== "DISPONIBLE"}
                />
              </Campo>
              <Campo label="Combustible de entrega (%)">
                <input
                  type="number"
                  min={0}
                  max={100}
                  className={campoControl}
                  value={asig.combustibleEntrega}
                  onChange={(e) => setAsig({ ...asig, combustibleEntrega: Number(e.target.value) })}
                  required
                  disabled={ficha.estado !== "DISPONIBLE"}
                />
              </Campo>
              <Campo label="Observaciones" className="sm:col-span-2 lg:col-span-4">
                <input
                  className={campoControl}
                  value={asig.observaciones}
                  onChange={(e) => setAsig({ ...asig, observaciones: e.target.value })}
                  disabled={ficha.estado !== "DISPONIBLE"}
                />
              </Campo>
              <div className="flex items-end">
                <button className="bg-infinity-600 text-white rounded px-4 py-2" disabled={ficha.estado !== "DISPONIBLE"}>
                  Asignar / entregar
                </button>
              </div>
            </form>
            {ficha.estado !== "DISPONIBLE" && (
              <p className="text-xs text-slate-600">
                Solo se asignan vehículos en estado DISPONIBLE. Si está en mantenimiento u otro estado, conserve el historial de la asignación abierta.
              </p>
            )}
            {ficha.responsable && (
              <div className="border-t pt-4 space-y-3">
                <h2 className="font-semibold">Recibir vehículo</h2>
                <form onSubmit={recibir} className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <Campo label="Kilometraje de recepción">
                    <input
                      type="number"
                      min={0}
                      className={campoControl}
                      value={recepcion.kilometrajeRecepcion}
                      onChange={(e) =>
                        setRecepcion({
                          ...recepcion,
                          kilometrajeRecepcion: Number(e.target.value),
                        })
                      }
                      required
                    />
                  </Campo>
                  <Campo label="Combustible de recepción (%)">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      className={campoControl}
                      value={recepcion.combustibleRecepcion}
                      onChange={(e) =>
                        setRecepcion({
                          ...recepcion,
                          combustibleRecepcion: Number(e.target.value),
                        })
                      }
                      required
                    />
                  </Campo>
                  <Campo label="Observaciones">
                    <input
                      className={campoControl}
                      value={recepcion.observaciones}
                      onChange={(e) =>
                        setRecepcion({ ...recepcion, observaciones: e.target.value })
                      }
                    />
                  </Campo>
                  <div className="flex items-end">
                    <button className="px-4 py-2 border rounded">Recibir vehículo</button>
                  </div>
                </form>
              </div>
            )}
          </section>
        )}

        {tab === "asignaciones" && (
          <ul className="text-sm space-y-3">
            {ficha.asignaciones.length === 0 && <li className="text-gray-500">Sin asignaciones.</li>}
            {ficha.asignaciones.map((a) => (
              <li key={a.id} className="border rounded p-2">
                <div>
                  {a.tecnicoNombre} · {new Date(a.fechaInicio).toLocaleString("es-EC")} →{" "}
                  {a.fechaFin ? new Date(a.fechaFin).toLocaleString("es-EC") : "abierta"}
                </div>
                <div className="text-xs mt-1 space-x-2">
                  {(a.actas ?? []).length === 0 && (
                    <span className="text-gray-500">Sin acta (asigne o reciba el vehículo).</span>
                  )}
                  {(a.actas ?? []).map((act) => (
                    <a
                      key={act.id}
                      className="text-red-700 underline"
                      href={`/api/vehiculos/${id}/acta/pdf?actaId=${encodeURIComponent(act.id)}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      PDF {act.tipo === "ENTREGA" ? "entrega" : "recepción"}
                    </a>
                  ))}
                </div>
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
  const [obs, setObs] = useState("");
  return (
    <div className="space-y-2">
      <form
        className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(v, obs || undefined);
        }}
      >
        <Campo label="Kilometraje">
          <input
            type="number"
            min={0}
            className={campoControl}
            value={v}
            onChange={(e) => setV(Number(e.target.value))}
            required
          />
        </Campo>
        <Campo label="Observación">
          <input
            className={campoControl}
            value={obs}
            onChange={(e) => setObs(e.target.value)}
          />
        </Campo>
        <div className="flex items-end">
          <button className="bg-infinity-600 text-white rounded px-4 py-2">Registrar kilometraje</button>
        </div>
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
        className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(f);
        }}
      >
        <Campo label="Estación de servicio">
          <input
            className={campoControl}
            value={f.estacion}
            onChange={(e) => setF({ ...f, estacion: e.target.value })}
            required
          />
        </Campo>
        <Campo label="Kilometraje">
          <input
            type="number"
            min={0}
            className={campoControl}
            value={f.kilometraje}
            onChange={(e) => setF({ ...f, kilometraje: Number(e.target.value) })}
            required
          />
        </Campo>
        <Campo label="Galones">
          <input
            type="number"
            step="0.01"
            min={0}
            className={campoControl}
            value={f.galones}
            onChange={(e) => setF({ ...f, galones: Number(e.target.value) })}
            required
          />
        </Campo>
        <Campo label="Precio por galón (USD)">
          <input
            type="number"
            step="0.01"
            min={0}
            className={campoControl}
            value={f.precioPorGalon}
            onChange={(e) => setF({ ...f, precioPorGalon: Number(e.target.value) })}
            required
          />
        </Campo>
        <div className="flex items-end">
          <button className="bg-infinity-600 text-white rounded px-4 py-2">Registrar carga</button>
        </div>
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
        className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(f);
        }}
      >
        <Campo label="Clase de mantenimiento">
          <select className={campoControl} value={f.clase} onChange={(e) => setF({ ...f, clase: e.target.value })}>
            {Object.entries(CLASE_MANT_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Campo>
        <Campo label="Tipo de trabajo">
          <select className={campoControl} value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value })}>
            {Object.entries(TIPO_MANT_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Campo>
        <Campo label="Descripción" className="sm:col-span-2 lg:col-span-3">
          <input
            className={campoControl}
            value={f.descripcion}
            onChange={(e) => setF({ ...f, descripcion: e.target.value })}
            required
          />
        </Campo>
        <Campo label="Costo (USD)">
          <input
            type="number"
            min={0}
            step="0.01"
            className={campoControl}
            value={f.costo}
            onChange={(e) => setF({ ...f, costo: Number(e.target.value) })}
          />
        </Campo>
        <Campo label="Kilometraje">
          <input
            type="number"
            min={0}
            className={campoControl}
            value={f.kilometraje}
            onChange={(e) => setF({ ...f, kilometraje: Number(e.target.value) })}
            required
          />
        </Campo>
        <Campo label="Próximo mantenimiento (km)">
          <input
            type="number"
            min={0}
            className={campoControl}
            value={f.proximoKm}
            onChange={(e) => setF({ ...f, proximoKm: Number(e.target.value) })}
          />
        </Campo>
        <div className="flex items-end">
          <button className="bg-infinity-600 text-white rounded px-4 py-2">Registrar mantenimiento</button>
        </div>
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
        className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(f);
        }}
      >
        <Campo label="Tipo de documento">
          <select className={campoControl} value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value })}>
            {Object.entries(TIPO_DOC_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Campo>
        <Campo label="Número">
          <input
            className={campoControl}
            value={f.numero}
            onChange={(e) => setF({ ...f, numero: e.target.value })}
          />
        </Campo>
        <Campo label="Fecha de vencimiento">
          <input
            type="date"
            className={campoControl}
            value={f.fechaVencimiento}
            onChange={(e) => setF({ ...f, fechaVencimiento: e.target.value })}
          />
        </Campo>
        <div className="flex items-end">
          <button className="bg-infinity-600 text-white rounded px-4 py-2">Guardar documento</button>
        </div>
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
