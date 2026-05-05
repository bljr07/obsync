import { getPrismaClient } from "./prisma.js";

const prisma = getPrismaClient();

export async function getRetentionSettings(vaultId: string) {
  const settings = await prisma.vaultSettings.findUnique({
    where: { vaultId }
  });

  return settings ?? { vaultId, retentionDays: 14, updatedAt: new Date() };
}

export async function upsertRetentionSettings(vaultId: string, retentionDays: number) {
  return prisma.vaultSettings.upsert({
    where: { vaultId },
    update: { retentionDays },
    create: { vaultId, retentionDays }
  });
}

export async function applyRetention(vaultId: string, retentionDays: number) {
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

  const [versions, conflicts] = await prisma.$transaction([
    prisma.vaultEntryVersion.deleteMany({
      where: { vaultId, createdAt: { lt: cutoff } }
    }),
    prisma.vaultConflict.deleteMany({
      where: { vaultId, createdAt: { lt: cutoff } }
    })
  ]);

  return {
    cutoff,
    versionsDeleted: versions.count,
    conflictsDeleted: conflicts.count
  };
}
