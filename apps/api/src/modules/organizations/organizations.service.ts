import {
  OrganizationDto,
  OrganizationMemberDto,
  RoleDto,
  CreateOrganizationInput,
  UpdateOrganizationInput,
  AddMemberInput,
  UpdateMemberRoleInput,
  RequestVerificationInput,
  ReviewVerificationInput,
  OrganizationStatus,
  OrganizationType,
  VerificationStatus,
} from '@data-circular/shared';
import { organizationsRepository } from './organizations.repository';
import { usersRepository } from '../users/users.repository';
import { catalogRepository } from '../catalog/catalog.repository';
import { recordAuditEvent } from '../audit/audit.service';

const ROLE_HIERARCHY: Record<string, number> = {
  OWNER: 40,
  ADMIN: 30,
  MEMBER: 20,
  OPERATOR: 10,
};

const PLATFORM_ADMIN_ROLE = 'PLATFORM_ADMIN';

export interface OrganizationActor {
  userId: string;
  roleName: string;
}

function roleRank(roleName: string | null | undefined): number {
  return roleName ? ROLE_HIERARCHY[roleName] || 0 : 0;
}

/**
 * Jerarquía explícita de roles:
 * - Solo OWNER (o un administrador de plataforma) asigna o revoca OWNER.
 * - Nadie puede asignar un rol superior al propio ni modificar a un miembro
 *   con rol superior.
 * - Un ADMIN no puede modificar su propio rol.
 */
function assertCanManageMemberRole(params: {
  actor: OrganizationActor;
  targetUserId: string;
  currentRoleName: string | null;
  nextRoleName: string;
}): void {
  const { actor, targetUserId, currentRoleName, nextRoleName } = params;

  if (actor.roleName === PLATFORM_ADMIN_ROLE) {
    return;
  }

  const actorRank = roleRank(actor.roleName);
  if (actorRank === 0) {
    throw new OrganizationError(
      'FORBIDDEN',
      'Tu rol en la organización no permite gestionar miembros',
      403
    );
  }

  if (actor.roleName !== 'OWNER' && actor.userId === targetUserId) {
    throw new OrganizationError(
      'FORBIDDEN',
      'No puedes modificar tu propio rol; solicita el cambio a un propietario',
      403
    );
  }

  if (
    actor.roleName !== 'OWNER' &&
    (currentRoleName === 'OWNER' || nextRoleName === 'OWNER')
  ) {
    throw new OrganizationError(
      'FORBIDDEN',
      'Solo el propietario (OWNER) puede asignar o revocar el rol OWNER',
      403
    );
  }

  if (roleRank(currentRoleName) > actorRank || roleRank(nextRoleName) > actorRank) {
    throw new OrganizationError(
      'FORBIDDEN',
      'No puedes gestionar un rol superior al tuyo ni ascender a alguien por encima de tu nivel',
      403
    );
  }
}

export class OrganizationError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number = 400
  ) {
    super(message);
    this.name = 'OrganizationError';
  }
}

export class OrganizationsService {
  /**
   * Crea una nueva organización empresarial o asociativa.
   * Asigna automáticamente al usuario creador el rol OWNER.
   */
  async createOrganization(
    input: CreateOrganizationInput,
    creatorUserId: string
  ): Promise<OrganizationDto> {
    const materialCategoryIds = input.materialCategoryIds || [];
    if (input.activityType !== 'GENERATOR' && materialCategoryIds.length === 0) {
      throw new OrganizationError(
        'MATERIAL_CATEGORIES_REQUIRED',
        'Selecciona al menos un material del catálogo para recibir coincidencias.',
        400
      );
    }

    for (const categoryId of materialCategoryIds) {
      const category = await catalogRepository.findCategoryById(categoryId);
      if (!category || !category.active) {
        throw new OrganizationError(
          'INVALID_MATERIAL_CATEGORY',
          'Una de las categorías seleccionadas no existe o está inactiva.',
          400
        );
      }
    }

    if (input.taxId) {
      const existing = await organizationsRepository.findByTaxId(input.taxId);
      if (existing) {
        throw new OrganizationError(
          'TAX_ID_ALREADY_EXISTS',
          `Ya existe una organización registrada con el NIT ${input.taxId}`,
          409
        );
      }
    }

    return organizationsRepository.create(input, creatorUserId);
  }

  /**
   * Obtiene la información de una organización por su identificador.
   * Valida pertenencia activa o privilegios de administrador de plataforma.
   */
  async getOrganizationById(
    id: string,
    userId: string,
    isPlatformAdmin: boolean
  ): Promise<OrganizationDto> {
    const org = await organizationsRepository.findById(id);
    if (!org) {
      throw new OrganizationError('ORGANIZATION_NOT_FOUND', 'Organización no encontrada', 404);
    }

    const membership = await organizationsRepository.findMember(id, userId);

    if (!isPlatformAdmin && (!membership || membership.status !== 'ACTIVE')) {
      throw new OrganizationError(
        'ORGANIZATION_ACCESS_DENIED',
        'No tienes acceso a esta organización',
        403
      );
    }

    return {
      ...org,
      userRole: membership?.role.name || (isPlatformAdmin ? 'PLATFORM_ADMIN' : undefined),
    };
  }

  /**
   * Lista las organizaciones donde el usuario es miembro activo.
   */
  async listUserOrganizations(
    userId: string,
    filters?: {
      status?: OrganizationStatus;
      orgType?: OrganizationType;
      locality?: string;
      verificationStatus?: VerificationStatus;
    }
  ): Promise<OrganizationDto[]> {
    return organizationsRepository.listUserOrganizations(userId, filters);
  }

  /**
   * Lista todas las organizaciones (exclusivo administradores de plataforma).
   */
  async listAllOrganizations(filters?: {
    status?: OrganizationStatus;
    orgType?: OrganizationType;
    locality?: string;
    verificationStatus?: VerificationStatus;
  }): Promise<OrganizationDto[]> {
    return organizationsRepository.listAll(filters);
  }

  /**
   * Actualiza los datos de la organización.
   */
  async updateOrganization(
    id: string,
    input: UpdateOrganizationInput
  ): Promise<OrganizationDto> {
    const org = await organizationsRepository.findById(id);
    if (!org) {
      throw new OrganizationError('ORGANIZATION_NOT_FOUND', 'Organización no encontrada', 404);
    }

    if (input.taxId && input.taxId !== org.taxId) {
      const existing = await organizationsRepository.findByTaxId(input.taxId, id);
      if (existing) {
        throw new OrganizationError(
          'TAX_ID_ALREADY_EXISTS',
          `Ya existe otra organización con el NIT ${input.taxId}`,
          409
        );
      }
    }

    if (input.materialCategoryIds !== undefined) {
      for (const categoryId of input.materialCategoryIds) {
        const category = await catalogRepository.findCategoryById(categoryId);
        if (!category || !category.active) {
          throw new OrganizationError(
            'INVALID_MATERIAL_CATEGORY',
            'Una de las categorías seleccionadas no existe o está inactiva.',
            400
          );
        }
      }
    }

    return organizationsRepository.update(id, input);
  }

  /**
   * Desactiva lógicamente una organización.
   */
  async deleteOrganization(id: string): Promise<OrganizationDto> {
    const org = await organizationsRepository.findById(id);
    if (!org) {
      throw new OrganizationError('ORGANIZATION_NOT_FOUND', 'Organización no encontrada', 404);
    }

    return organizationsRepository.softDelete(id);
  }

  /**
   * Lista los integrantes de la organización.
   */
  async listMembers(organizationId: string): Promise<OrganizationMemberDto[]> {
    const org = await organizationsRepository.findById(organizationId);
    if (!org) {
      throw new OrganizationError('ORGANIZATION_NOT_FOUND', 'Organización no encontrada', 404);
    }

    return organizationsRepository.listMembers(organizationId);
  }

  /**
   * Agrega o vincula a un usuario existente a la organización con un rol específico.
   */
  async addMember(
    organizationId: string,
    input: AddMemberInput,
    actor: OrganizationActor
  ): Promise<OrganizationMemberDto> {
    const org = await organizationsRepository.findById(organizationId);
    if (!org) {
      throw new OrganizationError('ORGANIZATION_NOT_FOUND', 'Organización no encontrada', 404);
    }

    // Verificar si el usuario existe en la plataforma
    const targetUser = await usersRepository.findSafeByEmail(input.email);
    if (!targetUser) {
      throw new OrganizationError(
        'USER_NOT_FOUND',
        `El usuario con correo ${input.email} no se encuentra registrado en DATA_CIRCULAR`,
        404
      );
    }

    const role = await organizationsRepository.findSystemRole(input.roleName);
    if (!role) {
      throw new OrganizationError('INVALID_ROLE', `Rol ${input.roleName} no reconocido`, 400);
    }

    // Verificar si ya pertenece a la organización
    const existingMembership = await organizationsRepository.findMember(
      organizationId,
      targetUser.id
    );

    const currentRoleName = existingMembership?.status === 'ACTIVE' ? existingMembership.role.name : null;

    assertCanManageMemberRole({
      actor,
      targetUserId: targetUser.id,
      currentRoleName,
      nextRoleName: input.roleName,
    });

    if (existingMembership) {
      if (existingMembership.status === 'ACTIVE') {
        throw new OrganizationError(
          'MEMBER_ALREADY_EXISTS',
          'El usuario ya es miembro activo de esta organización',
          409
        );
      } else {
        // Reactivar membresía si estaba inactiva
        const updated = await organizationsRepository.updateMember(existingMembership.id, {
          roleId: role.id,
          status: 'ACTIVE',
        });

        await recordAuditEvent({
          action: 'ORGANIZATION_MEMBER_ROLE_UPDATED',
          entityType: 'ORGANIZATION_MEMBER',
          entityId: updated.id,
          actorUserId: actor.userId,
          organizationId,
          targetUserId: targetUser.id,
          previousValue: { role: existingMembership.role.name, status: existingMembership.status },
          newValue: { role: input.roleName, status: 'ACTIVE' },
          reason: 'Reactivación de membresía con nuevo rol',
        });

        return updated;
      }
    }

    const member = await organizationsRepository.addMember(
      organizationId,
      targetUser.id,
      role.id,
      actor.userId
    );

    await recordAuditEvent({
      action: 'ORGANIZATION_MEMBER_ADDED',
      entityType: 'ORGANIZATION_MEMBER',
      entityId: member.id,
      actorUserId: actor.userId,
      organizationId,
      targetUserId: targetUser.id,
      newValue: { role: input.roleName, status: 'ACTIVE' },
      reason: 'Vinculación de un nuevo miembro a la organización',
    });

    return member;
  }

  /**
   * Actualiza el rol o estado de un integrante.
   * Impide degradar o desactivar al único propietario (OWNER) de la organización.
   */
  async updateMemberRole(
    organizationId: string,
    memberId: string,
    input: UpdateMemberRoleInput,
    actor: OrganizationActor
  ): Promise<OrganizationMemberDto> {
    const member = await organizationsRepository.findMemberById(memberId);
    if (!member || member.organizationId !== organizationId) {
      throw new OrganizationError('MEMBER_NOT_FOUND', 'Miembro no encontrado en la organización', 404);
    }

    const currentRoleName = member.role.name;
    const nextRoleName = input.roleName;

    assertCanManageMemberRole({
      actor,
      targetUserId: member.userId,
      currentRoleName,
      nextRoleName,
    });

    const isOwner = currentRoleName === 'OWNER';
    const willStopBeingOwner =
      nextRoleName !== 'OWNER' || (input.status && input.status !== 'ACTIVE');

    if (isOwner && willStopBeingOwner) {
      const ownerCount = await organizationsRepository.countOwners(organizationId);
      if (ownerCount <= 1) {
        throw new OrganizationError(
          'LAST_OWNER_CANNOT_BE_DEMOTED',
          'No es posible modificar ni desactivar al único propietario (OWNER) de la organización',
          400
        );
      }
    }

    const newRole = await organizationsRepository.findSystemRole(nextRoleName);
    if (!newRole) {
      throw new OrganizationError('INVALID_ROLE', `Rol ${nextRoleName} no reconocido`, 400);
    }

    const updated = await organizationsRepository.updateMember(memberId, {
      roleId: newRole.id,
      status: input.status,
    });

    await recordAuditEvent({
      action: 'ORGANIZATION_MEMBER_ROLE_UPDATED',
      entityType: 'ORGANIZATION_MEMBER',
      entityId: memberId,
      actorUserId: actor.userId,
      organizationId,
      targetUserId: member.userId,
      previousValue: { role: currentRoleName, status: member.status },
      newValue: { role: nextRoleName, status: updated.status },
      reason: 'Cambio de rol o estado de un miembro de la organización',
    });

    return updated;
  }

  /**
   * Desvincula a un integrante de la organización.
   * Impide remover al único propietario (OWNER).
   */
  async removeMember(
    organizationId: string,
    memberId: string,
    actor: OrganizationActor
  ): Promise<{ message: string }> {
    const member = await organizationsRepository.findMemberById(memberId);
    if (!member || member.organizationId !== organizationId) {
      throw new OrganizationError('MEMBER_NOT_FOUND', 'Miembro no encontrado en la organización', 404);
    }

    if (member.role.name === 'OWNER') {
      const ownerCount = await organizationsRepository.countOwners(organizationId);
      if (ownerCount <= 1) {
        throw new OrganizationError(
          'LAST_OWNER_CANNOT_BE_REMOVED',
          'No se puede remover al único propietario (OWNER) de la organización',
          400
        );
      }
    }

    assertCanManageMemberRole({
      actor,
      targetUserId: member.userId,
      currentRoleName: member.role.name,
      nextRoleName: member.role.name,
    });

    await organizationsRepository.removeMember(memberId);

    await recordAuditEvent({
      action: 'ORGANIZATION_MEMBER_REMOVED',
      entityType: 'ORGANIZATION_MEMBER',
      entityId: memberId,
      actorUserId: actor.userId,
      organizationId,
      targetUserId: member.userId,
      previousValue: { role: member.role.name, status: member.status },
      reason: 'Desvinculación de un miembro de la organización',
    });

    return {
      message: 'Miembro desvinculado exitosamente de la organización',
    };
  }

  /**
   * Solicita verificación / certificación institucional para la organización.
   */
  async requestVerification(
    organizationId: string,
    input: RequestVerificationInput
  ): Promise<OrganizationDto> {
    const org = await organizationsRepository.findById(organizationId);
    if (!org) {
      throw new OrganizationError('ORGANIZATION_NOT_FOUND', 'Organización no encontrada', 404);
    }

    if (org.verificationStatus === 'VERIFIED') {
      throw new OrganizationError(
        'ALREADY_VERIFIED',
        'La organización ya se encuentra verificada y certificada',
        400
      );
    }

    return organizationsRepository.updateVerification(organizationId, {
      verificationStatus: 'PENDING',
      verificationNotes: input.notes || 'Solicitud de verificación radicada por el usuario',
      certificateUrl: input.certificateUrl || null,
    });
  }

  /**
   * Dictamina y aprueba o rechaza una certificación institucional (exclusivo para administradores de plataforma).
   */
  async reviewVerification(
    organizationId: string,
    input: ReviewVerificationInput
  ): Promise<OrganizationDto> {
    const org = await organizationsRepository.findById(organizationId);
    if (!org) {
      throw new OrganizationError('ORGANIZATION_NOT_FOUND', 'Organización no encontrada', 404);
    }

    const isVerified = input.status === 'VERIFIED';

    return organizationsRepository.updateVerification(organizationId, {
      verificationStatus: input.status,
      verifiedAt: isVerified ? new Date() : null,
      verificationNotes: input.notes || (isVerified ? 'Verificación aprobada por administración' : 'Verificación rechazada'),
    });
  }

  /**
   * Lista los roles disponibles en el sistema y sus permisos asociados.
   */
  async listAvailableRoles(): Promise<RoleDto[]> {
    return organizationsRepository.listSystemRoles();
  }
}

export const organizationsService = new OrganizationsService();
