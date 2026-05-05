import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ensureBootstrapAdmin } from "../../src/auth/bootstrap.js";
import { disconnectDatabase, resetDatabase } from "../helpers/db.js";
import { findUserByUsername } from "../../src/db/userRepo.js";

process.env.BOOTSTRAP_ADMIN_USERNAME = "admin";

describe.sequential("bootstrap admin", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await disconnectDatabase();
  });

  it("creates a default admin once", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);

    const first = await ensureBootstrapAdmin();
    expect(first.created).toBe(true);

    const user = await findUserByUsername("admin");
    expect(user).toBeTruthy();

    const second = await ensureBootstrapAdmin();
    expect(second.created).toBe(false);

    logSpy.mockRestore();
  });
});
