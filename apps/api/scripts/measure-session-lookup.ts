import { randomUUID } from 'crypto';
import { performance } from 'perf_hooks';
import { prisma } from '../src/database/prisma';

/**
 * Mide la latencia de la consulta que hace el middleware en cada petición:
 * buscar una sesión activa por id, sin revocar y no expirada.
 *
 * Uso: npx tsx scripts/measure-session-lookup.ts [iteraciones]
 * La URL de la base se toma del entorno; nunca se imprime.
 */
async function main() {
  const iterations = Number(process.argv[2] ?? 2000);
  if (!Number.isFinite(iterations) || iterations < 100) {
    throw new Error('El número de iteraciones debe ser al menos 100');
  }

  let session = await prisma.userSession.findFirst({
    where: { revokedAt: null, expiresAt: { gt: new Date() } },
    select: { id: true, userId: true },
  });
  let temporaryUserId: string | null = null;

  if (!session) {
    temporaryUserId = randomUUID();
    const sessionId = randomUUID();
    await prisma.user.create({
      data: {
        id: temporaryUserId,
        fullName: 'Benchmark sesión',
        email: `benchmark.sesion.${temporaryUserId}@invalid.test`,
        passwordHash: 'benchmark-no-login',
      },
    });
    await prisma.userSession.create({
      data: {
        id: sessionId,
        userId: temporaryUserId,
        refreshTokenHash: '0'.repeat(64),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });
    session = { id: sessionId, userId: temporaryUserId };
  }

  const samples: number[] = [];
  for (let i = 0; i < iterations; i += 1) {
    const started = performance.now();
    await prisma.userSession.findFirst({
      where: {
        id: session.id,
        userId: session.userId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: { id: true },
    });
    samples.push(performance.now() - started);
  }

  samples.sort((a, b) => a - b);
  const p95 = samples[Math.min(samples.length - 1, Math.floor(samples.length * 0.95))];
  const mean = samples.reduce((sum, value) => sum + value, 0) / samples.length;

  console.log(
    JSON.stringify({
      iterations,
      p95Ms: Number(p95.toFixed(4)),
      meanMs: Number(mean.toFixed(4)),
      minMs: Number(samples[0].toFixed(4)),
      maxMs: Number(samples[samples.length - 1].toFixed(4)),
    })
  );

  if (temporaryUserId) {
    await prisma.userSession.deleteMany({ where: { userId: temporaryUserId } });
    await prisma.user.delete({ where: { id: temporaryUserId } });
  }
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error('ERR:', error instanceof Error ? error.message : String(error));
  await prisma.$disconnect();
  process.exit(1);
});
