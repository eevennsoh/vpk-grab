// The hover label always shows the element's width and height; a long name
// truncates before the size does.
import { formatElementSize } from "../src/utils/format-element-size.js";
import { test, expect } from "./fixtures.js";

const TARGET_SELECTOR = "[data-testid='todo-list'] li:first-child span";
const TAG_SIZE_SELECTOR = "[data-react-grab-tag-size]";
const REDLINES_TOGGLE_SELECTOR = '[data-react-grab-toolbar-action="inspect-redlines"]';
const NARROW_BADGE_WIDTH_PX = 90;

test.describe("Hover label size", () => {
  test.beforeEach(async ({ reactGrab }) => {
    await reactGrab.activate();
  });

  test("shows the width and height with Spacing off", async ({ reactGrab, page }) => {
    await expect(page.locator(REDLINES_TOGGLE_SELECTOR)).toHaveAttribute("aria-pressed", "false");
    await reactGrab.hoverUntilSelected(TARGET_SELECTOR);
    const box = await page.locator(TARGET_SELECTOR).boundingBox();
    if (!box) throw new Error("No target box");
    await expect(page.locator(TAG_SIZE_SELECTOR)).toHaveText(
      formatElementSize(box.width, box.height),
    );
    await expect(page.locator("[data-react-grab-redline]")).toHaveCount(0);
  });

  test("a long name truncates and the size stays whole", async ({ reactGrab, page }) => {
    await reactGrab.hoverUntilSelected(TARGET_SELECTOR);
    const size = page.locator(TAG_SIZE_SELECTOR);
    await expect(size).toBeVisible();
    const measurement = await size.evaluate((sizeElement, maxWidthPx) => {
      const badge = sizeElement.parentElement;
      const name = sizeElement.previousElementSibling;
      if (!badge || !(name instanceof HTMLElement)) throw new Error("Unexpected badge structure");
      badge.style.maxWidth = `${maxWidthPx}px`;
      return {
        isNameClipped: name.scrollWidth > name.clientWidth,
        isSizeClipped: sizeElement.scrollWidth > sizeElement.clientWidth,
        sizeRight: sizeElement.getBoundingClientRect().right,
        badgeRight: badge.getBoundingClientRect().right,
      };
    }, NARROW_BADGE_WIDTH_PX);
    expect(measurement.isNameClipped).toBe(true);
    expect(measurement.isSizeClipped).toBe(false);
    expect(measurement.sizeRight).toBeLessThanOrEqual(measurement.badgeRight + 0.5);
  });
});
