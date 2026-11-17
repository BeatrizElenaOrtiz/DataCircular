import { describe, it, expect } from 'vitest';
import { Prisma } from '../src/generated/prisma-client';
import { prisma } from '../src/database/prisma';
import {
  AdminBootstrapError,
  assertAdminBootstrapAllowed,
  bootstrapAdministrator,
  getBootstrapCredentialsFromEnv,
  validateBootstrapPassword,
} from '../src/modules/admin/admin-bootstrap';

const strongPassword = 'BootstrapSeguro2026!';

class Rollback<T> extends Error {
  constructor(public readonly value: T) {
    super('rollback');
  }
}

async function runInRollbackTransaction<T>(
  callback: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  try {
    await prisma.$transaction(async (tx) => {
      const value = await callback(tx);
      throw new Rollback(value);
    });
    throw new Error('La transacción de prueba debía revertirse');
  } catch (error) {
    if (error instanceof Rollback) {
      return error.value as T;
    }
    throw error;
  }
}

describe('Bootstrap del administrador inicial', () => {
  it('exige ALLOW_ADMIN_BOOTSTRAP=true', () => {
    expect(() => assertAdminBootstrapAllowed({})).toThrow(AdminBootstrapError);
    expect(() => assertAdminBootstrapAllowed({ ALLOW_ADMIN_BOOTSTRAP: 'false' })).toThrow(
      AdminBootstrapError
    );
    expect(() =>
      assertAdminBootstrapAllowed({ ALLOW_ADMIN_BOOTSTRAP: 'true' })
    ).not.toThrow();
  });

  it('acepta credenciales por entorno y rechaza configuraciones parciales', () => {
    expect(getBootstrapCredentialsFromEnv({})).toBeNull();
    expect(() => getBootstrapCredentialsFromEnv({ ADMIN_BOOTSTRAP_EMAIL: 'admin@example.org' })).toThrow(
      AdminBootstrapError
    );

    const credentials = getBootstrapCredentialsFromEnv({
      ADMIN_BOOTSTRAP_EMAIL: 'admin@example.org',
      ADMIN_BOOTSTRAP_PASSWORD: strongPassword,
    });

    expect(credentials?.email).toBe('admin@example.org');
    expect(credentials?.password).toBe(strongPassword);
  });

  it('exige una contraseña fuerte de al menos 12 caracteres', () => {
    expect(() => validateBootstrapPassword('corta')).toThrow(AdminBootstrapError);
    expect(() => validateBootstrapPassword('debilpassword')).toThrow(AdminBootstrapError);
    expect(() => validateBootstrapPassword(strongPassword)).not.toThrow();
  });

  it('falla si ya existe un administrador', async () => {
    await expect(
      prisma.$transaction(async (tx) => {
        await tx.user.create({
          data: {
            fullName: 'Administrador Existente',
            email: `admin-existente-${Date.now()}@example.org`,
            passwordHash: 'hash-de-prueba',
            role: 'ADMIN',
          },
        });
        await bootstrapAdministrator(
          {
            email: `nuevo-admin-${Date.now()}@example.org`,
            password: strongPassword,
            fullName: 'Nuevo Administrador',
            phone: '',
          },
          tx
        );
      })
    ).rejects.toMatchObject({ code: 'ADMIN_ALREADY_EXISTS' });
  });

  it('crea el administrador y registra el evento sin guardar la contraseña', async () => {
    const email = `bootstrap-${Date.now()}@example.org`;

    const evidence = await runInRollbackTransaction(async (tx) => {
      // Aísla la prueba de administradores creados por otras suites; la transacción revierte todo.
      await tx.user.updateMany({ where: { role: 'ADMIN' }, data: { role: 'USER' } });

      const result = await bootstrapAdministrator(
        {
          email,
          password: strongPassword,
          fullName: 'Administrador Bootstrap',
          phone: '+57 300 000 0000',
        },
        tx
      );

      const user = await tx.user.findUniqueOrThrow({ where: { id: result.userId } });
      const audit = await tx.auditLog.findUniqueOrThrow({ where: { id: result.auditLogId } });

      return { result, user, audit };
    });

    expect(evidence.result.email).toBe(email);
    expect(evidence.user.role).toBe('ADMIN');
    expect(evidence.user.email).toBe(email);
    expect(evidence.audit.action).toBe('ADMIN_BOOTSTRAP');
    expect(evidence.audit.targetUserId).toBe(evidence.result.userId);
    expect(JSON.stringify(evidence.audit)).not.toContain(strongPassword);

    const persisted = await prisma.user.findUnique({ where: { email } });
    expect(persisted).toBeNull();
  });

  it('no eleva el rol de un correo ya registrado', async () => {
    const email = `cuenta-existente-${Date.now()}@example.org`;

    await expect(
      prisma.$transaction(async (tx) => {
        await tx.user.updateMany({ where: { role: 'ADMIN' }, data: { role: 'USER' } });
        await tx.user.create({
          data: {
            fullName: 'Cuenta Existente',
            email,
            passwordHash: 'hash-de-prueba',
            role: 'USER',
          },
        });
        await bootstrapAdministrator(
          {
            email,
            password: strongPassword,
            fullName: 'Administrador Bootstrap',
            phone: '',
          },
          tx
        );
      })
    ).rejects.toMatchObject({ code: 'EMAIL_ALREADY_REGISTERED' });
  });
});
