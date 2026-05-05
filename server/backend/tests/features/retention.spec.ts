import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { sha256 } from "../helpers/hash.js";
import { createTestToken, testPublicKey } from "../helpers/testKeys.js";
import { disconnectDatabase, resetDatabase, prisma } from "../helpers/db.js";

const api = request(createApp());

describe.sequential("Retention admin", () => {
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

  it("requires admin role", async () => {
    const token = createTestToken({ vaultId });

    await api
      .get(`/api/v1/vaults/${vaultId}/admin/retention`)
      .set("Authorization", `Bearer ${token}`)
      .expect(403);
  });

  it("updates retention settings", async () => {
    const token = createTestToken({ vaultId, role: "admin" });

    const res = await api
      .put(`/api/v1/vaults/${vaultId}/admin/retention`)
      .set("Authorization", `Bearer ${token}`)
      .send({ retentionDays: 7 })
      .expect(200);

    expect(res.body).toMatchObject({ retentionDays: 7 });
  });

  it("prunes old versions and conflicts", async () => {
    const token = createTestToken({ vaultId, role: "admin" });

    await api
      .post(`/api/v1/vaults/${vaultId}/files`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        path: "work/retention.md",
        content: "first",
        contentHash: sha256("first"),
        baseHash: null
      })
      .expect(201);

    await api
      .post(`/api/v1/vaults/${vaultId}/files`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        path: "work/retention.md",
        content: "second",
        contentHash: sha256("second"),
        baseHash: "deadbeef"
      })
      .expect(409);

    const oldDate = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000);
    await prisma.vaultEntryVersion.updateMany({
      data: { createdAt: oldDate }
    });
    await prisma.vaultConflict.updateMany({
      data: { createdAt: oldDate }
    });

    await api
      .put(`/api/v1/vaults/${vaultId}/admin/retention`)
      .set("Authorization", `Bearer ${token}`)
      .send({ retentionDays: 14 })
      .expect(200);

    const res = await api
      .post(`/api/v1/vaults/${vaultId}/admin/retention/run`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(res.body).toMatchObject({
      retentionDays: 14,
      versionsDeleted: 1,
      conflictsDeleted: 1
    });
  });
});
