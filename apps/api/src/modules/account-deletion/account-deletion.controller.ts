import { Request, Response, NextFunction } from 'express';
import { env } from '../../config/env';
import { sendSuccess, sendError } from '../../utils/apiResponse';
import { accountDeletionService, AccountDeletionError } from './account-deletion.service';

export async function requestAccountDeletionController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const receipt = await accountDeletionService.requestDeletion(req.user!.id, req.body);
    sendSuccess(res, receipt, 'Solicitud de eliminación registrada', 200);
  } catch (err: unknown) {
    if (err instanceof AccountDeletionError) {
      sendError(res, err.code, err.message, err.statusCode);
      return;
    }
    next(err);
  }
}

export function retentionNoticeController(_req: Request, res: Response): void {
  sendSuccess(
    res,
    {
      notice: env.ACCOUNT_DELETION_RETENTION_NOTICE,
      retentionDays: env.ACCOUNT_DELETION_RETENTION_DAYS,
      privacyPolicyUrl: env.DATA_POLICY_URL ?? null,
    },
    'Texto configurable de retención de datos'
  );
}
