const LOCK_PREFIX = "obsync:lock";
export const LOCK_TTL_SECONDS = 10;

export function lockKey(vaultId: string, path: string, line: number) {
  return `${LOCK_PREFIX}:${vaultId}:${path}:${line}`;
}

export async function acquireLock(
  redis: {
    set: Function;
    get: Function;
  },
  vaultId: string,
  path: string,
  line: number,
  clientId: string
) {
  const key = lockKey(vaultId, path, line);
  const result = await redis.set(key, clientId, {
    NX: true,
    EX: LOCK_TTL_SECONDS
  });

  if (result) {
    return { status: "granted" } as const;
  }

  const holder = await redis.get(key);
  return { status: "denied", holder } as const;
}

export async function refreshLock(
  redis: {
    get: Function;
    expire: Function;
  },
  vaultId: string,
  path: string,
  line: number,
  clientId: string
) {
  const key = lockKey(vaultId, path, line);
  const holder = await redis.get(key);
  if (holder !== clientId) {
    return { status: "denied", holder } as const;
  }

  await redis.expire(key, LOCK_TTL_SECONDS);
  return { status: "refreshed" } as const;
}

export async function releaseLock(
  redis: {
    get: Function;
    del: Function;
  },
  vaultId: string,
  path: string,
  line: number,
  clientId: string
) {
  const key = lockKey(vaultId, path, line);
  const holder = await redis.get(key);
  if (holder !== clientId) {
    return { status: "denied", holder } as const;
  }

  await redis.del(key);
  return { status: "released" } as const;
}
