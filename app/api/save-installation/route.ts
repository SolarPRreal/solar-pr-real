import { NextResponse } from "next/server";

export const runtime = "nodejs";

type SaveInstallationPayload = Record<string, unknown>;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as SaveInstallationPayload;

    if (!body.userEmail || !body.plantName) {
      return NextResponse.json(
        {
          ok: false,
          message: "Faltan datos obligatorios: usuario e instalación.",
        },
        { status: 400 }
      );
    }

    const webhookUrl = process.env.GOOGLE_SHEETS_WEBHOOK_URL;

    if (!webhookUrl) {
      return NextResponse.json(
        {
          ok: false,
          message: "Falta configurar GOOGLE_SHEETS_WEBHOOK_URL en .env.local.",
        },
        { status: 500 }
      );
    }

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "saveInstallationData",
        savedAt: new Date().toISOString(),
        ...body,
      }),
    });

    const text = await response.text();
    let data: any = {};

    try {
      data = JSON.parse(text);
    } catch {
      data = { ok: response.ok, message: text };
    }

    return NextResponse.json(data, { status: response.ok ? 200 : 502 });
  } catch (error) {
    console.error("Error guardando instalación:", error);

    return NextResponse.json(
      {
        ok: false,
        message: "Error interno guardando los datos de la instalación.",
      },
      { status: 500 }
    );
  }
}
