import type { StringValue } from "ms";

const DURATION_PATTERN =
  /^\d+(?:\s?(?:Years?|Yrs?|Y|Weeks?|W|Days?|D|Hours?|Hrs?|H|Minutes?|Mins?|Min|M|Seconds?|Secs?|Sec|s|Milliseconds?|Msecs?|Msec|Ms))?$/i;

function readJwtExpiresIn(): StringValue {
  const value = process.env.JWT_EXPIRES_IN ?? "12h";
  if (!DURATION_PATTERN.test(value)) {
    throw new Error("JWT_EXPIRES_IN must be a numeric duration like 12h, 30m, or 3600");
  }

  return value as StringValue;
}

export function getConfig() {
  return {
    port: Number(process.env.PORT ?? "3000"),
    databaseUrl: process.env.DATABASE_URL ?? "",
    redisUrl: process.env.REDIS_URL ?? "redis://localhost:6379",
    jwtIssuer: process.env.JWT_ISSUER ?? "obsync",
    jwtAudience: process.env.JWT_AUDIENCE ?? "obsync",
    jwtPublicKey: (process.env.JWT_PUBLIC_KEY ?? "").replace(/\\n/g, "\n"),
    jwtPrivateKey: (process.env.JWT_PRIVATE_KEY ?? "").replace(/\\n/g, "\n"),
    jwtExpiresIn: readJwtExpiresIn(),
    bootstrapAdminUsername: process.env.BOOTSTRAP_ADMIN_USERNAME ?? "admin",
    bootstrapAdminPassword: process.env.BOOTSTRAP_ADMIN_PASSWORD ?? "",
    cookieSecure:
      process.env.COOKIE_SECURE === "true" || process.env.NODE_ENV === "production",
    cookieDomain: process.env.COOKIE_DOMAIN ?? ""
  };
}
