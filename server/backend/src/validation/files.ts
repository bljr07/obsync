import { z } from "zod";

const pathSchema = z
  .string()
  .min(1)
  .refine((value) => !value.startsWith("/") && !value.includes(".."), {
    message: "INVALID_PATH"
  });

const hashSchema = z.string().length(64);
const baseHashSchema = z.string().min(1);

export const uploadSchema = z.object({
  path: pathSchema,
  content: z.string(),
  contentHash: hashSchema,
  baseHash: baseHashSchema.nullable().optional().default(null)
});

export const contentQuerySchema = z.object({
  path: pathSchema
});

export const listQuerySchema = z.object({
  prefix: pathSchema.optional(),
  cursor: pathSchema.optional(),
  limit: z.coerce.number().int().min(1).max(1000).optional()
});

export const batchUploadSchema = z.object({
  files: z.array(uploadSchema).min(1)
});

export const batchDownloadSchema = z.object({
  paths: z.array(pathSchema).min(1)
});
