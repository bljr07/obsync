import { getPrismaClient } from "./prisma.js";

export type UpsertResult =
  | { status: "created"; hash: string }
  | { status: "updated"; hash: string }
  | { status: "conflict"; latestHash: string };

export type VaultFile = {
  path: string;
  content: string;
  hash: string;
  updatedAt: Date;
};

const prisma = getPrismaClient();

export async function getFileByPath(vaultId: string, path: string) {
  return prisma.vaultEntry.findUnique({
    where: {
      vaultId_path: {
        vaultId,
        path
      }
    }
  });
}

export async function listFiles(options: {
  vaultId: string;
  prefix?: string;
  cursor?: string;
  limit: number;
}) {
  const { vaultId, prefix, cursor, limit } = options;

  const where = {
    vaultId,
    ...(prefix ? { path: { startsWith: prefix } } : {})
  };

  const items = await prisma.vaultEntry.findMany({
    where,
    orderBy: {
      path: "asc"
    },
    take: limit,
    ...(cursor
      ? {
          cursor: {
            vaultId_path: {
              vaultId,
              path: cursor
            }
          },
          skip: 1
        }
      : {})
  });

  const nextCursor = items.length === limit ? items[items.length - 1].path : null;

  return {
    items: items.map((item) => ({
      path: item.path,
      hash: item.hash,
      updatedAt: item.updatedAt
    })),
    nextCursor
  };
}

export async function upsertFile(options: {
  vaultId: string;
  path: string;
  content: string;
  hash: string;
  baseHash: string | null;
}): Promise<UpsertResult> {
  const { vaultId, path, content, hash, baseHash } = options;

  const existing = await prisma.vaultEntry.findUnique({
    where: {
      vaultId_path: {
        vaultId,
        path
      }
    }
  });

  if (!existing) {
    await prisma.vaultEntry.create({
      data: {
        vaultId,
        path,
        content,
        hash,
        versions: {
          create: {
            vaultId,
            path,
            content,
            hash
          }
        }
      }
    });

    return { status: "created", hash };
  }

  if (!baseHash || baseHash !== existing.hash) {
    await prisma.vaultConflict.create({
      data: {
        vaultId,
        path,
        baseHash,
        latestHash: existing.hash
      }
    });

    return { status: "conflict", latestHash: existing.hash };
  }

  const updated = await prisma.$transaction(async (tx) => {
    const entry = await tx.vaultEntry.update({
      where: {
        id: existing.id
      },
      data: {
        content,
        hash
      }
    });

    await tx.vaultEntryVersion.create({
      data: {
        vaultEntryId: existing.id,
        vaultId,
        path,
        content,
        hash
      }
    });

    return entry;
  });

  return { status: "updated", hash: updated.hash };
}
