import {
  disconnectMemoryStore,
  resetMemoryStore,
  updateMemoryConflicts,
  updateMemoryVersions
} from "./memoryStore.js";

export const prisma = {
  vaultEntryVersion: {
    async updateMany(options: { data: { createdAt?: Date } }) {
      return updateMemoryVersions(options.data);
    }
  },
  vaultConflict: {
    async updateMany(options: { data: { createdAt?: Date } }) {
      return updateMemoryConflicts(options.data);
    }
  }
};

export async function resetDatabase() {
  await resetMemoryStore();
}

export async function disconnectDatabase() {
  await disconnectMemoryStore();
}
