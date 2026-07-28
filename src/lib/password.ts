import bcrypt from "bcryptjs";

export function normalizeEmail(raw: unknown): string {
  return String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");
}

export function normalizePassword(raw: unknown): string {
  return String(raw ?? "").trim();
}

export function passwordHashLooksValid(hash: string | null | undefined): boolean {
  return !!hash && /^\$2[aby]\$\d{2}\$/.test(hash);
}

export async function hashPassword(raw: unknown): Promise<string> {
  const password = normalizePassword(raw);
  if (password.length < 6) {
    throw new Error("PASSWORD_TOO_SHORT");
  }
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(raw: unknown, hash: string | null | undefined): Promise<boolean> {
  const password = normalizePassword(raw);
  if (!password || !passwordHashLooksValid(hash)) return false;
  return bcrypt.compare(password, hash!);
}
