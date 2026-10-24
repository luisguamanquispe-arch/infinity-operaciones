"use client";

import { useEffect, useState } from "react";

export function TecnicoPushOptIn() {
  const [estado, setEstado] = useState<"off" | "on" | "denied" | "na">("off");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window) || !("serviceWorker" in navigator)) {
      setEstado("na");
      return;
    }
    if (Notification.permission === "denied") setEstado("denied");
    else if (Notification.permission === "granted") setEstado("on");
  }, []);

  async function activar() {
    setMsg("");
    if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      setEstado("na");
      setMsg("Este dispositivo no admite avisos push del navegador.");
      return;
    }
    const perm = await Notification.requestPermission();
    if (perm !== "granted") {
      setEstado(perm === "denied" ? "denied" : "off");
      return;
    }
    const vapid = await fetch("/api/tecnico/notificaciones/push", { credentials: "include" });
    const json = await vapid.json();
    if (!json.publicKey) {
      setMsg("Faltan claves VAPID en el servidor. Los avisos internos siguen activos.");
      return;
    }
    const reg = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(json.publicKey),
    });
    const raw = sub.toJSON();
    const res = await fetch("/api/tecnico/notificaciones/push", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: raw.endpoint, keys: raw.keys }),
    });
    if (!res.ok) {
      setMsg("No se pudo guardar la suscripción.");
      return;
    }
    setEstado("on");
  }

  if (estado === "na") {
    return <p className="text-[11px] text-slate-500">Push no disponible. La campana interna sí funciona.</p>;
  }
  if (estado === "denied") {
    return <p className="text-[11px] text-slate-500">Permiso push denegado. Los avisos internos siguen activos.</p>;
  }
  if (estado === "on") {
    return <p className="text-[11px] text-emerald-700">Avisos push activados.</p>;
  }
  return (
    <div>
      <button
        type="button"
        onClick={() => void activar()}
        className="text-xs font-medium text-infinity-700"
      >
        Activar avisos del navegador
      </button>
      {msg && <p className="text-[11px] text-amber-700 mt-1">{msg}</p>}
    </div>
  );
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}
