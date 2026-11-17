import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt';
import { usersRepository } from '../modules/users/users.repository';
import { sessionRepository } from '../modules/auth/session.repository';
import { sendError } from '../utils/apiResponse';
import { SafeUserDto, UserRole, UserType } from '@data-circular/shared';

// Extender la interfaz Request de Express para incluir el usuario autenticado y su sesión
declare global {
  namespace Express {
    interface Request {
      user?: SafeUserDto;
      sessionId?: string;
    }
  }
}

/**
 * Middleware que verifica el token JWT Bearer en el encabezado Authorization.
 * Protege las rutas privadas requiriendo una sesión activa y un usuario activo.
 *
 * Un token firmado ya no basta: la sesión referida por `sid` debe existir, no
 * estar revocada y no haber expirado. Así el logout y la rotación de refresh
 * invalidan el acceso en el servidor.
 */
export async function authenticateToken(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    sendError(res, 'UNAUTHORIZED', 'Cabecera de autorización no proporcionada', 401);
    return;
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    sendError(
      res,
      'UNAUTHORIZED',
      'Formato de token inválido. Debe ser: Bearer <token>',
      401
    );
    return;
  }

  const token = parts[1];

  try {
    const payload = verifyAccessToken(token);

    // Verificar que la sesión siga activa (no revocada ni expirada)
    const session = await sessionRepository.findActiveById(payload.sid, payload.sub);
    if (!session || session.userId !== payload.sub) {
      sendError(
        res,
        'UNAUTHORIZED',
        'La sesión es inválida o ha sido cerrada. Inicia sesión nuevamente.',
        401
      );
      return;
    }

    // Verificar que el usuario exista en la BD y no haya sido desactivado
    const user = await usersRepository.findById(payload.sub, false);
    if (!user) {
      sendError(res, 'UNAUTHORIZED', 'El usuario asociado al token no existe o ha sido desactivado', 401);
      return;
    }

    if (user.status !== 'ACTIVE') {
      sendError(res, 'FORBIDDEN', 'La cuenta de usuario no está activa', 403);
      return;
    }

    req.user = user;
    req.sessionId = session.id;
    next();
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Token inválido';
    sendError(res, 'UNAUTHORIZED', `Token inválido o expirado: ${errorMessage}`, 401);
  }
}

/**
 * Middleware de autorización por rol.
 * Comprueba que el usuario autenticado posea alguno de los roles requeridos.
 */
export function requireRole(allowedRoles: UserRole | UserRole[]) {
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      sendError(res, 'UNAUTHORIZED', 'No autenticado', 401);
      return;
    }

    if (!roles.includes(req.user.role)) {
      sendError(
        res,
        'FORBIDDEN',
        'No tienes permisos suficientes para realizar esta acción administrativa',
        403
      );
      return;
    }

    next();
  };
}

/**
 * Restringe una ruta al tipo de participante indicado; ADMIN conserva acceso total.
 */
export function requireUserType(allowedTypes: UserType | UserType[]) {
  const types = Array.isArray(allowedTypes) ? allowedTypes : [allowedTypes];
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      sendError(res, 'UNAUTHORIZED', 'No autenticado', 401);
      return;
    }

    if (req.user.role !== 'ADMIN' && !types.includes(req.user.userType)) {
      sendError(res, 'FORBIDDEN', 'Tu tipo de usuario no tiene acceso a esta acción', 403);
      return;
    }

    next();
  };
}
