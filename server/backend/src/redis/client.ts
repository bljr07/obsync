import { createClient } from "redis";
import { getConfig } from "../config.js";

export function createRedisClient() {
  const config = getConfig();
  const isTest = process.env.NODE_ENV === "test";
  return createClient({
    url: config.redisUrl,
    socket: isTest
      ? {
          connectTimeout: 5000,
          reconnectStrategy: () => new Error("Redis unavailable")
        }
      : undefined
  });
}
