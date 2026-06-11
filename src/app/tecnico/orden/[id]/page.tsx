"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, Phone, MapPin, CalendarClock } from "lucide-react";
import { Cronometro } from "@/components/Cronometro";
import { PhotoCapture } from "@/components/PhotoCapture";
import { SignatureCapture } from "@/components/SignatureCapture";
import { TIPO_LABELS, ESTADO_LABELS, formatDateTime } from "@/lib/utils";

interface OrdenData {
  ticket: {
    id: string;
    codigo: string;
    tipo: string;
    estado: string;
    motivo: string | null;
    descripcion: string | null;
    programadoEn: string | null;
    cliente: {
      nombre: string;
      cedula: string;
      telefono: string;
      plan: string;
      direccion: string;
      sector: string;
      lat: number | null;
      lng: number | null;
      nodo: string | null;
      referencia: string | null;
      potencia: number | null;
    };
  };
  orden: {
    servicioOk: boolean;
    potenciaOk: boolean;
    fotosOk: boolean;
    clienteConforme: boolean;
    firmaOk: boolean;
    cronometro: {
      inicio: string | null;
      fin: string | null;
      activo: boolean;
      pausado: boolean;
    } | null;
    medicion: {
      rxDbm: number;
      txDbm: number;
      pingMs: number | null;
      downloadMbps: number;
      uploadMbps: number;
    } | null;
    fotografias: { tipo: string; url: string }[];
    firma: { imagenUrl: string; nombreCliente: string; cedula: string } | null;
    materiales: { inventarioId: string; cantidad: number; inventario: { nombre: string } }[];
  };
  duracionSegundos: number;
  inventario: { id: string; nombre: string; unidad: string; stock: number }[];
}

const FOTOS_ANTES = ["FACHADA", "POSTE", "NAP"];
const FOTOS_DURANTE = ["TRABAJO", "EMPALME", "CAJA_TERMINAL"];
const FOTOS_FINAL = ["ONU", "SPEEDTEST", "CLIENTE_CONFORME"];

export default function OrdenPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<OrdenData | null>(null);
  const [loading, setLoading] = useState(true);
  const [cerrando, setCerrando] = useState(false);
  const [error, setError] = useState("");

  const [medicion, setMedicion] = useState({
    rxDbm: "",
    txDbm: "",
    pingMs: "",
    downloadMbps: "",
    uploadMbps: "",
  });

  const [materiales, setMateriales] = useState<{ inventarioId: string; cantidad: string }[]>([
    { inventarioId: "", cantidad: "" },
  ]);

  const [checklist, setChecklist] = useState({
    servicioOk: false,
    potenciaOk: false,
    fotosOk: false,
    clienteConforme: false,
    firmaOk: false,
  });

  const cargar = useCallback(async () => {
    const res = await fetch(`/api/tickets/${id}`);
    const d = await res.json();
    setData(d);
    if (d.orden?.medicion) {
      setMedicion({
        rxDbm: String(d.orden.medicion.rxDbm),
        txDbm: String(d.orden.medicion.txDbm),
        pingMs: String(d.orden.medicion.pingMs ?? ""),
        downloadMbps: String(d.orden.medicion.downloadMbps),
        uploadMbps: String(d.orden.medicion.uploadMbps),
      });
    }
    setChecklist({
      servicioOk: d.orden.servicioOk,
      potenciaOk: d.orden.potenciaOk,
      fotosOk: d.orden.fotosOk,
      clienteConforme: d.orden.clienteConforme,
      firmaOk: d.orden.firmaOk,
    });
    setLoading(false);
  }, [id]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function guardarMedicion() {
    await fetch(`/api/tickets/${id}/medicion`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(medicion),
    });
    cargar();
  }

  async function guardarMateriales() {
    const validos = materiales.filter((m) => m.inventarioId && m.cantidad);
    if (validos.length === 0) return;
    await fetch(`/api/tickets/${id}/medicion`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ materiales: validos }),
    });
    cargar();
  }

  async function actualizarChecklist(key: keyof typeof checklist, value: boolean) {
    const updated = { ...checklist, [key]: value };
    setChecklist(updated);
    await fetch(`/api/tickets/${id}/medicion`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ checklist: updated }),
    });
  }

  async function cerrarTicket() {
    setCerrando(true);
    setError("");
    const res = await fetch(`/api/tickets/${id}/cerrar`, { method: "POST" });
    const result = await res.json();
    if (!res.ok) {
      setError(result.errores?.join(", ") || result.error);
      setCerrando(false);
      return;
    }
    router.push("/tecnico");
  }

  if (loading || !data) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-infinity-600" />
      </div>
    );
  }

  const { ticket, orden } = data;
  const fotoMap = Object.fromEntries(orden.fotografias.map((f) => [f.tipo, f]));
  const cerrado = ticket.estado === "CERRADO";

  return (
    <div className="min-h-dvh bg-slate-50 pb-8">
      <header className="bg-infinity-800 text-white px-4 py-4 sticky top-0 z-50">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <Link href="/tecnico" className="p-1 hover:bg-white/10 rounded-lg">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="font-bold">{ticket.codigo}</h1>
            <p className="text-infinity-200 text-sm">
              {TIPO_LABELS[ticket.tipo]} — {ESTADO_LABELS[ticket.estado]}
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto p-4 space-y-4">
        {ticket.programadoEn && !cerrado && (
          <section className="bg-infinity-50 border border-infinity-200 rounded-xl p-4 flex gap-3">
            <CalendarClock className="w-6 h-6 text-infinity-600 shrink-0" />
            <div>
              <p className="font-semibold text-infinity-900">Reparación programada</p>
              <p className="text-lg font-bold text-infinity-700">
                {formatDateTime(ticket.programadoEn)}
              </p>
              <p className="text-sm text-infinity-800 mt-1">
                Inicie la reparación en la fecha y hora indicadas por el supervisor.
              </p>
            </div>
          </section>
        )}

        {/* Datos del cliente */}
        <section className="bg-white rounded-xl border p-4 space-y-2">
          <h2 className="font-semibold text-lg">{ticket.cliente.nombre}</h2>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <p><span className="text-slate-500">Cédula:</span> {ticket.cliente.cedula}</p>
            <p className="flex items-center gap-1">
              <Phone className="w-3 h-3" />
              <a href={`tel:${ticket.cliente.telefono}`} className="text-infinity-600">
                {ticket.cliente.telefono}
              </a>
            </p>
            <p><span className="text-slate-500">Plan:</span> {ticket.cliente.plan}</p>
            <p><span className="text-slate-500">Sector:</span> {ticket.cliente.sector}</p>
          </div>
          <p className="text-sm flex items-start gap-1">
            <MapPin className="w-3 h-3 mt-0.5 shrink-0" />
            {ticket.cliente.direccion}
          </p>
          {ticket.cliente.referencia && (
            <p className="text-sm bg-amber-50 border border-amber-200 rounded-lg p-2">
              <span className="text-slate-500 font-medium">Referencia: </span>
              {ticket.cliente.referencia}
            </p>
          )}
          <div className="grid grid-cols-2 gap-2 text-sm pt-2 border-t">
            <p><span className="text-slate-500">Nodo:</span> {ticket.cliente.nodo || "—"}</p>
            <p><span className="text-slate-500">Potencia:</span> {ticket.cliente.potencia ? `${ticket.cliente.potencia} dBm` : "—"}</p>
          </div>
        </section>

        {/* Info técnica */}
        <section className="bg-white rounded-xl border p-4 space-y-2">
          <h3 className="font-semibold">Información técnica</h3>
          <p className="text-sm"><span className="text-slate-500">Motivo:</span> {ticket.motivo}</p>
          <p className="text-sm"><span className="text-slate-500">Descripción:</span> {ticket.descripcion}</p>
        </section>

        {!cerrado && (
          <>
            <Cronometro
              ticketId={id}
              cronometro={orden.cronometro}
              duracionInicial={data.duracionSegundos}
              onUpdate={cargar}
            />

            {/* Fotos antes */}
            <section className="bg-white rounded-xl border p-4 space-y-2">
              <h3 className="font-semibold">Evidencia — Antes de iniciar</h3>
              {FOTOS_ANTES.map((t) => (
                <PhotoCapture
                  key={t}
                  ticketId={id}
                  tipo={t}
                  existing={fotoMap[t]}
                  onUploaded={cargar}
                />
              ))}
            </section>

            <section className="bg-white rounded-xl border p-4 space-y-2">
              <h3 className="font-semibold">Evidencia — Durante reparación</h3>
              {FOTOS_DURANTE.map((t) => (
                <PhotoCapture
                  key={t}
                  ticketId={id}
                  tipo={t}
                  existing={fotoMap[t]}
                  onUploaded={cargar}
                />
              ))}
            </section>

            {/* Medición */}
            <section className="bg-white rounded-xl border p-4 space-y-3">
              <h3 className="font-semibold">Medición técnica</h3>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { key: "rxDbm", label: "Potencia RX (dBm)" },
                  { key: "txDbm", label: "Potencia TX (dBm)" },
                  { key: "pingMs", label: "Ping (ms)" },
                  { key: "downloadMbps", label: "Descarga (Mbps)" },
                  { key: "uploadMbps", label: "Subida (Mbps)" },
                ].map(({ key, label }) => (
                  <div key={key}>
                    <label className="text-xs text-slate-500">{label}</label>
                    <input
                      type="number"
                      step="any"
                      value={medicion[key as keyof typeof medicion]}
                      onChange={(e) =>
                        setMedicion({ ...medicion, [key]: e.target.value })
                      }
                      className="w-full px-3 py-2 border rounded-lg text-sm mt-0.5"
                    />
                  </div>
                ))}
              </div>
              <button
                onClick={guardarMedicion}
                className="w-full py-2 bg-infinity-600 text-white rounded-lg text-sm font-medium"
              >
                Guardar medición
              </button>
            </section>

            {/* Materiales */}
            <section className="bg-white rounded-xl border p-4 space-y-3">
              <h3 className="font-semibold">Material utilizado</h3>
              {materiales.map((m, i) => (
                <div key={i} className="flex gap-2">
                  <select
                    value={m.inventarioId}
                    onChange={(e) => {
                      const updated = [...materiales];
                      updated[i].inventarioId = e.target.value;
                      setMateriales(updated);
                    }}
                    className="flex-1 px-3 py-2 border rounded-lg text-sm"
                  >
                    <option value="">Seleccionar material</option>
                    {data.inventario.map((inv) => (
                      <option key={inv.id} value={inv.id}>
                        {inv.nombre} (stock: {inv.stock} {inv.unidad})
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    placeholder="Cant."
                    value={m.cantidad}
                    onChange={(e) => {
                      const updated = [...materiales];
                      updated[i].cantidad = e.target.value;
                      setMateriales(updated);
                    }}
                    className="w-20 px-3 py-2 border rounded-lg text-sm"
                  />
                </div>
              ))}
              <button
                onClick={() => setMateriales([...materiales, { inventarioId: "", cantidad: "" }])}
                className="text-sm text-infinity-600"
              >
                + Agregar material
              </button>
              <button
                onClick={guardarMateriales}
                className="w-full py-2 border border-infinity-600 text-infinity-600 rounded-lg text-sm font-medium"
              >
                Descontar del inventario
              </button>
            </section>

            {/* Fotos final */}
            <section className="bg-white rounded-xl border p-4 space-y-2">
              <h3 className="font-semibold">Evidencia — Al finalizar</h3>
              {FOTOS_FINAL.map((t) => (
                <PhotoCapture
                  key={t}
                  ticketId={id}
                  tipo={t}
                  existing={fotoMap[t]}
                  onUploaded={cargar}
                />
              ))}
            </section>

            <SignatureCapture
              ticketId={id}
              existing={orden.firma}
              clienteNombre={ticket.cliente.nombre}
              clienteCedula={ticket.cliente.cedula}
              onSaved={cargar}
            />

            {/* Checklist y cierre */}
            <section className="bg-white rounded-xl border p-4 space-y-3">
              <h3 className="font-semibold">Checklist de cierre</h3>
              {[
                { key: "servicioOk" as const, label: "Servicio funcionando" },
                { key: "potenciaOk" as const, label: "Potencia validada" },
                { key: "fotosOk" as const, label: "Fotos cargadas" },
                { key: "clienteConforme" as const, label: "Cliente conforme" },
                { key: "firmaOk" as const, label: "Firma registrada" },
              ].map(({ key, label }) => (
                <label key={key} className="flex items-center gap-3 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={checklist[key]}
                    onChange={(e) => actualizarChecklist(key, e.target.checked)}
                    className="w-4 h-4 rounded"
                  />
                  {label}
                </label>
              ))}

              {error && (
                <div className="bg-red-50 text-red-700 text-sm p-3 rounded-lg">{error}</div>
              )}

              <button
                onClick={cerrarTicket}
                disabled={cerrando}
                className="w-full py-3 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700 disabled:opacity-50"
              >
                {cerrando ? "Cerrando..." : "✅ Cerrar ticket"}
              </button>
            </section>
          </>
        )}

        {cerrado && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl text-center font-medium">
            ✅ Ticket cerrado exitosamente
          </div>
        )}
      </main>
    </div>
  );
}
