import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { io as createClient } from "socket.io-client";
import { startTestServer, stopTestServer } from "../helpers/server.js";
import { createTestToken, testPublicKey } from "../helpers/testKeys.js";
import { disconnectDatabase, resetDatabase } from "../helpers/db.js";
import { purgeRedis } from "../helpers/redis.js";
import { sha256 } from "../helpers/hash.js";

const socketOptions = {
  transports: ["websocket"],
  reconnection: false,
  timeout: 4000,
  forceNew: true,
  autoConnect: false
};

describe.sequential("End-to-end sync flow", () => {
  const vaultId = "vault-1";
  let server: Awaited<ReturnType<typeof startTestServer>>;
  let api: ReturnType<typeof request>;

  beforeAll(async () => {
    process.env.JWT_PUBLIC_KEY = testPublicKey;
    server = await startTestServer();
    api = request(server.url);
  });

  beforeEach(async () => {
    await resetDatabase();
    await purgeRedis();
  });

  afterAll(async () => {
    await stopTestServer(server);
    await disconnectDatabase();
  });

  it("locks and streams deltas across clients", async () => {
    const token = createTestToken({ vaultId });
    const path = "work/notes.md";

    await api
      .post(`/api/v1/vaults/${vaultId}/files`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        path,
        content: "hello",
        contentHash: sha256("hello"),
        baseHash: null
      })
      .expect(201);

    const client1 = createClient(server.url, { auth: { token }, ...socketOptions });
    const client2 = createClient(server.url, { auth: { token }, ...socketOptions });

    await connectAndReady(client1);
    await connectAndReady(client2);

    const lock = await emitAck(client1, "lock:acquire", {
      path,
      line: 0,
      clientId: "client-1"
    });

    expect(lock).toMatchObject({ ok: true, status: "granted" });

    const denied = await emitAck(client2, "lock:acquire", {
      path,
      line: 0,
      clientId: "client-2"
    });

    expect(denied).toMatchObject({ ok: true, status: "denied" });

    const received = waitForEvent(client2, "sync:delta");

    const ack = await emitAck(client1, "sync:delta", {
      path,
      clientId: "client-1",
      from: 0,
      to: 0,
      text: "H"
    });

    expect(ack).toMatchObject({ ok: true });

    await expect(received).resolves.toMatchObject({
      path,
      clientId: "client-1",
      from: 0,
      to: 0,
      text: "H"
    });

    client1.disconnect();
    client2.disconnect();
  });

  it("allows API key auth for REST and WebSocket", async () => {
    const adminToken = createTestToken({ vaultId, role: "admin" });

    const created = await api
      .post(`/api/v1/vaults/${vaultId}/admin/api-keys`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "e2e", role: "client" })
      .expect(201);

    const apiKey = created.body.apiKey as string;

    await api
      .post(`/api/v1/vaults/${vaultId}/files`)
      .set("X-API-Key", apiKey)
      .send({
        path: "work/api-key.md",
        content: "hello",
        contentHash: sha256("hello"),
        baseHash: null
      })
      .expect(201);

    const client = createClient(server.url, {
      auth: { token: `ApiKey ${apiKey}` },
      ...socketOptions
    });

    await connectAndReady(client);

    const heartbeat = await emitAck(client, "presence:heartbeat", {
      path: "work/api-key.md",
      clientId: "client-3"
    });

    expect(heartbeat).toMatchObject({ ok: true, activeCount: 1 });

    client.disconnect();
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

function waitForEvent(client: ReturnType<typeof createClient>, event: string) {
  return new Promise<any>((resolve, reject) => {
    const timer = setTimeout(() => {
      client.off(event, onEvent);
      reject(new Error(`Event timeout for ${event}`));
    }, 4000);

    const onEvent = (payload: any) => {
      clearTimeout(timer);
      client.off(event, onEvent);
      resolve(payload);
    };

    client.on(event, onEvent);
  });
}
