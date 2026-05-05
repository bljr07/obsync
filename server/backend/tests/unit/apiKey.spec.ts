import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  findActiveApiKeyByHash: vi.fn(),
  touchApiKeyLastUsed: vi.fn()
}));

vi.mock("../../src/db/apiKeyRepo.js", () => prismaMock);

import { generateApiKey, hashApiKey, verifyApiKey } from "../../src/auth/apiKey.js";

describe("api key auth", () => {
  beforeEach(() => {
    prismaMock.findActiveApiKeyByHash.mockReset();
    prismaMock.touchApiKeyLastUsed.mockReset();
  });

  it("generates api key with prefix", () => {
    const key = generateApiKey();
    expect(key.startsWith("obsync_")).toBe(true);
    expect(key.length).toBeGreaterThan(10);
  });

  it("hashes api keys deterministically", () => {
    const hash = hashApiKey("obsync_test");
    expect(hash).toBe(hashApiKey("obsync_test"));
  });

  it("verifies api keys and updates last used", async () => {
    prismaMock.findActiveApiKeyByHash.mockResolvedValue({
      id: "key-1",
      vaultId: "vault-1",
      role: "client"
    });
    prismaMock.touchApiKeyLastUsed.mockResolvedValue({});

    const result = await verifyApiKey("obsync_token");

    expect(result).toEqual({
      vaultId: "vault-1",
      role: "client",
      apiKeyId: "key-1"
    });

    expect(prismaMock.touchApiKeyLastUsed).toHaveBeenCalledWith("key-1");
  });

  it("rejects missing api keys", async () => {
    prismaMock.findActiveApiKeyByHash.mockResolvedValue(null);

    await expect(verifyApiKey("missing")).rejects.toThrow("API key not found");
  });
});
