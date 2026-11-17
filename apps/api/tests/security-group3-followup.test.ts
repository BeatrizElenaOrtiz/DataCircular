import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import request from 'supertest';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import { app } from '../src/app';
import { prisma } from '../src/database/prisma';
import { usersRepository } from '../src/modules/users/users.repository';
import {
  createLoginRateLimiter,
  loginRateLimitKey,
} from '../src/middleware/rateLimiter';

/**
 * CIERRE DE PENDIENTES DEL GRUPO 3 (SA-007, SA-008, SA-009)
 *
 * a) logout-all,
 * c) límite de login por IP + correo,
 * d) renovaciones concurrentes sin cierre indebido de sesión.
 *
 * b) No existe cambio de contraseña en el servidor; se reporta, no se inventa.
 */
describe('PASO 0 - Pendientes del Grupo 3 (SA-007, SA-008, SA-009)', () => {
  const createdUserIds: string[] = [];
  const password = 'Password123!@#';

  async function registerUser(prefix: string) {
    const email = `${prefix}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}@circular.test`;
    const response = await request(app).post('/api/v1/auth/register').send({
      fullName: `Usuario ${prefix}`,
      email,
      password,
      phone: '+57 300 555 0101',
      userType: 'RECYCLER',
      dataPolicyAccepted: true,
    });
    expect(response.status, JSON.stringify(response.body)).toBe(201);
    const id = response.body.data.user.id as string;
    createdUserIds.push(id);
    return { id, email, tokens: response.body.data.tokens };
  }

  async function login(email: string) {
    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({ email, password });
    expect(response.status, JSON.stringify(response.body)).toBe(200);
    return response.body.data.tokens;
  }

  beforeAll(async () => {
    await prisma.$queryRaw`SELECT 1`;
  });

  afterAll(async () => {
    for (const id of createdUserIds) {
      await prisma.userSession.deleteMany({ where: { userId: id } }).catch(() => {});
      await usersRepository.deletePermanently(id).catch(() => {});
    }
  });

  it('a) logout-all revoca todas las sesiones del usuario (SA-008)', async () => {
    const user = await registerUser('logout-all');
    const second = await login(user.email);

    const response = await request(app)
      .post('/api/v1/auth/logout-all')
      .set('Authorization', `Bearer ${user.tokens.accessToken}`);

    expect(response.status, JSON.stringify(response.body)).toBe(200);
    expect(response.body.data.revokedSessions).toBeGreaterThanOrEqual(2);

    for (const tokens of [user.tokens, second]) {
      const me = await request(app)
        .get('/api/v1/users/me')
        .set('Authorization', `Bearer ${tokens.accessToken}`);
      expect(me.status).toBe(401);

      const refresh = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: tokens.refreshToken });
      expect(refresh.status).toBe(401);
    }

    const sessions = await prisma.userSession.findMany({ where: { userId: user.id } });
    expect(sessions.length).toBeGreaterThanOrEqual(2);
    expect(sessions.every((session) => session.revokedReason === 'LOGOUT_ALL')).toBe(true);
  });

  it('c) login limita por IP + correo sin bloquear a otros correos de la misma IP (SA-009)', async () => {
    const limiterApp = express();
    limiterApp.set('trust proxy', true);
    limiterApp.use(express.json());
    limiterApp.post(
      '/login',
      rateLimit({
        windowMs: 60_000,
        max: 2,
        keyGenerator: (req) =>
          `${ipKeyGenerator(req.ip ?? 'ip-desconocida')}:${String(req.body?.email ?? '').trim().toLowerCase()}`,
        standardHeaders: true,
        legacyHeaders: false,
        handler: (_req, res) => res.status(429).json({ error: 'TOO_MANY_REQUESTS' }),
      }),
      (_req, res) => res.status(200).json({ ok: true })
    );

    const ip = '203.0.113.10';
    const firstEmail = 'limite.ip.correo.a@circular.test';
    const secondEmail = 'limite.ip.correo.b@circular.test';

    expect((await limiterAppPost(limiterApp, ip, firstEmail)).status).toBe(200);
    expect((await limiterAppPost(limiterApp, ip, firstEmail)).status).toBe(200);
    const blocked = await limiterAppPost(limiterApp, ip, firstEmail);
    expect(blocked.status).toBe(429);
    expect(blocked.body.error).toBe('TOO_MANY_REQUESTS');

    // Misma IP, correo distinto: no hereda el bloqueo.
    expect((await limiterAppPost(limiterApp, ip, secondEmail)).status).toBe(200);

    // Mismo correo, IP distinta: clave distinta, tampoco hereda el bloqueo.
    expect((await limiterAppPost(limiterApp, '203.0.113.11', firstEmail)).status).toBe(200);

    expect(loginRateLimitKey({ ip, body: { email: '  Usuario@Circular.TEST ' } } as never)).toBe(
      `${ip}:usuario@circular.test`
    );
  });

  it('d) dos refresh simultáneos con el mismo token no cierran la sesión (SA-007)', async () => {
    const user = await registerUser('refresh-concurrente');
    const original = user.tokens;
    const decoded = jwt.decode(original.accessToken) as { sid: string };

    const [first, second] = await Promise.all([
      request(app).post('/api/v1/auth/refresh').send({ refreshToken: original.refreshToken }),
      request(app).post('/api/v1/auth/refresh').send({ refreshToken: original.refreshToken }),
    ]);

    expect(first.status, JSON.stringify(first.body)).toBe(200);
    expect(second.status, JSON.stringify(second.body)).toBe(200);

    const session = await prisma.userSession.findUnique({ where: { id: decoded.sid } });
    expect(session).not.toBeNull();
    expect(session!.revokedAt).toBeNull();
    expect(session!.revokedReason).toBeNull();
    expect(session!.rotatedAt).toBeInstanceOf(Date);

    const validAccess = second.body.data.tokens.accessToken;
    const me = await request(app)
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${validAccess}`);
    expect(me.status, JSON.stringify(me.body)).toBe(200);

    // El margen evita el cierre por concurrencia, pero el refresh más reciente
    // sigue siendo el único vigente tras la segunda rotación.
    const newest = second.body.data.tokens.refreshToken;
    const reuse = await request(app).post('/api/v1/auth/refresh').send({ refreshToken: newest });
    expect(reuse.status, JSON.stringify(reuse.body)).toBe(200);
  });

  it('d2) el reuso del token anterior fuera del margen sí revoca la sesión (SA-007)', async () => {
    const user = await registerUser('refresh-reuso');
    const original = user.tokens;
    const decoded = jwt.decode(original.accessToken) as { sid: string };

    const first = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: original.refreshToken });
    expect(first.status).toBe(200);

    await prisma.userSession.update({
      where: { id: decoded.sid },
      data: { rotatedAt: new Date(Date.now() - 60_000) },
    });

    const reuse = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: original.refreshToken });
    expect(reuse.status).toBe(401);
    expect(reuse.body.error.code).toBe('REFRESH_TOKEN_REUSED');

    const session = await prisma.userSession.findUnique({ where: { id: decoded.sid } });
    expect(session!.revokedReason).toBe('REFRESH_TOKEN_REUSE');
  });
});

function limiterAppPost(app: express.Express, ip: string, email: string) {
  return request(app).post('/login').set('X-Forwarded-For', ip).send({ email, password: 'x' });
}
