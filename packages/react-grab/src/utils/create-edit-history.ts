import type { EditHistory } from "../types.js";

// Two stacks: undo pops the latest change onto the redo stack and redo puts it
// back. A new change forgets what was undone, as in any editor.
export const createEditHistory = <Entry>(maxEntries: number): EditHistory<Entry> => {
  const undoStack: Entry[] = [];
  const redoStack: Entry[] = [];
  return {
    record: (entry) => {
      undoStack.push(entry);
      if (undoStack.length > maxEntries) undoStack.shift();
      redoStack.length = 0;
    },
    undo: () => {
      const entry = undoStack.pop();
      if (entry === undefined) return null;
      redoStack.push(entry);
      return entry;
    },
    redo: () => {
      const entry = redoStack.pop();
      if (entry === undefined) return null;
      undoStack.push(entry);
      return entry;
    },
  };
};
