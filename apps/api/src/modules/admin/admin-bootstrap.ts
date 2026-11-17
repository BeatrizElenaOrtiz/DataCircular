import { PASSWORD_REGEX } from '@data-circular/shared';
import { Prisma, PrismaClient } from '../../generated/prisma-client';
import { prisma } from '../../database/prisma';
import { hashPassword } from '../../utils/hash';
import { normalizeEmail } from '../users/users.repository';
import { recordAuditEvent } from '../audit/audit.service';

export class AdminBootstrapError extends Error {
  constructor(
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = 'AdminBootstrapError';
  }
}

export interface AdminBootstrapCredentials {
  email: string;
  password: string;
  fullName: string;
  phone: string;
}

export interface AdminBootstrapResult {
  userId: string;
  email: string;
  auditLogId: string;
}

type BootstrapDatabase = PrismaClient | Prisma.TransactionClient;

const MIN_BOOTSTRAP_PASSWORD_LENGTH = 12;

/**
 * La creación del administrador inicial exige una bandera explícita.
 * No se ejecuta por accidente al desplegar ni al arrancar la API.
 */
export function assertAdminBootstrapAllowed(
  environment: Record<string, string | undefined> = process.env
): void {
  if (environment.ALLOW_ADMIN_BOOTSTRAP !== 'true') {
    throw new AdminBootstrapError(
      'ADMIN_BOOTSTRAP_NOT_ALLOWED',
      'Define ALLOW_ADMIN_BOOTSTRAP=true para ejecutar el bootstrap administrativo'
    );
  }
}

export function validateBootstrapPassword(password: string): void {
  if (
    password.length < MIN_BOOTSTRAP_PASSWORD_LENGTH ||
    password.length > 100 ||
    !PASSWORD_REGEX.test(password)
  ) {
    throw new AdminBootstrapError(
      'WEAK_BOOTSTRAP_PASSWORD',
      `La contraseña debe tener entre ${MIN_BOOTSTRAP_PASSWORD_LENGTH} y 100 caracteres e incluir mayúscula, minúscula, número y carácter especial`
    );
  }
}

export function validateBootstrapEmail(email: string): void {
  const normalized = email.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) || normalized.length > 255) {
    throw new AdminBootstrapError('INVALID_BOOTSTRAP_EMAIL', 'El correo del administrador no es válido');
  }
}

/**
 * Resuelve las credenciales desde variables de entorno. Devuelve null cuando
 * no se proporcionó ninguna y el llamador debe solicitar entrada interactiva.
 */
export function getBootstrapCredentialsFromEnv(
  environment: Record<string, string | undefined> = process.env
): AdminBootstrapCredentials | null {
  const email = environment.ADMIN_BOOTSTRAP_EMAIL?.trim();
  const password = environment.ADMIN_BOOTSTRAP_PASSWORD;

  if (!email && !password) {
    return null;
  }
  if (!email || !password) {
    throw new AdminBootstrapError(
      'INCOMPLETE_BOOTSTRAP_ENV',
      'Define ADMIN_BOOTSTRAP_EMAIL y ADMIN_BOOTSTRAP_PASSWORD juntos, o ninguno para usar el modo interactivo'
    );
  }

  return {
    email,
    password,
    fullName: environment.ADMIN_BOOTSTRAP_FULL_NAME?.trim() || 'Administrador General DATA_CIRCULAR',
    phone: environment.ADMIN_BOOTSTRAP_PHONE?.trim() || '',
  };
}

/**
 * Crea exactamente un administrador inicial. Falla si ya existe un ADMIN,
 * si el correo ya está registrado o si la contraseña no es fuerte.
 * El evento queda en AuditLog sin incluir la contraseña.
 */
export async function bootstrapAdministrator(
  credentials: AdminBootstrapCredentials,
  db: BootstrapDatabase = prisma
): Promise<AdminBootstrapResult> {
  validateBootstrapEmail(credentials.email);
  validateBootstrapPassword(credentials.password);

  const existingAdmin = await db.user.count({ where: { role: 'ADMIN' } });
  if (existingAdmin > 0) {
    throw new AdminBootstrapError(
      'ADMIN_ALREADY_EXISTS',
      'Ya existe al menos un administrador; el bootstrap de un solo uso no puede ejecutarse de nuevo'
    );
  }

  const email = normalizeEmail(credentials.email);
  const existingUser = await db.user.findUnique({ where: { email } });
  if (existingUser) {
    throw new AdminBootstrapError(
      'EMAIL_ALREADY_REGISTERED',
      'El correo ya pertenece a una cuenta existente; no se elevará su rol automáticamente'
    );
  }

  const passwordHash = await hashPassword(credentials.password);
  const created = await db.user.create({
    data: {
      fullName: credentials.fullName.trim() || 'Administrador General DATA_CIRCULAR',
      email,
      phone: credentials.phone.trim() || null,
      passwordHash,
      role: 'ADMIN',
      status: 'ACTIVE',
    },
  });

  const auditLog = await recordAuditEvent(
    {
      action: 'ADMIN_BOOTSTRAP',
      entityType: 'USER',
      entityId: created.id,
      actorUserId: created.id,
      targetUserId: created.id,
      newValue: { email, role: 'ADMIN' },
      reason: 'Creación del administrador inicial mediante bootstrap de un solo uso',
    },
    db
  );

  return {
    userId: created.id,
    email,
    auditLogId: auditLog.id,
  };
}
