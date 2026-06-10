import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { getEnv } from "./env";

export async function saveUpload(
  buffer: Buffer,
  ticketId: string,
  filename: string
): Promise<string> {
  const env = getEnv();

  if (env.UPLOAD_STORAGE === "s3") {
    return saveToS3(buffer, ticketId, filename);
  }

  const uploadDir = path.join(process.cwd(), "public", "uploads", ticketId);
  await mkdir(uploadDir, { recursive: true });
  const filepath = path.join(uploadDir, filename);
  await writeFile(filepath, buffer);
  return `/uploads/${ticketId}/${filename}`;
}

async function saveToS3(
  buffer: Buffer,
  ticketId: string,
  filename: string
): Promise<string> {
  const env = getEnv();
  const { S3_BUCKET, S3_REGION, S3_ACCESS_KEY, S3_SECRET_KEY, S3_ENDPOINT, S3_PUBLIC_URL } =
    env;

  if (!S3_BUCKET || !S3_ACCESS_KEY || !S3_SECRET_KEY) {
    throw new Error("Configuración S3 incompleta. Revisa S3_BUCKET, S3_ACCESS_KEY, S3_SECRET_KEY");
  }

  const key = `uploads/${ticketId}/${filename}`;
  const contentType = filename.endsWith(".png") ? "image/png" : "image/jpeg";

  const client = new S3Client({
    region: S3_REGION || "auto",
    endpoint: S3_ENDPOINT,
    credentials: {
      accessKeyId: S3_ACCESS_KEY,
      secretAccessKey: S3_SECRET_KEY,
    },
    forcePathStyle: !!S3_ENDPOINT,
  });

  await client.send(
    new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    })
  );

  if (S3_PUBLIC_URL) {
    return `${S3_PUBLIC_URL.replace(/\/$/, "")}/${key}`;
  }
  if (S3_ENDPOINT) {
    return `${S3_ENDPOINT.replace(/\/$/, "")}/${S3_BUCKET}/${key}`;
  }
  return `https://${S3_BUCKET}.s3.${S3_REGION || "us-east-1"}.amazonaws.com/${key}`;
}
