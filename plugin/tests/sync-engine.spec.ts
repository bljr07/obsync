import { describe, expect, it } from "vitest";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";

import { SyncEngine, type SyncSettings } from "../src/sync-engine.js";

type Emitted = { event: string; payload: any };

class FakeSocket {
  emitted: Emitted[] = [];

  emit(event: string, payload: any, ack?: (response: any) => void) {
    this.emitted.push({ event, payload });
    if (ack) {
      ack({ ok: true });
    }
  }

  on() {}
  disconnect() {}
}

function createEngine() {
  const settings: SyncSettings = {
    serverUrl: "http://localhost:3000",
    vaultId: "vault-1",
    authMode: "jwt",
    authToken: "token",
    heartbeatIntervalMs: 5000,
    debounceMs: 30000
  };

  const app = {} as any;
  return new SyncEngine(app, settings);
}

describe("sync engine", () => {
  it("emits deltas when collab lock matches", () => {
    const engine = createEngine();
    const socket = new FakeSocket();
    const engineAny = engine as any;
    engineAny.socket = socket;
    engineAny.mode = "collab";
    engineAny.activeFilePath = "work/notes.md";
    engineAny.lockLine = 0;

    const view = new EditorView({
      state: EditorState.create({
        doc: "hello\nworld",
        extensions: [engine.getEditorExtension()]
      }),
      parent: document.body
    });

    try {
      view.dispatch({ changes: { from: 0, to: 0, insert: "Hi" } });

      expect(socket.emitted).toHaveLength(2);
      expect(socket.emitted[0].event).toBe("sync:delta");
      expect(socket.emitted[0].payload).toMatchObject({
        path: "work/notes.md",
        from: 0,
        to: 0,
        text: "H",
        clientId: engineAny.clientId
      });
      expect(socket.emitted[1].payload).toMatchObject({
        path: "work/notes.md",
        from: 1,
        to: 1,
        text: "i",
        clientId: engineAny.clientId
      });
    } finally {
      view.destroy();
    }
  });

  it("does not emit deltas for other lines", () => {
    const engine = createEngine();
    const socket = new FakeSocket();
    const engineAny = engine as any;
    engineAny.socket = socket;
    engineAny.mode = "collab";
    engineAny.activeFilePath = "work/notes.md";
    engineAny.lockLine = 1;

    const view = new EditorView({
      state: EditorState.create({
        doc: "hello\nworld",
        extensions: [engine.getEditorExtension()]
      }),
      parent: document.body
    });

    try {
      view.dispatch({ changes: { from: 0, to: 0, insert: "H" } });

      expect(socket.emitted).toHaveLength(0);
    } finally {
      view.destroy();
    }
  });

  it("emits delete deltas per character", () => {
    const engine = createEngine();
    const socket = new FakeSocket();
    const engineAny = engine as any;
    engineAny.socket = socket;
    engineAny.mode = "collab";
    engineAny.activeFilePath = "work/notes.md";
    engineAny.lockLine = 0;

    const view = new EditorView({
      state: EditorState.create({
        doc: "hello",
        extensions: [engine.getEditorExtension()]
      }),
      parent: document.body
    });

    try {
      view.dispatch({ changes: { from: 0, to: 2, insert: "" } });

      expect(socket.emitted).toHaveLength(2);
      expect(socket.emitted[0].payload).toMatchObject({
        path: "work/notes.md",
        from: 1,
        to: 2,
        text: ""
      });
      expect(socket.emitted[1].payload).toMatchObject({
        path: "work/notes.md",
        from: 0,
        to: 1,
        text: ""
      });
    } finally {
      view.destroy();
    }
  });

  it("applies remote deltas for other clients", () => {
    const engine = createEngine();
    const engineAny = engine as any;
    engineAny.activeFilePath = "work/notes.md";

    const view = new EditorView({
      state: EditorState.create({
        doc: "abc",
        extensions: [engine.getEditorExtension()]
      }),
      parent: document.body
    });

    try {
      engineAny.applyRemoteDelta({
        path: "work/notes.md",
        clientId: "other",
        from: 1,
        to: 2,
        text: "Z"
      });

      expect(view.state.doc.toString()).toBe("aZc");

      engineAny.applyRemoteDelta({
        path: "work/notes.md",
        clientId: engineAny.clientId,
        from: 0,
        to: 1,
        text: "X"
      });

      expect(view.state.doc.toString()).toBe("aZc");
    } finally {
      view.destroy();
    }
  });
});
