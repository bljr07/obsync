import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { requireAdmin, requireVaultAccess } from "../middleware/auth.js";
import { createApiKeySchema, revokeApiKeySchema } from "../validation/apiKeys.js";
import { createApiKey, listApiKeys, revokeApiKey } from "../db/apiKeyRepo.js";

const router = Router();

router.use("/vaults/:vaultId/admin", requireVaultAccess, requireAdmin);

router.get(
  "/vaults/:vaultId/admin/api-keys",
  asyncHandler(async (req, res) => {
    const items = await listApiKeys(req.params.vaultId);

    return res.status(200).json({
      items: items.map((item) => ({
        id: item.id,
        name: item.name,
        role: item.role,
        prefix: item.prefix,
        createdAt: item.createdAt,
        revokedAt: item.revokedAt,
        lastUsedAt: item.lastUsedAt
      }))
    });
  })
);

router.post(
  "/vaults/:vaultId/admin/api-keys",
  asyncHandler(async (req, res) => {
    const parsed = createApiKeySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "INVALID_BODY" });
    }

    const record = await createApiKey({
      vaultId: req.params.vaultId,
      name: parsed.data.name,
      role: parsed.data.role
    });

    return res.status(201).json({
      id: record.id,
      name: record.name,
      role: record.role,
      prefix: record.prefix,
      createdAt: record.createdAt,
      apiKey: record.apiKey
    });
  })
);

router.post(
  "/vaults/:vaultId/admin/api-keys/:id/revoke",
  asyncHandler(async (req, res) => {
    const parsed = revokeApiKeySchema.safeParse({ id: req.params.id });
    if (!parsed.success) {
      return res.status(400).json({ error: "INVALID_ID" });
    }

    const result = await revokeApiKey(req.params.vaultId, parsed.data.id);
    if (result.count === 0) {
      return res.status(404).json({ error: "NOT_FOUND" });
    }

    return res.status(200).json({ ok: true });
  })
);

export const apiKeysRouter = router;
