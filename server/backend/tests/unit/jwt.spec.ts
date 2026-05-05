import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { verifyToken } from "../../src/auth/jwt.js";
import { createTestToken, testPublicKey } from "../helpers/testKeys.js";

describe("jwt verification", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.JWT_ISSUER = "obsync";
    process.env.JWT_AUDIENCE = "obsync";
    process.env.JWT_PUBLIC_KEY = testPublicKey;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("verifies a valid token and returns claims", () => {
    const token = createTestToken({ userId: "user-1", vaultId: "vault-1" });
    const payload = verifyToken(token);

    expect(payload).toMatchObject({
      userId: "user-1",
      vaultId: "vault-1"
    });
  });

  it("throws when public key is missing", () => {
    process.env.JWT_PUBLIC_KEY = "";
    expect(() => verifyToken("invalid")).toThrow();
  });
});
