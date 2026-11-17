import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

// Cargar variables de entorno desde .env si existe
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const defaultJwtSecret = 'default_dev_secret_change_me_12345';
const defaultJwtRefreshSecret = 'default_dev_refresh_secret_12345';

// Fragmentos usados en valores de ejemplo o por defecto. Nunca deben llegar a un arranque real.
const weakSecretFragments = ['change_me', 'tu_clave', 'placeholder', 'default', 'example_secret'];

function boolFromEnv(value: unknown): boolean {
  return value === true || value === 'true' || value === '1' || value === 'yes';
}

export function isWeakSecret(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  if (normalized === defaultJwtSecret || normalized === defaultJwtRefreshSecret) {
    return true;
  }
  return weakSecretFragments.some((fragment) => normalized.includes(fragment));
}

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL es requerida'),
  JWT_SECRET: z
    .string()
    .min(1, 'JWT_SECRET es requerida')
    .refine(
      (value) => Buffer.byteLength(value, 'utf8') >= 32,
      'JWT_SECRET debe tener al menos 32 bytes'
    ),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_SECRET: z
    .string()
    .min(1, 'JWT_REFRESH_SECRET es requerida')
    .refine(
      (value) => Buffer.byteLength(value, 'utf8') >= 32,
      'JWT_REFRESH_SECRET debe tener al menos 32 bytes'
    ),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  CORS_ORIGIN: z.preprocess(
    (value) => value === undefined && process.env.RENDER_EXTERNAL_URL
      ? process.env.RENDER_EXTERNAL_URL
      : value,
    z.string().default('*')
  ),
  DATA_POLICY_URL: z.preprocess(
    (value) =>
      value === '' || value === 'https://fundacionimara.org/politica-datos-pendiente'
        ? undefined
        : value,
    z.string().url('DATA_POLICY_URL debe ser una URL válida').optional()
  ),
  DATA_POLICY_VERSION: z.preprocess(
    (value) => value === '1.0-draft' ? undefined : value,
    z.string().min(1).default('pendiente')
  ),
  TERMS_VERSION: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.string().min(1).default('2026.11.17')
  ),
  REQUIRE_TERMS_ACCEPTANCE: z.preprocess(boolFromEnv, z.boolean().default(false)),
  ACCOUNT_DELETION_RETENTION_DAYS: z.coerce.number().int().positive().default(30),
  ACCOUNT_DELETION_RETENTION_NOTICE: z
    .string()
    .min(1)
    .default(
      'Al eliminar tu cuenta se anonimizan tus datos de perfil, publicaciones, mensajes, propuestas, evidencias y documentos de verificacion. Conservamos los registros minimos de auditoria y las obligaciones legales o contractuales necesarias para atender reclamaciones durante el periodo configurado y despues ejecutamos la purga irreversible.'
    ),
  SIMULATED_PASSWORD_RECOVERY_ENABLED: z.preprocess(boolFromEnv, z.boolean().default(false)),
  SAMPLE_CERTIFICATES_ENABLED: z.preprocess(boolFromEnv, z.boolean().default(false)),
  PURGE_SCHEDULER_ENABLED: z.preprocess(boolFromEnv, z.boolean().default(false)),
  PURGE_INTERVAL_HOURS: z.coerce.number().int().positive().default(24),
}).superRefine((config, context) => {
  if (isWeakSecret(config.JWT_SECRET)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['JWT_SECRET'],
      message: 'JWT_SECRET no puede ser un valor por defecto o de ejemplo',
    });
  }

  if (isWeakSecret(config.JWT_REFRESH_SECRET)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['JWT_REFRESH_SECRET'],
      message: 'JWT_REFRESH_SECRET no puede ser un valor por defecto o de ejemplo',
    });
  }

  if (config.JWT_SECRET === config.JWT_REFRESH_SECRET) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['JWT_REFRESH_SECRET'],
      message: 'JWT_REFRESH_SECRET debe ser distinto de JWT_SECRET',
    });
  }

  if (config.NODE_ENV !== 'production') return;

  const corsOrigins = config.CORS_ORIGIN.split(',').map((origin) => origin.trim());
  const hasInvalidCorsOrigin = corsOrigins.some((origin) => {
    if (!origin || origin === '*') return true;

    try {
      const parsedOrigin = new URL(origin);
      return (
        parsedOrigin.protocol !== 'https:' ||
        parsedOrigin.pathname !== '/' ||
        parsedOrigin.search.length > 0 ||
        parsedOrigin.hash.length > 0
      );
    } catch {
      return true;
    }
  });

  if (hasInvalidCorsOrigin) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['CORS_ORIGIN'],
      message: 'CORS_ORIGIN debe contener únicamente orígenes HTTPS válidos y autorizados en producción',
    });
  }

  if (!config.DATA_POLICY_URL || !config.DATA_POLICY_URL.startsWith('https://')) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['DATA_POLICY_URL'],
      message: 'DATA_POLICY_URL debe ser una URL HTTPS pública en producción',
    });
  }

  if (
    config.DATA_POLICY_VERSION.trim().toLowerCase() === 'pendiente' ||
    config.DATA_POLICY_VERSION.trim().toLowerCase().includes('draft')
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['DATA_POLICY_VERSION'],
      message: 'DATA_POLICY_VERSION debe identificar la versión publicada de la política',
    });
  }

  const normalizedTermsVersion = config.TERMS_VERSION.trim().toLowerCase();
  if (
    normalizedTermsVersion === 'pendiente' ||
    normalizedTermsVersion.includes('draft') ||
    normalizedTermsVersion.includes('borrador')
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['TERMS_VERSION'],
      message: 'TERMS_VERSION debe identificar la versión publicada de los términos de uso',
    });
  }

  if (config.SIMULATED_PASSWORD_RECOVERY_ENABLED || config.SAMPLE_CERTIFICATES_ENABLED) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['SIMULATED_PASSWORD_RECOVERY_ENABLED'],
      message: 'Las funciones simuladas de recuperación y certificados de muestra están prohibidas en producción',
    });
  }
});

export function validateEnv(input: Record<string, string | undefined>) {
  return envSchema.safeParse(input);
}

const parsed = validateEnv(process.env);

if (!parsed.success) {
  console.error('❌ Error de validación en variables de entorno:');
  console.error(JSON.stringify(parsed.error.format(), null, 2));
  process.exit(1);
}

export const env = parsed.data;
