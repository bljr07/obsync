import { describe, expect, it } from "vitest";
import {
  uploadSchema,
  contentQuerySchema,
  listQuerySchema,
  batchUploadSchema,
  batchDownloadSchema
} from "../../src/validation/files.js";
import { conflictsQuerySchema, presenceQuerySchema, logsQuerySchema } from "../../src/validation/observability.js";
import { createApiKeySchema, revokeApiKeySchema } from "../../src/validation/apiKeys.js";
import { retentionBodySchema } from "../../src/validation/retention.js";

const validHash = "a".repeat(64);

describe("file validation", () => {
  it("accepts upload with null baseHash", () => {
    const result = uploadSchema.safeParse({
      path: "work/a.md",
      content: "hello",
      contentHash: validHash,
      baseHash: null
    });

    expect(result.success).toBe(true);
  });

  it("defaults baseHash to null when omitted", () => {
    const parsed = uploadSchema.parse({
      path: "work/a.md",
      content: "hello",
      contentHash: validHash
    });

    expect(parsed.baseHash).toBeNull();
  });

  it("rejects invalid paths", () => {
    const result = uploadSchema.safeParse({
      path: "../secret.md",
      content: "hello",
      contentHash: validHash
    });

    expect(result.success).toBe(false);
  });

  it("rejects empty baseHash", () => {
    const result = uploadSchema.safeParse({
      path: "work/a.md",
      content: "hello",
      contentHash: validHash,
      baseHash: ""
    });

    expect(result.success).toBe(false);
  });

  it("accepts short baseHash for conflict detection", () => {
    const result = uploadSchema.safeParse({
      path: "work/a.md",
      content: "hello",
      contentHash: validHash,
      baseHash: "deadbeef"
    });

    expect(result.success).toBe(true);
  });

  it("validates list query limits", () => {
    const result = listQuerySchema.safeParse({
      prefix: "work/",
      limit: 2000
    });

    expect(result.success).toBe(false);
  });

  it("validates content queries", () => {
    const result = contentQuerySchema.safeParse({ path: "work/a.md" });
    expect(result.success).toBe(true);
  });

  it("validates batch payloads", () => {
    const upload = batchUploadSchema.safeParse({
      files: [
        {
          path: "work/a.md",
          content: "hello",
          contentHash: validHash,
          baseHash: null
        }
      ]
    });

    const download = batchDownloadSchema.safeParse({
      paths: ["work/a.md"]
    });

    expect(upload.success).toBe(true);
    expect(download.success).toBe(true);
  });

  it("validates observability queries", () => {
    const conflicts = conflictsQuerySchema.safeParse({ limit: 250 });
    const presence = presenceQuerySchema.safeParse({ prefix: "../bad" });
    const logs = logsQuerySchema.safeParse({ prefix: "../bad", limit: 300 });

    expect(conflicts.success).toBe(false);
    expect(presence.success).toBe(false);
    expect(logs.success).toBe(false);
  });

  it("validates api key payloads", () => {
    const create = createApiKeySchema.safeParse({ name: "Key", role: "client" });
    const revoke = revokeApiKeySchema.safeParse({ id: "not-a-uuid" });

    expect(create.success).toBe(true);
    expect(revoke.success).toBe(false);
  });

  it("validates retention payloads", () => {
    const good = retentionBodySchema.safeParse({ retentionDays: 14 });
    const bad = retentionBodySchema.safeParse({ retentionDays: 0 });

    expect(good.success).toBe(true);
    expect(bad.success).toBe(false);
  });
});
