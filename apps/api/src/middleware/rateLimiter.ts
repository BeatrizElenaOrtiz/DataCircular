import { Request } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { sendError } from '../utils/apiResponse';
import { env } from '../config/env';

/**
 * Clave del limitador de login: IP + correo normalizado.
 *
 * Así un atacante que comparte IP con otros usuarios no agota el cupo de
 * todos, y un mismo correo tampoco queda protegido por cambiar de IP dentro
 * de una misma ventana.
 */
export function loginRateLimitKey(req: Request): string {
  const rawEmail =
    req.body && typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  // ipKeyGenerator evita que usuarios IPv6 de la misma subred eludan el cupo.
  const ip = req.ip ? ipKeyGenerator(req.ip) : 'ip-desconocida';
  return `${ip}:${rawEmail}`;
}

interface LoginLimiterOptions {
  max: number;
  windowMs?: number;
}

export function createLoginRateLimiter(options: LoginLimiterOptions) {
  return rateLimit({
    windowMs: options.windowMs ?? 15 * 60 * 1000,
    max: options.max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: loginRateLimitKey,
    handler: (_req, res) => {
      sendError(
        res,
        'TOO_MANY_REQUESTS',
        'Has superado el límite de intentos de inicio de sesión. Por favor intenta de nuevo en 15 minutos.',
        429
      );
    },
  });
}

/**
 * Limitador de intentos para inicio de sesión (Login):
 * Máximo 10 intentos por IP + correo en cada ventana de 15 minutos.
 * En ambiente de testing se eleva el cupo para no interferir con las pruebas.
 */
export const loginRateLimiter = createLoginRateLimiter({
  max: env.NODE_ENV === 'test' ? 1000 : 10,
});

/**
 * Limitador de intentos para registro de cuentas:
 * Máximo 20 registros por hora por dirección IP.
 */
export const registerRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: env.NODE_ENV === 'test' ? 1000 : 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    sendError(
      res,
      'TOO_MANY_REQUESTS',
      'Límite de solicitudes de registro excedido. Intenta más tarde.',
      429
    );
  },
});
