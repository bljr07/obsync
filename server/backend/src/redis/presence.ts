const PRESENCE_PREFIX = "obsync:presence";
export const PRESENCE_TTL_SECONDS = 10;

export function presenceKey(vaultId: string, path: string, clientId: string) {
  return `${PRESENCE_PREFIX}:${vaultId}:${path}:${clientId}`;
}

export async function heartbeatPresence(
  redis: {
    set: Function;
    scan: Function;
  },
  vaultId: string,
  path: string,
  clientId: string
) {
  const key = presenceKey(vaultId, path, clientId);
  try {
    await redis.set(key, "1", { EX: PRESENCE_TTL_SECONDS });
  } catch (error) {
    return 0;
  }

  let cursor = "0";
  let count = 0;

  try {
    do {
      const reply = await redis.scan(cursor, {
        MATCH: `${PRESENCE_PREFIX}:${vaultId}:${path}:*`,
        COUNT: 100
      });

      const nextCursor = Array.isArray(reply) ? reply[0] : reply.cursor;
      const keys = Array.isArray(reply) ? reply[1] : reply.keys;

      count += keys.length;
      cursor = String(nextCursor);
    } while (cursor !== "0");
  } catch (error) {
    return 0;
  }

  return count;
}

export async function listPresence(
  redis: {
    scan: Function;
  },
  vaultId: string,
  prefix?: string
) {
  const match = prefix
    ? `${PRESENCE_PREFIX}:${vaultId}:${prefix}*`
    : `${PRESENCE_PREFIX}:${vaultId}:*`;

  const counts = new Map<string, number>();
  let cursor = "0";

  do {
    const reply = await redis.scan(cursor, {
      MATCH: match,
      COUNT: 200
    });

    const nextCursor = Array.isArray(reply) ? reply[0] : reply.cursor;
    const keys = Array.isArray(reply) ? reply[1] : reply.keys;

    for (const key of keys ?? []) {
      const parts = String(key).split(":");
      if (parts.length < 5) {
        continue;
      }

      const path = parts.slice(3, -1).join(":");
      counts.set(path, (counts.get(path) ?? 0) + 1);
    }

    cursor = String(nextCursor);
  } while (cursor !== "0");

  return Array.from(counts.entries())
    .map(([path, activeCount]) => ({ path, activeCount }))
    .sort((a, b) => a.path.localeCompare(b.path));
}
