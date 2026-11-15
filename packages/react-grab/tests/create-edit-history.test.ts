import { describe, expect, it } from "vite-plus/test";
import { createEditHistory } from "../src/utils/create-edit-history.js";

describe("createEditHistory", () => {
  it("undoes the latest change first and redoes it back", () => {
    const history = createEditHistory<string>(10);
    history.record("first");
    history.record("second");
    expect(history.undo()).toBe("second");
    expect(history.undo()).toBe("first");
    expect(history.undo()).toBe(null);
    expect(history.redo()).toBe("first");
    expect(history.redo()).toBe("second");
    expect(history.redo()).toBe(null);
  });

  it("forgets what was undone once a new change is recorded", () => {
    const history = createEditHistory<string>(10);
    history.record("first");
    history.record("second");
    history.undo();
    history.record("third");
    expect(history.redo()).toBe(null);
    expect(history.undo()).toBe("third");
    expect(history.undo()).toBe("first");
  });

  it("keeps only the most recent entries", () => {
    const history = createEditHistory<number>(2);
    history.record(1);
    history.record(2);
    history.record(3);
    expect(history.undo()).toBe(3);
    expect(history.undo()).toBe(2);
    expect(history.undo()).toBe(null);
  });
});
