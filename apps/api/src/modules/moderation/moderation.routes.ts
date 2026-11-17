import { Router } from 'express';
import { z } from 'zod';
import { authenticateToken, requireRole } from '../../middleware/auth.middleware';
import { validateBody } from '../../middleware/validate';
import {
  createReportController,
  blockUserController,
  unblockUserController,
  listBlocksController,
  listReportsController,
  resolveReportController,
} from './moderation.controller';

const router = Router();

const reportSchema = z.object({
  targetType: z.enum(['PUBLICATION', 'CONVERSATION', 'PROFILE']),
  targetId: z.string().uuid(),
  reason: z.string().trim().min(3).max(100),
  details: z.string().trim().max(2000).optional(),
});

const blockSchema = z.object({ userId: z.string().uuid() });

// Rutas del titular: reportar contenido y gestionar bloqueos.
router.use(authenticateToken);
router.post('/reports', validateBody(reportSchema), createReportController);
router.get('/blocks', listBlocksController);
router.post('/blocks', validateBody(blockSchema), (req, res, next) => {
  req.params.userId = req.body.userId;
  return blockUserController(req, res, next);
});
router.delete('/blocks/:userId', unblockUserController);

// Cola de moderación de Administración (reutiliza ModerationReport).
export const adminModerationRouter = Router();
adminModerationRouter.use(authenticateToken, requireRole('ADMIN'));
adminModerationRouter.get('/reports', listReportsController);

const resolveSchema = z.object({
  resolution: z.enum(['DISMISSED', 'ACTION_TAKEN']),
  note: z.string().trim().max(1000).optional(),
});
adminModerationRouter.post('/reports/:id/resolve', validateBody(resolveSchema), resolveReportController);

export { router as moderationRouter };
