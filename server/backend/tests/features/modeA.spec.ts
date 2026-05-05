import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { sha256 } from "../helpers/hash.js";
import { createTestToken, testPublicKey } from "../helpers/testKeys.js";
import { disconnectDatabase, resetDatabase } from "../helpers/db.js";

describe.sequential("Mode A file sync", () => {
  const vaultId = "vault-1";
  const app = createApp();
  const api = request(app);

  beforeAll(() => {
    process.env.JWT_PUBLIC_KEY = testPublicKey;
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await disconnectDatabase();
  });

  it("uploads new file and fetches it", async () => {
    const token = createTestToken({ vaultId });
    const path = "work/notes.md";
    const content = "# Hello";
    const contentHash = sha256(content);

    const uploadRes = await api
      .post(`/api/v1/vaults/${vaultId}/files`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        path,
        content,
        contentHash,
        baseHash: null
      })
      .expect(201);

    expect(uploadRes.body).toMatchObject({
      path,
      hash: contentHash
    });

    const downloadRes = await api
      .get(`/api/v1/vaults/${vaultId}/files/content`)
      .query({ path })
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(downloadRes.body).toMatchObject({
      path,
      content,
      hash: contentHash
    });
  });

  it("rejects stale baseHash with latest hash", async () => {
    const token = createTestToken({ vaultId });
    const path = "work/conflict.md";
    const initial = "first";
    const initialHash = sha256(initial);

    await api
      .post(`/api/v1/vaults/${vaultId}/files`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        path,
        content: initial,
        contentHash: initialHash,
        baseHash: null
      })
      .expect(201);

    const next = "second";
    const nextHash = sha256(next);

    const conflictRes = await api
      .post(`/api/v1/vaults/${vaultId}/files`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        path,
        content: next,
        contentHash: nextHash,
        baseHash: "deadbeef"
      })
      .expect(409);

    expect(conflictRes.body).toMatchObject({
      error: "HASH_MISMATCH",
      latestHash: initialHash
    });
  });

  it("updates file when baseHash matches", async () => {
    const token = createTestToken({ vaultId });
    const path = "work/update.md";
    const initial = "v1";
    const initialHash = sha256(initial);

    await api
      .post(`/api/v1/vaults/${vaultId}/files`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        path,
        content: initial,
        contentHash: initialHash,
        baseHash: null
      })
      .expect(201);

    const updated = "v2";
    const updatedHash = sha256(updated);

    const updateRes = await api
      .post(`/api/v1/vaults/${vaultId}/files`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        path,
        content: updated,
        contentHash: updatedHash,
        baseHash: initialHash
      })
      .expect(200);

    expect(updateRes.body).toMatchObject({
      path,
      hash: updatedHash
    });
  });
});
