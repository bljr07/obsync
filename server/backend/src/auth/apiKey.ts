import { createHash, randomBytes } from "crypto";
import { findActiveApiKeyByHash, touchApiKeyLastUsed } from "../db/apiKeyRepo.js";

export function generateApiKey() {
  const raw = randomBytes(32).toString("base64url");
  return `obsync_${raw}`;
}

export function hashApiKey(apiKey: string) {
  return createHash("sha256").update(apiKey, "utf8").digest("hex");
}

export async function verifyApiKey(apiKey: string) {
  const keyHash = hashApiKey(apiKey);

  const record = await findActiveApiKeyByHash(keyHash);
  if (!record) {
    throw new Error("API key not found");
  }

  await touchApiKeyLastUsed(record.id);

  return {
    vaultId: record.vaultId,
    role: record.role,
    apiKeyId: record.id
  };
}
