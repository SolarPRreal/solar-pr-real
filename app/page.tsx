"use client";

import { useEffect, useMemo, useState } from "react";
import { SPAIN_PROVINCES, type StationOption } from "@/app/lib/provinces";

type InstallationType =
  | "autoconsumo_residencial"
  | "autoconsumo_industrial"
  | "huerto_solar"
  | "cubierta_industrial"
  | "bombeo"
  | "otro";

type StructureType = "fija" | "seguimiento_1_eje" | "seguimiento_2_ejes";

type UserAccount = {
  name: string;
  surname: string;
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
  rgpdAccepted: boolean;
  installationType: InstallationType;
  province: string;
  peakPowerKw?: string;
};

type PlantForm = {
  plantName: string;
  province: string;
  stationId: string;
  peakPower: string;
  structureType: StructureType;
};

type DataSource = {
  mode: "api" | "fallback" | "unknown";
  source: string;
  note: string;
};

type CsvRow = {
  timestamp: Date;
  productionKwh: number;
};

function parseSpanishNumber(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : NaN;
  const cleaned = String(value ?? "").trim().replace(",", ".");
  const number = Number(cleaned);
  return Number.isFinite(number) ? number : NaN;
}

function parseExcelDateSerial(value: number) {
  const excelEpoch = new Date(Date.UTC(1899, 11, 30));
  const milliseconds = value * 24 * 60 * 60 * 1000;
  const utcDate = new Date(excelEpoch.getTime() + milliseconds);
  return new Date(utcDate.getUTCFullYear(), utcDate.getUTCMonth(), utcDate.getUTCDate(), utcDate.getUTCHours(), utcDate.getUTCMinutes(), 0, 0);
}

function parseDateTime(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === "number" && Number.isFinite(value)) return parseExcelDateSerial(value);
  const cleaned = String(value ?? "").trim();
  const match = cleaned.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:\s|T)(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!match) return null;
  const [, day, month, year, hour, minute] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), 0, 0);
  if (Number.isNaN(date.getTime())) return null;
  if (date.getFullYear() !== Number(year) || date.getMonth() !== Number(month) - 1 || date.getDate() !== Number(day)) return null;
  return date;
}

function validateFifteenMinuteTable(tableRows: unknown[][]): { ok: boolean; message: string; rows: CsvRow[] } {
  const cleanedRows = tableRows.filter((row) => row.some((cell) => String(cell ?? "").trim() !== ""));
  if (cleanedRows.length < 2) return { ok: false, message: "El archivo debe incluir cabecera y 96 filas de datos.", rows: [] };
  const dataRows = cleanedRows.slice(1);
  if (dataRows.length !== 96) return { ok: false, message: `Debe contener exactamente 96 muestras quinceminutales. Has subido ${dataRows.length}.`, rows: [] };
  const rows: CsvRow[] = [];
  for (const [index, row] of dataRows.entries()) {
    const timestamp = parseDateTime(row[0]);
    const productionKwh = parseSpanishNumber(row[1]);
    if (!timestamp) return { ok: false, message: `Fila ${index + 2}: fecha/hora no válida (DD/MM/YYYY HH:mm).`, rows: [] };
    if (!Number.isFinite(productionKwh) || productionKwh < 0) return { ok: false, message: `Fila ${index + 2}: la producción debe ser un número positivo o cero.`, rows: [] };
    rows.push({ timestamp, productionKwh });
  }
  rows.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  const first = rows[0].timestamp;
  const last = rows[rows.length - 1].timestamp;
  const firstDay = first.toDateString();
  if (!rows.every((row) => row.timestamp.toDateString() === firstDay)) return { ok: false, message: "Todas las muestras deben ser del mismo día.", rows: [] };
  if (first.getHours() !== 0 || first.getMinutes() !== 0) return { ok: false, message: "La primera muestra debe ser a las 00:00.", rows: [] };
  if (last.getHours() !== 23 || last.getMinutes() !== 45) return { ok: false, message: "La última muestra debe ser a las 23:45.", rows: [] };
  for (let i = 1; i < rows.length; i++) {
    const diff = (rows[i].timestamp.getTime() - rows[i - 1].timestamp.getTime()) / 60000;
    if (diff !== 15) return { ok: false, message: "Las muestras deben estar separadas exactamente 15 minutos.", rows: [] };
  }
  return { ok: true, message: "Archivo validado: 96 muestras de 15 minutos, día completo.", rows };
}

function parseCsvToTable(content: string) {
  const lines = content.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length === 0) return [];
  const delimiter = lines[0].includes(";") ? ";" : ",";
  return lines.map((line) => line.split(delimiter).map((cell) => cell.trim()));
}

const INSTALLATION_OPTIONS: { value: InstallationType; label: string }[] = [
  { value: "autoconsumo_residencial", label: "Autoconsumo residencial" },
  { value: "autoconsumo_industrial", label: "Autoconsumo industrial" },
  { value: "huerto_solar", label: "Huerto solar" },
  { value: "cubierta_industrial", label: "Cubierta industrial" },
  { value: "bombeo", label: "Bombeo solar" },
  { value: "otro", label: "Otro" },
];

const STRUCTURE_OPTIONS: { value: StructureType; label: string }[] = [
  { value: "fija", label: "Fija" },
  { value: "seguimiento_1_eje", label: "Seguimiento a 1 eje" },
  { value: "seguimiento_2_ejes", label: "Seguimiento a 2 ejes" },
];

const mockHourly = [
  { time: "08:00", real: 12, expected: 11, pr: 109 },
  { time: "09:00", real: 25, expected: 27, pr: 93 },
  { time: "10:00", real: 39, expected: 43, pr: 91 },
  { time: "11:00", real: 51, expected: 58, pr: 88 },
  { time: "12:00", real: 60, expected: 69, pr: 87 },
  { time: "13:00", real: 58, expected: 67, pr: 87 },
  { time: "14:00", real: 55, expected: 63, pr: 87 },
  { time: "15:00", real: 44, expected: 49, pr: 90 },
  { time: "16:00", real: 31, expected: 35, pr: 89 },
  { time: "17:00", real: 17, expected: 20, pr: 85 },
];

const mockDailyPR = [84, 86, 88, 82, 90, 91, 87, 89, 86, 88, 85, 87];

const inverterData = [
  { name: "INV-01", pr: 91, status: "ok" },
  { name: "INV-02", pr: 88, status: "warn" },
  { name: "INV-03", pr: 82, status: "bad" },
  { name: "INV-04", pr: 89, status: "warn" },
] as const;

/* ─── CSS ─────────────────────────────────────────────────────────────────── */

function GlobalStyles() {
  return (
    <style>{`
      *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

      :root {
        --ink:      #0b1120;
        --ink-soft: #3d4f6b;
        --ink-mute: #6b7fa0;
        --paper:    #f4f7fc;
        --surface:  rgba(255,255,255,0.88);
        --surface2: rgba(255,255,255,0.60);
        --border:   rgba(255,255,255,0.50);
        --green:    #00c471;
        --green-dk: #008f52;
        --amber:    #f59e0b;
        --red:      #ef4444;
        --blue:     #3b82f6;
        --radius-lg: 24px;
        --radius-md: 16px;
        --radius-sm: 10px;
        --shadow:   0 8px 40px rgba(11,17,32,0.18);
        --shadow-sm:0 2px 12px rgba(11,17,32,0.10);
        --font-sans: 'Inter', system-ui, sans-serif;
      }

      html { font-family: var(--font-sans); color: var(--ink); }

      /* ── BACKGROUND ── */
      .sp-page {
        min-height: 100vh;
        background:
          linear-gradient(160deg, rgba(0,20,50,0.82) 0%, rgba(0,10,30,0.72) 100%),
          url("/solar-bg.png") center / cover no-repeat fixed;
      }

      /* ── LAYOUT ── */
      .sp-wrap        { width: min(1520px, 100%); margin: 0 auto; padding: 0 24px; }
      .sp-center      { width: min(1100px, 100%); margin: 0 auto; padding: 0 24px; }

      /* ── GLASS CARD ── */
      .glass {
        background: var(--surface);
        backdrop-filter: blur(20px) saturate(160%);
        border: 1px solid var(--border);
        box-shadow: var(--shadow);
        border-radius: var(--radius-lg);
      }
      .glass-dim {
        background: var(--surface2);
        backdrop-filter: blur(14px);
        border: 1px solid var(--border);
        border-radius: var(--radius-lg);
        box-shadow: var(--shadow-sm);
      }

      /* ── NAV ── */
      .sp-nav {
        display: flex; align-items: center; justify-content: space-between;
        padding: 20px 0;
      }
      .sp-logo {
        display: flex; align-items: center; gap: 10px;
        font-size: 20px; font-weight: 800; color: #fff; letter-spacing: -0.04em;
        text-decoration: none;
      }
      .sp-logo-dot { width:8px; height:8px; border-radius:50%; background: var(--green); }

      /* ── AUTH PAGE ── */
      .auth-hero {
        min-height: 100vh;
        display: flex; flex-direction: column;
        padding: 0 24px;
      }
      .auth-body {
        flex: 1; display: grid;
        grid-template-columns: 1fr 420px;
        gap: 40px; align-items: center;
        max-width: 1100px; margin: 0 auto; width: 100%;
        padding: 40px 0 60px;
      }
      .auth-pitch { color: #fff; }
      .auth-kicker {
        display: inline-flex; align-items: center; gap: 7px;
        padding: 7px 14px; border-radius: 999px;
        background: rgba(0,196,113,0.15); border: 1px solid rgba(0,196,113,0.35);
        color: var(--green); font-size: 12px; font-weight: 700;
        text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 20px;
      }
      .auth-kicker-dot { width:6px; height:6px; border-radius:50%; background:var(--green); }
      .auth-h1 {
        font-size: clamp(44px,6vw,80px); font-weight: 900; line-height: 0.92;
        letter-spacing: -0.06em; margin-bottom: 20px;
      }
      .auth-h1 span { color: var(--green); }
      .auth-sub { font-size: 17px; line-height: 1.7; color: rgba(255,255,255,0.7); max-width: 480px; }
      .auth-stats { display:flex; gap:32px; margin-top:36px; }
      .auth-stat-val { font-size:28px; font-weight:900; color:#fff; line-height:1; }
      .auth-stat-lbl { font-size:12px; color:rgba(255,255,255,0.5); margin-top:3px; }

      /* ── AUTH CARD ── */
      .auth-card { padding: 32px; }
      .auth-tabs { display:flex; gap:4px; background:rgba(0,0,0,0.06); border-radius:12px; padding:4px; margin-bottom:24px; }
      .auth-tab {
        flex:1; padding:9px; border:none; border-radius:9px; cursor:pointer;
        font-size:14px; font-weight:600; background:transparent; color:var(--ink-soft);
        transition: all .18s;
      }
      .auth-tab.active { background:#fff; color:var(--ink); box-shadow:0 1px 4px rgba(0,0,0,0.12); }

      /* ── FORM ELEMENTS ── */
      .sp-field { margin-bottom: 14px; }
      .sp-label { display:block; font-size:13px; font-weight:600; color:var(--ink-soft); margin-bottom:6px; }
      .sp-input, .sp-select {
        width:100%; padding:11px 14px; border-radius:var(--radius-sm);
        border:1.5px solid #e2e8f0; background:#fff; color:var(--ink);
        font-size:14px; font-family:inherit; outline:none;
        transition: border-color .15s, box-shadow .15s;
        appearance: none;
      }
      .sp-input:focus, .sp-select:focus { border-color:var(--green); box-shadow:0 0 0 3px rgba(0,196,113,0.12); }
      .sp-input::placeholder { color: #a0aec0; }
      .sp-pw-wrap { position:relative; }
      .sp-pw-wrap .sp-input { padding-right:42px; }
      .sp-pw-btn {
        position:absolute; right:12px; top:50%; transform:translateY(-50%);
        background:none; border:none; cursor:pointer; color:var(--ink-mute);
        display:flex; padding:2px;
      }
      .sp-pw-btn svg { width:18px; height:18px; }
      .sp-select-wrap { position:relative; }
      .sp-select-wrap::after {
        content:''; position:absolute; right:13px; top:50%; transform:translateY(-50%);
        width:0; height:0;
        border-left:5px solid transparent; border-right:5px solid transparent;
        border-top:5px solid var(--ink-mute); pointer-events:none;
      }

      /* ── BUTTONS ── */
      .btn-primary {
        display:block; width:100%; padding:13px; border:none; border-radius:var(--radius-sm);
        background: linear-gradient(135deg, #00c471, #008f52);
        color:#fff; font-size:15px; font-weight:700; cursor:pointer;
        box-shadow: 0 4px 16px rgba(0,196,113,0.30);
        transition: filter .15s, transform .12s;
        font-family:inherit; margin-top:6px;
      }
      .btn-primary:hover { filter:brightness(1.06); transform:translateY(-1px); }
      .btn-primary:disabled { opacity:.6; cursor:not-allowed; transform:none; }
      .btn-ghost {
        display:inline-flex; align-items:center; gap:6px;
        padding:9px 16px; border-radius:var(--radius-sm);
        border:1.5px solid rgba(255,255,255,0.25); background:rgba(255,255,255,0.08);
        color:#fff; font-size:13px; font-weight:600; cursor:pointer;
        transition: background .15s; font-family:inherit;
      }
      .btn-ghost:hover { background:rgba(255,255,255,0.14); }
      .btn-outline {
        display:inline-flex; align-items:center; gap:7px;
        padding:10px 18px; border-radius:var(--radius-sm);
        border:1.5px solid var(--green); background:transparent;
        color:var(--green); font-size:13px; font-weight:700; cursor:pointer;
        transition: background .15s, color .15s; font-family:inherit;
      }
      .btn-outline:hover { background:var(--green); color:#fff; }
      .btn-dark {
        display:inline-flex; align-items:center; gap:7px;
        padding:10px 18px; border-radius:var(--radius-sm);
        border:none; background:var(--ink); color:#fff;
        font-size:13px; font-weight:700; cursor:pointer;
        transition:opacity .15s; font-family:inherit;
      }
      .btn-dark:hover { opacity:.85; }
      .btn-dark:disabled { opacity:.5; cursor:not-allowed; }

      /* ── CONSENT / NOTICE ── */
      .consent-wrap { display:flex; gap:10px; align-items:flex-start; margin:12px 0; }
      .consent-wrap input { width:16px; height:16px; margin-top:2px; flex-shrink:0; accent-color:var(--green); }
      .consent-wrap label { font-size:12px; color:var(--ink-soft); line-height:1.5; }
      .consent-wrap a { color:var(--green); font-weight:600; }
      .pw-hint { font-size:12px; color:var(--ink-mute); line-height:1.45; margin:-8px 0 10px; padding:9px 12px; background:#f8fafc; border-radius:8px; border:1px solid #e2e8f0; }
      .sp-notice { margin-top:14px; padding:11px 14px; border-radius:var(--radius-sm); font-size:13px; font-weight:500; }
      .sp-notice.success { background:#dcfce7; color:#166534; border:1px solid #86efac; }
      .sp-notice.error   { background:#fee2e2; color:#991b1b; border:1px solid #fecaca; }
      .forgot-row { display:flex; align-items:center; gap:8px; margin:10px 0; }
      .forgot-row input { accent-color:var(--green); }
      .forgot-row label { font-size:13px; color:var(--ink-soft); }

      /* ── DASHBOARD NAV ── */
      .db-nav {
        display:flex; align-items:center; justify-content:space-between;
        padding: 18px 0; border-bottom:1px solid rgba(255,255,255,0.10);
        margin-bottom: 24px;
      }
      .db-nav-right { display:flex; align-items:center; gap:12px; }
      .db-user-chip {
        display:flex; align-items:center; gap:8px;
        padding:7px 14px; border-radius:999px;
        background:rgba(255,255,255,0.10); color:rgba(255,255,255,0.85);
        font-size:13px; font-weight:600;
      }
      .db-user-avatar {
        width:28px; height:28px; border-radius:50%;
        background:linear-gradient(135deg,var(--green),var(--green-dk));
        display:flex; align-items:center; justify-content:center;
        font-size:12px; font-weight:800; color:#fff; flex-shrink:0;
      }
      .db-nav-tab {
        padding:7px 14px; border-radius:999px; border:none; cursor:pointer;
        font-size:13px; font-weight:600; font-family:inherit;
        background:transparent; color:rgba(255,255,255,0.55);
        transition:all .15s;
      }
      .db-nav-tab.active { background:rgba(255,255,255,0.12); color:#fff; }

      /* ── DASHBOARD LAYOUT ── */
      .db-grid {
        display:grid;
        grid-template-columns: 340px 1fr 300px;
        gap:20px; align-items:start;
      }
      .db-col-left  { display:flex; flex-direction:column; gap:16px; }
      .db-col-mid   { display:flex; flex-direction:column; gap:16px; min-width:0; }
      .db-col-right { display:flex; flex-direction:column; gap:16px; position:sticky; top:20px; }

      /* ── CARDS ── */
      .db-card { padding:22px; }
      .db-card-title {
        font-size:15px; font-weight:700; color:var(--ink); letter-spacing:-0.02em;
        margin-bottom:16px; display:flex; align-items:center; gap:8px;
      }
      .db-card-title .icon { width:20px; height:20px; opacity:.6; }

      /* ── KPI GRID ── */
      .kpi-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:12px; }
      .kpi {
        padding:16px; border-radius:var(--radius-md);
        background:rgba(255,255,255,0.92); border:1px solid rgba(255,255,255,0.5);
        box-shadow:var(--shadow-sm);
      }
      .kpi-label { font-size:11px; font-weight:700; color:var(--ink-mute); text-transform:uppercase; letter-spacing:0.06em; margin-bottom:6px; }
      .kpi-value { font-size:26px; font-weight:900; color:var(--ink); letter-spacing:-0.04em; line-height:1; }
      .kpi-sub   { font-size:11px; color:var(--ink-mute); margin-top:4px; }
      .kpi.highlight .kpi-value { color:var(--green-dk); }
      .kpi.warn     .kpi-value { color:#d97706; }
      .kpi.bad      .kpi-value { color:var(--red); }

      /* ── PR GAUGE ── */
      .pr-gauge-wrap { text-align:center; padding:20px 0 12px; }
      .pr-gauge-val  { font-size:56px; font-weight:900; letter-spacing:-0.06em; line-height:1; }
      .pr-gauge-lbl  { font-size:13px; color:var(--ink-mute); margin-top:4px; }
      .pr-bar-track  { height:6px; border-radius:999px; background:#e2e8f0; margin:14px 0 6px; overflow:hidden; }
      .pr-bar-fill   { height:100%; border-radius:999px; transition:width .6s ease; }

      /* ── CHART BARS ── */
      .chart-row { margin-bottom:14px; }
      .chart-row-head { display:flex; justify-content:space-between; font-size:12px; margin-bottom:5px; }
      .chart-row-lbl { font-weight:600; color:var(--ink); }
      .chart-row-val { color:var(--ink-mute); }
      .bar-track { height:6px; border-radius:999px; background:#e8eef5; overflow:hidden; margin-bottom:3px; }
      .bar-real  { height:100%; border-radius:999px; background:var(--green); }
      .bar-exp   { height:100%; border-radius:999px; background:#cbd5e1; }

      /* ── DAILY SPARKLINE ── */
      .sparkline { display:flex; align-items:flex-end; gap:4px; height:60px; }
      .spark-bar { flex:1; border-radius:4px 4px 0 0; min-height:4px; }
      .spark-labels { display:flex; justify-content:space-between; font-size:10px; color:var(--ink-mute); margin-top:4px; }

      /* ── INVERTER TABLE ── */
      .inv-row { display:flex; align-items:center; justify-content:space-between; padding:10px 0; border-bottom:1px solid #f1f5f9; }
      .inv-row:last-child { border-bottom:none; }
      .inv-name { font-size:13px; font-weight:700; }
      .inv-sub  { font-size:11px; color:var(--ink-mute); }
      .inv-badge { padding:5px 10px; border-radius:999px; font-size:12px; font-weight:700; }

      /* ── ALERT ROWS ── */
      .alert-row { display:flex; align-items:flex-start; gap:10px; padding:10px 0; border-bottom:1px solid #fef2f2; }
      .alert-row:last-child { border-bottom:none; }
      .alert-dot { width:8px; height:8px; border-radius:50%; background:var(--red); margin-top:4px; flex-shrink:0; }
      .alert-time { font-size:12px; font-weight:700; color:#b91c1c; }
      .alert-msg  { font-size:12px; color:#7f1d1d; margin-top:2px; }

      /* ── DIAGNOSIS CARD ── */
      .diag-block { padding:14px; border-radius:var(--radius-md); margin-bottom:10px; }
      .diag-block-title { font-size:12px; font-weight:700; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:5px; }
      .diag-block-body  { font-size:13px; line-height:1.5; }

      /* ── SERVICE CTA ── */
      .service-cta {
        background: linear-gradient(135deg, var(--ink), #1a2744);
        border-radius: var(--radius-md); padding:18px; color:#fff;
      }
      .service-cta-title { font-size:14px; font-weight:800; margin-bottom:6px; }
      .service-cta-body  { font-size:12px; line-height:1.5; color:rgba(255,255,255,0.7); margin-bottom:12px; }
      .service-cta-btn {
        display:inline-flex; align-items:center; gap:6px;
        padding:9px 16px; border:none; border-radius:8px;
        background:#fff; color:var(--ink); font-size:13px; font-weight:700;
        cursor:pointer; transition:opacity .15s; font-family:inherit;
      }
      .service-cta-btn:hover { opacity:.88; }
      .service-cta-btn:disabled { opacity:.5; cursor:not-allowed; }
      .service-cta-feedback { font-size:12px; margin-top:8px; padding:8px; border-radius:8px; }
      .service-cta-feedback.ok  { background:rgba(0,196,113,0.15); color:#00c471; }
      .service-cta-feedback.err { background:rgba(239,68,68,0.15);  color:#ef4444; }

      /* ── AD SLOTS ── */
      .ad-slot {
        border-radius:var(--radius-md); padding:18px; min-height:120px;
        background:rgba(255,255,255,0.06); border:1.5px dashed rgba(255,255,255,0.15);
      }
      .ad-slot-badge { font-size:10px; font-weight:800; text-transform:uppercase; letter-spacing:0.07em; color:rgba(255,255,255,0.3); margin-bottom:8px; }
      .ad-slot-title { font-size:16px; font-weight:800; color:rgba(255,255,255,0.7); margin-bottom:6px; }
      .ad-slot-desc  { font-size:12px; color:rgba(255,255,255,0.4); line-height:1.5; margin-bottom:10px; }
      .ad-slot-size  { font-size:11px; font-weight:700; color:var(--green); background:rgba(0,196,113,0.1); padding:4px 8px; border-radius:999px; display:inline-block; }
      .ad-slot.tall  { min-height:300px; }

      /* ── UPLOAD AREA ── */
      .upload-label {
        display:flex; align-items:center; justify-content:center; gap:8px;
        padding:13px; border:2px dashed var(--green); border-radius:var(--radius-sm);
        background:rgba(0,196,113,0.04); cursor:pointer; font-size:14px;
        font-weight:700; color:var(--green); transition:background .15s;
        margin-top:14px;
      }
      .upload-label:hover { background:rgba(0,196,113,0.10); }
      .upload-label input { display:none; }
      .upload-feedback { margin-top:10px; padding:11px 14px; border-radius:var(--radius-sm); font-size:13px; }
      .upload-feedback.ok  { background:#dcfce7; color:#166534; border:1px solid #86efac; }
      .upload-feedback.err { background:#fee2e2; color:#991b1b; border:1px solid #fecaca; }

      /* ── SOURCE BOX ── */
      .source-box { padding:11px 14px; border-radius:var(--radius-sm); margin-top:12px; font-size:13px; }
      .source-box.ok  { background:#f0fdf4; border:1px solid #86efac; color:#166534; }
      .source-box.warn { background:#fffbeb; border:1px solid #fde68a; color:#92400e; }
      .source-box-title { font-weight:700; margin-bottom:3px; }

      /* ── STATION BOX ── */
      .station-box { background:#f8fafc; border:1px solid #e2e8f0; border-radius:var(--radius-sm); padding:11px 14px; margin:10px 0; font-size:13px; }
      .station-box strong { color:var(--ink); }

      /* ── REPORTS PAGE ── */
      .report-hero { padding:40px 0 28px; }
      .report-hero-title { font-size:32px; font-weight:900; color:#fff; letter-spacing:-0.05em; }
      .report-hero-sub   { font-size:15px; color:rgba(255,255,255,0.6); margin-top:6px; }
      .report-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(300px,1fr)); gap:20px; margin-bottom:32px; }
      .report-card { padding:24px; display:flex; flex-direction:column; gap:14px; }
      .report-card-icon { font-size:28px; }
      .report-card-title { font-size:16px; font-weight:800; color:var(--ink); letter-spacing:-0.03em; }
      .report-card-desc  { font-size:13px; color:var(--ink-soft); line-height:1.55; flex:1; }
      .report-card-meta  { display:flex; align-items:center; justify-content:space-between; }
      .report-card-badge { font-size:11px; font-weight:700; padding:4px 9px; border-radius:999px; }
      .report-card-badge.pdf  { background:#fee2e2; color:#b91c1c; }
      .report-card-badge.csv  { background:#dcfce7; color:#166534; }
      .report-card-badge.pptx { background:#eff6ff; color:#1d4ed8; }
      .report-preview { background:#0b1120; border-radius:var(--radius-lg); overflow:hidden; margin-bottom:24px; }
      .report-preview-header { display:flex; align-items:center; justify-content:space-between; padding:16px 20px; border-bottom:1px solid rgba(255,255,255,0.08); }
      .report-preview-title { font-size:14px; font-weight:700; color:rgba(255,255,255,0.8); }
      .report-preview-body  { padding:20px; }
      .rp-kpi-row { display:flex; gap:16px; margin-bottom:20px; flex-wrap:wrap; }
      .rp-kpi { flex:1; min-width:120px; padding:14px; border-radius:12px; background:rgba(255,255,255,0.05); }
      .rp-kpi-lbl { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:0.06em; color:rgba(255,255,255,0.4); margin-bottom:4px; }
      .rp-kpi-val { font-size:22px; font-weight:900; color:#fff; letter-spacing:-0.04em; }
      .rp-kpi-sub { font-size:10px; color:rgba(255,255,255,0.35); margin-top:2px; }
      .rp-chart-title { font-size:12px; font-weight:700; color:rgba(255,255,255,0.5); text-transform:uppercase; letter-spacing:0.06em; margin-bottom:10px; }
      .rp-bars { display:flex; align-items:flex-end; gap:3px; height:80px; }
      .rp-bar { flex:1; border-radius:3px 3px 0 0; }
      .rp-section-title { font-size:13px; font-weight:700; color:rgba(255,255,255,0.6); margin:16px 0 8px; }
      .rp-diag-row { display:flex; align-items:center; gap:10px; padding:8px; background:rgba(255,255,255,0.04); border-radius:8px; margin-bottom:6px; }
      .rp-diag-icon { font-size:14px; }
      .rp-diag-text { font-size:12px; color:rgba(255,255,255,0.65); }
      .rp-inv-row { display:flex; align-items:center; justify-content:space-between; padding:7px 0; border-bottom:1px solid rgba(255,255,255,0.06); }
      .rp-inv-name { font-size:12px; font-weight:600; color:rgba(255,255,255,0.7); }
      .rp-inv-bar-wrap { flex:1; margin:0 12px; }
      .rp-inv-bar { height:4px; border-radius:999px; background:var(--green); }
      .rp-inv-val { font-size:12px; font-weight:700; color:#fff; }
      .report-no-data { text-align:center; padding:40px 20px; }
      .report-no-data-icon { font-size:40px; margin-bottom:14px; }
      .report-no-data-title { font-size:18px; font-weight:800; color:#fff; margin-bottom:8px; }
      .report-no-data-sub   { font-size:14px; color:rgba(255,255,255,0.5); }

      /* ── FOOTER AD ── */
      .footer-ad { margin-top:28px; padding-bottom:32px; }
      .footer-ad .ad-slot { min-height:90px; display:flex; align-items:center; gap:20px; }

      /* ── RESPONSIVE ── */
      @media(max-width:1200px) {
        .db-grid { grid-template-columns:300px 1fr; }
        .db-col-right { grid-column:1/-1; flex-direction:row; flex-wrap:wrap; position:static; }
        .db-col-right .ad-slot { flex:1; min-width:200px; }
      }
      @media(max-width:860px) {
        .auth-body { grid-template-columns:1fr; }
        .auth-stats { flex-wrap:wrap; gap:20px; }
        .db-grid { grid-template-columns:1fr; }
        .db-col-right { flex-direction:column; }
        .kpi-grid { grid-template-columns:repeat(2,1fr); }
        .sp-wrap, .sp-center { padding:0 14px; }
      }
    `}</style>
  );
}

/* ─── REUSABLE COMPONENTS ─────────────────────────────────────────────────── */

function Field({ label, value, onChange, type = "text", placeholder = "", disabled = false }: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string; disabled?: boolean;
}) {
  return (
    <div className="sp-field">
      <label className="sp-label">{label}</label>
      <input className="sp-input" type={type} value={value} placeholder={placeholder}
        disabled={disabled} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function PwField({ label, value, onChange, visible, onToggle, disabled = false }: {
  label: string; value: string; onChange: (v: string) => void;
  visible: boolean; onToggle: () => void; disabled?: boolean;
}) {
  return (
    <div className="sp-field">
      <label className="sp-label">{label}</label>
      <div className="sp-pw-wrap">
        <input className="sp-input" type={visible ? "text" : "password"} value={value}
          disabled={disabled} onChange={(e) => onChange(e.target.value)} />
        <button type="button" className="sp-pw-btn" onClick={onToggle}>
          {visible
            ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3l18 18M10.6 10.7a3 3 0 0 0 4 4M9.9 5.2A11 11 0 0 1 12 5c6.5 0 10 7 10 7a17.2 17.2 0 0 1-3.2 4.2M6.7 6.7C4.2 8.1 2.6 10.6 2 12c0 0 3.5 7 10 7 1.8 0 3.3-.4 4.6-1" strokeLinecap="round" strokeLinejoin="round"/></svg>
            : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" strokeLinecap="round" strokeLinejoin="round"/><circle cx="12" cy="12" r="3"/></svg>
          }
        </button>
      </div>
    </div>
  );
}

function SelField({ label, value, onChange, options, disabled = false }: {
  label: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[]; disabled?: boolean;
}) {
  return (
    <div className="sp-field">
      <label className="sp-label">{label}</label>
      <div className="sp-select-wrap">
        <select className="sp-select" value={value} disabled={disabled}
          onChange={(e) => onChange(e.target.value)}>
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
    </div>
  );
}

function AdSlot({ title, desc, size, tall = false }: { title: string; desc: string; size: string; tall?: boolean }) {
  return (
    <div className={`ad-slot ${tall ? "tall" : ""}`}>
      <div className="ad-slot-badge">Publicidad</div>
      <div className="ad-slot-title">{title}</div>
      <div className="ad-slot-desc">{desc}</div>
      <div className="ad-slot-size">{size}</div>
    </div>
  );
}

function WashAutoPanelAd({ size = "banner" }: { size?: "banner" | "footer" }) {
  return (
    <a
      href="https://washautopanel.com"
      target="_blank"
      rel="noopener noreferrer"
      style={{ textDecoration: "none", display: "block" }}
    >
      <div style={{
        borderRadius: 16,
        overflow: "hidden",
        background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
        border: "1px solid rgba(245,166,35,0.35)",
        display: "flex",
        alignItems: "center",
        gap: size === "footer" ? 24 : 20,
        padding: size === "footer" ? "18px 28px" : "14px 22px",
        boxShadow: "0 4px 24px rgba(245,166,35,0.15)",
        cursor: "pointer",
        transition: "box-shadow .2s",
        minHeight: size === "footer" ? 90 : 72,
        position: "relative" as const,
      }}>
        {/* Glow accent */}
        <div style={{
          position: "absolute", right: -30, top: -30,
          width: 120, height: 120, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(245,166,35,0.18) 0%, transparent 70%)",
          pointerEvents: "none",
        }} />

        {/* Logo mark */}
        <div style={{
          width: size === "footer" ? 52 : 44,
          height: size === "footer" ? 52 : 44,
          borderRadius: 12,
          background: "linear-gradient(135deg, #F5A623, #d4891a)",
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
          boxShadow: "0 4px 12px rgba(245,166,35,0.40)",
        }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <rect x="2" y="8" width="20" height="13" rx="2" fill="white" opacity=".9"/>
            <path d="M6 8V6a6 6 0 0 1 12 0v2" stroke="white" strokeWidth="2" strokeLinecap="round" opacity=".9"/>
            <path d="M8 13h8M8 17h5" stroke="#F5A623" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
        </div>

        {/* Text */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: size === "footer" ? 17 : 15,
            fontWeight: 900,
            color: "#F5A623",
            letterSpacing: "-0.03em",
            lineHeight: 1.1,
            marginBottom: 3,
          }}>
            WASH AUTO PANEL
          </div>
          <div style={{
            fontSize: size === "footer" ? 13 : 12,
            color: "rgba(255,255,255,0.75)",
            fontWeight: 500,
            lineHeight: 1.3,
          }}>
            Limpieza integral de módulos fotovoltaicos
          </div>
        </div>

        {/* Stats (only on footer/large) */}
        {size === "footer" && (
          <div style={{ display: "flex", gap: 24, flexShrink: 0 }}>
            {[
              { val: "14.000 MW", lbl: "limpiados 2009–2024" },
              { val: "4.300 MW", lbl: "solo en 2025" },
            ].map((stat) => (
              <div key={stat.lbl} style={{ textAlign: "center" }}>
                <div style={{ fontSize: 15, fontWeight: 900, color: "#F5A623", letterSpacing: "-0.03em" }}>{stat.val}</div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", marginTop: 2 }}>{stat.lbl}</div>
              </div>
            ))}
          </div>
        )}

        {/* Contact */}
        <div style={{ flexShrink: 0, textAlign: "right" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.85)", lineHeight: 1.5 }}>
            653 903 026
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.85)", lineHeight: 1.5 }}>
            628 330 622
          </div>
          <div style={{
            marginTop: 4, fontSize: 10, fontWeight: 700,
            color: "#F5A623", textTransform: "uppercase" as const, letterSpacing: "0.06em",
          }}>
            washautopanel.com →
          </div>
        </div>
      </div>
    </a>
  );
}

function Logo() {
  return (
    <span className="sp-logo">
      <span className="sp-logo-dot" />
      SolarPR
      <span style={{ fontWeight: 300, opacity: 0.6 }}>Monitor</span>
    </span>
  );
}

/* ─── ACCESS SCREEN ───────────────────────────────────────────────────────── */

function AccessScreen({
  authMode, setAuthMode, signup, setSignup,
  loginEmail, setLoginEmail, loginPassword, setLoginPassword,
  forgotPassword, setForgotPassword,
  pwVis, setPwVis, confirmPwVis, setConfirmPwVis, loginPwVis, setLoginPwVis,
  onSignup, onLogin, onRequestPassword, notice,
}: {
  authMode: "login" | "signup"; setAuthMode: (m: "login" | "signup") => void;
  signup: UserAccount; setSignup: React.Dispatch<React.SetStateAction<UserAccount>>;
  loginEmail: string; setLoginEmail: (v: string) => void;
  loginPassword: string; setLoginPassword: (v: string) => void;
  forgotPassword: boolean; setForgotPassword: (v: boolean) => void;
  pwVis: boolean; setPwVis: (v: boolean) => void;
  confirmPwVis: boolean; setConfirmPwVis: (v: boolean) => void;
  loginPwVis: boolean; setLoginPwVis: (v: boolean) => void;
  onSignup: () => void; onLogin: () => void; onRequestPassword: () => void;
  notice: { type: "success" | "error"; text: string } | null;
}) {
  return (
    <div className="sp-page auth-hero">
      <GlobalStyles />
      <div className="sp-center" style={{ flex: "0 0 auto" }}>
        <nav className="sp-nav">
          <Logo />
        </nav>
      </div>

      <div className="sp-center" style={{ flex: 1, display: "flex", alignItems: "center" }}>
        <div className="auth-body">
          <div className="auth-pitch">
            <div className="auth-kicker">
              <span className="auth-kicker-dot" />
              Plataforma gratuita · España
            </div>
            <h1 className="auth-h1">
              Conoce el PR real<br />
              de tu <span>instalación</span>
            </h1>
            <p className="auth-sub">
              Sube tu curva quinceminutal, cruza con la radiación SIAR de tu provincia
              y obtén el Performance Ratio real de tu planta fotovoltaica.
            </p>
            <div className="auth-stats">
              {[
                { val: "96", lbl: "Muestras por día" },
                { val: "SIAR", lbl: "Radiación oficial" },
                { val: "PR%", lbl: "Resultado en segundos" },
              ].map((s) => (
                <div key={s.lbl}>
                  <div className="auth-stat-val">{s.val}</div>
                  <div className="auth-stat-lbl">{s.lbl}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="glass auth-card">
            <div className="auth-tabs">
              <button className={`auth-tab ${authMode === "login" ? "active" : ""}`}
                onClick={() => { setAuthMode("login"); setForgotPassword(false); }}>
                Iniciar sesión
              </button>
              <button className={`auth-tab ${authMode === "signup" ? "active" : ""}`}
                onClick={() => { setAuthMode("signup"); setForgotPassword(false); }}>
                Crear cuenta
              </button>
            </div>

            {authMode === "login" ? (
              <>
                <Field label="Correo electrónico" value={loginEmail} onChange={setLoginEmail}
                  type="email" placeholder="nombre@correo.com" />
                <PwField label="Contraseña" value={loginPassword} onChange={setLoginPassword}
                  visible={loginPwVis} onToggle={() => setLoginPwVis(!loginPwVis)}
                  disabled={forgotPassword} />
                <div className="forgot-row">
                  <input id="forgot" type="checkbox" checked={forgotPassword}
                    onChange={(e) => setForgotPassword(e.target.checked)} />
                  <label htmlFor="forgot">No recuerdo mi contraseña</label>
                </div>
                <button className="btn-primary" onClick={forgotPassword ? onRequestPassword : onLogin}>
                  {forgotPassword ? "Enviar código de recuperación" : "Entrar al dashboard"}
                </button>
              </>
            ) : (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 12px" }}>
                  <Field label="Nombre" value={signup.name}
                    onChange={(v) => setSignup((p) => ({ ...p, name: v, fullName: `${v} ${p.surname}`.trim() }))} />
                  <Field label="Apellido" value={signup.surname}
                    onChange={(v) => setSignup((p) => ({ ...p, surname: v, fullName: `${p.name} ${v}`.trim() }))} />
                </div>
                <Field label="Correo electrónico" value={signup.email}
                  onChange={(v) => setSignup((p) => ({ ...p, email: v }))}
                  type="email" placeholder="nombre@correo.com" />
                <PwField label="Contraseña" value={signup.password}
                  onChange={(v) => setSignup((p) => ({ ...p, password: v }))}
                  visible={pwVis} onToggle={() => setPwVis(!pwVis)} />
                <p className="pw-hint">Mínimo 12 caracteres · mayúscula · minúscula · número · símbolo</p>
                <PwField label="Confirmar contraseña" value={signup.confirmPassword}
                  onChange={(v) => setSignup((p) => ({ ...p, confirmPassword: v }))}
                  visible={confirmPwVis} onToggle={() => setConfirmPwVis(!confirmPwVis)} />
                <div className="consent-wrap">
                  <input id="rgpd" type="checkbox" checked={signup.rgpdAccepted}
                    onChange={(e) => setSignup((p) => ({ ...p, rgpdAccepted: e.target.checked }))} />
                  <label htmlFor="rgpd">
                    He leído y acepto la{" "}
                    <a href="/privacidad" target="_blank" rel="noopener noreferrer">Política de Privacidad</a>
                    . Autorizo el tratamiento de mis datos para prestar el servicio, conforme al RGPD.
                  </label>
                </div>
                <button className="btn-primary" onClick={onSignup}>Crear mi cuenta gratis</button>
              </>
            )}

            {notice && <div className={`sp-notice ${notice.type}`}>{notice.text}</div>}
          </div>
        </div>
      </div>

      <div className="sp-center" style={{ paddingBottom: 24 }}>
        <WashAutoPanelAd size="banner" />
      </div>
    </div>
  );
}

/* ─── REPORTS SCREEN ──────────────────────────────────────────────────────── */

function ReportsScreen({
  pr, avg7, monthlyAvg, estimatedLoss, zoneAvgPR,
  plantForm, uploaded, currentUser, analyzedDay, realProductionKwh,
}: {
  pr: number; avg7: number; monthlyAvg: number; estimatedLoss: number; zoneAvgPR: number;
  plantForm: PlantForm; uploaded: boolean; currentUser: UserAccount | null;
  analyzedDay: string; realProductionKwh: number | null;
}) {
  const [generating, setGenerating] = useState<string | null>(null);

  function generateCSV() {
    setGenerating("csv");
    const rows = [
      ["Métrica", "Valor", "Unidad"],
      ["Instalación", plantForm.plantName, ""],
      ["Provincia", plantForm.province, ""],
      ["Potencia pico", plantForm.peakPower, "kWp"],
      ["Fecha analizada", analyzedDay, ""],
      ["PR del día", pr, "%"],
      ["PR medio 7 días", avg7, "%"],
      ["PR medio mensual", monthlyAvg, "%"],
      ["PR referencia provincial", zoneAvgPR, "%"],
      ["Pérdida estimada", estimatedLoss, "€/mes"],
      ["Producción real", realProductionKwh ?? "N/D", "kWh"],
      ...mockHourly.map((h) => [`Producción ${h.time}`, h.real, "kWh"]),
      ...inverterData.map((inv) => [`PR inversor ${inv.name}`, inv.pr, "%"]),
    ];
    const csv = rows.map((r) => r.join(";")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `SolarPR_${plantForm.plantName}_${analyzedDay || "informe"}.csv`;
    a.click(); URL.revokeObjectURL(url);
    setTimeout(() => setGenerating(null), 800);
  }

  function generateHTML() {
    setGenerating("pdf");
    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<title>Informe SolarPR — ${plantForm.plantName}</title>
<style>
body{font-family:Arial,sans-serif;margin:0;padding:40px;color:#0b1120;background:#f4f7fc;}
h1{font-size:32px;font-weight:900;letter-spacing:-0.04em;margin-bottom:4px;}
.sub{color:#6b7fa0;font-size:14px;margin-bottom:32px;}
.kpi-row{display:flex;gap:16px;margin-bottom:28px;flex-wrap:wrap;}
.kpi{flex:1;min-width:120px;background:#fff;border-radius:12px;padding:16px;box-shadow:0 2px 8px rgba(0,0,0,.08);}
.kpi-l{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#6b7fa0;margin-bottom:4px;}
.kpi-v{font-size:26px;font-weight:900;color:#0b1120;}
.kpi-v.green{color:#008f52;} .kpi-v.amber{color:#d97706;} .kpi-v.red{color:#dc2626;}
h2{font-size:18px;font-weight:800;margin:28px 0 14px;border-top:1px solid #e2e8f0;padding-top:20px;}
table{width:100%;border-collapse:collapse;font-size:13px;}
th{background:#f1f5f9;padding:9px 12px;text-align:left;font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:#475569;}
td{padding:9px 12px;border-bottom:1px solid #f1f5f9;}
.badge{display:inline-block;padding:3px 8px;border-radius:999px;font-size:11px;font-weight:700;}
.ok{background:#dcfce7;color:#166534;} .warn{background:#fef3c7;color:#92400e;} .bad{background:#fee2e2;color:#991b1b;}
.footer{margin-top:40px;padding-top:16px;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8;}
@media print{body{padding:20px;} .no-print{display:none;}}
</style></head><body>
<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
  <div style="width:10px;height:10px;border-radius:50%;background:#00c471;"></div>
  <span style="font-size:16px;font-weight:800;letter-spacing:-.04em;">SolarPR Monitor</span>
</div>
<h1>Informe de Performance Ratio</h1>
<p class="sub">${plantForm.plantName} · ${plantForm.province} · ${analyzedDay || "Sin fecha"} · Generado: ${new Date().toLocaleDateString("es-ES")}</p>
<div class="kpi-row">
  <div class="kpi"><div class="kpi-l">PR del día</div><div class="kpi-v ${pr>=85?"green":pr>=75?"amber":"red"}">${pr}%</div></div>
  <div class="kpi"><div class="kpi-l">PR 7 días</div><div class="kpi-v">${avg7}%</div></div>
  <div class="kpi"><div class="kpi-l">PR mensual</div><div class="kpi-v">${monthlyAvg}%</div></div>
  <div class="kpi"><div class="kpi-l">Referencia prov.</div><div class="kpi-v">${zoneAvgPR}%</div></div>
  <div class="kpi"><div class="kpi-l">Pérdida estimada</div><div class="kpi-v ${estimatedLoss>0?"amber":"green"}">${estimatedLoss} €/mes</div></div>
  <div class="kpi"><div class="kpi-l">Potencia pico</div><div class="kpi-v">${plantForm.peakPower} kWp</div></div>
</div>
<h2>Producción horaria</h2>
<table><thead><tr><th>Hora</th><th>Real (kWh)</th><th>Esperado (kWh)</th><th>PR (%)</th><th>Pérdida (kWh)</th></tr></thead><tbody>
${mockHourly.map((h) => `<tr><td>${h.time}</td><td>${h.real}</td><td>${h.expected}</td><td>${h.pr}</td><td>${Math.max(0,h.expected-h.real)}</td></tr>`).join("")}
</tbody></table>
<h2>Estado de inversores</h2>
<table><thead><tr><th>Inversor</th><th>PR (%)</th><th>Estado</th></tr></thead><tbody>
${inverterData.map((inv) => `<tr><td>${inv.name}</td><td>${inv.pr}</td><td><span class="badge ${inv.status}">${inv.status==="ok"?"Óptimo":inv.status==="warn"?"Vigilancia":"Revisar"}</span></td></tr>`).join("")}
</tbody></table>
<h2>Evolución diaria del PR</h2>
<table><thead><tr><th>Día</th><th>PR (%)</th></tr></thead><tbody>
${mockDailyPR.map((v,i) => `<tr><td>Día ${i+1}</td><td>${v}%</td></tr>`).join("")}
</tbody></table>
<div class="footer">Informe generado por SolarPR Monitor · ${new Date().toLocaleString("es-ES")} · ${currentUser?.email || ""} · Datos de referencia: SIAR/MAPA</div>
</body></html>`;

    const blob = new Blob([html], { type: "text/html;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const w = window.open(url, "_blank");
    if (w) setTimeout(() => { w.print(); URL.revokeObjectURL(url); }, 800);
    else {
      const a = document.createElement("a");
      a.href = url; a.download = `SolarPR_${plantForm.plantName}_informe.html`; a.click();
      URL.revokeObjectURL(url);
    }
    setTimeout(() => setGenerating(null), 1000);
  }

  const prColor = pr >= 85 ? "var(--green)" : pr >= 75 ? "var(--amber)" : "var(--red)";
  const maxPR = Math.max(...mockDailyPR);

  if (!uploaded) {
    return (
      <div className="sp-wrap" style={{ paddingTop: 16, paddingBottom: 48 }}>
        <div className="report-hero">
          <h2 className="report-hero-title">Informes y descargas</h2>
          <p className="report-hero-sub">Sube un CSV/XLSX en el Dashboard para generar tu informe de PR.</p>
        </div>
        <div className="glass report-no-data">
          <div className="report-no-data-icon">📊</div>
          <div className="report-no-data-title">Sin datos aún</div>
          <div className="report-no-data-sub">Vuelve al Dashboard, configura tu instalación y sube la curva quinceminutal. Tu informe se genera automáticamente.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="sp-wrap" style={{ paddingTop: 16, paddingBottom: 48 }}>
      <div className="report-hero">
        <h2 className="report-hero-title">Informes y descargas</h2>
        <p className="report-hero-sub">{plantForm.plantName} · {plantForm.province} · {analyzedDay}</p>
      </div>

      {/* Preview */}
      <div className="report-preview glass">
        <div className="report-preview-header">
          <span className="report-preview-title">Vista previa del informe</span>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn-outline" style={{ fontSize: 12, padding: "7px 13px" }}
              onClick={generateCSV} disabled={generating === "csv"}>
              {generating === "csv" ? "Generando…" : "⬇ CSV"}
            </button>
            <button className="btn-dark" style={{ fontSize: 12, padding: "7px 13px" }}
              onClick={generateHTML} disabled={generating === "pdf"}>
              {generating === "pdf" ? "Generando…" : "⬇ PDF / Imprimir"}
            </button>
          </div>
        </div>
        <div className="report-preview-body">
          <div className="rp-kpi-row">
            {[
              { l: "PR del día", v: `${pr}%`, s: pr >= 85 ? "✅ Buen rendimiento" : "⚠ Por debajo del umbral" },
              { l: "PR 7 días", v: `${avg7}%`, s: "Media semanal" },
              { l: "PR mensual", v: `${monthlyAvg}%`, s: "Media mensual" },
              { l: "Ref. provincial", v: `${zoneAvgPR}%`, s: plantForm.province },
              { l: "Pérdida est.", v: `${estimatedLoss} €/mes`, s: estimatedLoss > 0 ? "Margen de mejora" : "Sin pérdidas" },
            ].map((k) => (
              <div className="rp-kpi" key={k.l}>
                <div className="rp-kpi-lbl">{k.l}</div>
                <div className="rp-kpi-val">{k.v}</div>
                <div className="rp-kpi-sub">{k.s}</div>
              </div>
            ))}
          </div>

          <div className="rp-chart-title">Evolución diaria del PR</div>
          <div className="rp-bars">
            {mockDailyPR.map((v, i) => (
              <div key={i} className="rp-bar"
                style={{
                  height: `${(v / maxPR) * 100}%`,
                  background: v >= 85 ? "var(--green)" : v >= 80 ? "var(--amber)" : "var(--red)",
                  opacity: 0.85,
                }} />
            ))}
          </div>

          <div className="rp-section-title">Diagnóstico</div>
          {[
            { icon: pr >= 85 ? "✅" : "⚠️", text: pr >= 85 ? "Rendimiento dentro del rango esperado." : "PR por debajo de la referencia provincial — se recomienda revisión." },
            { icon: "📍", text: `Referencia provincial (${plantForm.province}): ${zoneAvgPR}%. Tu instalación: ${pr}%.` },
            { icon: "🔋", text: `Potencia pico declarada: ${plantForm.peakPower} kWp.` },
          ].map((d, i) => (
            <div className="rp-diag-row" key={i}>
              <span className="rp-diag-icon">{d.icon}</span>
              <span className="rp-diag-text">{d.text}</span>
            </div>
          ))}

          <div className="rp-section-title">Inversores</div>
          {inverterData.map((inv) => (
            <div className="rp-inv-row" key={inv.name}>
              <span className="rp-inv-name">{inv.name}</span>
              <div className="rp-inv-bar-wrap">
                <div className="rp-inv-bar" style={{
                  width: `${inv.pr}%`,
                  background: inv.status === "ok" ? "var(--green)" : inv.status === "warn" ? "var(--amber)" : "var(--red)"
                }} />
              </div>
              <span className="rp-inv-val">{inv.pr}%</span>
            </div>
          ))}
        </div>
      </div>

      {/* Download cards */}
      <div className="report-grid">
        {[
          {
            icon: "📄", title: "Informe completo PDF", badge: "pdf", badgeTxt: "PDF",
            desc: "Informe ejecutivo con todos los KPIs, gráfica de producción horaria, ranking de inversores y diagnóstico. Listo para imprimir o enviar al cliente.",
            action: generateHTML, actionLabel: "Generar y abrir",
          },
          {
            icon: "📊", title: "Datos en CSV", badge: "csv", badgeTxt: "CSV",
            desc: "Exportación completa de todos los valores calculados: PR por hora, por día, benchmarks provinciales, pérdidas estimadas y estado de inversores.",
            action: generateCSV, actionLabel: "Descargar CSV",
          },
          {
            icon: "📋", title: "Resumen ejecutivo", badge: "pdf", badgeTxt: "PDF",
            desc: "Una sola página: el PR del día frente a la referencia provincial, la pérdida económica estimada y la recomendación de actuación. Ideal para el propietario.",
            action: generateHTML, actionLabel: "Generar PDF",
          },
        ].map((card) => (
          <div className="glass report-card" key={card.title}>
            <div className="report-card-icon">{card.icon}</div>
            <div className="report-card-title">{card.title}</div>
            <p className="report-card-desc">{card.desc}</p>
            <div className="report-card-meta">
              <span className={`report-card-badge ${card.badge}`}>{card.badgeTxt}</span>
              <button className="btn-dark" style={{ padding: "8px 14px", fontSize: 12 }}
                onClick={card.action} disabled={generating !== null}>
                {card.actionLabel}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── DASHBOARD SCREEN ────────────────────────────────────────────────────── */

function DashboardScreen({
  currentUser, plantForm, setPlantForm, stations, stationsLoading,
  selectedStation, dataSource, handleProvinceChange,
  uploaded, uploadMessage, onCsvUpload,
  pr, avg7, monthlyAvg, estimatedLoss, criticalInverters,
  zoneAvgPR, benchmarkText, diagnosis, stateLabel, stateColor, stateBg,
  canOfferService, onLogout,
  onRequestReview, reviewLoading, reviewMessage,
  analyzedDay, realProductionKwh,
}: {
  currentUser: UserAccount | null; plantForm: PlantForm;
  setPlantForm: React.Dispatch<React.SetStateAction<PlantForm>>;
  stations: StationOption[]; stationsLoading: boolean;
  selectedStation: StationOption | null; dataSource: DataSource;
  handleProvinceChange: (p: string) => void;
  uploaded: boolean;
  uploadMessage: { type: "success" | "error"; text: string } | null;
  onCsvUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  pr: number; avg7: number; monthlyAvg: number; estimatedLoss: number;
  criticalInverters: number; zoneAvgPR: number; benchmarkText: string;
  diagnosis: string; stateLabel: string; stateColor: string; stateBg: string;
  canOfferService: boolean; onLogout: () => void;
  onRequestReview: () => void; reviewLoading: boolean;
  reviewMessage: { type: "success" | "error" | "ok"; text: string } | null;
  analyzedDay: string; realProductionKwh: number | null;
}) {
  const [tab, setTab] = useState<"dashboard" | "reports">("dashboard");
  const prColor = pr >= 85 ? "var(--green-dk)" : pr >= 75 ? "#d97706" : "var(--red)";
  const prBarColor = pr >= 85 ? "var(--green)" : pr >= 75 ? "var(--amber)" : "var(--red)";
  const maxPR = Math.max(...mockDailyPR, 1);
  const initials = `${currentUser?.name?.[0] || ""}${currentUser?.surname?.[0] || ""}`.toUpperCase() || "U";

  return (
    <div className="sp-page" style={{ minHeight: "100vh" }}>
      <GlobalStyles />
      <div className="sp-wrap">
        <nav className="db-nav">
          <Logo />
          <div style={{ display: "flex", gap: 4 }}>
            {(["dashboard", "reports"] as const).map((t) => (
              <button key={t} className={`db-nav-tab ${tab === t ? "active" : ""}`}
                onClick={() => setTab(t)}>
                {t === "dashboard" ? "Dashboard" : "Informes"}
              </button>
            ))}
          </div>
          <div className="db-nav-right">
            <div className="db-user-chip">
              <div className="db-user-avatar">{initials}</div>
              {currentUser?.name}
            </div>
            <button className="btn-ghost" onClick={onLogout}>Salir</button>
          </div>
        </nav>

        {tab === "reports" ? (
          <ReportsScreen pr={pr} avg7={avg7} monthlyAvg={monthlyAvg}
            estimatedLoss={estimatedLoss} zoneAvgPR={zoneAvgPR}
            plantForm={plantForm} uploaded={uploaded} currentUser={currentUser}
            analyzedDay={analyzedDay} realProductionKwh={realProductionKwh} />
        ) : (
          <div className="db-grid">
            {/* ── LEFT COLUMN ── */}
            <div className="db-col-left">
              <div className="glass db-card">
                <div className="db-card-title">
                  <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg>
                  Instalación
                </div>
                <Field label="Nombre" value={plantForm.plantName}
                  onChange={(v) => setPlantForm((p) => ({ ...p, plantName: v }))} />
                <SelField label="Provincia" value={plantForm.province}
                  onChange={handleProvinceChange}
                  options={SPAIN_PROVINCES.map((p) => ({ value: p, label: p }))} />
                <SelField label="Estación de referencia"
                  value={selectedStation?.id || plantForm.stationId}
                  onChange={(v) => setPlantForm((p) => ({ ...p, stationId: v }))}
                  disabled={stationsLoading || stations.length === 0}
                  options={stationsLoading
                    ? [{ value: "", label: "Cargando…" }]
                    : stations.length > 0
                      ? stations.map((s) => ({ value: s.id, label: s.name }))
                      : [{ value: "", label: "Sin estaciones" }]} />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <Field label="Potencia pico (kWp)" value={plantForm.peakPower} type="number"
                    onChange={(v) => setPlantForm((p) => ({ ...p, peakPower: v }))} />
                  <SelField label="Estructura" value={plantForm.structureType}
                    onChange={(v) => setPlantForm((p) => ({ ...p, structureType: v as StructureType }))}
                    options={STRUCTURE_OPTIONS} />
                </div>
                {selectedStation && (
                  <div className="station-box">
                    <strong>{selectedStation.name}</strong> · PR medio provincial: <strong>{selectedStation.zoneAvgPR}%</strong>
                  </div>
                )}
                <div className={`source-box ${dataSource.mode === "api" ? "ok" : "warn"}`}>
                  <div className="source-box-title">Fuente: {dataSource.source}</div>
                  <div style={{ fontSize: 12 }}>{dataSource.note || "Radiación de referencia SIAR/MAPA."}</div>
                </div>
                <label className="upload-label">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
                  Subir CSV / XLSX quinceminutal
                  <input type="file" accept=".csv,.xlsx,.xls" onChange={onCsvUpload} />
                </label>
                {uploadMessage && (
                  <div className={`upload-feedback ${uploadMessage.type === "success" ? "ok" : "err"}`}>
                    {uploadMessage.text}
                  </div>
                )}
              </div>

              {canOfferService && (
                <div className="service-cta">
                  <div className="service-cta-title">🔧 Revisión técnica recomendada</div>
                  <div className="service-cta-body">
                    Tu instalación presenta margen de mejora. Un técnico especializado puede identificar y corregir las pérdidas detectadas.
                  </div>
                  <button className="service-cta-btn" onClick={onRequestReview} disabled={reviewLoading}>
                    {reviewLoading ? "Enviando…" : "Solicitar diagnóstico gratuito →"}
                  </button>
                  {reviewMessage && (
                    <div className={`service-cta-feedback ${reviewMessage.type === "ok" || reviewMessage.type === "success" ? "ok" : "err"}`}>
                      {reviewMessage.text}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── MID COLUMN ── */}
            <div className="db-col-mid">
              {/* PR Gauge */}
              <div className="glass db-card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div className="pr-gauge-wrap" style={{ flex: 1 }}>
                    <div className="pr-gauge-val" style={{ color: prColor }}>{pr}%</div>
                    <div className="pr-gauge-lbl">Performance Ratio del día</div>
                    <div className="pr-bar-track">
                      <div className="pr-bar-fill" style={{ width: `${Math.min(pr, 100)}%`, background: prBarColor }} />
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--ink-mute)" }}>
                      <span>0%</span><span>Referencia: {zoneAvgPR}%</span><span>100%</span>
                    </div>
                  </div>
                  <div style={{
                    padding: "7px 14px", borderRadius: 999,
                    background: stateBg, color: stateColor,
                    fontSize: 13, fontWeight: 700, marginLeft: 16, flexShrink: 0,
                  }}>{stateLabel}</div>
                </div>
              </div>

              {/* KPIs */}
              <div className="kpi-grid">
                {[
                  { l: "PR 7 días", v: `${avg7}%`, s: "Media semanal", cls: avg7 >= 85 ? "highlight" : avg7 >= 75 ? "warn" : "bad" },
                  { l: "PR mensual", v: `${monthlyAvg}%`, s: "Media mensual", cls: "" },
                  { l: "Pérdida estimada", v: estimatedLoss > 0 ? `${estimatedLoss} €/mes` : "0 €/mes", s: estimatedLoss > 0 ? "Impacto económico" : "Sin pérdidas detectadas", cls: estimatedLoss > 0 ? "warn" : "highlight" },
                  { l: "Inversores críticos", v: `${criticalInverters}`, s: "Por debajo del umbral 85%", cls: criticalInverters > 0 ? "bad" : "highlight" },
                  { l: "Benchmark prov.", v: `${zoneAvgPR}%`, s: plantForm.province, cls: "" },
                  { l: "Calidad del dato", v: "98%", s: "Serie casi completa", cls: "highlight" },
                  { l: "Percentil mercado", v: "93", s: "vs. instalaciones similares", cls: "" },
                  { l: "Confianza cálculo", v: "82%", s: "Índice del modelo", cls: "" },
                ].map((k) => (
                  <div key={k.l} className={`kpi ${k.cls}`}>
                    <div className="kpi-label">{k.l}</div>
                    <div className="kpi-value">{k.v}</div>
                    <div className="kpi-sub">{k.s}</div>
                  </div>
                ))}
              </div>

              {/* Producción real vs esperada */}
              <div className="glass db-card">
                <div className="db-card-title">
                  <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                  Producción real vs esperada
                </div>
                <div style={{ display: "flex", gap: 14, marginBottom: 14, fontSize: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ width: 12, height: 4, borderRadius: 2, background: "var(--green)" }} />
                    <span style={{ color: "var(--ink-soft)" }}>Real</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ width: 12, height: 4, borderRadius: 2, background: "#cbd5e1" }} />
                    <span style={{ color: "var(--ink-soft)" }}>Esperado</span>
                  </div>
                </div>
                {mockHourly.map((item) => {
                  const maxVal = 70;
                  const realW = Math.max((item.real / maxVal) * 100, 4);
                  const expW = Math.max((item.expected / maxVal) * 100, 4);
                  const loss = Math.max(0, item.expected - item.real);
                  return (
                    <div className="chart-row" key={item.time}>
                      <div className="chart-row-head">
                        <span className="chart-row-lbl">{item.time}</span>
                        <span className="chart-row-val">PR {item.pr}% · {loss > 0 ? `-${loss} kWh` : "sin pérdida"}</span>
                      </div>
                      <div className="bar-track"><div className="bar-real" style={{ width: `${realW}%` }} /></div>
                      <div className="bar-track"><div className="bar-exp" style={{ width: `${expW}%` }} /></div>
                    </div>
                  );
                })}
              </div>

              {/* Diagnosis + Inversores en 2 cols */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div className="glass db-card">
                  <div className="db-card-title">
                    <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 12l2 2 4-4M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"/></svg>
                    Diagnóstico
                  </div>
                  <div className="diag-block" style={{ background: "#fffbeb", border: "1.5px solid #fde68a" }}>
                    <div className="diag-block-title" style={{ color: "#92400e" }}>Resultado principal</div>
                    <div className="diag-block-body" style={{ color: "#92400e" }}>{diagnosis}</div>
                  </div>
                  <div className="diag-block" style={{ background: "#eff6ff", border: "1.5px solid #bfdbfe" }}>
                    <div className="diag-block-title" style={{ color: "#1d4ed8" }}>Comparación provincial</div>
                    <div className="diag-block-body" style={{ color: "#1d4ed8" }}>{benchmarkText}</div>
                  </div>
                </div>

                <div className="glass db-card">
                  <div className="db-card-title">
                    <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
                    Inversores
                  </div>
                  {inverterData.map((inv) => {
                    const bg = inv.status === "ok" ? "#dcfce7" : inv.status === "warn" ? "#fef3c7" : "#fee2e2";
                    const col = inv.status === "ok" ? "#166534" : inv.status === "warn" ? "#92400e" : "#991b1b";
                    return (
                      <div className="inv-row" key={inv.name}>
                        <div>
                          <div className="inv-name">{inv.name}</div>
                          <div className="inv-sub">{inv.pr >= 90 ? "Óptimo" : inv.pr >= 85 ? "Vigilancia" : "Revisar"}</div>
                        </div>
                        <span className="inv-badge" style={{ background: bg, color: col }}>{inv.pr}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Evolución diaria */}
              <div className="glass db-card">
                <div className="db-card-title">
                  <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
                  Evolución diaria del PR
                </div>
                <div className="sparkline">
                  {mockDailyPR.map((v, i) => (
                    <div key={i} className="spark-bar" style={{
                      height: `${(v / maxPR) * 100}%`,
                      background: v >= 85 ? "var(--green)" : v >= 80 ? "var(--amber)" : "var(--red)",
                    }} />
                  ))}
                </div>
                <div className="spark-labels">
                  <span>Día 1</span><span>Día {Math.ceil(mockDailyPR.length / 2)}</span><span>Día {mockDailyPR.length}</span>
                </div>
              </div>

              {/* Alertas */}
              <div className="glass db-card">
                <div className="db-card-title">
                  <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                  Alertas y anomalías
                </div>
                {mockHourly.filter((h) => h.pr < 88).length === 0 ? (
                  <div style={{ fontSize: 13, color: "var(--ink-mute)", textAlign: "center", padding: "12px 0" }}>Sin alertas activas.</div>
                ) : (
                  mockHourly.filter((h) => h.pr < 88).map((h) => (
                    <div className="alert-row" key={h.time}>
                      <div className="alert-dot" />
                      <div>
                        <div className="alert-time">{h.time} · PR {h.pr}%</div>
                        <div className="alert-msg">Posible desviación respecto al comportamiento esperado.</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* ── RIGHT COLUMN (ads) ── */}
            <div className="db-col-right">
              <AdSlot title="Servicios O&M" desc="Mantenimiento preventivo, limpieza de módulos, termografía e inspección de strings." size="300×250" />
              <AdSlot title="Software energético" desc="Plataformas de monitorización, SCADA, gestión de activos y analítica avanzada." size="300×600" tall />
              <AdSlot title="Seguros solares" desc="Cobertura de producción, daños materiales y responsabilidad civil para instalaciones FV." size="300×250" />
            </div>
          </div>
        )}

        {/* Footer ad */}
        <div className="footer-ad">
          <WashAutoPanelAd size="footer" />
        </div>
      </div>
    </div>
  );
}

/* ─── ROOT COMPONENT ──────────────────────────────────────────────────────── */

export default function Home() {
  const [screen, setScreen] = useState<"access" | "dashboard">("access");
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [pwVis, setPwVis] = useState(false);
  const [confirmPwVis, setConfirmPwVis] = useState(false);
  const [loginPwVis, setLoginPwVis] = useState(false);
  const [forgotPassword, setForgotPassword] = useState(false);

  const [stationsLoading, setStationsLoading] = useState(false);
  const [stations, setStations] = useState<StationOption[]>([]);
  const [dataSource, setDataSource] = useState<DataSource>({ mode: "unknown", source: "Pendiente", note: "" });

  const [signup, setSignup] = useState<UserAccount>({
    name: "", surname: "", fullName: "", email: "", password: "", confirmPassword: "",
    rgpdAccepted: false, installationType: "autoconsumo_residencial", province: "Madrid", peakPowerKw: "",
  });
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  const [plantForm, setPlantForm] = useState<PlantForm>({
    plantName: "Mi instalación FV", province: "Madrid", stationId: "", peakPower: "100", structureType: "fija",
  });

  const [uploaded, setUploaded] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [realProductionKwh, setRealProductionKwh] = useState<number | null>(null);
  const [realRadiationKwhM2, setRealRadiationKwhM2] = useState<number | null>(null);
  const [analyzedDay, setAnalyzedDay] = useState("");
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewMessage, setReviewMessage] = useState<{ type: "success" | "error" | "ok"; text: string } | null>(null);

  const selectedStation = useMemo(() => {
    if (stations.length === 0) return null;
    return stations.find((s) => s.id === plantForm.stationId) ?? stations[0];
  }, [stations, plantForm.stationId]);

  const peak = Number(plantForm.peakPower) || Number(currentUser?.peakPowerKw || "0") || 0;
  const dailyEnergy = mockHourly.reduce((a, h) => a + h.real, 0);
  const expectedEnergy = mockHourly.reduce((a, h) => a + h.expected, 0);
  const mockPr = expectedEnergy > 0 ? Math.round((dailyEnergy / expectedEnergy) * 100) : 0;

  const realExpectedKwh = realRadiationKwhM2 !== null && peak > 0 ? peak * realRadiationKwhM2 : 0;
  const realPr = realProductionKwh !== null && realExpectedKwh > 0 && realProductionKwh > 0
    ? Math.round((realProductionKwh / realExpectedKwh) * 100) : null;
  const pr = realPr !== null ? realPr : mockPr;

  const avg7 = Math.round(mockDailyPR.slice(-7).reduce((a, b) => a + b, 0) / 7);
  const monthlyAvg = Math.round(mockDailyPR.reduce((a, b) => a + b, 0) / mockDailyPR.length);
  const estimatedLoss = realPr !== null
    ? realPr < 70 ? Math.round(Math.max(0, realExpectedKwh * 0.7 - (realProductionKwh || 0)) * 0.06 * 30) : 0
    : pr < 87 ? Math.round((87 - pr) * peak * 1.6) : 0;
  const criticalInverters = inverterData.filter((i) => i.pr < 85).length;

  const zoneAvgPR = selectedStation?.zoneAvgPR || 0;
  const zoneGap = pr - zoneAvgPR;
  const benchmarkText = zoneGap >= 0
    ? `Tu instalación está ${zoneGap}% por encima de la referencia de ${plantForm.province}.`
    : `Tu instalación está ${Math.abs(zoneGap)}% por debajo de la referencia de ${plantForm.province}.`;

  const diagnosis = useMemo(() => {
    if (pr < 82) return "Posible problema relevante de rendimiento: revisar inversor, strings o suciedad persistente.";
    if (mockHourly.some((h) => ["12:00","13:00","14:00"].includes(h.time) && h.pr < 88))
      return "Se detecta caída en horas centrales. Posible clipping, suciedad o limitación parcial.";
    return "No se detectan anomalías severas. Se recomienda seguir monitorizando.";
  }, [pr]);

  const stateLabel = pr >= 90 ? "Óptimo" : pr >= 85 ? "Vigilancia" : "Revisar";
  const stateColor = pr >= 90 ? "#166534" : pr >= 85 ? "#92400e" : "#991b1b";
  const stateBg   = pr >= 90 ? "#dcfce7" : pr >= 85 ? "#fef3c7" : "#fee2e2";
  const canOfferService = pr < 85;

  async function loadStations(province: string) {
    setStationsLoading(true);
    try {
      const res = await fetch(`/api/siar/stations?province=${encodeURIComponent(province)}`);
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setStations([]); setDataSource({ mode: "unknown", source: "No disponible", note: data.message || "" }); return;
      }
      setDataSource({ mode: data.mode || "unknown", source: data.source || "SIAR/MAPA", note: data.note || "" });
      const loaded = (data.stations || []) as StationOption[];
      setStations(loaded);
      setPlantForm((p) => ({
        ...p, province,
        stationId: loaded.length > 0
          ? (p.province === province && loaded.some((s) => s.id === p.stationId) ? p.stationId : loaded[0].id)
          : "",
      }));
    } catch { setStations([]); setDataSource({ mode: "unknown", source: "Error", note: "Sin conexión." }); }
    finally { setStationsLoading(false); }
  }

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("solarpr-session");
      if (saved) {
        const parsed = JSON.parse(saved) as UserAccount;
        if (parsed?.email) {
          setCurrentUser(parsed);
          setPlantForm((p) => ({ ...p, province: parsed.province || p.province, peakPower: parsed.peakPowerKw || p.peakPower }));
          setScreen("dashboard");
          void loadStations(parsed.province || "Madrid");
          return;
        }
      }
    } catch { window.localStorage.removeItem("solarpr-session"); }
    loadStations("Madrid");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function saveSession(u: UserAccount) {
    try {
      const { password, confirmPassword, ...safe } = u;
      window.localStorage.setItem("solarpr-session", JSON.stringify({ ...safe, password: "", confirmPassword: "" }));
    } catch {}
  }

  async function fetchSiarRadiation(stationCode: string, day: Date) {
    const dd = String(day.getDate()).padStart(2, "0");
    const mm = String(day.getMonth() + 1).padStart(2, "0");
    const res = await fetch(`/api/siar/radiation?stationId=${encodeURIComponent(stationCode)}&date=${encodeURIComponent(`${dd}/${mm}/${day.getFullYear()}`)}`);
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.message || "Sin radiación SIAR.");
    const r = Number(data.radiationKwhM2);
    if (!Number.isFinite(r) || r <= 0) throw new Error("Radiación SIAR no válida.");
    return r;
  }

  async function handleCsvUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploadMessage(null); setUploaded(false); setRealProductionKwh(null); setRealRadiationKwhM2(null); setReviewMessage(null);
    try {
      let tableRows: unknown[][];
      if (file.name.toLowerCase().match(/\.xlsx?$/)) {
        const XLSX = await import("xlsx");
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: "array", cellDates: true });
        const sn = wb.SheetNames[0];
        if (!sn) { setUploadMessage({ type: "error", text: "Excel sin hojas." }); event.target.value = ""; return; }
        tableRows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sn], { header: 1, raw: true, defval: "" });
      } else {
        tableRows = parseCsvToTable(await file.text());
      }
      const result = validateFifteenMinuteTable(tableRows);
      if (!result.ok) { setUploadMessage({ type: "error", text: result.message }); event.target.value = ""; return; }
      const total = result.rows.reduce((s, r) => s + r.productionKwh, 0);
      const day = result.rows[0].timestamp;
      setAnalyzedDay(day.toLocaleDateString("es-ES"));
      setRealProductionKwh(total);
      const stationCode = (selectedStation as any)?.siarCode || "";
      if (!stationCode) {
        setUploaded(true);
        setUploadMessage({ type: "error", text: `${result.message} Producción: ${total.toFixed(2)} kWh. Sin estación SIAR asignada.` });
        event.target.value = ""; return;
      }
      let radiation: number;
      try { radiation = await fetchSiarRadiation(stationCode, day); }
      catch (e) {
        setUploaded(true);
        setUploadMessage({ type: "error", text: `${result.message} ${e instanceof Error ? e.message : "SIAR no disponible."}` });
        event.target.value = ""; return;
      }
      setRealRadiationKwhM2(radiation);
      setUploaded(true);
      setUploadMessage({ type: "success", text: `${result.message} · Producción: ${total.toFixed(2)} kWh · Radiación SIAR: ${radiation.toFixed(3)} kWh/m²` });
      try {
        await fetch("/api/save-installation", { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userEmail: currentUser?.email || "", userName: currentUser?.name || "", userSurname: currentUser?.surname || "",
            plantName: plantForm.plantName, province: plantForm.province, peakPowerKwp: plantForm.peakPower,
            siarStationId: stationCode, siarStationName: selectedStation?.name || "", siarStationProvince: plantForm.province,
            radiationKwhM2: radiation, analyzedDay: day.toISOString(), samples: result.rows.length,
            productionKwh: total, expectedKwh: Number(plantForm.peakPower) * radiation,
            calculatedPr: Number(plantForm.peakPower) * radiation > 0 ? Math.round((total / (Number(plantForm.peakPower) * radiation)) * 100) : 0,
            sourceFileName: file.name,
          })
        });
      } catch {}
    } catch (e) { setUploadMessage({ type: "error", text: "No se pudo leer el archivo." }); }
    finally { event.target.value = ""; }
  }

  async function handleRequestReview() {
    if (!currentUser?.email) { setReviewMessage({ type: "error", text: "Inicia sesión para solicitar el diagnóstico." }); return; }
    setReviewLoading(true); setReviewMessage(null);
    try {
      const res = await fetch("/api/request-review", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userEmail: currentUser.email, userName: currentUser.name, userSurname: currentUser.surname,
          plantName: plantForm.plantName, province: plantForm.province, peakPowerKwp: plantForm.peakPower,
          analyzedDay, productionKwh: realProductionKwh ?? 0, calculatedPr: pr, estimatedLossEurMonth: estimatedLoss,
        })
      });
      const data = await res.json();
      if (!res.ok || !data.ok) { setReviewMessage({ type: "error", text: data.message || "No se pudo enviar." }); return; }
      setReviewMessage({ type: "ok", text: "Solicitud enviada. Un técnico te contactará en 48h laborables." });
    } catch { setReviewMessage({ type: "error", text: "Error de conexión." }); }
    finally { setReviewLoading(false); }
  }

  function handleProvinceChange(province: string) {
    setPlantForm((p) => ({ ...p, province, stationId: "" }));
    void loadStations(province);
  }

  async function handleSignup() {
    setNotice(null);
    const name = signup.name.trim(), surname = signup.surname.trim(), email = signup.email.trim();
    const secure = signup.password.length >= 12 && signup.password.length <= 128
      && /[a-z]/.test(signup.password) && /[A-Z]/.test(signup.password)
      && /\d/.test(signup.password) && /[^A-Za-z0-9]/.test(signup.password);
    if (!name || !surname || !email) { setNotice({ type: "error", text: "Completa nombre, apellido y correo." }); return; }
    if (!secure) { setNotice({ type: "error", text: "La contraseña no cumple los requisitos de seguridad." }); return; }
    if (signup.password !== signup.confirmPassword) { setNotice({ type: "error", text: "Las contraseñas no coinciden." }); return; }
    if (!signup.rgpdAccepted) { setNotice({ type: "error", text: "Debes aceptar la Política de Privacidad." }); return; }
    try {
      const res = await fetch("/api/register-user", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, surname, email, password: signup.password, rgpdAccepted: true,
          privacyVersion: "2026-06-09", province: signup.province, peakPower: signup.peakPowerKw || "",
          plantName: INSTALLATION_OPTIONS.find((o) => o.value === signup.installationType)?.label || "Instalación FV" })
      });
      const data = await res.json();
      if (!res.ok || !data.ok) { setNotice({ type: "error", text: data.message || "No se pudo registrar." }); return; }
      setNotice({ type: "success", text: data.message || "Registro completado. Revisa tu correo para confirmar la cuenta." });
      setLoginEmail(email); setLoginPassword("");
      setSignup((p) => ({ ...p, name: "", surname: "", fullName: "", email: "", password: "", confirmPassword: "", rgpdAccepted: false }));
      setAuthMode("login");
    } catch { setNotice({ type: "error", text: "Error de conexión al registrar." }); }
  }

  async function handleLogin() {
    setNotice(null);
    try {
      const res = await fetch("/api/login", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }) });
      const data = await res.json();
      if (!res.ok || !data.ok) { setNotice({ type: "error", text: data.message || "Credenciales incorrectas." }); return; }
      const su = data.user || {};
      const found: UserAccount = {
        name: su.name || "", surname: su.surname || "",
        fullName: `${su.name || ""} ${su.surname || ""}`.trim(),
        email: su.email || loginEmail.trim().toLowerCase(),
        password: "", confirmPassword: "", rgpdAccepted: true,
        installationType: "autoconsumo_residencial",
        province: su.province || "Madrid", peakPowerKw: String(su.peakPowerKwp || ""),
      };
      setCurrentUser(found); saveSession(found);
      await loadStations(found.province);
      setPlantForm((p) => ({ ...p, province: found.province, peakPower: found.peakPowerKw || p.peakPower }));
      setScreen("dashboard");
    } catch { setNotice({ type: "error", text: "Error de conexión al iniciar sesión." }); }
  }

  async function handleRequestPassword() {
    setNotice(null);
    try {
      const res = await fetch("/api/request-password-reset", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginEmail }) });
      const data = await res.json();
      if (!res.ok || !data.ok) { setNotice({ type: "error", text: data.message || "No se pudo enviar." }); return; }
      setNotice({ type: "success", text: "Si el correo existe, recibirás un código en tu bandeja de entrada." });
      setForgotPassword(false); setLoginPassword("");
    } catch { setNotice({ type: "error", text: "Error de conexión." }); }
  }

  function handleLogout() {
    window.localStorage.removeItem("solarpr-session");
    setCurrentUser(null); setScreen("access"); setAuthMode("login");
    setLoginPassword(""); setLoginPwVis(false); setForgotPassword(false); setNotice(null); setUploaded(false);
    setRealProductionKwh(null); setRealRadiationKwhM2(null); setUploadMessage(null); setReviewMessage(null);
  }

  if (screen === "access") {
    return (
      <AccessScreen
        authMode={authMode} setAuthMode={setAuthMode}
        signup={signup} setSignup={setSignup}
        loginEmail={loginEmail} setLoginEmail={setLoginEmail}
        loginPassword={loginPassword} setLoginPassword={setLoginPassword}
        forgotPassword={forgotPassword} setForgotPassword={setForgotPassword}
        pwVis={pwVis} setPwVis={setPwVis}
        confirmPwVis={confirmPwVis} setConfirmPwVis={setConfirmPwVis}
        loginPwVis={loginPwVis} setLoginPwVis={setLoginPwVis}
        onSignup={handleSignup} onLogin={handleLogin} onRequestPassword={handleRequestPassword}
        notice={notice}
      />
    );
  }

  return (
    <DashboardScreen
      currentUser={currentUser} plantForm={plantForm} setPlantForm={setPlantForm}
      stations={stations} stationsLoading={stationsLoading} selectedStation={selectedStation}
      dataSource={dataSource} handleProvinceChange={handleProvinceChange}
      uploaded={uploaded} uploadMessage={uploadMessage} onCsvUpload={handleCsvUpload}
      pr={pr} avg7={avg7} monthlyAvg={monthlyAvg} estimatedLoss={estimatedLoss}
      criticalInverters={criticalInverters} zoneAvgPR={zoneAvgPR}
      benchmarkText={benchmarkText} diagnosis={diagnosis}
      stateLabel={stateLabel} stateColor={stateColor} stateBg={stateBg}
      canOfferService={canOfferService} onLogout={handleLogout}
      onRequestReview={handleRequestReview} reviewLoading={reviewLoading} reviewMessage={reviewMessage}
      analyzedDay={analyzedDay} realProductionKwh={realProductionKwh}
    />
  );
}
