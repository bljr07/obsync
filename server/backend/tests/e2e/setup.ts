process.env.NODE_ENV = "test";
process.env.JWT_ISSUER = process.env.JWT_ISSUER ?? "obsync";
process.env.JWT_AUDIENCE = process.env.JWT_AUDIENCE ?? "obsync";
process.env.BOOTSTRAP_ADMIN_USERNAME =
  process.env.BOOTSTRAP_ADMIN_USERNAME ?? "admin";
process.env.DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgresql://obsync_e2e:obsync_e2e@localhost:55432/obsync_e2e";
process.env.REDIS_URL = process.env.REDIS_URL ?? "redis://127.0.0.1:56379";
