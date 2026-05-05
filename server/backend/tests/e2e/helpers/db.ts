import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient();

export async function resetDatabase() {
  await prisma.vaultSettings.deleteMany();
  await prisma.vaultConflict.deleteMany();
  await prisma.vaultEntryVersion.deleteMany();
  await prisma.vaultEntry.deleteMany();
  await prisma.vaultSyncLog.deleteMany();
  await prisma.vaultApiKey.deleteMany();
  await prisma.user.deleteMany();
}

export async function disconnectDatabase() {
  await prisma.$disconnect();
}
