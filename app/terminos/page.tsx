import type { Metadata } from "next";

export const metadata: Metadata = { title: "Términos de uso | SolarPR Monitor" };

export default function TermsPage() {
  return (
    <main style={{ maxWidth: 900, margin: "40px auto", padding: 24, lineHeight: 1.65 }}>
      <h1>Términos de uso</h1>
      <p>SolarPR Monitor es un prototipo académico destinado a estimar el Performance Ratio a partir de datos facilitados por el usuario y radiación de referencia SIAR.</p>
      <p>Los resultados son orientativos y no sustituyen una auditoría técnica, contractual, metrológica o financiera. El usuario debe utilizar únicamente datos y equipos para los que tenga autorización.</p>
      <p>La web pública no ejecuta aplicaciones en el ordenador del usuario ni accede directamente a redes privadas. La integración con programas locales de lectura requiere un conector local autorizado.</p>
      <p><a href="/">Volver a SolarPR Monitor</a></p>
    </main>
  );
}
