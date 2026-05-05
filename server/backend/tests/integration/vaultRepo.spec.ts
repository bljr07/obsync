import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { getFileByPath, listFiles, upsertFile } from "../../src/db/vaultRepo.js";
import { disconnectDatabase, resetDatabase } from "../helpers/db.js";

describe.sequential("vaultRepo integration", () => {
  const vaultId = "vault-1";

  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await disconnectDatabase();
  });

  it("creates and updates entries", async () => {
    const createResult = await upsertFile({
      vaultId,
      path: "work/repo.md",
      content: "v1",
      hash: "a".repeat(64),
      baseHash: null
    });

    expect(createResult).toMatchObject({ status: "created" });

    const updateResult = await upsertFile({
      vaultId,
      path: "work/repo.md",
      content: "v2",
      hash: "b".repeat(64),
      baseHash: "a".repeat(64)
    });

    expect(updateResult).toMatchObject({ status: "updated" });

    const entry = await getFileByPath(vaultId, "work/repo.md");
    expect(entry?.hash).toBe("b".repeat(64));
  });

  it("lists files in order", async () => {
    await upsertFile({
      vaultId,
      path: "work/a.md",
      content: "a",
      hash: "a".repeat(64),
      baseHash: null
    });

    await upsertFile({
      vaultId,
      path: "work/b.md",
      content: "b",
      hash: "b".repeat(64),
      baseHash: null
    });

    const list = await listFiles({
      vaultId,
      prefix: "work/",
      limit: 10
    });

    expect(list.items.map((item) => item.path)).toEqual(["work/a.md", "work/b.md"]);
  });
});
