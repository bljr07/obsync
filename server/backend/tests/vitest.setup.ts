import { vi } from "vitest";
import {
  apiKeyRepoMock,
  createMemoryRedisClient,
  observabilityRepoMock,
  retentionRepoMock,
  userRepoMock,
  vaultRepoMock
} from "./helpers/memoryStore.js";

process.env.NODE_ENV = "test";
process.env.JWT_ISSUER = process.env.JWT_ISSUER ?? "obsync";
process.env.JWT_AUDIENCE = process.env.JWT_AUDIENCE ?? "obsync";
process.env.BOOTSTRAP_ADMIN_USERNAME =
  process.env.BOOTSTRAP_ADMIN_USERNAME ?? "admin";

vi.doMock("../src/db/userRepo.js", () => userRepoMock);
vi.doMock("../src/db/vaultRepo.js", () => vaultRepoMock);
vi.doMock("../src/db/apiKeyRepo.js", () => apiKeyRepoMock);
vi.doMock("../src/db/retentionRepo.js", () => retentionRepoMock);
vi.doMock("../src/db/observabilityRepo.js", () => observabilityRepoMock);
vi.doMock("../src/redis/client.js", () => ({
  createRedisClient: createMemoryRedisClient
}));
