import { describe, expect, it } from "vite-plus/test";
import type { StyleOverrideState } from "../src/types.js";
import { setStyleOverrideLonghand } from "../src/utils/set-style-override-longhand.js";

const createOverride = (): StyleOverrideState => ({ isOff: false, value: null, token: null });
const firstLonghand = { property: "padding-top", isOff: false, value: "20px", token: null };
const secondLonghand = { property: "padding-right", isOff: false, value: "30px", token: null };

describe("setStyleOverrideLonghand", () => {
  it("appends new sides and updates existing sides in place without reordering", () => {
    const override = createOverride();
    setStyleOverrideLonghand(override, { ...firstLonghand });
    setStyleOverrideLonghand(override, { ...secondLonghand });
    const previousLonghand = override.longhands?.[0];
    setStyleOverrideLonghand(override, { ...firstLonghand, value: "40px", token: "--space" });
    expect(override.longhands?.[0]).toBe(previousLonghand);
    expect(override.longhands).toEqual([
      { ...firstLonghand, value: "40px", token: "--space" },
      secondLonghand,
    ]);
  });

  it("repeating a value, token, off state or reset leaves the snapshot unchanged", () => {
    const override = createOverride();
    setStyleOverrideLonghand(override, { ...firstLonghand });
    setStyleOverrideLonghand(override, { ...secondLonghand });
    for (const patch of [
      firstLonghand,
      { ...firstLonghand, token: "--space" },
      { ...firstLonghand, isOff: true },
      { ...firstLonghand, value: null },
    ]) {
      setStyleOverrideLonghand(override, { ...patch });
      const snapshot = JSON.stringify(override);
      setStyleOverrideLonghand(override, { ...patch });
      expect(JSON.stringify(override)).toBe(snapshot);
    }
  });
});
