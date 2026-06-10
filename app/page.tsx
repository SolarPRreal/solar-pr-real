"use client";

import { useEffect, useMemo, useState } from "react";

type Screen = "access" | "dashboard";
type AuthMode = "register" | "login" | "forgot";

type RegisteredUser = {
  name: string;
  surname: string;
  email: string;
  password: string;
  plantName: string;
  autonomousCommunity: string;
  province: string;
  siarStationId: string;
  peakPower: string;
};

type CsvRow = {
  timestamp: Date;
  rawTime: string;
  productionKwh: number;
};

type CsvResult = {
  ok: boolean;
  message: string;
  rows: CsvRow[];
};

type CommunityOption = {
  id: string;
  name: string;
  count?: number;
};

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

const DEFAULT_USER: RegisteredUser = {
  name: "",
  surname: "",
  email: "",
  password: "",
  plantName: "Instalación FV",
  autonomousCommunity: "Comunidad de Madrid",
  province: "Madrid",
  siarStationId: "",
  peakPower: "100",
};

const PRIVACY_VERSION = "2026-06-09";
const RGPD_TEXT =
  "He leído la Política de Privacidad y consiento el tratamiento de mi nombre, apellidos y correo para crear y gestionar mi cuenta, confirmar el registro, prestar el servicio de cálculo de PR y atender solicitudes relacionadas. Los datos técnicos de las instalaciones se limitarán a los necesarios para el análisis. Podré retirar el consentimiento y ejercer mis derechos escribiendo a soporte.solarpr@gmail.com. La información completa sobre responsable, finalidades, base jurídica, conservación, destinatarios y derechos está disponible en la Política de Privacidad.";

const sampleTimes = [
  "00:00", "00:15", "00:30", "00:45", "01:00", "01:15", "01:30", "01:45",
];

function normalizeHeader(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function parseSpanishNumber(value: unknown) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : NaN;
  }

  const cleaned = String(value ?? "").trim().replace(",", ".");
  const number = Number(cleaned);

  return Number.isFinite(number) ? number : NaN;
}

function parseExcelDateSerial(value: number) {
  // Excel cuenta días desde 1899-12-30. Funciona para fechas modernas.
  const excelEpoch = new Date(Date.UTC(1899, 11, 30));
  const milliseconds = value * 24 * 60 * 60 * 1000;
  const utcDate = new Date(excelEpoch.getTime() + milliseconds);

  return new Date(
    utcDate.getUTCFullYear(),
    utcDate.getUTCMonth(),
    utcDate.getUTCDate(),
    utcDate.getUTCHours(),
    utcDate.getUTCMinutes(),
    0,
    0
  );
}

function parseDateTime(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return parseExcelDateSerial(value);
  }

  const cleaned = String(value ?? "").trim();

  // Formatos aceptados:
  // - DD-MM-YYYY HH:mm
  // - DD/MM/YYYY HH:mm
  // - DD/MM/YYYY H:mm, habitual en exportaciones de contadores/Excel.
  const match = cleaned.match(
    /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:\s|T)(\d{1,2}):(\d{2})(?::\d{2})?$/
  );

  if (!match) {
    return null;
  }

  const [, day, month, year, hour, minute] = match;
  const date = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    0,
    0
  );

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  // Evita aceptar fechas imposibles como 31/02/2026.
  if (
    date.getFullYear() !== Number(year) ||
    date.getMonth() !== Number(month) - 1 ||
    date.getDate() !== Number(day)
  ) {
    return null;
  }

  return date;
}


function validateFifteenMinuteTable(tableRows: unknown[][], sourceLabel = "archivo"): CsvResult {
  const cleanedRows = tableRows.filter((row) =>
    row.some((cell) => String(cell ?? "").trim() !== "")
  );

  if (cleanedRows.length < 2) {
    return {
      ok: false,
      message: `El ${sourceLabel} debe incluir una fila de cabecera y 96 filas de datos.`,
      rows: [],
    };
  }

  // La fila 1 se considera cabecera. El texto de A1 y B1 no importa.
  // Los datos reales deben empezar en la fila 2:
  // Columna A = fecha y hora
  // Columna B = producción kWh
  const dataRows = cleanedRows.slice(1);

  if (dataRows.length !== 96) {
    return {
      ok: false,
      message: `El ${sourceLabel} debe contener exactamente 96 muestras quinceminutales, desde las 00:00 hasta las 23:45. Has subido ${dataRows.length}.`,
      rows: [],
    };
  }

  const rows: CsvRow[] = [];

  for (const [index, row] of dataRows.entries()) {
    if (row.length < 2) {
      return {
        ok: false,
        message: `Fila ${index + 2}: faltan columnas. La columna A debe ser fecha_hora y la columna B producción_kwh.`,
        rows: [],
      };
    }

    const timestamp = parseDateTime(row[0]);
    const productionKwh = parseSpanishNumber(row[1]);

    if (!timestamp) {
      return {
        ok: false,
        message: `Fila ${index + 2}: fecha/hora no válida. Usa formato DD-MM-YYYY HH:mm o DD/MM/YYYY HH:mm.`,
        rows: [],
      };
    }

    if (!Number.isFinite(productionKwh) || productionKwh < 0) {
      return {
        ok: false,
        message: `Fila ${index + 2}: la producción debe ser un número positivo o cero.`,
        rows: [],
      };
    }

    rows.push({
      timestamp,
      rawTime:
        row[0] instanceof Date
          ? row[0].toLocaleString("es-ES")
          : String(row[0] ?? ""),
      productionKwh,
    });
  }

  rows.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  const first = rows[0].timestamp;
  const last = rows[rows.length - 1].timestamp;
  const firstDay = first.toDateString();

  if (!rows.every((row) => row.timestamp.toDateString() === firstDay)) {
    return {
      ok: false,
      message: `El ${sourceLabel} debe contener muestras de un único día. Hay fechas mezcladas.`,
      rows: [],
    };
  }

  if (first.getHours() !== 0 || first.getMinutes() !== 0) {
    return {
      ok: false,
      message: `La primera muestra debe ser a las 00:00. La primera detectada es ${rows[0].rawTime}.`,
      rows: [],
    };
  }

  if (last.getHours() !== 23 || last.getMinutes() !== 45) {
    return {
      ok: false,
      message: `La última muestra debe ser a las 23:45 del mismo día. La última detectada es ${rows[rows.length - 1].rawTime}.`,
      rows: [],
    };
  }

  for (let index = 1; index < rows.length; index += 1) {
    const diffMinutes =
      (rows[index].timestamp.getTime() - rows[index - 1].timestamp.getTime()) / 60000;

    if (diffMinutes !== 15) {
      return {
        ok: false,
        message: `Las muestras deben estar separadas exactamente 15 minutos. Revisa ${rows[index - 1].rawTime} y ${rows[index].rawTime}.`,
        rows: [],
      };
    }
  }

  return {
    ok: true,
    message: `${sourceLabel.toUpperCase()} válido: 96 muestras de un único día, desde las 00:00 hasta las 23:45, separadas cada 15 minutos.`,
    rows,
  };
}

function parseCsvToTable(content: string) {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return [];
  }

  const delimiter = lines[0].includes(";") ? ";" : ",";

  return lines.map((line) => line.split(delimiter).map((cell) => cell.trim()));
}

function validateFifteenMinuteCsv(content: string): CsvResult {
  return validateFifteenMinuteTable(parseCsvToTable(content), "CSV");
}


function formatEuro(value: number) {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatNumber(value: number, digits = 1) {
  return new Intl.NumberFormat("es-ES", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}


function isSecurePassword(password: string) {
  return (
    password.length >= 12 &&
    /[a-z]/.test(password) &&
    /[A-Z]/.test(password) &&
    /\d/.test(password) &&
    /[^A-Za-z0-9]/.test(password)
  );
}

function getPrStatus(pr: number) {
  if (pr <= 0) return { label: "Sin cálculo", color: "#94A3B8", action: false };
  if (pr < 70) return { label: "Actuable", color: "#EF4444", action: true };
  if (pr < 75) return { label: "Vigilancia", color: "#F59E0B", action: false };
  if (pr < 85) return { label: "Aceptable", color: "#22C55E", action: false };
  return { label: "Saludable", color: "#22C55E", action: false };
}

function SideAds({ side }: { side: "left" | "right" }) {
  return (
    <aside className={`side-ads ${side}`}>
      <div className="ad-card">
        <span>Publicidad</span>
        <strong>{side === "left" ? "Fabricante solar" : "Software energético"}</strong>
        <p>Espacio reservado para marcas del sector FV cuando la plataforma esté en producción.</p>
        <small>300 × 250</small>
      </div>

      <div className="ad-card tall">
        <span>Publicidad</span>
        <strong>{side === "left" ? "Servicios O&M" : "SCADA / BESS / Datos"}</strong>
        <p>
          Bloque lateral premium para mantenimiento, limpieza, termografías,
          monitorización, inversores, seguros o financiación.
        </p>
        <small>300 × 600</small>
      </div>

      <div className="ad-card">
        <span>Publicidad</span>
        <strong>{side === "left" ? "Asesoría energética" : "Marketplace FV"}</strong>
        <p>Zona comercial preparada para monetización futura.</p>
        <small>300 × 250</small>
      </div>
    </aside>
  );
}

function BackgroundStyles() {
  return (
    <style>{`
      :root {
        --bg: #06110d;
        --panel: rgba(9, 16, 21, 0.74);
        --panel-strong: rgba(7, 13, 18, 0.88);
        --border: rgba(255, 255, 255, 0.14);
        --green: #22C55E;
        --amber: #F59E0B;
        --red: #EF4444;
        --text: #F8FAFC;
        --muted: #CBD5E1;
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        background: var(--bg);
      }

      .solar-app {
        min-height: 100vh;
        color: var(--text);
        font-family: Inter, "Plus Jakarta Sans", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background:
          linear-gradient(90deg, rgba(0,0,0,.72), rgba(0,0,0,.34), rgba(0,0,0,.72)),
          linear-gradient(180deg, rgba(0,0,0,.32), rgba(0,0,0,.82)),
          url("/solar-bg.png");
        background-size: cover;
        background-position: center;
        background-attachment: fixed;
      }

      .page {
        min-height: 100vh;
        display: grid;
        grid-template-columns: 300px minmax(0, 1180px) 300px;
        gap: 28px;
        align-items: start;
        width: min(1900px, 100%);
        margin: 0 auto;
        padding: 28px 18px 60px;
      }

      .main-area {
        min-width: 0;
      }

      .glass {
        background: var(--panel);
        border: 1px solid var(--border);
        backdrop-filter: blur(18px);
        box-shadow: 0 30px 90px rgba(0,0,0,.35);
        border-radius: 32px;
      }

      .side-ads {
        position: sticky;
        top: 22px;
        display: flex;
        flex-direction: column;
        gap: 18px;
      }

      .ad-card {
        min-height: 185px;
        padding: 22px;
        border-radius: 28px;
        background: rgba(255, 255, 255, 0.88);
        color: #0F172A;
        border: 1px dashed rgba(15, 23, 42, 0.28);
        box-shadow: 0 24px 70px rgba(0,0,0,.28);
        overflow: hidden;
        position: relative;
      }

      .ad-card::after {
        content: "";
        position: absolute;
        right: -50px;
        bottom: -50px;
        width: 140px;
        height: 140px;
        border-radius: 999px;
        background: rgba(34, 197, 94, 0.16);
      }

      .ad-card.tall {
        min-height: 430px;
      }

      .ad-card span {
        display: inline-flex;
        padding: 6px 9px;
        border-radius: 999px;
        background: #DBEAFE;
        color: #1D4ED8;
        font-size: 11px;
        font-weight: 900;
        text-transform: uppercase;
        letter-spacing: .06em;
      }

      .ad-card strong {
        display: block;
        margin: 16px 0 8px;
        font-size: 22px;
        letter-spacing: -.04em;
      }

      .ad-card p {
        color: #475569;
        line-height: 1.55;
      }

      .ad-card small {
        display: inline-flex;
        margin-top: 8px;
        padding: 6px 10px;
        border-radius: 999px;
        background: #CCFBF1;
        color: #0F766E;
        font-weight: 900;
      }

      .hero {
        padding: clamp(28px, 4vw, 56px);
        min-height: 650px;
        display: grid;
        gap: 24px;
        align-content: center;
      }

      .badge {
        display: inline-flex;
        width: fit-content;
        padding: 9px 12px;
        border-radius: 999px;
        background: rgba(34,197,94,.14);
        color: #BBF7D0;
        border: 1px solid rgba(34,197,94,.28);
        font-weight: 900;
        text-transform: uppercase;
        letter-spacing: .06em;
        font-size: 12px;
      }

      h1 {
        max-width: 900px;
        margin: 0;
        font-size: clamp(46px, 7vw, 92px);
        line-height: .9;
        letter-spacing: -.08em;
      }

      h2 {
        margin: 0;
        font-size: clamp(30px, 4vw, 54px);
        line-height: 1;
        letter-spacing: -.06em;
      }

      h3 {
        margin: 0 0 14px;
        font-size: 24px;
        letter-spacing: -.04em;
      }

      p {
        color: var(--muted);
        line-height: 1.65;
      }

      .hero-lead {
        max-width: 820px;
        font-size: 20px;
      }

      .workflow {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 14px;
      }

      .step {
        padding: 18px;
        border-radius: 24px;
        background: rgba(255,255,255,.07);
        border: 1px solid rgba(255,255,255,.11);
      }

      .step b {
        display: grid;
        width: 42px;
        height: 42px;
        place-items: center;
        border-radius: 15px;
        background: var(--green);
        color: #031409;
        margin-bottom: 12px;
      }

      .step strong {
        display: block;
        margin-bottom: 6px;
      }

      .register-panel {
        display: grid;
        grid-template-columns: 1.1fr .9fr;
        gap: 20px;
        margin-top: 22px;
      }

      .form-card,
      .info-card,
      .dashboard-card {
        padding: 26px;
      }

      label {
        display: block;
        margin-bottom: 14px;
        color: #E2E8F0;
        font-size: 13px;
        font-weight: 850;
      }

      input,
      select {
        width: 100%;
        margin-top: 7px;
        padding: 14px 15px;
        border-radius: 16px;
        border: 1px solid rgba(255,255,255,.16);
        background: rgba(255,255,255,.08);
        color: #FFFFFF;
        outline: none;
        color-scheme: dark;
      }

      select option {
        background: #0F172A;
        color: #F8FAFC;
      }

      select option:checked,
      select option:hover {
        background: #2563EB;
        color: #FFFFFF;
      }

      input::placeholder {
        color: #94A3B8;
      }

      button {
        border: 0;
        border-radius: 999px;
        padding: 15px 19px;
        background: var(--green);
        color: #031409;
        font-weight: 950;
        cursor: pointer;
        transition: transform .2s ease, filter .2s ease;
      }

      button:hover {
        transform: translateY(-1px);
        filter: brightness(1.06);
      }

      .secondary {
        background: rgba(255,255,255,.1);
        border: 1px solid rgba(255,255,255,.16);
        color: #FFFFFF;
      }

      .button-row {
        display: flex;
        gap: 12px;
        flex-wrap: wrap;
        align-items: center;
      }

      .password-field {
        position: relative;
      }

      .password-field input {
        padding-right: 48px;
      }

      .eye-button {
        position: absolute;
        right: 12px;
        top: 50%;
        transform: translateY(-50%);
        display: grid;
        place-items: center;
        width: 32px;
        height: 32px;
        padding: 0;
        border: 0;
        border-radius: 999px;
        background: transparent;
        color: #CBD5E1;
        font-size: 17px;
        line-height: 1;
        box-shadow: none;
      }

      .eye-button:hover {
        transform: translateY(-50%);
        background: rgba(255,255,255,.08);
        filter: none;
      }

      .eye-button svg {
        width: 19px;
        height: 19px;
        fill: none;
        stroke: currentColor;
        stroke-width: 2;
        stroke-linecap: round;
        stroke-linejoin: round;
      }

      .link-button {
        display: inline-flex;
        width: fit-content;
        margin: 6px 0 14px;
        padding: 0;
        border: 0;
        border-radius: 0;
        background: transparent;
        color: #86EFAC;
        font-weight: 850;
        text-decoration: underline;
        box-shadow: none;
      }

      .link-button:hover {
        transform: none;
        filter: brightness(1.15);
      }



      .auth-tabs {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
        padding: 5px;
        border-radius: 18px;
        background: rgba(255,255,255,.06);
        border: 1px solid rgba(255,255,255,.12);
        margin-bottom: 18px;
      }

      .auth-tabs button {
        background: transparent;
        color: #CBD5E1;
        border: 0;
        box-shadow: none;
      }

      .auth-tabs button.active {
        background: var(--green);
        color: #031409;
      }

      .consent-box {
        display: grid;
        grid-template-columns: 20px 1fr;
        gap: 10px;
        padding: 14px;
        border-radius: 18px;
        background: rgba(255,255,255,.06);
        border: 1px solid rgba(255,255,255,.12);
        margin: 14px 0;
      }

      .consent-box input {
        width: 18px;
        height: 18px;
        margin: 3px 0 0;
      }

      .consent-box label {
        margin: 0;
        color: #CBD5E1;
        font-size: 13px;
        line-height: 1.55;
      }

      .small-note {
        color: #94A3B8;
        font-size: 13px;
        line-height: 1.55;
      }

      .dashboard-header {
        display: flex;
        justify-content: space-between;
        gap: 18px;
        align-items: start;
        margin-bottom: 20px;
        padding: 24px;
      }

      .status-pill {
        display: inline-flex;
        padding: 10px 13px;
        border-radius: 999px;
        border: 1px solid;
        font-weight: 950;
        white-space: nowrap;
      }

      .dashboard-grid {
        display: grid;
        grid-template-columns: 1fr 360px;
        gap: 18px;
      }

      .upload-box {
        border: 1px dashed rgba(255,255,255,.22);
        background: rgba(255,255,255,.05);
        border-radius: 28px;
        padding: 22px;
        margin-top: 18px;
      }

      .result-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 14px;
        margin-top: 18px;
      }

      .metric {
        padding: 20px;
        border-radius: 24px;
        background: rgba(255,255,255,.07);
        border: 1px solid rgba(255,255,255,.1);
      }

      .metric span {
        color: #94A3B8;
        font-size: 12px;
        font-weight: 900;
        text-transform: uppercase;
        letter-spacing: .06em;
      }

      .metric strong {
        display: block;
        margin-top: 8px;
        font-size: 38px;
        line-height: .95;
        letter-spacing: -.06em;
      }

      .csv-help-box {
        margin-top: 14px;
        border-radius: 22px;
        background: rgba(34,197,94,.1);
        border: 1px solid rgba(34,197,94,.24);
        padding: 16px;
      }

      .csv-help-box strong {
        display: block;
        color: #BBF7D0;
        margin-bottom: 8px;
      }

      .csv-help-box ul {
        margin: 0;
        padding-left: 20px;
        color: #CBD5E1;
        line-height: 1.6;
      }

      .csv-help-box p {
        margin: 12px 0 0;
        color: #E2E8F0;
      }

      .csv-format {
        margin-top: 14px;
        border-radius: 20px;
        background: #0F172A;
        color: #E2E8F0;
        padding: 16px;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        font-size: 13px;
        overflow: auto;
      }

      .message {
        margin-top: 14px;
        padding: 14px;
        border-radius: 18px;
        font-weight: 800;
      }

      .message.ok {
        background: rgba(34,197,94,.12);
        color: #BBF7D0;
        border: 1px solid rgba(34,197,94,.28);
      }

      .message.error {
        background: rgba(239,68,68,.12);
        color: #FECACA;
        border: 1px solid rgba(239,68,68,.28);
      }

      .service-cta {
        margin-top: 18px;
        padding: 22px;
        border-radius: 26px;
        background: linear-gradient(135deg, rgba(239,68,68,.22), rgba(245,158,11,.16));
        border: 1px solid rgba(239,68,68,.32);
      }

      .lectucont-panel {
        margin-top: 18px;
        padding: 22px;
        border-radius: 26px;
        background: rgba(34,197,94,.09);
        border: 1px solid rgba(34,197,94,.22);
      }

      .lectu-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
      }

      .bars {
        display: grid;
        gap: 10px;
        margin-top: 18px;
      }

      .bar-row {
        display: grid;
        grid-template-columns: 70px 1fr 64px;
        gap: 10px;
        align-items: center;
      }

      .bar-shell {
        height: 12px;
        border-radius: 999px;
        background: rgba(255,255,255,.09);
        overflow: hidden;
      }

      .bar-fill {
        height: 100%;
        border-radius: inherit;
        background: var(--green);
      }

      @media (max-width: 1450px) {
        .page {
          grid-template-columns: 1fr;
          max-width: 1180px;
        }

        .side-ads {
          position: static;
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          order: 2;
        }

        .side-ads.left {
          order: 3;
        }

        .ad-card.tall {
          min-height: 185px;
        }
      }

      @media (max-width: 900px) {
        .register-panel,
        .dashboard-grid,
        .workflow,
        .result-grid,
        .lectu-grid,
        .side-ads {
          grid-template-columns: 1fr;
        }

        .dashboard-header {
          flex-direction: column;
        }
      }
    `}</style>
  );
}

export default function Home() {
  const [screen, setScreen] = useState<Screen>("access");
  const [authMode, setAuthMode] = useState<AuthMode>("register");
  const [user, setUser] = useState<RegisteredUser>(DEFAULT_USER);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [registeredUser, setRegisteredUser] = useState<RegisteredUser | null>(null);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetCode, setResetCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);
  const [passwordRecoveryMessage, setPasswordRecoveryMessage] = useState<{
    type: "ok" | "error";
    text: string;
  } | null>(null);
  const [rgpdAccepted, setRgpdAccepted] = useState(false);

  const [radiationKwhM2, setRadiationKwhM2] = useState("");
  const [omiePrice, setOmiePrice] = useState("0.060");
  const [communities, setCommunities] = useState<CommunityOption[]>([]);
  const [stations, setStations] = useState<StationOption[]>([]);
  const [stationsLoading, setStationsLoading] = useState(false);
  const [stationSourceNote, setStationSourceNote] = useState("");
  const [siarRadiationLoading, setSiarRadiationLoading] = useState(false);
  const [siarRadiationMessage, setSiarRadiationMessage] = useState<{
    type: "ok" | "error";
    text: string;
  } | null>(null);
  const [installationSaveMessage, setInstallationSaveMessage] = useState<{
    type: "ok" | "error";
    text: string;
  } | null>(null);
  const [csvRows, setCsvRows] = useState<CsvRow[]>([]);
  const [csvMessage, setCsvMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  const [meterIp, setMeterIp] = useState("");
  const [meterPort, setMeterPort] = useState("502");
  const [gatewayAddress, setGatewayAddress] = useState("");
  const [writePassword, setWritePassword] = useState("");
  const [meterProtocol, setMeterProtocol] = useState("TCP/IP");
  const [readingDate, setReadingDate] = useState(new Date().toISOString().slice(0, 10));
  const [lectucontMessage, setLectucontMessage] = useState<{
    type: "ok" | "error";
    text: string;
  } | null>(null);

  const peak = Number(String((registeredUser || user).peakPower).replace(",", ".")) || 0;
  const radiation = Number(String(radiationKwhM2).replace(",", ".")) || 0;
  const hasRealSiarRadiation = radiation > 0 && Boolean(siarRadiationMessage?.type === "ok");
  const price = Number(String(omiePrice).replace(",", ".")) || 0;

  const productionKwh = csvRows.reduce((sum, row) => sum + row.productionKwh, 0);
  const expectedKwh = hasRealSiarRadiation ? peak * radiation : 0;
  const pr = expectedKwh > 0 && productionKwh > 0 ? Math.round((productionKwh / expectedKwh) * 100) : 0;
  const status = getPrStatus(pr);
  const recoverableKwh = pr > 0 && pr < 70 ? Math.max(0, expectedKwh * 0.7 - productionKwh) : 0;
  const estimatedLoss = recoverableKwh * price * 30;

  const dayLabel = csvRows[0]?.timestamp.toLocaleDateString("es-ES") || "Sin CSV";
  const currentUser = {
    ...DEFAULT_USER,
    ...user,
    ...(registeredUser || {}),
  };
  const currentCommunity =
    currentUser.autonomousCommunity || DEFAULT_USER.autonomousCommunity;
  const currentStationId = currentUser.siarStationId || "";
  const visibleCommunities = communities;
  const selectedStation =
    stations.find((station) => station.id === currentStationId) || null;

  const sampleBars = useMemo(() => {
    if (csvRows.length === 0) {
      return sampleTimes.map((time, index) => ({
        time,
        value: [0, 2, 6, 10, 14, 18, 22, 28][index],
      }));
    }

    return csvRows
      .filter((_, index) => index % 12 === 0)
      .slice(0, 8)
      .map((row) => ({
        time: row.rawTime.slice(11, 16),
        value: row.productionKwh,
      }));
  }, [csvRows]);

  useEffect(() => {
    async function loadCommunities() {
      try {
        const response = await fetch("/api/siar/communities", { cache: "no-store" });
        const data = await response.json();

        if (!response.ok || !data.ok) {
          setStationSourceNote(data.message || "No se pudieron cargar las comunidades SIAR.");
          return;
        }

        const loadedCommunities = (data.communities || []) as CommunityOption[];
        setCommunities(loadedCommunities);
        setStationSourceNote(data.note || "");

        const currentCommunityFromState =
          (registeredUser?.autonomousCommunity || user.autonomousCommunity || "").trim();

        if (!currentCommunityFromState && loadedCommunities.length > 0) {
          const firstCommunity = loadedCommunities[0].name;
          const updater = (prev: RegisteredUser) => ({
            ...prev,
            autonomousCommunity: firstCommunity,
          });
          if (registeredUser) setRegisteredUser((prev) => (prev ? updater(prev) : prev));
          setUser(updater);
        }
      } catch {
        setStationSourceNote("No se pudo conectar con la API local de SIAR.");
      }
    }

    loadCommunities();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    async function loadStationsByCommunity() {
      const community =
        (registeredUser?.autonomousCommunity || user.autonomousCommunity || DEFAULT_USER.autonomousCommunity).trim();

      if (!community) {
        setStations([]);
        return;
      }

      setStationsLoading(true);

      try {
        const response = await fetch(
          `/api/siar/communities?community=${encodeURIComponent(community)}`,
          { cache: "no-store" }
        );
        const data = await response.json();

        if (!response.ok || !data.ok) {
          setStations([]);
          setStationSourceNote(data.message || "No se pudieron cargar estaciones SIAR.");
          return;
        }

        const loadedStations = (data.stations || []) as StationOption[];
        setStations(loadedStations);
        setStationSourceNote(data.note || "");

        const stationIdFromState =
          registeredUser?.siarStationId || user.siarStationId || "";

        if (
          loadedStations.length > 0 &&
          (!stationIdFromState || !loadedStations.some((station) => station.id === stationIdFromState))
        ) {
          const firstStation = loadedStations[0];
          const updater = (prev: RegisteredUser) => ({
            ...prev,
            siarStationId: firstStation.id,
            province: firstStation.province || prev.province,
          });
          if (registeredUser) setRegisteredUser((prev) => (prev ? updater(prev) : prev));
          setUser(updater);
        }
      } catch {
        setStations([]);
        setStationSourceNote("No se pudo conectar con la API local de estaciones SIAR.");
      } finally {
        setStationsLoading(false);
      }
    }

    loadStationsByCommunity();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registeredUser?.autonomousCommunity, user.autonomousCommunity]);


  function saveLectucontConfig() {
    setLectucontMessage({
      type: "ok",
      text: "Los parámetros permanecen únicamente en esta pantalla mientras esté abierta. La clave no se guarda en el navegador ni se envía a SolarPR.",
    });
  }

  async function handleOpenLectucont() {
    setLectucontMessage(null);

    if (!meterIp || !meterPort || !gatewayAddress || !writePassword) {
      setLectucontMessage({
        type: "error",
        text: "Completa IP, puerto, dirección de enlace y clave de escritura antes de abrir el programa de lectura.",
      });
      return;
    }

    try {
      const response = await fetch("/api/lectucont/open", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          plantName: registeredUser?.plantName || user.plantName,
          meterIp,
          meterPort,
          gatewayAddress,
          writePassword,
          meterProtocol,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        setLectucontMessage({
          type: "error",
          text: data.message || "No se pudo abrir Lectucont.",
        });
        return;
      }

      setLectucontMessage({
        type: "ok",
        text:
          "Configuración guardada y programa de lectura abierto. Realiza la lectura y exporta el CSV/XLSX quinceminutal para importarlo en esta pantalla.",
      });
    } catch {
      setLectucontMessage({
        type: "error",
        text: "Error de conexión con la API local del programa de lectura.",
      });
    }
  }


  async function handleRegister() {
    if (!user.name || !user.surname || !user.email || !user.password || !confirmPassword) {
      alert("Rellena nombre, apellido, mail, contraseña y confirmación de contraseña para continuar.");
      return;
    }
    if (!isSecurePassword(user.password)) {
      alert("La contraseña debe tener entre 12 y 128 caracteres e incluir minúscula, mayúscula, número y carácter especial.");
      return;
    }
    if (user.password !== confirmPassword) {
      alert("La contraseña y la confirmación no coinciden.");
      return;
    }
    if (!rgpdAccepted) {
      alert("Debes aceptar la Política de Privacidad para registrarte.");
      return;
    }
    try {
      const response = await fetch("/api/register-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: user.name,
          surname: user.surname,
          email: user.email,
          password: user.password,
          rgpdAccepted,
          privacyVersion: PRIVACY_VERSION,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) {
        alert(data.message || "No se pudo registrar el usuario.");
        return;
      }
      setLoginEmail(user.email.trim().toLowerCase());
      setLoginPassword("");
      setConfirmPassword("");
      setUser((prev) => ({ ...prev, password: "" }));
      setAuthMode("login");
      alert(data.message || "Registro recibido. Revisa tu correo para confirmar la cuenta.");
    } catch {
      alert("No se pudo conectar con el servicio de registro.");
    }
  }

  async function handleLogin() {
    if (!loginEmail || !loginPassword) {
      alert("Introduce tu correo y tu contraseña.");
      return;
    }
    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) {
        alert(data.message || "Correo o contraseña incorrectos.");
        return;
      }
      setRegisteredUser(data.user as RegisteredUser);
      setUser((prev) => ({ ...prev, ...(data.user as RegisteredUser) }));
      setLoginPassword("");
      setScreen("dashboard");
    } catch {
      alert("No se pudo conectar con el servicio de acceso.");
    }
  }

  async function handleRequestPasswordReset() {
    setPasswordRecoveryMessage(null);

    const email = resetEmail.trim().toLowerCase();

    if (!email) {
      setPasswordRecoveryMessage({
        type: "error",
        text: "Introduce el mail de tu cuenta para enviar el código de recuperación.",
      });
      return;
    }

    try {
      const response = await fetch("/api/request-password-reset", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        setPasswordRecoveryMessage({
          type: "error",
          text: data.message || "No se pudo enviar el código de recuperación.",
        });
        return;
      }

      setPasswordRecoveryMessage({
        type: "ok",
        text:
          "Si el correo existe en el sistema, recibirás un código de recuperación. Revisa la bandeja de entrada y spam.",
      });
    } catch {
      setPasswordRecoveryMessage({
        type: "error",
        text: "No se pudo conectar con el servicio de recuperación.",
      });
    }
  }

  async function handleResetPassword() {
    setPasswordRecoveryMessage(null);

    const email = resetEmail.trim().toLowerCase();

    if (!email || !resetCode || !newPassword || !confirmNewPassword) {
      setPasswordRecoveryMessage({
        type: "error",
        text: "Introduce mail, código de recuperación, nueva contraseña y confirmación.",
      });
      return;
    }

    if (!isSecurePassword(newPassword)) {
      setPasswordRecoveryMessage({
        type: "error",
        text: "La nueva contraseña debe tener entre 12 y 128 caracteres e incluir letras, mayúsculas, números y un carácter especial.",
      });
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setPasswordRecoveryMessage({
        type: "error",
        text: "La nueva contraseña y su confirmación no coinciden.",
      });
      return;
    }

    try {
      const response = await fetch("/api/reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          code: resetCode.trim(),
          newPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        setPasswordRecoveryMessage({
          type: "error",
          text: data.message || "No se pudo cambiar la contraseña.",
        });
        return;
      }

      setLoginEmail(email);
      setLoginPassword("");
      setResetCode("");
      setNewPassword("");
      setConfirmNewPassword("");
      setAuthMode("login");

      alert("Contraseña cambiada correctamente. Ya puedes acceder con la nueva contraseña.");
    } catch {
      setPasswordRecoveryMessage({
        type: "error",
        text: "No se pudo conectar con el servicio de cambio de contraseña.",
      });
    }
  }

  function formatDateForSiar(date: Date) {
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();

    return `${day}/${month}/${year}`;
  }

  async function fetchSiarRadiationForDay(loadedRows: CsvRow[]) {
    const currentUser = registeredUser || user;
    const firstRow = loadedRows[0];

    if (!firstRow) {
      return null;
    }

    if (!currentUser.siarStationId) {
      setSiarRadiationMessage({
        type: "error",
        text: "Selecciona una estación SIAR antes de cruzar la producción con la radiación.",
      });
      return null;
    }

    setSiarRadiationLoading(true);
    setSiarRadiationMessage(null);
    setRadiationKwhM2("");

    try {
      const date = formatDateForSiar(firstRow.timestamp);
      const response = await fetch(
        `/api/siar/radiation?stationId=${encodeURIComponent(
          currentUser.siarStationId
        )}&date=${encodeURIComponent(date)}`
      );

      const data = await response.json();

      if (!response.ok || !data.ok) {
        setSiarRadiationMessage({
          type: "error",
          text:
            data.message ||
            "No se pudo descargar la radiación SIAR para la estación y fecha seleccionadas.",
        });
        return null;
      }

      const radiationValue = Number(data.radiationKwhM2);

      if (!Number.isFinite(radiationValue) || radiationValue <= 0) {
        setSiarRadiationMessage({
          type: "error",
          text: "SIAR respondió, pero no se encontró una radiación válida para ese día.",
        });
        return null;
      }

      setRadiationKwhM2(String(radiationValue.toFixed(3)).replace(".", ","));
      setSiarRadiationMessage({
        type: "ok",
        text: `Radiación SIAR descargada para ${date}: ${radiationValue.toFixed(
          3
        )} kWh/m². Fuente original: ${data.radiationMjM2?.toFixed?.(2) ?? "N/D"} MJ/m².`,
      });

      return radiationValue;
    } catch {
      setSiarRadiationMessage({
        type: "error",
        text: "No se pudo conectar con la API local de radiación SIAR.",
      });
      return null;
    } finally {
      setSiarRadiationLoading(false);
    }
  }

  async function saveInstallationData(
    loadedRows: CsvRow[],
    sourceFileName: string,
    radiationOverrideKwhM2?: number
  ) {
    if (!registeredUser) {
      return;
    }

    setInstallationSaveMessage(null);

    const currentUser = registeredUser || user;
    const plantPower = Number(String(currentUser.peakPower).replace(",", ".")) || 0;
    const currentRadiation =
      typeof radiationOverrideKwhM2 === "number"
        ? radiationOverrideKwhM2
        : Number(String(radiationKwhM2).replace(",", ".")) || 0;
    const currentPrice = Number(String(omiePrice).replace(",", ".")) || 0;
    const totalProduction = loadedRows.reduce((sum, row) => sum + row.productionKwh, 0);
    const expectedProduction = plantPower * currentRadiation;
    const calculatedPr =
      expectedProduction > 0 && totalProduction > 0
        ? Math.round((totalProduction / expectedProduction) * 100)
        : 0;
    const calculatedRecoverableKwh =
      calculatedPr > 0 && calculatedPr < 70
        ? Math.max(0, expectedProduction * 0.7 - totalProduction)
        : 0;
    const calculatedLoss = calculatedRecoverableKwh * currentPrice * 30;

    try {
      const response = await fetch("/api/save-installation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userEmail: currentUser.email,
          userName: currentUser.name,
          userSurname: currentUser.surname,
          plantName: currentUser.plantName,
          autonomousCommunity: currentUser.autonomousCommunity,
          province: currentUser.province,
          peakPowerKwp: currentUser.peakPower,
          siarStationId: selectedStation?.id || currentUser.siarStationId,
          siarStationCode: selectedStation?.code || "",
          siarStationName: selectedStation?.name || "",
          siarStationMunicipality: selectedStation?.municipality || "",
          siarStationProvince: selectedStation?.province || currentUser.province,
          radiationKwhM2: currentRadiation,
          omiePriceEurKwh: currentPrice,
          analyzedDay: loadedRows[0]?.timestamp.toISOString() || "",
          firstSample: loadedRows[0]?.rawTime || "",
          lastSample: loadedRows[loadedRows.length - 1]?.rawTime || "",
          samples: loadedRows.length,
          productionKwh: totalProduction,
          expectedKwh: expectedProduction,
          calculatedPr,
          estimatedLossEurMonth: calculatedLoss,
          sourceFileName,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        setInstallationSaveMessage({
          type: "error",
          text: data.message || "La lectura se validó, pero no se pudieron guardar los datos de la instalación.",
        });
        return;
      }

      setInstallationSaveMessage({
        type: "ok",
        text:
          "Datos de instalación y lectura guardados junto al perfil del usuario. No se recordarán en el formulario, pero quedan registrados para seguimiento interno.",
      });
    } catch {
      setInstallationSaveMessage({
        type: "error",
        text:
          "La lectura se validó, pero no se pudo conectar con el servicio de guardado de instalaciones.",
      });
    }
  }

  async function handleCsvUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) return;

    const fileName = file.name.toLowerCase();
    const isSpreadsheet = fileName.endsWith(".xlsx");

    try {
      let result: CsvResult;

      if (isSpreadsheet) {
        const { default: readXlsxFile } = await import("read-excel-file/browser");
        const tableRows = (await readXlsxFile(file)) as unknown as unknown[][];
        result = validateFifteenMinuteTable(tableRows, "XLSX");
      } else {
        const content = await file.text();
        result = validateFifteenMinuteCsv(content);
      }

      if (!result.ok) {
        setCsvRows([]);
        setCsvMessage({
          type: "error",
          text: result.message,
        });
      } else {
        setCsvRows(result.rows);
        const totalProduction = result.rows.reduce((sum, row) => sum + row.productionKwh, 0);
        const siarRadiation = await fetchSiarRadiationForDay(result.rows);

        if (siarRadiation === null) {
          setCsvRows(result.rows);
          setCsvMessage({
            type: "error",
            text: `${result.message} Producción total detectada: ${formatNumber(
              totalProduction,
              2
            )} kWh. No se calcula el PR porque no se ha podido descargar una radiación real de SIAR para la estación y fecha seleccionadas.`,
          });
          return;
        }

        setCsvMessage({
          type: "ok",
          text: `${result.message} Producción total detectada: ${formatNumber(
            totalProduction,
            2
          )} kWh. Radiación SIAR real cruzada correctamente.`,
        });

        await saveInstallationData(result.rows, file.name, siarRadiation);
      }
    } catch (error) {
      console.error("Error leyendo archivo de producción:", error);
      setCsvRows([]);
      setCsvMessage({
        type: "error",
        text:
          "No se pudo leer el archivo. Si es Excel, asegúrate de que sea .xlsx y de que esté cerrado antes de subirlo.",
      });
    } finally {
      event.target.value = "";
    }
  }

  return (
    <main className="solar-app">
      <BackgroundStyles />

      {screen === "access" ? (
        <div className="page">
          <SideAds side="left" />

          <section className="main-area">
            <div className="hero glass">
              <span className="badge">Monitorización PR · captación de propietarios FV</span>
              <h1>Comprueba el PR real de tu planta antes de perder más producción.</h1>
              <p className="hero-lead">
                El usuario se registra, sube la producción real de su instalación en formato CSV
                quinceminutal y obtiene un primer diagnóstico de rendimiento. Si el PR muestra
                margen real de mejora, ofrecemos revisión técnica, mantenimiento anual y presupuesto
                a medida.
              </p>

              <div className="workflow">
                <div className="step">
                  <b>1</b>
                  <strong>Registro sencillo</strong>
                  <p>Captamos los datos básicos de contacto y de la instalación.</p>
                </div>
                <div className="step">
                  <b>2</b>
                  <strong>CSV quinceminutal</strong>
                  <p>Solo se acepta producción real en muestras de 15 minutos.</p>
                </div>
                <div className="step">
                  <b>3</b>
                  <strong>Oferta si hay margen</strong>
                  <p>Si el PR es malo, se ofrece diagnóstico, mantenimiento y presupuesto.</p>
                </div>
              </div>

              <div className="register-panel">
                <div className="form-card glass">
                  <div className="auth-tabs">
                    <button
                      type="button"
                      className={authMode === "register" ? "active" : ""}
                      onClick={() => setAuthMode("register")}
                    >
                      Crear cuenta
                    </button>
                    <button
                      type="button"
                      className={authMode === "login" ? "active" : ""}
                      onClick={() => setAuthMode("login")}
                    >
                      Ya estoy registrado
                    </button>
                  </div>

                  {authMode === "register" ? (
                    <>
                      <h3>Regístrate para comprobar tu PR</h3>

                      <label>
                        Nombre
                        <input
                          value={user.name}
                          onChange={(event) => setUser((prev) => ({ ...prev, name: event.target.value }))}
                          placeholder="Tu nombre"
                        />
                      </label>

                      <label>
                        Apellido
                        <input
                          value={user.surname}
                          onChange={(event) => setUser((prev) => ({ ...prev, surname: event.target.value }))}
                          placeholder="Tu apellido"
                        />
                      </label>

                      <label>
                        Mail
                        <input
                          type="email"
                          value={user.email}
                          onChange={(event) => setUser((prev) => ({ ...prev, email: event.target.value }))}
                          placeholder="nombre@correo.com"
                        />
                      </label>

                      <label>
                        Contraseña
                        <div className="password-field">
                          <input
                            type={showRegisterPassword ? "text" : "password"}
                            value={user.password}
                            onChange={(event) => setUser((prev) => ({ ...prev, password: event.target.value }))}
                            placeholder="Crea una contraseña segura"
                          />
                          <button
                            type="button"
                            className="eye-button"
                            aria-label={showRegisterPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                            onClick={() => setShowRegisterPassword((prev) => !prev)}
                          >
                            {showRegisterPassword ? (
                              <svg viewBox="0 0 24 24" aria-hidden="true">
                                <path d="M3 3l18 18" />
                                <path d="M10.58 10.58A2 2 0 0 0 12 14a2 2 0 0 0 1.42-.58" />
                                <path d="M9.9 4.24A10.7 10.7 0 0 1 12 4c6 0 10 8 10 8a18.5 18.5 0 0 1-3.1 4.35" />
                                <path d="M6.6 6.6C3.7 8.56 2 12 2 12s4 8 10 8a10.8 10.8 0 0 0 5.4-1.5" />
                              </svg>
                            ) : (
                              <svg viewBox="0 0 24 24" aria-hidden="true">
                                <path d="M2 12s4-8 10-8 10 8 10 8-4 8-10 8S2 12 2 12Z" />
                                <circle cx="12" cy="12" r="3" />
                              </svg>
                            )}
                          </button>
                        </div>
                      </label>

                      <label>
                        Confirmar contraseña
                        <div className="password-field">
                          <input
                            type={showConfirmPassword ? "text" : "password"}
                            value={confirmPassword}
                            onChange={(event) => setConfirmPassword(event.target.value)}
                            placeholder="Repite la contraseña"
                          />
                          <button
                            type="button"
                            className="eye-button"
                            aria-label={showConfirmPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                            onClick={() => setShowConfirmPassword((prev) => !prev)}
                          >
                            {showConfirmPassword ? (
                              <svg viewBox="0 0 24 24" aria-hidden="true">
                                <path d="M3 3l18 18" />
                                <path d="M10.58 10.58A2 2 0 0 0 12 14a2 2 0 0 0 1.42-.58" />
                                <path d="M9.9 4.24A10.7 10.7 0 0 1 12 4c6 0 10 8 10 8a18.5 18.5 0 0 1-3.1 4.35" />
                                <path d="M6.6 6.6C3.7 8.56 2 12 2 12s4 8 10 8a10.8 10.8 0 0 0 5.4-1.5" />
                              </svg>
                            ) : (
                              <svg viewBox="0 0 24 24" aria-hidden="true">
                                <path d="M2 12s4-8 10-8 10 8 10 8-4 8-10 8S2 12 2 12Z" />
                                <circle cx="12" cy="12" r="3" />
                              </svg>
                            )}
                          </button>
                        </div>
                      </label>

                      <p className="small-note">
                        La contraseña debe tener entre 12 y 128 caracteres e incluir letras, mayúsculas,
                        números y un carácter especial.
                      </p>

                      <div className="consent-box">
                        <input
                          id="rgpd-consent"
                          type="checkbox"
                          checked={rgpdAccepted}
                          onChange={(event) => setRgpdAccepted(event.target.checked)}
                        />
                        <label htmlFor="rgpd-consent">
                          {RGPD_TEXT}
                        </label>
                      </div>

                      <p className="small-note">
                        Tras registrarte, se enviará un correo de confirmación a la cuenta indicada.
                        Después podrás completar los datos técnicos de tu instalación en la pantalla privada.
                      </p>

                      <div className="button-row">
                        <button type="button" onClick={handleRegister}>
                          Registrarme y comprobar PR →
                        </button>
                        <button type="button" className="secondary" onClick={() => setScreen("dashboard")}>
                          Ver demo
                        </button>
                      </div>
                    </>
                  ) : authMode === "login" ? (
                    <>
                      <h3>Acceso usuarios registrados</h3>

                      <label>
                        Mail
                        <input
                          type="email"
                          value={loginEmail}
                          onChange={(event) => setLoginEmail(event.target.value)}
                          placeholder="nombre@correo.com"
                        />
                      </label>

                      <label>
                        Contraseña
                        <div className="password-field">
                          <input
                            type={showLoginPassword ? "text" : "password"}
                            value={loginPassword}
                            onChange={(event) => setLoginPassword(event.target.value)}
                            placeholder="Tu contraseña"
                          />
                          <button
                            type="button"
                            className="eye-button"
                            aria-label={showLoginPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                            onClick={() => setShowLoginPassword((prev) => !prev)}
                          >
                            {showLoginPassword ? (
                              <svg viewBox="0 0 24 24" aria-hidden="true">
                                <path d="M3 3l18 18" />
                                <path d="M10.58 10.58A2 2 0 0 0 12 14a2 2 0 0 0 1.42-.58" />
                                <path d="M9.9 4.24A10.7 10.7 0 0 1 12 4c6 0 10 8 10 8a18.5 18.5 0 0 1-3.1 4.35" />
                                <path d="M6.6 6.6C3.7 8.56 2 12 2 12s4 8 10 8a10.8 10.8 0 0 0 5.4-1.5" />
                              </svg>
                            ) : (
                              <svg viewBox="0 0 24 24" aria-hidden="true">
                                <path d="M2 12s4-8 10-8 10 8 10 8-4 8-10 8S2 12 2 12Z" />
                                <circle cx="12" cy="12" r="3" />
                              </svg>
                            )}
                          </button>
                        </div>
                      </label>

                      <button
                        type="button"
                        className="link-button"
                        onClick={() => {
                          setResetEmail(loginEmail);
                          setPasswordRecoveryMessage(null);
                          setAuthMode("forgot");
                        }}
                      >
                        ¿Has olvidado tu contraseña?
                      </button>

                      <p className="small-note">
                        Accede con el correo y contraseña usados en el registro.
                      </p>

                      <button type="button" onClick={handleLogin}>
                        Entrar al área privada →
                      </button>
                    </>
                  ) : (
                    <>
                      <h3>Recuperar contraseña</h3>

                      <p className="small-note">
                        Introduce el mail de tu cuenta. Te enviaremos un código de recuperación.
                        Después podrás crear una nueva contraseña, como en cualquier web habitual.
                      </p>

                      <label>
                        Mail de registro
                        <input
                          type="email"
                          value={resetEmail}
                          onChange={(event) => setResetEmail(event.target.value)}
                          placeholder="nombre@correo.com"
                        />
                      </label>

                      <button type="button" className="secondary" onClick={handleRequestPasswordReset}>
                        Enviar código de recuperación
                      </button>

                      <label style={{ marginTop: 14 }}>
                        Código recibido por correo
                        <input
                          value={resetCode}
                          onChange={(event) => setResetCode(event.target.value)}
                          placeholder="Código de 6 cifras"
                        />
                      </label>

                      <label>
                        Nueva contraseña
                        <div className="password-field">
                          <input
                            type={showNewPassword ? "text" : "password"}
                            value={newPassword}
                            onChange={(event) => setNewPassword(event.target.value)}
                            placeholder="Nueva contraseña segura"
                          />
                          <button
                            type="button"
                            className="eye-button"
                            aria-label={showNewPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                            onClick={() => setShowNewPassword((prev) => !prev)}
                          >
                            {showNewPassword ? (
                              <svg viewBox="0 0 24 24" aria-hidden="true">
                                <path d="M3 3l18 18" />
                                <path d="M10.58 10.58A2 2 0 0 0 12 14a2 2 0 0 0 1.42-.58" />
                                <path d="M9.9 4.24A10.7 10.7 0 0 1 12 4c6 0 10 8 10 8a18.5 18.5 0 0 1-3.1 4.35" />
                                <path d="M6.6 6.6C3.7 8.56 2 12 2 12s4 8 10 8a10.8 10.8 0 0 0 5.4-1.5" />
                              </svg>
                            ) : (
                              <svg viewBox="0 0 24 24" aria-hidden="true">
                                <path d="M2 12s4-8 10-8 10 8 10 8-4 8-10 8S2 12 2 12Z" />
                                <circle cx="12" cy="12" r="3" />
                              </svg>
                            )}
                          </button>
                        </div>
                      </label>

                      <label>
                        Confirmar nueva contraseña
                        <div className="password-field">
                          <input
                            type={showConfirmNewPassword ? "text" : "password"}
                            value={confirmNewPassword}
                            onChange={(event) => setConfirmNewPassword(event.target.value)}
                            placeholder="Repite la nueva contraseña"
                          />
                          <button
                            type="button"
                            className="eye-button"
                            aria-label={showConfirmNewPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                            onClick={() => setShowConfirmNewPassword((prev) => !prev)}
                          >
                            {showConfirmNewPassword ? (
                              <svg viewBox="0 0 24 24" aria-hidden="true">
                                <path d="M3 3l18 18" />
                                <path d="M10.58 10.58A2 2 0 0 0 12 14a2 2 0 0 0 1.42-.58" />
                                <path d="M9.9 4.24A10.7 10.7 0 0 1 12 4c6 0 10 8 10 8a18.5 18.5 0 0 1-3.1 4.35" />
                                <path d="M6.6 6.6C3.7 8.56 2 12 2 12s4 8 10 8a10.8 10.8 0 0 0 5.4-1.5" />
                              </svg>
                            ) : (
                              <svg viewBox="0 0 24 24" aria-hidden="true">
                                <path d="M2 12s4-8 10-8 10 8 10 8-4 8-10 8S2 12 2 12Z" />
                                <circle cx="12" cy="12" r="3" />
                              </svg>
                            )}
                          </button>
                        </div>
                      </label>

                      <p className="small-note">
                        La nueva contraseña debe tener entre 12 y 128 caracteres e incluir letras,
                        mayúsculas, números y un carácter especial.
                      </p>

                      {passwordRecoveryMessage ? (
                        <div className={`message ${passwordRecoveryMessage.type}`}>
                          {passwordRecoveryMessage.text}
                        </div>
                      ) : null}

                      <div className="button-row">
                        <button type="button" onClick={handleResetPassword}>
                          Cambiar contraseña
                        </button>
                        <button type="button" className="secondary" onClick={() => setAuthMode("login")}>
                          Volver al acceso
                        </button>
                      </div>
                    </>
                  )}
                </div>

                <div className="info-card glass">
                  <h3>Qué recibirá el usuario</h3>
                  <p>
                    Una pantalla privada donde podrá subir el CSV de producción real, comprobar
                    el PR, ver el impacto económico orientativo y solicitar una revisión técnica
                    si el resultado indica margen de mejora.
                  </p>
                  <p className="small-note">
                    El cálculo se apoya en producción real del usuario, radiación de referencia SIAR
                    y precio OMIE estimado. La radiación puede variar frente a la registrada exactamente
                    en la planta.
                  </p>
                </div>
              </div>
            </div>
          </section>

          <SideAds side="right" />
        </div>
      ) : (
        <div className="page">
          <SideAds side="left" />

          <section className="main-area">
            <div className="dashboard-header glass">
              <div>
                <span className="badge">Área privada · comprobación PR</span>
                <h2>{registeredUser?.plantName || "Instalación demo"}</h2>
                <p>
                  Usuario: <strong>{`${registeredUser?.name || "Demo"} ${registeredUser?.surname || ""}`.trim()}</strong> · Provincia:{" "}
                  <strong>{registeredUser?.province || user.province}</strong> · Día analizado:{" "}
                  <strong>{dayLabel}</strong>
                </p>
                <p className="small-note">
                  Correo de confirmación enviado a <strong>{registeredUser?.email || user.email}</strong>.
                </p>
              </div>

              <div className="button-row">
                <span className="status-pill" style={{ borderColor: status.color, color: status.color }}>
                  ● {status.label}
                </span>
                <button type="button" className="secondary" onClick={async () => {
                  await fetch("/api/logout", { method: "POST" }).catch(() => null);
                  setRegisteredUser(null);
                  setScreen("access");
                }}>
                  Cerrar sesión
                </button>
              </div>
            </div>

            <div className="dashboard-grid">
              <div className="dashboard-card glass">
                <h3>Sube la producción real en CSV o XLSX quinceminutal</h3>
                <p>
                  Para que el cálculo sea fiable, sube un CSV o XLSX de un único día con una lectura cada
                  15 minutos. La fecha de ese fichero será la fecha usada para descargar la radiación SIAR. No hace falta que la cabecera tenga un nombre concreto: la fila 1 puede
                  tener cualquier texto en las columnas A y B.
                </p>

                <div className="csv-help-box">
                  <strong>Formato correcto</strong>
                  <ul>
                    <li>Columna A: fecha y hora de la lectura en formato DD-MM-YYYY HH:mm o DD/MM/YYYY HH:mm.</li>
                    <li>Columna B: producción de ese periodo en kWh.</li>
                    <li>Debe haber 96 filas de datos, desde las 00:00 hasta las 23:45.</li>
                    <li>Usa un solo día. No mezcles fechas distintas en el mismo archivo.</li>
                    <li>Puedes subir CSV separado por coma/punto y coma o Excel .xlsx.</li>
                  </ul>
                  <p>
                    Si tienes problemas, abre tu Excel, deja solo dos columnas, revisa que la primera
                    hora sea 00:00 y la última 23:45, y después usa <strong>Archivo → Guardar como → CSV o Excel .xlsx</strong>.
                  </p>
                </div>

                <div className="csv-format">
                  Texto libre A,Texto libre B<br />
                  25/05/2026 0:00,0<br />
                  25/05/2026 0:15,0<br />
                  25/05/2026 0:30,0<br />
                  ...<br />
                  25/05/2026 23:45,0
                </div>

                <div className="upload-box">
                  <input type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={handleCsvUpload} />
                  {csvMessage ? (
                    <div className={`message ${csvMessage.type}`}>{csvMessage.text}</div>
                  ) : null}
                </div>

                <div className="lectucont-panel">
                  <h3>Lectura mediante programa local de contadores</h3>
                  <p>
                    Introduce los parámetros únicamente en un equipo autorizado con acceso al contador. Por seguridad, la clave no se guarda ni se envía a nuestros servidores. La web pública requiere un conector local para comunicarse con el programa de lectura; mientras tanto, exporta desde dicho programa el CSV/XLSX y súbelo arriba.
                  </p>

                  <div className="lectu-grid">
                    <label>
                      IP del contador
                      <input value={meterIp} onChange={(event) => setMeterIp(event.target.value)} placeholder="192.168.1.100" />
                    </label>
                    <label>
                      Puerto
                      <input value={meterPort} onChange={(event) => setMeterPort(event.target.value)} />
                    </label>
                    <label>
                      Dirección de enlace
                      <input
                        value={gatewayAddress}
                        onChange={(event) => setGatewayAddress(event.target.value)}
                        placeholder="Ejemplo: 1"
                      />
                    </label>
                    <label>
                      Clave de escritura / contraseña
                      <input
                        type="password"
                        value={writePassword}
                        onChange={(event) => setWritePassword(event.target.value)}
                        placeholder="Clave de escritura"
                      />
                    </label>
                  </div>

                  <div className="button-row">
                    <button type="button" className="secondary" onClick={saveLectucontConfig}>
                      Guardar configuración
                    </button>
                    <button type="button" onClick={handleOpenLectucont}>
                      Abrir programa de lectura
                    </button>
                  </div>

                  {lectucontMessage ? (
                    <div className={`message ${lectucontMessage.type}`}>{lectucontMessage.text}</div>
                  ) : null}
                </div>
              </div>

              <div className="dashboard-card glass">
                <h3>Parámetros de cálculo</h3>

                <label>
                  Nombre de la instalación
                  <input
                    value={(registeredUser || user).plantName}
                    onChange={(event) => {
                      const updater = (prev: RegisteredUser) => ({ ...prev, plantName: event.target.value });
                      if (registeredUser) setRegisteredUser((prev) => (prev ? updater(prev) : prev));
                      setUser(updater);
                    }}
                  />
                </label>

                <label>
                  Comunidad Autónoma
                  <select
                    value={currentCommunity}
                    onChange={(event) => {
                      const updater = (prev: RegisteredUser) => ({
                        ...prev,
                        autonomousCommunity: event.target.value,
                        siarStationId: "",
                      });
                      if (registeredUser) setRegisteredUser((prev) => (prev ? updater(prev) : prev));
                      setUser(updater);
                    }}
                  >
                    {visibleCommunities.length === 0 ? (
                      <option value="">Cargando comunidades SIAR...</option>
                    ) : (
                      visibleCommunities.map((community) => (
                        <option key={community.id} value={community.name}>
                          {community.name}{community.count ? ` · ${community.count} estaciones` : ""}
                        </option>
                      ))
                    )}
                  </select>
                </label>

                <label>
                  Estación meteorológica SIAR
                  <select
                    value={currentStationId}
                    disabled={stationsLoading || stations.length === 0}
                    onChange={(event) => {
                      const station = stations.find((item) => item.id === event.target.value);
                      const updater = (prev: RegisteredUser) => ({
                        ...prev,
                        siarStationId: event.target.value,
                        province: station?.province || prev.province,
                      });
                      if (registeredUser) setRegisteredUser((prev) => (prev ? updater(prev) : prev));
                      setUser(updater);
                    }}
                  >
                    {stationsLoading ? (
                      <option>Cargando estaciones SIAR...</option>
                    ) : stations.length === 0 ? (
                      <option>No hay estaciones disponibles</option>
                    ) : (
                      stations.map((station) => (
                        <option key={station.id} value={station.id}>
                          {station.code ? `${station.code} - ` : ""}{station.name}
                          {station.municipality ? ` · ${station.municipality}` : ""}
                        </option>
                      ))
                    )}
                  </select>
                </label>

                <label>
                  Potencia pico de la instalación (kWp)
                  <input
                    value={(registeredUser || user).peakPower}
                    onChange={(event) => {
                      const updater = (prev: RegisteredUser) => ({ ...prev, peakPower: event.target.value });
                      if (registeredUser) setRegisteredUser((prev) => (prev ? updater(prev) : prev));
                      setUser(updater);
                    }}
                  />
                </label>

                <label>
                  Radiación diaria SIAR real descargada para el día del fichero (kWh/m²)
                  <input
                    value={radiationKwhM2}
                    readOnly
                    placeholder="Pendiente: se descargará de SIAR al subir el fichero"
                  />
                </label>

                <p className="small-note">
                  Este campo no es editable ni estimado: solo se rellena cuando la web descarga
                  un dato real de SIAR para la estación seleccionada y la fecha detectada en el
                  fichero de producción.
                </p>

                {siarRadiationLoading ? (
                  <p className="small-note">Descargando radiación SIAR para la estación y fecha del fichero...</p>
                ) : null}

                {siarRadiationMessage ? (
                  <div className={`message ${siarRadiationMessage.type}`}>
                    {siarRadiationMessage.text}
                  </div>
                ) : null}

                <label>
                  Precio OMIE estimado (€/kWh)
                  <input value={omiePrice} onChange={(event) => setOmiePrice(event.target.value)} />
                </label>

                <p className="small-note">
                  Selecciona primero la Comunidad Autónoma donde está ubicada la instalación. Después,
                  el desplegable de estaciones mostrará solo las estaciones SIAR asignadas a esa comunidad. Al validar una lectura CSV/XLSX, estos datos quedan grabados
                  junto al perfil del usuario para seguimiento interno, pero no se precargan en futuros accesos.
                </p>

                {stationSourceNote ? <p className="small-note">{stationSourceNote}</p> : null}
                {installationSaveMessage ? (
                  <div className={`message ${installationSaveMessage.type}`}>
                    {installationSaveMessage.text}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="result-grid">
              <div className="metric glass">
                <span>PR calculado</span>
                <strong style={{ color: status.color }}>{pr > 0 ? `${pr}%` : "--"}</strong>
              </div>

              <div className="metric glass">
                <span>Producción real</span>
                <strong>{productionKwh > 0 ? `${formatNumber(productionKwh, 1)} kWh` : "--"}</strong>
              </div>

              <div className="metric glass">
                <span>Pérdida estimada</span>
                <strong>{estimatedLoss > 0 ? `${formatEuro(estimatedLoss)}/mes` : "0 €"}</strong>
              </div>
            </div>

            <div className="dashboard-card glass" style={{ marginTop: 18 }}>
              <h3>Perfil quinceminutal de producción</h3>
              <p>
                Muestra resumida de la curva cargada. Cuando se conecte Lectucont, este bloque podrá
                alimentarse automáticamente desde las lecturas IP del contador.
              </p>

              <div className="bars">
                {sampleBars.map((item) => {
                  const max = Math.max(...sampleBars.map((bar) => bar.value), 1);
                  const width = Math.max((item.value / max) * 100, 4);

                  return (
                    <div className="bar-row" key={item.time}>
                      <span>{item.time}</span>
                      <div className="bar-shell">
                        <div className="bar-fill" style={{ width: `${width}%` }} />
                      </div>
                      <strong>{formatNumber(item.value, 1)}</strong>
                    </div>
                  );
                })}
              </div>
            </div>

            {status.action ? (
              <div className="service-cta">
                <h3>Tu instalación muestra margen real de mejora</h3>
                <p>
                  Con un PR inferior al 70%, podemos estudiar una actuación técnica: revisión,
                  mantenimiento anual, limpieza, termografía, análisis de inversores y presupuesto
                  a medida. No garantizamos mejora automática sin diagnóstico previo, pero sí una
                  evaluación profesional del caso.
                </p>
                <button type="button">Solicitar revisión técnica y presupuesto →</button>
              </div>
            ) : (
              <div className="dashboard-card glass" style={{ marginTop: 18 }}>
                <h3>Seguimiento recomendado</h3>
                <p>
                  Si el PR está entre el 75% y el 85%, no tiene por qué ser malo. Conviene revisar
                  histórico, disponibilidad, tipo de estructura, radiación local y condiciones reales
                  antes de plantear una intervención.
                </p>
              </div>
            )}
          </section>

          <SideAds side="right" />
        </div>
      )}
    </main>
  );
}
