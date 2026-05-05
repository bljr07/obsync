import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { sha256 } from "../helpers/hash.js";
import { createTestToken, testPublicKey } from "../helpers/testKeys.js";
import { disconnectDatabase, resetDatabase } from "../helpers/db.js";

describe.sequential("Batch sync", () => {
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

  it("uploads and downloads files in batches", async () => {
    const token = createTestToken({ vaultId });

    const uploadRes = await api
      .post(`/api/v1/vaults/${vaultId}/batch/upload`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        files: [
          {
            path: "work/batch-a.md",
            content: "a",
            contentHash: sha256("a"),
            baseHash: null
          },
          {
            path: "work/batch-b.md",
            content: "b",
            contentHash: sha256("b"),
            baseHash: null
          }
        ]
      })
      .expect(200);

    expect(uploadRes.body.results).toEqual([
      { path: "work/batch-a.md", status: "created", hash: sha256("a") },
      { path: "work/batch-b.md", status: "created", hash: sha256("b") }
    ]);

    const downloadRes = await api
      .post(`/api/v1/vaults/${vaultId}/batch/download`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        paths: ["work/batch-a.md", "work/missing.md"]
      })
      .expect(200);

    expect(downloadRes.body.results).toEqual([
      { path: "work/batch-a.md", content: "a", hash: sha256("a") },
      { path: "work/missing.md", error: "NOT_FOUND" }
    ]);
  });

  it("returns conflicts for stale baseHash", async () => {
    const token = createTestToken({ vaultId });

    await api
      .post(`/api/v1/vaults/${vaultId}/files`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        path: "work/conflict.md",
        content: "initial",
        contentHash: sha256("initial"),
        baseHash: null
      })
      .expect(201);

    const res = await api
      .post(`/api/v1/vaults/${vaultId}/batch/upload`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        files: [
          {
            path: "work/conflict.md",
            content: "next",
            contentHash: sha256("next"),
            baseHash: "deadbeef"
          }
        ]
      })
      .expect(207);

    expect(res.body.results).toEqual([
      {
        path: "work/conflict.md",
        status: "conflict",
        latestHash: sha256("initial")
      }
    ]);
  });
});
