import { randomUUID } from 'crypto';
import { usersRepository, normalizeEmail, toSafeUser } from '../users/users.repository';
import { hashPassword, verifyPassword } from '../../utils/hash';
import {
  generateTokens,
  getRefreshTokenExpiration,
  verifyRefreshToken,
} from '../../utils/jwt';
import { env } from '../../config/env';
import {
  RegisterDto,
  LoginDto,
  AuthResponseDto,
  AuthTokens,
  SafeUserDto,
} from '@data-circular/shared';
import { hashRefreshToken, sessionRepository } from './session.repository';
import { UserSession, TermsAcceptanceSource } from '../../generated/prisma-client';
import { prisma } from '../../database/prisma';

interface TermsRegistrationFields {
  termsAccepted?: boolean;
  termsVersion?: string;
}

function termsRequired(): boolean {
  return env.NODE_ENV === 'production' || process.env.REQUIRE_TERMS_ACCEPTANCE === 'true';
}

/**
 * Margen corto de tolerancia para renovaciones concurrentes: dos peticiones
 * que llegan casi al mismo tiempo con el mismo refresh no deben cerrar la
 * sesión. Fuera de este margen, el reuso sí se trata como compromiso.
 */
export const REFRESH_CONCURRENCY_GRACE_MS = 5_000;

export class AuthError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number = 400
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

export class AuthService {
  /**
   * Crea una sesión revocable y emite el par de tokens asociado a su `sid`.
   */
  private async issueSession(user: SafeUserDto): Promise<AuthTokens> {
    // Limpieza oportunista: no bloquea el login si falla.
    await sessionRepository.deleteStale().catch(() => {});

    const sessionId = randomUUID();
    const tokens = generateTokens(user, sessionId);

    await sessionRepository.create({
      id: sessionId,
      userId: user.id,
      refreshTokenHash: hashRefreshToken(tokens.refreshToken),
      expiresAt: getRefreshTokenExpiration(tokens.refreshToken),
    });

    return tokens;
  }

  /**
   * Registra un nuevo usuario en la plataforma.
   * Reglas de negocio y seguridad:
   * - El correo se normaliza a minúsculas y trim.
   * - Se verifica que el correo no esté previamente registrado (409 Conflict).
   * - La contraseña se hashea con Argon2id.
   * - El rol inicial SIEMPRE es forzado a 'USER' para impedir escalada de privilegios en el registro público.
   * - El estado inicial de la cuenta es 'ACTIVE'.
   */
  async register(input: RegisterDto & TermsRegistrationFields): Promise<AuthResponseDto> {
    const normalizedEmail = normalizeEmail(input.email);

    if (termsRequired() && input.termsAccepted !== true) {
      throw new AuthError(
        'TERMS_ACCEPTANCE_REQUIRED',
        'Debes aceptar los términos de uso para crear una cuenta',
        400
      );
    }

    // Verificar si el correo ya existe
    const existing = await usersRepository.findSafeByEmail(normalizedEmail, true);
    if (existing) {
      throw new AuthError(
        'EMAIL_ALREADY_REGISTERED',
        'El correo electrónico ya se encuentra registrado en el sistema',
        409
      );
    }

    // Hashear la contraseña con Argon2id
    const passwordHash = await hashPassword(input.password);

    // Crear el usuario forzando rol 'USER' (inmune a manipulación del body)
    const safeUser = await usersRepository.create({
      fullName: input.fullName,
      email: normalizedEmail,
      phone: input.phone,
      userType: input.userType,
      passwordHash,
      role: 'USER',
    }, {
      policyVersion: env.DATA_POLICY_VERSION,
      policyUrl: env.DATA_POLICY_URL ?? null,
    });

    // Registro verificable de términos: versión y fecha, con origen explícito
    // cuando el cliente los envía. Clientes herederos quedan marcados como
    // IMPLICIT para que el equipo móvil pueda migrarlos en la siguiente etapa.
    try {
      await prisma.termsAcceptance.create({
        data: {
          userId: safeUser.id,
          version: input.termsVersion?.trim() || env.TERMS_VERSION,
          acceptedAt: new Date(),
          source: input.termsAccepted === true
            ? TermsAcceptanceSource.EXPLICIT
            : TermsAcceptanceSource.LEGACY_IMPLICIT,
          documentUrl: env.DATA_POLICY_URL ?? null,
        },
      });
    } catch (error) {
      await prisma.user.delete({ where: { id: safeUser.id } }).catch(() => {});
      throw error;
    }

    // Generar tokens de sesión y persistir la sesión revocable
    const tokens = await this.issueSession(safeUser);

    return {
      user: safeUser,
      tokens,
    };
  }

  /**
   * Inicia sesión validando credenciales de usuario.
   * Reglas de seguridad:
   * - Si el correo no existe o la contraseña es incorrecta, se responde con un mensaje genérico
   *   "Credenciales inválidas" (código 401) para evitar la enumeración de usuarios.
   * - Se verifica que la cuenta esté activa.
   */
  async login(input: LoginDto): Promise<AuthResponseDto> {
    const normalizedEmail = normalizeEmail(input.email);

    // Buscar el usuario por correo electrónico para autenticación interna
    const user = await usersRepository.findByEmailForAuth(normalizedEmail);

    if (!user) {
      throw new AuthError(
        'INVALID_CREDENTIALS',
        'Credenciales inválidas. Comprueba tu correo y contraseña.',
        401
      );
    }

    // Verificar estado de la cuenta
    if (user.status !== 'ACTIVE') {
      throw new AuthError(
        'ACCOUNT_NOT_ACTIVE',
        `Tu cuenta no se encuentra activa (Estado: ${user.status}). Contacta a soporte.`,
        403
      );
    }

    // Verificar contraseña con Argon2id
    const isPasswordValid = await verifyPassword(user.passwordHash, input.password);
    if (!isPasswordValid) {
      throw new AuthError(
        'INVALID_CREDENTIALS',
        'Credenciales inválidas. Comprueba tu correo y contraseña.',
        401
      );
    }

    const safeUser = toSafeUser(user);
    const tokens = await this.issueSession(safeUser);

    return {
      user: safeUser,
      tokens,
    };
  }

  /**
   * Indica si el hash presentado corresponde al refresh inmediatamente
   * anterior y la rotación ocurrió dentro del margen de concurrencia.
   */
  private isConcurrentReplay(session: UserSession, presentedHash: string): boolean {
    if (session.previousRefreshTokenHash !== presentedHash || !session.rotatedAt) {
      return false;
    }
    return Date.now() - session.rotatedAt.getTime() <= REFRESH_CONCURRENCY_GRACE_MS;
  }

  /**
   * Rota desde el hash vigente. Si otra petición compite, se reintenta una vez
   * con el estado más reciente; nunca se revoca la sesión por esta causa.
   */
  private async rotateSafely(session: UserSession, userId: string): Promise<AuthTokens> {
    const user = await usersRepository.findById(userId, false);
    if (!user || user.status !== 'ACTIVE') {
      await sessionRepository.revoke(session.id, 'USER_INACTIVE');
      throw new AuthError(
        'INVALID_REFRESH_TOKEN',
        'El usuario asociado al token de actualización no es válido o está inactivo',
        401
      );
    }

    let expectedHash = session.refreshTokenHash;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const tokens = generateTokens(user, session.id);
      const rotated = await sessionRepository.rotate(
        session.id,
        expectedHash,
        hashRefreshToken(tokens.refreshToken),
        getRefreshTokenExpiration(tokens.refreshToken),
        new Date()
      );

      if (rotated.count > 0) {
        return tokens;
      }

      const latest = await sessionRepository.findById(session.id);
      if (
        latest &&
        !latest.revokedAt &&
        latest.expiresAt > new Date() &&
        this.isConcurrentReplay(latest, expectedHash)
      ) {
        expectedHash = latest.refreshTokenHash;
        continue;
      }

      // Conflicto fuera del margen: se responde sin revocar para no cerrar
      // indebidamente una sesión de un cliente que solo reintentó.
      throw new AuthError(
        'REFRESH_CONCURRENT',
        'Otra renovación está en curso. Reintenta con el token más reciente.',
        409
      );
    }

    throw new AuthError('REFRESH_CONCURRENT', 'No fue posible renovar la sesión', 409);
  }

  /**
   * Renueva el Access Token con rotación del Refresh Token.
   *
   * Reglas:
   * - El refresh token debe ser válido, pertenecer a una sesión activa y
   *   coincidir con el hash vigente (o con el inmediatamente anterior dentro
   *   del margen de concurrencia de 5 segundos).
   * - Cada uso exitoso rota el refresh token; el anterior queda registrado
   *   solo como hash y no puede reutilizarse fuera del margen.
   * - El reuso fuera del margen o un desajuste revoca la sesión completa.
   */
  async refresh(refreshToken: string): Promise<AuthTokens> {
    let payload: ReturnType<typeof verifyRefreshToken>;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch {
      throw new AuthError(
        'INVALID_REFRESH_TOKEN',
        'El token de actualización es inválido o ha expirado',
        401
      );
    }

    const session = await sessionRepository.findById(payload.sid);
    if (!session) {
      throw new AuthError(
        'INVALID_REFRESH_TOKEN',
        'El token de actualización es inválido o ha expirado',
        401
      );
    }

    if (session.revokedAt || session.expiresAt <= new Date()) {
      throw new AuthError(
        'INVALID_REFRESH_TOKEN',
        'La sesión asociada al token de actualización ya no está activa',
        401
      );
    }

    const presentedHash = hashRefreshToken(refreshToken);
    if (session.refreshTokenHash !== presentedHash) {
      // Reuso reciente por concurrencia: se renueva sin revocar la sesión.
      if (this.isConcurrentReplay(session, presentedHash)) {
        return this.rotateSafely(session, payload.sub);
      }

      // Reuso del token anterior fuera del margen o token ajeno a la sesión.
      await sessionRepository.revoke(session.id, 'REFRESH_TOKEN_REUSE');
      throw new AuthError(
        'REFRESH_TOKEN_REUSED',
        'El token de actualización ya fue utilizado. Inicia sesión nuevamente.',
        401
      );
    }

    return this.rotateSafely(session, payload.sub);
  }

  /**
   * Revoca en el servidor la sesión asociada al access token usado en logout.
   */
  async logout(sessionId: string): Promise<void> {
    await sessionRepository.revoke(sessionId, 'LOGOUT');
  }

  /**
   * Cierra todas las sesiones del usuario ("cerrar sesión en todos los dispositivos").
   */
  async logoutAll(userId: string): Promise<number> {
    const result = await sessionRepository.revokeAllForUser(userId, 'LOGOUT_ALL');
    return result.count;
  }
}

export const authService = new AuthService();
