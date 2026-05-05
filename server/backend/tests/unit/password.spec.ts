import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "../../src/auth/password.js";

describe("password hashing", () => {
  it("hashes and verifies passwords", async () => {
    const hash = await hashPassword("secret");
    await expect(verifyPassword("secret", hash)).resolves.toBe(true);
    await expect(verifyPassword("nope", hash)).resolves.toBe(false);
  });
});
