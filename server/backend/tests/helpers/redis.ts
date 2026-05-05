import { createRedisClient } from "../../src/redis/client.js";

const CONNECT_TIMEOUT_MS = 5000;

async function connectWithTimeout(client: { connect: () => Promise<void> }) {
  await Promise.race([
    client.connect(),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Redis connect timeout")), CONNECT_TIMEOUT_MS)
    )
  ]);
}

export async function purgeRedis(prefix = "obsync:") {
  const client = createRedisClient();
  await connectWithTimeout(client);

  if (prefix === "obsync:") {
    await client.flushDb();
  } else {
    let cursor = "0";
    const keysToDelete: string[] = [];

    do {
      const reply = await client.scan(cursor, {
        MATCH: `${prefix}*`,
        COUNT: 100
      });

      const nextCursor = Array.isArray(reply) ? reply[0] : reply.cursor;
      const keys = Array.isArray(reply) ? reply[1] : reply.keys;

      keysToDelete.push(...keys);
      cursor = nextCursor;
    } while (cursor !== "0");

    if (keysToDelete.length > 0) {
      await client.del(keysToDelete);
    }
  }

  await client.quit();
}
