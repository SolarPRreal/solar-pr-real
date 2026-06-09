import { NextResponse } from "next/server";

export const runtime = "nodejs";

const SIAR_WEB_BASE_URL =
  process.env.SIAR_WEB_BASE_URL || "https://servicio.mapa.gob.es/siarweb";
const SIAR_RADIATION_VARIABLE_ID =
  process.env.SIAR_RADIATION_VARIABLE_ID || "23";
const SIAR_DAILY_TIPO_CALCULO =
  process.env.SIAR_DAILY_TIPO_CALCULO || "2";

const PREFIX: Record<string, { provinceId: string; communityId: string }> = {
  HU: { provinceId: "22", communityId: "ARA" },
  TE: { provinceId: "44", communityId: "ARA" },
  Z: { provinceId: "50", communityId: "ARA" },
  M: { provinceId: "28", communityId: "MAD" },
  A: { provinceId: "03", communityId: "VAL" },
  V: { provinceId: "46", communityId: "VAL" },
  MU: { provinceId: "30", communityId: "MUR" },
  AL: { provinceId: "04", communityId: "AND" },
  CO: { provinceId: "14", communityId: "AND" },
  H: { provinceId: "21", communityId: "AND" },
  J: { provinceId: "23", communityId: "AND" },
  MA: { provinceId: "29", communityId: "AND" },
  SE: { provinceId: "41", communityId: "AND" },
  AB: { provinceId: "02", communityId: "CLM" },
  CR: { provinceId: "13", communityId: "CLM" },
  CU: { provinceId: "16", communityId: "CLM" },
  GU: { provinceId: "19", communityId: "CLM" },
  TO: { provinceId: "45", communityId: "CLM" },
  AV: { provinceId: "05", communityId: "CLE" },
  BU: { provinceId: "09", communityId: "CLE" },
  LE: { provinceId: "24", communityId: "CLE" },
  PA: { provinceId: "34", communityId: "CLE" },
  SA: { provinceId: "37", communityId: "CLE" },
  SG: { provinceId: "40", communityId: "CLE" },
  SO: { provinceId: "42", communityId: "CLE" },
  VA: { provinceId: "47", communityId: "CLE" },
  ZA: { provinceId: "49", communityId: "CLE" },
  B: { provinceId: "08", communityId: "CAT" },
  G: { provinceId: "17", communityId: "CAT" },
  L: { provinceId: "25", communityId: "CAT" },
  T: { provinceId: "43", communityId: "CAT" },
  BA: { provinceId: "06", communityId: "EXT" },
  CC: { provinceId: "10", communityId: "EXT" },
  LU: { provinceId: "27", communityId: "GAL" },
  OR: { provinceId: "32", communityId: "GAL" },
  PO: { provinceId: "36", communityId: "GAL" },
  C: { provinceId: "15", communityId: "GAL" },
  LR: { provinceId: "26", communityId: "RIO" },
  NA: { provinceId: "31", communityId: "NAV" },
  O: { provinceId: "33", communityId: "AST" },
  S: { provinceId: "39", communityId: "CAN" },
  P: { provinceId: "35", communityId: "ICA" },
};

function getCookieHeader(cookies: string[]) {
  return cookies.map((cookie) => cookie.split(";")[0]).join("; ");
}

function extractCsrf(html: string) {
  return (
    html.match(/<meta[^>]+name=["']_csrf["'][^>]+content=["']([^"']+)["']/i)?.[1] ||
    html.match(/<input[^>]+name=["']_csrf["'][^>]+value=["']([^"']+)["']/i)?.[1] ||
    ""
  );
}

function normalizeDate(input: string) {
  const european = input.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (european) return `${european[3]}-${european[2]}-${european[1]}`;
  return input;
}

function stationToWebParams(stationId: string) {
  const cleaned = stationId.trim().toUpperCase();

  const webMatch = cleaned.match(/^(\d{1,2})-(\d{1,4})$/);
  if (webMatch) {
    return {
      webStationId: `${Number(webMatch[1])}-${Number(webMatch[2])}`,
      provinceId: String(Number(webMatch[1])),
      communityId: "",
    };
  }

  const match = cleaned.match(/^([A-Z]+)0*(\d+)$/);
  if (!match) throw new Error(`No se pudo interpretar la estación SIAR: ${stationId}`);

  const [, letters, numberText] = match;
  const possiblePrefixes = Object.keys(PREFIX).sort((a, b) => b.length - a.length);
  const prefix = possiblePrefixes.find((candidate) => letters.startsWith(candidate));
  if (!prefix) throw new Error(`No se pudo inferir la provincia de la estación SIAR: ${stationId}`);

  const config = PREFIX[prefix];
  const number = String(Number(numberText));

  return {
    webStationId: `${Number(config.provinceId)}-${number}`,
    provinceId: String(Number(config.provinceId)),
    communityId: config.communityId,
  };
}

function parseRadiationFromHtml(html: string) {
  const clean = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const direct = clean.match(/Rad\s*\(MJ\/m2\)\s*([0-9]+(?:[,.][0-9]+)?)/i);
  const valueText =
    direct?.[1] ||
    clean.match(/\d{2}\/\d{2}\/\d{4}\s+([0-9]+(?:[,.][0-9]+)?)/)?.[1];

  if (!valueText) return null;

  const radiationMjM2 = Number(valueText.replace(",", "."));
  if (!Number.isFinite(radiationMjM2) || radiationMjM2 <= 0) return null;

  return {
    radiationMjM2,
    radiationKwhM2: radiationMjM2 / 3.6,
  };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const stationId = searchParams.get("stationId")?.trim() || "";
    const dateParam = searchParams.get("date")?.trim() || "";

    if (!stationId || !dateParam) {
      return NextResponse.json({ ok: false, message: "Faltan stationId y date." }, { status: 400 });
    }

    const date = normalizeDate(dateParam);
    const { webStationId, provinceId, communityId } = stationToWebParams(stationId);

    const entryResponse = await fetch(`${SIAR_WEB_BASE_URL}/consultaDatos/consultaDatos`, {
      method: "GET",
      cache: "no-store",
    });

    const entryHtml = await entryResponse.text();
    const setCookie = entryResponse.headers.getSetCookie
      ? entryResponse.headers.getSetCookie()
      : entryResponse.headers.get("set-cookie")
        ? [entryResponse.headers.get("set-cookie") as string]
        : [];

    const cookie = getCookieHeader(setCookie);
    const csrf = extractCsrf(entryHtml);

    if (!csrf) {
      return NextResponse.json(
        { ok: false, message: "No se pudo obtener el token CSRF de SIAR." },
        { status: 502 }
      );
    }

    const form = new URLSearchParams({
      _csrf: csrf,
      variablesSeleccionadas: SIAR_RADIATION_VARIABLE_ID,
      idEstaciones: webStationId,
      accionHidden: "resultadoConsultaDatos",
      fechaInicial: date,
      fechaFinal: date,
      tipoCalculo: SIAR_DAILY_TIPO_CALCULO,
      tipoFiltroEstaciones: "provincias",
      consultaPersonalizada: "false",
      "peticion.id": "",
      "peticion.idTipoPeticion": "",
      tipoFiltro: "provincias",
      idCCAA: communityId,
      [`checkCA_${communityId}`]: communityId,
      idProvs: provinceId,
      idComRegantes: "",
      "estacion.sEstacionCorto": "",
    });

    const validation = await fetch(`${SIAR_WEB_BASE_URL}/consultaDatosRest/validarResultadoDatos`, {
      method: "POST",
      headers: {
        accept: "*/*",
        "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
        "x-csrf-token": csrf,
        "x-requested-with": "XMLHttpRequest",
        cookie,
      },
      body: form,
      cache: "no-store",
    });

    const validationText = await validation.text();

    if (!validation.ok || !validationText.includes('"validated":true')) {
      return NextResponse.json(
        {
          ok: false,
          message: "SIAR no validó la consulta de radiación.",
          details: validationText.slice(0, 500),
        },
        { status: 502 }
      );
    }

    const result = await fetch(`${SIAR_WEB_BASE_URL}/consultaDatos/consultaDatos`, {
      method: "POST",
      headers: {
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "content-type": "application/x-www-form-urlencoded",
        cookie,
      },
      body: form,
      cache: "no-store",
    });

    const html = await result.text();
    const radiation = parseRadiationFromHtml(html);

    if (!radiation) {
      return NextResponse.json(
        {
          ok: false,
          message: "SIAR respondió, pero no se pudo extraer Rad (MJ/m2) del HTML.",
          details: html.slice(0, 1000),
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      ok: true,
      source: "SIAR web",
      stationId,
      siarWebStationId: webStationId,
      date,
      rawUnit: "MJ/m²",
      radiationMjM2: radiation.radiationMjM2,
      radiationKwhM2: radiation.radiationKwhM2,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "Error interno obteniendo radiación SIAR.",
      },
      { status: 500 }
    );
  }
}
