import { beforeAll, describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { createTestToken, testPublicKey } from "../helpers/testKeys.js";

describe.sequential("Auth guard", () => {
  const app = createApp();
  const api = request(app);

  beforeAll(() => {
    process.env.JWT_PUBLIC_KEY = testPublicKey;
  });

  it("rejects missing bearer token", async () => {
    await api.get("/api/v1/vaults/vault-1/files").expect(401);
  });

  it("rejects vault mismatch", async () => {
    const token = createTestToken({ vaultId: "vault-2" });

    const res = await api
      .get("/api/v1/vaults/vault-1/files")
      .set("Authorization", `Bearer ${token}`)
      .expect(403);

    expect(res.body).toMatchObject({ error: "FORBIDDEN" });
  });

  it("accepts API key via header", async () => {
    const adminToken = createTestToken({ role: "admin" });
    const created = await api
      .post("/api/v1/vaults/vault-1/admin/api-keys")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "test-key", role: "client" })
      .expect(201);

    const apiKey = created.body.apiKey as string;

    await api
      .get("/api/v1/vaults/vault-1/files")
      .set("X-API-Key", apiKey)
      .expect(200);
  });

  it("accepts ApiKey scheme in Authorization header", async () => {
    const adminToken = createTestToken({ role: "admin" });
    const created = await api
      .post("/api/v1/vaults/vault-1/admin/api-keys")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "scheme-key", role: "client" })
      .expect(201);

    const apiKey = created.body.apiKey as string;

    await api
      .get("/api/v1/vaults/vault-1/files")
      .set("Authorization", `ApiKey ${apiKey}`)
      .expect(200);
  });

  it("rejects invalid auth scheme", async () => {
    await api
      .get("/api/v1/vaults/vault-1/files")
      .set("Authorization", "Basic abc123")
      .expect(401);
  });

  it("rejects non-admin API key on admin routes", async () => {
    const adminToken = createTestToken({ role: "admin" });
    const created = await api
      .post("/api/v1/vaults/vault-1/admin/api-keys")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "client-key", role: "client" })
      .expect(201);

    const apiKey = created.body.apiKey as string;

    await api
      .get("/api/v1/vaults/vault-1/admin/api-keys")
      .set("X-API-Key", apiKey)
      .expect(403);
  });
});
