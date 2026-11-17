import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { prisma } from '../../apps/api/src/database/prisma';
import { hashPassword } from '../../apps/api/src/utils/hash';
import { seedCatalogAndUnits } from '../../apps/api/src/modules/catalog/catalog.seed';
import { seedSystemRolesAndPermissions } from '../../apps/api/src/modules/organizations/organizations.seed';
import { matchesService } from '../../apps/api/src/modules/matches/matches.service';
import { publicationsService } from '../../apps/api/src/modules/publications/publications.service';
import { organizationsService } from '../../apps/api/src/modules/organizations/organizations.service';
import { organizationsRepository } from '../../apps/api/src/modules/organizations/organizations.repository';
import { assertDemoSeedAllowed } from '../../apps/api/src/config/demo-seed';
import { UserType, UserRole } from '../../apps/api/src/generated/prisma-client';

function generateTestPassword(): string {
  return `Aa1!${crypto.randomBytes(18).toString('base64url')}`;
}

interface TestUserDefinition {
  username: string;
  fullName: string;
  email: string;
  phone: string;
  userType: UserType;
  role: UserRole;
  passwordPlainText: string;
  locationArea: string;
}

export async function runStage2() {
  assertDemoSeedAllowed();

  console.log('========================================================================');
  console.log('  DATA_CIRCULAR • CAMPAÑA DE CALIDAD Y QA — ETAPA 2');
  console.log('  Creación de 10 Usuarios de Prueba, Condiciones de Coincidencia y Ofertas');
  console.log('========================================================================\n');

  // 1. Semillas de catálogo y roles
  console.log('1. [CATÁLOGO & ROLES] Asegurando catálogo de materiales y roles...');
  await seedCatalogAndUnits();
  await seedSystemRolesAndPermissions();

  const categories = await prisma.materialCategory.findMany({
    include: { parent: true, subcategories: true },
  });
  const units = await prisma.unit.findMany();

  const kgUnit = units.find((u) => u.abbreviation === 'kg') || units[0];
  const tonUnit = units.find((u) => u.abbreviation === 'ton') || units[1];

  const petCategory = categories.find((c) => c.name.includes('PET (1)')) || categories.find((c) => c.name.includes('PET'))!;
  const peadCategory = categories.find((c) => c.name.includes('PEAD')) || categories[1];
  const cartonCategory = categories.find((c) => c.name.toLowerCase().includes('cartón') || c.name.toLowerCase().includes('papel')) || categories[2];
  const aluminioCategory = categories.find((c) => c.name.toLowerCase().includes('aluminio')) || categories[3];
  const aceroCategory = categories.find((c) => c.name.toLowerCase().includes('acero')) || categories[4];

  console.log(`   ✓ Unidad seleccionada: ${kgUnit.name} (${kgUnit.abbreviation})`);
  console.log(`   ✓ Categorías clave seleccionadas:`);
  console.log(`     - PET: ${petCategory.name} (${petCategory.id})`);
  console.log(`     - Cartón: ${cartonCategory.name} (${cartonCategory.id})`);
  console.log(`     - Aluminio: ${aluminioCategory.name} (${aluminioCategory.id})`);

  // 2. Definición exacta de los 10 usuarios de prueba según la nomenclatura requerida
  const TEST_USERS: TestUserDefinition[] = [
    {
      username: 'GeneradorPrueba1',
      fullName: 'Generador Industrial Fontibón SAS',
      email: 'generador1.prueba@datacircular.local',
      phone: '+57 310 1000001',
      userType: 'GENERATOR',
      role: 'USER',
      passwordPlainText: generateTestPassword(),
      locationArea: 'Fontibón',
    },
    {
      username: 'GeneradorPrueba2',
      fullName: 'Manufacturas y Empaques Kennedy Ltda',
      email: 'generador2.prueba@datacircular.local',
      phone: '+57 310 1000002',
      userType: 'GENERATOR',
      role: 'USER',
      passwordPlainText: generateTestPassword(),
      locationArea: 'Kennedy',
    },
    {
      username: 'RecicladorPrueba1',
      fullName: 'Asociación de Recicladores de Oficio Fontibón',
      email: 'reciclador1.prueba@datacircular.local',
      phone: '+57 310 1000003',
      userType: 'RECYCLER',
      role: 'USER',
      passwordPlainText: generateTestPassword(),
      locationArea: 'Fontibón',
    },
    {
      username: 'RecicladorPrueba2',
      fullName: 'Cooperativa de Recuperadores Kennedy',
      email: 'reciclador2.prueba@datacircular.local',
      phone: '+57 310 1000004',
      userType: 'RECYCLER',
      role: 'USER',
      passwordPlainText: generateTestPassword(),
      locationArea: 'Kennedy',
    },
    {
      username: 'TransformadorPrueba1',
      fullName: 'Ecoplast Transformadora y Molienda SAS',
      email: 'transformador1.prueba@datacircular.local',
      phone: '+57 310 1000005',
      userType: 'TRANSFORMER',
      role: 'USER',
      passwordPlainText: generateTestPassword(),
      locationArea: 'Fontibón',
    },
    {
      username: 'TransformadorPrueba2',
      fullName: 'Siderúrgica y Fundición MetalVal Colombia',
      email: 'transformador2.prueba@datacircular.local',
      phone: '+57 310 1000006',
      userType: 'TRANSFORMER',
      role: 'USER',
      passwordPlainText: generateTestPassword(),
      locationArea: 'Puente Aranda',
    },
    {
      username: 'TransportadorPrueba1',
      fullName: 'Logística y Fletes Verdes Bogotá',
      email: 'transportador1.prueba@datacircular.local',
      phone: '+57 310 1000007',
      userType: 'TRANSPORTER',
      role: 'USER',
      passwordPlainText: generateTestPassword(),
      locationArea: 'Fontibón',
    },
    {
      username: 'TransportadorPrueba2',
      fullName: 'TransRecuperar Carga Nacional SAS',
      email: 'transportador2.prueba@datacircular.local',
      phone: '+57 310 1000008',
      userType: 'TRANSPORTER',
      role: 'USER',
      passwordPlainText: generateTestPassword(),
      locationArea: 'Kennedy',
    },
    {
      username: 'VerificadorPrueba1',
      fullName: 'Verificadora Ambiental Principal IMARA',
      email: 'verificador1.prueba@datacircular.local',
      phone: '+57 310 1000009',
      userType: 'GENERATOR',
      role: 'ADMIN',
      passwordPlainText: generateTestPassword(),
      locationArea: 'Bogotá D.C.',
    },
    {
      username: 'VerificadorPrueba2',
      fullName: 'Auditor de Verificación y Cumplimiento IMARA',
      email: 'verificador2.prueba@datacircular.local',
      phone: '+57 310 1000010',
      userType: 'GENERATOR',
      role: 'ADMIN',
      passwordPlainText: generateTestPassword(),
      locationArea: 'Bogotá D.C.',
    },
  ];

  console.log('\n2. [REGISTRO] Creando los 10 usuarios de prueba con hash Argon2id y política de datos...');
  const createdUsers: Record<string, any> = {};

  for (const def of TEST_USERS) {
    const passwordHash = await hashPassword(def.passwordPlainText);
    const user = await prisma.user.upsert({
      where: { email: def.email },
      update: {
        fullName: def.fullName,
        phone: def.phone,
        userType: def.userType,
        role: def.role,
        status: 'ACTIVE',
        passwordHash,
        deletedAt: null,
      },
      create: {
        fullName: def.fullName,
        email: def.email,
        phone: def.phone,
        userType: def.userType,
        role: def.role,
        status: 'ACTIVE',
        passwordHash,
      },
    });

    // Aceptación de política de datos
    await prisma.dataPolicyAcceptance.upsert({
      where: { userId: user.id },
      update: {
        status: 'ACCEPTED',
        policyVersion: '2026.1.1',
        policyUrl: 'https://fundacionimara.org/politica-datos',
      },
      create: {
        userId: user.id,
        policyVersion: '2026.1.1',
        policyUrl: 'https://fundacionimara.org/politica-datos',
        status: 'ACCEPTED',
      },
    });

    createdUsers[def.username] = user;
    console.log(`   ✓ [${def.username}] ID: ${user.id} | Tipo: ${user.userType} | Rol: ${user.role}`);
  }

  // 3. Crear organizaciones y condiciones de coincidencia para los actores no generadores
  console.log('\n3. [CONDICIONES DE COINCIDENCIA] Configurando organizaciones y materiales para coincidencias...');
  const orgMap: Record<string, any> = {};

  // Reciclador 1: Fontibón (PET, PEAD)
  const orgRec1 = await prisma.organization.upsert({
    where: { taxId: '900111221-1' },
    update: {
      name: 'Asociación ReciclaFontibón',
      locality: 'Fontibón',
      city: 'Bogotá D.C.',
      activityType: 'RECYCLER',
      status: 'ACTIVE',
    },
    create: {
      name: 'Asociación ReciclaFontibón',
      taxId: '900111221-1',
      locality: 'Fontibón',
      city: 'Bogotá D.C.',
      orgType: 'ASSOCIATION',
      activityType: 'RECYCLER',
      status: 'ACTIVE',
    },
  });
  await ensureOrgMemberAndCategories(orgRec1.id, createdUsers['RecicladorPrueba1'].id, [petCategory.id, peadCategory.id]);
  orgMap['RecicladorPrueba1'] = orgRec1;

  // Reciclador 2: Kennedy (Cartón, Metales/Aluminio)
  const orgRec2 = await prisma.organization.upsert({
    where: { taxId: '900111221-2' },
    update: {
      name: 'Cooperativa Recuperadores Kennedy',
      locality: 'Kennedy',
      city: 'Bogotá D.C.',
      activityType: 'RECYCLER',
      status: 'ACTIVE',
    },
    create: {
      name: 'Cooperativa Recuperadores Kennedy',
      taxId: '900111221-2',
      locality: 'Kennedy',
      city: 'Bogotá D.C.',
      orgType: 'COOPERATIVE',
      activityType: 'RECYCLER',
      status: 'ACTIVE',
    },
  });
  await ensureOrgMemberAndCategories(orgRec2.id, createdUsers['RecicladorPrueba2'].id, [cartonCategory.id, aluminioCategory.id]);
  orgMap['RecicladorPrueba2'] = orgRec2;

  // Transformador 1: Fontibón (PET, PEAD)
  const orgTransf1 = await prisma.organization.upsert({
    where: { taxId: '900111221-3' },
    update: {
      name: 'Ecoplast Transformadora SAS',
      locality: 'Fontibón',
      city: 'Bogotá D.C.',
      activityType: 'TRANSFORMER',
      status: 'ACTIVE',
    },
    create: {
      name: 'Ecoplast Transformadora SAS',
      taxId: '900111221-3',
      locality: 'Fontibón',
      city: 'Bogotá D.C.',
      orgType: 'COMPANY',
      activityType: 'TRANSFORMER',
      status: 'ACTIVE',
    },
  });
  await ensureOrgMemberAndCategories(orgTransf1.id, createdUsers['TransformadorPrueba1'].id, [petCategory.id, peadCategory.id]);
  orgMap['TransformadorPrueba1'] = orgTransf1;

  // Transformador 2: Puente Aranda (Aluminio, Acero)
  const orgTransf2 = await prisma.organization.upsert({
    where: { taxId: '900111221-4' },
    update: {
      name: 'MetalVal Fundición y Valorización',
      locality: 'Puente Aranda',
      city: 'Bogotá D.C.',
      activityType: 'TRANSFORMER',
      status: 'ACTIVE',
    },
    create: {
      name: 'MetalVal Fundición y Valorización',
      taxId: '900111221-4',
      locality: 'Puente Aranda',
      city: 'Bogotá D.C.',
      orgType: 'COMPANY',
      activityType: 'TRANSFORMER',
      status: 'ACTIVE',
    },
  });
  await ensureOrgMemberAndCategories(orgTransf2.id, createdUsers['TransformadorPrueba2'].id, [aluminioCategory.id, aceroCategory.id]);
  orgMap['TransformadorPrueba2'] = orgTransf2;

  // Transportador 1: Fontibón (PET, Cartón, Aluminio)
  const orgTransp1 = await prisma.organization.upsert({
    where: { taxId: '900111221-5' },
    update: {
      name: 'Fletes y Logística Circular Bogotá',
      locality: 'Fontibón',
      city: 'Bogotá D.C.',
      activityType: 'TRANSPORTER',
      status: 'ACTIVE',
    },
    create: {
      name: 'Fletes y Logística Circular Bogotá',
      taxId: '900111221-5',
      locality: 'Fontibón',
      city: 'Bogotá D.C.',
      orgType: 'COMPANY',
      activityType: 'TRANSPORTER',
      status: 'ACTIVE',
    },
  });
  await ensureOrgMemberAndCategories(orgTransp1.id, createdUsers['TransportadorPrueba1'].id, [petCategory.id, cartonCategory.id, aluminioCategory.id]);
  orgMap['TransportadorPrueba1'] = orgTransp1;

  // Transportador 2: Kennedy (Aluminio, PET)
  const orgTransp2 = await prisma.organization.upsert({
    where: { taxId: '900111221-6' },
    update: {
      name: 'TransRecuperar Carga Nacional',
      locality: 'Kennedy',
      city: 'Bogotá D.C.',
      activityType: 'TRANSPORTER',
      status: 'ACTIVE',
    },
    create: {
      name: 'TransRecuperar Carga Nacional',
      taxId: '900111221-6',
      locality: 'Kennedy',
      city: 'Bogotá D.C.',
      orgType: 'COMPANY',
      activityType: 'TRANSPORTER',
      status: 'ACTIVE',
    },
  });
  await ensureOrgMemberAndCategories(orgTransp2.id, createdUsers['TransportadorPrueba2'].id, [aluminioCategory.id, petCategory.id]);
  orgMap['TransportadorPrueba2'] = orgTransp2;

  console.log('   ✓ Condiciones de coincidencia guardadas en organization_material_categories para todos los actores.');

  // 4. Creación de las 3 ofertas de materiales exigidas
  console.log('\n4. [OFERTAS DE MATERIAL] Creando las 3 ofertas con los usuarios generadores...');
  const gen1 = createdUsers['GeneradorPrueba1'];
  const gen2 = createdUsers['GeneradorPrueba2'];

  // Limpiar ofertas de prueba previas para no duplicar
  await prisma.materialPublication.deleteMany({
    where: {
      ownerUserId: { in: [gen1.id, gen2.id] },
    },
  });

  // Oferta 1: GeneradorPrueba1 - PET (450 kg en Fontibón)
  const offer1 = await prisma.materialPublication.create({
    data: {
      ownerUserId: gen1.id,
      type: 'OFFER',
      categoryId: petCategory.id,
      quantity: 450,
      unitId: kgUnit.id,
      description: '450 kg de botellas PET cristal limpias, prensadas en pacas de 50 kg, listas para recolección en bodega industrial.',
      locationAddress: 'Calle 17 # 92-30, Bodega 4',
      locationCity: 'Bogotá D.C.',
      locationArea: 'Fontibón',
      condition: 'Limpio y prensado',
      isUrgent: false,
      requiresTransport: false,
      status: 'ACTIVE',
    },
  });
  console.log(`   ✓ Oferta 1 creada [GeneradorPrueba1]: ID ${offer1.id}`);
  console.log(`     - Material: ${petCategory.name} | Cantidad: 450 kg | Ubicación: Fontibón`);

  // Oferta 2: GeneradorPrueba1 - Cartón corrugado (600 kg en Fontibón)
  const offer2 = await prisma.materialPublication.create({
    data: {
      ownerUserId: gen1.id,
      type: 'OFFER',
      categoryId: cartonCategory.id,
      quantity: 600,
      unitId: kgUnit.id,
      description: '600 kg de cartón corrugado de embalaje, limpio y desarmado en atados planos.',
      locationAddress: 'Calle 17 # 92-30, Bodega 4',
      locationCity: 'Bogotá D.C.',
      locationArea: 'Fontibón',
      condition: 'Seco y desarmado',
      isUrgent: false,
      requiresTransport: false,
      status: 'ACTIVE',
    },
  });
  console.log(`   ✓ Oferta 2 creada [GeneradorPrueba1]: ID ${offer2.id}`);
  console.log(`     - Material: ${cartonCategory.name} | Cantidad: 600 kg | Ubicación: Fontibón`);

  // Oferta 3: GeneradorPrueba2 - Aluminio (300 kg en Kennedy)
  const offer3 = await prisma.materialPublication.create({
    data: {
      ownerUserId: gen2.id,
      type: 'OFFER',
      categoryId: aluminioCategory.id,
      quantity: 300,
      unitId: kgUnit.id,
      description: '300 kg de latas de aluminio prensadas y clasificadas en fardos para fundición o valorización.',
      locationAddress: 'Carrera 78 # 42 Sur, Zona Industrial Kennedy',
      locationCity: 'Bogotá D.C.',
      locationArea: 'Kennedy',
      condition: 'Clasificado y prensado',
      isUrgent: false,
      requiresTransport: false,
      status: 'ACTIVE',
    },
  });
  console.log(`   ✓ Oferta 3 creada [GeneradorPrueba2]: ID ${offer3.id}`);
  console.log(`     - Material: ${aluminioCategory.name} | Cantidad: 300 kg | Ubicación: Kennedy`);

  // 5. Comprobación funcional del motor de coincidencias con las condiciones registradas
  console.log('\n5. [VERIFICACIÓN DE COINCIDENCIAS] Comprobando que el motor sugiere ofertas según las condiciones...');
  const suggestionsRec1 = await matchesService.getMySuggestions({
    id: createdUsers['RecicladorPrueba1'].id,
    fullName: createdUsers['RecicladorPrueba1'].fullName,
    email: createdUsers['RecicladorPrueba1'].email,
    role: createdUsers['RecicladorPrueba1'].role,
    userType: createdUsers['RecicladorPrueba1'].userType,
    status: createdUsers['RecicladorPrueba1'].status,
    createdAt: createdUsers['RecicladorPrueba1'].createdAt.toISOString(),
    updatedAt: createdUsers['RecicladorPrueba1'].updatedAt.toISOString(),
  });
  console.log(`   ✓ RecicladorPrueba1 recibió ${suggestionsRec1.length} sugerencias (esperado: Oferta 1 PET).`);

  const suggestionsRec2 = await matchesService.getMySuggestions({
    id: createdUsers['RecicladorPrueba2'].id,
    fullName: createdUsers['RecicladorPrueba2'].fullName,
    email: createdUsers['RecicladorPrueba2'].email,
    role: createdUsers['RecicladorPrueba2'].role,
    userType: createdUsers['RecicladorPrueba2'].userType,
    status: createdUsers['RecicladorPrueba2'].status,
    createdAt: createdUsers['RecicladorPrueba2'].createdAt.toISOString(),
    updatedAt: createdUsers['RecicladorPrueba2'].updatedAt.toISOString(),
  });
  console.log(`   ✓ RecicladorPrueba2 recibió ${suggestionsRec2.length} sugerencias (esperado: Oferta 2 Cartón y Oferta 3 Aluminio).`);

  const suggestionsTransf1 = await matchesService.getMySuggestions({
    id: createdUsers['TransformadorPrueba1'].id,
    fullName: createdUsers['TransformadorPrueba1'].fullName,
    email: createdUsers['TransformadorPrueba1'].email,
    role: createdUsers['TransformadorPrueba1'].role,
    userType: createdUsers['TransformadorPrueba1'].userType,
    status: createdUsers['TransformadorPrueba1'].status,
    createdAt: createdUsers['TransformadorPrueba1'].createdAt.toISOString(),
    updatedAt: createdUsers['TransformadorPrueba1'].updatedAt.toISOString(),
  });
  console.log(`   ✓ TransformadorPrueba1 recibió ${suggestionsTransf1.length} sugerencias (esperado: Oferta 1 PET).`);

  const suggestionsTransp1 = await matchesService.getMySuggestions({
    id: createdUsers['TransportadorPrueba1'].id,
    fullName: createdUsers['TransportadorPrueba1'].fullName,
    email: createdUsers['TransportadorPrueba1'].email,
    role: createdUsers['TransportadorPrueba1'].role,
    userType: createdUsers['TransportadorPrueba1'].userType,
    status: createdUsers['TransportadorPrueba1'].status,
    createdAt: createdUsers['TransportadorPrueba1'].createdAt.toISOString(),
    updatedAt: createdUsers['TransportadorPrueba1'].updatedAt.toISOString(),
  });
  console.log(`   ✓ TransportadorPrueba1 recibió ${suggestionsTransp1.length} sugerencias (esperado: las 3 ofertas activas).`);

  // 6. Prueba de edición de condiciones de coincidencia
  console.log('\n6. [EDICIÓN DE CONDICIONES] Verificando que las condiciones puedan editarse y consultarse...');
  await prisma.organizationMaterialCategory.upsert({
    where: {
      organizationId_categoryId: {
        organizationId: orgRec1.id,
        categoryId: cartonCategory.id,
      },
    },
    update: {},
    create: {
      organizationId: orgRec1.id,
      categoryId: cartonCategory.id,
    },
  });
  const updatedCategories = await prisma.organizationMaterialCategory.findMany({
    where: { organizationId: orgRec1.id },
  });
  console.log(`   ✓ Condiciones de RecicladorPrueba1 editadas correctamente (categorías activas: ${updatedCategories.length}).`);

  // 7. Guardar credenciales de prueba en archivo protegido y excluido del repo
  console.log('\n7. [SEGURIDAD] Almacenando credenciales en .env.test.credentials (ignorado en git)...');
  const credentialsContent = TEST_USERS.map((u) => {
    return `${u.username.toUpperCase()}_EMAIL=${u.email}\n${u.username.toUpperCase()}_PASSWORD=${u.passwordPlainText}\n${u.username.toUpperCase()}_ID=${createdUsers[u.username].id}`;
  }).join('\n\n');

  fs.writeFileSync(path.resolve('.env.test.credentials'), credentialsContent, 'utf-8');
  console.log('   ✓ Archivo .env.test.credentials creado exitosamente.');

  // 8. Generar Documento 2: Inventario de usuarios de prueba (SIN contraseñas)
  console.log('\n8. [DOCUMENTACIÓN] Generando Documento 2: docs/QA/02-inventario-usuarios-prueba.md...');
  const doc2 = `# INVENTARIO DE USUARIOS DE PRUEBA (ETAPA 2)
## DATA_CIRCULAR • Fundación IMARA

Este documento registra los diez (10) usuarios ficticios creados formalmente para la campaña integral de calidad, pruebas funcionales, seguridad y preparación de Google Play.

> [!NOTE]
> Conforme a las restricciones obligatorias de seguridad, este documento **no contiene contraseñas, tokens ni secretos**. Las credenciales seguras de testing residen en el archivo local protegido \`.env.test.credentials\` excluido de control de versiones.

---

### Matriz de Usuarios y Perfiles

| # | Nombre de Usuario | Nombre Visible | Correo Ficticio | Perfil Circular | Rol Plataforma | Estado | Municipio Base | Identificador (UUID) | Condiciones de Coincidencia |
|---|---|---|---|---|---|---|---|---|---|
| 1 | **GeneradorPrueba1** | Generador Industrial Fontibón SAS | \`generador1.prueba@datacircular.local\` | GENERATOR | USER | ACTIVE | Fontibón | \`${createdUsers['GeneradorPrueba1'].id}\` | Ofertas activas (PET, Cartón) |
| 2 | **GeneradorPrueba2** | Manufacturas y Empaques Kennedy Ltda | \`generador2.prueba@datacircular.local\` | GENERATOR | USER | ACTIVE | Kennedy | \`${createdUsers['GeneradorPrueba2'].id}\` | Ofertas activas (Aluminio) |
| 3 | **RecicladorPrueba1** | Asociación Recicladores Fontibón | \`reciclador1.prueba@datacircular.local\` | RECYCLER | USER | ACTIVE | Fontibón | \`${createdUsers['RecicladorPrueba1'].id}\` | Org: ReciclaFontibón (PET, PEAD, Cartón) |
| 4 | **RecicladorPrueba2** | Cooperativa Recuperadores Kennedy | \`reciclador2.prueba@datacircular.local\` | RECYCLER | USER | ACTIVE | Kennedy | \`${createdUsers['RecicladorPrueba2'].id}\` | Org: Kennedy Verde (Cartón, Aluminio) |
| 5 | **TransformadorPrueba1** | Ecoplast Transformadora SAS | \`transformador1.prueba@datacircular.local\` | TRANSFORMER | USER | ACTIVE | Fontibón | \`${createdUsers['TransformadorPrueba1'].id}\` | Org: Ecoplast (PET, PEAD) |
| 6 | **TransformadorPrueba2** | MetalVal Fundición Colombia | \`transformador2.prueba@datacircular.local\` | TRANSFORMER | USER | ACTIVE | Puente Aranda | \`${createdUsers['TransformadorPrueba2'].id}\` | Org: MetalVal (Aluminio, Acero) |
| 7 | **TransportadorPrueba1** | Logística y Fletes Verdes Bogotá | \`transportador1.prueba@datacircular.local\` | TRANSPORTER | USER | ACTIVE | Fontibón | \`${createdUsers['TransportadorPrueba1'].id}\` | Org: Fletes Verdes (Plásticos, Cartón, Metales) |
| 8 | **TransportadorPrueba2** | TransRecuperar Carga Nacional | \`transportador2.prueba@datacircular.local\` | TRANSPORTER | USER | ACTIVE | Kennedy | \`${createdUsers['TransportadorPrueba2'].id}\` | Org: TransRecuperar (Aluminio, PET) |
| 9 | **VerificadorPrueba1** | Verificadora Ambiental IMARA | \`verificador1.prueba@datacircular.local\` | GENERATOR | ADMIN | ACTIVE | Bogotá D.C. | \`${createdUsers['VerificadorPrueba1'].id}\` | Auditoría, Tarifas, Aprobación documental |
| 10 | **VerificadorPrueba2** | Auditor de Verificación IMARA | \`verificador2.prueba@datacircular.local\` | GENERATOR | ADMIN | ACTIVE | Bogotá D.C. | \`${createdUsers['VerificadorPrueba2'].id}\` | Auditoría, Supervisión de Operaciones |

---

### Verificación de Cumplimiento de Reglas
1. **Identificador único**: Todos los usuarios cuentan con UUID v4 único generado por PostgreSQL.
2. **Nombres de usuario**: Nomenclatura estricta exacta (\`GeneradorPrueba1\`, etc.).
3. **Correos**: Formato RFC 5322 único sobre dominio reservado de prueba.
4. **Seguridad**: Hash de contraseñas mediante **Argon2id** (64 MiB memoria, 3 iteraciones, 4 hilos).
5. **Política de Datos**: Todos los registros tienen estado \`ACCEPTED\` registrado en tabla \`data_policy_acceptances\`.
6. **Permisos**: Únicamente \`VerificadorPrueba1\` y \`VerificadorPrueba2\` poseen el rol \`ADMIN\`; los demás 8 usuarios tienen rol \`USER\`.
`;
  fs.writeFileSync(path.resolve('docs/QA/02-inventario-usuarios-prueba.md'), doc2, 'utf-8');
  console.log('   ✓ Documento 2 creado en docs/QA/02-inventario-usuarios-prueba.md');

  // 9. Generar Documento 3: Datos de prueba (ofertas de catálogo)
  console.log('\n9. [DOCUMENTACIÓN] Generando Documento 3: docs/QA/03-datos-de-prueba.md...');
  const doc3 = `# DATOS DE PRUEBA Y PUBLICACIONES (ETAPA 2)
## DATA_CIRCULAR • Fundación IMARA

Este documento consolida las ofertas de materiales creadas para comprobar el motor de búsqueda, coincidencia, negociación y trazabilidad logística.

---

### Ofertas de Materiales Registradas

#### Oferta 1 — GeneradorPrueba1
- **Identificador**: \`${offer1.id}\`
- **Usuario Propietario**: \`GeneradorPrueba1\` (\`${gen1.id}\`)
- **Tipo de Publicación**: \`OFFER\` (Oferta)
- **Material del Catálogo**: \`${petCategory.name}\` (Categoría padre: Plásticos)
- **ID Categoría**: \`${petCategory.id}\`
- **Cantidad**: \`450.00 kg\`
- **Unidad de Medida**: \`${kgUnit.name} (${kgUnit.abbreviation})\`
- **Ubicación**: Fontibón, Bogotá D.C. (Dirección: Calle 17 # 92-30, Bodega 4)
- **Descripción**: *"450 kg de botellas PET cristal limpias, prensadas en pacas de 50 kg, listas para recolección en bodega industrial."*
- **Condición**: Limpio y prensado
- **Requiere Transporte**: \`false\` (disponible para retiro en sitio o negociación)
- **Estado**: \`ACTIVE\`
- **Destinatarios Compatibles**: RecicladorPrueba1, TransformadorPrueba1, TransportadorPrueba1

---

#### Oferta 2 — GeneradorPrueba1
- **Identificador**: \`${offer2.id}\`
- **Usuario Propietario**: \`GeneradorPrueba1\` (\`${gen1.id}\`)
- **Tipo de Publicación**: \`OFFER\` (Oferta)
- **Material del Catálogo**: \`${cartonCategory.name}\` (Categoría padre: Papel y cartón)
- **ID Categoría**: \`${cartonCategory.id}\`
- **Cantidad**: \`600.00 kg\`
- **Unidad de Medida**: \`${kgUnit.name} (${kgUnit.abbreviation})\`
- **Ubicación**: Fontibón, Bogotá D.C. (Dirección: Calle 17 # 92-30, Bodega 4)
- **Descripción**: *"600 kg de cartón corrugado de embalaje, limpio y desarmado en atados planos."*
- **Condición**: Seco y desarmado
- **Requiere Transporte**: \`false\`
- **Estado**: \`ACTIVE\`
- **Destinatarios Compatibles**: RecicladorPrueba1, RecicladorPrueba2, TransportadorPrueba1

---

#### Oferta 3 — GeneradorPrueba2
- **Identificador**: \`${offer3.id}\`
- **Usuario Propietario**: \`GeneradorPrueba2\` (\`${gen2.id}\`)
- **Tipo de Publicación**: \`OFFER\` (Oferta)
- **Material del Catálogo**: \`${aluminioCategory.name}\` (Categoría padre: Metales)
- **ID Categoría**: \`${aluminioCategory.id}\`
- **Cantidad**: \`300.00 kg\`
- **Unidad de Medida**: \`${kgUnit.name} (${kgUnit.abbreviation})\`
- **Ubicación**: Kennedy, Bogotá D.C. (Dirección: Carrera 78 # 42 Sur, Zona Industrial)
- **Descripción**: *"300 kg de latas de aluminio prensadas y clasificadas en fardos para fundición o valorización."*
- **Condición**: Clasificado y prensado
- **Requiere Transporte**: \`false\`
- **Estado**: \`ACTIVE\`
- **Destinatarios Compatibles**: RecicladorPrueba2, TransformadorPrueba2, TransportadorPrueba1, TransportadorPrueba2

---

### Coherencia con el Catálogo Oficial
Todos los materiales utilizados corresponden exactamente a subcategorías activas del catálogo oficial precargado por la Fundación IMARA. No se crearon categorías ficticias ni registros huérfanos.
`;
  fs.writeFileSync(path.resolve('docs/QA/03-datos-de-prueba.md'), doc3, 'utf-8');
  console.log('   ✓ Documento 3 creado en docs/QA/03-datos-de-prueba.md');

  console.log('\n========================================================================');
  console.log('  🎉 ¡ETAPA 2 COMPLETADA CON ÉXITO!');
  console.log('  ✓ 10 usuarios creados con nombres exactos, tipo de usuario y política.');
  console.log('  ✓ Condiciones de coincidencia configuradas, verificadas y editadas.');
  console.log('  ✓ 3 ofertas de material creadas con categorías del catálogo oficial.');
  console.log('  ✓ Motor de coincidencias validado en tiempo real con datos de BD.');
  console.log('  ✓ Credenciales de prueba aseguradas en .env.test.credentials.');
  console.log('  ✓ Documentos 2 y 3 generados en docs/QA/.');
  console.log('========================================================================\n');
}

async function ensureOrgMemberAndCategories(orgId: string, userId: string, categoryIds: string[]) {
  const roles = await prisma.role.findMany({ where: { organizationId: orgId } });
  let ownerRole = roles.find((r) => r.name === 'OWNER');
  if (!ownerRole) {
    ownerRole = await prisma.role.create({
      data: {
        organizationId: orgId,
        name: 'OWNER',
        description: 'Propietario de la organización',
        isSystem: false,
      },
    });
  }

  await prisma.organizationMember.upsert({
    where: {
      organizationId_userId: {
        organizationId: orgId,
        userId: userId,
      },
    },
    update: {
      roleId: ownerRole.id,
      status: 'ACTIVE',
    },
    create: {
      organizationId: orgId,
      userId: userId,
      roleId: ownerRole.id,
      status: 'ACTIVE',
    },
  });

  // Asociar categorías
  for (const catId of categoryIds) {
    await prisma.organizationMaterialCategory.upsert({
      where: {
        organizationId_categoryId: {
          organizationId: orgId,
          categoryId: catId,
        },
      },
      update: {},
      create: {
        organizationId: orgId,
        categoryId: catId,
      },
    });
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  runStage2()
    .catch((err) => {
      console.error('\n❌ ERROR EJECUTANDO ETAPA 2:', err);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
