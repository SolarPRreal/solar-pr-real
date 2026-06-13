import { NextResponse } from "next/server";

export const runtime = "nodejs";

type ReviewRequestPayload = {
  userEmail?: string;
  userName?: string;
  userSurname?: string;
  plantName?: string;
  province?: string;
  autonomousCommunity?: string;
  peakPowerKwp?: string;
  analyzedDay?: string;
  productionKwh?: number;
  calculatedPr?: number;
  estimatedLossEurMonth?: number;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ReviewRequestPayload;

    if (!body.userEmail) {
      return NextResponse.json(
        { ok: false, message: "Falta el email del usuario." },
        { status: 400 }
      );
    }

    const webhookUrl = process.env.GOOGLE_SHEETS_WEBHOOK_URL;

    if (!webhookUrl) {
      return NextResponse.json(
        {
          ok: false,
          message: "Falta configurar GOOGLE_SHEETS_WEBHOOK_URL.",
        },
        { status: 500 }
      );
    }

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "requestReview",
        token: process.env.API_SECRET || "",
        requestedAt: new Date().toISOString(),
        ...body,
      }),
    });

    const text = await response.text();
    let data: any = {};

    try {
      data = JSON.parse(text);
    } catch {
      data = { ok: response.ok, message: text.slice(0, 300) };
    }

    if (!response.ok || data.ok === false) {
      return NextResponse.json(
        {
          ok: false,
          message: data.message || "No se pudo registrar la solicitud de revisión.",
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      ok: true,
      message:
        "Solicitud de revisión registrada. Nos pondremos en contacto contigo en breve.",
    });
  } catch (error) {
    console.error("Error solicitando revisión:", error);

    return NextResponse.json(
      { ok: false, message: "Error interno registrando la solicitud." },
      { status: 500 }
    );
  }
}
