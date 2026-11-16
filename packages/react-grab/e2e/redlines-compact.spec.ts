// Redline labels around elements too small to hold them: each distance moves
// past the far end of its line, and the size joins the element's name tag.
import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures.js";

const FIXTURE_STYLE_ID = "redlines-compact-fixture-style";
const FIXTURE_ROOT_ID = "redlines-compact-fixture-root";
const REDLINES_TOGGLE_SELECTOR = '[data-react-grab-toolbar-action="inspect-redlines"]';
const REDLINE_LABEL_SELECTOR = "[data-react-grab-redline]";
const SIZE_LABEL_SELECTOR = "[data-react-grab-redline-size]";
const TAG_SIZE_SELECTOR = "[data-react-grab-tag-size]";
const AWAY_POSITION = { x: 620, y: 520 };
const TINY_TEST_ID = "compact-tiny";
const LARGE_TEST_ID = "compact-large";

const installCompactFixture = (page: Page) =>
  page.evaluate(
    ({ styleId, rootId, tinyTestId, largeTestId }) => {
      document.getElementById(styleId)?.remove();
      document.getElementById(rootId)?.remove();

      const styleElement = document.createElement("style");
      styleElement.id = styleId;
      styleElement.textContent = `
        #${rootId} { position: fixed; left: 80px; top: 260px; width: 480px; height: 220px; z-index: 900; background: #fff; }
        #${rootId} .compact-row { position: absolute; left: 40px; top: 40px; width: 30px; height: 18px; background: #f4f5f7; }
        [data-testid="${tinyTestId}"] { position: absolute; left: 6px; top: 4px; width: 16px; height: 12px; background: #c1c7d0; }
        [data-testid="${largeTestId}"] { position: absolute; left: 200px; top: 40px; width: 200px; height: 120px; background: #dfe1e6; }
      `;
      document.head.appendChild(styleElement);

      const rootElement = document.createElement("section");
      rootElement.id = rootId;
      rootElement.innerHTML = `
        <div class="compact-row"><span data-testid="${tinyTestId}"></span></div>
        <div data-testid="${largeTestId}"></div>
      `;
      document.body.appendChild(rootElement);
    },
    {
      styleId: FIXTURE_STYLE_ID,
      rootId: FIXTURE_ROOT_ID,
      tinyTestId: TINY_TEST_ID,
      largeTestId: LARGE_TEST_ID,
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

const getLabelBoxes = async (page: Page) => {
  const labels = page.locator(REDLINE_LABEL_SELECTOR);
  const labelCount = await labels.count();
  const boxes = [];
  for (let labelIndex = 0; labelIndex < labelCount; labelIndex++) {
    const box = await labels.nth(labelIndex).boundingBox();
    if (box) boxes.push(box);
  }
  return boxes;
};

test.describe("redlines on small elements", () => {
  test.beforeEach(async ({ reactGrab, page }) => {
    await expect.poll(() => reactGrab.isToolbarVisible(), { timeout: 3000 }).toBe(true);
    await installCompactFixture(page);
    await page.mouse.move(AWAY_POSITION.x, AWAY_POSITION.y);
    await reactGrab.activate();
    await page.locator(REDLINES_TOGGLE_SELECTOR).click();
    await page.mouse.move(AWAY_POSITION.x, AWAY_POSITION.y);
  });

  test("a tiny element's distances sit outside it and never overlap", async ({
    reactGrab,
    page,
  }) => {
    await hover(page, TINY_TEST_ID);
    await expect
      .poll(() => reactGrab.getSelectionBoxBounds())
      .toEqual(await getBox(page, TINY_TEST_ID));

    const labels = page.locator(REDLINE_LABEL_SELECTOR);
    await expect(labels).toHaveCount(4);
    for (const placement of await labels.evaluateAll((elements) =>
      elements.map((element) => element.getAttribute("data-react-grab-redline-placement")),
    )) {
      expect(placement).toBe("outer");
    }

    const boxes = await getLabelBoxes(page);
    for (let firstIndex = 0; firstIndex < boxes.length; firstIndex++) {
      for (let secondIndex = firstIndex + 1; secondIndex < boxes.length; secondIndex++) {
        const first = boxes[firstIndex];
        const second = boxes[secondIndex];
        const isOverlapping =
          first.x < second.x + second.width &&
          second.x < first.x + first.width &&
          first.y < second.y + second.height &&
          second.y < first.y + first.height;
        expect(isOverlapping).toBe(false);
      }
    }
  });

  test("the size moves into the name tag instead of its own badge", async ({ page }) => {
    await hover(page, TINY_TEST_ID);
    await expect(page.locator(TAG_SIZE_SELECTOR)).toHaveText("16 × 12");
    await expect(page.locator(SIZE_LABEL_SELECTOR)).toHaveCount(0);
  });

  test("the name tag drops below a small element's bottom distance", async ({ page }) => {
    await hover(page, TINY_TEST_ID);
    const tagSize = page.locator(TAG_SIZE_SELECTOR);
    await expect(tagSize).toHaveText("16 × 12");
    await expect
      .poll(async () => {
        const bottomLabel = await page.locator('[data-react-grab-redline="bottom"]').boundingBox();
        const tagSizeBox = await tagSize.boundingBox();
        if (!bottomLabel || !tagSizeBox) return false;
        return bottomLabel.y + bottomLabel.height <= tagSizeBox.y;
      })
      .toBe(true);
  });

  test("a large element keeps its labels beside the middle of each line", async ({ page }) => {
    await hover(page, LARGE_TEST_ID);
    await expect(page.locator(TAG_SIZE_SELECTOR)).toHaveText("200 × 120");
    const placements = await page
      .locator(REDLINE_LABEL_SELECTOR)
      .evaluateAll((elements) =>
        elements.map((element) => element.getAttribute("data-react-grab-redline-placement")),
      );
    expect(placements.length).toBeGreaterThan(0);
    for (const placement of placements) expect(placement).toBe("middle");
  });
});
