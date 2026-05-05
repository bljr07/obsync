import { randomBytes } from "crypto";
import { getConfig } from "../config.js";
import { createUser, countUsers } from "../db/userRepo.js";
import { hashPassword } from "./password.js";

export type BootstrapResult = {
  created: boolean;
  username: string;
  password: string;
};

function generatePassword() {
  return randomBytes(18).toString("base64url");
}

export async function ensureBootstrapAdmin(): Promise<BootstrapResult> {
  const existing = await countUsers();
  if (existing > 0) {
    return { created: false, username: "", password: "" };
  }

  const config = getConfig();
  const username = config.bootstrapAdminUsername;
  const password = config.bootstrapAdminPassword || generatePassword();

  await createUser({
    username,
    passwordHash: await hashPassword(password),
    role: "admin",
    mustChangePassword: true
  });

  console.log(`[bootstrap] Created admin user "${username}"`);
  console.log(`[bootstrap] Username: ${username}`);
  console.log(`[bootstrap] Password: ${password}`);

  return { created: true, username, password };
}
