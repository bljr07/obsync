export type AuthConfig = {
  baseUrl: string;
  vaultId: string;
};

export type AuthSession = {
  userId?: string;
  username: string;
  role: string;
  vaultId: string;
  mustChangePassword: boolean;
};
type LoginResponse = {
  ok: boolean;
  mustChangePassword: boolean;
  username: string;
  role: string;
};

function buildHeaders() {
  return {
    "Content-Type": "application/json"
  };
}

function authUrl(baseUrl: string, path: string) {
  return `${baseUrl}/api/v1/auth${path}`;
}

function apiUrl(auth: AuthConfig, path: string) {
  return `${auth.baseUrl}/api/v1/vaults/${auth.vaultId}${path}`;
}

export async function getMetrics(auth: AuthConfig) {
  const res = await fetch(apiUrl(auth, "/observability/metrics"), {
    headers: buildHeaders(),
    credentials: "include"
  });

  if (!res.ok) {
    throw new Error(`Metrics failed: ${res.status}`);
  }

  return res.json() as Promise<{ totalFiles: number; totalVersions: number; totalBytes: number }>;
}

export async function getPresence(auth: AuthConfig) {
  const res = await fetch(apiUrl(auth, "/observability/presence"), {
    headers: buildHeaders(),
    credentials: "include"
  });

  if (!res.ok) {
    throw new Error(`Presence failed: ${res.status}`);
  }

  return res.json() as Promise<{ items: { path: string; activeCount: number }[] }>;
}

export async function getConflicts(auth: AuthConfig) {
  const res = await fetch(apiUrl(auth, "/observability/conflicts"), {
    headers: buildHeaders(),
    credentials: "include"
  });

  if (!res.ok) {
    throw new Error(`Conflicts failed: ${res.status}`);
  }

  return res.json() as Promise<{
    items: {
      id: string;
      path: string;
      baseHash: string | null;
      latestHash: string;
      createdAt: string;
    }[];
  }>;
}

export async function getSyncLogs(auth: AuthConfig) {
  const res = await fetch(apiUrl(auth, "/observability/logs"), {
    headers: buildHeaders(),
    credentials: "include"
  });

  if (!res.ok) {
    throw new Error(`Logs failed: ${res.status}`);
  }

  return res.json() as Promise<{
    items: {
      id: string;
      path: string | null;
      action: string;
      message: string;
      createdAt: string;
    }[];
  }>;
}

export async function getRetention(auth: AuthConfig) {
  const res = await fetch(apiUrl(auth, "/admin/retention"), {
    headers: buildHeaders(),
    credentials: "include"
  });

  if (!res.ok) {
    throw new Error(`Retention failed: ${res.status}`);
  }

  return res.json() as Promise<{ retentionDays: number }>;
}

export async function updateRetention(auth: AuthConfig, retentionDays: number) {
  const res = await fetch(apiUrl(auth, "/admin/retention"), {
    method: "PUT",
    headers: buildHeaders(),
    credentials: "include",
    body: JSON.stringify({ retentionDays })
  });

  if (!res.ok) {
    throw new Error(`Retention update failed: ${res.status}`);
  }

  return res.json() as Promise<{ retentionDays: number }>;
}

export async function runRetention(auth: AuthConfig) {
  const res = await fetch(apiUrl(auth, "/admin/retention/run"), {
    method: "POST",
    headers: buildHeaders(),
    credentials: "include"
  });

  if (!res.ok) {
    throw new Error(`Retention run failed: ${res.status}`);
  }

  return res.json() as Promise<{
    retentionDays: number;
    cutoff: string;
    versionsDeleted: number;
    conflictsDeleted: number;
  }>;
}

export async function listApiKeys(auth: AuthConfig) {
  const res = await fetch(apiUrl(auth, "/admin/api-keys"), {
    headers: buildHeaders(),
    credentials: "include"
  });

  if (!res.ok) {
    throw new Error(`API keys failed: ${res.status}`);
  }

  return res.json() as Promise<{
    items: {
      id: string;
      name: string;
      role: string;
      prefix: string;
      createdAt: string;
      revokedAt?: string | null;
      lastUsedAt?: string | null;
    }[];
  }>;
}

export async function createApiKey(auth: AuthConfig, name: string, role: string) {
  const res = await fetch(apiUrl(auth, "/admin/api-keys"), {
    method: "POST",
    headers: buildHeaders(),
    credentials: "include",
    body: JSON.stringify({ name, role })
  });

  if (!res.ok) {
    throw new Error(`API key create failed: ${res.status}`);
  }

  return res.json() as Promise<{
    id: string;
    name: string;
    role: string;
    prefix: string;
    createdAt: string;
    apiKey: string;
  }>;
}

export async function revokeApiKey(auth: AuthConfig, id: string) {
  const res = await fetch(apiUrl(auth, `/admin/api-keys/${id}/revoke`), {
    method: "POST",
    headers: buildHeaders(),
    credentials: "include"
  });

  if (!res.ok) {
    throw new Error(`API key revoke failed: ${res.status}`);
  }

  return res.json() as Promise<{ ok: boolean }>;
}

export async function login(
  baseUrl: string,
  username: string,
  password: string,
  vaultId: string
) {
  const res = await fetch(authUrl(baseUrl, "/login"), {
    method: "POST",
    headers: buildHeaders(),
    credentials: "include",
    body: JSON.stringify({ username, password, vaultId })
  });

  if (!res.ok) {
    throw new Error(`Login failed: ${res.status}`);
  }

  return res.json() as Promise<LoginResponse>;
}

export async function logout(baseUrl: string) {
  const res = await fetch(authUrl(baseUrl, "/logout"), {
    method: "POST",
    headers: buildHeaders(),
    credentials: "include"
  });

  if (!res.ok) {
    throw new Error(`Logout failed: ${res.status}`);
  }

  return res.json() as Promise<{ ok: boolean }>;
}

export async function getMe(baseUrl: string) {
  const res = await fetch(authUrl(baseUrl, "/me"), {
    headers: buildHeaders(),
    credentials: "include"
  });

  if (!res.ok) {
    throw new Error(`Session failed: ${res.status}`);
  }

  return res.json() as Promise<AuthSession>;
}

export async function changePassword(baseUrl: string, username: string, password: string) {
  const res = await fetch(authUrl(baseUrl, "/change-password"), {
    method: "POST",
    headers: buildHeaders(),
    credentials: "include",
    body: JSON.stringify({ username, password })
  });

  if (!res.ok) {
    throw new Error(`Change password failed: ${res.status}`);
  }

  return res.json() as Promise<{ ok: boolean }>;
}
