import { prisma } from '../src/database/prisma';
import { accountDeletionService } from '../src/modules/account-deletion/account-deletion.service';

/**
 * Tarea programada de purga. Debe invocarse desde cron/Kubernetes Job:
 *   npm --workspace=apps/api run account:purge
 */
async function main() {
  const purged = await accountDeletionService.purgeDeletedAccounts();
  console.log(JSON.stringify({ purgedAccounts: purged, executedAt: new Date().toISOString() }));
}

main()
  .catch((error: unknown) => {
    console.error('[purge] Error:', error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
