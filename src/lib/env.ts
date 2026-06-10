import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL es obligatorio"),
  JWT_SECRET: z.string().min(32, "JWT_SECRET debe tener al menos 32 caracteres"),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  WHATSAPP_ENABLED: z.string().optional(),
  WHATSAPP_PHONE: z.string().optional(),
  WHATSAPP_API_TOKEN: z.string().optional(),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
  WHATSAPP_TEMPLATE_NAME: z.string().optional(),
  WHATSAPP_API_VERSION: z.string().default("v21.0"),
  UPLOAD_STORAGE: z.enum(["local", "s3"]).default("local"),
  S3_BUCKET: z.string().optional(),
  S3_REGION: z.string().optional(),
  S3_ACCESS_KEY: z.string().optional(),
  S3_SECRET_KEY: z.string().optional(),
  S3_ENDPOINT: z.string().optional(),
  S3_PUBLIC_URL: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

export function getEnv(): Env {
  if (cached) return cached;

  const isProd = process.env.NODE_ENV === "production";
  const jwtSecret =
    process.env.JWT_SECRET ||
    (isProd ? undefined : "dev-only-infinity-operaciones-secret-32chars!!");

  const parsed = envSchema.safeParse({
    ...process.env,
    JWT_SECRET: jwtSecret,
    WHATSAPP_API_VERSION: process.env.WHATSAPP_API_VERSION || "v21.0",
    UPLOAD_STORAGE: process.env.UPLOAD_STORAGE || "local",
  });

  if (!parsed.success) {
    const errors = parsed.error.flatten().fieldErrors;
    const msg = Object.entries(errors)
      .map(([k, v]) => `${k}: ${v?.join(", ")}`)
      .join("\n");
    throw new Error(`Variables de entorno inválidas:\n${msg}`);
  }

  if (isProd && parsed.data.JWT_SECRET.includes("dev-only")) {
    throw new Error("JWT_SECRET inseguro en producción. Genera uno con: openssl rand -base64 48");
  }

  cached = parsed.data;
  return cached;
}

export function getJwtSecret(): Uint8Array {
  return new TextEncoder().encode(getEnv().JWT_SECRET);
}

export function isWhatsAppEnabled(): boolean {
  return getEnv().WHATSAPP_ENABLED === "true";
}
