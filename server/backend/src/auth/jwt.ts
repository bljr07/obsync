import jwt, { JwtPayload } from "jsonwebtoken";
import { getConfig } from "../config.js";

export type AuthPayload = {
  userId: string;
  vaultId: string;
  role?: string;
  mustChangePassword?: boolean;
};

export function verifyToken(token: string): AuthPayload {
  const config = getConfig();
  if (!config.jwtPublicKey) {
    throw new Error("JWT_PUBLIC_KEY is not configured");
  }

  const payload = jwt.verify(token, config.jwtPublicKey, {
    algorithms: ["RS256"],
    issuer: config.jwtIssuer,
    audience: config.jwtAudience
  }) as JwtPayload;

  const userId = typeof payload.sub === "string" ? payload.sub : "";
  const vaultId = typeof payload.vaultId === "string" ? payload.vaultId : "";
  const role = typeof payload.role === "string" ? payload.role : undefined;
  const mustChangePassword =
    typeof payload.mustChangePassword === "boolean" ? payload.mustChangePassword : undefined;

  if (!userId || !vaultId) {
    throw new Error("JWT missing required claims");
  }

  return { userId, vaultId, role, mustChangePassword };
}

export function signToken(payload: AuthPayload) {
  const config = getConfig();
  if (!config.jwtPrivateKey) {
    throw new Error("JWT_PRIVATE_KEY is not configured");
  }

  return jwt.sign(
    {
      vaultId: payload.vaultId,
      role: payload.role,
      mustChangePassword: payload.mustChangePassword
    },
    config.jwtPrivateKey,
    {
      algorithm: "RS256",
      subject: payload.userId,
      issuer: config.jwtIssuer,
      audience: config.jwtAudience,
      expiresIn: config.jwtExpiresIn
    }
  );
}
