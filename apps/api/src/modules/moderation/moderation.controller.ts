import { Request, Response, NextFunction } from 'express';
import { ModerationReportStatus } from '../../generated/prisma-client';
import { sendSuccess, sendError } from '../../utils/apiResponse';
import { moderationService, ModerationError } from './moderation.service';

function handle(error: unknown, next: NextFunction, res: Response): void {
  if (error instanceof ModerationError) {
    sendError(res, error.code, error.message, error.statusCode);
    return;
  }
  next(error);
}

export async function createReportController(req: Request, res: Response, next: NextFunction) {
  try {
    const report = await moderationService.reportContent(req.user!.id, req.body);
    sendSuccess(res, report, 'Reporte enviado a moderación', 201);
  } catch (error) {
    handle(error, next, res);
  }
}

export async function blockUserController(req: Request, res: Response, next: NextFunction) {
  try {
    const block = await moderationService.blockUser(req.user!.id, req.params.userId);
    sendSuccess(res, block, 'Usuario bloqueado', 201);
  } catch (error) {
    handle(error, next, res);
  }
}

export async function unblockUserController(req: Request, res: Response, next: NextFunction) {
  try {
    await moderationService.unblockUser(req.user!.id, req.params.userId);
    sendSuccess(res, { userId: req.params.userId }, 'Usuario desbloqueado');
  } catch (error) {
    handle(error, next, res);
  }
}

export async function listBlocksController(req: Request, res: Response, next: NextFunction) {
  try {
    sendSuccess(res, await moderationService.listBlocks(req.user!.id), 'Bloqueos del usuario');
  } catch (error) {
    handle(error, next, res);
  }
}

export async function listReportsController(req: Request, res: Response, next: NextFunction) {
  try {
    const raw = typeof req.query.status === 'string' ? req.query.status.toUpperCase() : '';
    const status = raw in ModerationReportStatus
      ? (ModerationReportStatus[raw as keyof typeof ModerationReportStatus] as ModerationReportStatus)
      : undefined;
    sendSuccess(res, await moderationService.listReports(status), 'Cola de moderación');
  } catch (error) {
    handle(error, next, res);
  }
}

export async function resolveReportController(req: Request, res: Response, next: NextFunction) {
  try {
    const report = await moderationService.resolveReport(req.params.id, req.user!.id, req.body);
    sendSuccess(res, report, 'Reporte resuelto');
  } catch (error) {
    handle(error, next, res);
  }
}
