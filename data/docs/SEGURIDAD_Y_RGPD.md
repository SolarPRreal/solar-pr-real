# Seguridad y RGPD — SolarPR Monitor

## Controles aplicados

- Dependencias actualizadas y `npm audit` sin vulnerabilidades conocidas en la fecha de revisión.
- Contraseñas nunca guardadas en `localStorage`, respuestas API ni hojas en texto legible.
- Hash HMAC-SHA-256 con secreto `AUTH_PEPPER` almacenado solo en Vercel.
- Sesiones firmadas en cookie `HttpOnly`, `Secure` en producción y `SameSite=Lax`.
- Limitación básica de intentos en registro, acceso y recuperación.
- Respuestas genéricas en recuperación para evitar enumerar cuentas.
- Validación de origen, tamaño y formato de entradas.
- Encabezados CSP, HSTS, `nosniff`, anti-iframe y política de permisos.
- La clave del contador permanece solo en memoria mientras la pestaña está abierta; no se guarda ni se envía.
- Datos de instalación reducidos a los necesarios para el cálculo y seguimiento solicitado.
- Páginas públicas de privacidad y términos.

## Límites que deben declararse

- Es un prototipo académico; no existe seguridad absoluta.
- El limitador en memoria es de mejor esfuerzo en un entorno serverless. Para producción comercial conviene usar Redis/KV.
- Google Sheets es adecuado para el TFM y un volumen reducido, no para una plataforma comercial de gran escala.
- Antes de uso real deben completarse la identidad legal del responsable, domicilio o datos exigibles, contratos con encargados, registro de actividades, plazos internos y procedimiento de derechos/brechas.
- La lectura directa de contadores necesita un conector local instalado y una evaluación de seguridad industrial. Vercel no puede abrir aplicaciones ni acceder a redes privadas del usuario.

## Secretos obligatorios

- `AUTH_PEPPER`: aleatorio, mínimo 32 caracteres; no cambiar mientras existan usuarios, o sus hashes dejarán de coincidir.
- `SESSION_SECRET`: aleatorio, mínimo 32 caracteres; puede rotarse, cerrando las sesiones existentes.
- `GOOGLE_SHEETS_WEBHOOK_URL`: URL `/exec` del Apps Script.

## Generación de secretos en PowerShell

```powershell
[Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(48))
```

Ejecuta el comando dos veces y usa resultados distintos.
