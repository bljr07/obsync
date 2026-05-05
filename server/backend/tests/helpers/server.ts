import { createServer } from "http";
import type { AddressInfo } from "net";
import { Server } from "socket.io";
import { createApp } from "../../src/app.js";
import { createRedisClient } from "../../src/redis/client.js";
import { registerSocketHandlers } from "../../src/websocket/server.js";

const CONNECT_TIMEOUT_MS = 5000;
const LISTEN_TIMEOUT_MS = 5000;

async function connectWithTimeout(client: { connect: () => Promise<void> }) {
  await Promise.race([
    client.connect(),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Redis connect timeout")), CONNECT_TIMEOUT_MS)
    )
  ]);
}

async function listenWithTimeout(httpServer: ReturnType<typeof createServer>) {
  await Promise.race([
    new Promise<void>((resolve, reject) => {
      httpServer.once("error", reject);
      httpServer.listen(0, () => resolve());
    }),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("HTTP listen timeout")), LISTEN_TIMEOUT_MS)
    )
  ]);
}

export async function startTestServer() {
  const app = createApp();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: "*"
    }
  });

  const redis = createRedisClient();
  await connectWithTimeout(redis);

  registerSocketHandlers(io, redis);

  await listenWithTimeout(httpServer);
  const port = (httpServer.address() as AddressInfo).port;

  return {
    httpServer,
    io,
    redis,
    url: `http://localhost:${port}`
  };
}

export async function stopTestServer(server: {
  httpServer: ReturnType<typeof createServer>;
  io: Server;
  redis: { quit: Function };
}) {
  server.io.close();
  await server.redis.quit();

  await new Promise<void>((resolve) => server.httpServer.close(() => resolve()));
}
