import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';
import { prisma } from '../src/database/prisma';
import { usersRepository } from '../src/modules/users/users.repository';
import { organizationsRepository } from '../src/modules/organizations/organizations.repository';
import { catalogRepository } from '../src/modules/catalog/catalog.repository';

/**
 * Verificación previa al Grupo 3: barrida de DTO público.
 *
 * Recorre los endpoints que devuelven publicaciones, propuestas, conversaciones,
 * operaciones o perfiles de usuario y comprueba que ningún JSON expuesto a un
 * tercero contiene correo o teléfono de terceros.
 *
 * En operaciones, los teléfonos de las dos partes son legítimos porque son
 * contrapartes autorizadas para coordinar la logística. Un tercero ajeno nunca
 * debe aparecer, ni por detalle ni por listado.
 */
describe('Barrida de DTO público sin PII de terceros', () => {
  const createdUserIds: string[] = [];
  const createdOrganizationIds: string[] = [];
  const createdPublicationIds: string[] = [];

  let ownerToken: string;
  let ownerUserId: string;
  let ownerEmail: string;
  let ownerPhone: string;

  let counterpartToken: string;
  let counterpartUserId: string;
  let counterpartEmail: string;
  let counterpartPhone: string;

  let outsiderToken: string;
  let outsiderUserId: string;
  let outsiderEmail: string;
  let outsiderPhone: string;

  let organizationId: string;
  let categoryId: string;
  let unitId: string;
  let offerPublicationId: string;
  let needPublicationId: string;
  let conversationId: string;
  let proposalId: string;
  let operationId: string;

  const offerAddress = 'Calle Pública 10 # 20-30';
  const needAddress = 'Calle Pública 40 # 50-60';
  const pickupAddress = 'Carrera Reservada 789 # 10-11, Interior 2';

  const contacts = () => [
    { email: ownerEmail, phone: ownerPhone },
    { email: counterpartEmail, phone: counterpartPhone },
    { email: outsiderEmail, phone: outsiderPhone },
  ];

  function serialized(payload: unknown): string {
    return JSON.stringify(payload);
  }

  function expectNoContactFields(payload: unknown) {
    const json = serialized(payload);
    expect(json).not.toMatch(/"email"\s*:/);
    expect(json).not.toMatch(/"phone"\s*:/);
  }

  function expectNoContacts(payload: unknown, forbidden = contacts()) {
    const json = serialized(payload);
    for (const contact of forbidden) {
      expect(json).not.toContain(contact.email);
      expect(json).not.toContain(contact.phone);
    }
  }

  function expectNoEmails(payload: unknown, forbidden = contacts()) {
    const json = serialized(payload);
    for (const contact of forbidden) {
      expect(json).not.toContain(contact.email);
    }
  }

  async function registerUser(
    label: string,
    userType: 'GENERATOR' | 'RECYCLER' | 'TRANSPORTER'
  ): Promise<{ token: string; id: string; email: string; phone: string }> {
    const email = `${label}.dto.${Date.now()}.${Math.random().toString(36).slice(2, 8)}@circular.test`;
    const phone = `+57 32${Math.floor(10000000 + Math.random() * 89999999)}`;
    const response = await request(app)
      .post('/api/v1/auth/register')
      .send({
        fullName: `Usuario ${label} DTO`,
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

  // Respuestas de endpoints de escritura que devuelven DTO de propuesta.
  let proposalCreateBody: unknown;
  let proposalAcceptBody: unknown;

  beforeAll(async () => {
    await prisma.$queryRaw`SELECT 1`;
    await catalogRepository.ensureSeeded();

    const owner = await registerUser('propietario', 'GENERATOR');
    ownerToken = owner.token;
    ownerUserId = owner.id;
    ownerEmail = owner.email;
    ownerPhone = owner.phone;

    const counterpart = await registerUser('contraparte', 'RECYCLER');
    counterpartToken = counterpart.token;
    counterpartUserId = counterpart.id;
    counterpartEmail = counterpart.email;
    counterpartPhone = counterpart.phone;

    const outsider = await registerUser('tercero', 'RECYCLER');
    outsiderToken = outsider.token;
    outsiderUserId = outsider.id;
    outsiderEmail = outsider.email;
    outsiderPhone = outsider.phone;

    const tree = await catalogRepository.listCategoriesTree();
    categoryId = tree.find((category) => category.name === 'Plásticos')!.subcategories![0].id;
    const units = await catalogRepository.listUnits();
    unitId = units.find((unit) => unit.abbreviation === 'kg')!.id;

    // Organización de la contraparte con el material seleccionado, para que
    // GET /matches/my-suggestions devuelva publicaciones reales.
    const organization = await request(app)
      .post('/api/v1/organizations')
      .set('Authorization', `Bearer ${counterpartToken}`)
      .send({
        name: `Organización DTO ${Date.now()}`,
        orgType: 'COMPANY',
        activityType: 'RECYCLER',
        city: 'Bogotá D.C.',
        materialCategoryIds: [categoryId],
      });
    expect(organization.status, JSON.stringify(organization.body)).toBe(201);
    organizationId = organization.body.data.id;
    createdOrganizationIds.push(organizationId);

    await prisma.organizationMaterialCategory.upsert({
      where: { organizationId_categoryId: { organizationId, categoryId } },
      update: {},
      create: { organizationId, categoryId },
    });

    // Publicación OFFER del propietario.
    const offer = await request(app)
      .post('/api/v1/publications')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        type: 'OFFER',
        categoryId,
        quantity: 500,
        unitId,
        locationAddress: offerAddress,
        locationCity: 'Bogotá D.C.',
        locationArea: 'Fontibón',
        description: 'Oferta para barrida de DTO público.',
      });
    expect(offer.status, JSON.stringify(offer.body)).toBe(201);
    offerPublicationId = offer.body.data.id;
    createdPublicationIds.push(offerPublicationId);

    // Publicación NEED creada directamente en BD para ejercitar el endpoint de
    // coincidencias (la API solo permite publicar OFFER a generadores).
    const need = await prisma.materialPublication.create({
      data: {
        type: 'NEED',
        ownerUserId: counterpartUserId,
        categoryId,
        quantity: 10,
        unitId,
        description: 'Necesidad para barrida de coincidencias.',
        locationAddress: needAddress,
        locationCity: 'Bogotá D.C.',
        locationArea: 'Fontibón',
        status: 'ACTIVE',
      },
    });
    needPublicationId = need.id;
    createdPublicationIds.push(needPublicationId);

    // Conversación, propuesta y operación aceptada.
    const conversation = await request(app)
      .post('/api/v1/conversations')
      .set('Authorization', `Bearer ${counterpartToken}`)
      .send({
        publicationId: offerPublicationId,
        initialMessage: 'Consulta por el lote ofertado.',
      });
    expect(conversation.status, JSON.stringify(conversation.body)).toBe(201);
    conversationId = conversation.body.data.id;

    const proposal = await request(app)
      .post(`/api/v1/conversations/${conversationId}/proposals`)
      .set('Authorization', `Bearer ${counterpartToken}`)
      .send({
        quantity: 450,
        unitId,
        terms: 'Retiro en planta y pago contra recepción.',
      });
    expect(proposal.status, JSON.stringify(proposal.body)).toBe(201);
    proposalId = proposal.body.data.id;
    proposalCreateBody = proposal.body;

    const accepted = await request(app)
      .post(`/api/v1/proposals/${proposalId}/accept`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(accepted.status, JSON.stringify(accepted.body)).toBe(200);
    proposalAcceptBody = accepted.body;

    const operation = await request(app)
      .post('/api/v1/operations')
      .set('Authorization', `Bearer ${counterpartToken}`)
      .send({ proposalId });
    expect([200, 201], JSON.stringify(operation.body)).toContain(operation.status);
    operationId = operation.body.data.id;

    const scheduled = await request(app)
      .post(`/api/v1/operations/${operationId}/schedule`)
      .set('Authorization', `Bearer ${counterpartToken}`)
      .send({
        scheduledDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
        pickupAddress,
        pickupArea: 'Fontibón',
      });
    expect(scheduled.status, JSON.stringify(scheduled.body)).toBe(200);
  });

  afterAll(async () => {
    await prisma.operationEvidence.deleteMany({ where: { operationId } }).catch(() => {});
    await prisma.operationReview.deleteMany({ where: { operationId } }).catch(() => {});
    await prisma.operation.deleteMany({ where: { id: operationId } }).catch(() => {});
    await prisma.proposal.deleteMany({ where: { conversationId } }).catch(() => {});
    await prisma.message.deleteMany({ where: { conversationId } }).catch(() => {});
    await prisma.conversationParticipantState
      .deleteMany({ where: { conversationId } })
      .catch(() => {});
    await prisma.conversation.deleteMany({ where: { id: conversationId } }).catch(() => {});

    for (const publicationId of createdPublicationIds) {
      await prisma.materialPublication.deleteMany({ where: { id: publicationId } }).catch(() => {});
    }

    await prisma.organizationMaterialCategory
      .deleteMany({ where: { organizationId } })
      .catch(() => {});
    for (const id of createdOrganizationIds) {
      await organizationsRepository.deletePermanently(id).catch(() => {});
    }
    for (const userId of createdUserIds) {
      await usersRepository.deletePermanently(userId).catch(() => {});
    }
  });

  describe('Publicaciones', () => {
    it('la búsqueda no devuelve correo ni teléfono de ningún usuario', async () => {
      const response = await request(app)
        .get('/api/v1/publications/search')
        .query({ categoryId, city: 'Bogotá' })
        .set('Authorization', `Bearer ${counterpartToken}`);

      expect(response.status, JSON.stringify(response.body)).toBe(200);
      const found = (response.body.data.data as Array<{ id: string }>).find(
        (publication) => publication.id === offerPublicationId
      );
      expect(found).toBeDefined();
      expectNoContactFields(response.body);
      expectNoContacts(response.body);
    });

    it('el detalle visto por un tercero no devuelve correo ni teléfono', async () => {
      const response = await request(app)
        .get(`/api/v1/publications/${offerPublicationId}`)
        .set('Authorization', `Bearer ${outsiderToken}`);

      expect(response.status, JSON.stringify(response.body)).toBe(200);
      expect(response.body.data.ownerUser).toEqual({
        id: ownerUserId,
        fullName: expect.any(String),
      });
      expectNoContactFields(response.body);
      expectNoContacts(response.body);
    });

    it('las coincidencias por publicación no devuelven correo ni teléfono', async () => {
      const response = await request(app)
        .get(`/api/v1/publications/${needPublicationId}/matches`)
        .set('Authorization', `Bearer ${counterpartToken}`);

      expect(response.status, JSON.stringify(response.body)).toBe(200);
      expect(
        (response.body.data as Array<{ publicationId: string }>).some(
          (match) => match.publicationId === offerPublicationId
        )
      ).toBe(true);
      expectNoContactFields(response.body);
      expectNoContacts(response.body);
    });

    it('las sugerencias de coincidencias no devuelven correo ni teléfono', async () => {
      const response = await request(app)
        .get('/api/v1/matches/my-suggestions')
        .set('Authorization', `Bearer ${counterpartToken}`);

      expect(response.status, JSON.stringify(response.body)).toBe(200);
      expect(
        (response.body.data as Array<{ id: string }>).some(
          (publication) => publication.id === offerPublicationId
        )
      ).toBe(true);
      expectNoContactFields(response.body);
      expectNoContacts(response.body);
    });

    it('el listado propio no devuelve correo ni teléfono del propietario', async () => {
      const response = await request(app)
        .get('/api/v1/publications/mine')
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(response.status, JSON.stringify(response.body)).toBe(200);
      expectNoContactFields(response.body);
      expectNoContacts(response.body);
    });
  });

  describe('Conversaciones y propuestas', () => {
    it('el listado de conversaciones no devuelve correo ni teléfono', async () => {
      const response = await request(app)
        .get('/api/v1/conversations')
        .set('Authorization', `Bearer ${counterpartToken}`);

      expect(response.status, JSON.stringify(response.body)).toBe(200);
      expect(
        (response.body.data.data as Array<{ id: string }>).some(
          (conversation) => conversation.id === conversationId
        )
      ).toBe(true);
      expectNoContactFields(response.body);
      expectNoContacts(response.body);
    });

    it('el detalle de conversación y su propuesta vigente no devuelven correo ni teléfono', async () => {
      const response = await request(app)
        .get(`/api/v1/conversations/${conversationId}`)
        .set('Authorization', `Bearer ${counterpartToken}`);

      expect(response.status, JSON.stringify(response.body)).toBe(200);
      expect(response.body.data.currentProposal.id).toBe(proposalId);
      expect(response.body.data.counterpart).not.toHaveProperty('email');
      expect(response.body.data.counterpart).not.toHaveProperty('phone');
      expectNoContactFields(response.body);
      expectNoContacts(response.body);
    });

    it('los mensajes de la conversación no devuelven correo ni teléfono', async () => {
      const response = await request(app)
        .get(`/api/v1/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${counterpartToken}`);

      expect(response.status, JSON.stringify(response.body)).toBe(200);
      expectNoContactFields(response.body);
      expectNoContacts(response.body);
    });

    it('las respuestas de creación y aceptación de propuesta no devuelven correo ni teléfono', () => {
      expectNoContactFields(proposalCreateBody);
      expectNoContacts(proposalCreateBody);
      expectNoContactFields(proposalAcceptBody);
      expectNoContacts(proposalAcceptBody);
    });
  });

  describe('Operaciones', () => {
    it('el detalle de operación de una parte solo expone teléfonos de las contrapartes autorizadas', async () => {
      const response = await request(app)
        .get(`/api/v1/operations/${operationId}`)
        .set('Authorization', `Bearer ${counterpartToken}`);

      expect(response.status, JSON.stringify(response.body)).toBe(200);
      expect(response.body.data.pickupAddress).toBe(pickupAddress);
      expect(serialized(response.body)).not.toMatch(/"email"\s*:/);
      // Correos de cualquiera de los usuarios de la prueba nunca aparecen.
      expectNoEmails(response.body);
      // El tercero ajeno no aparece ni con teléfono.
      expect(serialized(response.body)).not.toContain(outsiderEmail);
      expect(serialized(response.body)).not.toContain(outsiderPhone);
    });

    it('el listado de operaciones de una parte no expone PII de terceros', async () => {
      const response = await request(app)
        .get('/api/v1/operations')
        .set('Authorization', `Bearer ${counterpartToken}`);

      expect(response.status, JSON.stringify(response.body)).toBe(200);
      expect(
        (response.body.data.data as Array<{ id: string }>).some(
          (operation) => operation.id === operationId
        )
      ).toBe(true);
      expect(serialized(response.body)).not.toMatch(/"email"\s*:/);
      expectNoEmails(response.body);
      expect(serialized(response.body)).not.toContain(outsiderEmail);
      expect(serialized(response.body)).not.toContain(outsiderPhone);
    });

    it('un tercero no puede leer el detalle ni el listado de la operación', async () => {
      const detail = await request(app)
        .get(`/api/v1/operations/${operationId}`)
        .set('Authorization', `Bearer ${outsiderToken}`);

      expect(detail.status).toBe(403);
      expect(serialized(detail.body)).not.toContain(pickupAddress);
      expectNoContacts(detail.body);

      const list = await request(app)
        .get('/api/v1/operations')
        .set('Authorization', `Bearer ${outsiderToken}`);

      expect(list.status).toBe(200);
      expect(
        (list.body.data.data as Array<{ id: string }>).some(
          (operation) => operation.id === operationId
        )
      ).toBe(false);
      expect(serialized(list.body)).not.toContain(pickupAddress);
      expect(serialized(list.body)).not.toContain(ownerEmail);
      expect(serialized(list.body)).not.toContain(counterpartPhone);
    });
  });

  describe('Perfiles públicos', () => {
    it('el perfil público de otro usuario no devuelve correo ni teléfono', async () => {
      const response = await request(app)
        .get(`/api/v1/users/${ownerUserId}`)
        .set('Authorization', `Bearer ${counterpartToken}`);

      expect(response.status, JSON.stringify(response.body)).toBe(200);
      expect(response.body.data.id).toBe(ownerUserId);
      expect(response.body.data).not.toHaveProperty('email');
      expect(response.body.data).not.toHaveProperty('phone');
      expectNoContactFields(response.body);
      expectNoContacts(response.body);
    });

    it('un tercero tampoco obtiene correo ni teléfono al consultar un perfil público', async () => {
      const response = await request(app)
        .get(`/api/v1/users/${counterpartUserId}`)
        .set('Authorization', `Bearer ${outsiderToken}`);

      expect(response.status, JSON.stringify(response.body)).toBe(200);
      expectNoContactFields(response.body);
      expectNoContacts(response.body);
    });
  });
});
