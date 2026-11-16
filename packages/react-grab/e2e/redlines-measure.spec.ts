// Alt-measuring: holding Alt anchors the redlines to the hovered element, and
// the next element the pointer reaches is measured against it.
import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures.js";

const FIXTURE_STYLE_ID = "redlines-measure-fixture-style";
const FIXTURE_ROOT_ID = "redlines-measure-fixture-root";
const REDLINES_TOGGLE_SELECTOR = '[data-react-grab-toolbar-action="inspect-redlines"]';
const MEASURE_TARGET_SELECTOR = "[data-react-grab-redline-target]";
const GUIDE_SELECTOR = "[data-react-grab-redline-guide]";
const AWAY_POSITION = { x: 620, y: 520 };

const ANCHOR_TEST_ID = "measure-anchor";
const BESIDE_TEST_ID = "measure-beside";
const DIAGONAL_TEST_ID = "measure-diagonal";
const BESIDE_GAP_PX = 60;
const DIAGONAL_GAP_X_PX = 36;
const DIAGONAL_GAP_Y_PX = 28;

const installMeasureFixture = (page: Page) =>
  page.evaluate(
    ({ styleId, rootId, testIds }) => {
      document.getElementById(styleId)?.remove();
      document.getElementById(rootId)?.remove();

      const styleElement = document.createElement("style");
      styleElement.id = styleId;
      styleElement.textContent = `
        #${rootId} { position: fixed; left: 60px; top: 300px; width: 400px; height: 200px; z-index: 900; background: #fff; }
        #${rootId} div { position: absolute; background: #dfe1e6; }
        [data-testid="${testIds.anchor}"] { left: 20px; top: 20px; width: 120px; height: 40px; }
        [data-testid="${testIds.beside}"] { left: 200px; top: 20px; width: 100px; height: 40px; }
        [data-testid="${testIds.diagonal}"] { left: 176px; top: 88px; width: 80px; height: 50px; }
      `;
      document.head.appendChild(styleElement);

      const rootElement = document.createElement("section");
      rootElement.id = rootId;
      rootElement.innerHTML = `
        <div data-testid="${testIds.anchor}"></div>
        <div data-testid="${testIds.beside}"></div>
        <div data-testid="${testIds.diagonal}"></div>
      `;
      document.body.appendChild(rootElement);
    },
    {
      styleId: FIXTURE_STYLE_ID,
      rootId: FIXTURE_ROOT_ID,
      testIds: { anchor: ANCHOR_TEST_ID, beside: BESIDE_TEST_ID, diagonal: DIAGONAL_TEST_ID },
    },
  );

const getBox = async (page: Page, testId: string) => {
  const box = await page.locator(`[data-testid='${testId}']`).boundingBox();
  if (!box) throw new Error(`No box for ${testId}`);
  return box;
};

const hover = async (page: Page, testId: string) => {
  const box = await getBox(page, testId);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 6 });
};

const redlineLabel = (page: Page, side: string) =>
  page.locator(`[data-react-grab-redline="${side}"]`);

test.describe("redlines measuring", () => {
  test.beforeEach(async ({ reactGrab, page }) => {
    await expect.poll(() => reactGrab.isToolbarVisible(), { timeout: 3000 }).toBe(true);
    await installMeasureFixture(page);
    await page.mouse.move(AWAY_POSITION.x, AWAY_POSITION.y);
    await reactGrab.activate();
    await page.locator(REDLINES_TOGGLE_SELECTOR).click();
    await page.mouse.move(AWAY_POSITION.x, AWAY_POSITION.y);
    await hover(page, ANCHOR_TEST_ID);
    await expect
      .poll(() => reactGrab.getSelectionBoxBounds())
      .toEqual(await getBox(page, ANCHOR_TEST_ID));
  });

  test("holding Alt measures from the hovered element to the next one hovered", async ({
    reactGrab,
    page,
  }) => {
    await page.keyboard.down("Alt");
    await hover(page, BESIDE_TEST_ID);

    // Polled: on its way over, the pointer crosses the container between the
    // two boxes, which is measured against the anchor for a moment too.
    await expect
      .poll(() => page.locator(MEASURE_TARGET_SELECTOR).boundingBox())
      .toEqual(await getBox(page, BESIDE_TEST_ID));
    await expect(redlineLabel(page, "right")).toHaveText(String(BESIDE_GAP_PX));
    await expect(page.locator("[data-react-grab-redline]")).toHaveCount(1);
    await expect(page.locator(GUIDE_SELECTOR)).toHaveCount(0);
    expect(await reactGrab.getSelectionBoxBounds()).toEqual(await getBox(page, ANCHOR_TEST_ID));
  });

  test("a target off both axes is measured on each, with guides out from the anchor", async ({
    page,
  }) => {
    await page.keyboard.down("Alt");
    await hover(page, DIAGONAL_TEST_ID);

    await expect(redlineLabel(page, "right")).toHaveText(String(DIAGONAL_GAP_X_PX));
    await expect(redlineLabel(page, "bottom")).toHaveText(String(DIAGONAL_GAP_Y_PX));
    await expect(page.locator(GUIDE_SELECTOR)).toHaveCount(2);
  });

  test("the anchor keeps its own spacing until the pointer reaches another element", async ({
    page,
  }) => {
    const ownSpacingLabels = await page.locator("[data-react-grab-redline]").allTextContents();
    await page.keyboard.down("Alt");

    await expect(page.locator(MEASURE_TARGET_SELECTOR)).toHaveCount(0);
    await expect(page.locator("[data-react-grab-redline]")).toHaveText(ownSpacingLabels);
  });

  test("letting go of Alt hands the selection to the element under the pointer", async ({
    reactGrab,
    page,
  }) => {
    await page.keyboard.down("Alt");
    await hover(page, BESIDE_TEST_ID);
    await expect(page.locator(MEASURE_TARGET_SELECTOR)).toHaveCount(1);

    await page.keyboard.up("Alt");

    await expect(page.locator(MEASURE_TARGET_SELECTOR)).toHaveCount(0);
    await expect
      .poll(() => reactGrab.getSelectionBoxBounds())
      .toEqual(await getBox(page, BESIDE_TEST_ID));
  });

  test("a press while measuring copies nothing and keeps measuring", async ({
    reactGrab,
    page,
  }) => {
    await page.keyboard.down("Alt");
    await hover(page, BESIDE_TEST_ID);
    await expect(page.locator(MEASURE_TARGET_SELECTOR)).toHaveCount(1);

    await page.mouse.down();
    await page.mouse.up();

    await expect(page.locator(MEASURE_TARGET_SELECTOR)).toHaveCount(1);
    expect(await reactGrab.isOverlayVisible()).toBe(true);
    expect(await reactGrab.getSelectionBoxBounds()).toEqual(await getBox(page, ANCHOR_TEST_ID));
  });

  test("Alt leaves the selection alone while redlines are off", async ({ reactGrab, page }) => {
    await page.locator(REDLINES_TOGGLE_SELECTOR).click();
    await hover(page, ANCHOR_TEST_ID);
    await expect
      .poll(() => reactGrab.getSelectionBoxBounds())
      .toEqual(await getBox(page, ANCHOR_TEST_ID));

    await page.keyboard.down("Alt");
    await hover(page, BESIDE_TEST_ID);

    await expect
      .poll(() => reactGrab.getSelectionBoxBounds())
      .toEqual(await getBox(page, BESIDE_TEST_ID));
    await expect(page.locator(MEASURE_TARGET_SELECTOR)).toHaveCount(0);
  });
});
