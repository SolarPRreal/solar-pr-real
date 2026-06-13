import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      ok: false,
      code: "LOCAL_CONNECTOR_REQUIRED",
      message: "Por seguridad, una web pública no puede ejecutar programas del ordenador ni acceder directamente a la red privada del contador. Esta función requiere el conector local SolarPR instalado en el equipo autorizado. Mientras se completa ese conector, exporta la lectura desde el programa de lectura y súbela en CSV/XLSX.",
    },
    { status: 501 }
  );
}
