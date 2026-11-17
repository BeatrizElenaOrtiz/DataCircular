import { randomUUID } from 'crypto';
import { prisma } from '../../database/prisma';
import { env } from '../../config/env';
import { verifyPassword } from '../../utils/hash';
import { recordAuditEvent } from '../audit/audit.service';

export class AccountDeletionError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number = 400
  ) {
    super(message);
    this.name = 'AccountDeletionError';
  }
}

export interface RequestAccountDeletionInput {
  password: string;
  confirmRetentionNotice: boolean;
  newOwnerId?: string;
}

export interface AccountDeletionReceipt {
  userId: string;
  deletedAt: string;
  purgeAt: string;
  revokedSessions: number;
  transferredOrganizations: string[];
  retentionNotice: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Eliminación de cuenta conforme al derecho del titular: reautenticación,
 * revocación inmediata de sesiones, anonimización de datos y traspaso
 * obligatorio de organizaciones cuyo único OWNER es la cuenta solicitante.
 */
export class AccountDeletionService {
  private async soleOwnerOrganizationIds(userId: string): Promise<string[]> {
    const memberships = await prisma.organizationMember.findMany({
      where: { userId, status: 'ACTIVE', role: { name: 'OWNER' } },
      select: { organizationId: true },
    });

    const result: string[] = [];
    for (const membership of memberships) {
      const ownerCount = await prisma.organizationMember.count({
        where: {
          organizationId: membership.organizationId,
          status: 'ACTIVE',
          role: { name: 'OWNER' },
        },
      });
      if (ownerCount <= 1) result.push(membership.organizationId);
    }
    return result;
  }

  async requestDeletion(
    userId: string,
    input: RequestAccountDeletionInput
  ): Promise<AccountDeletionReceipt> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.deletedAt) {
      throw new AccountDeletionError('ACCOUNT_ALREADY_DELETED', 'La cuenta ya fue eliminada o no existe', 404);
    }

    if (!(await verifyPassword(user.passwordHash, input.password))) {
      throw new AccountDeletionError('INVALID_PASSWORD', 'La contraseña proporcionada no es correcta', 401);
    }

    if (input.confirmRetentionNotice !== true) {
      throw new AccountDeletionError(
        'RETENTION_NOTICE_REQUIRED',
        'Debes confirmar que leíste qué datos se conservan y por qué',
        400
      );
    }

    const soleOwnerOrgIds = await this.soleOwnerOrganizationIds(userId);
    let newOwnerId: string | null = null;

    if (input.newOwnerId) {
      if (input.newOwnerId === userId) {
        throw new AccountDeletionError('INVALID_NEW_OWNER', 'El nuevo propietario debe ser otro usuario', 400);
      }
      const newOwner = await prisma.user.findFirst({
        where: { id: input.newOwnerId, status: 'ACTIVE', deletedAt: null },
        select: { id: true },
      });
      if (!newOwner) {
        throw new AccountDeletionError('INVALID_NEW_OWNER', 'El nuevo propietario no existe o no está activo', 400);
      }
      newOwnerId = newOwner.id;
    }

    if (soleOwnerOrgIds.length > 0 && !newOwnerId) {
      throw new AccountDeletionError(
        'NEW_OWNER_REQUIRED',
        'Debes designar un nuevo propietario para las organizaciones donde eres el único OWNER',
        400
      );
    }

    const ownerRole = soleOwnerOrgIds.length > 0
      ? await prisma.role.findFirst({ where: { organizationId: null, name: 'OWNER' } })
      : null;
    if (soleOwnerOrgIds.length > 0 && !ownerRole) {
      throw new AccountDeletionError('OWNER_ROLE_NOT_FOUND', 'No existe el rol de sistema OWNER', 500);
    }

    if (newOwnerId) {
      for (const organizationId of soleOwnerOrgIds) {
        const membership = await prisma.organizationMember.findUnique({
          where: { organizationId_userId: { organizationId, userId: newOwnerId } },
        });
        if (!membership || membership.status !== 'ACTIVE') {
          throw new AccountDeletionError(
            'NEW_OWNER_NOT_MEMBER',
            'El nuevo propietario debe ser miembro activo de todas las organizaciones afectadas',
            400
          );
        }
      }
    }

    const now = new Date();
    const purgeAt = new Date(now.getTime() + env.ACCOUNT_DELETION_RETENTION_DAYS * DAY_MS);
    const transferredOrganizations: string[] = [];

    await prisma.$transaction(async (tx) => {
      if (newOwnerId && ownerRole) {
        for (const organizationId of soleOwnerOrgIds) {
          const previous = await tx.organizationMember.findUnique({
            where: { organizationId_userId: { organizationId, userId: newOwnerId! } },
            select: { roleId: true },
          });
          await tx.organizationMember.update({
            where: { organizationId_userId: { organizationId, userId: newOwnerId! } },
            data: { roleId: ownerRole.id, status: 'ACTIVE' },
          });
          // Los documentos de verificación pueden contener datos personales del
          // titular saliente: se anonimizan y queda constancia en AuditLog.
          await tx.organization.update({
            where: { id: organizationId },
            data: { certificateUrl: null, verificationNotes: null },
          });
          await recordAuditEvent(
            {
              action: 'OWNERSHIP_TRANSFERRED_ON_ACCOUNT_DELETION',
              entityType: 'Organization',
              entityId: organizationId,
              actorUserId: userId,
              organizationId,
              targetUserId: newOwnerId,
              previousValue: { ownerUserId: userId, roleId: previous?.roleId ?? null },
              newValue: { ownerUserId: newOwnerId, roleId: ownerRole.id },
              reason: 'Traspaso obligatorio por eliminación de cuenta',
            },
            tx
          );
          transferredOrganizations.push(organizationId);
        }
      }

      const revoked = await tx.userSession.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: now, revokedReason: 'ACCOUNT_DELETION' },
      });

      await tx.userBlock.deleteMany({
        where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
      });
      await tx.materialPublication.updateMany({
        where: { ownerUserId: userId },
        data: {
          description: 'Contenido eliminado por solicitud del titular',
          locationAddress: 'Dirección eliminada',
          photoUrl: null,
        },
      });
      await tx.message.updateMany({
        where: { senderUserId: userId },
        data: { body: 'Mensaje eliminado por solicitud de eliminación de cuenta' },
      });
      await tx.proposal.updateMany({
        where: { proposerUserId: userId },
        data: { terms: 'Propuesta anonimizada por solicitud de eliminación de cuenta' },
      });
      await tx.operation.updateMany({
        where: {
          OR: [{ sellerUserId: userId }, { buyerUserId: userId }, { transporterUserId: userId }],
        },
        data: {
          pickupAddress: 'Dirección eliminada',
          deliveryAddress: 'Dirección eliminada',
          transportNotes: null,
          driverName: null,
          vehiclePlate: null,
          receivedNotes: null,
        },
      });
      await tx.operationEvidence.updateMany({
        where: { uploadedByUserId: userId },
        data: {
          fileUrl: `deleted:${randomUUID()}`,
          description: 'Evidencia anonimizada por solicitud de eliminación de cuenta',
        },
      });
      await tx.operationReview.updateMany({
        where: { reviewerUserId: userId },
        data: { comment: 'Evaluación anonimizada por solicitud de eliminación de cuenta' },
      });
      await tx.user.update({
        where: { id: userId },
        data: {
          fullName: 'Usuario eliminado',
          email: `deleted+${userId}@invalid.local`,
          phone: null,
          passwordHash: `deleted-${randomUUID()}`,
          status: 'INACTIVE',
          deletedAt: now,
        },
      });

      await recordAuditEvent(
        {
          action: 'ACCOUNT_DELETION_REQUESTED',
          entityType: 'User',
          entityId: userId,
          actorUserId: userId,
          targetUserId: userId,
          reason: 'Solicitud del titular con reautenticación',
          newValue: {
            purgeAt: purgeAt.toISOString(),
            revokedSessions: revoked.count,
            transferredOrganizations,
          },
        },
        tx
      );

      return revoked.count;
    });

    return {
      userId,
      deletedAt: now.toISOString(),
      purgeAt: purgeAt.toISOString(),
      revokedSessions: await prisma.userSession.count({
        where: { userId, revokedReason: 'ACCOUNT_DELETION' },
      }),
      transferredOrganizations,
      retentionNotice: env.ACCOUNT_DELETION_RETENTION_NOTICE,
    };
  }

  /**
   * Purga irreversible programada: elimina sesiones y reportes residuales y
   * sustituye los últimos identificadores. Conserva el registro mínimo de
   * auditoría y la aceptación de términos como prueba del consentimiento.
   */
  async purgeDeletedAccounts(now = new Date()): Promise<number> {
    const threshold = new Date(now.getTime() - env.ACCOUNT_DELETION_RETENTION_DAYS * DAY_MS);
    const due = await prisma.user.findMany({
      where: { deletedAt: { not: null, lte: threshold }, purgedAt: null },
      select: { id: true },
    });

    for (const candidate of due) {
      await prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: candidate.id },
          data: {
            fullName: 'Usuario purgado',
            email: `purged+${candidate.id}@invalid.local`,
            phone: null,
            passwordHash: `purged-${randomUUID()}`,
            purgedAt: now,
          },
        });
        await tx.userSession.deleteMany({ where: { userId: candidate.id } });
        await tx.userBlock.deleteMany({
          where: { OR: [{ blockerId: candidate.id }, { blockedId: candidate.id }] },
        });
        await tx.moderationReport.deleteMany({ where: { reporterId: candidate.id } });
        await recordAuditEvent(
          {
            action: 'ACCOUNT_PURGED',
            entityType: 'User',
            entityId: candidate.id,
            targetUserId: candidate.id,
            reason: 'Purga programada tras el periodo de retención configurado',
          },
          tx
        );
      });
    }

    return due.length;
  }
}

export const accountDeletionService = new AccountDeletionService();

let purgeTimer: NodeJS.Timeout | null = null;

export function startPurgeScheduler(): NodeJS.Timeout | null {
  if (!env.PURGE_SCHEDULER_ENABLED || purgeTimer) return null;
  purgeTimer = setInterval(() => {
    accountDeletionService.purgeDeletedAccounts().catch((error: unknown) => {
      console.error('[purge] Fallo la purga programada:', error instanceof Error ? error.message : error);
    });
  }, env.PURGE_INTERVAL_HOURS * 60 * 60 * 1000);
  purgeTimer.unref?.();
  return purgeTimer;
}
