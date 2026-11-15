import type { StyleOverride } from "../types.js";

const isSameStyleOverride = (first: StyleOverride, second: StyleOverride): boolean =>
  first.element === second.element &&
  first.property === second.property &&
  first.isOff === second.isOff &&
  first.value === second.value &&
  first.token === second.token;

export const areStyleOverrideSnapshotsEqual = (
  first: readonly StyleOverride[],
  second: readonly StyleOverride[],
): boolean =>
  first.length === second.length &&
  first.every((override) =>
    second.some((otherOverride) => isSameStyleOverride(override, otherOverride)),
  );
