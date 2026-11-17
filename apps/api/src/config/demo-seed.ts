type SeedEnvironment = Record<string, string | undefined>;

export interface DemoSeedAdmin {
  email: string;
  password: string;
  fullName: string;
  phone: string;
}

/**
 * Los seeds de demostración solo pueden ejecutarse con una bandera explícita
 * y nunca en producción.
 */
export function assertDemoSeedAllowed(environment: SeedEnvironment = process.env): void {
  if (environment.NODE_ENV === 'production') {
    throw new Error('Los seeds de demostración están prohibidos con NODE_ENV=production');
  }

  if (environment.ALLOW_DEMO_SEED !== 'true') {
    throw new Error('Define ALLOW_DEMO_SEED=true para ejecutar seeds de demostración');
  }
}

/**
 * La identidad administrativa del seed se recibe por variables de entorno.
 * No se aceptan correos ni contraseñas escritos en el código.
 */
export function getDemoSeedAdmin(environment: SeedEnvironment = process.env): DemoSeedAdmin {
  assertDemoSeedAllowed(environment);

  const email = environment.EVAL_ADMIN_EMAIL?.trim();
  const password = environment.EVAL_ADMIN_PASSWORD;

  if (!email) {
    throw new Error('Define EVAL_ADMIN_EMAIL mediante un gestor seguro');
  }
  if (!password) {
    throw new Error('Define EVAL_ADMIN_PASSWORD mediante un gestor seguro');
  }

  return {
    email,
    password,
    fullName: environment.EVAL_ADMIN_FULL_NAME?.trim() || 'Administrador General DATA_CIRCULAR',
    phone: environment.EVAL_ADMIN_PHONE?.trim() || '',
  };
}
