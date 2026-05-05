import { io, type Socket } from "socket.io-client";
import type {
  BatchDownloadRequest,
  BatchUploadRequest,
  FileUploadRequest,
  BatchDownloadResult,
  BatchUploadResult
} from "../../common/types.js";

export type AuthMode = "jwt" | "apiKey";

export type ApiClientSettings = {
  serverUrl: string;
  vaultId: string;
  authMode: AuthMode;
  authToken: string;
};

export class ApiClient {
  private settings: ApiClientSettings;

  constructor(settings: ApiClientSettings) {
    this.settings = settings;
  }

  updateSettings(settings: ApiClientSettings) {
    this.settings = settings;
  }

  getVaultId() {
    return this.settings.vaultId;
  }

  private getAuthHeaders() {
    if (this.settings.authMode === "apiKey") {
      return { "X-API-Key": this.settings.authToken };
    }

    return { Authorization: `Bearer ${this.settings.authToken}` };
  }

  async uploadFile(payload: FileUploadRequest) {
    const res = await fetch(
      `${this.settings.serverUrl}/api/v1/vaults/${this.settings.vaultId}/files`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...this.getAuthHeaders()
        },
        body: JSON.stringify(payload)
      }
    );

    if (res.status === 409) {
      const body = await res.json();
      return { conflict: true, latestHash: body.latestHash as string };
    }

    if (!res.ok) {
      throw new Error(`Upload failed: ${res.status}`);
    }

    const body = await res.json();
    return { conflict: false, hash: body.hash as string };
  }

  async getFile(path: string) {
    const res = await fetch(
      `${this.settings.serverUrl}/api/v1/vaults/${this.settings.vaultId}/files/content?path=${encodeURIComponent(
        path
      )}`,
      {
        headers: {
          ...this.getAuthHeaders()
        }
      }
    );

    if (!res.ok) {
      throw new Error(`Fetch failed: ${res.status}`);
    }

    return res.json() as Promise<{ content: string; hash: string }>;
  }

  async listFiles(prefix = "") {
    const url = new URL(
      `${this.settings.serverUrl}/api/v1/vaults/${this.settings.vaultId}/files`
    );
    if (prefix) {
      url.searchParams.set("prefix", prefix);
    }

    const res = await fetch(url.toString(), {
      headers: { ...this.getAuthHeaders() }
    });

    if (!res.ok) {
      throw new Error(`List failed: ${res.status}`);
    }

    return res.json() as Promise<{ items: { path: string; hash: string }[] }>;
  }

  async batchUpload(request: BatchUploadRequest) {
    const res = await fetch(
      `${this.settings.serverUrl}/api/v1/vaults/${this.settings.vaultId}/batch/upload`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...this.getAuthHeaders()
        },
        body: JSON.stringify(request)
      }
    );

    if (!res.ok && res.status !== 207) {
      throw new Error(`Batch upload failed: ${res.status}`);
    }

    const body = await res.json();
    return body.results as BatchUploadResult[];
  }

  async batchDownload(request: BatchDownloadRequest) {
    const res = await fetch(
      `${this.settings.serverUrl}/api/v1/vaults/${this.settings.vaultId}/batch/download`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...this.getAuthHeaders()
        },
        body: JSON.stringify(request)
      }
    );

    if (!res.ok) {
      throw new Error(`Batch download failed: ${res.status}`);
    }

    const body = await res.json();
    return body.results as BatchDownloadResult[];
  }

  createSocket() {
    const token =
      this.settings.authMode === "apiKey"
        ? `ApiKey ${this.settings.authToken}`
        : `Bearer ${this.settings.authToken}`;

    return io(this.settings.serverUrl, {
      transports: ["websocket"],
      auth: { token }
    }) as Socket;
  }
}
