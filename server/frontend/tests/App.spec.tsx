import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("../src/api", () => ({
  changePassword: vi.fn(),
  getMetrics: vi.fn(),
  getConflicts: vi.fn(),
  getPresence: vi.fn(),
  getSyncLogs: vi.fn(),
  getRetention: vi.fn(),
  listApiKeys: vi.fn(),
  updateRetention: vi.fn(),
  runRetention: vi.fn(),
  createApiKey: vi.fn(),
  revokeApiKey: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
  getMe: vi.fn()
}));

async function setupApp(options: {
  overrides?: Partial<Record<string, unknown>>;
  expectMetrics?: boolean;
} = {}) {
  vi.resetModules();
  localStorage.clear();
  localStorage.setItem("obsync.baseUrl", "http://localhost:3000");
  localStorage.setItem("obsync.vaultId", "vault-1");

  const { overrides = {}, expectMetrics = true } = options;

  const api = await import("../src/api");
  const mocks = {
    changePassword: vi.mocked(api.changePassword),
    getMetrics: vi.mocked(api.getMetrics),
    getConflicts: vi.mocked(api.getConflicts),
    getPresence: vi.mocked(api.getPresence),
    getSyncLogs: vi.mocked(api.getSyncLogs),
    getRetention: vi.mocked(api.getRetention),
    listApiKeys: vi.mocked(api.listApiKeys),
    updateRetention: vi.mocked(api.updateRetention),
    runRetention: vi.mocked(api.runRetention),
    createApiKey: vi.mocked(api.createApiKey),
    revokeApiKey: vi.mocked(api.revokeApiKey),
    login: vi.mocked(api.login),
    logout: vi.mocked(api.logout),
    getMe: vi.mocked(api.getMe)
  };

  mocks.getMe.mockResolvedValue({
    userId: "u1",
    username: "admin",
    role: "admin",
    vaultId: "vault-1",
    mustChangePassword: false
  });
  mocks.getMetrics.mockResolvedValue({ totalFiles: 12, totalVersions: 34, totalBytes: 56 });
  mocks.getConflicts.mockResolvedValue({
    items: [
      { id: "c1", path: "work/notes.md", baseHash: "deadbeef", latestHash: "ff", createdAt: "2024-01-01" }
    ]
  });
  mocks.getPresence.mockResolvedValue({ items: [{ path: "work/notes.md", activeCount: 2 }] });
  mocks.getSyncLogs.mockResolvedValue({
    items: [
      {
        id: "l1",
        path: "work/notes.md",
        action: "created",
        message: "File created",
        createdAt: "2024-01-01"
      }
    ]
  });
  mocks.getRetention.mockResolvedValue({ retentionDays: 14 });
  mocks.listApiKeys.mockResolvedValue({ items: [{ id: "k1", name: "Key", role: "client", prefix: "obsync_" }] });
  mocks.updateRetention.mockResolvedValue({ retentionDays: 21 });
  mocks.runRetention.mockResolvedValue({
    retentionDays: 14,
    cutoff: "2024-01-01T00:00:00.000Z",
    versionsDeleted: 2,
    conflictsDeleted: 1
  });
  mocks.createApiKey.mockResolvedValue({
    id: "k2",
    name: "New",
    role: "client",
    prefix: "obsync_",
    createdAt: "",
    apiKey: "obsync_key"
  });
  mocks.revokeApiKey.mockResolvedValue({ ok: true });
  mocks.login.mockResolvedValue({ ok: true, mustChangePassword: false, username: "admin", role: "admin" });
  mocks.logout.mockResolvedValue({ ok: true });
  mocks.changePassword.mockResolvedValue({ ok: true });

  for (const [key, value] of Object.entries(overrides)) {
    const mockFn = (mocks as Record<string, any>)[key];
    if (mockFn && typeof mockFn.mockImplementation === "function") {
      mockFn.mockImplementation(value as (...args: unknown[]) => unknown);
    }
  }

  const { default: App } = await import("../src/App");
  render(<App />);

  if (expectMetrics) {
    await waitFor(() => expect(mocks.getMetrics).toHaveBeenCalled());
  } else {
    await waitFor(() => expect(mocks.getMe).toHaveBeenCalled());
  }

  return mocks;
}

describe("App", () => {
  afterEach(() => {
    cleanup();
  });
  it("renders dashboard data on load", async () => {
    await setupApp();

    expect(screen.getByText("12")).toBeTruthy();
    expect(screen.getByText("34")).toBeTruthy();
    expect(screen.getByText("56")).toBeTruthy();
    expect(screen.getAllByText("work/notes.md").length).toBeGreaterThan(0);
    expect(screen.getByText("deadbeef")).toBeTruthy();
    expect(screen.getByText("File created")).toBeTruthy();
  });

  it("refresh button reloads data", async () => {
    const mocks = await setupApp();
    const user = userEvent.setup();

    const metricsCalls = mocks.getMetrics.mock.calls.length;
    const conflictsCalls = mocks.getConflicts.mock.calls.length;

    await user.click(screen.getByRole("button", { name: "Refresh" }));

    expect(mocks.getMetrics).toHaveBeenCalledTimes(metricsCalls + 1);
    expect(mocks.getConflicts).toHaveBeenCalledTimes(conflictsCalls + 1);
  });

  it("updates retention and runs cleanup", async () => {
    const mocks = await setupApp();
    const user = userEvent.setup();

    const input = screen.getByLabelText("Retention days");
    await user.clear(input);
    await user.type(input, "21");

    await user.click(screen.getByRole("button", { name: "Update" }));
    expect(mocks.updateRetention).toHaveBeenCalledWith(expect.any(Object), 21);

    await user.click(screen.getByRole("button", { name: "Run now" }));
    expect(mocks.runRetention).toHaveBeenCalled();
    expect(await screen.findByText(/Deleted 2 versions/)).toBeTruthy();
  });

  it("creates and revokes API keys", async () => {
    const mocks = await setupApp();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("Key name"), "New");
    await user.click(screen.getByRole("button", { name: "Create key" }));

    expect(mocks.createApiKey).toHaveBeenCalledWith(expect.any(Object), "New", "client");
    expect(await screen.findByText(/New key:/)).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Revoke" }));
    expect(mocks.revokeApiKey).toHaveBeenCalledWith(expect.any(Object), "k1");
  });

  it("shows error when refresh fails", async () => {
    await setupApp({
      overrides: {
        getMetrics: () => Promise.reject(new Error("Boom"))
      }
    });

    expect(await screen.findByText("Boom")).toBeTruthy();
  });

  it("shows login when unauthenticated", async () => {
    const mocks = await setupApp({
      overrides: {
        getMe: () => Promise.reject(new Error("Unauthorized"))
      },
      expectMetrics: false
    });

    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Username"), "admin");
    await user.type(screen.getByLabelText("Password"), "secret");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(mocks.login).toHaveBeenCalledWith("http://localhost:3000", "admin", "secret", "vault-1");
  });

  it("forces password update when required", async () => {
    const mocks = await setupApp({
      overrides: {
        getMe: () =>
          Promise.resolve({
            userId: "u1",
            username: "admin",
            role: "admin",
            vaultId: "vault-1",
            mustChangePassword: true
          })
      },
      expectMetrics: false
    });

    const user = userEvent.setup();
    await user.clear(screen.getByLabelText("New username"));
    await user.type(screen.getByLabelText("New username"), "owner");
    await user.type(screen.getByLabelText("New password"), "newpass123");
    await user.click(screen.getByRole("button", { name: "Update credentials" }));

    expect(mocks.changePassword).toHaveBeenCalledWith("http://localhost:3000", "owner", "newpass123");
  });
});
