import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  vaultApiKey: {
    findFirst: vi.fn(),
    update: vi.fn()
  }
}));

vi.mock("../../src/db/prisma.js", () => ({
  getPrismaClient: () => prismaMock
}));

import { generateApiKey, hashApiKey, verifyApiKey } from "../../src/auth/apiKey.js";

describe("api key auth", () => {
  beforeEach(() => {
    prismaMock.vaultApiKey.findFirst.mockReset();
    prismaMock.vaultApiKey.update.mockReset();
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
    prismaMock.vaultApiKey.findFirst.mockResolvedValue({
      id: "key-1",
      vaultId: "vault-1",
      role: "client"
    });
    prismaMock.vaultApiKey.update.mockResolvedValue({});

    const result = await verifyApiKey("obsync_token");

    expect(result).toEqual({
      vaultId: "vault-1",
      role: "client",
      apiKeyId: "key-1"
    });

    expect(prismaMock.vaultApiKey.update).toHaveBeenCalledWith({
      where: { id: "key-1" },
      data: { lastUsedAt: expect.any(Date) }
    });
  });

  it("rejects missing api keys", async () => {
    prismaMock.vaultApiKey.findFirst.mockResolvedValue(null);

    await expect(verifyApiKey("missing")).rejects.toThrow("API key not found");
  });
});
