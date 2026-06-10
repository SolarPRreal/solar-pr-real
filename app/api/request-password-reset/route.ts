import { NextResponse } from "next/server";
import { callWebhook, getClientIp, isSameOrigin, isValidEmail, normalizeEmail, parseJson, rateLimit } from "@/app/lib/security";

export const runtime = "nodejs";
type Payload = { email?: string };
const GENERIC = "Si el correo existe y está confirmado, recibirás instrucciones para cambiar la contraseña.";

export async function POST(request: Request) {
  try {
    if (!isSameOrigin(request)) return NextResponse.json({ ok: false, message: "Solicitud no permitida." }, { status: 403 });
    const limited = rateLimit(`reset-request:${getClientIp(request)}`, 5, 60 * 60_000);
    if (!limited.allowed) return NextResponse.json({ ok: true, message: GENERIC });
    const body = await parseJson<Payload>(request);
    const email = normalizeEmail(body.email);
    if (!isValidEmail(email)) return NextResponse.json({ ok: true, message: GENERIC });
    await callWebhook({ action: "requestPasswordReset", email }).catch(() => null);
    return NextResponse.json({ ok: true, message: GENERIC });
  } catch {
    return NextResponse.json({ ok: true, message: GENERIC });
  }
}
