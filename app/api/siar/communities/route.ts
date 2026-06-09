import { NextResponse } from "next/server";

export const runtime = "nodejs";

type StationOption = {
  id: string;
  code?: string;
  name: string;
  province?: string;
  municipality?: string;
  community?: string;
  latitude?: number | null;
  longitude?: number | null;
  altitude?: number | null;
};

type PrefixLocation = {
  province: string;
  community: string;
};

const SIAR_BASE_URL = "https://servicio.mapa.gob.es/siarapi";

const PREFIX_TO_LOCATION: Record<string, PrefixLocation> = {
  "AB": { province: "Albacete", community: "Castilla-La Mancha" },
  "AL": { province: "Almería", community: "Andalucía" },
  "AV": { province: "Ávila", community: "Castilla y León" },
  "BA": { province: "Badajoz", community: "Extremadura" },
  "BU": { province: "Burgos", community: "Castilla y León" },
  "CC": { province: "Cáceres", community: "Extremadura" },
  "CO": { province: "Córdoba", community: "Andalucía" },
  "CR": { province: "Ciudad Real", community: "Castilla-La Mancha" },
  "CU": { province: "Cuenca", community: "Castilla-La Mancha" },
  "GU": { province: "Guadalajara", community: "Castilla-La Mancha" },
  "HU": { province: "Huesca", community: "Aragón" },
  "LE": { province: "León", community: "Castilla y León" },
  "LR": { province: "La Rioja", community: "La Rioja" },
  "LU": { province: "Lugo", community: "Galicia" },
  "MA": { province: "Málaga", community: "Andalucía" },
  "MU": { province: "Murcia", community: "Región de Murcia" },
  "NA": { province: "Navarra", community: "Comunidad Foral de Navarra" },
  "OR": { province: "Ourense", community: "Galicia" },
  "PA": { province: "Palencia", community: "Castilla y León" },
  "PO": { province: "Pontevedra", community: "Galicia" },
  "SA": { province: "Salamanca", community: "Castilla y León" },
  "SE": { province: "Sevilla", community: "Andalucía" },
  "SG": { province: "Segovia", community: "Castilla y León" },
  "SO": { province: "Soria", community: "Castilla y León" },
  "TE": { province: "Teruel", community: "Aragón" },
  "TO": { province: "Toledo", community: "Castilla-La Mancha" },
  "VA": { province: "Valladolid", community: "Castilla y León" },
  "ZA": { province: "Zamora", community: "Castilla y León" },
  "Z": { province: "Zaragoza", community: "Aragón" },

  "A": { province: "Alicante", community: "Comunitat Valenciana" },
  "B": { province: "Barcelona", community: "Cataluña" },
  "C": { province: "A Coruña", community: "Galicia" },
  "G": { province: "Girona", community: "Cataluña" },
  "H": { province: "Huelva", community: "Andalucía" },
  "J": { province: "Jaén", community: "Andalucía" },
  "L": { province: "Lleida", community: "Cataluña" },
  "M": { province: "Madrid", community: "Comunidad de Madrid" },
  "O": { province: "Asturias", community: "Principado de Asturias" },
  "P": { province: "Las Palmas", community: "Canarias" },
  "S": { province: "Cantabria", community: "Cantabria" },
  "T": { province: "Tarragona", community: "Cataluña" },
  "V": { province: "Valencia", community: "Comunitat Valenciana" },
};

const FALLBACK_STATIONS: StationOption[] = [
  { id: "M01", code: "M01", name: "M01 - Finca Experimental", province: "Madrid", municipality: "Madrid", community: "Comunidad de Madrid" },
  { id: "M02", code: "M02", name: "M02 - Arganda", province: "Madrid", municipality: "Arganda del Rey", community: "Comunidad de Madrid" },
  { id: "M03", code: "M03", name: "M03 - Aranjuez", province: "Madrid", municipality: "Aranjuez", community: "Comunidad de Madrid" },

  { id: "A01", code: "A01", name: "A01 - Villena", province: "Alicante", municipality: "Villena", community: "Comunitat Valenciana" },
  { id: "V108", code: "V108", name: "V108 - Moncada 2", province: "Valencia", municipality: "Moncada", community: "Comunitat Valenciana" },
  { id: "V109", code: "V109", name: "V109 - Requena", province: "Valencia", municipality: "Requena", community: "Comunitat Valenciana" },

  { id: "MU01", code: "MU01", name: "MU01 - Torre Pacheco", province: "Murcia", municipality: "Torre Pacheco", community: "Región de Murcia" },
  { id: "MU02", code: "MU02", name: "MU02 - Jumilla", province: "Murcia", municipality: "Jumilla", community: "Región de Murcia" },

  { id: "Z01", code: "Z01", name: "Z01 - Montañana", province: "Zaragoza", municipality: "Zaragoza", community: "Aragón" },
  { id: "HU01", code: "HU01", name: "HU01 - Sariñena", province: "Huesca", municipality: "Sariñena", community: "Aragón" },

  { id: "AL01", code: "AL01", name: "AL01 - Níjar", province: "Almería", municipality: "Níjar", community: "Andalucía" },
  { id: "SE01", code: "SE01", name: "SE01 - La Rinconada", province: "Sevilla", municipality: "La Rinconada", community: "Andalucía" },
  { id: "CO01", code: "CO01", name: "CO01 - Córdoba", province: "Córdoba", municipality: "Córdoba", community: "Andalucía" },

  { id: "AB01", code: "AB01", name: "AB01 - Albacete", province: "Albacete", municipality: "Albacete", community: "Castilla-La Mancha" },
  { id: "TO01", code: "TO01", name: "TO01 - Toledo", province: "Toledo", municipality: "Toledo", community: "Castilla-La Mancha" },

  { id: "VA01", code: "VA01", name: "VA01 - Valladolid", province: "Valladolid", municipality: "Valladolid", community: "Castilla y León" },
  { id: "SA01", code: "SA01", name: "SA01 - Salamanca", province: "Salamanca", municipality: "Salamanca", community: "Castilla y León" },

  { id: "B01", code: "B01", name: "B01 - El Prat", province: "Barcelona", municipality: "El Prat de Llobregat", community: "Cataluña" },
  { id: "L01", code: "L01", name: "L01 - Lleida", province: "Lleida", municipality: "Lleida", community: "Cataluña" },

  { id: "BA01", code: "BA01", name: "BA01 - Badajoz", province: "Badajoz", municipality: "Badajoz", community: "Extremadura" },
  { id: "CC01", code: "CC01", name: "CC01 - Cáceres", province: "Cáceres", municipality: "Cáceres", community: "Extremadura" },
];

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function getFirstValue(raw: any, keys: string[]) {
  for (const key of keys) {
    const value = raw?.[key];

    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return value;
    }
  }

  return "";
}

function extractStations(data: any): any[] {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.datos)) return data.datos;
  if (Array.isArray(data?.Datos)) return data.Datos;
  if (Array.isArray(data?.DATOS)) return data.DATOS;
  if (Array.isArray(data?.estaciones)) return data.estaciones;
  if (Array.isArray(data?.Estaciones)) return data.Estaciones;
  if (Array.isArray(data?.data)) return data.data;
  return [];
}

function inferLocationFromCode(rawCode: string) {
  const token = rawCode.trim().match(/^[A-Za-z]+/)?.[0]?.toUpperCase() || "";

  if (!token) return undefined;

  const prefixes = Object.keys(PREFIX_TO_LOCATION).sort((a, b) => b.length - a.length);
  const prefix = prefixes.find((candidate) => token.startsWith(candidate));

  return prefix ? PREFIX_TO_LOCATION[prefix] : undefined;
}

function mapStation(raw: any): StationOption {
  const id = String(
    getFirstValue(raw, [
      "IdEstacion",
      "idEstacion",
      "IDESTACION",
      "Id",
      "id",
      "Codigo",
      "codigo",
      "CodEstacion",
      "codEstacion",
    ])
  ).trim();

  const code = String(
    getFirstValue(raw, [
      "Codigo",
      "codigo",
      "CODIGO",
      "CodEstacion",
      "codEstacion",
      "IdEstacion",
      "idEstacion",
    ])
  ).trim();

  const rawName = String(
    getFirstValue(raw, [
      "Estacion",
      "estacion",
      "ESTACION",
      "Nombre",
      "nombre",
      "NOMBRE",
    ])
  ).trim();

  const municipality = String(
    getFirstValue(raw, ["Termino", "termino", "TERMINO", "Municipio", "municipio"])
  ).trim();

  const location = inferLocationFromCode(code || id || rawName);

  const province =
    String(
      getFirstValue(raw, ["Provincia", "provincia", "NombreProvincia", "nombreProvincia"])
    ).trim() ||
    location?.province ||
    "";

  const community =
    String(
      getFirstValue(raw, [
        "Comunidad",
        "comunidad",
        "COMUNIDAD",
        "CCAA",
        "ccaa",
        "NombreComunidad",
        "nombreComunidad",
        "ComunidadAutonoma",
        "comunidadAutonoma",
      ])
    ).trim() ||
    location?.community ||
    "Sin clasificar";

  const latitude = Number(String(getFirstValue(raw, ["Latitud", "latitud", "LATITUD"])).replace(",", "."));
  const longitude = Number(String(getFirstValue(raw, ["Longitud", "longitud", "LONGITUD"])).replace(",", "."));
  const altitude = Number(String(getFirstValue(raw, ["Altitud", "altitud", "ALTITUD"])).replace(",", "."));

  const baseName = rawName || municipality || code || id || "Estación SIAR";
  const name = code && !baseName.startsWith(code) ? `${code} - ${baseName}` : baseName;

  return {
    id: id || code || name,
    code,
    name,
    province,
    municipality: municipality || undefined,
    community,
    latitude: Number.isFinite(latitude) ? latitude : null,
    longitude: Number.isFinite(longitude) ? longitude : null,
    altitude: Number.isFinite(altitude) ? altitude : null,
  };
}

function buildCommunities(stations: StationOption[]) {
  const map = new Map<string, number>();

  for (const station of stations) {
    const community = station.community || "Sin clasificar";

    if (community !== "Sin clasificar") {
      map.set(community, (map.get(community) || 0) + 1);
    }
  }

  return Array.from(map.entries())
    .map(([name, count]) => ({
      id: normalizeText(name).replace(/\s+/g, "-"),
      name,
      count,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "es"));
}

function filterStationsByCommunity(stations: StationOption[], community: string) {
  const normalizedCommunity = normalizeText(community);

  return stations
    .filter((station) => normalizeText(station.community || "") === normalizedCommunity)
    .sort((a, b) => a.name.localeCompare(b.name, "es"));
}

async function getSiarStations() {
  const token = process.env.SIAR_API_TOKEN;

  if (!token || token === "tu_token_del_siar") {
    return {
      mode: "fallback",
      stations: FALLBACK_STATIONS,
      note: "Modo respaldo: falta configurar SIAR_API_TOKEN. Se muestran estaciones de ejemplo para no bloquear el flujo.",
    };
  }

  const url = `${SIAR_BASE_URL}/API/V1/Info/ESTACIONES?token=${encodeURIComponent(token)}`;
  const response = await fetch(url, { method: "GET", cache: "no-store" });
  const text = await response.text();

  if (!response.ok) {
    return {
      mode: "fallback",
      stations: FALLBACK_STATIONS,
      note: `Modo respaldo: SIAR respondió ${response.status}. Se muestran estaciones de ejemplo para no bloquear el flujo.`,
    };
  }

  try {
    const data = JSON.parse(text);
    const rawStations = extractStations(data);
    const stations = rawStations
      .map(mapStation)
      .filter((station) => station.id && station.name && station.community !== "Sin clasificar");

    if (stations.length === 0) {
      return {
        mode: "fallback",
        stations: FALLBACK_STATIONS,
        note:
          "Modo respaldo: SIAR respondió, pero no se pudieron clasificar comunidades. Se muestran estaciones de ejemplo.",
      };
    }

    return {
      mode: "api",
      stations,
      note: "Estaciones obtenidas desde SIAR/MAPA.",
    };
  } catch {
    return {
      mode: "fallback",
      stations: FALLBACK_STATIONS,
      note:
        "Modo respaldo: SIAR no devolvió JSON válido. Se muestran estaciones de ejemplo para no bloquear el flujo.",
    };
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const requestedCommunity = searchParams.get("community")?.trim() || "";

  const { mode, stations, note } = await getSiarStations();
  const communities = buildCommunities(stations);

  if (requestedCommunity) {
    const filteredStations = filterStationsByCommunity(stations, requestedCommunity);

    return NextResponse.json({
      ok: true,
      mode,
      source: mode === "api" ? "SIAR/MAPA API" : "Respaldo local",
      community: requestedCommunity,
      count: filteredStations.length,
      stations: filteredStations,
      note,
    });
  }

  return NextResponse.json({
    ok: true,
    mode,
    source: mode === "api" ? "SIAR/MAPA API" : "Respaldo local",
    count: communities.length,
    communities,
    note,
  });
}
