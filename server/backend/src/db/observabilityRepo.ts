import { getPrismaClient } from "./prisma.js";

const prisma = getPrismaClient();

export async function getMetrics(vaultId: string) {
  const [totalFiles, totalVersions, entries] = await Promise.all([
    prisma.vaultEntry.count({ where: { vaultId } }),
    prisma.vaultEntryVersion.count({ where: { vaultId } }),
    prisma.vaultEntry.findMany({ where: { vaultId }, select: { content: true } })
  ]);

  const totalBytes = entries.reduce(
    (sum, entry) => sum + Buffer.byteLength(entry.content, "utf8"),
    0
  );

  return {
    totalFiles,
    totalVersions,
    totalBytes
  };
}

export async function listConflicts(vaultId: string, limit: number) {
  return prisma.vaultConflict.findMany({
    where: { vaultId },
    orderBy: { createdAt: "desc" },
    take: limit
  });
}

export async function recordSyncLog(input: {
  vaultId: string;
  path?: string | null;
  action: string;
  message: string;
}) {
  return prisma.vaultSyncLog.create({
    data: {
      vaultId: input.vaultId,
      path: input.path ?? null,
      action: input.action,
      message: input.message
    }
  });
}

export async function listSyncLogs(vaultId: string, limit: number, prefix?: string) {
  return prisma.vaultSyncLog.findMany({
    where: {
      vaultId,
      path: prefix
        ? {
            startsWith: prefix
          }
        : undefined
    },
    orderBy: { createdAt: "desc" },
    take: limit
  });
}
