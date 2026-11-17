import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../src/app';
import { prisma } from '../src/database/prisma';
import { usersRepository } from '../src/modules/users/users.repository';
import { env, validateEnv } from '../src/config/env';
import { hashRefreshToken } from '../src/modules/auth/session.repository';

/**
 * GRUPO 3 - Gestión de sesiones (SA-007, SA-008, SA-010)
 *
 * Cubre:
 * - Rotación de refresh token y detección de reuso con revocación de la sesión.
 * - Logout con revocación efectiva en el servidor (access + refresh).
 * - Algoritmo JWT fijado (HS256) y rechazo de algoritmos alternativos.
 * - Claims de sesión (`sid`, `jti`) y vidas útiles por defecto reducidas.
 */
describe('GRUPO 3 - Sesiones, rotación y revocación (SA-007, SA-008, SA-010)', () => {
  const createdUserIds: string[] = [];
  const password = 'Password123!@#';

  let email: string;
  let userId: string;
  let accessToken: string;
  let refreshToken: string;
  let sessionId: string;
  let consumedRefreshToken = '';

  async function login(): Promise<{ accessToken: string; refreshToken: string }> {
    const response = await request(app).post('/api/v1/auth/login').send({ email, password });
    expect(response.status, JSON.stringify(response.body)).toBe(200);
    return response.body.data.tokens;
  }

  beforeAll(async () => {
    await prisma.$queryRaw`SELECT 1`;

    email = `sesiones.grupo3.${Date.now()}.${Math.random().toString(36).slice(2, 8)}@circular.test`;
    const response = await request(app)
      .post('/api/v1/auth/register')
      .send({
        fullName: 'Usuario Sesiones Grupo 3',
        email,
        password,
        phone: '+57 300 111 2233',
        userType: 'RECYCLER',
        dataPolicyAccepted: true,
      });

    expect(response.status, JSON.stringify(response.body)).toBe(201);
    userId = response.body.data.user.id;
    createdUserIds.push(userId);

    accessToken = response.body.data.tokens.accessToken;
    refreshToken = response.body.data.tokens.refreshToken;

    const decoded = jwt.decode(accessToken, { complete: true });
    sessionId = (decoded?.payload as { sid: string }).sid;
  });

  afterAll(async () => {
    for (const id of createdUserIds) {
      await prisma.userSession.deleteMany({ where: { userId: id } }).catch(() => {});
      await usersRepository.deletePermanently(id).catch(() => {});
    }
  });

  describe('SA-010: algoritmo y claims', () => {
    it('firma los tokens con HS256 y no acepta otros algoritmos', async () => {
      const access = jwt.decode(accessToken, { complete: true });
      const refresh = jwt.decode(refreshToken, { complete: true });

      expect(access?.header.alg).toBe('HS256');
      expect(refresh?.header.alg).toBe('HS256');

      // Token firmado con HS512 usando el mismo secreto: debe rechazarse.
      const hs512 = jwt.sign(
        { sub: userId, email, role: 'USER', type: 'access', sid: sessionId, jti: 'falso' },
        env.JWT_SECRET,
        { algorithm: 'HS512', expiresIn: '15m' }
      );

      const hs512Response = await request(app)
        .get('/api/v1/users/me')
        .set('Authorization', `Bearer ${hs512}`);
      expect(hs512Response.status).toBe(401);
      expect(hs512Response.body.success).toBe(false);

      // Token sin firma (`alg: none`): debe rechazarse.
      const unsigned = jwt.sign(
        { sub: userId, email, role: 'USER', type: 'access', sid: sessionId, jti: 'falso' },
        '',
        { algorithm: 'none' }
      );

      const unsignedResponse = await request(app)
        .get('/api/v1/users/me')
        .set('Authorization', `Bearer ${unsigned}`);
      expect(unsignedResponse.status).toBe(401);
      expect(unsignedResponse.body.success).toBe(false);
    });

    it('incluye sid y jti distintos en access y refresh de la misma sesión', () => {
      const access = jwt.decode(accessToken) as { sid: string; jti: string; type: string };
      const refresh = jwt.decode(refreshToken) as { sid: string; jti: string; type: string };

      expect(access.type).toBe('access');
      expect(refresh.type).toBe('refresh');
      expect(access.sid).toBe(refresh.sid);
      expect(access.jti).toBeTruthy();
      expect(refresh.jti).toBeTruthy();
      expect(access.jti).not.toBe(refresh.jti);
    });

    it('usa vidas útiles cortas por defecto (access 15m, refresh 7d)', () => {
      const parsed = validateEnv({
        DATABASE_URL: 'postgresql://usuario:clave@localhost:5432/data_circular_test',
        JWT_SECRET: 'a'.repeat(48),
        JWT_REFRESH_SECRET: 'b'.repeat(48),
      });

      expect(parsed.success, parsed.success ? '' : JSON.stringify(parsed.error.format())).toBe(true);
      if (!parsed.success) return;

      expect(parsed.data.JWT_EXPIRES_IN).toBe('15m');
      expect(parsed.data.JWT_REFRESH_EXPIRES_IN).toBe('7d');
    });

    it('respeta la configuración vigente al calcular la expiración de los tokens', () => {
      const access = jwt.decode(accessToken) as { exp: number; iat: number };
      const refresh = jwt.decode(refreshToken) as { exp: number; iat: number };

      expect(access.exp - access.iat).toBeGreaterThan(0);
      expect(refresh.exp - refresh.iat).toBeGreaterThan(access.exp - access.iat);
    });
  });

  describe('SA-007: rotación de refresh y reuso', () => {
    it('guarda solo el hash del refresh token, nunca el valor en claro', async () => {
      const session = await prisma.userSession.findUnique({ where: { id: sessionId } });

      expect(session).not.toBeNull();
      expect(session!.userId).toBe(userId);
      expect(session!.revokedAt).toBeNull();
      expect(session!.refreshTokenHash).toBe(hashRefreshToken(refreshToken));
      expect(session!.refreshTokenHash).not.toBe(refreshToken);
      expect(session!.refreshTokenHash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('rota el refresh token en cada uso exitoso', async () => {
      consumedRefreshToken = refreshToken;

      const firstRefresh = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken });

      expect(firstRefresh.status, JSON.stringify(firstRefresh.body)).toBe(200);
      const rotated = firstRefresh.body.data.tokens;
      expect(rotated.refreshToken).not.toBe(refreshToken);
      expect(rotated.accessToken).toBeTruthy();

      const session = await prisma.userSession.findUnique({ where: { id: sessionId } });
      expect(session!.refreshTokenHash).toBe(hashRefreshToken(rotated.refreshToken));
      expect(session!.previousRefreshTokenHash).toBe(hashRefreshToken(refreshToken));

      const secondRefresh = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: rotated.refreshToken });

      expect(secondRefresh.status, JSON.stringify(secondRefresh.body)).toBe(200);
      expect(secondRefresh.body.data.tokens.refreshToken).not.toBe(rotated.refreshToken);

      // Actualiza el token vigente para las pruebas siguientes.
      refreshToken = secondRefresh.body.data.tokens.refreshToken;
      accessToken = secondRefresh.body.data.tokens.accessToken;
    });

    it('detecta el reuso de un refresh anterior y revoca la sesión completa', async () => {
      // El token usado en la primera rotación ya fue consumido.
      const reuse = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: consumedRefreshToken });

      expect(reuse.status).toBe(401);
      expect(reuse.body.error.code).toBe('REFRESH_TOKEN_REUSED');

      const session = await prisma.userSession.findUnique({ where: { id: sessionId } });
      expect(session!.revokedAt).toBeInstanceOf(Date);
      expect(session!.revokedReason).toBe('REFRESH_TOKEN_REUSE');

      // El refresh vigente también deja de funcionar.
      const afterRevocation = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken });
      expect(afterRevocation.status).toBe(401);

      // El access token de la sesión revocada ya no autoriza.
      const me = await request(app)
        .get('/api/v1/users/me')
        .set('Authorization', `Bearer ${accessToken}`);
      expect(me.status).toBe(401);
      expect(me.body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('SA-008: logout con revocación en servidor', () => {
    it('revoca la sesión y rechaza access y refresh posteriores', async () => {
      const tokens = await login();

      const before = await request(app)
        .get('/api/v1/users/me')
        .set('Authorization', `Bearer ${tokens.accessToken}`);
      expect(before.status).toBe(200);

      const logout = await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${tokens.accessToken}`);
      expect(logout.status).toBe(200);

      const after = await request(app)
        .get('/api/v1/users/me')
        .set('Authorization', `Bearer ${tokens.accessToken}`);
      expect(after.status).toBe(401);

      const refresh = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: tokens.refreshToken });
      expect(refresh.status).toBe(401);
      expect(refresh.body.error.code).toBe('INVALID_REFRESH_TOKEN');

      const decoded = jwt.decode(tokens.accessToken) as { sid: string };
      const session = await prisma.userSession.findUnique({ where: { id: decoded.sid } });
      expect(session!.revokedAt).toBeInstanceOf(Date);
      expect(session!.revokedReason).toBe('LOGOUT');
    });

    it('rechaza una sesión expirada aunque el JWT siga vigente', async () => {
      const tokens = await login();
      const decoded = jwt.decode(tokens.accessToken) as { sid: string };

      await prisma.userSession.update({
        where: { id: decoded.sid },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });

      const response = await request(app)
        .get('/api/v1/users/me')
        .set('Authorization', `Bearer ${tokens.accessToken}`);
      expect(response.status).toBe(401);

      const refresh = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: tokens.refreshToken });
      expect(refresh.status).toBe(401);
    });
  });
});
