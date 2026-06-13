import type { Metadata } from "next";

export const metadata: Metadata = { title: "Política de Privacidad | SolarPR Monitor" };

export default function PrivacyPage() {
  return (
    <main style={{ maxWidth: 900, margin: "40px auto", padding: 24, lineHeight: 1.65 }}>
      <h1>Política de Privacidad</h1>
      <p><strong>Versión:</strong> 9 de junio de 2026.</p>
      <h2>Responsable</h2>
      <p>SolarPR Monitor, proyecto académico de TFM. Contacto para privacidad: <a href="mailto:soporte.solarpr@gmail.com">soporte.solarpr@gmail.com</a>.</p>
      <h2>Datos tratados y finalidad</h2>
      <p>Se tratan nombre, apellidos, correo electrónico y los datos técnicos mínimos de la instalación necesarios para crear la cuenta, confirmar el registro, prestar el cálculo de rendimiento PR, guardar el resultado solicitado y atender incidencias. Las claves de comunicación de contadores no se guardan ni se envían al servidor.</p>
      <h2>Base jurídica</h2>
      <p>El tratamiento para crear la cuenta y prestar el servicio se basa en la solicitud del usuario y en su consentimiento expreso durante el registro. El consentimiento puede retirarse sin afectar a tratamientos anteriores.</p>
      <h2>Conservación</h2>
      <p>Los datos de cuenta se conservarán mientras la cuenta permanezca activa y, tras solicitar su supresión, solo durante los plazos imprescindibles para atender responsabilidades legales. Los códigos de recuperación caducan y no se conservan más tiempo del necesario.</p>
      <h2>Destinatarios y encargados</h2>
      <p>El prototipo utiliza Vercel para alojar la aplicación y servicios de Google para el registro operativo y el envío de correos. No se venden datos ni se utilizan para publicidad comportamental.</p>
      <h2>Derechos</h2>
      <p>Puedes solicitar acceso, rectificación, supresión, oposición, limitación y portabilidad, o retirar el consentimiento, escribiendo a soporte.solarpr@gmail.com. También puedes reclamar ante la Agencia Española de Protección de Datos.</p>
      <h2>Seguridad y minimización</h2>
      <p>Las contraseñas no se almacenan en texto legible, las sesiones se protegen mediante cookies HttpOnly y los formularios limitan y validan los datos. No obstante, este es un prototipo académico y no debe utilizarse para operaciones críticas o control de equipos industriales sin una evaluación profesional adicional.</p>
      <p><a href="/">Volver a SolarPR Monitor</a></p>
    </main>
  );
}
