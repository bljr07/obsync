import { z } from "zod";

export const createApiKeySchema = z.object({
  name: z.string().min(1).max(80),
  role: z.enum(["admin", "client"]).default("client")
});

export const revokeApiKeySchema = z.object({
  id: z.string().uuid()
});
