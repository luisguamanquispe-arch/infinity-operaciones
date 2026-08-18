"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { Campo, campoControl } from "@/components/parque/Campo";
import { ParquePhotoPicker, type FotoLocal } from "@/components/parque/ParquePhotoPicker";
import {
  INSPECCION_ITEMS,
  NOVEDAD_REPORTE_OPCIONES,
  TIPO_NOVEDAD_VEH_LABELS,
} from "@/lib/parque-automotor/labels";

type Foto = { id: string; url: string };
type Evento = {
  id: string;
  fecha: string;
  tipo: string;
  titulo: string;
  descripcion: string;
  estado?: string | null;
  tecnicoNombre?: string | null;
  kilometraje?: number | null;
  registroId: string;
  fotos: Foto[];
};

type VehiculoMio = {
  id: string;
  placa: string;
  marca: string;
  modelo: string;
  anio: number;
  color: string | null;
  kilometraje: number;
  estado: string;
  estadoVisible: string;
  estadoClave: "operativo" | "mantenimiento" | "fuera";
  fechaAsignacion: string;
  tecnicoNombre: string;
  alertaMant: string | null;
  alertaNoApto?: string | null;
  bloqueadoCampo?: boolean;
};

const TIPO_HIST = {
  KM: "Kilometraje",
  GASOLINA: "Gasolina",
  NOVEDAD: "Daños y novedades",
  INSPECCION: "Inspecciones",
  MANTENIMIENTO: "Mantenimientos",
  ASIGNACION: "Asignación",
  RECEPCION: "Recepción",
};

export default function TecnicoMiVehiculoPage() {
  const [vehiculo, setVehiculo] = useState<VehiculoMio | null | undefined>(undefined);
  const [historial, setHistorial] = useState<Evento[]>([]);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [km, setKm] = useState(0);
  const [comb, setComb] = useState({
    kilometraje: 0,
    galones: 0,
    precioPorGalon: 0,
  });
  const [factura, setFactura] = useState<FotoLocal[]>([]);
  const [items, setItems] = useState<Record<string, boolean>>(
    Object.fromEntries(INSPECCION_ITEMS.map((i) => [i.key, true]))
  );
  const [combustiblePct, setCombustiblePct] = useState(50);
  const [fotosInsp, setFotosInsp] = useState<FotoLocal[]>([]);
  const [nov, setNov] = useState({
    tipoUi: "RAYON",
    descripcion: "",
    puedeCircular: "si" as "si" | "no",
    kilometraje: 0,
  });
  const [fotosNov, setFotosNov] = useState<FotoLocal[]>([]);
  const [mostrarNov, setMostrarNov] = useState(false);
  const [viewer, setViewer] = useState<string | null>(null);

  async function cargar() {
    const r = await fetch("/api/tecnico/vehiculo");
    const j = await r.json();
    setVehiculo(j.vehiculo ?? null);
    setHistorial(j.historial || []);
    if (j.vehiculo) {
      setKm(j.vehiculo.kilometraje);
      setComb((c) => ({ ...c, kilometraje: j.vehiculo.kilometraje }));
      setNov((n) => ({ ...n, kilometraje: j.vehiculo.kilometraje }));
    }
  }

  useEffect(() => {
    void cargar();
  }, []);

  async function post(path: string, body: unknown, okMsg: string) {
    setError("");
    setOk("");
    const r = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      setError(j.error || "No se pudo guardar");
      return false;
    }
    if (j.mensajeAnormal) setError(j.mensajeAnormal);
    setOk(okMsg);
    await cargar();
    return true;
  }

  if (vehiculo === undefined) {
    return (
      <div>
        <AppHeader title="Mi vehículo" subtitle="Infinity Técnicos" modules={false} />
        <main className="p-4">Cargando…</main>
      </div>
    );
  }

  if (!vehiculo) {
    return (
      <div>
        <AppHeader title="Mi vehículo" subtitle="Infinity Técnicos" modules={false} />
        <main className="max-w-xl mx-auto p-4">
          <h1 className="text-lg font-semibold">Mi vehículo</h1>
          <p className="text-sm text-slate-600 mt-2">No tiene un vehículo asignado.</p>
          <Link href="/tecnico" className="text-infinity-700 text-sm">
            Volver a mis órdenes
          </Link>
        </main>
      </div>
    );
  }

  const bloqueado = vehiculo.bloqueadoCampo || vehiculo.estado === "FUERA_SERVICIO";
  const totalGas = Number((comb.galones * comb.precioPorGalon).toFixed(2));
  const estadoColor =
    vehiculo.estadoClave === "operativo"
      ? "bg-emerald-50 border-emerald-300 text-emerald-900"
      : vehiculo.estadoClave === "mantenimiento"
        ? "bg-amber-50 border-amber-300 text-amber-900"
        : "bg-red-50 border-red-300 text-red-900";

  return (
    <div>
      <AppHeader title="Mi vehículo" subtitle="Infinity Técnicos" modules={false} />
      <main className="max-w-xl mx-auto p-4 space-y-4 pb-16">
        <Link href="/tecnico" className="text-sm text-infinity-700">
          ← Mis órdenes
        </Link>
        <h1 className="text-xl font-semibold">Mi vehículo</h1>
        {error && (
          <p className="text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-xl p-3">{error}</p>
        )}
        {ok && (
          <p className="text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl p-3">{ok}</p>
        )}

        <section className="border rounded-xl p-4 bg-white space-y-1 text-sm">
          <p><span className="text-slate-500">Placa</span> · {vehiculo.placa}</p>
          <p><span className="text-slate-500">Marca</span> · {vehiculo.marca}</p>
          <p><span className="text-slate-500">Modelo</span> · {vehiculo.modelo}</p>
          <p><span className="text-slate-500">Año</span> · {vehiculo.anio}</p>
          <p><span className="text-slate-500">Color</span> · {vehiculo.color || "No registrado"}</p>
          <p><span className="text-slate-500">Kilometraje actual</span> · {vehiculo.kilometraje} km</p>
          <p><span className="text-slate-500">Estado del vehículo</span> · {vehiculo.estadoVisible}</p>
          <p>
            <span className="text-slate-500">Fecha de asignación</span> ·{" "}
            {new Date(vehiculo.fechaAsignacion).toLocaleString("es-EC")}
          </p>
          <p><span className="text-slate-500">Técnico responsable</span> · {vehiculo.tecnicoNombre}</p>
        </section>

        <section className={`border rounded-xl p-4 ${estadoColor}`}>
          <h2 className="font-semibold mb-2">Estado actual del vehículo</h2>
          <div className="grid grid-cols-3 gap-2 text-center text-xs font-medium">
            <div className={vehiculo.estadoClave === "operativo" ? "underline" : "opacity-50"}>Operativo</div>
            <div className={vehiculo.estadoClave === "mantenimiento" ? "underline" : "opacity-50"}>En mantenimiento</div>
            <div className={vehiculo.estadoClave === "fuera" ? "underline" : "opacity-50"}>Fuera de servicio</div>
          </div>
          <p className="text-xs mt-2 opacity-80">Solo operaciones puede cambiar este estado.</p>
        </section>

        {bloqueado && (
          <p className="text-sm text-red-800 bg-red-50 border border-red-200 rounded-xl p-3 font-medium">
            El vehículo está fuera de servicio y no puede registrar operaciones.
            {vehiculo.alertaNoApto ? ` ${vehiculo.alertaNoApto}` : ""}
          </p>
        )}

        {!bloqueado && (
          <>
            <section className="border rounded-xl p-4 bg-white space-y-3">
              <h2 className="font-semibold">Kilometraje</h2>
              <Campo label="Kilometraje actual">
                <input
                  type="number"
                  min={0}
                  className={`${campoControl} min-h-11`}
                  value={km}
                  onChange={(e) => setKm(Number(e.target.value))}
                />
              </Campo>
              <p className="text-xs text-slate-600">Ingresa el kilometraje que marca el odómetro del vehículo.</p>
              <button
                className="w-full min-h-11 bg-infinity-600 text-white rounded-lg font-medium"
                onClick={() => void post("/api/tecnico/vehiculo/kilometraje", { kilometraje: km }, "Kilometraje guardado")}
              >
                Guardar kilometraje
              </button>
            </section>

            <section className="border rounded-xl p-4 bg-white space-y-3">
              <h2 className="font-semibold">Gasolina y combustible</h2>
              <Campo label="Kilometraje al cargar gasolina">
                <input
                  type="number"
                  min={0}
                  className={`${campoControl} min-h-11`}
                  value={comb.kilometraje}
                  onChange={(e) => setComb({ ...comb, kilometraje: Number(e.target.value) })}
                />
              </Campo>
              <Campo label="Cantidad de galones">
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  className={`${campoControl} min-h-11`}
                  value={comb.galones || ""}
                  onChange={(e) => setComb({ ...comb, galones: Number(e.target.value) })}
                />
              </Campo>
              <Campo label="Precio por galón">
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  className={`${campoControl} min-h-11`}
                  value={comb.precioPorGalon || ""}
                  onChange={(e) => setComb({ ...comb, precioPorGalon: Number(e.target.value) })}
                />
              </Campo>
              <p className="text-sm font-medium">Total pagado: ${Number.isFinite(totalGas) ? totalGas.toFixed(2) : "0.00"}</p>
              <ParquePhotoPicker
                labelCamara="Tomar foto"
                labelGaleria="Seleccionar foto"
                help="Foto de factura de gasolina"
                max={1}
                value={factura}
                onChange={setFactura}
              />
              <button
                className="w-full min-h-11 bg-infinity-600 text-white rounded-lg font-medium"
                onClick={async () => {
                  const okSave = await post(
                    "/api/tecnico/vehiculo/combustible",
                    {
                      kilometraje: comb.kilometraje,
                      galones: comb.galones,
                      precioPorGalon: comb.precioPorGalon,
                      estacion: "NO INDICADA",
                      comprobante: factura[0]?.dataUrl,
                    },
                    factura[0] ? "Factura guardada" : "Gasolina registrada"
                  );
                  if (okSave) setFactura([]);
                }}
              >
                Registrar gasolina
              </button>
            </section>

            <section className="border rounded-xl p-4 bg-white space-y-3">
              <h2 className="font-semibold">Estado físico del vehículo</h2>
              <p className="text-sm text-slate-600">
                Utiliza esta sección para reportar golpes, rayones, daños, desperfectos o cualquier novedad visible del vehículo.
              </p>
              {!mostrarNov ? (
                <button
                  className="w-full min-h-11 border rounded-lg font-medium"
                  onClick={() => setMostrarNov(true)}
                >
                  + Reportar daño o novedad
                </button>
              ) : (
                <div className="space-y-3">
                  <h3 className="font-medium">¿Qué deseas reportar?</h3>
                  <Campo label="Tipo de novedad">
                    <select
                      className={`${campoControl} min-h-11`}
                      value={nov.tipoUi}
                      onChange={(e) => setNov({ ...nov, tipoUi: e.target.value })}
                    >
                      {NOVEDAD_REPORTE_OPCIONES.map((o) => (
                        <option key={o.ui} value={o.ui}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </Campo>
                  <Campo label="Describe el daño">
                    <textarea
                      className={`${campoControl} min-h-24`}
                      placeholder="Ejemplo: Rayón profundo en puerta delantera derecha."
                      value={nov.descripcion}
                      onChange={(e) => setNov({ ...nov, descripcion: e.target.value })}
                    />
                  </Campo>
                  <Campo label="¿El vehículo puede circular?">
                    <select
                      className={`${campoControl} min-h-11`}
                      value={nov.puedeCircular}
                      onChange={(e) => setNov({ ...nov, puedeCircular: e.target.value as "si" | "no" })}
                    >
                      <option value="si">Sí</option>
                      <option value="no">No</option>
                    </select>
                  </Campo>
                  <p className="text-xs text-slate-600">
                    Fotografía el daño desde diferentes ángulos para dejar evidencia.
                  </p>
                  <ParquePhotoPicker
                    labelCamara="Tomar fotografías"
                    labelGaleria="Seleccionar fotografías"
                    max={6}
                    value={fotosNov}
                    onChange={setFotosNov}
                  />
                  <button
                    className="w-full min-h-11 bg-infinity-600 text-white rounded-lg font-medium"
                    onClick={async () => {
                      if (!nov.descripcion.trim()) {
                        setError("Describa el daño.");
                        return;
                      }
                      const okSave = await post(
                        "/api/tecnico/vehiculo/novedad",
                        {
                          tipo: nov.tipoUi,
                          descripcion: nov.descripcion,
                          puedeCircular: nov.puedeCircular !== "no",
                          kilometraje: nov.kilometraje || vehiculo.kilometraje,
                          fotos: fotosNov.map((f) => f.dataUrl),
                        },
                        "Reporte guardado correctamente"
                      );
                      if (okSave) {
                        setFotosNov([]);
                        setNov((n) => ({ ...n, descripcion: "", puedeCircular: "si" }));
                        setMostrarNov(false);
                      }
                    }}
                  >
                    Guardar reporte
                  </button>
                </div>
              )}
            </section>

            <section className="border rounded-xl p-4 bg-white space-y-3">
              <h2 className="font-semibold">Inspección</h2>
              {INSPECCION_ITEMS.map((i) => (
                <label key={i.key} className="flex gap-2 text-sm min-h-10 items-center">
                  <input
                    type="checkbox"
                    checked={items[i.key] !== false}
                    onChange={(e) => setItems({ ...items, [i.key]: e.target.checked })}
                  />
                  {i.label}
                </label>
              ))}
              <Campo label="Porcentaje de gasolina en el tanque">
                <input
                  type="number"
                  className={`${campoControl} min-h-11`}
                  value={combustiblePct}
                  onChange={(e) => setCombustiblePct(Number(e.target.value))}
                />
              </Campo>
              <ParquePhotoPicker
                labelCamara="Tomar fotografías"
                labelGaleria="Seleccionar fotografías"
                max={6}
                value={fotosInsp}
                onChange={setFotosInsp}
              />
              <button
                className="w-full min-h-11 bg-infinity-600 text-white rounded-lg font-medium"
                onClick={async () => {
                  const okSave = await post(
                    "/api/tecnico/vehiculo/inspeccion",
                    {
                      kilometraje: km,
                      combustible: combustiblePct,
                      items,
                      fotos: fotosInsp.map((f) => f.dataUrl),
                    },
                    "Inspección guardada"
                  );
                  if (okSave) setFotosInsp([]);
                }}
              >
                Enviar inspección
              </button>
            </section>
          </>
        )}

        <section className="border rounded-xl p-4 bg-white space-y-3">
          <h2 className="font-semibold">Historial</h2>
          {historial.length === 0 && <p className="text-sm text-slate-500">Sin registros todavía.</p>}
          <ul className="space-y-2">
            {historial.map((e) => (
              <li key={e.id} className="border rounded-lg p-2 text-sm">
                <p className="font-medium">
                  {TIPO_HIST[e.tipo as keyof typeof TIPO_HIST] || e.titulo}
                </p>
                <p className="text-xs text-slate-500">
                  {new Date(e.fecha).toLocaleDateString("es-EC")} · {new Date(e.fecha).toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit" })}
                </p>
                <p>{e.descripcion}</p>
                {e.estado && <p className="text-xs">Estado: {TIPO_NOVEDAD_VEH_LABELS[e.estado as keyof typeof TIPO_NOVEDAD_VEH_LABELS] || e.estado}</p>}
                {e.tecnicoNombre && <p className="text-xs">Técnico: {e.tecnicoNombre}</p>}
                {e.fotos.length > 0 && (
                  <button
                    type="button"
                    className="text-infinity-700 text-xs underline mt-1"
                    onClick={() => setViewer(e.fotos[0].url)}
                  >
                    Ver fotografías
                  </button>
                )}
                {e.tipo === "NOVEDAD" && e.fotos.length > 0 && (
                  <div className="flex gap-1 mt-1 flex-wrap">
                    {e.fotos.map((f) => (
                      <button key={f.id} type="button" onClick={() => setViewer(f.url)}>
                        <img src={f.url} alt="" className="w-14 h-14 object-cover rounded border" />
                      </button>
                    ))}
                  </div>
                )}
                {e.tipo === "GASOLINA" && e.fotos.length > 0 && (
                  <div className="mt-1">
                    <img
                      src={e.fotos[0].url}
                      alt="Factura"
                      className="w-20 h-20 object-cover rounded border cursor-pointer"
                      onClick={() => setViewer(e.fotos[0].url)}
                    />
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      </main>
      {viewer && (
        <button
          type="button"
          className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
          onClick={() => setViewer(null)}
        >
          <img src={viewer} alt="" className="max-w-full max-h-full rounded" />
        </button>
      )}
    </div>
  );
}
