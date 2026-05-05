import { createHash, randomBytes, randomUUID } from "crypto";
import type { UpsertResult } from "../../src/db/vaultRepo.js";

type UserRecord = {
  id: string;
  username: string;
  passwordHash: string;
  role: string;
  mustChangePassword: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type VaultEntryRecord = {
  id: string;
  vaultId: string;
  path: string;
  content: string;
  hash: string;
  createdAt: Date;
  updatedAt: Date;
};

type VaultVersionRecord = {
  id: string;
  vaultEntryId: string;
  vaultId: string;
  path: string;
  content: string;
  hash: string;
  createdAt: Date;
};

type ConflictRecord = {
  id: string;
  vaultId: string;
  path: string;
  baseHash: string | null;
  latestHash: string;
  createdAt: Date;
};

type ApiKeyRecord = {
  id: string;
  vaultId: string;
  name: string;
  role: string;
  keyHash: string;
  prefix: string;
  createdAt: Date;
  revokedAt: Date | null;
  lastUsedAt: Date | null;
};

type RetentionRecord = {
  vaultId: string;
  retentionDays: number;
  updatedAt: Date;
};

type SyncLogRecord = {
  id: string;
  vaultId: string;
  path: string | null;
  action: string;
  message: string;
  createdAt: Date;
};

const state = {
  users: [] as UserRecord[],
  entries: [] as VaultEntryRecord[],
  versions: [] as VaultVersionRecord[],
  conflicts: [] as ConflictRecord[],
  apiKeys: [] as ApiKeyRecord[],
  retention: [] as RetentionRecord[],
  logs: [] as SyncLogRecord[],
  redis: new Map<string, string>()
};

function uuid() {
  return randomUUID();
}

function now() {
  return new Date();
}

function sortByCreatedDesc<T extends { createdAt: Date }>(items: T[]) {
  return [...items].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

function generateMemoryApiKey() {
  return `obsync_${randomBytes(32).toString("base64url")}`;
}

export function hashMemoryApiKey(apiKey: string) {
  return createHash("sha256").update(apiKey, "utf8").digest("hex");
}

export async function resetMemoryStore() {
  state.users = [];
  state.entries = [];
  state.versions = [];
  state.conflicts = [];
  state.apiKeys = [];
  state.retention = [];
  state.logs = [];
}

export async function resetRedisStore(prefix?: string) {
  if (!prefix) {
    state.redis.clear();
    return;
  }

  for (const key of [...state.redis.keys()]) {
    if (key.startsWith(prefix)) {
      state.redis.delete(key);
    }
  }
}

export async function disconnectMemoryStore() {
  return undefined;
}

export async function updateMemoryVersions(data: { createdAt?: Date }) {
  for (const version of state.versions) {
    version.createdAt = data.createdAt ?? version.createdAt;
  }
  return { count: state.versions.length };
}

export async function updateMemoryConflicts(data: { createdAt?: Date }) {
  for (const conflict of state.conflicts) {
    conflict.createdAt = data.createdAt ?? conflict.createdAt;
  }
  return { count: state.conflicts.length };
}

export const userRepoMock = {
  async createUser(input: {
    username: string;
    passwordHash: string;
    role: string;
    mustChangePassword: boolean;
  }) {
    const record = {
      id: uuid(),
      createdAt: now(),
      updatedAt: now(),
      ...input
    };
    state.users.push(record);
    return record;
  },

  async findUserByUsername(username: string) {
    return state.users.find((user) => user.username === username) ?? null;
  },

  async findUserById(id: string) {
    return state.users.find((user) => user.id === id) ?? null;
  },

  async countUsers() {
    return state.users.length;
  },

  async updateUserCredentials(options: {
    id: string;
    username: string;
    passwordHash: string;
    mustChangePassword: boolean;
  }) {
    const user = state.users.find((item) => item.id === options.id);
    if (!user) {
      throw new Error("User not found");
    }

    user.username = options.username;
    user.passwordHash = options.passwordHash;
    user.mustChangePassword = options.mustChangePassword;
    user.updatedAt = now();
    return user;
  }
};

export const vaultRepoMock = {
  async getFileByPath(vaultId: string, path: string) {
    return state.entries.find((entry) => entry.vaultId === vaultId && entry.path === path) ?? null;
  },

  async listFiles(options: {
    vaultId: string;
    prefix?: string;
    cursor?: string;
    limit: number;
  }) {
    const start = options.cursor
      ? state.entries.findIndex(
          (entry) => entry.vaultId === options.vaultId && entry.path === options.cursor
        ) + 1
      : 0;
    const items = state.entries
      .filter(
        (entry) =>
          entry.vaultId === options.vaultId &&
          (!options.prefix || entry.path.startsWith(options.prefix))
      )
      .sort((a, b) => a.path.localeCompare(b.path))
      .slice(Math.max(0, start), Math.max(0, start) + options.limit);

    return {
      items: items.map((item) => ({
        path: item.path,
        hash: item.hash,
        updatedAt: item.updatedAt
      })),
      nextCursor: items.length === options.limit ? items[items.length - 1].path : null
    };
  },

  async upsertFile(options: {
    vaultId: string;
    path: string;
    content: string;
    hash: string;
    baseHash: string | null;
  }): Promise<UpsertResult> {
    const existing = state.entries.find(
      (entry) => entry.vaultId === options.vaultId && entry.path === options.path
    );

    if (!existing) {
      const entry = {
        id: uuid(),
        vaultId: options.vaultId,
        path: options.path,
        content: options.content,
        hash: options.hash,
        createdAt: now(),
        updatedAt: now()
      };
      state.entries.push(entry);
      state.versions.push({
        id: uuid(),
        vaultEntryId: entry.id,
        vaultId: options.vaultId,
        path: options.path,
        content: options.content,
        hash: options.hash,
        createdAt: now()
      });
      return { status: "created", hash: options.hash };
    }

    if (!options.baseHash || options.baseHash !== existing.hash) {
      state.conflicts.push({
        id: uuid(),
        vaultId: options.vaultId,
        path: options.path,
        baseHash: options.baseHash,
        latestHash: existing.hash,
        createdAt: now()
      });
      return { status: "conflict", latestHash: existing.hash };
    }

    existing.content = options.content;
    existing.hash = options.hash;
    existing.updatedAt = now();
    state.versions.push({
      id: uuid(),
      vaultEntryId: existing.id,
      vaultId: options.vaultId,
      path: options.path,
      content: options.content,
      hash: options.hash,
      createdAt: now()
    });
    return { status: "updated", hash: options.hash };
  }
};

export const apiKeyRepoMock = {
  async createApiKey(options: { vaultId: string; name: string; role: string }) {
    const apiKey = generateMemoryApiKey();
    const record = {
      id: uuid(),
      vaultId: options.vaultId,
      name: options.name,
      role: options.role,
      keyHash: hashMemoryApiKey(apiKey),
      prefix: apiKey.slice(0, 12),
      createdAt: now(),
      revokedAt: null,
      lastUsedAt: null
    };
    state.apiKeys.push(record);
    return {
      id: record.id,
      vaultId: record.vaultId,
      name: record.name,
      role: record.role,
      prefix: record.prefix,
      createdAt: record.createdAt,
      apiKey
    };
  },

  async listApiKeys(vaultId: string) {
    return sortByCreatedDesc(state.apiKeys.filter((item) => item.vaultId === vaultId));
  },

  async revokeApiKey(vaultId: string, id: string) {
    const record = state.apiKeys.find(
      (item) => item.id === id && item.vaultId === vaultId && item.revokedAt === null
    );
    if (!record) {
      return { count: 0 };
    }
    record.revokedAt = now();
    return { count: 1 };
  },

  async findActiveApiKeyByHash(keyHash: string) {
    return (
      state.apiKeys.find((item) => item.keyHash === keyHash && item.revokedAt === null) ?? null
    );
  },

  async touchApiKeyLastUsed(id: string) {
    const record = state.apiKeys.find((item) => item.id === id);
    if (!record) {
      throw new Error("API key not found");
    }
    record.lastUsedAt = now();
    return record;
  }
};

export const retentionRepoMock = {
  async getRetentionSettings(vaultId: string) {
    return (
      state.retention.find((item) => item.vaultId === vaultId) ?? {
        vaultId,
        retentionDays: 14,
        updatedAt: now()
      }
    );
  },

  async upsertRetentionSettings(vaultId: string, retentionDays: number) {
    const existing = state.retention.find((item) => item.vaultId === vaultId);
    if (existing) {
      existing.retentionDays = retentionDays;
      existing.updatedAt = now();
      return existing;
    }

    const record = { vaultId, retentionDays, updatedAt: now() };
    state.retention.push(record);
    return record;
  },

  async applyRetention(vaultId: string, retentionDays: number) {
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
    const versionCount = state.versions.length;
    const conflictCount = state.conflicts.length;
    state.versions = state.versions.filter(
      (item) => item.vaultId !== vaultId || item.createdAt >= cutoff
    );
    state.conflicts = state.conflicts.filter(
      (item) => item.vaultId !== vaultId || item.createdAt >= cutoff
    );
    return {
      cutoff,
      versionsDeleted: versionCount - state.versions.length,
      conflictsDeleted: conflictCount - state.conflicts.length
    };
  }
};

export const observabilityRepoMock = {
  async getMetrics(vaultId: string) {
    const entries = state.entries.filter((entry) => entry.vaultId === vaultId);
    return {
      totalFiles: entries.length,
      totalVersions: state.versions.filter((version) => version.vaultId === vaultId).length,
      totalBytes: entries.reduce(
        (sum, entry) => sum + Buffer.byteLength(entry.content, "utf8"),
        0
      )
    };
  },

  async listConflicts(vaultId: string, limit: number) {
    return sortByCreatedDesc(state.conflicts.filter((item) => item.vaultId === vaultId)).slice(
      0,
      limit
    );
  },

  async recordSyncLog(input: {
    vaultId: string;
    path?: string | null;
    action: string;
    message: string;
  }) {
    const record = {
      id: uuid(),
      vaultId: input.vaultId,
      path: input.path ?? null,
      action: input.action,
      message: input.message,
      createdAt: now()
    };
    state.logs.push(record);
    return record;
  },

  async listSyncLogs(vaultId: string, limit: number, prefix?: string) {
    return sortByCreatedDesc(
      state.logs.filter(
        (item) =>
          item.vaultId === vaultId &&
          (!prefix || (item.path !== null && item.path.startsWith(prefix)))
      )
    ).slice(0, limit);
  }
};

function matchesPattern(value: string, pattern: string) {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  return new RegExp(`^${escaped}$`).test(value);
}

export function createMemoryRedisClient() {
  return {
    isOpen: true,
    isReady: true,
    async connect() {
      this.isOpen = true;
      this.isReady = true;
    },
    async quit() {
      this.isOpen = false;
      this.isReady = false;
    },
    async set(key: string, value: string, options?: { NX?: boolean; EX?: number }) {
      if (options?.NX && state.redis.has(key)) {
        return null;
      }
      state.redis.set(key, value);
      return "OK";
    },
    async get(key: string) {
      return state.redis.get(key) ?? null;
    },
    async expire(key: string) {
      return state.redis.has(key) ? 1 : 0;
    },
    async del(keys: string | string[]) {
      const items = Array.isArray(keys) ? keys : [keys];
      let count = 0;
      for (const key of items) {
        if (state.redis.delete(key)) {
          count += 1;
        }
      }
      return count;
    },
    async flushDb() {
      state.redis.clear();
      return "OK";
    },
    async scan(_cursor: string, options?: { MATCH?: string; COUNT?: number }) {
      const keys = [...state.redis.keys()].filter((key) =>
        options?.MATCH ? matchesPattern(key, options.MATCH) : true
      );
      return {
        cursor: "0",
        keys
      };
    }
  };
}
