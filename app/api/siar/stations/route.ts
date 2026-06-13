import { NextResponse } from "next/server";
import { getStationsByProvince } from "@/app/lib/provinces";

export const runtime = "nodejs";

// Código SIAR de muestra por provincia para descargar radiación real.
const PROVINCE_TO_SIAR_CODE: Record<string, string> = {
  Huesca: "HU01", Teruel: "TE01", Zaragoza: "Z01",
  Madrid: "M03",
  Alicante: "A01", Valencia: "V01", Castellón: "V01",
  Murcia: "MU01",
  Almería: "AL01", Córdoba: "CO01", Huelva: "H01", Jaén: "J01",
  Málaga: "MA01", Sevilla: "SE01", Cádiz: "SE01", Granada: "J01",
  Albacete: "AB01", "Ciudad Real": "CR01", Cuenca: "CU01",
  Guadalajara: "GU01", Toledo: "TO01",
  Ávila: "AV01", Burgos: "BU01", León: "LE01", Palencia: "PA01",
  Salamanca: "SA01", Segovia: "SG01", Soria: "SO01",
  Valladolid: "VA01", Zamora: "ZA01",
  Barcelona: "B01", Girona: "G01", Lleida: "L01", Tarragona: "T01",
  Badajoz: "BA01", Cáceres: "CC01",
  Lugo: "LU01", Ourense: "OR01", Pontevedra: "PO01", "A Coruña": "C01",
  "La Rioja": "LR01",
  Navarra: "NA01",
  Asturias: "O01",
  Cantabria: "S01",
  "Las Palmas": "P01",
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const province = searchParams.get("province")?.trim() || "";

    if (!province) {
      return NextResponse.json(
        { ok: false, message: "Debes indicar una provincia.", stations: [] },
        { status: 400 }
      );
    }

    const siarCode = PROVINCE_TO_SIAR_CODE[province] || "";
    const stations = getStationsByProvince(province).map((station) => ({
      ...station,
      siarCode,
    }));

    return NextResponse.json({
      ok: true,
      province,
      mode: "fallback",
      source: "SIAR/MAPA",
      note: siarCode
        ? `Estaciones de referencia provincial. Radiación diaria real descargada de SIAR (estación ${siarCode}).`
        : "Estaciones de referencia provincial. Sin estación SIAR asignada para radiación real en esta provincia.",
      stations,
    });
  } catch (error) {
    console.error("Error obteniendo estaciones:", error);

    return NextResponse.json(
      { ok: false, message: "Se produjo un error al obtener las estaciones.", stations: [] },
      { status: 500 }
    );
  }
}
