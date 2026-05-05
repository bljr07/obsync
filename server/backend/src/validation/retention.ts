import { z } from "zod";

export const retentionBodySchema = z.object({
  retentionDays: z.coerce.number().int().min(1).max(3650)
});
