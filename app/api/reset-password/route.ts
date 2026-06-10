import { NextResponse } from "next/server";
import { callWebhook, getClientIp, hashPassword, isSameOrigin, isSecurePassword, isValidEmail, normalizeEmail, parseJson, rateLimit } from "@/app/lib/security";

export const runtime = "nodejs";
type Payload = { email?: string; code?: string; newPassword?: string };

export async function POST(request: Request) {
  try {
    if (!isSameOrigin(request)) return NextResponse.json({ ok: false, message: "Solicitud no permitida." }, { status: 403 });
    const limited = rateLimit(`reset:${getClientIp(request)}`, 8, 30 * 60_000);
    if (!limited.allowed) return NextResponse.json({ ok: false, message: "Demasiados intentos. Inténtalo más tarde." }, { status: 429 });
    const body = await parseJson<Payload>(request);
    const email = normalizeEmail(body.email);
    const code = String(body.code ?? "").trim().replace(/\s/g, "").slice(0, 12);
    const password = String(body.newPassword ?? "");
    if (!isValidEmail(email) || !/^\d{6}$/.test(code) || !isSecurePassword(password)) {
      return NextResponse.json({ ok: false, message: "Los datos de recuperación no son válidos." }, { status: 400 });
    }
    const { response, data } = await callWebhook({ action: "resetPassword", email, code, newPasswordHash: hashPassword(password) });
    if (!response.ok || data.ok !== true) return NextResponse.json({ ok: false, message: "El código no es válido o ha caducado." }, { status: 400 });
    return NextResponse.json({ ok: true, message: "Contraseña actualizada correctamente." });
  } catch (error) {
    console.error("Reset error:", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ ok: false, message: "No se pudo cambiar la contraseña." }, { status: 500 });
  }
}
