import type { Response } from "express";
import type { CookieOptions } from "express";
import { getConfig } from "../config.js";

export const AUTH_COOKIE_NAME = "obsync_token";

function getCookieOptions(): CookieOptions {
  const config = getConfig();
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: config.cookieSecure,
    domain: config.cookieDomain || undefined,
    path: "/"
  };
}

export function setAuthCookie(res: Response, token: string) {
  res.cookie(AUTH_COOKIE_NAME, token, getCookieOptions());
}

export function clearAuthCookie(res: Response) {
  res.clearCookie(AUTH_COOKIE_NAME, getCookieOptions());
}
