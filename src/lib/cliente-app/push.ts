import { prisma } from "@/lib/prisma";

const PLATAFORMAS = new Set(["android", "ios", "windows", "macos", "linux", "web", "unknown"]);

export async function registrarDeviceToken(opts: {
  usuarioId: string;
  token: string;
  plataforma: string;
}) {
  const token = opts.token.trim();
  if (token.length < 20 || token.length > 512) {
    throw new Error("Token de dispositivo inválido");
  }
  const plataforma = PLATAFORMAS.has(opts.plataforma) ? opts.plataforma : "unknown";

  return prisma.appClienteDeviceToken.upsert({
    where: { token },
    create: {
      usuarioId: opts.usuarioId,
      token,
      plataforma,
      activo: true,
    },
    update: {
      usuarioId: opts.usuarioId,
      plataforma,
      activo: true,
      updatedAt: new Date(),
    },
  });
}

export async function desactivarDeviceToken(usuarioId: string, token: string) {
  await prisma.appClienteDeviceToken.updateMany({
    where: { usuarioId, token },
    data: { activo: false },
  });
}

/** Envía FCM legacy si hay FCM_SERVER_KEY; si no, solo registra en log. */
export async function enviarPushAUsuario(opts: {
  usuarioId: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}): Promise<{ enviados: number; modo: "fcm" | "stub" }> {
  const tokens = await prisma.appClienteDeviceToken.findMany({
    where: { usuarioId: opts.usuarioId, activo: true },
    select: { token: true, id: true },
  });
  if (tokens.length === 0) return { enviados: 0, modo: "stub" };

  const serverKey = process.env.FCM_SERVER_KEY?.trim();
  if (!serverKey) {
    console.info(
      `[push stub] usuario=${opts.usuarioId} title="${opts.title}" body="${opts.body}" tokens=${tokens.length}`
    );
    return { enviados: 0, modo: "stub" };
  }

  let enviados = 0;
  for (const t of tokens) {
    try {
      const res = await fetch("https://fcm.googleapis.com/fcm/send", {
        method: "POST",
        headers: {
          Authorization: `key=${serverKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to: t.token,
          notification: { title: opts.title, body: opts.body },
          data: opts.data ?? {},
          priority: "high",
        }),
      });
      if (res.ok) {
        enviados += 1;
      } else {
        const errText = await res.text();
        console.warn("[fcm]", res.status, errText.slice(0, 200));
        if (res.status === 400 || res.status === 404) {
          await prisma.appClienteDeviceToken.update({
            where: { id: t.id },
            data: { activo: false },
          });
        }
      }
    } catch (err) {
      console.warn("[fcm] error", err);
    }
  }
  return { enviados, modo: "fcm" };
}

export async function notificarPushClientePorClienteId(
  clienteId: string,
  title: string,
  body: string,
  data?: Record<string, string>
) {
  const cuenta = await prisma.appClienteCuenta.findUnique({
    where: { clienteId },
    select: { usuarioId: true },
  });
  if (!cuenta) return { enviados: 0, modo: "stub" as const };
  return enviarPushAUsuario({
    usuarioId: cuenta.usuarioId,
    title,
    body,
    data,
  });
}
