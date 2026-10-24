import { prisma } from "@/lib/prisma";
import {
  CONFIG_RECORDATORIO_DEFAULT,
  normalizarConfig,
  type ConfigRecordatorio,
} from "./reglas";

const ID = "default";

export async function obtenerConfigRecordatorio(): Promise<ConfigRecordatorio> {
  try {
    const row = await prisma.recordatorioTareaConfig.findUnique({ where: { id: ID } });
    if (!row) {
      await prisma.recordatorioTareaConfig.create({
        data: { id: ID, ...CONFIG_RECORDATORIO_DEFAULT },
      });
      return { ...CONFIG_RECORDATORIO_DEFAULT };
    }
    return normalizarConfig(row);
  } catch {
    return { ...CONFIG_RECORDATORIO_DEFAULT };
  }
}

export async function guardarConfigRecordatorio(
  patch: Partial<ConfigRecordatorio>
): Promise<ConfigRecordatorio> {
  const actual = await obtenerConfigRecordatorio();
  const next = normalizarConfig({ ...actual, ...patch });
  await prisma.recordatorioTareaConfig.upsert({
    where: { id: ID },
    create: { id: ID, ...next },
    update: { ...next },
  });
  return next;
}
