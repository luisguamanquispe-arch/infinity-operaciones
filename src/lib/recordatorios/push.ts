import "server-only";
import { prisma } from "@/lib/prisma";
import { clasificarFalloPush } from "./reglas";

export function vapidPublicKey(): string | null {
  const k = process.env.VAPID_PUBLIC_KEY?.trim();
  return k && k.length > 20 ? k : null;
}

function vapidPrivateKey(): string | null {
  const k = process.env.VAPID_PRIVATE_KEY?.trim();
  return k && k.length > 20 ? k : null;
}

export function pushConfigurado(): boolean {
  return Boolean(vapidPublicKey() && vapidPrivateKey());
}

export type ResultadoPush = {
  enviados: number;
  fallidos: number;
  omitidos: number;
  errores: string[];
};

export async function enviarPushTecnico(opts: {
  tecnicoId: string;
  title: string;
  body: string;
  url: string;
}): Promise<ResultadoPush> {
  const out: ResultadoPush = { enviados: 0, fallidos: 0, omitidos: 0, errores: [] };
  if (!pushConfigurado()) {
    out.omitidos = 1;
    return out;
  }
  const subs = await prisma.tecnicoPushSubscription.findMany({
    where: { tecnicoId: opts.tecnicoId, activo: true },
  });
  if (subs.length === 0) {
    out.omitidos = 1;
    return out;
  }

  type WebPushLib = {
    setVapidDetails: (s: string, pub: string, priv: string) => void;
    sendNotification: (
      sub: { endpoint: string; keys: { p256dh: string; auth: string } },
      payload: string
    ) => Promise<unknown>;
  };
  let webpush: WebPushLib;
  try {
    const mod = await import(/* webpackIgnore: true */ "web-push");
    webpush = (mod.default ?? mod) as WebPushLib;
  } catch {
    out.omitidos = 1;
    out.errores.push("web-push no instalado");
    return out;
  }

  const mailto = process.env.VAPID_SUBJECT?.trim() || "mailto:ops@lgbsistemas.ec";
  webpush.setVapidDetails(mailto, vapidPublicKey()!, vapidPrivateKey()!);
  const payload = JSON.stringify({
    title: opts.title,
    body: opts.body,
    url: opts.url,
  });

  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload
      );
      out.enviados += 1;
    } catch (err) {
      const status = Number((err as { statusCode?: number }).statusCode || 0);
      const msg = err instanceof Error ? err.message.slice(0, 180) : "push_error";
      out.fallidos += 1;
      out.errores.push(msg);
      if (clasificarFalloPush(status) === "invalidar") {
        await prisma.tecnicoPushSubscription.update({
          where: { id: sub.id },
          data: { activo: false },
        });
      }
    }
  }
  return out;
}
