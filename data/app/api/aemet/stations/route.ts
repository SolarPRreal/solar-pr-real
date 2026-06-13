import { NextResponse } from "next/server";
import { getStationsByProvince } from "@/app/lib/provinces";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const province = searchParams.get("province")?.trim() || "";

    if (!province) {
      return NextResponse.json(
        {
          ok: false,
          message: "Debes indicar una provincia.",
          stations: [],
        },
        { status: 400 }
      );
    }

    const stations = getStationsByProvince(province);

    return NextResponse.json({
      ok: true,
      province,
      stations,
    });
  } catch (error) {
    console.error("Error obteniendo estaciones:", error);

    return NextResponse.json(
      {
        ok: false,
        message: "Se produjo un error al obtener las estaciones.",
        stations: [],
      },
      { status: 500 }
    );
  }
}