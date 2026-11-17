import { Router } from 'express';
import {
  registerController,
  loginController,
  logoutController,
  logoutAllController,
  refreshController,
  dataPolicyController,
} from './auth.controller';
import { validateBody } from '../../middleware/validate';
import { authenticateToken } from '../../middleware/auth.middleware';
import { registerRateLimiter, loginRateLimiter } from '../../middleware/rateLimiter';
import {
  registerSchema,
  loginSchema,
  refreshTokenSchema,
} from '@data-circular/shared';

const router = Router();

// El DTO compartido no incluye aún los campos de términos; se capturan antes
// de que validateBody elimine las claves desconocidas.
function captureTermsAcceptance(req: any, res: any, next: any): void {
  res.locals.termsAccepted = req.body?.termsAccepted;
  res.locals.termsVersion = req.body?.termsVersion;
  next();
}

// GET /api/v1/auth/data-policy
router.get('/data-policy', dataPolicyController);

// POST /api/v1/auth/register
router.post(
  '/register',
  registerRateLimiter,
  captureTermsAcceptance,
  validateBody(registerSchema),
  registerController
);

// POST /api/v1/auth/login
router.post(
  '/login',
  loginRateLimiter,
  validateBody(loginSchema),
  loginController
);

// POST /api/v1/auth/logout (Requiere estar autenticado)
router.post(
  '/logout',
  authenticateToken,
  logoutController
);

// POST /api/v1/auth/logout-all (Requiere estar autenticado)
router.post(
  '/logout-all',
  authenticateToken,
  logoutAllController
);

// POST /api/v1/auth/refresh
router.post(
  '/refresh',
  validateBody(refreshTokenSchema),
  refreshController
);

export { router as authRouter };
