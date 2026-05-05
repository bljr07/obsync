import { spawnSync } from "node:child_process";

const env = {
  ...process.env,
  DATABASE_URL:
    process.env.DATABASE_URL ??
    "postgresql://obsync_e2e:obsync_e2e@localhost:55432/obsync_e2e",
  REDIS_URL: process.env.REDIS_URL ?? "redis://127.0.0.1:56379"
};

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    env,
    stdio: "inherit",
    shell: process.platform === "win32",
    ...options
  });

  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed`);
  }
}

let exitCode = 0;

try {
  run("docker", ["compose", "-f", "../docker-compose.e2e.yml", "up", "-d", "--wait"]);
  run("npx", ["prisma", "db", "push"]);
  run("npx", ["vitest", "run", "-c", "vitest.e2e.config.ts"]);
} catch (error) {
  exitCode = 1;
} finally {
  const down = spawnSync(
    "docker",
    ["compose", "-f", "../docker-compose.e2e.yml", "down", "-v"],
    {
      env,
      stdio: "inherit",
      shell: process.platform === "win32"
    }
  );

  if (down.status !== 0) {
    exitCode = 1;
  }
}

process.exit(exitCode);
