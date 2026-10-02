"use client";

import { use, useEffect, useState } from "react";
import { BrandLogo } from "@/components/BrandLogo";

type Estado = "cargando" | "formulario" | "gracias" | "respondida" | "error";

export default function EncuestaPublicaPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const [estado, setEstado] = useState<Estado>("cargando");
  const [mensaje, setMensaje] = useState("");
  const [ratingGeneral, setRatingGeneral] = useState(0);
  const [ratingTecnico, setRatingTecnico] = useState(0);
  const [solucionado, setSolucionado] = useState("");
  const [comentario, setComentario] = useState("");
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    let activo = true;
    fetch(`/api/satisfaccion/public/${encodeURIComponent(token)}`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!activo) return;
        if (!res.ok) {
          setMensaje(data.error || "No encontramos esta encuesta");
          setEstado("error");
          return;
        }
        setEstado(data.respondida ? "respondida" : "formulario");
      })
      .catch(() => {
        if (!activo) return;
        setMensaje("No se pudo abrir la encuesta");
        setEstado("error");
      });
    return () => {
      activo = false;
    };
  }, [token]);

  async function enviar(event: React.FormEvent) {
    event.preventDefault();
    setEnviando(true);
    setMensaje("");
    const res = await fetch(`/api/satisfaccion/public/${encodeURIComponent(token)}/answer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ratingGeneral, ratingTecnico, solucionado, comentario }),
    });
    const data = await res.json().catch(() => ({}));
    setEnviando(false);
    if (!res.ok) {
      setMensaje(data.error || "No se pudo guardar la respuesta");
      if (res.status === 409) setEstado("respondida");
      return;
    }
    setEstado("gracias");
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-800">
      <div className="mx-auto w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex justify-center">
          <BrandLogo variant="hero" className="mb-2 shadow-none" />
        </div>
        <h1 className="mt-3 text-center text-2xl font-semibold">Gracias por permitirnos atenderte.</h1>
        <p className="mt-2 text-center text-slate-600">Queremos conocer tu experiencia.</p>
        {estado === "cargando" && <p className="mt-8 text-sm text-slate-500">Cargando encuesta…</p>}
        {estado === "error" && <p className="mt-8 text-sm text-red-700">{mensaje}</p>}
        {estado === "respondida" && (
          <p className="mt-8 text-sm text-slate-700">Esta encuesta ya fue respondida. Gracias por tu opinión.</p>
        )}
        {estado === "gracias" && (
          <div className="mt-8">
            <p className="text-lg font-medium">¡Gracias por tu opinión!</p>
            <p className="mt-2 text-slate-600">Tu evaluación nos ayuda a mejorar nuestro servicio técnico.</p>
          </div>
        )}
        {estado === "formulario" && (
          <form onSubmit={enviar} className="mt-8 space-y-6">
            <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
              Para calificar, toque las estrellas. Una estrella es la nota más baja y cinco estrellas es la más alta.
            </p>
            <fieldset>
              <legend className="text-sm font-medium">¿Qué tan satisfecho está con el servicio técnico recibido?</legend>
              <Estrellas valor={ratingGeneral} onChange={setRatingGeneral} nombre="general" />
            </fieldset>
            <fieldset>
              <legend className="text-sm font-medium">¿El técnico solucionó su requerimiento?</legend>
              <div className="mt-3 grid gap-2">
                {[
                  ["COMPLETAMENTE", "Completamente"],
                  ["PARCIALMENTE", "Parcialmente"],
                  ["NO", "No"],
                ].map(([valor, etiqueta]) => (
                  <label key={valor} className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="solucionado"
                      value={valor}
                      checked={solucionado === valor}
                      onChange={() => setSolucionado(valor)}
                      required
                    />
                    {etiqueta}
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend className="text-sm font-medium">¿Cómo califica la atención del técnico?</legend>
              <Estrellas valor={ratingTecnico} onChange={setRatingTecnico} nombre="tecnico" />
            </fieldset>
            <label className="block text-sm font-medium">
              ¿Desea dejarnos un comentario?
              <textarea
                className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                maxLength={1000}
                rows={4}
                value={comentario}
                onChange={(event) => setComentario(event.target.value)}
              />
            </label>
            {mensaje && <p className="text-sm text-red-700">{mensaje}</p>}
            <button
              type="submit"
              disabled={enviando || ratingGeneral < 1 || ratingTecnico < 1}
              className="w-full rounded-lg bg-infinity-700 px-4 py-3 text-sm font-medium text-white disabled:opacity-50"
            >
              {enviando ? "Enviando…" : "Enviar evaluación"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}

function Estrellas({
  valor,
  onChange,
  nombre,
}: {
  valor: number;
  onChange: (n: number) => void;
  nombre: string;
}) {
  const etiqueta = ETIQUETA_ESTRELLA[valor] || "Elija de 1 a 5";
  return (
    <div className="mt-3">
      <div className="grid grid-cols-5 gap-2" role="radiogroup" aria-label={nombre}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            aria-label={`${n} estrellas, ${ETIQUETA_ESTRELLA[n]}`}
            aria-pressed={valor === n}
            onClick={() => onChange(n)}
            className={`flex h-14 w-full flex-col items-center justify-center rounded-xl border text-lg leading-none ${
              n <= valor ? "border-amber-400 bg-amber-50 text-amber-500" : "border-slate-200 text-slate-300"
            }`}
          >
            <span aria-hidden>★</span>
            <span className="mt-1 text-[11px] font-medium text-slate-500">{n}</span>
          </button>
        ))}
      </div>
      <p className="mt-2 text-sm text-slate-600">
        {valor > 0 ? `${valor} de 5 · ${etiqueta}` : "Toque una estrella para elegir su calificación."}
      </p>
    </div>
  );
}

const ETIQUETA_ESTRELLA: Record<number, string> = {
  1: "Muy insatisfecho",
  2: "Insatisfecho",
  3: "Regular",
  4: "Satisfecho",
  5: "Muy satisfecho",
};
