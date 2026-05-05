import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiClient } from "../src/api-client.js";

const ioMock = vi.hoisted(() => vi.fn());
vi.mock("socket.io-client", () => ({
  io: ioMock
}));

const settings = {
  serverUrl: "http://localhost:3000",
  vaultId: "vault-1",
  authMode: "jwt" as const,
  authToken: "token"
};

function createClient(overrides: Partial<typeof settings> = {}) {
  return new ApiClient({ ...settings, ...overrides });
}

function mockFetch(payload: unknown, ok = true, status = 200) {
  const response = {
    ok,
    status,
    json: async () => payload
  } as Response;
  const fetchMock = vi.fn().mockResolvedValue(response);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("api client", () => {
  it("adds bearer auth header for jwt", async () => {
    const fetchMock = mockFetch({ hash: "abc" });
    const client = createClient();

    await client.uploadFile({
      path: "work/a.md",
      content: "a",
      contentHash: "hash",
      baseHash: null
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3000/api/v1/vaults/vault-1/files",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer token"
        })
      })
    );
  });

  it("adds api key header when configured", async () => {
    const fetchMock = mockFetch({ items: [] });
    const client = createClient({ authMode: "apiKey", authToken: "key" });

    await client.listFiles("work/");

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3000/api/v1/vaults/vault-1/files?prefix=work%2F",
      expect.objectContaining({
        headers: expect.objectContaining({
          "X-API-Key": "key"
        })
      })
    );
  });

  it("returns conflict info for upload", async () => {
    const fetchMock = mockFetch({ latestHash: "latest" }, false, 409);
    const client = createClient();

    const res = await client.uploadFile({
      path: "work/a.md",
      content: "a",
      contentHash: "hash",
      baseHash: "old"
    });

    expect(res).toEqual({ conflict: true, latestHash: "latest" });
    expect(fetchMock).toHaveBeenCalled();
  });

  it("throws on upload failure", async () => {
    mockFetch({ error: "nope" }, false, 500);
    const client = createClient();

    await expect(
      client.uploadFile({
        path: "work/a.md",
        content: "a",
        contentHash: "hash",
        baseHash: null
      })
    ).rejects.toThrow("Upload failed: 500");
  });

  it("creates socket with auth token", () => {
    const client = createClient({ authMode: "apiKey", authToken: "key" });

    client.createSocket();

    expect(ioMock).toHaveBeenCalledWith("http://localhost:3000", {
      transports: ["websocket"],
      auth: { token: "ApiKey key" }
    });
  });
});
