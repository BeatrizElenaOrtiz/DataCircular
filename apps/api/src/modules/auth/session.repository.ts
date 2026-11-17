import { createHash } from 'crypto';
import { prisma } from '../../database/prisma';

/**
 * Hash determinista del refresh token.
 *
 * El token es un valor aleatorio de alta entropía; se almacena solo su SHA-256
 * para que una lectura de la base de datos no permita reutilizarlo.
 */
export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export interface CreateSessionData {
  id: string;
  userId: string;
  refreshTokenHash: string;
  expiresAt: Date;
}

export class SessionRepository {
  async create(data: CreateSessionData) {
    return prisma.userSession.create({ data });
  }

  async findById(id: string) {
    return prisma.userSession.findUnique({ where: { id } });
  }

  /**
   * Devuelve una sesión utilizable: no revocada y no expirada.
   */
  async findActiveById(id: string, userId?: string) {
    return prisma.userSession.findFirst({
      where: {
        id,
        ...(userId ? { userId } : {}),
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
  }

  /**
   * Rotación atómica: solo actualiza si el hash presentado sigue siendo el
   * vigente. Si dos peticiones compiten, solo una gana.
   */
  async rotate(
    id: string,
    expectedRefreshTokenHash: string,
    nextRefreshTokenHash: string,
    expiresAt: Date,
    rotatedAt = new Date()
  ) {
    return prisma.userSession.updateMany({
      where: {
        id,
        revokedAt: null,
        expiresAt: { gt: new Date() },
        refreshTokenHash: expectedRefreshTokenHash,
      },
      data: {
        previousRefreshTokenHash: expectedRefreshTokenHash,
        refreshTokenHash: nextRefreshTokenHash,
        expiresAt,
        lastUsedAt: rotatedAt,
        rotatedAt,
      },
    });
  }

  async revoke(id: string, reason: string) {
    return prisma.userSession.updateMany({
      where: { id, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: reason },
    });
  }

  async revokeAllForUser(userId: string, reason: string) {
    return prisma.userSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: reason },
    });
  }

  /**
   * Limpieza oportunista de sesiones expiradas o revocadas hace más de un día.
   * Se invoca al crear una sesión para evitar crecimiento indefinido.
   */
  async deleteStale(olderThan = new Date(Date.now() - 24 * 60 * 60 * 1000)) {
    return prisma.userSession.deleteMany({
      where: {
        OR: [{ expiresAt: { lte: new Date() } }, { revokedAt: { lte: olderThan } }],
      },
    });
  }
}

export const sessionRepository = new SessionRepository();
