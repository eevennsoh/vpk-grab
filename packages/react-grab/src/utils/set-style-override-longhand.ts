import type { StyleOverrideLonghand, StyleOverrideState } from "../types.js";

export const setStyleOverrideLonghand = (
  override: StyleOverrideState,
  longhand: StyleOverrideLonghand,
) => {
  const longhands = (override.longhands ??= []);
  const previousLonghand = longhands.find((entry) => entry.property === longhand.property);
  if (previousLonghand) Object.assign(previousLonghand, longhand);
  else longhands.push(longhand);
};
