// Shift+drag in the Grab tool copies a PNG of the dragged page area instead
// of the elements in it. Headless clipboards cannot be read back as images,
// so the page's navigator.clipboard.write is recorded and the PNG decoded.
import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures.js";
import {
  PINNED_PANEL_SELECTOR,
  getCenter,
  inspect,
  installSpecsFixture,
  switchOnSpecs,
} from "./specs-panel-fixture.js";

const TODO_ITEM_SELECTOR = "[data-testid='todo-list'] li span";
const STROKE_SELECTOR = "[data-react-grab-annotation-stroke]";
const MARQUEE_SELECTOR = "[data-react-grab-screenshot-marquee]";
const MARQUEE_SIZE_SELECTOR = "[data-react-grab-screenshot-size]";
const COMPLETION_SELECTOR = "[data-react-grab-completion]";
const THUMBNAIL_SELECTOR = "[data-react-grab-screenshot-thumbnail]";
const CAPTURE_START = { x: 250, y: 280 };
const CAPTURE_END = { x: 610, y: 380 };
const LINE_START = { x: 300, y: 320 };
const LINE_END = { x: 520, y: 320 };
const DRAG_STEPS = 8;
const UNDERSIZED_DRAG_PX = 4;
const DRAG_OUTSET_PX = 20;
// Comfortably past the release grace window, so Shift no longer counts.
const SHIFT_RELEASED_SETTLE_MS = 400;
const NO_IMAGE_SETTLE_MS = 600;
const STROKE_RED_MIN = 180;
const STROKE_GREEN_MAX = 140;
const STROKE_BLUE_MAX = 110;

interface RecordedImageWrite {
  types: string[];
  width: number;
  height: number;
}

interface ScreenshotRecorder {
  imageWrites: RecordedImageWrite[];
  imageBlobs: Blob[];
  copyEventCount: number;
}

interface ScreenshotRecorderWindow extends Window {
  __screenshotRecorder?: ScreenshotRecorder;
}

const installClipboardRecorder = (page: Page) =>
  page.evaluate(() => {
    const recorderWindow: ScreenshotRecorderWindow = window;
    const recorder: ScreenshotRecorder = { imageWrites: [], imageBlobs: [], copyEventCount: 0 };
    recorderWindow.__screenshotRecorder = recorder;
    document.addEventListener(
      "copy",
      () => {
        recorder.copyEventCount += 1;
      },
      { capture: true },
    );
    navigator.clipboard.write = async (items: ClipboardItem[]) => {
      for (const item of items) {
        const blob = await item.getType("image/png");
        const bitmap = await createImageBitmap(blob);
        recorder.imageBlobs.push(blob);
        recorder.imageWrites.push({
          types: [...item.types],
          width: bitmap.width,
          height: bitmap.height,
        });
      }
    };
  });

const getImageWrites = (page: Page) =>
  page.evaluate(() => {
    const recorderWindow: ScreenshotRecorderWindow = window;
    return recorderWindow.__screenshotRecorder?.imageWrites ?? [];
  });

const getCopyEventCount = (page: Page) =>
  page.evaluate(() => {
    const recorderWindow: ScreenshotRecorderWindow = window;
    return recorderWindow.__screenshotRecorder?.copyEventCount ?? 0;
  });

const sampleLastImagePixel = (page: Page, cssX: number, cssY: number, cssWidth: number) =>
  page.evaluate(
    async ({ x, y, width }) => {
      const recorderWindow: ScreenshotRecorderWindow = window;
      const blobs = recorderWindow.__screenshotRecorder?.imageBlobs ?? [];
      const blob = blobs[blobs.length - 1];
      if (!blob) return null;
      const bitmap = await createImageBitmap(blob);
      const scale = bitmap.width / width;
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const context = canvas.getContext("2d");
      if (!context) return null;
      context.drawImage(bitmap, 0, 0);
      const [red, green, blue] = context.getImageData(
        Math.round(x * scale),
        Math.round(y * scale),
        1,
        1,
      ).data;
      return { red, green, blue };
    },
    { x: cssX, y: cssY, width: cssWidth },
  );

const getExpectedPixelSize = (page: Page, width: number, height: number) =>
  page.evaluate(
    ({ cssWidth, cssHeight }) => {
      const scale = Math.min(
        Math.max(window.devicePixelRatio, 1),
        2000 / Math.max(cssWidth, cssHeight),
      );
      return {
        width: Math.round(cssWidth * scale),
        height: Math.round(cssHeight * scale),
      };
    },
    { cssWidth: width, cssHeight: height },
  );

const readPageCursor = (page: Page) =>
  page.evaluate(() => document.querySelector("[data-react-grab-cursor]")?.textContent ?? "");

const shiftDrag = async (
  page: Page,
  start: { x: number; y: number },
  end: { x: number; y: number },
) => {
  await page.keyboard.down("Shift");
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: DRAG_STEPS });
  await page.mouse.up();
  await page.keyboard.up("Shift");
};

const getTodoItemBox = async (page: Page, index: number) => {
  const box = await page.locator(TODO_ITEM_SELECTOR).nth(index).boundingBox();
  if (!box) throw new Error(`No box for todo item ${index}`);
  return box;
};

test.describe("Screenshot capture", () => {
  test.beforeEach(async ({ reactGrab, page }) => {
    await expect.poll(() => reactGrab.isToolbarVisible(), { timeout: 3000 }).toBe(true);
    await installClipboardRecorder(page);
    await page.mouse.move(CAPTURE_START.x, CAPTURE_START.y);
    await reactGrab.activate();
  });

  test("Shift+drag copies a PNG of the area and no text", async ({ reactGrab, page }) => {
    await shiftDrag(page, CAPTURE_START, CAPTURE_END);

    await expect.poll(() => getImageWrites(page)).toHaveLength(1);
    const [imageWrite] = await getImageWrites(page);
    expect(imageWrite.types).toEqual(["image/png"]);

    const expectedSize = await getExpectedPixelSize(
      page,
      CAPTURE_END.x - CAPTURE_START.x,
      CAPTURE_END.y - CAPTURE_START.y,
    );
    expect({ width: imageWrite.width, height: imageWrite.height }).toEqual(expectedSize);

    const completion = reactGrab.getOverlayHost().locator(COMPLETION_SELECTOR);
    await expect(completion).toContainText("Image copied");
    await expect(completion.locator(THUMBNAIL_SELECTOR)).toHaveCount(1);
    expect(await getCopyEventCount(page)).toBe(0);
  });

  test("draws the capture marquee with its size while Shift is held", async ({
    reactGrab,
    page,
  }) => {
    await page.keyboard.down("Shift");
    await page.mouse.move(CAPTURE_START.x, CAPTURE_START.y);
    await page.mouse.down();
    await page.mouse.move(CAPTURE_END.x, CAPTURE_END.y, { steps: DRAG_STEPS });

    const overlayHost = reactGrab.getOverlayHost();
    await expect(overlayHost.locator(MARQUEE_SELECTOR)).toHaveCount(1);
    await expect(overlayHost.locator(MARQUEE_SIZE_SELECTOR)).toHaveText(
      `${CAPTURE_END.x - CAPTURE_START.x} × ${CAPTURE_END.y - CAPTURE_START.y}`,
    );

    await page.keyboard.up("Shift");
    await expect(overlayHost.locator(MARQUEE_SELECTOR)).toHaveCount(0);

    await page.keyboard.down("Shift");
    await expect(overlayHost.locator(MARQUEE_SELECTOR)).toHaveCount(1);

    await page.keyboard.up("Shift");
    await page.keyboard.press("Escape");
  });

  test("releasing Shift mid-drag copies the elements instead", async ({ reactGrab, page }) => {
    const firstBox = await getTodoItemBox(page, 0);
    const thirdBox = await getTodoItemBox(page, 2);

    await page.keyboard.down("Shift");
    await page.mouse.move(firstBox.x - DRAG_OUTSET_PX, firstBox.y - DRAG_OUTSET_PX);
    await page.mouse.down();
    await page.mouse.move(
      thirdBox.x + thirdBox.width + DRAG_OUTSET_PX,
      thirdBox.y + thirdBox.height + DRAG_OUTSET_PX,
      { steps: DRAG_STEPS },
    );
    await page.keyboard.up("Shift");
    await page.waitForTimeout(SHIFT_RELEASED_SETTLE_MS);
    await page.mouse.up();

    await expect.poll(() => reactGrab.getClipboardContent()).toContain("TodoItem");
    await page.waitForTimeout(NO_IMAGE_SETTLE_MS);
    expect(await getImageWrites(page)).toHaveLength(0);
  });

  test("pressing Shift mid-drag turns the drag into a screenshot", async ({ page }) => {
    await page.mouse.move(CAPTURE_START.x, CAPTURE_START.y);
    await page.mouse.down();
    await page.mouse.move(CAPTURE_START.x + 100, CAPTURE_START.y + 50, { steps: DRAG_STEPS });
    await page.keyboard.down("Shift");
    await page.mouse.move(CAPTURE_END.x, CAPTURE_END.y, { steps: DRAG_STEPS });
    await page.mouse.up();
    await page.keyboard.up("Shift");

    await expect.poll(() => getImageWrites(page)).toHaveLength(1);
    expect(await getCopyEventCount(page)).toBe(0);
  });

  test("Shift let go just before the mouse still takes the screenshot", async ({ page }) => {
    await page.keyboard.down("Shift");
    await page.mouse.move(CAPTURE_START.x, CAPTURE_START.y);
    await page.mouse.down();
    await page.mouse.move(CAPTURE_END.x, CAPTURE_END.y, { steps: DRAG_STEPS });
    await page.keyboard.up("Shift");
    await page.mouse.up();

    await expect.poll(() => getImageWrites(page)).toHaveLength(1);
  });

  test("a pen stroke inside the area is drawn into the image", async ({ reactGrab, page }) => {
    const penButton = page.locator('[data-react-grab-toolbar-action="annotate-pen"]');
    await penButton.click();
    await page.mouse.move(LINE_START.x, LINE_START.y);
    await page.mouse.down();
    await page.mouse.move(LINE_END.x, LINE_END.y, { steps: DRAG_STEPS });
    await page.mouse.up();
    await expect(reactGrab.getOverlayHost().locator(STROKE_SELECTOR)).toHaveCount(1);
    await penButton.click();

    await shiftDrag(page, CAPTURE_START, CAPTURE_END);

    await expect.poll(() => getImageWrites(page)).toHaveLength(1);
    const strokeMidpointX = (LINE_START.x + LINE_END.x) / 2;
    const pixel = await sampleLastImagePixel(
      page,
      strokeMidpointX - CAPTURE_START.x,
      LINE_START.y - CAPTURE_START.y,
      CAPTURE_END.x - CAPTURE_START.x,
    );
    expect(pixel).not.toBeNull();
    expect(pixel!.red).toBeGreaterThan(STROKE_RED_MIN);
    expect(pixel!.green).toBeLessThan(STROKE_GREEN_MAX);
    expect(pixel!.blue).toBeLessThan(STROKE_BLUE_MAX);
  });

  test("the camera cursor shows while Shift is held in Grab, not in Pen", async ({ page }) => {
    await page.keyboard.down("Shift");
    await expect.poll(() => readPageCursor(page)).toContain("3 6, crosshair");
    await page.keyboard.up("Shift");
    await expect.poll(() => readPageCursor(page)).not.toContain("3 6, crosshair");

    await page.locator('[data-react-grab-toolbar-action="annotate-pen"]').click();
    await page.keyboard.down("Shift");
    await expect.poll(() => readPageCursor(page)).toContain("4 20, crosshair");
    await page.keyboard.up("Shift");
  });

  test("a Shift+drag under the minimum size acts as a Shift+click", async ({ reactGrab, page }) => {
    const firstBox = await getTodoItemBox(page, 0);
    const pressX = firstBox.x + firstBox.width / 2;
    const pressY = firstBox.y + firstBox.height / 2;

    await page.keyboard.down("Shift");
    await page.mouse.move(pressX, pressY);
    await page.mouse.down();
    await page.mouse.move(pressX + UNDERSIZED_DRAG_PX, pressY + UNDERSIZED_DRAG_PX, { steps: 2 });
    await page.mouse.up();

    await expect.poll(async () => (await reactGrab.getState()).labelInstances).toHaveLength(0);
    await page.keyboard.up("Shift");

    await expect.poll(() => reactGrab.getClipboardContent()).toContain("TodoItem");
    await page.waitForTimeout(NO_IMAGE_SETTLE_MS);
    expect(await getImageWrites(page)).toHaveLength(0);
  });

  test("Shift+drag adds to a pending multi-selection instead of capturing", async ({
    reactGrab,
    page,
  }) => {
    const firstBox = await getTodoItemBox(page, 0);
    const thirdBox = await getTodoItemBox(page, 2);
    const fourthBox = await getTodoItemBox(page, 3);

    await page.keyboard.down("Shift");
    await page.mouse.click(firstBox.x + firstBox.width / 2, firstBox.y + firstBox.height / 2);
    await page.mouse.move(thirdBox.x - DRAG_OUTSET_PX, thirdBox.y - DRAG_OUTSET_PX / 4);
    await page.mouse.down();
    await page.mouse.move(
      fourthBox.x + fourthBox.width + DRAG_OUTSET_PX,
      fourthBox.y + fourthBox.height + DRAG_OUTSET_PX / 4,
      { steps: DRAG_STEPS },
    );
    await page.mouse.up();
    await page.keyboard.up("Shift");

    await expect
      .poll(async () => (await reactGrab.getClipboardContent()).match(/TodoItem/g)?.length ?? 0)
      .toBeGreaterThanOrEqual(3);
    await page.waitForTimeout(NO_IMAGE_SETTLE_MS);
    expect(await getImageWrites(page)).toHaveLength(0);
  });

  test("a Shift-pinned specs panel lets go once a screenshot drag moves", async ({ page }) => {
    await installSpecsFixture(page);
    await switchOnSpecs(page);
    await inspect(page, "specs-token-button");
    const pressPoint = await getCenter(page, "[data-testid='specs-token-button']");

    await page.keyboard.down("Shift");
    await expect(page.locator(PINNED_PANEL_SELECTOR)).toHaveCount(1);
    await page.mouse.down();
    await page.mouse.move(pressPoint.x - 150, pressPoint.y + 80, { steps: DRAG_STEPS });
    await expect(page.locator(PINNED_PANEL_SELECTOR)).toHaveCount(0);
    await page.mouse.up();
    await page.keyboard.up("Shift");

    await expect.poll(() => getImageWrites(page)).toHaveLength(1);
  });
});
