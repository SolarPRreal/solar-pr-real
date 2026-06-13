import { NextResponse } from "next/server";

export const runtime = "nodejs";

type RequestPasswordResetPayload = {
  email?: string;
};

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RequestPasswordResetPayload;
    const email = body.email?.trim().toLowerCase() || "";

    if (!email || !isValidEmail(email)) {
      return NextResponse.json(
        {
          ok: false,
          message: "Introduce un mail válido.",
        },
        { status: 400 }
      );
    }

    const webhookUrl = process.env.GOOGLE_SHEETS_WEBHOOK_URL;

    if (!webhookUrl) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Falta configurar GOOGLE_SHEETS_WEBHOOK_URL en .env.local.",
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
        action: "requestPasswordReset",
        token: process.env.API_SECRET || "",
        email,
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
    console.error("Error solicitando recuperación:", error);

    return NextResponse.json(
      {
        ok: false,
        message: "Error interno solicitando recuperación de contraseña.",
      },
      { status: 500 }
    );
  }
}
