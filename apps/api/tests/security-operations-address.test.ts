import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';
import { prisma } from '../src/database/prisma';
import { usersRepository } from '../src/modules/users/users.repository';
import { catalogRepository } from '../src/modules/catalog/catalog.repository';

/**
 * Verificación previa al Grupo 3: privacidad de la dirección de recogida en
 * operaciones aceptadas (Fase 11).
 *
 * Las dos partes de la operación deben ver la dirección exacta acordada para
 * poder ejecutar la logística. Un tercero ajeno no debe verla ni por detalle ni
 * por listado. El flujo completo de la Fase 11 debe seguir funcionando.
 */
describe('Privacidad de la dirección de recogida en operaciones (Fase 11)', () => {
  const createdUserIds: string[] = [];

  let sellerToken: string;
  let sellerUserId: string;
  let sellerEmail: string;
  let sellerPhone: string;

  let buyerToken: string;
  let buyerUserId: string;
  let buyerEmail: string;
  let buyerPhone: string;

  let outsiderToken: string;
  let outsiderUserId: string;
  let outsiderEmail: string;
  let outsiderPhone: string;

  let categoryId: string;
  let unitId: string;
  let publicationId: string;
  let conversationId: string;
  let proposalId: string;
  let operationId: string;

  const exactPickupAddress = 'Calle Secreta 456 # 78-90, Puerta 3, Bodega 12';
  const exactDeliveryAddress = 'Avenida Industrial 100 # 20-30, Planta 4';

  async function registerUser(
    label: string,
    userType: 'GENERATOR' | 'RECYCLER' | 'TRANSPORTER'
  ): Promise<{ token: string; id: string; email: string; phone: string }> {
    const email = `${label}.ops.${Date.now()}.${Math.random().toString(36).slice(2, 8)}@circular.test`;
    const phone = `+57 31${Math.floor(10000000 + Math.random() * 89999999)}`;
    const response = await request(app)
      .post('/api/v1/auth/register')
      .send({
        fullName: `Usuario ${label} operaciones`,
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

  beforeAll(async () => {
    await prisma.$queryRaw`SELECT 1`;
    await catalogRepository.ensureSeeded();

    const seller = await registerUser('vendedor', 'GENERATOR');
    sellerToken = seller.token;
    sellerUserId = seller.id;
    sellerEmail = seller.email;
    sellerPhone = seller.phone;

    const buyer = await registerUser('comprador', 'RECYCLER');
    buyerToken = buyer.token;
    buyerUserId = buyer.id;
    buyerEmail = buyer.email;
    buyerPhone = buyer.phone;

    const outsider = await registerUser('tercero', 'RECYCLER');
    outsiderToken = outsider.token;
    outsiderUserId = outsider.id;
    outsiderEmail = outsider.email;
    outsiderPhone = outsider.phone;

    const tree = await catalogRepository.listCategoriesTree();
    categoryId = tree.find((category) => category.name === 'Plásticos')!.subcategories![0].id;
    const units = await catalogRepository.listUnits();
    unitId = units.find((unit) => unit.abbreviation === 'kg')!.id;

    const publication = await request(app)
      .post('/api/v1/publications')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({
        type: 'OFFER',
        categoryId,
        quantity: 300,
        unitId,
        locationAddress: 'Calle Pública 1 # 2-3',
        locationCity: 'Bogotá D.C.',
        locationArea: 'Fontibón',
      });
    expect(publication.status, JSON.stringify(publication.body)).toBe(201);
    publicationId = publication.body.data.id;

    const conversation = await request(app)
      .post('/api/v1/conversations')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({
        publicationId,
        initialMessage: 'Acordemos la recolección del lote.',
      });
    expect(conversation.status, JSON.stringify(conversation.body)).toBe(201);
    conversationId = conversation.body.data.id;

    const proposal = await request(app)
      .post(`/api/v1/conversations/${conversationId}/proposals`)
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({
        quantity: 280,
        unitId,
        terms: 'Retiro en la dirección acordada. Pago contra recepción.',
      });
    expect(proposal.status, JSON.stringify(proposal.body)).toBe(201);
    proposalId = proposal.body.data.id;

    const accepted = await request(app)
      .post(`/api/v1/proposals/${proposalId}/accept`)
      .set('Authorization', `Bearer ${sellerToken}`);
    expect(accepted.status, JSON.stringify(accepted.body)).toBe(200);

    const operation = await request(app)
      .post('/api/v1/operations')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({ proposalId });
    expect([200, 201], JSON.stringify(operation.body)).toContain(operation.status);
    operationId = operation.body.data.id;

    const scheduled = await request(app)
      .post(`/api/v1/operations/${operationId}/schedule`)
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({
        scheduledDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
        scheduledTimeSlot: '08:00 - 10:00 AM',
        pickupAddress: exactPickupAddress,
        pickupArea: 'Fontibón',
        deliveryAddress: exactDeliveryAddress,
        deliveryArea: 'Engativá',
      });
    expect(scheduled.status, JSON.stringify(scheduled.body)).toBe(200);
    expect(scheduled.body.data.pickupAddress).toBe(exactPickupAddress);
  });

  afterAll(async () => {
    // Limpieza en orden de dependencias (Restrict en Operation -> Proposal/Publication).
    await prisma.operationEvidence.deleteMany({ where: { operationId } }).catch(() => {});
    await prisma.operationReview.deleteMany({ where: { operationId } }).catch(() => {});
    await prisma.operation.deleteMany({ where: { id: operationId } }).catch(() => {});
    await prisma.proposal.deleteMany({ where: { conversationId } }).catch(() => {});
    await prisma.message.deleteMany({ where: { conversationId } }).catch(() => {});
    await prisma.conversationParticipantState
      .deleteMany({ where: { conversationId } })
      .catch(() => {});
    await prisma.conversation.deleteMany({ where: { id: conversationId } }).catch(() => {});
    await prisma.materialPublication.deleteMany({ where: { id: publicationId } }).catch(() => {});

    for (const userId of createdUserIds) {
      await usersRepository.deletePermanently(userId).catch(() => {});
    }
  });

  function expectNoAddress(payload: unknown) {
    const serialized = JSON.stringify(payload);
    expect(serialized).not.toContain(exactPickupAddress);
    expect(serialized).not.toContain('Calle Secreta');
    expect(serialized).not.toContain(exactDeliveryAddress);
    expect(serialized).not.toContain('Avenida Industrial');
  }

  it('el vendedor ve la dirección exacta de recogida en el detalle', async () => {
    const response = await request(app)
      .get(`/api/v1/operations/${operationId}`)
      .set('Authorization', `Bearer ${sellerToken}`);

    expect(response.status, JSON.stringify(response.body)).toBe(200);
    expect(response.body.data.pickupAddress).toBe(exactPickupAddress);
    expect(response.body.data.deliveryAddress).toBe(exactDeliveryAddress);
    expect(response.body.data.sellerUserId).toBe(sellerUserId);
    expect(response.body.data.buyerUserId).toBe(buyerUserId);
  });

  it('el comprador ve la misma dirección exacta de recogida en el detalle', async () => {
    const response = await request(app)
      .get(`/api/v1/operations/${operationId}`)
      .set('Authorization', `Bearer ${buyerToken}`);

    expect(response.status, JSON.stringify(response.body)).toBe(200);
    expect(response.body.data.pickupAddress).toBe(exactPickupAddress);
    expect(response.body.data.deliveryAddress).toBe(exactDeliveryAddress);
    expect(response.body.data.sellerUserId).toBe(sellerUserId);
    expect(response.body.data.buyerUserId).toBe(buyerUserId);
  });

  it('un tercero ajeno recibe 403 y no obtiene la dirección', async () => {
    const response = await request(app)
      .get(`/api/v1/operations/${operationId}`)
      .set('Authorization', `Bearer ${outsiderToken}`);

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('FORBIDDEN');
    expectNoAddress(response.body);
  });

  it('el listado de un tercero no incluye la operación ni la dirección', async () => {
    const response = await request(app)
      .get('/api/v1/operations')
      .set('Authorization', `Bearer ${outsiderToken}`);

    expect(response.status, JSON.stringify(response.body)).toBe(200);
    const operations = response.body.data.data as Array<{
      id: string;
      sellerUserId: string;
      buyerUserId: string;
      transporterUserId: string | null;
    }>;

    expect(operations.some((operation) => operation.id === operationId)).toBe(false);
    for (const operation of operations) {
      const isParty = [operation.sellerUserId, operation.buyerUserId, operation.transporterUserId]
        .filter(Boolean)
        .includes(outsiderUserId);
      expect(isParty).toBe(true);
    }
    expectNoAddress(response.body);
  });

  it('el flujo de la Fase 11 sigue intacto y conserva la dirección al cierre', async () => {
    const collect = await request(app)
      .post(`/api/v1/operations/${operationId}/collect`)
      .set('Authorization', `Bearer ${buyerToken}`);
    expect(collect.status, JSON.stringify(collect.body)).toBe(200);
    expect(collect.body.data.status).toBe('COLLECTING');

    const evidence = await request(app)
      .post(`/api/v1/operations/${operationId}/evidences`)
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({
        type: 'WEIGHING_TICKET',
        fileUrl: 'https://storage.imara.org.co/evidences/tique-direccion.pdf',
        description: 'Pesaje certificado con la dirección acordada.',
        weightKg: 278,
      });
    expect(evidence.status, JSON.stringify(evidence.body)).toBe(201);
    expect(evidence.body.data.operation.status).toBe('EVIDENCE');

    const receive = await request(app)
      .post(`/api/v1/operations/${operationId}/receive`)
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({ receivedNotes: 'Lote recibido conforme.' });
    expect(receive.status, JSON.stringify(receive.body)).toBe(200);
    expect(receive.body.data.status).toBe('RECEIVED');

    const close = await request(app)
      .post(`/api/v1/operations/${operationId}/close`)
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({ closingNotes: 'Operación cerrada y liquidada.' });
    expect(close.status, JSON.stringify(close.body)).toBe(200);
    expect(close.body.data.status).toBe('CLOSED');
    expect(close.body.data.pickupAddress).toBe(exactPickupAddress);

    const sellerDetail = await request(app)
      .get(`/api/v1/operations/${operationId}`)
      .set('Authorization', `Bearer ${sellerToken}`);
    expect(sellerDetail.status).toBe(200);
    expect(sellerDetail.body.data.status).toBe('CLOSED');
    expect(sellerDetail.body.data.pickupAddress).toBe(exactPickupAddress);
    expect(sellerDetail.body.data.timeline.every((step: { isDone: boolean }) => step.isDone)).toBe(
      true
    );
  });

  it('las pruebas no exponen contactos de las partes en el detalle de la operación', async () => {
    // El detalle de una operación incluye teléfonos de las contrapartes (uso logístico),
    // pero nunca correos electrónicos ni datos de un tercero ajeno.
    const response = await request(app)
      .get(`/api/v1/operations/${operationId}`)
      .set('Authorization', `Bearer ${sellerToken}`);

    expect(response.status).toBe(200);
    const serialized = JSON.stringify(response.body);
    expect(serialized).not.toContain(sellerEmail);
    expect(serialized).not.toContain(buyerEmail);
    expect(serialized).not.toContain(outsiderEmail);
    expect(serialized).not.toContain(outsiderPhone);
    expect(serialized).toContain(sellerPhone);
    expect(serialized).toContain(buyerPhone);
  });
});
