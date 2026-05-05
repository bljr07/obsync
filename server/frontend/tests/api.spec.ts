import { afterEach, describe, expect, it, vi } from "vitest";
import {
  changePassword,
  createApiKey,
  getConflicts,
  getMe,
  getMetrics,
  getPresence,
  getSyncLogs,
  listApiKeys,
  login,
  logout,
  revokeApiKey,
  runRetention,
  updateRetention
} from "../src/api";

const auth = {
  baseUrl: "http://localhost:3000",
  vaultId: "vault-1"
};

function mockFetch(payload: unknown, ok = true, status = 200) {
  const response = {
    ok,
    status,
    json: async () => payload
  };
  const fetchMock = vi.fn().mockResolvedValue(response as Response);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("frontend api", () => {
  it("includes credentials for cookie auth", async () => {
    const fetchMock = mockFetch({ totalFiles: 1, totalVersions: 2, totalBytes: 3 });

    await getMetrics(auth);

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3000/api/v1/vaults/vault-1/observability/metrics",
      expect.objectContaining({
        credentials: "include"
      })
    );
  });

  it("includes credentials for API requests", async () => {
    const fetchMock = mockFetch({ items: [] });

    await getPresence(auth);

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3000/api/v1/vaults/vault-1/observability/presence",
      expect.objectContaining({
        credentials: "include"
      })
    );
  });

  it("throws when response is not ok", async () => {
    mockFetch({ error: "boom" }, false, 500);

    await expect(getConflicts(auth)).rejects.toThrow("Conflicts failed: 500");
  });

  it("sends retention update payload", async () => {
    const fetchMock = mockFetch({ retentionDays: 30 });

    await updateRetention(auth, 30);

    const options = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(options.method).toBe("PUT");
    expect(options.body).toBe(JSON.stringify({ retentionDays: 30 }));
  });

  it("posts API key create and revoke", async () => {
    const createMock = mockFetch({ id: "id", name: "n", role: "client", prefix: "obsync_", createdAt: "", apiKey: "key" });
    await createApiKey(auth, "n", "client");
    expect(createMock.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ name: "n", role: "client" })
      })
    );

    const revokeMock = mockFetch({ ok: true });
    await revokeApiKey(auth, "id");
    expect(revokeMock.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({
        method: "POST"
      })
    );
  });

  it("runs retention and list keys", async () => {
    const runMock = mockFetch({
      retentionDays: 10,
      cutoff: "2024-01-01T00:00:00.000Z",
      versionsDeleted: 1,
      conflictsDeleted: 0
    });
    await runRetention(auth);
    expect(runMock).toHaveBeenCalled();

    const listMock = mockFetch({ items: [] });
    await listApiKeys(auth);
    expect(listMock).toHaveBeenCalled();
  });

  it("fetches sync logs", async () => {
    const fetchMock = mockFetch({ items: [] });

    await getSyncLogs(auth);

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3000/api/v1/vaults/vault-1/observability/logs",
      expect.objectContaining({
        credentials: "include"
      })
    );
  });

  it("posts login with credentials", async () => {
    const fetchMock = mockFetch({ ok: true, mustChangePassword: false, username: "admin", role: "admin" });

    await login("http://localhost:3000", "admin", "secret", "vault-1");

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3000/api/v1/auth/login",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        body: JSON.stringify({ username: "admin", password: "secret", vaultId: "vault-1" })
      })
    );
  });

  it("fetches session and logout", async () => {
    const meMock = mockFetch({ userId: "u1", username: "admin", role: "admin", vaultId: "vault-1", mustChangePassword: false });
    await getMe("http://localhost:3000");
    expect(meMock).toHaveBeenCalledWith(
      "http://localhost:3000/api/v1/auth/me",
      expect.objectContaining({ credentials: "include" })
    );

    const logoutMock = mockFetch({ ok: true });
    await logout("http://localhost:3000");
    expect(logoutMock).toHaveBeenCalledWith(
      "http://localhost:3000/api/v1/auth/logout",
      expect.objectContaining({ method: "POST", credentials: "include" })
    );
  });

  it("updates credentials", async () => {
    const fetchMock = mockFetch({ ok: true });

    await changePassword("http://localhost:3000", "owner", "newpass");

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3000/api/v1/auth/change-password",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        body: JSON.stringify({ username: "owner", password: "newpass" })
      })
    );
  });
});
