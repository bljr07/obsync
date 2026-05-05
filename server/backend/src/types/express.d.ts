import type { AuthContext } from "../middleware/auth.js";

declare global {
  namespace Express {
    interface Locals {
      auth?: AuthContext;
    }
  }
}

export {};
