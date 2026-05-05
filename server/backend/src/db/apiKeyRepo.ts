import { getPrismaClient } from "./prisma.js";
import { generateApiKey, hashApiKey } from "../auth/apiKey.js";

const prisma = getPrismaClient();

type CreateKeyOptions = {
  vaultId: string;
  name: string;
  role: string;
};

export async function createApiKey(options: CreateKeyOptions) {
  const apiKey = generateApiKey();
  const keyHash = hashApiKey(apiKey);
  const prefix = apiKey.slice(0, 12);

  const record = await prisma.vaultApiKey.create({
    data: {
      vaultId: options.vaultId,
      name: options.name,
      role: options.role,
      keyHash,
      prefix
    }
  });

  return {
    id: record.id,
    vaultId: record.vaultId,
    name: record.name,
    role: record.role,
    prefix: record.prefix,
    createdAt: record.createdAt,
    apiKey
  };
}

export async function listApiKeys(vaultId: string) {
  return prisma.vaultApiKey.findMany({
    where: { vaultId },
    orderBy: { createdAt: "desc" }
  });
}

export async function revokeApiKey(vaultId: string, id: string) {
  return prisma.vaultApiKey.updateMany({
    where: { id, vaultId, revokedAt: null },
    data: { revokedAt: new Date() }
  });
}

export async function findActiveApiKeyByHash(keyHash: string) {
  return prisma.vaultApiKey.findFirst({
    where: {
      keyHash,
      revokedAt: null
    }
  });
}

export async function touchApiKeyLastUsed(id: string) {
  return prisma.vaultApiKey.update({
    where: { id },
    data: { lastUsedAt: new Date() }
  });
}
