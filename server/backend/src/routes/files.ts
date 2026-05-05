import { Router } from "express";
import { sha256 } from "../utils/hash.js";
import { requireVaultAccess } from "../middleware/auth.js";
import { getFileByPath, listFiles, upsertFile } from "../db/vaultRepo.js";
import { recordSyncLog } from "../db/observabilityRepo.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  batchDownloadSchema,
  batchUploadSchema,
  contentQuerySchema,
  listQuerySchema,
  uploadSchema
} from "../validation/files.js";

const router = Router();

router.use("/vaults/:vaultId", requireVaultAccess);

router.post(
  "/vaults/:vaultId/files",
  asyncHandler(async (req, res) => {
  const parsed = uploadSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "INVALID_BODY" });
  }

  const { path, content, contentHash, baseHash } = parsed.data;
  const computedHash = sha256(content);
  if (computedHash !== contentHash) {
    return res.status(400).json({ error: "CONTENT_HASH_MISMATCH" });
  }

  const result = await upsertFile({
    vaultId: req.params.vaultId,
    path,
    content,
    hash: contentHash,
    baseHash
  });

  if (result.status === "conflict") {
    await recordSyncLog({
      vaultId: req.params.vaultId,
      path,
      action: "conflict",
      message: `Conflict detected for ${path}`
    });
    return res.status(409).json({
      error: "HASH_MISMATCH",
      latestHash: result.latestHash
    });
  }

  const statusCode = result.status === "created" ? 201 : 200;
  await recordSyncLog({
    vaultId: req.params.vaultId,
    path,
    action: result.status,
    message: `File ${result.status}`
  });
  return res.status(statusCode).json({ path, hash: result.hash });
  })
);

router.get(
  "/vaults/:vaultId/files/content",
  asyncHandler(async (req, res) => {
  const parsed = contentQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: "INVALID_QUERY" });
  }

  const entry = await getFileByPath(req.params.vaultId, parsed.data.path);
  if (!entry) {
    await recordSyncLog({
      vaultId: req.params.vaultId,
      path: parsed.data.path,
      action: "read_missing",
      message: `File not found: ${parsed.data.path}`
    });
    return res.status(404).json({ error: "NOT_FOUND" });
  }

  await recordSyncLog({
    vaultId: req.params.vaultId,
    path: entry.path,
    action: "read",
    message: `File read: ${entry.path}`
  });
  return res.status(200).json({
    path: entry.path,
    content: entry.content,
    hash: entry.hash,
    updatedAt: entry.updatedAt
  });
  })
);

router.get(
  "/vaults/:vaultId/files",
  asyncHandler(async (req, res) => {
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: "INVALID_QUERY" });
  }

  const limit = parsed.data.limit ?? 100;
  const { items, nextCursor } = await listFiles({
    vaultId: req.params.vaultId,
    prefix: parsed.data.prefix,
    cursor: parsed.data.cursor,
    limit
  });

  return res.status(200).json({ items, nextCursor });
  })
);

router.post(
  "/vaults/:vaultId/batch/upload",
  asyncHandler(async (req, res) => {
  const parsed = batchUploadSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "INVALID_BODY" });
  }

  const results = [] as Array<Record<string, unknown>>;
  let hasIssues = false;

  for (const file of parsed.data.files) {
    const computedHash = sha256(file.content);
    if (computedHash !== file.contentHash) {
      results.push({ path: file.path, status: "invalid_hash" });
      await recordSyncLog({
        vaultId: req.params.vaultId,
        path: file.path,
        action: "invalid_hash",
        message: `Invalid hash for ${file.path}`
      });
      hasIssues = true;
      continue;
    }

    const result = await upsertFile({
      vaultId: req.params.vaultId,
      path: file.path,
      content: file.content,
      hash: file.contentHash,
      baseHash: file.baseHash
    });

    if (result.status === "conflict") {
      results.push({
        path: file.path,
        status: "conflict",
        latestHash: result.latestHash
      });
      await recordSyncLog({
        vaultId: req.params.vaultId,
        path: file.path,
        action: "conflict",
        message: `Conflict detected for ${file.path}`
      });
      hasIssues = true;
      continue;
    }

    results.push({
      path: file.path,
      status: result.status,
      hash: result.hash
    });
    await recordSyncLog({
      vaultId: req.params.vaultId,
      path: file.path,
      action: result.status,
      message: `File ${result.status}`
    });
  }

  return res.status(hasIssues ? 207 : 200).json({ results });
  })
);

router.post(
  "/vaults/:vaultId/batch/download",
  asyncHandler(async (req, res) => {
  const parsed = batchDownloadSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "INVALID_BODY" });
  }

  const results = [] as Array<Record<string, unknown>>;

  for (const path of parsed.data.paths) {
    const entry = await getFileByPath(req.params.vaultId, path);
    if (!entry) {
      results.push({ path, error: "NOT_FOUND" });
      await recordSyncLog({
        vaultId: req.params.vaultId,
        path,
        action: "read_missing",
        message: `File not found: ${path}`
      });
      continue;
    }

    results.push({ path, content: entry.content, hash: entry.hash });
    await recordSyncLog({
      vaultId: req.params.vaultId,
      path: entry.path,
      action: "read",
      message: `File read: ${entry.path}`
    });
  }

  return res.status(200).json({ results });
  })
);

export const filesRouter = router;
