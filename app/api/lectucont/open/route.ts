import { NextResponse } from "next/server";
import { execFile } from "node:child_process";

export const runtime = "nodejs";

type LectucontRequest = {
  plantName?: string;
  meterIp?: string;
  meterPort?: string;
  // El frontend envía gatewayAddress; se acepta también meterId por compatibilidad.
  gatewayAddress?: string;
  meterId?: string;
  writePassword?: string;
  meterProtocol?: string;
  readingDate?: string;
};

const LECTUCONT_APPREF =
  process.env.LECTUCONT_APPREF_PATH ||
  `${process.env.APPDATA}\\Microsoft\\Windows\\Start Menu\\Programs\\Microsoft\\Lectucont.appref-ms`;

export async function POST(request: Request) {
  try {
    // En Vercel (o cualquier entorno que no sea Windows local) no se puede abrir
    // un programa instalado en el PC del usuario: se informa de forma clara.
    if (process.env.VERCEL || process.platform !== "win32") {
      return NextResponse.json(
        {
          ok: false,
          mode: "remote",
          message:
            "La apertura automática del programa de lectura (Lectucont) solo está disponible ejecutando la web en modo local (npm run dev) en el equipo donde está instalado. Desde la versión online, abre Lectucont manualmente, realiza la lectura y sube aquí el CSV/XLSX quinceminutal.",
        },
        { status: 501 }
      );
    }

    const body = (await request.json().catch(() => ({}))) as LectucontRequest;
    const gateway = body.gatewayAddress || body.meterId || "";

    if (!body.meterIp || !body.meterPort || !gateway) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Faltan datos del contador. Indica IP, puerto y dirección de enlace del equipo.",
        },
        { status: 400 }
      );
    }

    await new Promise<void>((resolve, reject) => {
      execFile(
        "powershell.exe",
        [
          "-NoProfile",
          "-ExecutionPolicy",
          "Bypass",
          "-Command",
          `Start-Process -FilePath "${LECTUCONT_APPREF}"`,
        ],
        (error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        }
      );
    });

    return NextResponse.json({
      ok: true,
      message:
        "El programa de lectura se ha abierto correctamente. Usa los parámetros guardados en la web para realizar la lectura y exportar el CSV quinceminutal.",
      lectucontPath: LECTUCONT_APPREF,
      requestedReading: {
        plantName: body.plantName || "",
        meterIp: body.meterIp,
        meterPort: body.meterPort,
        gatewayAddress: gateway,
        meterProtocol: body.meterProtocol || "Modbus TCP",
        readingDate: body.readingDate || "",
      },
      note:
        "Esta integración abre el programa de lectura desde la web local. La descarga automática dependerá de que el programa permita parámetros de línea de comandos o exportación automatizable.",
    });
  } catch (error) {
    console.error("Error abriendo el programa de lectura:", error);

    return NextResponse.json(
      {
        ok: false,
        message:
          "No se pudo abrir el programa de lectura. Revisa que el acceso local exista y que la web se esté ejecutando en tu equipo local.",
      },
      { status: 500 }
    );
  }
}
