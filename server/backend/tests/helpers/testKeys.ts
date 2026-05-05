import { generateKeyPairSync } from "crypto";
import jwt from "jsonwebtoken";

type TokenOptions = {
  userId?: string;
  vaultId?: string;
  role?: string;
};

const keyPair = generateKeyPairSync("rsa", {
  modulusLength: 2048
});

export const testPublicKey = keyPair.publicKey
  .export({ type: "spki", format: "pem" })
  .toString();

export const testPrivateKey = keyPair.privateKey
  .export({ type: "pkcs8", format: "pem" })
  .toString();

export function createTestToken(options: TokenOptions = {}) {
  const payload = {
    sub: options.userId ?? "user-1",
    vaultId: options.vaultId ?? "vault-1",
    role: options.role
  };

  return jwt.sign(payload, keyPair.privateKey, {
    algorithm: "RS256",
    issuer: "obsync",
    audience: "obsync",
    expiresIn: "1h"
  });
}
