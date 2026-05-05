import type { NextFunction, Request, Response } from "express";
import { AUTH_COOKIE_NAME } from "../auth/cookies.js";
import { verifyToken } from "../auth/jwt.js";
import { verifyApiKey } from "../auth/apiKey.js";

export type AuthContext = {
  userId: string;
  vaultId: string;
  role?: string;
  apiKeyId?: string;
  mustChangePassword?: boolean;
};

function parseAuthHeader(header: string) {
  if (header.startsWith("Bearer ")) {
    return { scheme: "bearer", token: header.slice("Bearer ".length) } as const;
  }

  if (header.startsWith("ApiKey ")) {
    return { scheme: "apikey", token: header.slice("ApiKey ".length) } as const;
  }

  return null;
}

function parseCookieHeader(header: string | undefined) {
  if (!header) {
    return {} as Record<string, string>;
  }

  return header.split(";").reduce<Record<string, string>>((acc, item) => {
    const [rawKey, ...rest] = item.trim().split("=");
    if (!rawKey) {
      return acc;
    }
    acc[rawKey] = decodeURIComponent(rest.join("="));
    return acc;
  }, {});
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.header("authorization") ?? req.header("Authorization");
  const apiKeyHeader = req.header("x-api-key") ?? req.header("X-API-Key");
  const cookies = parseCookieHeader(req.header("cookie") ?? req.header("Cookie"));
  const cookieToken = cookies[AUTH_COOKIE_NAME];

  try {
    if (apiKeyHeader) {
      const payload = await verifyApiKey(apiKeyHeader);
      res.locals.auth = {
        userId: `api-key:${payload.apiKeyId}`,
        vaultId: payload.vaultId,
        role: payload.role,
        apiKeyId: payload.apiKeyId,
        mustChangePassword: false
      };
      return next();
    }

    if (!header && !cookieToken) {
      return res.status(401).json({ error: "UNAUTHORIZED" });
    }
    if (header) {
      const parsed = parseAuthHeader(header);
      if (!parsed) {
        return res.status(401).json({ error: "UNAUTHORIZED" });
      }

      if (parsed.scheme === "bearer") {
        const payload = verifyToken(parsed.token);
        res.locals.auth = payload;
        return next();
      }

      const payload = await verifyApiKey(parsed.token);
      res.locals.auth = {
        userId: `api-key:${payload.apiKeyId}`,
        vaultId: payload.vaultId,
        role: payload.role,
        apiKeyId: payload.apiKeyId,
        mustChangePassword: false
      };
      return next();
    }

    if (cookieToken) {
      const payload = verifyToken(cookieToken);
      res.locals.auth = payload;
      return next();
    }

    return res.status(401).json({ error: "UNAUTHORIZED" });
  } catch (error) {
    return res.status(401).json({ error: "UNAUTHORIZED" });
  }
}

export function requirePasswordChange(req: Request, res: Response, next: NextFunction) {
  const auth = res.locals.auth as AuthContext | undefined;
  if (!auth) {
    return res.status(401).json({ error: "UNAUTHORIZED" });
  }

  if (auth.mustChangePassword) {
    return res.status(403).json({ error: "PASSWORD_CHANGE_REQUIRED" });
  }

  return next();
}

export function requireVaultAccess(req: Request, res: Response, next: NextFunction) {
  const auth = res.locals.auth as AuthContext | undefined;
  if (!auth) {
    return res.status(401).json({ error: "UNAUTHORIZED" });
  }

  if (auth.vaultId !== req.params.vaultId) {
    return res.status(403).json({ error: "FORBIDDEN" });
  }

  return next();
}

export function requireAdmin(_req: Request, res: Response, next: NextFunction) {
  const auth = res.locals.auth as AuthContext | undefined;
  if (!auth) {
    return res.status(401).json({ error: "UNAUTHORIZED" });
  }

  if (auth.role !== "admin") {
    return res.status(403).json({ error: "FORBIDDEN" });
  }

  return next();
}

