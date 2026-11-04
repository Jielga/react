import { useEffect, useRef, useState } from "react";
import { readStoredAreas, writeStoredAreas } from "./editorStorage.ts";
import type { EditorArea } from "./editorModel.ts";

const MAX_UNDO = 200;

type History = { past: EditorArea[][]; present: EditorArea[]; future: EditorArea[][] };

export type EditorHistory = {
  areas: EditorArea[];
  /** Replaces the areas as one undo step */
  commit: (next: EditorArea[]) => void;
  /** Replaces the areas during a gesture, such as a drag. The next `commit` makes the whole gesture one undo step. */
  preview: (next: EditorArea[]) => void;
  /** Ends a gesture without a change, back to the areas from before it */
  cancelPreview: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
};

/** The areas with undo and redo, kept in local storage */
export function useEditorHistory(): EditorHistory {
  const [history, setHistory] = useState<History>(() => {
    return { past: [], present: readStoredAreas(), future: [] };
  });
  // The areas from before the gesture that is under way
  const gestureStart = useRef<EditorArea[] | null>(null);

  const stored = useRef(history.present);
  useEffect(() => {
    if (gestureStart.current === null && stored.current !== history.present) {
      stored.current = history.present;
      writeStoredAreas(history.present);
    }
  });

  return {
    areas: history.present,
    commit: (next) => {
      const before = gestureStart.current ?? history.present;
      gestureStart.current = null;
      setHistory({ past: [...history.past, before].slice(-MAX_UNDO), present: next, future: [] });
    },
    preview: (next) => {
      gestureStart.current ??= history.present;
      setHistory({ ...history, present: next });
    },
    cancelPreview: () => {
      const before = gestureStart.current;
      gestureStart.current = null;
      if (before) {
        setHistory({ ...history, present: before });
      }
    },
    undo: () => {
      const previous = history.past.at(-1);
      if (previous && gestureStart.current === null) {
        setHistory({ past: history.past.slice(0, -1), present: previous, future: [history.present, ...history.future] });
      }
    },
    redo: () => {
      const [next, ...future] = history.future;
      if (next && gestureStart.current === null) {
        setHistory({ past: [...history.past, history.present], present: next, future });
      }
    },
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
  };
}
