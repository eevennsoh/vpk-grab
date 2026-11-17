// While a Copied pill is up, the element it belongs to shows the pill alone:
// the live hover label would land in the same spot, half under it.
import type { Page } from "@playwright/test";
import { test, expect, type ReactGrabPageObject } from "./fixtures.js";

const LIVE_LABEL_SELECTOR =
  "[data-react-grab-selection-label]:not([data-react-grab-label-instance])";
const INSTANCE_LABEL_SELECTOR = "[data-react-grab-selection-label][data-react-grab-label-instance]";
const COMPLETION_SELECTOR = "[data-react-grab-completion]";
const SPACING_TOGGLE_SELECTOR = '[data-react-grab-toolbar-action="inspect-redlines"]';
const OUTER_BLOCK_ID = "hover-label-outer";
const INNER_BLOCK_ID = "hover-label-inner";
const CELL_ID_PREFIX = "hover-label-cell-";
const INJECTED_Z_INDEX = "2147483000";
const OUTER_BLOCK = { left: 300, top: 200, width: 320, height: 120 };
const INNER_BLOCK_HEIGHT_PX = 40;
const CELL_TOP_PX = 440;
const CELL_SIZE = { width: 80, height: 40 };
const CELL_LEFTS_PX = [300, 420, 540];
const MARQUEE_OUTSET_PX = 12;
const DRAG_STEPS = 10;

interface Point {
  x: number;
  y: number;
}

const injectBlocks = (page: Page) =>
  page.evaluate(
    ({
      outerBlockId,
      innerBlockId,
      cellIdPrefix,
      zIndex,
      outerBlock,
      innerBlockHeight,
      cellTop,
      cellSize,
      cellLefts,
    }) => {
      const outer = document.createElement("div");
      outer.id = outerBlockId;
      Object.assign(outer.style, {
        position: "fixed",
        left: `${outerBlock.left}px`,
        top: `${outerBlock.top}px`,
        width: `${outerBlock.width}px`,
        height: `${outerBlock.height}px`,
        background: "rgb(230, 236, 250)",
        zIndex,
      });
      const inner = document.createElement("section");
      inner.id = innerBlockId;
      Object.assign(inner.style, {
        position: "absolute",
        left: "0",
        bottom: "0",
        width: "100%",
        height: `${innerBlockHeight}px`,
        background: "rgb(120, 160, 230)",
      });
      outer.append(inner);
      document.body.append(outer);
      cellLefts.forEach((cellLeft, cellIndex) => {
        const cell = document.createElement("article");
        cell.id = `${cellIdPrefix}${cellIndex}`;
        Object.assign(cell.style, {
          position: "fixed",
          left: `${cellLeft}px`,
          top: `${cellTop}px`,
          width: `${cellSize.width}px`,
          height: `${cellSize.height}px`,
          background: "rgb(200, 220, 200)",
          zIndex,
        });
        document.body.append(cell);
      });
    },
    {
      outerBlockId: OUTER_BLOCK_ID,
      innerBlockId: INNER_BLOCK_ID,
      cellIdPrefix: CELL_ID_PREFIX,
      zIndex: INJECTED_Z_INDEX,
      outerBlock: OUTER_BLOCK,
      innerBlockHeight: INNER_BLOCK_HEIGHT_PX,
      cellTop: CELL_TOP_PX,
      cellSize: CELL_SIZE,
      cellLefts: CELL_LEFTS_PX,
    },
  );

const getCellCenter = (cellIndex: number): Point => ({
  x: CELL_LEFTS_PX[cellIndex] + CELL_SIZE.width / 2,
  y: CELL_TOP_PX + CELL_SIZE.height / 2,
});

const INNER_BLOCK_POINT: Point = {
  x: OUTER_BLOCK.left + OUTER_BLOCK.width / 2,
  y: OUTER_BLOCK.top + OUTER_BLOCK.height - INNER_BLOCK_HEIGHT_PX / 2,
};

const OUTER_BLOCK_POINT: Point = {
  x: INNER_BLOCK_POINT.x,
  y: OUTER_BLOCK.top + (OUTER_BLOCK.height - INNER_BLOCK_HEIGHT_PX) / 2,
};

const getLiveLabels = (reactGrab: ReactGrabPageObject) =>
  reactGrab.getOverlayHost().locator(LIVE_LABEL_SELECTOR);

const getInstanceLabels = (reactGrab: ReactGrabPageObject) =>
  reactGrab.getOverlayHost().locator(INSTANCE_LABEL_SELECTOR);

const moveTo = async (page: Page, point: Point) => {
  await page.mouse.move(point.x - 4, point.y - 4);
  await page.mouse.move(point.x, point.y, { steps: 2 });
};

const expectLiveLabelFor = async (reactGrab: ReactGrabPageObject, tagName: string) => {
  await expect(getLiveLabels(reactGrab)).toHaveCount(1);
  await expect(getLiveLabels(reactGrab)).toContainText(tagName);
};

const clickAt = async (reactGrab: ReactGrabPageObject, page: Page, point: Point) => {
  await moveTo(page, point);
  await expect.poll(() => reactGrab.isSelectionBoxVisible()).toBe(true);
  await page.mouse.down();
  await page.mouse.up();
  await expect(reactGrab.getOverlayHost().locator(COMPLETION_SELECTOR).first()).toContainText(
    "Copied",
  );
};

// A press on the toolbar dismisses every pill and leaves Grab on; the second
// press puts the spacing toggle back as it was.
const dismissPillsKeepingGrabOn = async (reactGrab: ReactGrabPageObject, page: Page) => {
  const spacingToggle = page.locator(SPACING_TOGGLE_SELECTOR);
  await spacingToggle.click();
  await expect(getInstanceLabels(reactGrab)).toHaveCount(0);
  await spacingToggle.click();
  await expect(spacingToggle).toHaveAttribute("aria-pressed", "false");
  expect(await reactGrab.getState()).toMatchObject({ isActive: true });
};

test.describe("Hover label beside a Copied pill", () => {
  test.beforeEach(async ({ reactGrab, page }) => {
    await injectBlocks(page);
    await reactGrab.activate();
  });

  test("the copied element shows only its pill until the pill goes", async ({
    reactGrab,
    page,
  }) => {
    await clickAt(reactGrab, page, getCellCenter(0));

    await expect(getInstanceLabels(reactGrab)).toHaveCount(1);
    await expect(getLiveLabels(reactGrab)).toHaveCount(0);
    expect(await reactGrab.isSelectionBoxVisible()).toBe(true);

    await moveTo(page, getCellCenter(1));
    await expectLiveLabelFor(reactGrab, "article");

    await moveTo(page, getCellCenter(0));
    await expect(getLiveLabels(reactGrab)).toHaveCount(0);
    expect(await reactGrab.isSelectionBoxVisible()).toBe(true);

    await dismissPillsKeepingGrabOn(reactGrab, page);
    await moveTo(page, getCellCenter(0));
    await expectLiveLabelFor(reactGrab, "article");
  });

  test("every element of a marquee copy shows only the pill", async ({ reactGrab, page }) => {
    const firstCell = getCellCenter(0);
    const lastCell = getCellCenter(CELL_LEFTS_PX.length - 1);
    await page.mouse.move(
      firstCell.x - CELL_SIZE.width / 2 - MARQUEE_OUTSET_PX,
      firstCell.y - CELL_SIZE.height / 2 - MARQUEE_OUTSET_PX,
    );
    await page.mouse.down();
    await page.mouse.move(
      lastCell.x + CELL_SIZE.width / 2 + MARQUEE_OUTSET_PX,
      lastCell.y + CELL_SIZE.height / 2 + MARQUEE_OUTSET_PX,
      { steps: DRAG_STEPS },
    );
    await page.mouse.up();
    await expect(reactGrab.getOverlayHost().locator(COMPLETION_SELECTOR)).toContainText("Copied");
    await expect(getInstanceLabels(reactGrab)).toHaveCount(1);

    for (let cellIndex = 0; cellIndex < CELL_LEFTS_PX.length; cellIndex++) {
      await moveTo(page, getCellCenter(cellIndex));
      await expect.poll(() => reactGrab.isSelectionBoxVisible()).toBe(true);
      await expect(getLiveLabels(reactGrab)).toHaveCount(0);
    }

    await moveTo(page, INNER_BLOCK_POINT);
    await expectLiveLabelFor(reactGrab, "section");
  });

  test("per-element pills each cover their own element", async ({ reactGrab, page }) => {
    await page.keyboard.down("Shift");
    for (const cellIndex of [0, 1]) {
      const cellCenter = getCellCenter(cellIndex);
      await page.mouse.click(cellCenter.x, cellCenter.y);
    }
    await page.keyboard.up("Shift");
    await expect(getInstanceLabels(reactGrab)).toHaveCount(2);
    await expect(reactGrab.getOverlayHost().locator(COMPLETION_SELECTOR)).toHaveCount(2);

    for (const cellIndex of [0, 1]) {
      await moveTo(page, getCellCenter(cellIndex));
      await expect.poll(() => reactGrab.isSelectionBoxVisible()).toBe(true);
      await expect(getLiveLabels(reactGrab)).toHaveCount(0);
    }

    await moveTo(page, getCellCenter(2));
    await expectLiveLabelFor(reactGrab, "article");
  });

  test("a hover label for another element is drawn over the pill it overlaps", async ({
    reactGrab,
    page,
  }) => {
    await clickAt(reactGrab, page, INNER_BLOCK_POINT);
    await moveTo(page, OUTER_BLOCK_POINT);
    await expectLiveLabelFor(reactGrab, "div");

    const stacking = await page.evaluate(
      ({ liveSelector, instanceSelector }) => {
        const shadowRoot = document.querySelector("[data-react-grab]")?.shadowRoot;
        const liveLabel = shadowRoot?.querySelector<HTMLElement>(liveSelector);
        const instanceLabel = shadowRoot?.querySelector<HTMLElement>(instanceSelector);
        if (!liveLabel || !instanceLabel) return null;
        const liveRect = liveLabel.getBoundingClientRect();
        const instanceRect = instanceLabel.getBoundingClientRect();
        return {
          isLiveLabelAfterPill: Boolean(
            instanceLabel.compareDocumentPosition(liveLabel) & Node.DOCUMENT_POSITION_FOLLOWING,
          ),
          doLabelsOverlap:
            liveRect.left < instanceRect.right &&
            instanceRect.left < liveRect.right &&
            liveRect.top < instanceRect.bottom &&
            instanceRect.top < liveRect.bottom,
          liveZIndex: getComputedStyle(liveLabel).zIndex,
          instanceZIndex: getComputedStyle(instanceLabel).zIndex,
        };
      },
      { liveSelector: LIVE_LABEL_SELECTOR, instanceSelector: INSTANCE_LABEL_SELECTOR },
    );

    expect(stacking).toEqual({
      isLiveLabelAfterPill: true,
      doLabelsOverlap: true,
      liveZIndex: stacking?.instanceZIndex,
      instanceZIndex: stacking?.instanceZIndex,
    });
  });
});
