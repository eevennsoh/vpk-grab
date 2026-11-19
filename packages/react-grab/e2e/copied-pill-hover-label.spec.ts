// While a Copied pill is up, the element it belongs to shows the pill alone:
// the live hover label would land in the same spot, half under it.
import type { Page } from "@playwright/test";
import { test, expect, type ReactGrabPageObject } from "./fixtures.js";
import { switchOnSpecs } from "./specs-panel-fixture.js";

const LIVE_LABEL_SELECTOR =
  "[data-react-grab-selection-label]:not([data-react-grab-label-instance])";
const INSTANCE_LABEL_SELECTOR = "[data-react-grab-selection-label][data-react-grab-label-instance]";
const COMPLETION_SELECTOR = "[data-react-grab-completion]";
const REDLINE_SIZE_SELECTOR = "[data-react-grab-redline-size]";
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

    const copiedBounds = await reactGrab.getSelectionBoxBounds();
    await reactGrab.hoverElement(`#${CELL_ID_PREFIX}1`);
    await expect(getLiveLabels(reactGrab)).toHaveCount(0);
    expect(await reactGrab.getSelectionBoxBounds()).toEqual(copiedBounds);
    const getTargetId = () =>
      page.evaluate(() => window.__REACT_GRAB__?.getState().targetElement?.id);
    expect(await getTargetId()).toBe(`${CELL_ID_PREFIX}0`);

    await page.keyboard.press("Escape");
    await expectLiveLabelFor(reactGrab, "article");
    await expect.poll(getTargetId).toBe(`${CELL_ID_PREFIX}1`);
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

    await page.keyboard.press("Escape");
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

    const otherCell = getCellCenter(2);
    await page.mouse.click(otherCell.x, otherCell.y);
    await expect(getInstanceLabels(reactGrab)).toHaveCount(0);
    await expectLiveLabelFor(reactGrab, "article");
  });

  test("a parent gets its hover label only after its child's pill is dismissed", async ({
    reactGrab,
    page,
  }) => {
    await switchOnSpecs(page);
    await clickAt(reactGrab, page, INNER_BLOCK_POINT);
    const specsTag = page.locator("[data-react-grab-specs-header] > span").first();
    await expect(specsTag).toHaveText("<section>");
    await moveTo(page, OUTER_BLOCK_POINT);
    await expect(getLiveLabels(reactGrab)).toHaveCount(0);
    await expect(specsTag).toHaveText("<section>");
    await page.keyboard.press("Escape");
    await expectLiveLabelFor(reactGrab, "div");
    await expect(specsTag).toHaveText("<div>");
  });

  test("with spacing on, the copied element keeps its size readout", async ({
    reactGrab,
    page,
  }) => {
    await page.locator(SPACING_TOGGLE_SELECTOR).click();
    await moveTo(page, getCellCenter(1));
    await expectLiveLabelFor(reactGrab, "article");
    await expect(getLiveLabels(reactGrab)).toContainText(
      `${CELL_SIZE.width} × ${CELL_SIZE.height}`,
    );
    await expect(page.locator(REDLINE_SIZE_SELECTOR)).toHaveCount(0);

    await clickAt(reactGrab, page, getCellCenter(0));

    await expect(getLiveLabels(reactGrab)).toHaveCount(0);
    await expect(page.locator(REDLINE_SIZE_SELECTOR)).toHaveText(
      `${CELL_SIZE.width} × ${CELL_SIZE.height}`,
    );
  });
});
