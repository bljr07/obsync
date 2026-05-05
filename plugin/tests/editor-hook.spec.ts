import { describe, expect, it } from "vitest";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import {
  createEditorSyncExtension,
  getLockedLine,
  hasLockedLineMarker,
  remoteChangeAnnotation,
  setLockedLine
} from "../src/editor-hook.js";

describe("editor hook", () => {
  it("tracks cursor line changes", () => {
    const lines: number[] = [];
    const extension = createEditorSyncExtension({
      onLineChange: (line) => lines.push(line)
    });

    const view = new EditorView({
      state: EditorState.create({
        doc: "alpha\nbeta\ngamma",
        extensions: [extension]
      }),
      parent: document.body
    });

    try {
      const secondLine = view.state.doc.line(2).from;
      const thirdLine = view.state.doc.line(3).from;

      view.dispatch({ selection: { anchor: secondLine } });
      view.dispatch({ selection: { anchor: thirdLine } });

      expect(lines).toEqual([1, 2]);
    } finally {
      view.destroy();
    }
  });

  it("emits deltas for local edits only", () => {
    const deltas: { from: number; to: number; text: string }[] = [];
    const extension = createEditorSyncExtension({
      onChanges: (delta) => deltas.push(delta)
    });

    const view = new EditorView({
      state: EditorState.create({
        doc: "hello",
        extensions: [extension]
      }),
      parent: document.body
    });

    try {
      view.dispatch({ changes: { from: 0, to: 0, insert: "A" } });
      view.dispatch({
        changes: { from: 1, to: 1, insert: "B" },
        annotations: remoteChangeAnnotation.of(true)
      });

      expect(deltas).toEqual([{ from: 0, to: 0, text: "A" }]);
    } finally {
      view.destroy();
    }
  });

  it("toggles locked line decoration", () => {
    const extension = createEditorSyncExtension({});

    const view = new EditorView({
      state: EditorState.create({
        doc: "one\ntwo",
        extensions: [extension]
      }),
      parent: document.body
    });

    try {
      setLockedLine(view, 1);
      expect(getLockedLine(view)).toBe(1);

      setLockedLine(view, null);
      expect(getLockedLine(view)).toBeNull();
    } finally {
      view.destroy();
    }
  });

  it("blocks edits on locked line", () => {
    const extension = createEditorSyncExtension({});

    const view = new EditorView({
      state: EditorState.create({
        doc: "hello\nworld",
        extensions: [extension]
      }),
      parent: document.body
    });

    try {
      setLockedLine(view, 0);
      view.dispatch({ changes: { from: 0, to: 0, insert: "X" } });
      expect(view.state.doc.toString()).toBe("hello\nworld");

      view.dispatch({ changes: { from: 6, to: 6, insert: "Y" } });
      expect(view.state.doc.toString()).toBe("hello\nYworld");
    } finally {
      view.destroy();
    }
  });

  it("renders a gutter marker for locked line", async () => {
    const extension = createEditorSyncExtension({});

    const view = new EditorView({
      state: EditorState.create({
        doc: "one\ntwo",
        extensions: [extension]
      }),
      parent: document.body
    });

    try {
      setLockedLine(view, 1);
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(hasLockedLineMarker(view)).toBe(true);
    } finally {
      view.destroy();
    }
  });
});
