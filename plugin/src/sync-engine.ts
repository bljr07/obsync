import { App, TFile } from "obsidian";
import type { Extension } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import type { Socket } from "socket.io-client";
import { ApiClient, type ApiClientSettings } from "./api-client.js";
import {
  createEditorSyncExtension,
  remoteChangeAnnotation,
  setLockedLine,
  type EditorDelta
} from "./editor-hook.js";
import { sha256Hex } from "./utils/hash.js";
import type { SyncDelta, SyncMode } from "../../common/types.js";

export type SyncSettings = ApiClientSettings & {
  heartbeatIntervalMs: number;
  debounceMs: number;
};

type SyncEngineEvents = {
  onStatus?: (message: string) => void;
};

export class SyncEngine {
  private app: App;
  private settings: SyncSettings;
  private api: ApiClient;
  private socket: Socket | null = null;
  private heartbeatTimer: number | null = null;
  private debounceTimers = new Map<string, number>();
  private fileHashes = new Map<string, string>();
  private activeFilePath: string | null = null;
  private mode: SyncMode = "solo";
  private clientId: string;
  private events: SyncEngineEvents;
  private lockLine: number | null = null;
  private lockRefreshTimer: number | null = null;
  private editorView: EditorView | null = null;

  constructor(app: App, settings: SyncSettings, events: SyncEngineEvents = {}) {
    this.app = app;
    this.settings = settings;
    this.api = new ApiClient(settings);
    this.events = events;
    this.clientId = `client-${Math.random().toString(36).slice(2, 10)}`;
  }

  start() {
    this.connectSocket();
    this.bindVaultEvents();
    this.bindActiveFile();
    this.startHeartbeat();
  }

  stop() {
    this.releaseLock();
    this.disconnectSocket();
    this.clearHeartbeat();
    for (const timer of this.debounceTimers.values()) {
      window.clearTimeout(timer);
    }
    this.debounceTimers.clear();
    this.stopLockRefresh();
    this.updateLockedIndicator(null);
    this.editorView = null;
  }

  updateSettings(settings: SyncSettings) {
    this.settings = settings;
    this.api.updateSettings(settings);
    this.disconnectSocket();
    this.connectSocket();
    this.startHeartbeat();
  }

  getEditorExtension(): Extension {
    return createEditorSyncExtension({
      onLineChange: (line) => this.onCursorLine(line),
      onChanges: (delta) => this.onEditorDelta(delta),
      onViewReady: (view) => {
        this.editorView = view;
      }
    });
  }

  private bindVaultEvents() {
    this.app.vault.on("modify", (file) => {
      if (file instanceof TFile) {
        this.queueUpload(file);
      }
    });

    this.app.vault.on("create", (file) => {
      if (file instanceof TFile) {
        this.queueUpload(file);
      }
    });
  }

  private bindActiveFile() {
    this.app.workspace.on("active-leaf-change", () => {
      const file = this.app.workspace.getActiveFile();
      const nextPath = file?.path ?? null;
      if (this.activeFilePath && this.activeFilePath !== nextPath) {
        this.releaseLock();
      }
      this.activeFilePath = nextPath;
    });

    this.activeFilePath = this.app.workspace.getActiveFile()?.path ?? null;
  }

  private connectSocket() {
    this.socket = this.api.createSocket();
    this.socket.on("connect", () => {
      this.events.onStatus?.("Obsync connected");
    });
    this.socket.on("disconnect", () => {
      this.events.onStatus?.("Obsync disconnected");
    });
    this.socket.on("sync:delta", (payload: SyncDelta) => this.applyRemoteDelta(payload));
  }

  private disconnectSocket() {
    this.socket?.disconnect();
    this.socket = null;
  }

  private startHeartbeat() {
    this.clearHeartbeat();
    this.heartbeatTimer = window.setInterval(() => this.sendHeartbeat(), this.settings.heartbeatIntervalMs);
  }

  private clearHeartbeat() {
    if (this.heartbeatTimer !== null) {
      window.clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private async sendHeartbeat() {
    if (!this.socket || !this.activeFilePath) {
      return;
    }

    this.socket.emit(
      "presence:heartbeat",
      { path: this.activeFilePath, clientId: this.clientId },
      (response: { ok: boolean; activeCount?: number }) => {
        if (!response?.ok || typeof response.activeCount !== "number") {
          return;
        }

        const nextMode: SyncMode = response.activeCount > 1 ? "collab" : "solo";
        if (nextMode !== this.mode) {
          this.mode = nextMode;
          this.events.onStatus?.(`Obsync mode: ${this.mode}`);
          if (this.mode === "solo") {
            this.releaseLock();
          }
        }
      }
    );
  }

  private queueUpload(file: TFile) {
    const path = file.path;
    const existing = this.debounceTimers.get(path);
    if (existing) {
      window.clearTimeout(existing);
    }

    const timer = window.setTimeout(() => this.uploadFile(file), this.settings.debounceMs);
    this.debounceTimers.set(path, timer);
  }

  private async uploadFile(file: TFile) {
    try {
      const content = await this.app.vault.read(file);
      const contentHash = await sha256Hex(content);
      const baseHash = this.fileHashes.get(file.path) ?? null;

      const result = await this.api.uploadFile({
        path: file.path,
        content,
        contentHash,
        baseHash
      });

      if (result.conflict) {
        this.events.onStatus?.(`Conflict detected for ${file.path}`);
        this.fileHashes.set(file.path, result.latestHash);
        return;
      }

      this.fileHashes.set(file.path, result.hash);
    } catch (error) {
      this.events.onStatus?.(`Upload failed for ${file.path}`);
    }
  }

  private onCursorLine(line: number) {
    if (!this.socket || !this.activeFilePath || this.mode !== "collab") {
      return;
    }

    this.updateLockedIndicator(null);

    if (this.lockLine !== null && this.lockLine !== line) {
      this.releaseLock();
    }

    if (this.lockLine === line) {
      return;
    }

    this.lockLine = line;
    this.socket.emit(
      "lock:acquire",
      { path: this.activeFilePath, line, clientId: this.clientId },
      (response: { ok: boolean; status?: string; holder?: string }) => {
        if (!response?.ok) {
          return;
        }

        if (response.status === "granted") {
          this.updateLockedIndicator(null);
          this.startLockRefresh();
        } else if (response.status === "denied") {
          this.stopLockRefresh();
          this.lockLine = null;
          this.updateLockedIndicator(line);
          this.events.onStatus?.("Line locked by another client");
        }
      }
    );
  }

  private onEditorDelta(delta: EditorDelta) {
    if (!this.socket || !this.activeFilePath || this.mode !== "collab") {
      return;
    }

    if (this.lockLine === null) {
      return;
    }

    const view = this.editorView;
    if (!view) {
      return;
    }

    const changeLine = view.state.doc.lineAt(delta.from).number - 1;
    if (changeLine !== this.lockLine) {
      return;
    }

    this.emitCharDeltas(delta);
  }

  private emitCharDeltas(delta: EditorDelta) {
    const socket = this.socket;
    const path = this.activeFilePath;
    if (!socket || !path) {
      return;
    }

    const deleteCount = delta.to - delta.from;
    if (deleteCount > 0) {
      for (let i = 0; i < deleteCount; i += 1) {
        const from = delta.to - 1 - i;
        socket.emit("sync:delta", {
          path,
          clientId: this.clientId,
          from,
          to: from + 1,
          text: ""
        });
      }
    }

    const chars = Array.from(delta.text ?? "");
    if (chars.length > 0) {
      for (let i = 0; i < chars.length; i += 1) {
        socket.emit("sync:delta", {
          path,
          clientId: this.clientId,
          from: delta.from + i,
          to: delta.from + i,
          text: chars[i]
        });
      }
    }
  }

  private applyRemoteDelta(delta: SyncDelta) {
    if (!this.activeFilePath || delta.path !== this.activeFilePath) {
      return;
    }

    if (delta.clientId === this.clientId) {
      return;
    }

    if (!this.editorView) {
      return;
    }

    this.editorView.dispatch({
      changes: { from: delta.from, to: delta.to, insert: delta.text },
      annotations: remoteChangeAnnotation.of(true)
    });
  }

  private startLockRefresh() {
    this.stopLockRefresh();
    this.lockRefreshTimer = window.setInterval(() => this.refreshLock(), 5000);
  }

  private stopLockRefresh() {
    if (this.lockRefreshTimer !== null) {
      window.clearInterval(this.lockRefreshTimer);
      this.lockRefreshTimer = null;
    }
  }

  private refreshLock() {
    if (!this.socket || !this.activeFilePath || this.lockLine === null) {
      return;
    }

    this.socket.emit("lock:refresh", {
      path: this.activeFilePath,
      line: this.lockLine,
      clientId: this.clientId
    });
  }

  private releaseLock() {
    if (!this.socket || !this.activeFilePath || this.lockLine === null) {
      return;
    }

    const line = this.lockLine;
    this.lockLine = null;
    this.stopLockRefresh();
    this.updateLockedIndicator(null);
    this.socket.emit("lock:release", {
      path: this.activeFilePath,
      line,
      clientId: this.clientId
    });
  }

  private updateLockedIndicator(line: number | null) {
    if (!this.editorView) {
      return;
    }

    setLockedLine(this.editorView, line);
  }
}
