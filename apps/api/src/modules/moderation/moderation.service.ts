import {
  ModerationReportStatus,
  ModerationTargetType,
} from '../../generated/prisma-client';
import { prisma } from '../../database/prisma';
import { recordAuditEvent } from '../audit/audit.service';

export class ModerationError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number = 400
  ) {
    super(message);
    this.name = 'ModerationError';
  }
}

export interface CreateReportInput {
  targetType: ModerationTargetType;
  targetId: string;
  reason: string;
  details?: string;
}

export interface ResolveReportInput {
  resolution: 'DISMISSED' | 'ACTION_TAKEN';
  note?: string;
}

export class ModerationService {
  /** Falla si existe un bloqueo en cualquiera de los dos sentidos. */
  async assertNotBlocked(firstUserId: string, secondUserId: string): Promise<void> {
    if (!firstUserId || !secondUserId || firstUserId === secondUserId) return;
    const block = await prisma.userBlock.findFirst({
      where: {
        OR: [
          { blockerId: firstUserId, blockedId: secondUserId },
          { blockerId: secondUserId, blockedId: firstUserId },
        ],
      },
      select: { id: true },
    });
    if (block) {
      throw new ModerationError(
        'USER_BLOCKED',
        'No puedes enviar mensajes ni propuestas con este usuario porque existe un bloqueo',
        403
      );
    }
  }

  private async assertTargetExists(targetType: ModerationTargetType, targetId: string): Promise<void> {
    let exists = false;
    if (targetType === ModerationTargetType.PUBLICATION) {
      exists = Boolean(
        await prisma.materialPublication.findFirst({
          where: { id: targetId, deletedAt: null },
          select: { id: true },
        })
      );
    } else if (targetType === ModerationTargetType.CONVERSATION) {
      exists = Boolean(
        await prisma.conversation.findUnique({ where: { id: targetId }, select: { id: true } })
      );
    } else {
      exists = Boolean(
        await prisma.user.findFirst({
          where: { id: targetId, deletedAt: null },
          select: { id: true },
        })
      );
    }
    if (!exists) {
      throw new ModerationError('REPORT_TARGET_NOT_FOUND', 'El contenido reportado no existe', 404);
    }
  }

  async reportContent(reporterId: string, input: CreateReportInput) {
    await this.assertTargetExists(input.targetType, input.targetId);

    const duplicate = await prisma.moderationReport.findFirst({
      where: {
        reporterId,
        targetType: input.targetType,
        targetId: input.targetId,
        status: ModerationReportStatus.PENDING,
      },
      select: { id: true },
    });
    if (duplicate) {
      throw new ModerationError(
        'REPORT_ALREADY_PENDING',
        'Ya tienes un reporte pendiente sobre este contenido',
        409
      );
    }

    const report = await prisma.$transaction(async (tx) => {
      const created = await tx.moderationReport.create({
        data: {
          reporterId,
          targetType: input.targetType,
          targetId: input.targetId,
          reason: input.reason.trim(),
          details: input.details?.trim() || null,
        },
      });
      await recordAuditEvent(
        {
          action: 'UGC_REPORT_CREATED',
          entityType: 'ModerationReport',
          entityId: created.id,
          actorUserId: reporterId,
          reason: `${input.targetType}:${input.targetId}`,
        },
        tx
      );
      return created;
    });

    return report;
  }

  async blockUser(blockerId: string, blockedId: string) {
    if (blockerId === blockedId) {
      throw new ModerationError('CANNOT_BLOCK_SELF', 'No puedes bloquear tu propia cuenta', 400);
    }
    const target = await prisma.user.findFirst({
      where: { id: blockedId, status: 'ACTIVE', deletedAt: null },
      select: { id: true },
    });
    if (!target) {
      throw new ModerationError('USER_NOT_FOUND', 'El usuario que deseas bloquear no existe', 404);
    }

    const block = await prisma.userBlock.upsert({
      where: { blockerId_blockedId: { blockerId, blockedId } },
      update: {},
      create: { blockerId, blockedId },
    });

    await recordAuditEvent({
      action: 'USER_BLOCKED',
      entityType: 'UserBlock',
      entityId: block.id,
      actorUserId: blockerId,
      targetUserId: blockedId,
    });

    return block;
  }

  async unblockUser(blockerId: string, blockedId: string): Promise<void> {
    await prisma.userBlock.deleteMany({ where: { blockerId, blockedId } });
    await recordAuditEvent({
      action: 'USER_UNBLOCKED',
      entityType: 'UserBlock',
      actorUserId: blockerId,
      targetUserId: blockedId,
    });
  }

  async listBlocks(userId: string) {
    return prisma.userBlock.findMany({
      where: { blockerId: userId },
      select: { id: true, blockedId: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listReports(status?: ModerationReportStatus) {
    return prisma.moderationReport.findMany({
      where: status ? { status } : undefined,
      include: {
        reporter: { select: { id: true, fullName: true, email: true } },
        resolvedBy: { select: { id: true, fullName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async resolveReport(reportId: string, actorId: string, input: ResolveReportInput) {
    const report = await prisma.moderationReport.findUnique({ where: { id: reportId } });
    if (!report) {
      throw new ModerationError('REPORT_NOT_FOUND', 'El reporte no existe', 404);
    }
    if (report.status !== ModerationReportStatus.PENDING) {
      throw new ModerationError('REPORT_ALREADY_RESOLVED', 'El reporte ya fue resuelto', 409);
    }

    const status = input.resolution === 'DISMISSED'
      ? ModerationReportStatus.DISMISSED
      : ModerationReportStatus.RESOLVED;

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.moderationReport.update({
        where: { id: reportId },
        data: {
          status,
          resolution: input.note?.trim() || input.resolution,
          resolvedByUserId: actorId,
          resolvedAt: new Date(),
        },
      });
      await recordAuditEvent(
        {
          action: 'UGC_REPORT_RESOLVED',
          entityType: 'ModerationReport',
          entityId: reportId,
          actorUserId: actorId,
          previousValue: { status: report.status },
          newValue: { status, resolution: input.resolution },
          reason: input.note?.trim() || null,
        },
        tx
      );
      return result;
    });

    return updated;
  }
}

export const moderationService = new ModerationService();
