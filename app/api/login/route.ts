import { createHash } from "node:crypto";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type LoginPayload = {
  email?: string;
  password?: string;
};

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function hashPassword(password: string) {
  const pepper = process.env.PASSWORD_PEPPER || "";
  return createHash("sha256").update(`${pepper}:${password}`).digest("hex");
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as LoginPayload;

    const email = body.email?.trim().toLowerCase() || "";
    const password = body.password || "";

    if (!email || !isValidEmail(email) || !password) {
      return NextResponse.json(
        { ok: false, message: "Introduce un mail válido y la contraseña." },
        { status: 400 }
      );
    }

    const webhookUrl = process.env.GOOGLE_SHEETS_WEBHOOK_URL;

    if (!webhookUrl) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Falta configurar GOOGLE_SHEETS_WEBHOOK_URL. El login en producción se valida contra Google Sheets.",
        },
        { status: 500 }
      );
    }

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "loginUser",
        token: process.env.API_SECRET || "",
        email,
        passwordHash: hashPassword(password),
      }),
    });

    const text = await response.text();
    let data: any = {};

    try {
      data = JSON.parse(text);
    } catch {
      data = { ok: false, message: text.slice(0, 300) };
    }

    if (!response.ok || !data.ok) {
      return NextResponse.json(
        {
          ok: false,
          message: data.message || "Correo o contraseña incorrectos.",
        },
        { status: 401 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Login correcto.",
      user: data.user || null,
    });
  } catch (error) {
    console.error("Error en login:", error);

    return NextResponse.json(
      { ok: false, message: "Error interno al iniciar sesión." },
      { status: 500 }
    );
  }
}
