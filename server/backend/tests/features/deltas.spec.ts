import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { io as createClient } from "socket.io-client";
import { createTestToken, testPublicKey } from "../helpers/testKeys.js";
import { purgeRedis } from "../helpers/redis.js";
import { startTestServer, stopTestServer } from "../helpers/server.js";

describe.sequential("Delta streaming", () => {
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

  it("broadcasts deltas to other clients", async () => {
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

    const received = waitForEvent(client2, "sync:delta");

    const ack = await emitAck(client1, "sync:delta", {
      path: "work/notes.md",
      clientId: "client-1",
      from: 0,
      to: 0,
      text: "H"
    });

    expect(ack).toMatchObject({ ok: true });

    await expect(received).resolves.toMatchObject({
      path: "work/notes.md",
      clientId: "client-1",
      from: 0,
      to: 0,
      text: "H"
    });

    client1.disconnect();
    client2.disconnect();
  });

  it("rejects invalid delta payloads", async () => {
    const token = createTestToken({ vaultId });

    const client = createClient(server.url, {
      auth: { token },
      ...socketOptions
    });
    await connectAndReady(client);

    const ack = await emitAck(client, "sync:delta", {
      path: "",
      clientId: "client-1",
      from: -1,
      to: 0,
      text: 12
    });

    expect(ack).toMatchObject({ ok: false, error: "INVALID_DELTA" });

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
