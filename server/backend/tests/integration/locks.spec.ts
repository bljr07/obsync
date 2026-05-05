import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createRedisClient } from "../../src/redis/client.js";
import { acquireLock, refreshLock, releaseLock } from "../../src/redis/locks.js";
import { purgeRedis } from "../helpers/redis.js";

describe.sequential("Redis locks", () => {
  let redis: ReturnType<typeof createRedisClient>;

  beforeAll(async () => {
    redis = createRedisClient();
    await redis.connect();
  });

  beforeEach(async () => {
    await purgeRedis();
  });

  afterAll(async () => {
    await redis.quit();
  });

  it("acquires, refreshes, and releases a lock", async () => {
    const acquire = await acquireLock(redis, "vault-1", "work/a.md", 1, "client-1");
    expect(acquire).toMatchObject({ status: "granted" });

    const refresh = await refreshLock(redis, "vault-1", "work/a.md", 1, "client-1");
    expect(refresh).toMatchObject({ status: "refreshed" });

    const release = await releaseLock(redis, "vault-1", "work/a.md", 1, "client-1");
    expect(release).toMatchObject({ status: "released" });
  });
});
