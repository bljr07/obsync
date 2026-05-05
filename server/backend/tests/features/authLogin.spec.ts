import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { disconnectDatabase, resetDatabase } from "../helpers/db.js";
import { testPrivateKey, testPublicKey } from "../helpers/testKeys.js";
import { createUser, findUserByUsername } from "../../src/db/userRepo.js";
import { hashPassword } from "../../src/auth/password.js";
import { ensureBootstrapAdmin } from "../../src/auth/bootstrap.js";

function extractCookie(res: request.Response) {
  const setCookie = res.headers["set-cookie"] as unknown as string[] | undefined;
  expect(setCookie?.length).toBeTruthy();
  return setCookie?.[0].split(";")[0] ?? "";
}

describe.sequential("Auth login flow", () => {
  const app = createApp();
  const api = request(app);

  beforeAll(() => {
    process.env.JWT_PUBLIC_KEY = testPublicKey;
    process.env.JWT_PRIVATE_KEY = testPrivateKey;
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await disconnectDatabase();
  });

  it("bootstraps admin when no users exist", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const result = await ensureBootstrapAdmin();

    expect(result.created).toBe(true);
    expect(result.username).toBeTruthy();
    expect(result.password).toBeTruthy();

    const user = await findUserByUsername(result.username);
    expect(user).toBeTruthy();
    expect(user?.mustChangePassword).toBe(true);

    logSpy.mockRestore();
  });

  it("logs in and sets cookie", async () => {
    await createUser({
      username: "admin",
      passwordHash: await hashPassword("pass123"),
      role: "admin",
      mustChangePassword: false
    });

    const res = await api
      .post("/api/v1/auth/login")
      .send({ username: "admin", password: "pass123", vaultId: "vault-1" })
      .expect(200);

    expect(res.body).toMatchObject({ ok: true, mustChangePassword: false });
    expect(extractCookie(res)).toContain("obsync_token=");
  });

  it("uses cookie to access protected routes", async () => {
    await createUser({
      username: "admin",
      passwordHash: await hashPassword("pass123"),
      role: "admin",
      mustChangePassword: false
    });

    const login = await api
      .post("/api/v1/auth/login")
      .send({ username: "admin", password: "pass123", vaultId: "vault-1" })
      .expect(200);

    const cookie = extractCookie(login);

    await api
      .get("/api/v1/vaults/vault-1/files")
      .set("Cookie", cookie)
      .expect(200);
  });

  it("changes password and clears mustChangePassword", async () => {
    await createUser({
      username: "admin",
      passwordHash: await hashPassword("default"),
      role: "admin",
      mustChangePassword: true
    });

    const login = await api
      .post("/api/v1/auth/login")
      .send({ username: "admin", password: "default", vaultId: "vault-1" })
      .expect(200);

    const cookie = extractCookie(login);

    await api
      .post("/api/v1/auth/change-password")
      .set("Cookie", cookie)
      .send({ username: "owner", password: "newpass123" })
      .expect(200);

    const user = await findUserByUsername("owner");
    expect(user?.mustChangePassword).toBe(false);

    await api
      .post("/api/v1/auth/login")
      .send({ username: "owner", password: "newpass123", vaultId: "vault-1" })
      .expect(200);
  });
});

