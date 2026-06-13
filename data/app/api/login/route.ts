import { NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  callWebhook,
  createSessionToken,
  getClientIp,
  hashPassword,
  isSameOrigin,
  isValidEmail,
  normalizeEmail,
  parseJson,
  rateLimit,
  sessionMaxAge,
} from "@/app/lib/security";

export const runtime = "nodejs";

type LoginBody = { email?: string; password?: string };

export async function POST(request: Request) {
  try {
    if (!isSameOrigin(request)) return NextResponse.json({ ok: false, message: "Solicitud no permitida." }, { status: 403 });
    const ip = getClientIp(request);
    const limited = rateLimit(`login:${ip}`, 8, 15 * 60_000);
    if (!limited.allowed) return NextResponse.json({ ok: false, message: "Demasiados intentos. Inténtalo más tarde." }, { status: 429, headers: { "Retry-After": String(limited.retryAfter) } });

    const body = await parseJson<LoginBody>(request);
    const email = normalizeEmail(body.email);
    const password = String(body.password ?? "");
    if (!isValidEmail(email) || !password || password.length > 128) {
      return NextResponse.json({ ok: false, message: "Correo o contraseña incorrectos." }, { status: 401 });
    }

    const { response, data } = await callWebhook({ action: "login", email, passwordHash: hashPassword(password) });
    if (!response.ok || data.ok !== true) {
      return NextResponse.json({ ok: false, message: "Correo o contraseña incorrectos." }, { status: 401 });
    }

    const rawUser = (data.user || {}) as Record<string, unknown>;
    const user = {
      name: String(rawUser.name ?? "").slice(0, 80),
      surname: String(rawUser.surname ?? "").slice(0, 120),
      email,
      plantName: String(rawUser.plantName ?? "Instalación FV").slice(0, 120),
      autonomousCommunity: String(rawUser.autonomousCommunity ?? "Comunidad de Madrid").slice(0, 80),
      province: String(rawUser.province ?? "Madrid").slice(0, 80),
      siarStationId: String(rawUser.siarStationId ?? "").slice(0, 30),
      peakPower: String(rawUser.peakPower ?? "100").slice(0, 20),
    };

    const result = NextResponse.json({ ok: true, user });
    result.cookies.set(SESSION_COOKIE, createSessionToken({ email, name: user.name, surname: user.surname }), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: sessionMaxAge,
    });
    return result;
  } catch (error) {
    console.error("Login error:", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ ok: false, message: "No se pudo iniciar sesión." }, { status: 500 });
  }
}
