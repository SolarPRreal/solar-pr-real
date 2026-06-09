import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import * as XLSX from "xlsx";

type LoginBody = {
  email: string;
  password: string;
};

const DATA_DIR = path.join(process.cwd(), "data");
const USERS_FILE = path.join(DATA_DIR, "Registro usuarios.xlsx");
const USERS_SHEET = "Usuarios";

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  const stats = fs.statSync(DATA_DIR);
  if (!stats.isDirectory()) {
    throw new Error(`La ruta ${DATA_DIR} existe pero no es una carpeta.`);
  }
}

function ensureUsersFileExistsAndIsValid(): void {
  if (!fs.existsSync(USERS_FILE)) {
    throw new Error(
      `No existe el archivo de usuarios en ${USERS_FILE}. Registra primero un usuario.`
    );
  }

  const stats = fs.statSync(USERS_FILE);

  if (stats.isDirectory()) {
    throw new Error(
      `La ruta ${USERS_FILE} es una carpeta y no un archivo Excel válido.`
    );
  }
}

function readRows(filePath: string, sheetName: string): Record<string, string>[] {
  if (!fs.existsSync(filePath)) {
    return [];
  }

  const stats = fs.statSync(filePath);

  if (!stats.isFile()) {
    throw new Error(`La ruta ${filePath} no es un archivo válido.`);
  }

  const fileBuffer = fs.readFileSync(filePath);
  const workbook = XLSX.read(fileBuffer, { type: "buffer" });
  const sheet = workbook.Sheets[sheetName];

  if (!sheet) {
    return [];
  }

  return XLSX.utils.sheet_to_json<Record<string, string>>(sheet, {
    defval: "",
  });
}

export async function POST(request: Request) {
  try {
    ensureDataDir();
    ensureUsersFileExistsAndIsValid();

    const body = (await request.json()) as LoginBody;

    const email = body.email?.trim().toLowerCase() || "";
    const password = body.password || "";

    if (!email || !password) {
      return NextResponse.json(
        {
          ok: false,
          message: "Debes indicar email y contraseña.",
        },
        { status: 400 }
      );
    }

    const users = readRows(USERS_FILE, USERS_SHEET);

    const found = users.find(
      (user) =>
        String(user.email || "").trim().toLowerCase() === email &&
        String(user.password || "") === password
    );

    if (!found) {
      return NextResponse.json(
        {
          ok: false,
          message: "Correo o contraseña incorrectos.",
        },
        { status: 401 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Login correcto.",
      user: {
        fullName: String(found.fullName || ""),
        email: String(found.email || ""),
        installationType: String(found.installationType || ""),
        province: String(found.province || ""),
        password: String(found.password || ""),
        company: String(found.company || ""),
        phone: String(found.phone || ""),
        peakPowerKw: String(found.peakPowerKw || ""),
      },
    });
  } catch (error) {
    console.error("Error en login:", error);

    const message =
      error instanceof Error
        ? error.message
        : "Se produjo un error al iniciar sesión.";

    return NextResponse.json(
      {
        ok: false,
        message,
      },
      { status: 500 }
    );
  }
}