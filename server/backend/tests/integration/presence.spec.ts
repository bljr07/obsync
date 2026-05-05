import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createRedisClient } from "../../src/redis/client.js";
import { heartbeatPresence } from "../../src/redis/presence.js";
import { purgeRedis } from "../helpers/redis.js";

describe.sequential("Redis presence", () => {
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

  it("counts active clients for a file", async () => {
    const count1 = await heartbeatPresence(redis, "vault-1", "work/a.md", "client-1");
    expect(count1).toBe(1);

    const count2 = await heartbeatPresence(redis, "vault-1", "work/a.md", "client-2");
    expect(count2).toBe(2);
  });
});
