import { describe, expect, it, vi } from "vitest";

const client = {
  connect: vi.fn().mockResolvedValue(undefined),
  quit: vi.fn().mockResolvedValue(undefined)
};

vi.mock("../../src/redis/client.js", () => ({
  createRedisClient: () => client
}));

import { withRedis } from "../../src/redis/withRedis.js";

describe("withRedis", () => {
  it("connects and quits around the callback", async () => {
    const result = await withRedis(async (redis) => {
      expect(redis).toBe(client);
      return "ok";
    });

    expect(result).toBe("ok");
    expect(client.connect).toHaveBeenCalled();
    expect(client.quit).toHaveBeenCalled();
  });

  it("quits even when callback fails", async () => {
    await expect(withRedis(async () => {
      throw new Error("boom");
    })).rejects.toThrow("boom");

    expect(client.quit).toHaveBeenCalled();
  });
});
