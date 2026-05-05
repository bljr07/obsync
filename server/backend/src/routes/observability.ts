import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { listConflicts, getMetrics, listSyncLogs } from "../db/observabilityRepo.js";
import { presenceQuerySchema, conflictsQuerySchema, logsQuerySchema } from "../validation/observability.js";
import { listPresence } from "../redis/presence.js";
import { withRedis } from "../redis/withRedis.js";
import { requireVaultAccess } from "../middleware/auth.js";

const router = Router();

router.use("/vaults/:vaultId", requireVaultAccess);

router.get(
  "/vaults/:vaultId/observability/metrics",
  asyncHandler(async (req, res) => {
    const metrics = await getMetrics(req.params.vaultId);
    res.status(200).json(metrics);
  })
);

router.get(
  "/vaults/:vaultId/observability/conflicts",
  asyncHandler(async (req, res) => {
    const parsed = conflictsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ error: "INVALID_QUERY" });
    }

    const limit = parsed.data.limit ?? 50;
    const items = await listConflicts(req.params.vaultId, limit);

    return res.status(200).json({
      items: items.map((item) => ({
        id: item.id,
        path: item.path,
        baseHash: item.baseHash,
        latestHash: item.latestHash,
        createdAt: item.createdAt
      }))
    });
  })
);

router.get(
  "/vaults/:vaultId/observability/presence",
  asyncHandler(async (req, res) => {
    const parsed = presenceQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ error: "INVALID_QUERY" });
    }

    const items = await withRedis((redis) =>
      listPresence(redis, req.params.vaultId, parsed.data.prefix)
    );

    return res.status(200).json({ items });
  })
);

router.get(
  "/vaults/:vaultId/observability/logs",
  asyncHandler(async (req, res) => {
    const parsed = logsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ error: "INVALID_QUERY" });
    }

    const limit = parsed.data.limit ?? 50;
    const items = await listSyncLogs(req.params.vaultId, limit, parsed.data.prefix);

    return res.status(200).json({
      items: items.map((item) => ({
        id: item.id,
        path: item.path,
        action: item.action,
        message: item.message,
        createdAt: item.createdAt
      }))
    });
  })
);

export const observabilityRouter = router;
