import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { createServer } from "http";
import { Server } from "socket.io";
import { createApp } from "./app.js";
import { getConfig } from "./config.js";
import { createRedisClient } from "./redis/client.js";
import { registerSocketHandlers } from "./websocket/server.js";
import { ensureBootstrapAdmin } from "./auth/bootstrap.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

async function start() {
  const config = getConfig();
  const app = createApp();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: "*"
    }
  });

  const redis = createRedisClient();
  await redis.connect();

  await ensureBootstrapAdmin();

  registerSocketHandlers(io, redis);

  httpServer.listen(config.port, () => {
    console.log(`obsync backend listening on ${config.port}`);
  });

  const shutdown = async () => {
    io.close();
    await redis.quit();
    httpServer.close();
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

start().catch((error) => {
  console.error("Failed to start server", error);
  process.exit(1);
});
