import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { signToken } from "../auth/jwt.js";
import { setAuthCookie, clearAuthCookie } from "../auth/cookies.js";
import { loginSchema, changePasswordSchema } from "../validation/auth.js";
import { findUserById, findUserByUsername, updateUserCredentials } from "../db/userRepo.js";
import { verifyPassword, hashPassword } from "../auth/password.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.post(
  "/login",
  asyncHandler(async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "INVALID_BODY" });
    }

    const user = await findUserByUsername(parsed.data.username);
    if (!user) {
      return res.status(401).json({ error: "INVALID_CREDENTIALS" });
    }

    const valid = await verifyPassword(parsed.data.password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: "INVALID_CREDENTIALS" });
    }

    const token = signToken({
      userId: user.id,
      vaultId: parsed.data.vaultId,
      role: user.role,
      mustChangePassword: user.mustChangePassword
    });

    setAuthCookie(res, token);

    return res.status(200).json({
      ok: true,
      mustChangePassword: user.mustChangePassword,
      username: user.username,
      role: user.role
    });
  })
);

router.post(
  "/logout",
  asyncHandler(async (_req, res) => {
    clearAuthCookie(res);
    return res.status(200).json({ ok: true });
  })
);

router.get(
  "/me",
  requireAuth,
  asyncHandler(async (_req, res) => {
    const auth = res.locals.auth as { userId: string; vaultId: string; role?: string };
    const user = await findUserById(auth.userId);
    if (!user) {
      return res.status(404).json({ error: "NOT_FOUND" });
    }

    return res.status(200).json({
      userId: user.id,
      username: user.username,
      role: user.role,
      vaultId: auth.vaultId,
      mustChangePassword: user.mustChangePassword
    });
  })
);

router.post(
  "/change-password",
  requireAuth,
  asyncHandler(async (req, res) => {
    const auth = res.locals.auth as { userId: string };
    const parsed = changePasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "INVALID_BODY" });
    }

    const existing = await findUserByUsername(parsed.data.username);
    if (existing && existing.id !== auth.userId) {
      return res.status(409).json({ error: "USERNAME_TAKEN" });
    }

    await updateUserCredentials({
      id: auth.userId,
      username: parsed.data.username,
      passwordHash: await hashPassword(parsed.data.password),
      mustChangePassword: false
    });

    return res.status(200).json({ ok: true });
  })
);

export const authRouter = router;
