import type { StyleOverride, StyleOverrideGroup } from "../types.js";

// One group per element, in the order each element was first changed.
export const groupStyleOverrides = (overrides: StyleOverride[]): StyleOverrideGroup[] => {
  const groupsByElement = new Map<Element, StyleOverrideGroup>();
  for (const override of overrides) {
    let group = groupsByElement.get(override.element);
    if (!group) {
      group = { element: override.element, overrides: [] };
      groupsByElement.set(override.element, group);
    }
    group.overrides.push(override);
  }
  return [...groupsByElement.values()];
};
