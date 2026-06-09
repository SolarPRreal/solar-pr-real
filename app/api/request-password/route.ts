import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import * as XLSX from "xlsx";

type PasswordRequestBody = {
  email: string;
};

const DATA_DIR = path.join(process.cwd(), "data");
const USERS_FILE = path.join(DATA_DIR, "Registro usuarios.xlsx");
const USERS_SHEET = "Usuarios";
const REQUESTS_FILE = path.join(DATA_DIR, "Solicitudes nueva contraseña.xlsx");
const REQUESTS_SHEET = "Solicitudes";

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  const stats = fs.statSync(DATA_DIR);
  if (!stats.isDirectory()) {
    throw new Error(`La ruta ${DATA_DIR} existe pero no es una carpeta.`);
  }
}

function ensureRequestsFileIsNotDirectory(): void {
  if (fs.existsSync(REQUESTS_FILE)) {
    const stats = fs.statSync(REQUESTS_FILE);
    if (stats.isDirectory()) {
      throw new Error(
        `La ruta ${REQUESTS_FILE} es una carpeta. Debes borrarla para que la app pueda crear el archivo Excel real.`
      );
    }
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

function writeRows(filePath: string, sheetName: string, rows: Record<string, string>[]): void {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(rows);

  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  const excelBuffer = XLSX.write(workbook, {
    type: "buffer",
    bookType: "xlsx",
  });

  fs.writeFileSync(filePath, excelBuffer);
}

export async function POST(request: Request) {
  try {
    ensureDataDir();
    ensureRequestsFileIsNotDirectory();

    const body = (await request.json()) as PasswordRequestBody;
    const email = body.email?.trim().toLowerCase() || "";

    if (!email) {
      return NextResponse.json(
        { ok: false, message: "Debes indicar un correo electrónico." },
        { status: 400 }
      );
    }

    const users = readRows(USERS_FILE, USERS_SHEET);
    const found = users.find((user) => String(user.email || "").toLowerCase() === email);

    if (!found) {
      return NextResponse.json(
        { ok: false, message: "No existe ningún usuario registrado con ese correo." },
        { status: 404 }
      );
    }

    const requests = readRows(REQUESTS_FILE, REQUESTS_SHEET);

    requests.push({
      fullName: String(found.fullName || ""),
      email: String(found.email || ""),
      installationType: String(found.installationType || ""),
      province: String(found.province || ""),
      company: String(found.company || ""),
      phone: String(found.phone || ""),
      peakPowerKw: String(found.peakPowerKw || ""),
      passwordActual: String(found.password || ""),
      fechaSolicitud: new Date().toLocaleString("es-ES"),
      estado: "Pendiente",
    });

    writeRows(REQUESTS_FILE, REQUESTS_SHEET, requests);

    return NextResponse.json({
      ok: true,
      message: "Solicitud guardada correctamente en el Excel de solicitudes.",
    });
  } catch (error) {
    console.error("Error en solicitud de contraseña:", error);

    const message =
      error instanceof Error
        ? error.message
        : "Se produjo un error al registrar la solicitud.";

    return NextResponse.json(
      { ok: false, message },
      { status: 500 }
    );
  }
}