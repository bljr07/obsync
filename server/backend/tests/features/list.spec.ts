import { beforeAll, beforeEach, describe, expect, it, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { sha256 } from "../helpers/hash.js";
import { createTestToken, testPublicKey } from "../helpers/testKeys.js";
import { disconnectDatabase, resetDatabase } from "../helpers/db.js";

describe.sequential("File listing", () => {
  const vaultId = "vault-1";
  const app = createApp();
  const api = request(app);

  beforeAll(() => {
    process.env.JWT_PUBLIC_KEY = testPublicKey;
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await disconnectDatabase();
  });

  it("lists files by prefix with pagination", async () => {
    const token = createTestToken({ vaultId });

    const files = [
      { path: "work/a.md", content: "a" },
      { path: "work/b.md", content: "b" },
      { path: "work/c.md", content: "c" },
      { path: "personal/x.md", content: "x" }
    ];

    for (const file of files) {
      await api
        .post(`/api/v1/vaults/${vaultId}/files`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          path: file.path,
          content: file.content,
          contentHash: sha256(file.content),
          baseHash: null
        })
        .expect(201);
    }

    const firstPage = await api
      .get(`/api/v1/vaults/${vaultId}/files`)
      .query({ prefix: "work/", limit: 2 })
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(firstPage.body.items).toHaveLength(2);
    expect(firstPage.body.nextCursor).toBeTypeOf("string");

    const secondPage = await api
      .get(`/api/v1/vaults/${vaultId}/files`)
      .query({ prefix: "work/", limit: 2, cursor: firstPage.body.nextCursor })
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(secondPage.body.items).toHaveLength(1);
    expect(secondPage.body.items[0].path).toBe("work/c.md");
  });
});
