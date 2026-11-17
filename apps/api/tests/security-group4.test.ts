import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import fs from 'fs';
import path from 'path';
import { app } from '../src/app';
import { prisma } from '../src/database/prisma';
import { usersRepository } from '../src/modules/users/users.repository';
import { organizationsRepository } from '../src/modules/organizations/organizations.repository';
import { publicationsRepository } from '../src/modules/publications/publications.repository';
import { catalogRepository } from '../src/modules/catalog/catalog.repository';
import { validateEnv } from '../src/config/env';
import { assertDeceptiveFeaturesDisabled } from '../src/security/deceptive-features';
import { accountDeletionService } from '../src/modules/account-deletion/account-deletion.service';
import { moderationService } from '../src/modules/moderation/moderation.service';

/**
 * GRUPO 4 — integridad de verificación, cumplimiento Play y UGC.
 * SA-002, SA-012, SA-013, SA-014, SA-015, SA-016.
 */
describe('GRUPO 4 - verificación, privacidad y UGC (SA-002, SA-012 a SA-016)', () => {
  const createdUserIds: string[] = [];
  const createdOrganizationIds: string[] = [];
  const createdPublicationIds: string[] = [];
  const password = 'Password123!@#';

  let categoryId: string;
  let unitId: string;

  const productionBase = {
    NODE_ENV: 'production',
    DATABASE_URL: 'postgresql://audit:audit@localhost:5432/data_circular_audit_test?schema=public',
    JWT_SECRET: 'A1'.repeat(24),
    JWT_REFRESH_SECRET: 'B2'.repeat(24),
    CORS_ORIGIN: 'https://app.datacircular.org',
    DATA_POLICY_URL: 'https://app.datacircular.org/politica-datos',
    DATA_POLICY_VERSION: '2026.11.09',
  };

  function findRepoRoot(start = process.cwd()): string {
    let current = start;
    while (!fs.existsSync(path.join(current, '.git'))) {
      const parent = path.dirname(current);
      if (parent === current) throw new Error('No se encontró la raíz del repositorio');
      current = parent;
    }
    return current;
  }

  function readRepoFile(relativePath: string): string {
    return fs.readFileSync(path.join(findRepoRoot(), relativePath), 'utf8');
  }

  async function registerUser(label: string, extra: Record<string, unknown> = {}) {
    const email = `${label}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}@circular.test`;
    const response = await request(app).post('/api/v1/auth/register').send({
      fullName: `Usuario ${label}`,
      email,
      password,
      phone: '+57 300 555 0101',
      userType: 'GENERATOR',
      dataPolicyAccepted: true,
      ...extra,
    });
    expect(response.status, JSON.stringify(response.body)).toBe(201);
    const id = response.body.data.user.id as string;
    createdUserIds.push(id);
    return { id, email, tokens: response.body.data.tokens };
  }

  async function createPublication(token: string, description = 'Material de prueba') {
    const response = await request(app)
      .post('/api/v1/publications')
      .set('Authorization', `Bearer ${token}`)
      .send({
        type: 'OFFER',
        categoryId,
        unitId,
        quantity: 10,
        locationAddress: 'Calle 123 # 45-67',
        locationCity: 'Bogotá D.C.',
        description,
      });
    expect(response.status, JSON.stringify(response.body)).toBe(201);
    const id = response.body.data.id as string;
    createdPublicationIds.push(id);
    return id;
  }

  beforeAll(async () => {
    await prisma.$queryRaw`SELECT 1`;
    await catalogRepository.ensureSeeded();
    const tree = await catalogRepository.listCategoriesTree();
    categoryId = tree.find((category) => category.name === 'Plásticos')!.subcategories![0].id;
    const units = await catalogRepository.listUnits();
    unitId = units.find((unit) => unit.abbreviation === 'kg')!.id;
  });

  afterAll(async () => {
    await prisma.auditLog
      .deleteMany({
        where: {
          OR: [
            { organizationId: { in: createdOrganizationIds } },
            { actorUserId: { in: createdUserIds } },
            { targetUserId: { in: createdUserIds } },
          ],
        },
      })
      .catch(() => {});
    await prisma.moderationReport.deleteMany({ where: { reporterId: { in: createdUserIds } } }).catch(() => {});
    await prisma.userBlock
      .deleteMany({
        where: {
          OR: [
            { blockerId: { in: createdUserIds } },
            { blockedId: { in: createdUserIds } },
          ],
        },
      })
      .catch(() => {});
    for (const publicationId of createdPublicationIds) {
      await publicationsRepository.deletePermanently(publicationId).catch(() => {});
    }
    for (const organizationId of createdOrganizationIds) {
      await organizationsRepository.deletePermanently(organizationId).catch(() => {});
    }
    for (const userId of createdUserIds) {
      await usersRepository.deletePermanently(userId).catch(() => {});
    }
  });

  describe('SA-015: URL de política explícita y HTTPS en producción', () => {
    it('exige DATA_POLICY_URL configurada, sin fallback a la página borrador', () => {
      expect(validateEnv(productionBase).success).toBe(true);
      expect(validateEnv({ ...productionBase, DATA_POLICY_URL: undefined }).success).toBe(false);
      expect(
        validateEnv({
          ...productionBase,
          DATA_POLICY_URL: 'https://fundacionimara.org/politica-datos-pendiente',
        }).success
      ).toBe(false);
      expect(validateEnv({ ...productionBase, DATA_POLICY_URL: 'http://inseguro.test/politica' }).success).toBe(
        false
      );

      const previous = process.env.RENDER_EXTERNAL_URL;
      process.env.RENDER_EXTERNAL_URL = 'https://servicio.onrender.com';
      try {
        expect(validateEnv({ ...productionBase, DATA_POLICY_URL: undefined }).success).toBe(false);
      } finally {
        if (previous === undefined) delete process.env.RENDER_EXTERNAL_URL;
        else process.env.RENDER_EXTERNAL_URL = previous;
      }
    });

    it('rechaza versión de términos borrador y banderas engañosas en producción', () => {
      expect(validateEnv({ ...productionBase, TERMS_VERSION: 'pendiente' }).success).toBe(false);
      expect(validateEnv({ ...productionBase, TERMS_VERSION: '2026.11.17' }).success).toBe(true);
      expect(validateEnv({ ...productionBase, SIMULATED_PASSWORD_RECOVERY_ENABLED: 'true' }).success).toBe(
        false
      );
      expect(validateEnv({ ...productionBase, SAMPLE_CERTIFICATES_ENABLED: 'true' }).success).toBe(false);

      const render = readRepoFile('render.yaml');
      expect(render).toContain('DATA_POLICY_URL');
      expect(render).toContain('TERMS_VERSION');
    });
  });

  describe('SA-002 y SA-012: funciones engañosas desactivadas', () => {
    it('los códigos SAMPLE/TEST no devuelven certificados válidos por defecto', async () => {
      const code = `SAMPLE-${Date.now()}-TEST`;
      const response = await request(app).get(`/api/v1/admin/public-verification/${code}`);
      expect(response.status, JSON.stringify(response.body)).toBe(200);
      expect(response.body.data.found).toBe(false);
      expect(response.body.data.certificate ?? null).toBeNull();
    });

    it('no existe recuperación de contraseña simulada y el guard falla con banderas activas', async () => {
      const response = await request(app).post('/api/v1/auth/forgot-password').send({ email: 'x@test.com' });
      expect(response.status).toBe(404);

      expect(() =>
        assertDeceptiveFeaturesDisabled({ SIMULATED_PASSWORD_RECOVERY_ENABLED: true } as never)
      ).toThrow();
      expect(() => assertDeceptiveFeaturesDisabled({ SAMPLE_CERTIFICATES_ENABLED: true } as never)).toThrow();
      expect(() =>
        assertDeceptiveFeaturesDisabled({
          SIMULATED_PASSWORD_RECOVERY_ENABLED: false,
          SAMPLE_CERTIFICATES_ENABLED: false,
        } as never)
      ).not.toThrow();
    });
  });

  describe('SA-014: aceptación de términos versionada y página pública alineada', () => {
    it('guarda aceptación explícita con versión y fecha', async () => {
      const user = await registerUser('terminos-explicitos', {
        termsAccepted: true,
        termsVersion: '2026.11.17',
      });
      const acceptance = await prisma.termsAcceptance.findUnique({ where: { userId: user.id } });
      expect(acceptance).not.toBeNull();
      expect(acceptance!.version).toBe('2026.11.17');
      expect(acceptance!.source).toBe('EXPLICIT');
      expect(acceptance!.acceptedAt).toBeInstanceOf(Date);
    });

    it('marca como LEGACY_IMPLICIT a los clientes herederos sin términos', async () => {
      const user = await registerUser('terminos-heredados');
      const acceptance = await prisma.termsAcceptance.findUnique({ where: { userId: user.id } });
      expect(acceptance).not.toBeNull();
      expect(acceptance!.source).toBe('LEGACY_IMPLICIT');
      expect(acceptance!.version.length).toBeGreaterThan(0);
    });

    it('exige términos en el registro cuando la configuración lo requiere', async () => {
      process.env.REQUIRE_TERMS_ACCEPTANCE = 'true';
      try {
        const email = `terminos-requeridos.${Date.now()}@circular.test`;
        const missing = await request(app).post('/api/v1/auth/register').send({
          fullName: 'Usuario Terminos Requeridos',
          email,
          password,
          phone: '+57 300 555 0101',
          userType: 'GENERATOR',
          dataPolicyAccepted: true,
        });
        expect(missing.status).toBe(400);
        expect(missing.body.error.code).toBe('TERMS_ACCEPTANCE_REQUIRED');

        const accepted = await request(app).post('/api/v1/auth/register').send({
          fullName: 'Usuario Terminos Requeridos',
          email,
          password,
          phone: '+57 300 555 0101',
          userType: 'GENERATOR',
          dataPolicyAccepted: true,
          termsAccepted: true,
        });
        expect(accepted.status, JSON.stringify(accepted.body)).toBe(201);
        createdUserIds.push(accepted.body.data.user.id);
        const acceptance = await prisma.termsAcceptance.findUnique({
          where: { userId: accepted.body.data.user.id },
        });
        expect(acceptance!.source).toBe('EXPLICIT');
      } finally {
        delete process.env.REQUIRE_TERMS_ACCEPTANCE;
      }
    });

    it('publica la página de eliminación y el aviso de retención alineados', async () => {
      const page = await request(app).get('/eliminar-cuenta');
      expect(page.status).toBe(200);
      expect(page.headers['content-type']).toContain('text/html');
      expect(page.text).toContain('eliminación de cuenta');
      expect(page.text).toContain('politica-datos');

      const notice = await request(app).get('/api/v1/account-deletion/retention-notice');
      expect(notice.status).toBe(200);
      expect(notice.body.data.notice.length).toBeGreaterThan(20);
      expect(notice.body.data.retentionDays).toBe(30);
    });
  });

  describe('SA-013: eliminación de cuenta con reautenticación y anonimización', () => {
    it('exige contraseña correcta (reautenticación)', async () => {
      const user = await registerUser('del-clave');
      const response = await request(app)
        .post('/api/v1/account-deletion/request')
        .set('Authorization', `Bearer ${user.tokens.accessToken}`)
        .send({ password: 'WrongPassword123!', confirmRetentionNotice: true });
      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('INVALID_PASSWORD');

      const stillActive = await prisma.user.findUnique({ where: { id: user.id } });
      expect(stillActive!.deletedAt).toBeNull();
    });

    it('exige confirmación del aviso de retención antes de anonimizar', async () => {
      const user = await registerUser('del-aviso');
      const response = await request(app)
        .post('/api/v1/account-deletion/request')
        .set('Authorization', `Bearer ${user.tokens.accessToken}`)
        .send({ password, confirmRetentionNotice: false });
      expect(response.status).toBe(400);

      await expect(
        accountDeletionService.requestDeletion(user.id, {
          password,
          confirmRetentionNotice: false,
        })
      ).rejects.toMatchObject({ code: 'RETENTION_NOTICE_REQUIRED' });

      const stillActive = await prisma.user.findUnique({ where: { id: user.id } });
      expect(stillActive!.deletedAt).toBeNull();
    });

    it('exige traspasar la propiedad cuando es único OWNER y lo audita', async () => {
      const owner = await registerUser('del-owner');
      const successor = await registerUser('del-sucesor');
      const org = await request(app)
        .post('/api/v1/organizations')
        .set('Authorization', `Bearer ${owner.tokens.accessToken}`)
        .send({
          name: `Organización Eliminación ${Date.now()}`,
          orgType: 'COMPANY',
          activityType: 'GENERATOR',
        });
      expect(org.status, JSON.stringify(org.body)).toBe(201);
      const organizationId = org.body.data.id as string;
      createdOrganizationIds.push(organizationId);

      const add = await request(app)
        .post(`/api/v1/organizations/${organizationId}/members`)
        .set('Authorization', `Bearer ${owner.tokens.accessToken}`)
        .send({ email: successor.email, roleName: 'ADMIN' });
      expect(add.status, JSON.stringify(add.body)).toBe(201);

      const withoutSuccessor = await request(app)
        .post('/api/v1/account-deletion/request')
        .set('Authorization', `Bearer ${owner.tokens.accessToken}`)
        .send({ password, confirmRetentionNotice: true });
      expect(withoutSuccessor.status).toBe(400);
      expect(withoutSuccessor.body.error.code).toBe('NEW_OWNER_REQUIRED');

      const deleted = await request(app)
        .post('/api/v1/account-deletion/request')
        .set('Authorization', `Bearer ${owner.tokens.accessToken}`)
        .send({ password, confirmRetentionNotice: true, newOwnerId: successor.id });
      expect(deleted.status, JSON.stringify(deleted.body)).toBe(200);
      expect(deleted.body.data.transferredOrganizations).toContain(organizationId);

      const members = await request(app)
        .get(`/api/v1/organizations/${organizationId}/members`)
        .set('Authorization', `Bearer ${successor.tokens.accessToken}`);
      expect(members.status).toBe(200);
      const successorMember = members.body.data.find((member: any) => member.userId === successor.id);
      expect(successorMember.role.name).toBe('OWNER');

      const audit = await prisma.auditLog.findFirst({
        where: {
          action: 'OWNERSHIP_TRANSFERRED_ON_ACCOUNT_DELETION',
          organizationId,
        },
      });
      expect(audit).not.toBeNull();
      expect(audit!.actorUserId).toBe(owner.id);
      expect(audit!.targetUserId).toBe(successor.id);
    });

    it('anonimiza UGC, revoca sesiones y deja constancia en AuditLog', async () => {
      const user = await registerUser('del-anon');
      const publicationId = await createPublication(
        user.tokens.accessToken,
        'Publicación con datos personales del titular'
      );
      const secondSession = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: user.email, password });
      expect(secondSession.status).toBe(200);

      const response = await request(app)
        .post('/api/v1/account-deletion/request')
        .set('Authorization', `Bearer ${user.tokens.accessToken}`)
        .send({ password, confirmRetentionNotice: true });
      expect(response.status, JSON.stringify(response.body)).toBe(200);
      expect(response.body.data.revokedSessions).toBeGreaterThanOrEqual(2);
      expect(response.body.data.purgeAt).toBeTruthy();

      const anonymized = await prisma.user.findUnique({ where: { id: user.id } });
      expect(anonymized!.fullName).toBe('Usuario eliminado');
      expect(anonymized!.email).toContain('deleted+');
      expect(anonymized!.phone).toBeNull();
      expect(anonymized!.status).toBe('INACTIVE');
      expect(anonymized!.deletedAt).toBeInstanceOf(Date);

      const sessions = await prisma.userSession.findMany({ where: { userId: user.id } });
      expect(sessions.length).toBeGreaterThanOrEqual(2);
      expect(sessions.every((session) => session.revokedReason === 'ACCOUNT_DELETION')).toBe(true);

      const publication = await prisma.materialPublication.findUnique({ where: { id: publicationId } });
      expect(publication!.description).toContain('eliminado');
      expect(publication!.locationAddress).toBe('Dirección eliminada');
      expect(publication!.photoUrl).toBeNull();

      const audit = await prisma.auditLog.findFirst({
        where: { action: 'ACCOUNT_DELETION_REQUESTED', entityId: user.id },
      });
      expect(audit).not.toBeNull();
      expect(audit!.actorUserId).toBe(user.id);

      const me = await request(app)
        .get('/api/v1/users/me')
        .set('Authorization', `Bearer ${user.tokens.accessToken}`);
      expect(me.status).toBe(401);
    });

    it('la purga programada marca purgedAt y registra auditoría', async () => {
      const user = await registerUser('del-purge');
      await prisma.user.update({
        where: { id: user.id },
        data: { deletedAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000) },
      });

      const purged = await accountDeletionService.purgeDeletedAccounts();
      expect(purged).toBeGreaterThanOrEqual(1);

      const afterPurge = await prisma.user.findUnique({ where: { id: user.id } });
      expect(afterPurge!.purgedAt).toBeInstanceOf(Date);
      expect(afterPurge!.email).toContain('purged+');

      const audit = await prisma.auditLog.findFirst({
        where: { action: 'ACCOUNT_PURGED', entityId: user.id },
      });
      expect(audit).not.toBeNull();
    });
  });

  describe('SA-016: reporte, bloqueo y cola de moderación con auditoría', () => {
    it('reportar contenido crea un reporte PENDING y bloquea duplicados', async () => {
      const reporter = await registerUser('rep-reporta');
      const owner = await registerUser('rep-dueno');
      const publicationId = await createPublication(owner.tokens.accessToken);

      const response = await request(app)
        .post('/api/v1/moderation/reports')
        .set('Authorization', `Bearer ${reporter.tokens.accessToken}`)
        .send({
          targetType: 'PUBLICATION',
          targetId: publicationId,
          reason: 'Contenido inapropiado',
          details: 'Detalle de la denuncia',
        });
      expect(response.status, JSON.stringify(response.body)).toBe(201);
      const reportId = response.body.data.id as string;

      const duplicate = await request(app)
        .post('/api/v1/moderation/reports')
        .set('Authorization', `Bearer ${reporter.tokens.accessToken}`)
        .send({ targetType: 'PUBLICATION', targetId: publicationId, reason: 'Contenido inapropiado' });
      expect(duplicate.status).toBe(409);
      expect(duplicate.body.error.code).toBe('REPORT_ALREADY_PENDING');

      const stored = await prisma.moderationReport.findUnique({ where: { id: reportId } });
      expect(stored!.status).toBe('PENDING');
      const audit = await prisma.auditLog.findFirst({
        where: { action: 'UGC_REPORT_CREATED', entityId: reportId },
      });
      expect(audit).not.toBeNull();
      expect(audit!.actorUserId).toBe(reporter.id);
    });

    it('bloquear usuario persiste el bloqueo y aplica en ambos sentidos', async () => {
      const blocker = await registerUser('bloquea');
      const blocked = await registerUser('bloqueado');

      const response = await request(app)
        .post('/api/v1/moderation/blocks')
        .set('Authorization', `Bearer ${blocker.tokens.accessToken}`)
        .send({ userId: blocked.id });
      expect(response.status, JSON.stringify(response.body)).toBe(201);

      const block = await prisma.userBlock.findUnique({
        where: {
          blockerId_blockedId: { blockerId: blocker.id, blockedId: blocked.id },
        },
      });
      expect(block).not.toBeNull();

      const audit = await prisma.auditLog.findFirst({
        where: { action: 'USER_BLOCKED', targetUserId: blocked.id },
      });
      expect(audit).not.toBeNull();

      await expect(moderationService.assertNotBlocked(blocker.id, blocked.id)).rejects.toMatchObject({
        code: 'USER_BLOCKED',
      });
      await expect(moderationService.assertNotBlocked(blocked.id, blocker.id)).rejects.toMatchObject({
        code: 'USER_BLOCKED',
      });
    });

    it('un usuario bloqueado no puede iniciar conversación con quien lo bloqueó', async () => {
      const owner = await registerUser('guard-dueno');
      const other = await registerUser('guard-otro');
      const publicationId = await createPublication(owner.tokens.accessToken);

      const block = await request(app)
        .post('/api/v1/moderation/blocks')
        .set('Authorization', `Bearer ${owner.tokens.accessToken}`)
        .send({ userId: other.id });
      expect(block.status).toBe(201);

      const conversation = await request(app)
        .post('/api/v1/conversations')
        .set('Authorization', `Bearer ${other.tokens.accessToken}`)
        .send({ publicationId });
      expect(conversation.status).toBe(403);
      expect(conversation.body.error.code).toBe('USER_BLOCKED');
    });

    it('la cola de moderación admin lista y resuelve reportes con auditoría', async () => {
      const reporter = await registerUser('queue-reporta');
      const owner = await registerUser('queue-dueno');
      const admin = await registerUser('queue-admin');
      await prisma.user.update({ where: { id: admin.id }, data: { role: 'ADMIN' } });
      const adminLogin = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: admin.email, password });
      expect(adminLogin.status).toBe(200);
      const adminToken = adminLogin.body.data.tokens.accessToken as string;

      const publicationId = await createPublication(owner.tokens.accessToken);
      const report = await request(app)
        .post('/api/v1/moderation/reports')
        .set('Authorization', `Bearer ${reporter.tokens.accessToken}`)
        .send({ targetType: 'PUBLICATION', targetId: publicationId, reason: 'Revisión administrativa' });
      expect(report.status).toBe(201);
      const reportId = report.body.data.id as string;

      const forbidden = await request(app)
        .get('/api/v1/admin/moderation/reports')
        .set('Authorization', `Bearer ${reporter.tokens.accessToken}`);
      expect(forbidden.status).toBe(403);

      const queue = await request(app)
        .get('/api/v1/admin/moderation/reports?status=PENDING')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(queue.status, JSON.stringify(queue.body)).toBe(200);
      expect(queue.body.data.some((item: any) => item.id === reportId)).toBe(true);

      const resolved = await request(app)
        .post(`/api/v1/admin/moderation/reports/${reportId}/resolve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ resolution: 'ACTION_TAKEN', note: 'Revisado por administración' });
      expect(resolved.status, JSON.stringify(resolved.body)).toBe(200);
      expect(resolved.body.data.status).toBe('RESOLVED');

      const audit = await prisma.auditLog.findFirst({
        where: { action: 'UGC_REPORT_RESOLVED', entityId: reportId },
      });
      expect(audit).not.toBeNull();
      expect(audit!.actorUserId).toBe(admin.id);
    });
  });
});
