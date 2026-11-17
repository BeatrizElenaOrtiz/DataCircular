import { Router } from 'express';
import { z } from 'zod';
import { authenticateToken } from '../../middleware/auth.middleware';
import { validateBody } from '../../middleware/validate';
import {
  requestAccountDeletionController,
  retentionNoticeController,
} from './account-deletion.controller';

const router = Router();

const requestDeletionSchema = z.object({
  password: z.string().min(1, 'La contraseña es requerida'),
  confirmRetentionNotice: z.literal(true, {
    errorMap: () => ({ message: 'Debes confirmar el texto de retención' }),
  }),
  newOwnerId: z.string().uuid().optional(),
});

router.get('/retention-notice', retentionNoticeController);
router.post(
  '/request',
  authenticateToken,
  validateBody(requestDeletionSchema),
  requestAccountDeletionController
);

export { router as accountDeletionRouter };
