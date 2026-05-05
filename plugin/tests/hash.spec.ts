import { describe, expect, it } from "vitest";
import { webcrypto } from "crypto";
import { sha256Hex } from "../src/utils/hash.js";

if (!globalThis.crypto) {
  // Ensure Web Crypto is available in test environment.
  globalThis.crypto = webcrypto as Crypto;
}

describe("hash utils", () => {
  it("computes sha256 hex", async () => {
    const hash = await sha256Hex("abc");
    expect(hash).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
});
