import { spawnSync } from "node:child_process";

const env = {
  ...process.env,
  DATABASE_URL:
    process.env.DATABASE_URL ??
    "postgresql://obsync_e2e:obsync_e2e@localhost:55432/obsync_e2e",
  REDIS_URL: process.env.REDIS_URL ?? "redis://127.0.0.1:56379"
};

const result = spawnSync("npx", ["prisma", "db", "push"], {
  env,
  stdio: "inherit",
  shell: process.platform === "win32"
});

process.exit(result.status ?? 1);
