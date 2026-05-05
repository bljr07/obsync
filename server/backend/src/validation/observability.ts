import { z } from "zod";

const pathPrefixSchema = z
  .string()
  .min(1)
  .refine((value) => !value.startsWith("/") && !value.includes(".."), {
    message: "INVALID_PATH"
  });

export const conflictsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional()
});

export const presenceQuerySchema = z.object({
  prefix: pathPrefixSchema.optional()
});

export const logsQuerySchema = z.object({
  prefix: pathPrefixSchema.optional(),
  limit: z.coerce.number().int().min(1).max(200).optional()
});
