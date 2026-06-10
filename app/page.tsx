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
  fullName: string;
  email: string;
  installationType: InstallationType;
  province: string;
  password: string;
  company?: string;
  phone?: string;
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

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder = "",
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <div className="field-wrap">
      <label className="field-label">{label}</label>
      <input
        className="field-input"
        type={type}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function EyeOpenIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function EyeClosedIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M3 3l18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path
        d="M10.6 10.7a3 3 0 0 0 4 4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M9.9 5.2A11 11 0 0 1 12 5c6.5 0 10 7 10 7a17.2 17.2 0 0 1-3.2 4.2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6.7 6.7C4.2 8.1 2.6 10.6 2 12c0 0 3.5 7 10 7 1.8 0 3.3-.4 4.6-1"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PasswordField({
  label,
  value,
  onChange,
  visible,
  onToggle,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  visible: boolean;
  onToggle: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="field-wrap">
      <label className="field-label">{label}</label>
      <div className="password-input-wrap">
        <input
          className="field-input with-icon"
          type={visible ? "text" : "password"}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />
        <button
          type="button"
          className="password-icon-btn"
          onClick={onToggle}
          aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
          title={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
        >
          {visible ? <EyeClosedIcon /> : <EyeOpenIcon />}
        </button>
      </div>
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  disabled?: boolean;
}) {
  return (
    <div className="field-wrap">
      <label className="field-label">{label}</label>
      <select
        className="field-select"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      >
        {options.map((option) => (
          <option key={`${label}-${option.value}`} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function StatCard({
  title,
  value,
  subtitle,
}: {
  title: string;
  value: string;
  subtitle: string;
}) {
  return (
    <div className="stat-card">
      <div className="stat-title">{title}</div>
      <div className="stat-value">{value}</div>
      <div className="stat-subtitle">{subtitle}</div>
    </div>
  );
}


function AdSlot({
  title,
  description,
  size = "970x90",
}: {
  title: string;
  description: string;
  size?: string;
}) {
  return (
    <div className="ad-slot">
      <div className="ad-badge">Publicidad</div>
      <div className="ad-title">{title}</div>
      <div className="ad-description">{description}</div>
      <div className="ad-size">{size}</div>
    </div>
  );
}


function WashAutoPanelAd() {
  return (
    <a
      className="ad-slot tall wash-auto-panel-ad"
      href="https://washautopanel.com/"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Visitar la web de Wash Auto Panel"
    >
      <div className="ad-badge">Publicidad</div>

      <div className="wash-ad-visual" aria-hidden="true">
        <div className="wash-ad-sun" />
        <div className="wash-ad-panels">
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
        </div>
      </div>

      <div className="wash-ad-brand">WASH AUTO PANEL</div>
      <div className="ad-title">Limpieza integral de módulos fotovoltaicos</div>

      <div className="wash-ad-benefits">
        <span>Ecológico</span>
        <span>Mayor rendimiento</span>
        <span>Limpieza flexible</span>
      </div>

      <div className="wash-ad-contact">
        <strong>Contacto</strong>
        <span>653 903 026 · 628 330 622</span>
        <span>comercial@washautopanel.com</span>
      </div>

      <div className="wash-ad-cta">Visitar web →</div>
    </a>
  );
}

function SolarVisualStyles() {
  return (
    <style>{`
      .solar-page {
        min-height: 100vh;
        background-image:
          linear-gradient(rgba(2, 6, 23, 0.68), rgba(2, 6, 23, 0.82)),
          url("/solar-bg.png");
        background-size: cover;
        background-position: center;
        background-repeat: no-repeat;
        background-attachment: fixed;
      }

      .page-overlay {
        min-height: 100vh;
        width: 100%;
        padding: 32px 20px 48px;
        backdrop-filter: blur(2px);
      }

      .auth-shell,
      .dashboard-shell {
        color: #0f172a;
      }

      .auth-grid {
        max-width: 1180px;
        margin: 0 auto;
        display: grid;
        grid-template-columns: minmax(0, 1fr) 430px;
        gap: 28px;
        align-items: center;
      }

      .hero-card,
      .dashboard-hero,
      .card,
      .stat-card,
      .station-box,
      .success-box,
      .inv-card,
      .alert-card,
      .ad-slot {
        box-shadow: 0 22px 60px rgba(15, 23, 42, 0.25);
      }

      .hero-card,
      .dashboard-hero,
      .card,
      .stat-card {
        background: rgba(255, 255, 255, 0.93);
        backdrop-filter: blur(12px);
        border: 1px solid rgba(255, 255, 255, 0.55);
      }

      .hero-card {
        border-radius: 32px;
        padding: 42px;
        min-height: 420px;
        display: flex;
        flex-direction: column;
        justify-content: center;
      }

      .hero-kicker {
        display: inline-flex;
        width: fit-content;
        margin-bottom: 14px;
        padding: 8px 12px;
        border-radius: 999px;
        background: rgba(20, 184, 166, 0.16);
        color: #0f766e;
        font-size: 13px;
        font-weight: 800;
        letter-spacing: 0.02em;
        text-transform: uppercase;
      }

      .hero-title {
        margin: 0 0 14px;
        color: #0f172a;
        font-size: clamp(40px, 6vw, 72px);
        line-height: 0.95;
        letter-spacing: -0.055em;
      }

      .hero-text {
        color: #334155;
        font-size: 17px;
        line-height: 1.65;
      }

      .card {
        border-radius: 28px;
        padding: 28px;
      }

      .section-title {
        color: #0f172a;
        letter-spacing: -0.03em;
      }

      .section-text {
        color: #475569;
      }

      .primary-btn {
        background: linear-gradient(135deg, #0f766e, #16a34a);
        box-shadow: 0 12px 24px rgba(15, 118, 110, 0.24);
      }

      .primary-btn:hover {
        filter: brightness(1.04);
        transform: translateY(-1px);
      }

      .dashboard-container {
        width: min(1580px, 100%);
        margin: 0 auto;
      }

      .dashboard-hero {
        border-radius: 32px;
        padding: 32px;
        margin-bottom: 22px;
      }

      .dashboard-top {
        gap: 18px;
      }

      .ad-row {
        margin: 0 0 24px;
      }

      .auth-ad {
        max-width: 1180px;
        margin: 24px auto 0;
      }

      .dashboard-grid {
        display: grid;
        grid-template-columns: 380px minmax(0, 1fr) 320px;
        gap: 24px;
        align-items: start;
      }

      .main-results {
        min-width: 0;
      }

      .sidebar-ads {
        display: flex;
        flex-direction: column;
        gap: 20px;
        position: sticky;
        top: 20px;
      }

      .ad-slot {
        position: relative;
        overflow: hidden;
        border-radius: 24px;
        padding: 24px;
        min-height: 140px;
        background:
          linear-gradient(135deg, rgba(255, 255, 255, 0.96), rgba(240, 253, 250, 0.94));
        border: 2px dashed rgba(15, 118, 110, 0.42);
        backdrop-filter: blur(12px);
      }

      .ad-slot::after {
        content: "";
        position: absolute;
        right: -40px;
        bottom: -45px;
        width: 130px;
        height: 130px;
        border-radius: 999px;
        background: rgba(20, 184, 166, 0.12);
      }

      .ad-badge {
        display: inline-block;
        margin-bottom: 12px;
        padding: 7px 11px;
        border-radius: 999px;
        font-size: 12px;
        font-weight: 800;
        background: #dbeafe;
        color: #1d4ed8;
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }

      .ad-title {
        position: relative;
        z-index: 1;
        font-size: 19px;
        font-weight: 900;
        color: #0f172a;
        margin-bottom: 8px;
      }

      .ad-description {
        position: relative;
        z-index: 1;
        font-size: 14px;
        line-height: 1.55;
        color: #475569;
        margin-bottom: 14px;
      }

      .ad-size {
        position: relative;
        z-index: 1;
        display: inline-flex;
        padding: 6px 10px;
        border-radius: 999px;
        font-size: 13px;
        font-weight: 800;
        color: #0f766e;
        background: rgba(204, 251, 241, 0.8);
      }

      .ad-slot.tall {
        min-height: 420px;
      }


      .wash-auto-panel-ad {
        display: block;
        text-decoration: none;
        color: inherit;
        border: 1px solid rgba(14, 116, 144, 0.28);
        background:
          linear-gradient(180deg, rgba(239, 249, 255, 0.98), rgba(255, 255, 255, 0.97));
        transition: transform 0.2s ease, box-shadow 0.2s ease;
      }

      .wash-auto-panel-ad:hover {
        transform: translateY(-3px);
        box-shadow: 0 26px 64px rgba(15, 23, 42, 0.30);
      }

      .wash-ad-visual {
        position: relative;
        height: 128px;
        margin: -4px -4px 18px;
        overflow: hidden;
        border-radius: 18px;
        background:
          linear-gradient(180deg, #bae6fd 0%, #e0f2fe 60%, #dbeafe 100%);
      }

      .wash-ad-sun {
        position: absolute;
        top: 16px;
        right: 20px;
        width: 42px;
        height: 42px;
        border-radius: 999px;
        background: #facc15;
        box-shadow: 0 0 28px rgba(250, 204, 21, 0.65);
      }

      .wash-ad-panels {
        position: absolute;
        left: 16px;
        right: 16px;
        bottom: 14px;
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 5px;
        transform: perspective(240px) rotateX(12deg);
      }

      .wash-ad-panels span {
        height: 34px;
        border-radius: 4px;
        border: 1px solid rgba(255, 255, 255, 0.68);
        background:
          linear-gradient(90deg, transparent 48%, rgba(255,255,255,0.35) 50%, transparent 52%),
          linear-gradient(180deg, #075985, #0c4a6e);
        box-shadow: inset 0 0 0 1px rgba(14, 165, 233, 0.16);
      }

      .wash-ad-brand {
        position: relative;
        z-index: 1;
        margin-bottom: 8px;
        font-size: 13px;
        font-weight: 900;
        letter-spacing: 0.09em;
        color: #0369a1;
      }

      .wash-ad-benefits {
        position: relative;
        z-index: 1;
        display: flex;
        flex-wrap: wrap;
        gap: 7px;
        margin: 14px 0 18px;
      }

      .wash-ad-benefits span {
        padding: 6px 9px;
        border-radius: 999px;
        background: #e0f2fe;
        color: #075985;
        font-size: 12px;
        font-weight: 800;
      }

      .wash-ad-contact {
        position: relative;
        z-index: 1;
        display: flex;
        flex-direction: column;
        gap: 4px;
        padding: 13px;
        border-radius: 14px;
        background: rgba(255, 255, 255, 0.84);
        border: 1px solid rgba(14, 116, 144, 0.18);
        color: #334155;
        font-size: 13px;
        line-height: 1.4;
      }

      .wash-ad-contact strong {
        color: #0f172a;
      }

      .wash-ad-cta {
        position: relative;
        z-index: 1;
        display: inline-flex;
        margin-top: 16px;
        padding: 9px 13px;
        border-radius: 999px;
        background: #0369a1;
        color: white;
        font-size: 13px;
        font-weight: 900;
      }

      .ad-slot.compact {
        min-height: 120px;
      }

      @media (max-width: 1280px) {
        .dashboard-grid {
          grid-template-columns: 360px minmax(0, 1fr);
        }

        .sidebar-ads {
          grid-column: 1 / -1;
          position: static;
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }

        .ad-slot.tall {
          min-height: 180px;
        }
      }

      @media (max-width: 900px) {
        .page-overlay {
          padding: 20px 14px 36px;
        }

        .auth-grid,
        .dashboard-grid,
        .sidebar-ads {
          grid-template-columns: 1fr;
        }

        .hero-card {
          min-height: auto;
          padding: 30px;
        }
      }
    `}</style>
  );
}

function AccessScreen({
  authMode,
  setAuthMode,
  signup,
  setSignup,
  loginEmail,
  setLoginEmail,
  loginPassword,
  setLoginPassword,
  forgotPassword,
  setForgotPassword,
  signupPasswordVisible,
  setSignupPasswordVisible,
  loginPasswordVisible,
  setLoginPasswordVisible,
  onSignup,
  onLogin,
  onRequestPassword,
  notice,
}: {
  authMode: "login" | "signup";
  setAuthMode: (mode: "login" | "signup") => void;
  signup: UserAccount;
  setSignup: React.Dispatch<React.SetStateAction<UserAccount>>;
  loginEmail: string;
  setLoginEmail: (value: string) => void;
  loginPassword: string;
  setLoginPassword: (value: string) => void;
  forgotPassword: boolean;
  setForgotPassword: (value: boolean) => void;
  signupPasswordVisible: boolean;
  setSignupPasswordVisible: (value: boolean) => void;
  loginPasswordVisible: boolean;
  setLoginPasswordVisible: (value: boolean) => void;
  onSignup: () => void;
  onLogin: () => void;
  onRequestPassword: () => void;
  notice: { type: "success" | "error"; text: string } | null;
}) {
  return (
    <main className="solar-page auth-shell">
      <SolarVisualStyles />
      <div className="page-overlay">
        <div className="auth-grid">
        <div className="hero-card">
          <div className="hero-kicker">Plataforma gratuita PR fotovoltaico</div>
          <h1 className="hero-title">SolarPR Monitor</h1>
          <div className="hero-text">
            Consulta el PR de tu instalación, compara tu rendimiento con la referencia
            de tu provincia y detecta posibles pérdidas de producción en segundos.
          </div>
        </div>

        <div className="card">
          <div className="tabs">
            <button
              type="button"
              className={`tab-btn ${authMode === "login" ? "active" : ""}`}
              onClick={() => {
                setAuthMode("login");
                setForgotPassword(false);
              }}
            >
              Iniciar sesión
            </button>

            <button
              type="button"
              className={`tab-btn ${authMode === "signup" ? "active" : ""}`}
              onClick={() => {
                setAuthMode("signup");
                setForgotPassword(false);
              }}
            >
              Crear cuenta
            </button>
          </div>

          {authMode === "login" ? (
            <>
              <h2 className="section-title">Acceso</h2>
              <div className="section-text">
                Introduce tus datos o solicita una nueva contraseña si no la recuerdas.
              </div>

              <Field
                label="Correo electrónico"
                value={loginEmail}
                onChange={setLoginEmail}
                type="email"
                placeholder="nombre@correo.com"
              />

              <PasswordField
                label="Contraseña"
                value={loginPassword}
                onChange={setLoginPassword}
                visible={loginPasswordVisible}
                onToggle={() => setLoginPasswordVisible(!loginPasswordVisible)}
                disabled={forgotPassword}
              />

              <div className="info-box">
                <input
                  id="forgot-password"
                  type="checkbox"
                  checked={forgotPassword}
                  onChange={(e) => setForgotPassword(e.target.checked)}
                  style={{ marginTop: 3 }}
                />
                <label htmlFor="forgot-password" style={{ fontSize: 14, color: "#334155" }}>
                  Solicitar nueva contraseña si no recuerdo la actual.
                </label>
              </div>

              <button
                type="button"
                className="primary-btn"
                onClick={forgotPassword ? onRequestPassword : onLogin}
              >
                {forgotPassword ? "Solicitar nueva contraseña" : "Entrar"}
              </button>
            </>
          ) : (
            <>
              <h2 className="section-title">Crear cuenta</h2>
              <div className="section-text">
                Debes registrarte antes de acceder al dashboard.
              </div>

              <Field
                label="Nombre y apellidos"
                value={signup.fullName}
                onChange={(v) => setSignup((prev) => ({ ...prev, fullName: v }))}
              />

              <Field
                label="Correo electrónico"
                value={signup.email}
                onChange={(v) => setSignup((prev) => ({ ...prev, email: v }))}
                type="email"
                placeholder="nombre@correo.com"
              />

              <SelectField
                label="Tipo de instalación"
                value={signup.installationType}
                onChange={(v) =>
                  setSignup((prev) => ({
                    ...prev,
                    installationType: v as InstallationType,
                  }))
                }
                options={INSTALLATION_OPTIONS}
              />

              <SelectField
                label="Provincia"
                value={signup.province}
                onChange={(v) => setSignup((prev) => ({ ...prev, province: v }))}
                options={SPAIN_PROVINCES.map((province) => ({
                  value: province,
                  label: province,
                }))}
              />

              <PasswordField
                label="Contraseña"
                value={signup.password}
                onChange={(v) => setSignup((prev) => ({ ...prev, password: v }))}
                visible={signupPasswordVisible}
                onToggle={() => setSignupPasswordVisible(!signupPasswordVisible)}
              />

              <Field
                label="Teléfono (opcional)"
                value={signup.phone ?? ""}
                onChange={(v) => setSignup((prev) => ({ ...prev, phone: v }))}
              />

              <Field
                label="Empresa (opcional)"
                value={signup.company ?? ""}
                onChange={(v) => setSignup((prev) => ({ ...prev, company: v }))}
              />

              <Field
                label="Potencia pico aproximada en kWp (opcional)"
                value={signup.peakPowerKw ?? ""}
                onChange={(v) => setSignup((prev) => ({ ...prev, peakPowerKw: v }))}
                type="number"
              />

              <button type="button" className="primary-btn" onClick={onSignup}>
                Registrarme
              </button>
            </>
          )}

          {notice ? <div className={`notice ${notice.type}`}>{notice.text}</div> : null}
        </div>
        </div>

        <div className="auth-ad">
          <AdSlot
            title="Espacio publicitario superior"
            description="Banner reservado para patrocinadores, empresas de mantenimiento, seguros solares o software energético."
            size="970x90"
          />
        </div>
      </div>
    </main>
  );
}

function DashboardScreen({
  currentUser,
  plantForm,
  setPlantForm,
  stations,
  stationsLoading,
  selectedStation,
  dataSource,
  handleProvinceChange,
  uploaded,
  setUploaded,
  pr,
  avg7,
  monthlyAvg,
  estimatedLoss,
  criticalInverters,
  zoneAvgPR,
  benchmarkText,
  diagnosis,
  stateLabel,
  stateColor,
  stateBg,
  canOfferService,
  onLogout,
}: {
  currentUser: UserAccount | null;
  plantForm: PlantForm;
  setPlantForm: React.Dispatch<React.SetStateAction<PlantForm>>;
  stations: StationOption[];
  stationsLoading: boolean;
  selectedStation: StationOption | null;
  dataSource: DataSource;
  handleProvinceChange: (province: string) => void;
  uploaded: boolean;
  setUploaded: (value: boolean) => void;
  pr: number;
  avg7: number;
  monthlyAvg: number;
  estimatedLoss: number;
  criticalInverters: number;
  zoneAvgPR: number;
  benchmarkText: string;
  diagnosis: string;
  stateLabel: string;
  stateColor: string;
  stateBg: string;
  canOfferService: boolean;
  onLogout: () => void;
}) {
  return (
    <main className="solar-page dashboard-shell">
      <SolarVisualStyles />
      <div className="page-overlay">
        <div className="dashboard-container">
        <div className="dashboard-hero">
          <div className="hero-kicker">Dashboard PR fotovoltaico</div>
          <h1 className="hero-title">SolarPR Monitor</h1>

          <div className="dashboard-top">
            <div className="hero-text" style={{ maxWidth: 820 }}>
              Sesión iniciada como <strong>{currentUser?.fullName}</strong>. Provincia principal:{" "}
              <strong>{currentUser?.province}</strong>.
            </div>

            <button type="button" className="logout-btn" onClick={onLogout}>
              Cerrar sesión
            </button>
          </div>
        </div>

        <div className="ad-row">
          <AdSlot
            title="Banner principal de patrocinador"
            description="Espacio reservado para campañas, patrocinadores o anunciantes del sector fotovoltaico."
            size="970x90"
          />
        </div>

        <div className="dashboard-grid">
          <div className="card">
            <h2 className="section-title" style={{ fontSize: 26 }}>
              Configuración de consulta
            </h2>

            <div className="section-text">
              Elige provincia, estación y estructura para preparar la consulta del PR.
            </div>

            <Field
              label="Nombre de la instalación"
              value={plantForm.plantName}
              onChange={(v) => setPlantForm((prev) => ({ ...prev, plantName: v }))}
            />

            <SelectField
              label="Provincia"
              value={plantForm.province}
              onChange={handleProvinceChange}
              options={SPAIN_PROVINCES.map((province) => ({
                value: province,
                label: province,
              }))}
            />

            <SelectField
              label="Estación meteorológica"
              value={selectedStation?.id || plantForm.stationId}
              onChange={(v) => setPlantForm((prev) => ({ ...prev, stationId: v }))}
              disabled={stationsLoading || stations.length === 0}
              options={
                stationsLoading
                  ? [{ value: "", label: "Cargando estaciones..." }]
                  : stations.length > 0
                  ? stations.map((station) => ({
                      value: station.id,
                      label: station.name,
                    }))
                  : [{ value: "", label: "No hay estaciones para esta provincia" }]
              }
            />

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <Field
                label="Potencia pico (kWp)"
                value={plantForm.peakPower}
                onChange={(v) => setPlantForm((prev) => ({ ...prev, peakPower: v }))}
                type="number"
              />

              <SelectField
                label="Estructura"
                value={plantForm.structureType}
                onChange={(v) =>
                  setPlantForm((prev) => ({
                    ...prev,
                    structureType: v as StructureType,
                  }))
                }
                options={STRUCTURE_OPTIONS}
              />
            </div>

            <div className="station-box">
              <div style={{ fontWeight: 700, marginBottom: 6 }}>
                Referencia meteorológica seleccionada
              </div>

              {selectedStation ? (
                <div style={{ color: "#475569", fontSize: 14 }}>
                  {plantForm.province} · {selectedStation.name} · PR medio provincial de referencia{" "}
                  {selectedStation.zoneAvgPR}%
                </div>
              ) : (
                <div style={{ color: "#475569", fontSize: 14 }}>
                  {stationsLoading
                    ? "Cargando estaciones para la provincia seleccionada."
                    : "Aún no hay estaciones cargadas para la provincia seleccionada."}
                </div>
              )}
            </div>

            <div
              style={{
                marginTop: 14,
                borderRadius: 18,
                padding: 14,
                background: dataSource.mode === "api" ? "#dcfce7" : "#fef3c7",
                border:
                  dataSource.mode === "api"
                    ? "1px solid #86efac"
                    : "1px solid #fde68a",
                color: dataSource.mode === "api" ? "#166534" : "#92400e",
                fontSize: 14,
                lineHeight: 1.5,
              }}
            >
              <div style={{ fontWeight: 800, marginBottom: 4 }}>
                Fuente de datos: {dataSource.source}
              </div>

              <div>
                {dataSource.mode === "api"
                  ? "Consulta conectada a la API protegida de SIAR/MAPA."
                  : "Modo preproducción: estaciones de respaldo mientras se habilita el token API SIAR."}
              </div>
            </div>

            <button
              type="button"
              className="primary-btn"
              onClick={() => setUploaded(true)}
            >
              Simular subida de CSV
            </button>

            {uploaded ? (
              <div className="success-box">
                Archivo validado correctamente. Se han detectado 96 registros de 15
                minutos y cobertura completa.
              </div>
            ) : null}
          </div>

          <div className="main-results">
            <div className="stat-grid">
              <StatCard title="PR del día" value={`${pr}%`} subtitle={`Estado: ${stateLabel}`} />
              <StatCard title="PR medio 7 días" value={`${avg7}%`} subtitle="Seguimiento semanal" />
              <StatCard title="PR medio mensual" value={`${monthlyAvg}%`} subtitle="Visión de tendencia" />
              <StatCard
                title="Pérdida estimada"
                value={estimatedLoss > 0 ? `${estimatedLoss} €/mes` : "0 €/mes"}
                subtitle="Estimación de impacto económico"
              />
            </div>

            <div className="stat-grid">
              <StatCard title="Benchmark provincia" value={`${zoneAvgPR}%`} subtitle={benchmarkText} />
              <StatCard title="Percentil mercado" value="93" subtitle="Comparativa con instalaciones similares" />
              <StatCard title="Inversores críticos" value={`${criticalInverters}`} subtitle="Equipos por debajo del umbral" />
              <StatCard title="Calidad del dato" value="98%" subtitle="Serie casi completa" />
            </div>

            <div className="two-col">
              <div className="card">
                <h2 className="section-title" style={{ fontSize: 26 }}>
                  Producción real vs esperada
                </h2>

                <div className="section-text">
                  Resumen horario de ejemplo para la instalación.
                </div>

                {mockHourly.map((item) => {
                  const realWidth = Math.max((item.real / 70) * 100, 8);
                  const expectedWidth = Math.max((item.expected / 70) * 100, 8);
                  const loss = item.expected - item.real;

                  return (
                    <div key={item.time} style={{ marginBottom: 16 }}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          marginBottom: 8,
                          fontSize: 14,
                        }}
                      >
                        <span style={{ fontWeight: 600 }}>{item.time}</span>
                        <span style={{ color: "#64748b" }}>
                          PR {item.pr}% · pérdida {loss > 0 ? loss : 0} kWh
                        </span>
                      </div>

                      <div style={{ marginBottom: 8 }}>
                        <div className="bar-shell">
                          <div className="bar-fill-dark" style={{ width: `${realWidth}%` }} />
                        </div>
                      </div>

                      <div className="bar-shell">
                        <div className="bar-fill-light" style={{ width: `${expectedWidth}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="card">
                <h2 className="section-title" style={{ fontSize: 26 }}>
                  Diagnóstico automático
                </h2>

                <div className="section-text">
                  Lectura rápida del estado del activo.
                </div>

                <div
                  style={{
                    border: "2px solid #fde68a",
                    background: "#fffbeb",
                    borderRadius: 20,
                    padding: 16,
                    marginBottom: 14,
                  }}
                >
                  <div style={{ fontWeight: 700, color: "#92400e", marginBottom: 6 }}>
                    Diagnóstico principal
                  </div>
                  <div style={{ fontSize: 14, color: "#92400e" }}>{diagnosis}</div>
                </div>

                <div
                  style={{
                    border: "2px solid #bfdbfe",
                    background: "#eff6ff",
                    borderRadius: 20,
                    padding: 16,
                    marginBottom: 14,
                  }}
                >
                  <div style={{ fontWeight: 700, color: "#1d4ed8", marginBottom: 6 }}>
                    Comparación con la provincia
                  </div>
                  <div style={{ fontSize: 14, color: "#1d4ed8" }}>{benchmarkText}</div>
                </div>

                <div
                  style={{
                    border: "2px solid #e2e8f0",
                    background: "#f8fafc",
                    borderRadius: 20,
                    padding: 16,
                    marginBottom: 14,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: 14,
                      marginBottom: 10,
                    }}
                  >
                    <span style={{ color: "#475569" }}>Índice de confianza del cálculo</span>
                    <span style={{ fontWeight: 700 }}>82%</span>
                  </div>

                  <div className="bar-shell" style={{ background: "#cbd5e1" }}>
                    <div className="bar-fill-dark" style={{ width: "82%" }} />
                  </div>
                </div>

                <div
                  style={{
                    marginTop: 18,
                    background: stateBg,
                    color: stateColor,
                    borderRadius: 20,
                    padding: 16,
                    fontWeight: 700,
                    marginBottom: 12,
                  }}
                >
                  Estado actual: {stateLabel}
                </div>

                {canOfferService ? (
                  <div
                    style={{
                      background: "#0f172a",
                      color: "#ffffff",
                      borderRadius: 20,
                      padding: 16,
                    }}
                  >
                    <div style={{ fontWeight: 700, marginBottom: 6 }}>Servicio recomendado</div>
                    <div style={{ fontSize: 14, lineHeight: 1.5 }}>
                      Tu instalación podría beneficiarse de una revisión técnica o servicio
                      de mantenimiento.
                    </div>
                    <button
                      type="button"
                      style={{
                        marginTop: 12,
                        border: "none",
                        borderRadius: 14,
                        padding: "12px 14px",
                        background: "#ffffff",
                        color: "#0f172a",
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      Solicitar diagnóstico gratuito
                    </button>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="two-col-equal">
              <div className="card">
                <h2 className="section-title" style={{ fontSize: 26 }}>
                  Ranking por inversor
                </h2>

                <div className="section-text">
                  Comparativa interna para detectar equipos con peor comportamiento.
                </div>

                {inverterData.map((inv) => {
                  const bg =
                    inv.status === "ok" ? "#dcfce7" : inv.status === "warn" ? "#fffbeb" : "#fee2e2";
                  const color =
                    inv.status === "ok" ? "#166534" : inv.status === "warn" ? "#92400e" : "#991b1b";

                  return (
                    <div key={inv.name} className="inv-card">
                      <div>
                        <div style={{ fontWeight: 700 }}>{inv.name}</div>
                        <div style={{ fontSize: 14, color: "#64748b" }}>
                          Rendimiento relativo del equipo
                        </div>
                      </div>

                      <div
                        style={{
                          background: bg,
                          color,
                          borderRadius: 999,
                          padding: "8px 12px",
                          fontWeight: 700,
                        }}
                      >
                        {inv.pr}%
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="card">
                <h2 className="section-title" style={{ fontSize: 26 }}>
                  Alertas y anomalías
                </h2>

                <div className="section-text">
                  Detección de pérdidas en franjas concretas del día.
                </div>

                {mockHourly
                  .filter((item) => item.pr < 88)
                  .map((item) => (
                    <div key={item.time} className="alert-card">
                      <div style={{ fontWeight: 700, color: "#991b1b" }}>
                        {item.time} · PR {item.pr}%
                      </div>
                      <div style={{ fontSize: 14, color: "#7f1d1d", marginTop: 4 }}>
                        Posible desviación respecto al comportamiento esperado.
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            <div className="card">
              <h2 className="section-title" style={{ fontSize: 26 }}>
                Evolución diaria del PR
              </h2>

              <div className="section-text">
                Tendencia resumida del rendimiento del periodo analizado.
              </div>

              <div className="day-chart">
                {mockDailyPR.map((value, index) => (
                  <div key={`day-${index}`} style={{ textAlign: "center" }}>
                    <div
                      style={{
                        height: `${value * 1.6}px`,
                        background: "#0f172a",
                        borderRadius: "14px 14px 6px 6px",
                        marginBottom: 8,
                      }}
                    />
                    <div style={{ fontSize: 12, color: "#64748b" }}>{index + 1}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <aside className="sidebar-ads">
            <AdSlot
              title="Anunciante destacado"
              description="Espacio premium para una empresa colaboradora del proyecto."
              size="300x250"
            />

            <WashAutoPanelAd />

            <AdSlot
              title="Software / SCADA / BESS"
              description="Espacio para herramientas digitales, plataformas de datos, fabricantes o integradores."
              size="300x250"
            />
          </aside>
        </div>

        <div className="ad-row" style={{ marginTop: 24 }}>
          <AdSlot
            title="Patrocinador del mes"
            description="Espacio inferior para campañas, colaboraciones comerciales o patrocinadores del proyecto."
            size="970x250"
          />
        </div>
        </div>
      </div>
    </main>
  );
}

export default function Home() {
  const [screen, setScreen] = useState<"access" | "dashboard">("access");
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [signupPasswordVisible, setSignupPasswordVisible] = useState(false);
  const [loginPasswordVisible, setLoginPasswordVisible] = useState(false);
  const [forgotPassword, setForgotPassword] = useState(false);

  const [stationsLoading, setStationsLoading] = useState(false);
  const [stations, setStations] = useState<StationOption[]>([]);

  const [dataSource, setDataSource] = useState<DataSource>({
    mode: "unknown",
    source: "Pendiente de cargar",
    note: "",
  });

  const [signup, setSignup] = useState<UserAccount>({
    fullName: "",
    email: "",
    installationType: "autoconsumo_residencial",
    province: "Madrid",
    password: "",
    company: "",
    phone: "",
    peakPowerKw: "",
  });

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  const [plantForm, setPlantForm] = useState<PlantForm>({
    plantName: "Mi instalación FV",
    province: "Madrid",
    stationId: "",
    peakPower: "100",
    structureType: "fija",
  });

  const [uploaded, setUploaded] = useState(false);

  const selectedStation = useMemo(() => {
    if (stations.length === 0) {
      return null;
    }
    return stations.find((s) => s.id === plantForm.stationId) ?? stations[0];
  }, [stations, plantForm.stationId]);

  const peak = Number(plantForm.peakPower) || Number(currentUser?.peakPowerKw || "0") || 0;
  const dailyEnergy = mockHourly.reduce((acc, item) => acc + item.real, 0);
  const expectedEnergy = mockHourly.reduce((acc, item) => acc + item.expected, 0);
  const pr = expectedEnergy > 0 ? Math.round((dailyEnergy / expectedEnergy) * 100) : 0;
  const avg7 = Math.round(mockDailyPR.slice(-7).reduce((a, b) => a + b, 0) / 7);
  const monthlyAvg = Math.round(mockDailyPR.reduce((a, b) => a + b, 0) / mockDailyPR.length);
  const estimatedLoss = pr < 87 ? Math.round((87 - pr) * peak * 1.6) : 0;
  const criticalInverters = inverterData.filter((item) => item.pr < 85).length;

  const zoneAvgPR = selectedStation?.zoneAvgPR || 0;
  const zoneGap = pr - zoneAvgPR;

  const benchmarkText =
    zoneGap >= 0
      ? `Tu instalación está ${zoneGap}% por encima de la referencia media de tu zona.`
      : `Tu instalación está ${Math.abs(zoneGap)}% por debajo de la referencia media de tu zona.`;

  const diagnosis = useMemo(() => {
    if (pr < 82) {
      return "Posible problema relevante de rendimiento: revisar inversor, strings o suciedad persistente.";
    }

    if (
      mockHourly.some(
        (item) => ["12:00", "13:00", "14:00"].includes(item.time) && item.pr < 88
      )
    ) {
      return "Se detecta caída en horas centrales. Posible clipping, suciedad o limitación parcial.";
    }

    return "No se detectan anomalías severas. Recomendable seguir monitorizando el activo.";
  }, [pr]);

  const stateLabel = pr >= 90 ? "Óptimo" : pr >= 85 ? "Vigilancia" : "Revisar";
  const stateColor = pr >= 90 ? "#166534" : pr >= 85 ? "#92400e" : "#991b1b";
  const stateBg = pr >= 90 ? "#dcfce7" : pr >= 85 ? "#fef3c7" : "#fee2e2";
  const canOfferService = pr < 85;

  async function loadStations(province: string) {
    setStationsLoading(true);

    try {
      const response = await fetch(
        `/api/siar/stations?province=${encodeURIComponent(province)}`
      );

      const data = await response.json();

      if (!response.ok || !data.ok) {
        setStations([]);
        setDataSource({
          mode: "unknown",
          source: "No disponible",
          note: data.message || "No se pudo cargar la fuente de datos.",
        });
        return;
      }

      setDataSource({
        mode: data.mode || "unknown",
        source: data.source || "SIAR/MAPA",
        note: data.note || "",
      });

      const loadedStations = (data.stations || []) as StationOption[];
      setStations(loadedStations);

      setPlantForm((prev) => ({
        ...prev,
        province,
        stationId:
          loadedStations.length > 0
            ? prev.province === province &&
              loadedStations.some((s) => s.id === prev.stationId)
              ? prev.stationId
              : loadedStations[0].id
            : "",
      }));
    } catch {
      setStations([]);
      setDataSource({
        mode: "unknown",
        source: "Error de conexión",
        note: "No se pudo conectar con la fuente de estaciones.",
      });
    } finally {
      setStationsLoading(false);
    }
  }

  useEffect(() => {
    loadStations("Madrid");
  }, []);

  const handleProvinceChange = (province: string) => {
    setPlantForm((prev) => ({
      ...prev,
      province,
      stationId: "",
    }));
    void loadStations(province);
  };

  const handleSignup = async () => {
    setNotice(null);

    try {
      const response = await fetch("/api/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(signup),
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        setNotice({
          type: "error",
          text: data.message || "No se pudo registrar el usuario.",
        });
        return;
      }

      const newUser = data.user as UserAccount;
      setCurrentUser(newUser);
      await loadStations(newUser.province);

      setPlantForm((prev) => ({
        ...prev,
        province: newUser.province,
        peakPower: newUser.peakPowerKw || prev.peakPower,
      }));

      setNotice({
        type: "success",
        text: "Usuario registrado correctamente y guardado en el Excel.",
      });

      setScreen("dashboard");
    } catch {
      setNotice({
        type: "error",
        text: "Error de conexión al registrar el usuario.",
      });
    }
  };

  const handleLogin = async () => {
    setNotice(null);

    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: loginEmail,
          password: loginPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        setNotice({
          type: "error",
          text: data.message || "No se pudo iniciar sesión.",
        });
        return;
      }

      const found = data.user as UserAccount;
      setCurrentUser(found);
      await loadStations(found.province);

      setPlantForm((prev) => ({
        ...prev,
        province: found.province,
        peakPower: found.peakPowerKw || prev.peakPower,
      }));

      setScreen("dashboard");
    } catch {
      setNotice({
        type: "error",
        text: "Error de conexión al iniciar sesión.",
      });
    }
  };

  const handleRequestPassword = async () => {
    setNotice(null);

    try {
      const response = await fetch("/api/request-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: loginEmail,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        setNotice({
          type: "error",
          text: data.message || "No se pudo registrar la solicitud.",
        });
        return;
      }

      setNotice({
        type: "success",
        text: "Solicitud registrada correctamente en el Excel de nuevas contraseñas.",
      });

      setForgotPassword(false);
      setLoginPassword("");
    } catch {
      setNotice({
        type: "error",
        text: "Error de conexión al solicitar una nueva contraseña.",
      });
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setScreen("access");
    setAuthMode("login");
    setLoginPassword("");
    setLoginPasswordVisible(false);
    setForgotPassword(false);
    setNotice(null);
    setUploaded(false);
  };

  if (screen === "access") {
    return (
      <AccessScreen
        authMode={authMode}
        setAuthMode={setAuthMode}
        signup={signup}
        setSignup={setSignup}
        loginEmail={loginEmail}
        setLoginEmail={setLoginEmail}
        loginPassword={loginPassword}
        setLoginPassword={setLoginPassword}
        forgotPassword={forgotPassword}
        setForgotPassword={setForgotPassword}
        signupPasswordVisible={signupPasswordVisible}
        setSignupPasswordVisible={setSignupPasswordVisible}
        loginPasswordVisible={loginPasswordVisible}
        setLoginPasswordVisible={setLoginPasswordVisible}
        onSignup={handleSignup}
        onLogin={handleLogin}
        onRequestPassword={handleRequestPassword}
        notice={notice}
      />
    );
  }

  return (
    <DashboardScreen
      currentUser={currentUser}
      plantForm={plantForm}
      setPlantForm={setPlantForm}
      stations={stations}
      stationsLoading={stationsLoading}
      selectedStation={selectedStation}
      dataSource={dataSource}
      handleProvinceChange={handleProvinceChange}
      uploaded={uploaded}
      setUploaded={setUploaded}
      pr={pr}
      avg7={avg7}
      monthlyAvg={monthlyAvg}
      estimatedLoss={estimatedLoss}
      criticalInverters={criticalInverters}
      zoneAvgPR={zoneAvgPR}
      benchmarkText={benchmarkText}
      diagnosis={diagnosis}
      stateLabel={stateLabel}
      stateColor={stateColor}
      stateBg={stateBg}
      canOfferService={canOfferService}
      onLogout={handleLogout}
    />
  );
}