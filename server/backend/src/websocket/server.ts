import type { Server } from "socket.io";
import { verifyToken } from "../auth/jwt.js";
import { verifyApiKey } from "../auth/apiKey.js";
import { acquireLock, refreshLock, releaseLock } from "../redis/locks.js";
import { heartbeatPresence } from "../redis/presence.js";

const MAX_PATH_LENGTH = 1024;
const MAX_DELTA_LENGTH = 5000;

function parseAuthHeader(header: string) {
  if (header.startsWith("Bearer ")) {
    return { scheme: "bearer", token: header.slice("Bearer ".length) } as const;
  }

  if (header.startsWith("ApiKey ")) {
    return { scheme: "apikey", token: header.slice("ApiKey ".length) } as const;
  }

  return null;
}

function extractAuth(socket: any) {
  const authToken = socket.handshake?.auth?.token;
  if (typeof authToken === "string") {
    const parsed = parseAuthHeader(authToken);
    if (parsed) {
      return parsed;
    }

    const looksLikeJwt = authToken.split(".").length === 3;
    return looksLikeJwt
      ? { scheme: "bearer", token: authToken }
      : { scheme: "apikey", token: authToken };
  }

  const header = socket.handshake?.headers?.authorization;
  if (typeof header === "string") {
    return parseAuthHeader(header);
  }

  return null;
}

export function registerSocketHandlers(io: Server, redis: any) {
  io.use(async (socket, next) => {
    const authToken = extractAuth(socket);
    if (!authToken) {
      return next(new Error("UNAUTHORIZED"));
    }

    try {
      if (authToken.scheme === "bearer") {
        const auth = verifyToken(authToken.token);
        socket.data.auth = auth;
        return next();
      }

      const apiKey = await verifyApiKey(authToken.token);
      socket.data.auth = {
        userId: `api-key:${apiKey.apiKeyId}`,
        vaultId: apiKey.vaultId,
        role: apiKey.role,
        apiKeyId: apiKey.apiKeyId
      };
      return next();
    } catch (error) {
      return next(new Error("UNAUTHORIZED"));
    }
  });

  io.on("connection", (socket) => {
    const auth = socket.data.auth;
    const room = `vault:${auth.vaultId}`;
    socket.join(room);

    socket.on("presence:heartbeat", async (payload, ack) => {
      const auth = socket.data.auth;
      const path = payload?.path;
      const clientId = payload?.clientId;

      if (typeof path !== "string" || path.length > MAX_PATH_LENGTH) {
        return ack?.({ ok: false, error: "INVALID_PATH" });
      }

      if (typeof clientId !== "string" || !clientId) {
        return ack?.({ ok: false, error: "INVALID_CLIENT" });
      }

      try {
        if (redis?.isOpen === false || redis?.isReady === false) {
          return ack?.({ ok: false, error: "REDIS_CLOSED" });
        }

        const activeCount = await heartbeatPresence(redis, auth.vaultId, path, clientId);
        return ack?.({ ok: true, activeCount });
      } catch (error) {
        return ack?.({ ok: false, error: "REDIS_ERROR" });
      }
    });

    socket.on("lock:acquire", async (payload, ack) => {
      const auth = socket.data.auth;
      const path = payload?.path;
      const line = payload?.line;
      const clientId = payload?.clientId;

      if (typeof path !== "string" || path.length > MAX_PATH_LENGTH) {
        return ack?.({ ok: false, error: "INVALID_PATH" });
      }

      if (typeof line !== "number" || line < 0) {
        return ack?.({ ok: false, error: "INVALID_LINE" });
      }

      if (typeof clientId !== "string" || !clientId) {
        return ack?.({ ok: false, error: "INVALID_CLIENT" });
      }

      try {
        if (redis?.isOpen === false || redis?.isReady === false) {
          return ack?.({ ok: false, error: "REDIS_CLOSED" });
        }

        const result = await acquireLock(redis, auth.vaultId, path, line, clientId);
        return ack?.({ ok: true, ...result });
      } catch (error) {
        return ack?.({ ok: false, error: "REDIS_ERROR" });
      }
    });

    socket.on("lock:refresh", async (payload, ack) => {
      const auth = socket.data.auth;
      const path = payload?.path;
      const line = payload?.line;
      const clientId = payload?.clientId;

      if (typeof path !== "string" || path.length > MAX_PATH_LENGTH) {
        return ack?.({ ok: false, error: "INVALID_PATH" });
      }

      if (typeof line !== "number" || line < 0) {
        return ack?.({ ok: false, error: "INVALID_LINE" });
      }

      if (typeof clientId !== "string" || !clientId) {
        return ack?.({ ok: false, error: "INVALID_CLIENT" });
      }

      try {
        if (redis?.isOpen === false || redis?.isReady === false) {
          return ack?.({ ok: false, error: "REDIS_CLOSED" });
        }

        const result = await refreshLock(redis, auth.vaultId, path, line, clientId);
        return ack?.({ ok: true, ...result });
      } catch (error) {
        return ack?.({ ok: false, error: "REDIS_ERROR" });
      }
    });

    socket.on("lock:release", async (payload, ack) => {
      const auth = socket.data.auth;
      const path = payload?.path;
      const line = payload?.line;
      const clientId = payload?.clientId;

      if (typeof path !== "string" || path.length > MAX_PATH_LENGTH) {
        return ack?.({ ok: false, error: "INVALID_PATH" });
      }

      if (typeof line !== "number" || line < 0) {
        return ack?.({ ok: false, error: "INVALID_LINE" });
      }

      if (typeof clientId !== "string" || !clientId) {
        return ack?.({ ok: false, error: "INVALID_CLIENT" });
      }

      try {
        if (redis?.isOpen === false || redis?.isReady === false) {
          return ack?.({ ok: false, error: "REDIS_CLOSED" });
        }

        const result = await releaseLock(redis, auth.vaultId, path, line, clientId);
        return ack?.({ ok: true, ...result });
      } catch (error) {
        return ack?.({ ok: false, error: "REDIS_ERROR" });
      }
    });

    socket.on("sync:delta", (payload, ack) => {
      const path = payload?.path;
      const clientId = payload?.clientId;
      const from = payload?.from;
      const to = payload?.to;
      const text = payload?.text;

      if (typeof path !== "string" || !path || path.length > MAX_PATH_LENGTH) {
        return ack?.({ ok: false, error: "INVALID_DELTA" });
      }

      if (typeof clientId !== "string" || !clientId) {
        return ack?.({ ok: false, error: "INVALID_DELTA" });
      }

      if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to < from) {
        return ack?.({ ok: false, error: "INVALID_DELTA" });
      }

      if (typeof text !== "string" || text.length > MAX_DELTA_LENGTH) {
        return ack?.({ ok: false, error: "INVALID_DELTA" });
      }

      socket.to(room).emit("sync:delta", { path, clientId, from, to, text });
      return ack?.({ ok: true });
    });

    socket.emit("server:ready", { ok: true });
  });
}
