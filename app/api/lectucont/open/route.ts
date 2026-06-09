import { NextResponse } from "next/server";
import { execFile } from "node:child_process";

export const runtime = "nodejs";

type LectucontRequest = {
  plantName?: string;
  meterIp?: string;
  meterPort?: string;
  meterId?: string;
  meterProtocol?: string;
  readingDate?: string;
};

const LECTUCONT_APPREF =
  process.env.LECTUCONT_APPREF_PATH ||
  `${process.env.APPDATA}\\Microsoft\\Windows\\Start Menu\\Programs\\Microsoft\\Lectucont.appref-ms`;

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as LectucontRequest;

    if (!body.meterIp || !body.meterPort || !body.meterId || !body.readingDate) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Faltan datos del contador. Indica IP, puerto, ID/dirección del equipo y fecha de lectura.",
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
        meterId: body.meterId,
        meterProtocol: body.meterProtocol || "Modbus TCP",
        readingDate: body.readingDate,
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
