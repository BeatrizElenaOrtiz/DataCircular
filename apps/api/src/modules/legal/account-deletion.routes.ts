import { Router } from 'express';
import { env } from '../../config/env';

const router = Router();

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

router.get('/eliminar-cuenta', (_req, res) => {
  const privacyUrl = escapeHtml(env.DATA_POLICY_URL ?? '/politica-datos');
  const notice = escapeHtml(env.ACCOUNT_DELETION_RETENTION_NOTICE);
  const days = env.ACCOUNT_DELETION_RETENTION_DAYS;

  res.type('html').send(`<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Solicitud de eliminación de cuenta | DATA_CIRCULAR</title>
</head>
<body>
  <main>
    <h1>Solicitud de eliminación de cuenta — DATA_CIRCULAR</h1>
    <p><strong>DATA_CIRCULAR</strong> · Fundación IMARA</p>
    <p>Esta página pública explica cómo solicitar la eliminación de tu cuenta en DATA_CIRCULAR. La solicitud se confirma dentro de la aplicación con tu contraseña; nadie más puede eliminar tu cuenta por ti.</p>
    <h2>Qué ocurre al solicitarla</h2>
    <ul>
      <li>Se revocan todas las sesiones activas de forma inmediata.</li>
      <li>Se anonimizan perfil, publicaciones, mensajes, propuestas, evidencias y documentos de verificación.</li>
      <li>Si eres el único OWNER de una organización, debes designar un nuevo propietario antes de continuar; el traspaso queda registrado en AuditLog.</li>
      <li>Después de ${days} días se ejecuta la purga irreversible programada.</li>
    </ul>
    <h2>Datos que se conservan y por qué</h2>
    <p>${notice}</p>
    <h2>Cómo solicitarla</h2>
    <ol>
      <li>Inicia sesión en la aplicación DATA_CIRCULAR.</li>
      <li>Entra a la pantalla “Eliminar cuenta” y confirma con tu contraseña.</li>
      <li>Si eres único OWNER, indica el nuevo propietario y confirma el texto de retención.</li>
    </ol>
    <p>Consulta la <a href="${privacyUrl}">política de privacidad de DATA_CIRCULAR</a> para conocer tus derechos y los canales de contacto del responsable.</p>
  </main>
</body>
</html>`);
});

export { router as accountDeletionPageRouter };
