import { NextResponse } from "next/server";
import { SESSION_COOKIE, callWebhook, cleanText, isSameOrigin, parseJson, verifySessionToken } from "@/app/lib/security";

export const runtime = "nodejs";

type Payload = Record<string, unknown>;

function getSession(request: Request) {
  const cookie = request.headers.get("cookie") || "";
  const token = cookie.split(";").map(v => v.trim()).find(v => v.startsWith(`${SESSION_COOKIE}=`))?.slice(SESSION_COOKIE.length + 1);
  return verifySessionToken(token);
}

function numberInRange(value: unknown, min: number, max: number) {
  const n = Number(value);
  return Number.isFinite(n) && n >= min && n <= max ? n : 0;
}

export async function POST(request: Request) {
  try {
    if (!isSameOrigin(request)) return NextResponse.json({ ok: false, message: "Solicitud no permitida." }, { status: 403 });
    const session = getSession(request);
    if (!session) return NextResponse.json({ ok: false, message: "Sesión no válida." }, { status: 401 });
    const body = await parseJson<Payload>(request, 128_000);

    const record = {
      action: "saveInstallationData",
      savedAt: new Date().toISOString(),
      userEmail: session.email,
      plantName: cleanText(body.plantName, 120),
      autonomousCommunity: cleanText(body.autonomousCommunity, 80),
      province: cleanText(body.province, 80),
      peakPowerKwp: numberInRange(body.peakPowerKwp, 0, 10_000_000),
      siarStationId: cleanText(body.siarStationId, 30),
      siarStationCode: cleanText(body.siarStationCode, 30),
      siarStationName: cleanText(body.siarStationName, 160),
      analyzedDay: cleanText(body.analyzedDay, 40),
      samples: numberInRange(body.samples, 0, 1000),
      productionKwh: numberInRange(body.productionKwh, 0, 1_000_000_000),
      radiationKwhM2: numberInRange(body.radiationKwhM2, 0, 30),
      calculatedPr: numberInRange(body.calculatedPr, 0, 500),
      expectedKwh: numberInRange(body.expectedKwh, 0, 1_000_000_000),
      estimatedLossEurMonth: numberInRange(body.estimatedLossEurMonth, 0, 1_000_000_000),
      sourceFileName: cleanText(body.sourceFileName, 180),
    };
    if (!record.plantName || !record.siarStationId || record.samples !== 96) {
      return NextResponse.json({ ok: false, message: "Los datos de la lectura no son válidos." }, { status: 400 });
    }
    const { response, data } = await callWebhook(record);
    if (!response.ok || data.ok !== true) return NextResponse.json({ ok: false, message: "No se pudieron guardar los datos." }, { status: 502 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Save installation error:", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ ok: false, message: "No se pudieron guardar los datos." }, { status: 500 });
  }
}
