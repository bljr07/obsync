import { useEffect, useMemo, useState } from "react";
import {
  changePassword,
  createApiKey,
  getConflicts,
  getMe,
  getMetrics,
  getPresence,
  getSyncLogs,
  getRetention,
  listApiKeys,
  login,
  logout,
  revokeApiKey,
  runRetention,
  updateRetention,
  type AuthConfig,
  type AuthSession
} from "./api";

const defaultConfig = {
  baseUrl: localStorage.getItem("obsync.baseUrl") ?? "http://localhost:3000",
  vaultId: localStorage.getItem("obsync.vaultId") ?? "vault-1"
};

export default function App() {
  const [baseUrl, setBaseUrl] = useState(defaultConfig.baseUrl);
  const [vaultId, setVaultId] = useState(defaultConfig.vaultId);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [changeUsername, setChangeUsername] = useState("");
  const [changePasswordValue, setChangePasswordValue] = useState("");
  const [changeError, setChangeError] = useState("");

  const [metrics, setMetrics] = useState<{ totalFiles: number; totalVersions: number; totalBytes: number } | null>(null);
  const [conflicts, setConflicts] = useState<{ path: string; baseHash: string | null; latestHash: string; createdAt: string }[]>([]);
  const [presence, setPresence] = useState<{ path: string; activeCount: number }[]>([]);
  const [logs, setLogs] = useState<{ id: string; path: string | null; action: string; message: string; createdAt: string }[]>([]);
  const [retentionDays, setRetentionDays] = useState<number | null>(null);
  const [retentionResult, setRetentionResult] = useState<string>("");
  const [apiKeys, setApiKeys] = useState<
    { id: string; name: string; role: string; prefix: string; revokedAt?: string | null; lastUsedAt?: string | null }[]
  >([]);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyRole, setNewKeyRole] = useState("client");
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [error, setError] = useState<string>("");

  const auth = useMemo<AuthConfig>(() => {
    return { baseUrl, vaultId };
  }, [baseUrl, vaultId]);

  const canViewDashboard = Boolean(session && !session.mustChangePassword);

  useEffect(() => {
    localStorage.setItem("obsync.baseUrl", baseUrl);
    localStorage.setItem("obsync.vaultId", vaultId);
  }, [baseUrl, vaultId]);

  useEffect(() => {
    let active = true;

    async function loadSession() {
      setAuthChecked(false);
      setLoginError("");

      try {
        const me = await getMe(baseUrl);
        if (!active) {
          return;
        }
        setSession(me);
        setChangeUsername(me.username);
      } catch (err) {
        if (!active) {
          return;
        }
        setSession(null);
      } finally {
        if (active) {
          setAuthChecked(true);
        }
      }
    }

    loadSession();
    return () => {
      active = false;
    };
  }, [baseUrl]);

  useEffect(() => {
    if (session?.username) {
      setChangeUsername(session.username);
    }
  }, [session?.username]);

  useEffect(() => {
    if (canViewDashboard) {
      refreshAll();
    }
  }, [canViewDashboard, auth.baseUrl, auth.vaultId]);

  async function refreshAll() {
    if (!canViewDashboard) {
      return;
    }

    setError("");
    try {
      const [metricsRes, conflictsRes, presenceRes, logsRes, retentionRes, apiKeysRes] = await Promise.all([
        getMetrics(auth),
        getConflicts(auth),
        getPresence(auth),
        getSyncLogs(auth),
        getRetention(auth),
        listApiKeys(auth)
      ]);
      setMetrics(metricsRes);
      setConflicts(conflictsRes.items);
      setPresence(presenceRes.items);
      setLogs(logsRes.items);
      setRetentionDays(retentionRes.retentionDays);
      setApiKeys(apiKeysRes.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    }
  }

  function clearDashboard() {
    setMetrics(null);
    setConflicts([]);
    setPresence([]);
    setLogs([]);
    setRetentionDays(null);
    setRetentionResult("");
    setApiKeys([]);
    setCreatedKey(null);
  }

  async function handleLogin() {
    setLoginError("");
    try {
      const result = await login(baseUrl, loginUsername, loginPassword, vaultId);
      setSession({
        username: result.username,
        role: result.role,
        mustChangePassword: result.mustChangePassword,
        vaultId
      });
      setLoginPassword("");
      if (!result.mustChangePassword) {
        await refreshAll();
      }
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : "Login failed");
    }
  }

  async function handleLogout() {
    try {
      await logout(baseUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to log out");
    } finally {
      setSession(null);
      clearDashboard();
    }
  }

  async function handleChangePassword() {
    setChangeError("");
    try {
      await changePassword(baseUrl, changeUsername, changePasswordValue);
      setSession((current) =>
        current
          ? {
              ...current,
              username: changeUsername,
              mustChangePassword: false
            }
          : current
      );
      setChangePasswordValue("");
      await refreshAll();
    } catch (err) {
      setChangeError(err instanceof Error ? err.message : "Failed to update credentials");
    }
  }

  async function handleRetentionUpdate() {
    if (retentionDays === null) {
      return;
    }
    try {
      const updated = await updateRetention(auth, retentionDays);
      setRetentionDays(updated.retentionDays);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update retention");
    }
  }

  async function handleRetentionRun() {
    try {
      const result = await runRetention(auth);
      setRetentionResult(
        `Deleted ${result.versionsDeleted} versions and ${result.conflictsDeleted} conflicts (cutoff ${new Date(
          result.cutoff
        ).toLocaleString()})`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to run retention");
    }
  }

  async function handleCreateKey() {
    if (!newKeyName.trim()) {
      return;
    }

    try {
      const created = await createApiKey(auth, newKeyName.trim(), newKeyRole);
      setCreatedKey(created.apiKey);
      setNewKeyName("");
      await refreshAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create API key");
    }
  }

  async function handleRevokeKey(id: string) {
    try {
      await revokeApiKey(auth, id);
      await refreshAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to revoke API key");
    }
  }

  return (
    <div className="app">
      <header className="hero">
        <div>
          <p className="eyebrow">Obsync Console</p>
          <h1>Vault observability and control</h1>
          <p className="subhead">
            Monitor live sync health, manage retention, and issue API keys from a single cockpit.
          </p>
        </div>
        <div className="hero-actions">
          {session ? (
            <span className="pill session-pill">Signed in as {session.username}</span>
          ) : null}
          {session ? (
            <button className="ghost" onClick={handleLogout}>
              Sign out
            </button>
          ) : null}
          <button className="ghost" onClick={refreshAll} disabled={!canViewDashboard}>
            Refresh
          </button>
        </div>
      </header>

      <section className="panel auth">
        <h2>Connection</h2>
        <div className="grid two">
          <label>
            Server URL
            <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} disabled={Boolean(session)} />
          </label>
          <label>
            Vault ID
            <input value={vaultId} onChange={(e) => setVaultId(e.target.value)} disabled={Boolean(session)} />
          </label>
        </div>
        {session ? <p className="hint">Sign out to change connection settings.</p> : null}
        {!session && authChecked ? <p className="hint">Sign in to load metrics and admin tools.</p> : null}
        {error ? <p className="error">{error}</p> : null}
      </section>

      {!session ? (
        <section className="panel login">
          <h2>Sign in</h2>
          <div className="grid two">
            <label>
              Username
              <input value={loginUsername} onChange={(e) => setLoginUsername(e.target.value)} />
            </label>
            <label>
              Password
              <input
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
              />
            </label>
          </div>
          <div className="actions">
            <button onClick={handleLogin}>Sign in</button>
          </div>
          {loginError ? <p className="error">{loginError}</p> : null}
        </section>
      ) : null}

      {session?.mustChangePassword ? (
        <section className="panel login">
          <h2>Update credentials</h2>
          <p className="hint">You must update the bootstrap credentials before continuing.</p>
          <div className="grid two">
            <label>
              New username
              <input value={changeUsername} onChange={(e) => setChangeUsername(e.target.value)} />
            </label>
            <label>
              New password
              <input
                type="password"
                value={changePasswordValue}
                onChange={(e) => setChangePasswordValue(e.target.value)}
              />
            </label>
          </div>
          <div className="actions">
            <button onClick={handleChangePassword}>Update credentials</button>
          </div>
          {changeError ? <p className="error">{changeError}</p> : null}
        </section>
      ) : null}

      {!canViewDashboard && authChecked ? (
        <section className="panel notice">
          <h2>Authentication required</h2>
          <p className="hint">Sign in to view vault metrics, conflicts, and admin controls.</p>
        </section>
      ) : null}

      {canViewDashboard ? (
        <>
          <section className="grid three">
            <div className="panel metric">
              <h3>Total files</h3>
              <p className="metric-value">{metrics?.totalFiles ?? "--"}</p>
            </div>
            <div className="panel metric">
              <h3>Versions stored</h3>
              <p className="metric-value">{metrics?.totalVersions ?? "--"}</p>
            </div>
            <div className="panel metric">
              <h3>Bytes stored</h3>
              <p className="metric-value">{metrics?.totalBytes ?? "--"}</p>
            </div>
          </section>

          <section className="grid two">
            <div className="panel">
              <h2>Presence</h2>
              <ul className="list">
                {presence.map((item) => (
                  <li key={item.path}>
                    <span>{item.path}</span>
                    <span className="badge">{item.activeCount}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="panel">
              <h2>Conflicts</h2>
              <ul className="list">
                {conflicts.map((item) => (
                  <li key={item.path + item.createdAt}>
                    <span>{item.path}</span>
                    <span className="pill">{item.baseHash ?? "unknown"}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <section className="panel">
            <h2>Retention</h2>
            <div className="grid two">
              <label>
                Retention days
                <input
                  type="number"
                  value={retentionDays ?? 14}
                  onChange={(e) => setRetentionDays(Number(e.target.value))}
                />
              </label>
              <div className="actions">
                <button onClick={handleRetentionUpdate}>Update</button>
                <button className="ghost" onClick={handleRetentionRun}>
                  Run now
                </button>
              </div>
            </div>
            {retentionResult ? <p className="hint">{retentionResult}</p> : null}
          </section>

          <section className="panel">
            <h2>API Keys</h2>
            <div className="grid two">
              <label>
                Key name
                <input value={newKeyName} onChange={(e) => setNewKeyName(e.target.value)} />
              </label>
              <label>
                Role
                <select value={newKeyRole} onChange={(e) => setNewKeyRole(e.target.value)}>
                  <option value="client">client</option>
                  <option value="admin">admin</option>
                </select>
              </label>
            </div>
            <div className="actions">
              <button onClick={handleCreateKey}>Create key</button>
              {createdKey ? <span className="pill">New key: {createdKey}</span> : null}
            </div>
            <ul className="list">
              {apiKeys.map((item) => (
                <li key={item.id}>
                  <span>{item.name}</span>
                  <span className="muted">{item.prefix}</span>
                  <span className={`badge ${item.revokedAt ? "warn" : "ok"}`}>
                    {item.revokedAt ? "revoked" : item.role}
                  </span>
                  <button className="ghost" onClick={() => handleRevokeKey(item.id)}>
                    Revoke
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <section className="panel">
            <h2>Sync Logs</h2>
            <ul className="list">
              {logs.map((item) => (
                <li key={item.id}>
                  <span>{item.path ?? "-"}</span>
                  <span className="muted">{item.action}</span>
                  <span>{item.message}</span>
                </li>
              ))}
            </ul>
          </section>
        </>
      ) : null}
    </div>
  );
}
