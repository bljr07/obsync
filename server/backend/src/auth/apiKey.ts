import { createHash, randomBytes } from "crypto";
import { getPrismaClient } from "../db/prisma.js";

const prisma = getPrismaClient();

export function generateApiKey() {
  const raw = randomBytes(32).toString("base64url");
  return `obsync_${raw}`;
}

export function hashApiKey(apiKey: string) {
  return createHash("sha256").update(apiKey, "utf8").digest("hex");
}

export async function verifyApiKey(apiKey: string) {
  const keyHash = hashApiKey(apiKey);

  const record = await prisma.vaultApiKey.findFirst({
    where: {
      keyHash,
      revokedAt: null
    }
  });

  if (!record) {
    throw new Error("API key not found");
  }

  await prisma.vaultApiKey.update({
    where: { id: record.id },
    data: { lastUsedAt: new Date() }
  });

  return {
    vaultId: record.vaultId,
    role: record.role,
    apiKeyId: record.id
  };
}
