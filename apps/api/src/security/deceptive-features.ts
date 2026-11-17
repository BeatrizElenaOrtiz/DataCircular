import { env } from '../config/env';

/**
 * Funciones engañosas que no deben existir en una publicación real.
 * Ambas quedan desactivadas por bandera y el arranque de producción falla
 * si alguien intenta activarlas.
 */
export function assertDeceptiveFeaturesDisabled(config = env): void {
  if (config.SIMULATED_PASSWORD_RECOVERY_ENABLED) {
    throw new Error('SIMULATED_PASSWORD_RECOVERY_ENABLED no puede estar activo');
  }
  if (config.SAMPLE_CERTIFICATES_ENABLED) {
    throw new Error('SAMPLE_CERTIFICATES_ENABLED no puede estar activo');
  }
}

export function simulatedPasswordRecoveryEnabled(): boolean {
  return env.SIMULATED_PASSWORD_RECOVERY_ENABLED;
}

export function sampleCertificatesEnabled(): boolean {
  return env.SAMPLE_CERTIFICATES_ENABLED;
}
