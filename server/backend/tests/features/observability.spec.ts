import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { sha256 } from "../helpers/hash.js";
import { createTestToken, testPublicKey } from "../helpers/testKeys.js";
import { disconnectDatabase, resetDatabase } from "../helpers/db.js";
import { purgeRedis } from "../helpers/redis.js";
import { createRedisClient } from "../../src/redis/client.js";
import { heartbeatPresence } from "../../src/redis/presence.js";

const api = request(createApp());

describe.sequential("Observability", () => {
  const vaultId = "vault-1";

  beforeAll(() => {
    process.env.JWT_PUBLIC_KEY = testPublicKey;
  });

  beforeEach(async () => {
    await resetDatabase();
    await purgeRedis();
  });

  afterAll(async () => {
    await disconnectDatabase();
  });

  it("returns metrics for a vault", async () => {
    const token = createTestToken({ vaultId });

    await api
      .post(`/api/v1/vaults/${vaultId}/files`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        path: "work/a.md",
        content: "alpha",
        contentHash: sha256("alpha"),
        baseHash: null
      })
      .expect(201);

    await api
      .post(`/api/v1/vaults/${vaultId}/files`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        path: "work/b.md",
        content: "beta",
        contentHash: sha256("beta"),
        baseHash: null
      })
      .expect(201);

    const res = await api
      .get(`/api/v1/vaults/${vaultId}/observability/metrics`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(res.body).toMatchObject({
      totalFiles: 2,
      totalVersions: 2,
      totalBytes: "alpha".length + "beta".length
    });
  });

  it("records and returns conflict history", async () => {
    const token = createTestToken({ vaultId });

    await api
      .post(`/api/v1/vaults/${vaultId}/files`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        path: "work/conflict.md",
        content: "first",
        contentHash: sha256("first"),
        baseHash: null
      })
      .expect(201);

    await api
      .post(`/api/v1/vaults/${vaultId}/files`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        path: "work/conflict.md",
        content: "second",
        contentHash: sha256("second"),
        baseHash: "deadbeef"
      })
      .expect(409);

    const res = await api
      .get(`/api/v1/vaults/${vaultId}/observability/conflicts`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0]).toMatchObject({
      path: "work/conflict.md",
      baseHash: "deadbeef"
    });
  });

  it("returns active presence counts", async () => {
    const token = createTestToken({ vaultId });

    const redis = createRedisClient();
    await redis.connect();

    await heartbeatPresence(redis, vaultId, "work/live.md", "client-1");
    await heartbeatPresence(redis, vaultId, "work/live.md", "client-2");
    await heartbeatPresence(redis, vaultId, "work/solo.md", "client-3");

    await redis.quit();

    const res = await api
      .get(`/api/v1/vaults/${vaultId}/observability/presence`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(res.body.items).toEqual([
      { path: "work/live.md", activeCount: 2 },
      { path: "work/solo.md", activeCount: 1 }
    ]);
  });

  it("returns sync logs", async () => {
    const token = createTestToken({ vaultId });
    const path = "work/log.md";

    await api
      .post(`/api/v1/vaults/${vaultId}/files`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        path,
        content: "alpha",
        contentHash: sha256("alpha"),
        baseHash: null
      })
      .expect(201);

    await api
      .get(`/api/v1/vaults/${vaultId}/files/content`)
      .query({ path })
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    const res = await api
      .get(`/api/v1/vaults/${vaultId}/observability/logs`)
      .query({ limit: 5 })
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    const actions = res.body.items.map((item: { action: string }) => item.action);
    expect(actions).toContain("created");
    expect(actions).toContain("read");
  });
});
