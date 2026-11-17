import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

type Env = Record<string, string | undefined>;

function readTerminalLine(question: string, hidden: boolean): Promise<string> {
  return new Promise((resolve, reject) => {
    const stdin = process.stdin;
    const stdout = process.stdout;

    if (!stdin.isTTY || typeof stdin.setRawMode !== 'function') {
      reject(
        new Error(
          'La entrada interactiva requiere una terminal. Define ADMIN_BOOTSTRAP_EMAIL y ADMIN_BOOTSTRAP_PASSWORD.'
        )
      );
      return;
    }

    stdout.write(question);
    const wasRaw = Boolean(stdin.isRaw);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');

    let value = '';

    const cleanup = () => {
      stdin.removeListener('data', onData);
      stdin.setRawMode(wasRaw);
      stdin.pause();
    };

    const onData = (chunk: string) => {
      for (const character of chunk) {
        if (character === '\r' || character === '\n') {
          cleanup();
          stdout.write('\n');
          resolve(value);
          return;
        }
        if (character === '\u0003') {
          cleanup();
          stdout.write('\n');
          reject(new Error('Entrada cancelada por el usuario'));
          return;
        }
        if (character === '\u007f' || character === '\b') {
          if (value.length > 0) {
            value = value.slice(0, -1);
            if (!hidden) stdout.write('\b \b');
          }
          continue;
        }
        value += character;
        if (!hidden) stdout.write(character);
      }
    };

    stdin.on('data', onData);
  });
}

async function gatherCredentials(environment: Env) {
  const { getBootstrapCredentialsFromEnv } = await import('../src/modules/admin/admin-bootstrap');
  const fromEnvironment = getBootstrapCredentialsFromEnv(environment);
  if (fromEnvironment) {
    return fromEnvironment;
  }

  console.log('No se detectaron ADMIN_BOOTSTRAP_EMAIL/ADMIN_BOOTSTRAP_PASSWORD; se solicitarán por terminal.');
  const email = (await readTerminalLine('Correo del administrador: ', false)).trim();
  const password = await readTerminalLine('Contraseña (no se mostrará): ', true);
  const confirmation = await readTerminalLine('Confirma la contraseña: ', true);

  if (password !== confirmation) {
    throw new Error('Las contraseñas no coinciden');
  }

  const fullName =
    (await readTerminalLine('Nombre completo [Administrador General DATA_CIRCULAR]: ', false)).trim() ||
    'Administrador General DATA_CIRCULAR';
  const phone = (await readTerminalLine('Teléfono (opcional): ', false)).trim();

  return { email, password, fullName, phone };
}

async function main(): Promise<void> {
  const { assertAdminBootstrapAllowed, bootstrapAdministrator } = await import(
    '../src/modules/admin/admin-bootstrap'
  );

  assertAdminBootstrapAllowed(process.env);

  const credentials = await gatherCredentials(process.env);
  const { prisma } = await import('../src/database/prisma');

  try {
    const result = await prisma.$transaction((tx) => bootstrapAdministrator(credentials, tx));

    console.log('✅ Administrador inicial creado correctamente.');
    console.log(`   Correo: ${result.email}`);
    console.log(`   ID de usuario: ${result.userId}`);
    console.log(`   Evento AuditLog: ${result.auditLogId}`);
    console.log('   La contraseña no se imprimió ni quedó registrada en la auditoría.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Error desconocido';
  console.error(`❌ No se pudo crear el administrador: ${message}`);
  process.exit(1);
});
