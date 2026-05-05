import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { io as createClient } from "socket.io-client";
import { createTestToken, testPublicKey } from "../helpers/testKeys.js";
import { purgeRedis } from "../helpers/redis.js";
import { startTestServer, stopTestServer } from "../helpers/server.js";

describe.sequential("Presence and locks", () => {
  const vaultId = "vault-1";
  let server: Awaited<ReturnType<typeof startTestServer>>;
  const socketOptions = {
    transports: ["websocket"],
    reconnection: false,
    timeout: 4000,
    forceNew: true,
    autoConnect: false
  };

  beforeAll(async () => {
    process.env.JWT_PUBLIC_KEY = testPublicKey;
    server = await startTestServer();
  });

  beforeEach(async () => {
    await purgeRedis();
  });

  afterAll(async () => {
    await stopTestServer(server);
  });

  it("tracks presence per file", async () => {
    const token = createTestToken({ vaultId });

    const client1 = createClient(server.url, {
      auth: { token },
      ...socketOptions
    });

    await connectAndReady(client1);

    const first = await emitAck(client1, "presence:heartbeat", {
      path: "work/notes.md",
      clientId: "client-1"
    });

    expect(first).toMatchObject({ ok: true, activeCount: 1 });

    const client2 = createClient(server.url, {
      auth: { token },
      ...socketOptions
    });

    await connectAndReady(client2);

    const second = await emitAck(client2, "presence:heartbeat", {
      path: "work/notes.md",
      clientId: "client-2"
    });

    expect(second).toMatchObject({ ok: true, activeCount: 2 });

    client1.disconnect();
    client2.disconnect();
  });

  it("enforces line locks", async () => {
    const token = createTestToken({ vaultId });

    const client1 = createClient(server.url, {
      auth: { token },
      ...socketOptions
    });
    await connectAndReady(client1);

    const client2 = createClient(server.url, {
      auth: { token },
      ...socketOptions
    });
    await connectAndReady(client2);

    const granted = await emitAck(client1, "lock:acquire", {
      path: "work/notes.md",
      line: 5,
      clientId: "client-1"
    });

    expect(granted).toMatchObject({ ok: true, status: "granted" });

    const denied = await emitAck(client2, "lock:acquire", {
      path: "work/notes.md",
      line: 5,
      clientId: "client-2"
    });

    expect(denied).toMatchObject({ ok: true, status: "denied", holder: "client-1" });

    const released = await emitAck(client1, "lock:release", {
      path: "work/notes.md",
      line: 5,
      clientId: "client-1"
    });

    expect(released).toMatchObject({ ok: true, status: "released" });

    const grantedAfter = await emitAck(client2, "lock:acquire", {
      path: "work/notes.md",
      line: 5,
      clientId: "client-2"
    });

    expect(grantedAfter).toMatchObject({ ok: true, status: "granted" });

    client1.disconnect();
    client2.disconnect();
  });
});

function connectAndReady(client: ReturnType<typeof createClient>) {
  return new Promise<void>((resolve, reject) => {
    if (client.connected) {
      resolve();
      return;
    }

    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("Socket connect timeout"));
    }, 4000);

    const onConnect = () => {
      // wait for server:ready
    };

    const onReady = () => {
      cleanup();
      resolve();
    };

    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };

    function cleanup() {
      clearTimeout(timer);
      client.off("connect", onConnect);
      client.off("connect_error", onError);
      client.off("server:ready", onReady);
    }

    client.once("connect", onConnect);
    client.once("connect_error", onError);
    client.once("server:ready", onReady);
    client.connect();
  });
}

function emitAck(
  client: ReturnType<typeof createClient>,
  event: string,
  payload: Record<string, unknown>
) {
  return new Promise<any>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Ack timeout for ${event}`));
    }, 4000);

    client.emit(event, payload, (response: any) => {
      clearTimeout(timer);
      resolve(response);
    });
  });
}

