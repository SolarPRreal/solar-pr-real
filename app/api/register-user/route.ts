import { NextResponse } from "next/server";
import {
  callWebhook,
  cleanText,
  getClientIp,
  hashPassword,
  isSameOrigin,
  isSecurePassword,
  isValidEmail,
  normalizeEmail,
  parseJson,
  rateLimit,
} from "@/app/lib/security";

export const runtime = "nodejs";

type RegisterPayload = {
  name?: string;
  surname?: string;
  email?: string;
  password?: string;
  rgpdAccepted?: boolean;
  privacyVersion?: string;
};

export async function POST(request: Request) {
  try {
    if (!isSameOrigin(request)) return NextResponse.json({ ok: false, message: "Solicitud no permitida." }, { status: 403 });
    const ip = getClientIp(request);
    const limited = rateLimit(`register:${ip}`, 5, 60 * 60_000);
    if (!limited.allowed) return NextResponse.json({ ok: false, message: "Demasiados intentos de registro. Inténtalo más tarde." }, { status: 429, headers: { "Retry-After": String(limited.retryAfter) } });

    const body = await parseJson<RegisterPayload>(request);
    const name = cleanText(body.name, 80);
    const surname = cleanText(body.surname, 120);
    const email = normalizeEmail(body.email);
    const password = String(body.password ?? "");

    if (!name || !surname || !isValidEmail(email) || !password) {
      return NextResponse.json({ ok: false, message: "Revisa los campos obligatorios." }, { status: 400 });
    }
    if (!isSecurePassword(password)) {
      return NextResponse.json({ ok: false, message: "La contraseña debe tener entre 12 y 128 caracteres e incluir minúscula, mayúscula, número y carácter especial." }, { status: 400 });
    }
    if (body.rgpdAccepted !== true) {
      return NextResponse.json({ ok: false, message: "Debes aceptar la política de privacidad para crear la cuenta." }, { status: 400 });
    }

    const registeredAt = new Date().toISOString();
    const { response, data } = await callWebhook({
      action: "registerUser",
      registeredAt,
      name,
      surname,
      email,
      passwordHash: hashPassword(password),
      emailConfirmed: false,
      privacyAcceptedAt: registeredAt,
      privacyVersion: cleanText(body.privacyVersion || "2026-06-09", 32),
      source: "SolarPR Monitor TFM",
    });

    if (!response.ok || data.ok !== true) {
      const duplicate = data.code === "EMAIL_EXISTS";
      return NextResponse.json({ ok: false, message: duplicate ? "Ese correo ya está registrado." : "No se pudo completar el registro." }, { status: duplicate ? 409 : 502 });
    }

    return NextResponse.json({ ok: true, message: "Registro recibido. Revisa tu correo para confirmar la cuenta." });
  } catch (error) {
    console.error("Register error:", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ ok: false, message: "No se pudo completar el registro." }, { status: 500 });
  }
}
