import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { createTestToken, testPublicKey } from "../helpers/testKeys.js";
import { disconnectDatabase, resetDatabase } from "../helpers/db.js";

const api = request(createApp());

describe.sequential("API key management", () => {
  const vaultId = "vault-1";

  beforeAll(() => {
    process.env.JWT_PUBLIC_KEY = testPublicKey;
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await disconnectDatabase();
  });

  it("creates and lists API keys", async () => {
    const token = createTestToken({ vaultId, role: "admin" });

    const createRes = await api
      .post(`/api/v1/vaults/${vaultId}/admin/api-keys`)
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "plugin", role: "client" })
      .expect(201);

    expect(createRes.body).toMatchObject({
      name: "plugin",
      role: "client"
    });
    expect(createRes.body.apiKey).toBeTypeOf("string");

    const listRes = await api
      .get(`/api/v1/vaults/${vaultId}/admin/api-keys`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(listRes.body.items).toHaveLength(1);
    expect(listRes.body.items[0]).toMatchObject({
      name: "plugin",
      role: "client"
    });
  });

  it("revokes API keys", async () => {
    const token = createTestToken({ vaultId, role: "admin" });

    const createRes = await api
      .post(`/api/v1/vaults/${vaultId}/admin/api-keys`)
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "revoked", role: "client" })
      .expect(201);

    await api
      .post(`/api/v1/vaults/${vaultId}/admin/api-keys/${createRes.body.id}/revoke`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    const listRes = await api
      .get(`/api/v1/vaults/${vaultId}/admin/api-keys`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(listRes.body.items[0].revokedAt).toBeTypeOf("string");
  });

  it("authenticates using API key", async () => {
    const adminToken = createTestToken({ vaultId, role: "admin" });

    const createRes = await api
      .post(`/api/v1/vaults/${vaultId}/admin/api-keys`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "plugin", role: "client" })
      .expect(201);

    const apiKey = createRes.body.apiKey as string;

    await api
      .get(`/api/v1/vaults/${vaultId}/files`)
      .set("X-API-Key", apiKey)
      .expect(200);
  });
});
