"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import SignaturePad from "signature_pad";
import { fetchWithRetry } from "@/lib/compress-image";
import {
  mensajeCedulaInvalida,
  normalizarCedula,
  validarCedulaEcuatoriana,
} from "@/lib/cedula-ec";
import { inputMayusculasClass } from "@/lib/mayusculas";
import {
  LABEL_CHECKBOX_ACEPTACION,
  TEXTO_ACEPTACION_SOPORTE,
} from "@/lib/aceptacion-soporte";

interface SignatureCaptureProps {
  ticketId: string;
  existing?: {
    imagenUrl: string;
    imagenSrc?: string;
    nombreCliente: string;
    cedula: string;
    aceptacionCondiciones?: boolean;
    textoAceptacion?: string | null;
  } | null;
  clienteNombre: string;
  clienteCedula: string;
  onSaved: () => void;
}

/**
 * Firma del cliente. Conserva trazos al redimensionar (evita que el canvas
 * se borre al abrir teclado / rotar / aceptar condiciones).
 */
export function SignatureCapture({
  ticketId,
  existing,
  clienteNombre,
  clienteCedula,
  onSaved,
}: SignatureCaptureProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const padRef = useRef<SignaturePad | null>(null);
  const lastSizeRef = useRef({ w: 0, h: 0 });
  const [nombre, setNombre] = useState(clienteNombre);
  const [cedula, setCedula] = useState(clienteCedula);
  const [aceptaCondiciones, setAceptaCondiciones] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const resizeCanvas = useCallback((pad: SignaturePad) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const cssW = Math.max(1, Math.floor(canvas.offsetWidth));
    const cssH = Math.max(1, Math.floor(canvas.offsetHeight));
    if (cssW < 2 || cssH < 2) return;

    if (lastSizeRef.current.w === cssW && lastSizeRef.current.h === cssH) {
      return;
    }

    // Preservar trazos antes de cambiar el bitmap del canvas
    const data = pad.isEmpty() ? null : pad.toData();

    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    canvas.width = cssW * ratio;
    canvas.height = cssH * ratio;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(ratio, ratio);
    }
    lastSizeRef.current = { w: cssW, h: cssH };

    pad.clear();
    if (data && data.length > 0) {
      pad.fromData(data);
    }
  }, []);

  useEffect(() => {
    if (!canvasRef.current || existing) return;

    const canvas = canvasRef.current;
    const pad = new SignaturePad(canvas, {
      backgroundColor: "rgb(255, 255, 255)",
      penColor: "rgb(0, 0, 0)",
      minWidth: 0.8,
      maxWidth: 2.2,
    });
    padRef.current = pad;
    lastSizeRef.current = { w: 0, h: 0 };

    const apply = () => resizeCanvas(pad);
    apply();

    // Debounce: teclado móvil dispara resize en ráfagas
    let timer: ReturnType<typeof setTimeout> | null = null;
    function onWindowResize() {
      if (timer) clearTimeout(timer);
      timer = setTimeout(apply, 120);
    }

    window.addEventListener("resize", onWindowResize);
    window.addEventListener("orientationchange", onWindowResize);

    const ro =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => {
            if (timer) clearTimeout(timer);
            timer = setTimeout(apply, 80);
          })
        : null;
    if (ro) ro.observe(canvas.parentElement || canvas);

    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener("resize", onWindowResize);
      window.removeEventListener("orientationchange", onWindowResize);
      ro?.disconnect();
      pad.off();
      padRef.current = null;
    };
  }, [existing, resizeCanvas]);

  async function guardar() {
    if (!padRef.current || padRef.current.isEmpty()) {
      setError("Por favor firme en el área blanca");
      return;
    }

    if (!aceptaCondiciones) {
      setError("Debe marcar la casilla de aceptación de condiciones para continuar");
      return;
    }

    const cedulaNorm = normalizarCedula(cedula);
    if (!validarCedulaEcuatoriana(cedulaNorm)) {
      setError(mensajeCedulaInvalida());
      return;
    }

    setLoading(true);
    setError("");
    const imagen = padRef.current.toDataURL("image/png");

    const { leerGpsActual } = await import("@/lib/gps-client");
    const gps = await leerGpsActual({ timeoutMs: 8000, maximumAgeMs: 60_000 });

    const res = await fetchWithRetry(`/api/tickets/${ticketId}/medicion`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firma: {
          nombreCliente: nombre,
          cedula: cedulaNorm,
          imagen,
          lat: gps?.lat ?? null,
          lng: gps?.lng ?? null,
          aceptacionCondiciones: true,
        },
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "No se pudo guardar la firma");
      setLoading(false);
      return;
    }

    setLoading(false);
    onSaved();
  }

  if (existing) {
    return (
      <div className="bg-white rounded-xl border p-4 space-y-3">
        <h3 className="font-semibold">Firma registrada</h3>
        <p className="text-sm text-slate-600">
          {existing.nombreCliente} — {existing.cedula}
        </p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={existing.imagenSrc || existing.imagenUrl}
          alt="Firma"
          className="border rounded-lg max-h-32 bg-white"
        />
        {existing.aceptacionCondiciones && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900 space-y-2">
            <p className="font-medium">✓ Condiciones aceptadas por el cliente</p>
            <p className="text-xs leading-relaxed text-emerald-800/90">
              {existing.textoAceptacion || TEXTO_ACEPTACION_SOPORTE}
            </p>
            <p className="text-xs font-medium">{LABEL_CHECKBOX_ACEPTACION}</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border p-4 space-y-3">
      <h3 className="font-semibold">Firma digital del cliente</h3>

      <div className="grid grid-cols-2 gap-3">
        <input
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Nombre cliente"
          className={`px-3 py-2 border rounded-lg text-sm ${inputMayusculasClass}`}
        />
        <input
          value={cedula}
          onChange={(e) => setCedula(e.target.value)}
          placeholder="Cédula"
          className="px-3 py-2 border rounded-lg text-sm"
        />
      </div>

      <canvas
        ref={canvasRef}
        className="w-full h-44 border-2 border-dashed border-slate-300 rounded-xl touch-none bg-white"
      />
      <p className="text-[11px] text-slate-500">
        Firme con el dedo en el área blanca. Use Limpiar solo si desea volver a firmar.
      </p>

      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-2">
        <p className="text-xs font-semibold text-amber-900 uppercase tracking-wide">
          Aceptación de condiciones
        </p>
        <p className="text-xs leading-relaxed text-slate-700">{TEXTO_ACEPTACION_SOPORTE}</p>
        <label className="flex items-start gap-2.5 cursor-pointer text-sm text-slate-800">
          <input
            type="checkbox"
            checked={aceptaCondiciones}
            onChange={(e) => {
              setAceptaCondiciones(e.target.checked);
              if (e.target.checked) setError("");
            }}
            className="mt-0.5 w-4 h-4 rounded shrink-0"
          />
          <span className="leading-snug font-medium">{LABEL_CHECKBOX_ACEPTACION}</span>
        </label>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => {
            padRef.current?.clear();
            setError("");
          }}
          className="flex-1 py-2 border rounded-lg text-sm"
        >
          Limpiar
        </button>
        <button
          type="button"
          onClick={() => void guardar()}
          disabled={loading || !aceptaCondiciones}
          className="flex-1 py-2 bg-infinity-600 text-white rounded-lg text-sm font-medium disabled:opacity-50"
        >
          {loading ? "Guardando..." : "Guardar firma"}
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
