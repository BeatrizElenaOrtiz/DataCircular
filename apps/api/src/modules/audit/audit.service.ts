import { Prisma, PrismaClient } from '../../generated/prisma-client';
import { prisma } from '../../database/prisma';

export type AuditDatabase = PrismaClient | Prisma.TransactionClient;

export interface RecordAuditEventInput {
  action: string;
  entityType: string;
  entityId?: string | null;
  actorUserId?: string | null;
  organizationId?: string | null;
  targetUserId?: string | null;
  previousValue?: Prisma.InputJsonValue | null;
  newValue?: Prisma.InputJsonValue | null;
  reason?: string | null;
}

/**
 * Persiste un evento de auditoría. Nunca debe recibir contraseñas, tokens
 * ni otros secretos: solo identificadores, roles y cambios de estado.
 */
export async function recordAuditEvent(
  input: RecordAuditEventInput,
  db: AuditDatabase = prisma
) {
  return db.auditLog.create({
    data: {
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      actorUserId: input.actorUserId ?? null,
      organizationId: input.organizationId ?? null,
      targetUserId: input.targetUserId ?? null,
      previousValue: input.previousValue ?? Prisma.JsonNull,
      newValue: input.newValue ?? Prisma.JsonNull,
      reason: input.reason ?? null,
    },
  });
}
