import { Request, Response, NextFunction } from 'express';
import { authService, AuthError } from './auth.service';
import { sendSuccess, sendError } from '../../utils/apiResponse';
import { env } from '../../config/env';

export function dataPolicyController(_req: Request, res: Response): void {
  sendSuccess(res, {
    available: Boolean(env.DATA_POLICY_URL),
    url: env.DATA_POLICY_URL ?? null,
    version: env.DATA_POLICY_VERSION,
  }, 'Información de la política de tratamiento de datos');
}

export async function registerController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const result = await authService.register({
      ...req.body,
      termsAccepted: res.locals.termsAccepted,
      termsVersion: res.locals.termsVersion,
    });
    sendSuccess(res, result, 'Usuario registrado exitosamente', 201);
  } catch (err: unknown) {
    if (err instanceof AuthError) {
      sendError(res, err.code, err.message, err.statusCode);
      return;
    }
    next(err);
  }
}

export async function loginController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const result = await authService.login(req.body);
    sendSuccess(res, result, 'Inicio de sesión exitoso', 200);
  } catch (err: unknown) {
    if (err instanceof AuthError) {
      sendError(res, err.code, err.message, err.statusCode);
      return;
    }
    next(err);
  }
}

export async function logoutController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // La sesión llega validada por authenticateToken; revocarla invalida de inmediato
    // el access token y el refresh token asociados.
    await authService.logout(req.sessionId!);
    sendSuccess(res, null, 'Sesión cerrada exitosamente', 200);
  } catch (err: unknown) {
    next(err);
  }
}

export async function logoutAllController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const revoked = await authService.logoutAll(req.user!.id);
    sendSuccess(
      res,
      { revokedSessions: revoked },
      'Sesiones cerradas en todos los dispositivos',
      200
    );
  } catch (err: unknown) {
    next(err);
  }
}

export async function refreshController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const tokens = await authService.refresh(req.body.refreshToken);
    sendSuccess(res, { tokens }, 'Tokens renovados exitosamente', 200);
  } catch (err: unknown) {
    if (err instanceof AuthError) {
      sendError(res, err.code, err.message, err.statusCode);
      return;
    }
    next(err);
  }
}
