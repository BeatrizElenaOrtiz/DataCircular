import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';
import { prisma } from '../src/database/prisma';
import { usersRepository } from '../src/modules/users/users.repository';
import { organizationsRepository } from '../src/modules/organizations/organizations.repository';
import { catalogRepository } from '../src/modules/catalog/catalog.repository';
import { publicationsRepository } from '../src/modules/publications/publications.repository';

describe('GRUPO 2 - Autorización y privacidad (SA-003, SA-004)', () => {
  const createdUserIds: string[] = [];
  const createdOrganizationIds: string[] = [];
  const createdPublicationIds: string[] = [];

  let ownerToken: string;
  let ownerUserId: string;
  let ownerEmail: string;
  let ownerPhone: string;

  let adminToken: string;
  let adminUserId: string;
  let adminEmail: string;

  let outsiderToken: string;
  let outsiderUserId: string;

  let organizationId: string;
  let adminMemberId: string;

  let categoryId: string;
  let unitId: string;

  const exactAddress = 'Calle Privada 123 # 45-67, Interior 8';

  async function registerUser(
    label: string,
    userType: 'GENERATOR' | 'RECYCLER' | 'TRANSPORTER'
  ): Promise<{ token: string; id: string; email: string; phone: string }> {
    const email = `${label}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}@circular.test`;
    const phone = `+57 300 ${Math.floor(1000000 + Math.random() * 8999999)}`;
    const response = await request(app)
      .post('/api/v1/auth/register')
      .send({
        fullName: `Usuario ${label}`,
        email,
        password: 'Password123!@#',
        phone,
        userType,
        dataPolicyAccepted: true,
      });

    expect(response.status, JSON.stringify(response.body)).toBe(201);
    const id = response.body.data.user.id;
    createdUserIds.push(id);

    return {
      token: response.body.data.tokens.accessToken,
      id,
      email,
      phone,
    };
  }

  async function listMembers(token: string) {
    const response = await request(app)
      .get(`/api/v1/organizations/${organizationId}/members`)
      .set('Authorization', `Bearer ${token}`);
    expect(response.status, JSON.stringify(response.body)).toBe(200);
    return response.body.data as Array<{
      id: string;
      userId: string;
      role: { name: string };
      status: string;
    }>;
  }

  beforeAll(async () => {
    await prisma.$queryRaw`SELECT 1`;
    await catalogRepository.ensureSeeded();

    const owner = await registerUser('propietario', 'GENERATOR');
    ownerToken = owner.token;
    ownerUserId = owner.id;
    ownerEmail = owner.email;
    ownerPhone = owner.phone;

    const admin = await registerUser('administrador', 'RECYCLER');
    adminToken = admin.token;
    adminUserId = admin.id;
    adminEmail = admin.email;

    const outsider = await registerUser('tercero', 'TRANSPORTER');
    outsiderToken = outsider.token;
    outsiderUserId = outsider.id;

    const orgResponse = await request(app)
      .post('/api/v1/organizations')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        name: `Organización Seguridad ${Date.now()}`,
        orgType: 'COMPANY',
        activityType: 'GENERATOR',
      });

    expect(orgResponse.status, JSON.stringify(orgResponse.body)).toBe(201);
    organizationId = orgResponse.body.data.id;
    createdOrganizationIds.push(organizationId);

    const addResponse = await request(app)
      .post(`/api/v1/organizations/${organizationId}/members`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        email: adminEmail,
        roleName: 'ADMIN',
      });

    expect(addResponse.status, JSON.stringify(addResponse.body)).toBe(201);
    adminMemberId = addResponse.body.data.id;

    const tree = await catalogRepository.listCategoriesTree();
    categoryId = tree.find((category) => category.name === 'Plásticos')!.subcategories![0].id;
    const units = await catalogRepository.listUnits();
    unitId = units.find((unit) => unit.abbreviation === 'kg')!.id;
  });

  afterAll(async () => {
    for (const publicationId of createdPublicationIds) {
      await publicationsRepository.deletePermanently(publicationId).catch(() => {});
    }
    await prisma.auditLog.deleteMany({
      where: {
        OR: [
          { organizationId: { in: createdOrganizationIds } },
          { actorUserId: { in: createdUserIds } },
          { targetUserId: { in: createdUserIds } },
        ],
      },
    }).catch(() => {});
    for (const organizationId of createdOrganizationIds) {
      await organizationsRepository.deletePermanently(organizationId).catch(() => {});
    }
    for (const userId of createdUserIds) {
      await usersRepository.deletePermanently(userId).catch(() => {});
    }
  });

  describe('SA-004: jerarquía de roles en organizaciones', () => {
    it('un ADMIN no puede ascenderse a OWNER', async () => {
      const response = await request(app)
        .patch(`/api/v1/organizations/${organizationId}/members/${adminMemberId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ roleName: 'OWNER' });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);

      const members = await listMembers(ownerToken);
      expect(members.find((member) => member.id === adminMemberId)?.role.name).toBe('ADMIN');
    });

    it('un ADMIN no puede modificar el rol del OWNER', async () => {
      const members = await listMembers(ownerToken);
      const ownerMember = members.find((member) => member.role.name === 'OWNER');

      const response = await request(app)
        .patch(`/api/v1/organizations/${organizationId}/members/${ownerMember!.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ roleName: 'MEMBER' });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });

    it('un tercero sin membresía no puede modificar roles', async () => {
      const response = await request(app)
        .patch(`/api/v1/organizations/${organizationId}/members/${adminMemberId}`)
        .set('Authorization', `Bearer ${outsiderToken}`)
        .send({ roleName: 'MEMBER' });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });

    it('un ADMIN no puede invitar a un tercero con rol OWNER', async () => {
      const response = await request(app)
        .post(`/api/v1/organizations/${organizationId}/members`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: (await usersRepository.findById(outsiderUserId))!.email,
          roleName: 'OWNER',
        });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });

    it('el OWNER sí puede asignar OWNER y el cambio queda auditado', async () => {
      const response = await request(app)
        .patch(`/api/v1/organizations/${organizationId}/members/${adminMemberId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ roleName: 'OWNER' });

      expect(response.status, JSON.stringify(response.body)).toBe(200);
      expect(response.body.data.role.name).toBe('OWNER');

      const audit = await prisma.auditLog.findFirst({
        where: {
          organizationId,
          action: 'ORGANIZATION_MEMBER_ROLE_UPDATED',
          targetUserId: adminUserId,
        },
        orderBy: { createdAt: 'desc' },
      });

      expect(audit).not.toBeNull();
      expect(audit?.actorUserId).toBe(ownerUserId);
      expect(audit?.previousValue).toMatchObject({ role: 'ADMIN' });
      expect(audit?.newValue).toMatchObject({ role: 'OWNER' });
    });
  });

  describe('SA-003: publicaciones sin PII ni dirección exacta', () => {
    let publicationId: string;

    beforeAll(async () => {
      const response = await request(app)
        .post('/api/v1/publications')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          type: 'OFFER',
          categoryId,
          quantity: 120,
          unitId,
          locationAddress: exactAddress,
          locationCity: 'Bogotá D.C.',
          locationArea: 'Suba',
          description: 'Material de prueba de privacidad.',
        });

      expect(response.status, JSON.stringify(response.body)).toBe(201);
      publicationId = response.body.data.id;
      createdPublicationIds.push(publicationId);
    });

    function expectNoPublicationPii(payload: unknown, address: string) {
      const serialized = JSON.stringify(payload);
      expect(serialized).not.toContain(ownerEmail);
      expect(serialized).not.toContain(ownerPhone);
      expect(serialized).not.toContain(address);
      expect(serialized).not.toContain('Calle Privada 123');
      expect(serialized).not.toContain('"email"');
      expect(serialized).not.toContain('"phone"');
    }

    it('el detalle visto por otro usuario oculta correo, teléfono y dirección exacta', async () => {
      const response = await request(app)
        .get(`/api/v1/publications/${publicationId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status, JSON.stringify(response.body)).toBe(200);
      expect(response.body.data.ownerUser).toMatchObject({ id: ownerUserId });
      expect(response.body.data.ownerUser).not.toHaveProperty('email');
      expect(response.body.data.ownerUser).not.toHaveProperty('phone');
      expect(response.body.data.locationAddress).toBe('Suba');
      expectNoPublicationPii(response.body.data, exactAddress);
    });

    it('la búsqueda y los listados ocultan los mismos datos', async () => {
      const search = await request(app)
        .get('/api/v1/publications/search')
        .query({ categoryId, city: 'Bogotá' })
        .set('Authorization', `Bearer ${adminToken}`);

      expect(search.status, JSON.stringify(search.body)).toBe(200);
      const found = search.body.data.data.find(
        (publication: { id: string }) => publication.id === publicationId
      );
      expect(found).toBeDefined();
      expect(found.locationAddress).toBe('Suba');
      expectNoPublicationPii(found, exactAddress);
    });

    it('un tercero sin permisos puede leer el detalle público enmascarado, pero no modificarlo', async () => {
      const detail = await request(app)
        .get(`/api/v1/publications/${publicationId}`)
        .set('Authorization', `Bearer ${outsiderToken}`);

      expect(detail.status, JSON.stringify(detail.body)).toBe(200);
      expect(detail.body.data.locationAddress).toBe('Suba');
      expectNoPublicationPii(detail.body.data, exactAddress);

      const update = await request(app)
        .patch(`/api/v1/publications/${publicationId}`)
        .set('Authorization', `Bearer ${outsiderToken}`)
        .send({ description: 'Intento de escritura cruzada' });

      expect(update.status).toBe(403);
      expect(update.body.success).toBe(false);

      const deletion = await request(app)
        .delete(`/api/v1/publications/${publicationId}`)
        .set('Authorization', `Bearer ${outsiderToken}`);

      expect(deletion.status).toBe(403);
      expect(deletion.body.success).toBe(false);

      const persisted = await prisma.materialPublication.findUnique({
        where: { id: publicationId },
      });
      expect(persisted?.description).toBe('Material de prueba de privacidad.');
      expect(persisted?.deletedAt).toBeNull();
    });

    it('el propietario conserva la dirección exacta para editar su publicación', async () => {
      const detail = await request(app)
        .get(`/api/v1/publications/${publicationId}`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(detail.status, JSON.stringify(detail.body)).toBe(200);
      expect(detail.body.data.locationAddress).toBe(exactAddress);
      expect(detail.body.data.ownerUser).not.toHaveProperty('email');
      expect(detail.body.data.ownerUser).not.toHaveProperty('phone');

      const mine = await request(app)
        .get('/api/v1/publications/mine')
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(mine.status).toBe(200);
      expect(mine.body.data.data[0].locationAddress).toBe(exactAddress);
    });

    it('las rutas de publicaciones y organizaciones rechazan solicitudes sin autenticación', async () => {
      const publication = await request(app).get(`/api/v1/publications/${publicationId}`);
      expect(publication.status).toBe(401);

      const organization = await request(app).get(
        `/api/v1/organizations/${organizationId}/members`
      );
      expect(organization.status).toBe(401);

      const operations = await request(app).get('/api/v1/operations');
      expect(operations.status).toBe(401);
    });
  });
});
