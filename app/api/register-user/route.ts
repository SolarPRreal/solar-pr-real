import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { appendFile, mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

export const runtime = "nodejs";

type RegisterPayload = {
  name?: string;
  surname?: string;
  email?: string;
  password?: string;
  rgpdAccepted?: boolean;
  rgpdText?: string;
  source?: string;
};

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function hashPassword(password: string) {
  return createHash("sha256").update(password).digest("hex");
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

function csvEscape(value: unknown) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RegisterPayload;

    const name = body.name?.trim() || "";
    const surname = body.surname?.trim() || "";
    const email = body.email?.trim().toLowerCase() || "";
    const password = body.password || "";
    const rgpdAccepted = Boolean(body.rgpdAccepted);
    const rgpdText = body.rgpdText?.trim() || "";
    const source = body.source?.trim() || "SolarPR Monitor";

    if (!name || !surname || !email || !password) {
      return NextResponse.json(
        {
          ok: false,
          message: "Faltan campos obligatorios: nombre, apellido, mail y contraseña.",
        },
        { status: 400 }
      );
    }

    if (!isValidEmail(email)) {
      return NextResponse.json(
        {
          ok: false,
          message: "El mail no tiene un formato válido.",
        },
        { status: 400 }
      );
    }

    if (!isSecurePassword(password)) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "La contraseña debe tener al menos 8 caracteres e incluir letras, mayúsculas, números y un carácter especial.",
        },
        { status: 400 }
      );
    }

    if (!rgpdAccepted) {
      return NextResponse.json(
        {
          ok: false,
          message: "El usuario debe aceptar la política de protección de datos RGPD.",
        },
        { status: 400 }
      );
    }

    const registeredAt = new Date().toISOString();
    const passwordHash = hashPassword(password);
    const userId = createHash("sha256")
      .update(`${email}:${registeredAt}`)
      .digest("hex")
      .slice(0, 16);

    const record = {
      userId,
      registeredAt,
      name,
      surname,
      email,
      passwordHash,
      emailConfirmed: "Pendiente",
      confirmationDate: "",
      rgpdAccepted: "Sí",
      rgpdAcceptedAt: registeredAt,
      rgpdText,
      source,
    };

    const webhookUrl = process.env.GOOGLE_SHEETS_WEBHOOK_URL;

    if (webhookUrl) {
      const sheetResponse = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(record),
      });

      const sheetText = await sheetResponse.text();

      if (!sheetResponse.ok) {
        return NextResponse.json(
          {
            ok: false,
            message: "No se pudo registrar el usuario en Google Sheets.",
            details: sheetText.slice(0, 500),
          },
          { status: 502 }
        );
      }

      return NextResponse.json({
        ok: true,
        mode: "google_sheets",
        message: "Usuario registrado correctamente en Google Sheets.",
        userId,
      });
    }

    // Respaldo local para desarrollo si todavía no has pegado la URL del Apps Script.
    const dataDir = path.join(process.cwd(), "data");
    const csvPath = path.join(dataDir, "usuarios-solarpr.csv");

    await mkdir(dataDir, { recursive: true });

    if (!existsSync(csvPath)) {
      await writeFile(
        csvPath,
        [
          "ID_usuario",
          "Fecha_registro",
          "Nombre",
          "Apellido",
          "Mail",
          "Password_hash",
          "Email_confirmado",
          "Fecha_confirmacion",
          "Acepta_RGPD",
          "Fecha_aceptacion_RGPD",
          "Texto_RGPD_aceptado",
          "Origen_registro",
        ].join(",") + "\n",
        "utf8"
      );
    }

    await appendFile(
      csvPath,
      [
        record.userId,
        record.registeredAt,
        record.name,
        record.surname,
        record.email,
        record.passwordHash,
        record.emailConfirmed,
        record.confirmationDate,
        record.rgpdAccepted,
        record.rgpdAcceptedAt,
        record.rgpdText,
        record.source,
      ]
        .map(csvEscape)
        .join(",") + "\n",
      "utf8"
    );

    return NextResponse.json({
      ok: true,
      mode: "local_csv",
      message:
        "Usuario registrado en CSV local. Para Google Sheets, configura GOOGLE_SHEETS_WEBHOOK_URL en .env.local.",
      userId,
    });
  } catch (error) {
    console.error("Error registrando usuario:", error);

    return NextResponse.json(
      {
        ok: false,
        message: "Error interno registrando el usuario.",
      },
      { status: 500 }
    );
  }
}
