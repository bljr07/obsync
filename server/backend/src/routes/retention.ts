import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { requireAdmin, requireVaultAccess } from "../middleware/auth.js";
import {
  applyRetention,
  getRetentionSettings,
  upsertRetentionSettings
} from "../db/retentionRepo.js";
import { retentionBodySchema } from "../validation/retention.js";

const router = Router();

router.use("/vaults/:vaultId/admin", requireVaultAccess, requireAdmin);

router.get(
  "/vaults/:vaultId/admin/retention",
  asyncHandler(async (req, res) => {
    const settings = await getRetentionSettings(req.params.vaultId);
    res.status(200).json({
      retentionDays: settings.retentionDays
    });
  })
);

router.put(
  "/vaults/:vaultId/admin/retention",
  asyncHandler(async (req, res) => {
    const parsed = retentionBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "INVALID_BODY" });
    }

    const settings = await upsertRetentionSettings(
      req.params.vaultId,
      parsed.data.retentionDays
    );

    return res.status(200).json({
      retentionDays: settings.retentionDays
    });
  })
);

router.post(
  "/vaults/:vaultId/admin/retention/run",
  asyncHandler(async (req, res) => {
    const settings = await getRetentionSettings(req.params.vaultId);
    const result = await applyRetention(req.params.vaultId, settings.retentionDays);

    return res.status(200).json({
      retentionDays: settings.retentionDays,
      cutoff: result.cutoff,
      versionsDeleted: result.versionsDeleted,
      conflictsDeleted: result.conflictsDeleted
    });
  })
);

export const retentionRouter = router;
