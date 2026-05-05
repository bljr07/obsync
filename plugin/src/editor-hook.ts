import { EditorView, ViewPlugin, Decoration, WidgetType, type ViewUpdate } from "@codemirror/view";
import { Annotation, EditorState, StateEffect, StateField, type Extension } from "@codemirror/state";

export const remoteChangeAnnotation = Annotation.define<boolean>();
export const setLockedLineEffect = StateEffect.define<number | null>();

const lockedLineField = StateField.define<number | null>({
  create() {
    return null;
  },
  update(value, transaction) {
    for (const effect of transaction.effects) {
      if (effect.is(setLockedLineEffect)) {
        return effect.value;
      }
    }
    return value;
  },
  provide: (field) =>
    EditorView.decorations.from(field, (value, state) => {
      if (!state || value === null) {
        return Decoration.none;
      }

      const line = state.doc.line(value + 1);
      return Decoration.set([
        Decoration.line({ class: "obsync-locked-line" }).range(line.from),
        Decoration.widget({
          widget: lockedLineWidget,
          side: -1
        }).range(line.from)
      ]);
    })
});

class LockedLineWidget extends WidgetType {
  toDOM() {
    const marker = document.createElement("span");
    marker.className = "obsync-locked-gutter";
    marker.title = "Line locked by another client";
    marker.textContent = "●";
    return marker;
  }
}

const lockedLineWidget = new LockedLineWidget();

const lockedLineFilter = EditorState.transactionFilter.of((transaction) => {
  if (!transaction.docChanged) {
    return transaction;
  }

  if (transaction.annotation(remoteChangeAnnotation) === true) {
    return transaction;
  }

  const lockedLine = transaction.startState.field(lockedLineField);
  if (lockedLine === null) {
    return transaction;
  }

  const line = transaction.startState.doc.line(lockedLine + 1);
  let blocked = false;

  transaction.changes.iterChanges((fromA, toA) => {
    if (fromA <= line.to && toA >= line.from) {
      blocked = true;
    }
  });

  return blocked ? [] : transaction;
});

const lockHighlightTheme = EditorView.baseTheme({
  ".obsync-locked-line": {
    backgroundColor: "rgba(219, 73, 55, 0.12)",
    borderLeft: "3px solid rgba(219, 73, 55, 0.7)"
  },
  ".obsync-locked-gutter": {
    color: "rgba(219, 73, 55, 0.8)",
    fontSize: "10px",
    lineHeight: "1",
    display: "inline-block",
    marginRight: "6px",
    transform: "translateY(1px)"
  }
});

export function createCursorLineListener(onLineChange: (line: number) => void): Extension {
  return ViewPlugin.fromClass(
    class {
      private lastLine = -1;

      update(update: ViewUpdate) {
        if (!update.selectionSet) {
          return;
        }

        const line = update.state.doc.lineAt(update.state.selection.main.head).number - 1;
        if (line !== this.lastLine) {
          this.lastLine = line;
          onLineChange(line);
        }
      }
    },
    {
      eventHandlers: {}
    }
  );
}

export type EditorDelta = {
  from: number;
  to: number;
  text: string;
};

type EditorSyncCallbacks = {
  onLineChange?: (line: number) => void;
  onChanges?: (delta: EditorDelta) => void;
  onViewReady?: (view: EditorView) => void;
};

export function createEditorSyncExtension(callbacks: EditorSyncCallbacks): Extension {
  const plugin = ViewPlugin.fromClass(
    class {
      private lastLine = -1;
      private view: EditorView;

      constructor(view: EditorView) {
        this.view = view;
        callbacks.onViewReady?.(view);
      }

      update(update: ViewUpdate) {
        if (update.selectionSet && callbacks.onLineChange) {
          const line = update.state.doc.lineAt(update.state.selection.main.head).number - 1;
          if (line !== this.lastLine) {
            this.lastLine = line;
            callbacks.onLineChange(line);
          }
        }

        if (update.docChanged && callbacks.onChanges) {
          const isRemote = update.transactions.some(
            (transaction) => transaction.annotation(remoteChangeAnnotation) === true
          );
          if (isRemote) {
            return;
          }

          update.changes.iterChanges((fromA, toA, _fromB, _toB, inserted) => {
            callbacks.onChanges?.({ from: fromA, to: toA, text: inserted.toString() });
          });
        }
      }
    },
    {
      eventHandlers: {}
    }
  );

  return [plugin, lockedLineField, lockedLineFilter, lockHighlightTheme];
}

export function setLockedLine(view: EditorView, line: number | null) {
  view.dispatch({ effects: setLockedLineEffect.of(line) });
}

export function getLockedLine(view: EditorView) {
  return view.state.field(lockedLineField);
}

export function hasLockedLineMarker(view: EditorView) {
  return view.state.field(lockedLineField) !== null;
}

export function applyEditorExtension(view: EditorView, extension: Extension) {
  view.dispatch({
    effects: EditorView.appendConfig.of(extension)
  });
}
