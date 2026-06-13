import { createHash } from "node:crypto";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type ResetPasswordPayload = {
  email?: string;
  code?: string;
  newPassword?: string;
};

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function hashPassword(password: string) {
  const pepper = process.env.PASSWORD_PEPPER || "";
  return createHash("sha256").update(`${pepper}:${password}`).digest("hex");
}

function isSecurePassword(password: string) {
  return (
    password.length >= 8 &&
    /[a-z]/.test(password) &&
    /[A-Z]/.test(password) &&
    /\d/.test(password) &&
    /[^A-Za-z0-9]/.test(password)
  );
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ResetPasswordPayload;

    const email = body.email?.trim().toLowerCase() || "";
    const code = body.code?.trim() || "";
    const newPassword = body.newPassword || "";

    if (!email || !isValidEmail(email) || !code || !newPassword) {
      return NextResponse.json(
        {
          ok: false,
          message: "Introduce mail, código y nueva contraseña.",
        },
        { status: 400 }
      );
    }

    if (!isSecurePassword(newPassword)) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "La nueva contraseña debe tener al menos 8 caracteres e incluir letras, mayúsculas, números y un carácter especial.",
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
        action: "resetPassword",
        token: process.env.API_SECRET || "",
        email,
        code,
        newPasswordHash: hashPassword(newPassword),
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
    console.error("Error cambiando contraseña:", error);

    return NextResponse.json(
      {
        ok: false,
        message: "Error interno cambiando la contraseña.",
      },
      { status: 500 }
    );
  }
}
