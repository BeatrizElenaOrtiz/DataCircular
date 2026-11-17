import jwt, { SignOptions } from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { env } from '../config/env';
import { AuthTokens, SafeUserDto, UserRole } from '@data-circular/shared';

/** Algoritmo único aceptado para firmar y verificar tokens. */
export const JWT_ALGORITHM = 'HS256' as const;

export interface AccessTokenPayload {
  sub: string;
  email: string;
  role: UserRole;
  type: 'access';
  /** Identificador de la sesión revocable. */
  sid: string;
  /** Identificador único del token (rotación y trazabilidad). */
  jti: string;
}

export interface RefreshTokenPayload {
  sub: string;
  type: 'refresh';
  /** Identificador de la sesión revocable. */
  sid: string;
  /** Identificador único del token (detección de reuso). */
  jti: string;
}

function buildAccessPayload(user: SafeUserDto, sessionId: string): AccessTokenPayload {
  return {
    sub: user.id,
    email: user.email,
    role: user.role,
    type: 'access',
    sid: sessionId,
    jti: randomUUID(),
  };
}

function buildRefreshPayload(user: SafeUserDto, sessionId: string): RefreshTokenPayload {
  return {
    sub: user.id,
    type: 'refresh',
    sid: sessionId,
    jti: randomUUID(),
  };
}

/**
 * Genera el par de tokens (Access Token y Refresh Token) para una sesión.
 * Ambos tokens comparten `sid`; cada uno lleva su propio `jti`.
 */
export function generateTokens(user: SafeUserDto, sessionId: string): AuthTokens {
  const accessTokenOptions: SignOptions = {
    algorithm: JWT_ALGORITHM,
    expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'],
  };

  const refreshTokenOptions: SignOptions = {
    algorithm: JWT_ALGORITHM,
    expiresIn: env.JWT_REFRESH_EXPIRES_IN as SignOptions['expiresIn'],
  };

  const accessToken = jwt.sign(
    buildAccessPayload(user, sessionId),
    env.JWT_SECRET,
    accessTokenOptions
  );
  const refreshToken = jwt.sign(
    buildRefreshPayload(user, sessionId),
    env.JWT_REFRESH_SECRET,
    refreshTokenOptions
  );

  return {
    accessToken,
    refreshToken,
    expiresIn: env.JWT_EXPIRES_IN,
  };
}

function assertSessionClaims(decoded: unknown): asserts decoded is { sid: string; jti: string } {
  const payload = decoded as { sid?: unknown; jti?: unknown } | null;
  if (
    !payload ||
    typeof payload.sid !== 'string' ||
    payload.sid.length === 0 ||
    typeof payload.jti !== 'string' ||
    payload.jti.length === 0
  ) {
    throw new Error('Token sin identificadores de sesión válidos');
  }
}

/**
 * Verifica y decodifica un Access Token JWT.
 * El algoritmo está fijado a HS256 para impedir confusión de algoritmos.
 */
export function verifyAccessToken(token: string): AccessTokenPayload {
  const decoded = jwt.verify(token, env.JWT_SECRET, {
    algorithms: [JWT_ALGORITHM],
  }) as AccessTokenPayload;

  if (decoded.type !== 'access') {
    throw new Error('Tipo de token inválido para autorización');
  }
  assertSessionClaims(decoded);

  return decoded;
}

/**
 * Verifica y decodifica un Refresh Token JWT.
 * El algoritmo está fijado a HS256 para impedir confusión de algoritmos.
 */
export function verifyRefreshToken(token: string): RefreshTokenPayload {
  const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET, {
    algorithms: [JWT_ALGORITHM],
  }) as RefreshTokenPayload;

  if (decoded.type !== 'refresh') {
    throw new Error('Tipo de token inválido para renovación');
  }
  assertSessionClaims(decoded);

  return decoded;
}

/**
 * Fecha de expiración real del refresh token recién emitido, tomada del claim
 * `exp`. Evita duplicar el parser de duraciones de `JWT_REFRESH_EXPIRES_IN`.
 */
export function getRefreshTokenExpiration(refreshToken: string): Date {
  const decoded = jwt.decode(refreshToken) as { exp?: number } | null;
  if (!decoded?.exp) {
    throw new Error('El refresh token emitido no contiene expiración');
  }
  return new Date(decoded.exp * 1000);
}
