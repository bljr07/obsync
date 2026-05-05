import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";

describe("health and 404", () => {
  const app = createApp();
  const api = request(app);

  it("returns ok for health", async () => {
    const res = await api.get("/health").expect(200);
    expect(res.body).toEqual({ status: "ok" });
  });

  it("returns 404 for unknown routes", async () => {
    const res = await api.get("/missing").expect(404);
    expect(res.body).toMatchObject({ error: "NOT_FOUND" });
  });
});
