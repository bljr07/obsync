export type SyncMode = "solo" | "collab";

export type LockStatus = "granted" | "denied" | "refreshed" | "released";

export type PresenceHeartbeat = {
  path: string;
  clientId: string;
};

export type PresenceAck = {
  ok: boolean;
  activeCount?: number;
  error?: string;
};

export type LockRequest = {
  path: string;
  line: number;
  clientId: string;
};

export type LockAck = {
  ok: boolean;
  status?: LockStatus;
  holder?: string | null;
  error?: string;
};

export type FileUploadRequest = {
  path: string;
  content: string;
  contentHash: string;
  baseHash: string | null;
};

export type FileUploadResponse = {
  path: string;
  hash: string;
};

export type BatchUploadRequest = {
  files: FileUploadRequest[];
};

export type BatchUploadResult =
  | { path: string; status: "created" | "updated"; hash: string }
  | { path: string; status: "conflict"; latestHash: string }
  | { path: string; status: "invalid_hash" };

export type BatchDownloadRequest = {
  paths: string[];
};

export type BatchDownloadResult =
  | { path: string; content: string; hash: string }
  | { path: string; error: "NOT_FOUND" };

export type SyncDelta = {
  path: string;
  clientId: string;
  from: number;
  to: number;
  text: string;
};

export type SyncDeltaAck = {
  ok: boolean;
  error?: string;
};
