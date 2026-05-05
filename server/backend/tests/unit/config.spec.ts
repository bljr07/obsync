import { afterEach, describe, expect, it } from "vitest";
import { getConfig } from "../../src/config.js";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("config", () => {
  it("uses defaults and normalizes jwt public key", () => {
    process.env.JWT_PUBLIC_KEY = "line1\\nline2";
    process.env.PORT = "4000";

    const config = getConfig();

    expect(config.port).toBe(4000);
    expect(config.jwtIssuer).toBe("obsync");
    expect(config.jwtAudience).toBe("obsync");
    expect(config.jwtPublicKey).toBe("line1\nline2");
  });
});
