import { describe, it, expect } from 'vitest';
import request from 'supertest';
import fs from 'fs';
import path from 'path';
import { app } from '../src/app';
import { validateEnv } from '../src/config/env';
import { shouldMountDemoConsole } from '../src/modules/dashboard/dashboard.routes';
import { assertDemoSeedAllowed, getDemoSeedAdmin } from '../src/config/demo-seed';

const validBase = {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://audit:audit@localhost:5432/data_circular_audit_test?schema=public',
  JWT_SECRET: 'A1'.repeat(24),
  JWT_REFRESH_SECRET: 'B2'.repeat(24),
};

const productionBase = {
  ...validBase,
  NODE_ENV: 'production',
  CORS_ORIGIN: 'https://app.datacircular.org',
  DATA_POLICY_URL: 'https://app.datacircular.org/politica-datos',
  DATA_POLICY_VERSION: '2026.11.09',
};

function findRepoRoot(start = process.cwd()): string {
  let current = start;
  while (!fs.existsSync(path.join(current, '.git'))) {
    const parent = path.dirname(current);
    if (parent === current) {
      throw new Error('No se encontró la raíz del repositorio');
    }
    current = parent;
  }
  return current;
}

function readRepoFile(relativePath: string): string {
  return fs.readFileSync(path.join(findRepoRoot(), relativePath), 'utf8');
}

describe('GRUPO 1 - Secretos y credenciales demo (SA-001, SA-020)', () => {
  describe('Consola demo', () => {
    it('no publica credenciales demo en el HTML', async () => {
      const res = await request(app).get('/');

      expect(res.status).toBe(200);
      expect(res.text).not.toContain('ImaraBogota2026');
      expect(res.text).not.toContain('recuperador.bogota@imara.org');
      expect(res.text).not.toMatch(/id="reg-pass"[^>]*value="[^"]+"/);
      expect(res.text).not.toMatch(/id="login-pass"[^>]*value="[^"]+"/);
      expect(res.text).not.toMatch(/id="reg-email"[^>]*value="[^"]+"/);
      expect(res.text).not.toMatch(/id="login-email"[^>]*value="[^"]+"/);
    });

    it('no se monta en producción', () => {
      expect(shouldMountDemoConsole('production')).toBe(false);
      expect(shouldMountDemoConsole('development')).toBe(true);
      expect(shouldMountDemoConsole('test')).toBe(true);
    });
  });

  describe('Validación de variables de entorno al arrancar', () => {
    it('acepta una configuración válida', () => {
      expect(validateEnv(validBase).success).toBe(true);
      expect(validateEnv(productionBase).success).toBe(true);
    });

    it('falla si falta JWT_SECRET', () => {
      expect(validateEnv({ ...validBase, JWT_SECRET: undefined }).success).toBe(false);
    });

    it('falla si falta JWT_REFRESH_SECRET', () => {
      expect(validateEnv({ ...validBase, JWT_REFRESH_SECRET: undefined }).success).toBe(false);
    });

    it('falla con secretos por defecto o de ejemplo', () => {
      expect(
        validateEnv({ ...validBase, JWT_SECRET: 'default_dev_secret_change_me_12345' }).success
      ).toBe(false);
      expect(
        validateEnv({
          ...validBase,
          JWT_SECRET: 'tu_clave_secreta_jwt_minimo_32_caracteres_aleatorios',
        }).success
      ).toBe(false);
    });

    it('falla con secretos cortos o iguales', () => {
      expect(validateEnv({ ...validBase, JWT_SECRET: 'corto' }).success).toBe(false);
      expect(
        validateEnv({
          ...validBase,
          JWT_REFRESH_SECRET: validBase.JWT_SECRET,
        }).success
      ).toBe(false);
    });

    it('falla en producción si faltan variables críticas', () => {
      expect(validateEnv({ ...productionBase, DATA_POLICY_URL: undefined }).success).toBe(false);
      expect(validateEnv({ ...productionBase, CORS_ORIGIN: '*' }).success).toBe(false);
    });
  });

  describe('Seeds de demostración', () => {
    it('se niegan a ejecutarse en producción', () => {
      expect(() =>
        assertDemoSeedAllowed({ NODE_ENV: 'production', ALLOW_DEMO_SEED: 'true' })
      ).toThrow();
    });

    it('exigen una bandera explícita', () => {
      expect(() => assertDemoSeedAllowed({ NODE_ENV: 'development' })).toThrow();
      expect(() =>
        assertDemoSeedAllowed({ NODE_ENV: 'development', ALLOW_DEMO_SEED: 'true' })
      ).not.toThrow();
    });

    it('exigen identidad administrativa desde variables de entorno', () => {
      expect(() =>
        getDemoSeedAdmin({ NODE_ENV: 'development', ALLOW_DEMO_SEED: 'true' })
      ).toThrow();

      const admin = getDemoSeedAdmin({
        NODE_ENV: 'development',
        ALLOW_DEMO_SEED: 'true',
        EVAL_ADMIN_EMAIL: 'operador@example.org',
        EVAL_ADMIN_PASSWORD: 'secreto-de-prueba',
      });
      expect(admin.email).toBe('operador@example.org');
      expect(admin.password).toBe('secreto-de-prueba');
    });
  });

  describe('Configuración de Docker Compose (SA-020)', () => {
    it('exige credenciales PostgreSQL sin valores por defecto', () => {
      const compose = readRepoFile('docker-compose.yml');

      expect(compose).toContain('${POSTGRES_USER:?');
      expect(compose).toContain('${POSTGRES_PASSWORD:?');
      expect(compose).toContain('${POSTGRES_DB:?');
      expect(compose).not.toMatch(/\$\{POSTGRES_(USER|PASSWORD|DB):-[^}]+\}/);
      expect(compose).not.toContain('${POSTGRES_PASSWORD:-postgres}');
    });

    it('publica el puerto de la base solo en loopback o no lo publica', () => {
      const compose = readRepoFile('docker-compose.yml');
      const portLines = compose
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => /^- ["']?\$\{POSTGRES_PORT/.test(line));

      expect(portLines.length + (compose.includes('127.0.0.1:') ? 1 : 0)).toBeGreaterThan(0);
      for (const line of portLines) {
        expect(line, `El puerto de PostgreSQL debe publicarse solo en loopback: ${line}`).toMatch(
          /127\.0\.0\.1/
        );
      }
    });

    it('.env.example documenta las variables obligatorias de Compose sin valores reales', () => {
      const example = readRepoFile('.env.example');

      expect(example).toContain('POSTGRES_USER=');
      expect(example).toContain('POSTGRES_PASSWORD=');
      expect(example).toContain('POSTGRES_DB=');
      expect(example).toContain('POSTGRES_PORT=');
      expect(example).not.toMatch(/POSTGRES_PASSWORD\s*=\s*postgres\s*$/m);
      expect(example).toMatch(/POSTGRES_PASSWORD\s*=\s*$/m);
      expect(example).toMatch(/CAMBIAR|OBLIGATORIA|Define|Genera/i);
    });
  });

  describe('Escáner de secretos obligatorio antes del commit (SA-001)', () => {
    it('existe un hook pre-commit que ejecuta el escáner', () => {
      const hook = readRepoFile('.githooks/pre-commit');

      expect(hook).toContain('scan-secrets.ts');
      expect(hook).toMatch(/tsx|npx/);
    });

    it('el hook está instalado mediante un script de npm y documentado', () => {
      const pkg = JSON.parse(readRepoFile('package.json')) as {
        scripts: Record<string, string>;
      };

      expect(pkg.scripts['security:scan']).toContain('scan-secrets.ts');
      expect(pkg.scripts['security:install-hooks']).toContain('core.hooksPath');
      expect(readRepoFile('docs/security-audit/ETAPA-2-GRUPO-1.md')).toContain(
        'security:install-hooks'
      );
    });
  });

  describe('Higiene del repositorio', () => {
    it('.gitignore cubre variables de entorno, keystores y credenciales', () => {
      const gitignore = readRepoFile('.gitignore');
      const requiredPatterns = [
        '.env',
        '.env.*',
        '!.env.example',
        '*.keystore',
        '*.jks',
        '*.p8',
        '*.p12',
        '*.key',
        '*.pem',
        '*.mobileprovision',
        '*service-account*.json',
        'credentials.json',
      ];

      for (const pattern of requiredPatterns) {
        expect(gitignore, `Falta el patrón ${pattern} en .gitignore`).toContain(pattern);
      }
    });

    it('no contiene credenciales demo conocidas en código y pantallas', () => {
      const files = [
        'apps/api/src/modules/dashboard/dashboard.routes.ts',
        'apps/mobile/scripts/verify-mobile-flow.ts',
        'apps/mobile/scripts/verify-full-system-flow.ts',
      ];
      const forbiddenFragments = [
        'ImaraBogota2026',
        'recuperador.bogota@imara.org',
        'Password123!@#',
        'GeneradorPassword123!@#',
        'RecicladorPassword123!@#',
      ];

      for (const file of files) {
        const content = readRepoFile(file);
        for (const fragment of forbiddenFragments) {
          expect(content, `${file} contiene una credencial demo conocida`).not.toContain(fragment);
        }
      }

      const resetScript = readRepoFile('apps/api/scripts/reset-db-for-eval.ts');
      expect(resetScript).not.toContain('admin@datacircular.com');
    });
  });
});
