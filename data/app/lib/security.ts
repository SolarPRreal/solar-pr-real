import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "solarpr_session";
const SESSION_TTL_SECONDS = 8 * 60 * 60;

type SessionPayload = {
  email: string;
  name: string;
  surname: string;
  exp: number;
};

type RateEntry = { count: number; resetAt: number };
const rateStore = new Map<string, RateEntry>();

function requiredSecret(name: "AUTH_PEPPER" | "SESSION_SECRET") {
  const value = process.env[name]?.trim();
  if (!value || value.length < 32) {
    throw new Error(`${name} debe estar configurado con al menos 32 caracteres.`);
  }
  return value;
}

export function normalizeEmail(value: unknown) {
  return String(value ?? "").trim().toLowerCase().slice(0, 254);
}

export function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function isSecurePassword(password: string) {
  return (
    password.length >= 12 &&
    password.length <= 128 &&
    /[a-z]/.test(password) &&
    /[A-Z]/.test(password) &&
    /\d/.test(password) &&
    /[^A-Za-z0-9]/.test(password)
  );
}

export function hashPassword(password: string) {
  return createHmac("sha256", requiredSecret("AUTH_PEPPER"))
    .update(password, "utf8")
    .digest("hex");
}

function encode(data: string) {
  return Buffer.from(data, "utf8").toString("base64url");
}

function sign(value: string) {
  return createHmac("sha256", requiredSecret("SESSION_SECRET"))
    .update(value)
    .digest("base64url");
}

export function createSessionToken(user: Omit<SessionPayload, "exp">) {
  const payload: SessionPayload = {
    ...user,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  };
  const encoded = encode(JSON.stringify(payload));
  return `${encoded}.${sign(encoded)}`;
}

export function verifySessionToken(token?: string | null): SessionPayload | null {
  if (!token) return null;
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return null;
  const expected = sign(encoded);
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as SessionPayload;
    if (!payload.email || payload.exp <= Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function getClientIp(request: Request) {
  return (
    request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const current = rateStore.get(key);
  if (!current || current.resetAt <= now) {
    rateStore.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfter: 0 };
  }
  current.count += 1;
  if (current.count > limit) {
    return { allowed: false, retryAfter: Math.ceil((current.resetAt - now) / 1000) };
  }
  return { allowed: true, retryAfter: 0 };
}

export function isSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}

export async function parseJson<T>(request: Request, maxBytes = 64_000): Promise<T> {
  const length = Number(request.headers.get("content-length") || "0");
  if (length > maxBytes) throw new Error("PAYLOAD_TOO_LARGE");
  return (await request.json()) as T;
}

export function cleanText(value: unknown, maxLength: number) {
  return String(value ?? "")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .trim()
    .slice(0, maxLength);
}

export function getWebhookUrl() {
  const raw = process.env.GOOGLE_SHEETS_WEBHOOK_URL?.trim();
  if (!raw) throw new Error("GOOGLE_SHEETS_WEBHOOK_URL no está configurada.");
  const url = new URL(raw);
  if (url.protocol !== "https:" || !["script.google.com", "script.googleusercontent.com"].includes(url.hostname)) {
    throw new Error("GOOGLE_SHEETS_WEBHOOK_URL no es una URL autorizada de Google Apps Script.");
  }
  return url.toString();
}

export async function callWebhook(payload: Record<string, unknown>) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(getWebhookUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      body: JSON.stringify(payload),
      cache: "no-store",
      signal: controller.signal,
      redirect: "follow",
    });
    const text = await response.text();
    let data: Record<string, unknown> = {};
    try { data = JSON.parse(text) as Record<string, unknown>; } catch { data = { ok: false }; }
    return { response, data };
  } finally {
    clearTimeout(timeout);
  }
}

export const sessionMaxAge = SESSION_TTL_SECONDS;
