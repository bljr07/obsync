import { createRedisClient } from "./client.js";

export async function withRedis<T>(fn: (client: any) => Promise<T>) {
  const client = createRedisClient();
  await client.connect();

  try {
    return await fn(client);
  } finally {
    await client.quit();
  }
}
