import { NextResponse } from "next/server";

type StationOption = {
  id: string;
  name: string;
  province: string;
  municipality?: string;
  code?: string;
  latitude?: number | null;
  longitude?: number | null;
  altitude?: number | null;
  zoneAvgPR: number;
};

const SIAR_BASE_URL = "https://servicio.mapa.gob.es/siarapi";

const PROVINCE_CODES: Record<string, string> = {
  madrid: "28",
  zaragoza: "50",
  murcia: "30",
  almeria: "04",
  sevilla: "41",
  valencia: "46",
  alicante: "03",
  cadiz: "11",
  cordoba: "14",
  granada: "18",
  huelva: "21",
  jaen: "23",
  malaga: "29",
  toledo: "45",
  "ciudad real": "13",
  cuenca: "16",
  guadalajara: "19",
  huesca: "22",
  teruel: "44",
  badajoz: "06",
  caceres: "10",
  barcelona: "08",
  tarragona: "43",
  lleida: "25",
  girona: "17",
  navarra: "31",
  "la rioja": "26",
  valladolid: "47",
  burgos: "09",
  leon: "24",
  palencia: "34",
  salamanca: "37",
  segovia: "40",
  soria: "42",
  zamora: "49",
  avila: "05",
};

const FALLBACK_STATIONS: Record<string, StationOption[]> = {
  madrid: [
    { id: "M01", code: "M01", name: "M01 - Finca Experimental", province: "Madrid", municipality: "Madrid", latitude: null, longitude: null, altitude: null, zoneAvgPR: 88 },
    { id: "M02", code: "M02", name: "M02 - Arganda", province: "Madrid", municipality: "Arganda del Rey", latitude: null, longitude: null, altitude: null, zoneAvgPR: 88 },
    { id: "M03", code: "M03", name: "M03 - Aranjuez", province: "Madrid", municipality: "Aranjuez", latitude: null, longitude: null, altitude: null, zoneAvgPR: 88 },
  ],
  zaragoza: [
    { id: "Z01", code: "Z01", name: "Z01 - Zaragoza / Montañana", province: "Zaragoza", municipality: "Zaragoza", latitude: null, longitude: null, altitude: null, zoneAvgPR: 88 },
    { id: "Z02", code: "Z02", name: "Z02 - La Almunia", province: "Zaragoza", municipality: "La Almunia de Doña Godina", latitude: null, longitude: null, altitude: null, zoneAvgPR: 88 },
  ],
};

function normalizeText(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

function getProvinceCode(province: string) {
  return PROVINCE_CODES[normalizeText(province)] || "";
}

function getEstimatedZonePR(province: string) {
  const normalized = normalizeText(province);

  if (["murcia", "almeria", "alicante", "valencia", "sevilla", "cordoba", "jaen", "granada", "malaga", "huelva", "cadiz"].includes(normalized)) {
    return 89;
  }

  if (["madrid", "toledo", "ciudad real", "cuenca", "guadalajara", "zaragoza", "huesca", "teruel", "badajoz", "caceres"].includes(normalized)) {
    return 88;
  }

  return 86;
}

function getFallbackStations(province: string): StationOption[] {
  const normalized = normalizeText(province);
  const stations = FALLBACK_STATIONS[normalized];

  if (stations?.length) return stations;

  return [
    { id: `${normalized}-demo-01`, code: "SIAR-DEMO-01", name: `SIAR Demo - Estación principal de ${province}`, province, municipality: province, latitude: null, longitude: null, altitude: null, zoneAvgPR: getEstimatedZonePR(province) },
    { id: `${normalized}-demo-02`, code: "SIAR-DEMO-02", name: `SIAR Demo - Estación secundaria de ${province}`, province, municipality: province, latitude: null, longitude: null, altitude: null, zoneAvgPR: getEstimatedZonePR(province) },
  ];
}

function extractStations(data: any): any[] {
  if (Array.isArray(data)) return data;

  // La API SIAR devuelve los listados principales dentro de "datos".
  // El resto de opciones son tolerancia por si cambia la capitalización.
  if (Array.isArray(data?.datos)) return data.datos;
  if (Array.isArray(data?.Datos)) return data.Datos;
  if (Array.isArray(data?.DATOS)) return data.DATOS;

  if (Array.isArray(data?.estaciones)) return data.estaciones;
  if (Array.isArray(data?.Estaciones)) return data.Estaciones;
  if (Array.isArray(data?.ESTACIONES)) return data.ESTACIONES;

  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.resultado)) return data.resultado;
  if (Array.isArray(data?.Resultado)) return data.Resultado;

  return [];
}

function getFirstValue(raw: any, keys: string[]) {
  for (const key of keys) {
    const value = raw?.[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") return value;
  }
  return "";
}

function getRawProvinceCode(raw: any) {
  const value = String(getFirstValue(raw, ["IdProvincia", "idProvincia", "IDPROVINCIA", "CodProvincia", "codProvincia", "CodigoProvincia"])).trim();
  if (!value) return "";
  const digits = value.replace(/\D/g, "");
  return digits ? digits.padStart(2, "0") : value.padStart(2, "0");
}

function getRawProvinceName(raw: any) {
  return String(getFirstValue(raw, ["Provincia", "provincia", "PROVINCIA", "NombreProvincia", "nombreProvincia"])).trim();
}

function mapSiarStation(raw: any, requestedProvince: string): StationOption {
  const id = String(getFirstValue(raw, ["IdEstacion", "idEstacion", "IDESTACION", "Id", "id", "Codigo", "codigo", "CodEstacion", "codEstacion"])).trim();
  const code = String(getFirstValue(raw, ["Codigo", "codigo", "CODIGO", "CodEstacion", "codEstacion", "IdEstacion", "idEstacion"])).trim();
  const stationName = String(getFirstValue(raw, ["Estacion", "estacion", "ESTACION", "Nombre", "nombre", "NOMBRE"])).trim();
  const municipality = String(getFirstValue(raw, ["Termino", "termino", "TERMINO", "Municipio", "municipio"])).trim();
  const province = getRawProvinceName(raw) || requestedProvince;

  const latitude = Number(String(getFirstValue(raw, ["Latitud", "latitud", "LATITUD"])).replace(",", "."));
  const longitude = Number(String(getFirstValue(raw, ["Longitud", "longitud", "LONGITUD"])).replace(",", "."));
  const altitude = Number(String(getFirstValue(raw, ["Altitud", "altitud", "ALTITUD"])).replace(",", "."));

  const cleanName = code && stationName ? `${code} - ${stationName}` : stationName || code || `Estación ${id}`;

  return {
    id: id || code || cleanName,
    code,
    name: cleanName,
    province,
    municipality: municipality || undefined,
    latitude: Number.isFinite(latitude) ? latitude : null,
    longitude: Number.isFinite(longitude) ? longitude : null,
    altitude: Number.isFinite(altitude) ? altitude : null,
    zoneAvgPR: getEstimatedZonePR(requestedProvince),
  };
}

function belongsToProvince(raw: any, station: StationOption, requestedProvince: string) {
  const requestedName = normalizeText(requestedProvince);
  const requestedCode = getProvinceCode(requestedProvince);
  const rawProvinceName = normalizeText(getRawProvinceName(raw));
  const rawProvinceCode = getRawProvinceCode(raw);

  if (rawProvinceName && rawProvinceName === requestedName) return true;
  if (requestedCode && rawProvinceCode === requestedCode) return true;
  if (normalizeText(station.province) === requestedName) return true;

  return false;
}

async function getStationsFromSiarApi(token: string, province: string) {
  const url = `${SIAR_BASE_URL}/API/V1/Info/ESTACIONES?token=${encodeURIComponent(token)}`;

  const response = await fetch(url, { method: "GET", cache: "no-store" });
  const text = await response.text();

  if (!response.ok) {
    throw new Error(`SIAR API respondió ${response.status}: ${text.slice(0, 300)}`);
  }

  let data: any;

  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`SIAR no devolvió JSON válido: ${text.slice(0, 300)}`);
  }

  const rawStations = extractStations(data);

  const stations = rawStations
    .map((raw: any) => ({ raw, station: mapSiarStation(raw, province) }))
    .filter(({ raw, station }: { raw: any; station: StationOption }) => belongsToProvince(raw, station, province))
    .map(({ station }: { station: StationOption }) => station)
    .filter((station: StationOption) => station.id && station.name)
    .sort((a: StationOption, b: StationOption) => a.name.localeCompare(b.name, "es"));

  return {
    stations,
    totalRawStations: rawStations.length,
    sample: rawStations.slice(0, 3),
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const province = searchParams.get("province")?.trim() || "";
  const debug = searchParams.get("debug") === "1";
  const token = process.env.SIAR_API_TOKEN;

  if (!province) {
    return NextResponse.json({ ok: false, message: "Debes indicar una provincia.", stations: [] }, { status: 400 });
  }

  if (token && token !== "tu_token_del_siar") {
    try {
      const result = await getStationsFromSiarApi(token, province);

      if (result.stations.length > 0) {
        return NextResponse.json({
          ok: true,
          mode: "api",
          source: "SIAR/MAPA API",
          province,
          count: result.stations.length,
          totalRawStations: debug ? result.totalRawStations : undefined,
          sample: debug ? result.sample : undefined,
          stations: result.stations,
          note: "Estaciones obtenidas desde la API protegida de SIAR/MAPA.",
        });
      }

      const fallbackStations = getFallbackStations(province);

      return NextResponse.json({
        ok: true,
        mode: "api_empty_fallback",
        source: "SIAR/MAPA API + respaldo local",
        province,
        count: fallbackStations.length,
        totalRawStations: debug ? result.totalRawStations : undefined,
        sample: debug ? result.sample : undefined,
        stations: fallbackStations,
        note: "La API SIAR responde, pero no se han podido filtrar estaciones para esta provincia. Se usa respaldo local hasta ajustar el mapeo.",
      });
    } catch (error) {
      console.warn("No se pudo usar SIAR API. Se usará respaldo local:", error);
    }
  }

  const fallbackStations = getFallbackStations(province);

  return NextResponse.json({
    ok: true,
    mode: "fallback",
    source: "SIAR/MAPA - modo preproducción",
    province,
    count: fallbackStations.length,
    stations: fallbackStations,
    note: "Modo preproducción activo: el acceso API SIAR queda preparado para cuando el token esté habilitado.",
  });
}
