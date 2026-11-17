// Shift+drag in the Grab tool copies a PNG of the dragged page area instead
// of the elements in it.
import type { Page } from "@playwright/test";
import { test, expect, type ReactGrabPageObject } from "./fixtures.js";
import { KEYBOARD_ACTIVATION_SETTLE_DELAY_MS } from "./constants.js";
import {
  findColorInLastImage,
  getClipboardWriteCallCount,
  getCopyEventCount,
  getImageWrites,
  getUnhandledRejections,
  installClipboardRecorder,
  openClipboardGate,
  sampleLastImagePixel,
} from "./screenshot-fixture.js";
import {
  AWAY_POSITION,
  PINNED_PANEL_SELECTOR,
  getCenter,
  inspect,
  installSpecsFixture,
  pinAndReach,
  switchOnSpecs,
} from "./specs-panel-fixture.js";

const TODO_ITEM_SELECTOR = "[data-testid='todo-list'] li span";
const STROKE_SELECTOR = "[data-react-grab-annotation-stroke]";
const TEXT_SELECTOR = "[data-react-grab-annotation-text]";
const TEXT_INPUT_SELECTOR = "[data-react-grab-annotation-input]";
const TOOLBAR_SELECTOR = "[data-react-grab-toolbar]";
const MARQUEE_SELECTOR = "[data-react-grab-screenshot-marquee]";
const MARQUEE_SIZE_SELECTOR = "[data-react-grab-screenshot-size]";
const COMPLETION_SELECTOR = "[data-react-grab-completion]";
const ERROR_SELECTOR = "[data-react-grab-error]";
const RETRY_SELECTOR = "[data-react-grab-retry]";
const THUMBNAIL_SELECTOR = "[data-react-grab-screenshot-thumbnail]";
const TOOLBAR_TOGGLE_SELECTOR = "[data-react-grab-toolbar-toggle]";
const CAMERA_BUTTON_SELECTOR = "[data-react-grab-copy-screenshot]";
const MORE_OPTIONS_SELECTOR = "[data-react-grab-more-options]";
const CAPTURING_SELECTOR = "[data-react-grab-screenshot-capturing]";
const SCREENSHOT_ERROR_SELECTOR = "[data-react-grab-screenshot-error]";
const FIRST_TODO_SELECTOR = "[data-testid='todo-list'] li:first-child span";
const PAGE_BUTTON_ID = "persistent-pill-page-button";
const PAGE_BUTTON_POSITION = { x: 40, y: 640 };
const SCREENSHOT_SELECTION_PADDING_PX = 8;
const PERSISTENCE_CHECK_MS = 3000;
const ANCHOR_REMOVAL_DISMISS_TIMEOUT_MS = 1000;
const COPY_FEEDBACK_DURATION_MS = 1500;
const HIDDEN_LABEL_REMOVAL_WAIT_MS = COPY_FEEDBACK_DURATION_MS + 125 + 500;
const MODIFIER_RELEASE_DELAY_MS = COPY_FEEDBACK_DURATION_MS + 200;
const SPECS_PIN_SELECTOR = "[data-react-grab-specs-pin]";
const PEN_TOOL_SELECTOR = '[data-react-grab-toolbar-action="annotate-pen"]';
const SHADOW_HOST_ID = "persistent-pill-shadow-host";
const SHADOW_ANCHOR_SELECTOR = `#${SHADOW_HOST_ID} button`;
const DETACHING_ANCHOR_ID = "persistent-pill-detaching-anchor";
const SAME_ORIGIN_IFRAME_SELECTOR = "[data-testid='same-origin-iframe']";
const IFRAME_TARGET_SELECTOR = "[data-testid='iframe-target']";
const INJECTED_ANCHOR_BOX = { left: 520, top: 600, width: 160, height: 40 };
const PEN_STROKE_START = { x: 700, y: 520 };
const PEN_STROKE_END = { x: 800, y: 540 };
const CAMERA_CURSOR_HOTSPOT = "3 6, crosshair";
const CAPTURE_START = { x: 250, y: 280 };
const CAPTURE_END = { x: 610, y: 380 };
const LINE_START = { x: 300, y: 320 };
const LINE_END = { x: 520, y: 320 };
const NOTE_POSITION = { x: 300, y: 330 };
const NOTE_TEXT = "Check";
const DRAG_STEPS = 8;
const UNDERSIZED_DRAG_PX = 4;
const DRAG_OUTSET_PX = 20;
// Comfortably past the release grace window, so Shift no longer counts.
const SHIFT_RELEASED_SETTLE_MS = 400;
const NO_IMAGE_SETTLE_MS = 600;
const STROKE_RED_MIN = 180;
const STROKE_GREEN_MAX = 140;
const STROKE_BLUE_MAX = 110;
// Below the overlay host's maximum z-index, above everything on the page.
const INJECTED_BLOCK_Z_INDEX = "2147483000";
const COLOR_BLOCK_PAGE_LEFT = 300;
const COLOR_BLOCK_PAGE_TOP = 300;
const COLOR_BLOCK_SIZE = { width: 240, height: 100 };
const COLOR_BLOCK_INNER_OFFSET = { x: 60, y: 30 };
const COLOR_BLOCK_INNER_SIZE = { width: 80, height: 40 };
const COLOR_BLOCK_CAPTURE_OUTSET = { x: 20, y: 10 };
const COLOR_BLOCK_OUTER_COLOR = { red: 20, green: 90, blue: 230 };
const COLOR_BLOCK_INNER_COLOR = { red: 20, green: 200, blue: 90 };
const TOOLBAR_COVER_COLOR = { red: 220, green: 0, blue: 200 };
const TOOLBAR_COVER_OUTSET_PX = 60;
const TOOLBAR_CAPTURE_OUTSET = { x: 35, y: 36 };
const TOOLBAR_CAPTURE_END_OFFSET = { x: 15, y: 14 };
const SCROLLED_PAGE_Y = 1200;
// Samples sit this far inside or outside an edge, clear of antialiasing.
const EDGE_SAMPLE_INSET_PX = 3;
const SOLID_COLOR_TOLERANCE = 6;
const NOTE_COLOR_TOLERANCE = 40;
const NOTE_POSITION_TOLERANCE_PX = 4;
const NOTE_MIN_MATCHING_PIXELS = 10;

interface ClientBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

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

const getTodoItemCenter = async (page: Page, index: number) => {
  const box = await getTodoItemBox(page, index);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
};

const isReactGrabActive = (page: Page) =>
  page.evaluate(() => window.__REACT_GRAB__?.isActive() ?? false);

const clickToolbarButton = async (page: Page) => {
  const wasActive = await isReactGrabActive(page);
  await page.locator(TOOLBAR_TOGGLE_SELECTOR).click();
  await expect.poll(() => isReactGrabActive(page)).toBe(!wasActive);
};

const getTodoItemBox = async (page: Page, index: number) => {
  const box = await page.locator(TODO_ITEM_SELECTOR).nth(index).boundingBox();
  if (!box) throw new Error(`No box for todo item ${index}`);
  return box;
};

const injectColorBlock = (page: Page, pageTop: number) =>
  page.evaluate(
    ({ top, left, size, innerOffset, innerSize, outerColor, innerColor, zIndex }) => {
      const toCss = (color: { red: number; green: number; blue: number }) =>
        `rgb(${color.red}, ${color.green}, ${color.blue})`;
      const outerBlock = document.createElement("div");
      Object.assign(outerBlock.style, {
        position: "absolute",
        left: `${left}px`,
        top: `${top}px`,
        width: `${size.width}px`,
        height: `${size.height}px`,
        background: toCss(outerColor),
        zIndex,
      });
      const innerBlock = document.createElement("div");
      Object.assign(innerBlock.style, {
        position: "absolute",
        left: `${innerOffset.x}px`,
        top: `${innerOffset.y}px`,
        width: `${innerSize.width}px`,
        height: `${innerSize.height}px`,
        background: toCss(innerColor),
      });
      outerBlock.appendChild(innerBlock);
      document.body.appendChild(outerBlock);
      const toBox = (element: Element) => {
        const rect = element.getBoundingClientRect();
        return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
      };
      return { outerBox: toBox(outerBlock), innerBox: toBox(innerBlock) };
    },
    {
      top: pageTop,
      left: COLOR_BLOCK_PAGE_LEFT,
      size: COLOR_BLOCK_SIZE,
      innerOffset: COLOR_BLOCK_INNER_OFFSET,
      innerSize: COLOR_BLOCK_INNER_SIZE,
      outerColor: COLOR_BLOCK_OUTER_COLOR,
      innerColor: COLOR_BLOCK_INNER_COLOR,
      zIndex: INJECTED_BLOCK_Z_INDEX,
    },
  );

const injectFixedCover = (page: Page, box: ClientBox) =>
  page.evaluate(
    ({ coverBox, color, zIndex }) => {
      const cover = document.createElement("div");
      Object.assign(cover.style, {
        position: "fixed",
        left: `${coverBox.x}px`,
        top: `${coverBox.y}px`,
        width: `${coverBox.width}px`,
        height: `${coverBox.height}px`,
        background: `rgb(${color.red}, ${color.green}, ${color.blue})`,
        zIndex,
      });
      document.body.appendChild(cover);
    },
    { coverBox: box, color: TOOLBAR_COVER_COLOR, zIndex: INJECTED_BLOCK_Z_INDEX },
  );

// The captured inner block must sit exactly where it is on screen, and the
// pixels just past its corners must be the outer block's colour.
const expectColorBlockInLastImage = async (
  page: Page,
  innerBox: ClientBox,
  captureStart: { x: number; y: number },
  captureWidth: number,
) => {
  const innerLeft = innerBox.x - captureStart.x;
  const innerTop = innerBox.y - captureStart.y;
  const innerRight = innerLeft + innerBox.width;
  const innerBottom = innerTop + innerBox.height;
  const samples = [
    { x: innerLeft + EDGE_SAMPLE_INSET_PX, y: innerTop + EDGE_SAMPLE_INSET_PX, isInner: true },
    { x: innerLeft - EDGE_SAMPLE_INSET_PX, y: innerTop - EDGE_SAMPLE_INSET_PX, isInner: false },
    { x: innerRight - EDGE_SAMPLE_INSET_PX, y: innerBottom - EDGE_SAMPLE_INSET_PX, isInner: true },
    { x: innerRight + EDGE_SAMPLE_INSET_PX, y: innerBottom + EDGE_SAMPLE_INSET_PX, isInner: false },
  ];
  for (const sample of samples) {
    const pixel = await sampleLastImagePixel(page, sample.x, sample.y, captureWidth);
    const expectedColor = sample.isInner ? COLOR_BLOCK_INNER_COLOR : COLOR_BLOCK_OUTER_COLOR;
    expect(pixel).not.toBeNull();
    expect(Math.abs(pixel!.red - expectedColor.red)).toBeLessThanOrEqual(SOLID_COLOR_TOLERANCE);
    expect(Math.abs(pixel!.green - expectedColor.green)).toBeLessThanOrEqual(SOLID_COLOR_TOLERANCE);
    expect(Math.abs(pixel!.blue - expectedColor.blue)).toBeLessThanOrEqual(SOLID_COLOR_TOLERANCE);
  }

  const innerMatch = await findColorInLastImage(
    page,
    { x: 0, y: 0, width: captureWidth, height: Number.MAX_SAFE_INTEGER },
    COLOR_BLOCK_INNER_COLOR,
    SOLID_COLOR_TOLERANCE,
    captureWidth,
  );
  expect(innerMatch).not.toBeNull();
  expect(innerMatch!.left).toBeCloseTo(innerLeft, 0);
  expect(innerMatch!.top).toBeCloseTo(innerTop, 0);
  expect(innerMatch!.right).toBeCloseTo(innerRight, 0);
  expect(innerMatch!.bottom).toBeCloseTo(innerBottom, 0);
};

const captureAroundColorBlock = async (page: Page, outerBox: ClientBox) => {
  const captureStart = {
    x: outerBox.x - COLOR_BLOCK_CAPTURE_OUTSET.x,
    y: outerBox.y - COLOR_BLOCK_CAPTURE_OUTSET.y,
  };
  const captureEnd = {
    x: outerBox.x + outerBox.width + COLOR_BLOCK_CAPTURE_OUTSET.x,
    y: outerBox.y + outerBox.height + COLOR_BLOCK_CAPTURE_OUTSET.y,
  };
  await shiftDrag(page, captureStart, captureEnd);
  await expect.poll(() => getImageWrites(page)).toHaveLength(1);
  return { captureStart, captureWidth: captureEnd.x - captureStart.x };
};

const parseRgb = (cssColor: string) => {
  const [red, green, blue] = (cssColor.match(/\d+/g) ?? []).map(Number);
  return { red, green, blue };
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

  test("draws the capture marquee with only its dashed accent border", async ({
    reactGrab,
    page,
  }) => {
    await page.keyboard.down("Shift");
    await page.mouse.move(CAPTURE_START.x, CAPTURE_START.y);
    await page.mouse.down();
    await page.mouse.move(CAPTURE_END.x, CAPTURE_END.y, { steps: DRAG_STEPS });

    const overlayHost = reactGrab.getOverlayHost();
    const marqueeStyle = await overlayHost.locator(MARQUEE_SELECTOR).evaluate((marquee) => {
      const computedStyle = getComputedStyle(marquee);
      return {
        boxShadow: computedStyle.boxShadow,
        borderStyle: computedStyle.borderTopStyle,
        borderColor: computedStyle.borderTopColor,
        backgroundColor: computedStyle.backgroundColor,
        outlineStyle: computedStyle.outlineStyle,
      };
    });
    const accentColor = await overlayHost
      .locator(MARQUEE_SIZE_SELECTOR)
      .evaluate((readout) => getComputedStyle(readout).backgroundColor);
    expect(marqueeStyle.boxShadow).toBe("none");
    expect(marqueeStyle.borderStyle).toBe("dashed");
    expect(marqueeStyle.borderColor).toBe(accentColor);
    expect(marqueeStyle.backgroundColor).toBe("rgba(0, 0, 0, 0)");
    expect(marqueeStyle.outlineStyle).toBe("none");

    await page.mouse.up();
    await page.keyboard.up("Shift");
  });

  test("the Image copied pill stays until dismissed and has no camera button", async ({
    reactGrab,
    page,
  }) => {
    await shiftDrag(page, CAPTURE_START, CAPTURE_END);
    const completion = reactGrab.getOverlayHost().locator(COMPLETION_SELECTOR);
    await expect(completion).toContainText("Image copied");

    await page.waitForTimeout(PERSISTENCE_CHECK_MS);
    await expect(completion).toContainText("Image copied");
    await expect(completion.locator(CAMERA_BUTTON_SELECTOR)).toHaveCount(0);

    await page.keyboard.press("Escape");
    await expect(completion).toHaveCount(0);
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
  test("the image shows page pixels at their on-screen position and scale", async ({ page }) => {
    const { outerBox, innerBox } = await injectColorBlock(page, COLOR_BLOCK_PAGE_TOP);
    const { captureStart, captureWidth } = await captureAroundColorBlock(page, outerBox);
    await expectColorBlockInLastImage(page, innerBox, captureStart, captureWidth);
  });

  test("the image follows the page after it has been scrolled", async ({ page }) => {
    await page.evaluate((scrollY) => window.scrollTo(0, scrollY), SCROLLED_PAGE_Y);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(SCROLLED_PAGE_Y);
    const { outerBox, innerBox } = await injectColorBlock(
      page,
      SCROLLED_PAGE_Y + COLOR_BLOCK_PAGE_TOP,
    );
    expect(outerBox.y).toBe(COLOR_BLOCK_PAGE_TOP);

    const { captureStart, captureWidth } = await captureAroundColorBlock(page, outerBox);
    await expectColorBlockInLastImage(page, innerBox, captureStart, captureWidth);
  });

  test("the toolbar does not appear in the image", async ({ reactGrab, page }) => {
    const toolbarBox = await reactGrab.getOverlayHost().locator(TOOLBAR_SELECTOR).boundingBox();
    if (!toolbarBox) throw new Error("No toolbar box");
    await injectFixedCover(page, {
      x: toolbarBox.x - TOOLBAR_COVER_OUTSET_PX,
      y: toolbarBox.y - TOOLBAR_COVER_OUTSET_PX,
      width: toolbarBox.width + TOOLBAR_COVER_OUTSET_PX * 2,
      height: toolbarBox.height + TOOLBAR_COVER_OUTSET_PX,
    });
    const captureStart = {
      x: toolbarBox.x - TOOLBAR_CAPTURE_OUTSET.x,
      y: toolbarBox.y - TOOLBAR_CAPTURE_OUTSET.y,
    };
    const captureEnd = {
      x: toolbarBox.x + toolbarBox.width + TOOLBAR_CAPTURE_END_OFFSET.x,
      y: toolbarBox.y + TOOLBAR_CAPTURE_END_OFFSET.y,
    };
    const captureWidth = captureEnd.x - captureStart.x;

    await shiftDrag(page, captureStart, captureEnd);
    await expect.poll(() => getImageWrites(page)).toHaveLength(1);

    const coveredToolbarMatch = await findColorInLastImage(
      page,
      {
        x: toolbarBox.x - captureStart.x,
        y: toolbarBox.y - captureStart.y,
        width: toolbarBox.width,
        height: captureEnd.y - toolbarBox.y,
      },
      TOOLBAR_COVER_COLOR,
      SOLID_COLOR_TOLERANCE,
      captureWidth,
    );
    expect(coveredToolbarMatch).not.toBeNull();
    expect(coveredToolbarMatch!.pixelCount).toBeGreaterThan(0);
    expect(coveredToolbarMatch!.matchCount).toBe(coveredToolbarMatch!.pixelCount);
  });

  test("a text note inside the area is drawn where it shows on screen", async ({
    reactGrab,
    page,
  }) => {
    const textButton = page.locator('[data-react-grab-toolbar-action="annotate-text"]');
    await textButton.click();
    await page.mouse.click(NOTE_POSITION.x, NOTE_POSITION.y);
    await expect(page.locator(TEXT_INPUT_SELECTOR)).toBeFocused();
    await page.keyboard.type(NOTE_TEXT);
    await page.keyboard.press("Enter");
    const note = reactGrab.getOverlayHost().locator(TEXT_SELECTOR);
    await expect(note).toHaveText(NOTE_TEXT);
    await textButton.click();

    const noteBox = await note.boundingBox();
    if (!noteBox) throw new Error("No note box");
    const noteColor = parseRgb(
      await note.evaluate((noteElement) => getComputedStyle(noteElement).color),
    );
    const captureWidth = CAPTURE_END.x - CAPTURE_START.x;

    await shiftDrag(page, CAPTURE_START, CAPTURE_END);
    await expect.poll(() => getImageWrites(page)).toHaveLength(1);

    const noteMatch = await findColorInLastImage(
      page,
      { x: 0, y: 0, width: captureWidth, height: CAPTURE_END.y - CAPTURE_START.y },
      noteColor,
      NOTE_COLOR_TOLERANCE,
      captureWidth,
    );
    expect(noteMatch).not.toBeNull();
    expect(noteMatch!.matchCount).toBeGreaterThan(NOTE_MIN_MATCHING_PIXELS);
    const noteLeft = noteBox.x - CAPTURE_START.x;
    const noteTop = noteBox.y - CAPTURE_START.y;
    expect(noteMatch!.left).toBeGreaterThanOrEqual(noteLeft - NOTE_POSITION_TOLERANCE_PX);
    expect(noteMatch!.left).toBeLessThanOrEqual(noteLeft + NOTE_POSITION_TOLERANCE_PX);
    expect(noteMatch!.top).toBeGreaterThanOrEqual(noteTop - NOTE_POSITION_TOLERANCE_PX);
    expect(noteMatch!.right).toBeLessThanOrEqual(
      noteLeft + noteBox.width + NOTE_POSITION_TOLERANCE_PX,
    );
    expect(noteMatch!.right).toBeGreaterThanOrEqual(
      noteLeft + noteBox.width - NOTE_POSITION_TOLERANCE_PX * 2,
    );
    expect(noteMatch!.bottom).toBeLessThanOrEqual(
      noteTop + noteBox.height + NOTE_POSITION_TOLERANCE_PX,
    );
  });

  test("a rejected clipboard write shows the copy error without an unhandled rejection", async ({
    reactGrab,
    page,
  }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await installClipboardRecorder(page, { shouldReject: true });

    await shiftDrag(page, CAPTURE_START, CAPTURE_END);

    await expect(reactGrab.getOverlayHost().locator(ERROR_SELECTOR)).toContainText(
      "Couldn't copy image",
    );
    expect(await getUnhandledRejections(page)).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test("retrying a failed screenshot keeps the overlay out of the copying state", async ({
    reactGrab,
    page,
  }) => {
    await installClipboardRecorder(page, { shouldReject: true });
    await shiftDrag(page, CAPTURE_START, CAPTURE_END);
    const overlayHost = reactGrab.getOverlayHost();
    await expect(overlayHost.locator(ERROR_SELECTOR)).toContainText("Couldn't copy image");

    await installClipboardRecorder(page, { isGated: true });
    await overlayHost.locator(RETRY_SELECTOR).click();
    await expect.poll(() => getClipboardWriteCallCount(page)).toBe(1);
    const stateWhileRetrying = await reactGrab.getState();
    expect(stateWhileRetrying.isActive).toBe(true);
    expect(stateWhileRetrying.isCopying).toBe(false);

    await openClipboardGate(page);
    await expect.poll(() => getImageWrites(page)).toHaveLength(1);
    await expect(overlayHost.locator(COMPLETION_SELECTOR)).toContainText("Image copied");
  });

  test("a Shift+click made while a capture is in flight survives the capture finishing", async ({
    reactGrab,
    page,
  }) => {
    await installClipboardRecorder(page, { isGated: true });
    const firstBox = await getTodoItemBox(page, 0);

    await page.keyboard.down("Shift");
    await page.mouse.move(CAPTURE_START.x, CAPTURE_START.y);
    await page.mouse.down();
    await page.mouse.move(CAPTURE_END.x, CAPTURE_END.y, { steps: DRAG_STEPS });
    await page.mouse.up();
    await expect.poll(() => getClipboardWriteCallCount(page)).toBe(1);

    await page.mouse.click(firstBox.x + firstBox.width / 2, firstBox.y + firstBox.height / 2);
    await openClipboardGate(page);
    await expect.poll(() => getImageWrites(page)).toHaveLength(1);
    await expect(reactGrab.getOverlayHost().locator(COMPLETION_SELECTOR)).toContainText(
      "Image copied",
    );
    expect((await reactGrab.getState()).isActive).toBe(true);

    await page.keyboard.up("Shift");
    await expect.poll(() => reactGrab.getClipboardContent()).toContain("TodoItem");
  });

  test("Shift let go just before an undersized drag ends copies it like a plain drag", async ({
    reactGrab,
    page,
  }) => {
    const firstBox = await getTodoItemBox(page, 0);
    const pressX = firstBox.x + firstBox.width / 2;
    const pressY = firstBox.y + firstBox.height / 2;

    await page.keyboard.down("Shift");
    await page.mouse.move(pressX, pressY);
    await page.mouse.down();
    await page.mouse.move(pressX + UNDERSIZED_DRAG_PX, pressY + UNDERSIZED_DRAG_PX, { steps: 2 });
    await page.keyboard.up("Shift");
    await page.mouse.up();

    await expect.poll(() => reactGrab.getClipboardContent()).toContain("TodoItem");
    await expect.poll(async () => (await reactGrab.getState()).isActive).toBe(false);
    expect(await getImageWrites(page)).toHaveLength(0);
  });
});

test.describe("Screenshot capture after a real activation", () => {
  test.beforeEach(async ({ reactGrab, page }) => {
    await expect.poll(() => reactGrab.isToolbarVisible(), { timeout: 3000 }).toBe(true);
    await installClipboardRecorder(page);
  });

  test("the keyboard shortcut session takes a Shift+drag screenshot", async ({
    reactGrab,
    page,
  }) => {
    await reactGrab.activateViaKeyboard();
    await shiftDrag(page, CAPTURE_START, CAPTURE_END);

    await expect.poll(() => getImageWrites(page)).toHaveLength(1);
    await expect(reactGrab.getOverlayHost().locator(COMPLETION_SELECTOR)).toContainText(
      "Image copied",
    );
    expect(await getCopyEventCount(page)).toBe(0);
  });

  test.describe("switched on from the toolbar button", () => {
    test("Shift shows the camera cursor and Shift+drag copies an image", async ({
      reactGrab,
      page,
    }) => {
      await clickToolbarButton(page);
      await page.mouse.move(CAPTURE_START.x, CAPTURE_START.y);
      await page.keyboard.down("Shift");
      await expect.poll(() => readPageCursor(page)).toContain(CAMERA_CURSOR_HOTSPOT);
      await page.keyboard.up("Shift");

      await shiftDrag(page, CAPTURE_START, CAPTURE_END);

      await expect.poll(() => getImageWrites(page)).toHaveLength(1);
      const [imageWrite] = await getImageWrites(page);
      expect(imageWrite.types).toEqual(["image/png"]);
      await expect(reactGrab.getOverlayHost().locator(COMPLETION_SELECTOR)).toContainText(
        "Image copied",
      );
      expect(await getCopyEventCount(page)).toBe(0);
      expect(await reactGrab.getClipboardContent()).toBe("");
    });

    test("the capture switches Grab off cleanly so the next session copies", async ({
      reactGrab,
      page,
    }) => {
      await clickToolbarButton(page);
      await shiftDrag(page, CAPTURE_START, CAPTURE_END);

      await expect.poll(() => getImageWrites(page)).toHaveLength(1);
      await expect.poll(() => isReactGrabActive(page)).toBe(false);
      expect(await reactGrab.getToolbarActionPressed("copy")).toBe(false);

      await clickToolbarButton(page);
      expect(await reactGrab.getToolbarActionPressed("copy")).toBe(true);
      const firstCenter = await getTodoItemCenter(page, 0);
      await page.mouse.click(firstCenter.x, firstCenter.y);

      await expect.poll(() => reactGrab.getClipboardContent()).toContain("TodoItem");
      expect(await getImageWrites(page)).toHaveLength(1);
    });

    test("a pending Comment action does not run for a Shift+drag", async ({ reactGrab, page }) => {
      await page.evaluate(() => {
        window.__REACT_GRAB__?.setToolbarState({ defaultAction: "comment" });
      });
      await clickToolbarButton(page);
      expect(await reactGrab.getToolbarActionPressed("comment")).toBe(true);

      await shiftDrag(page, CAPTURE_START, CAPTURE_END);

      await expect.poll(() => getImageWrites(page)).toHaveLength(1);
      await expect.poll(() => isReactGrabActive(page)).toBe(false);
      expect(await reactGrab.isPromptModeActive()).toBe(false);
      expect(await reactGrab.getToolbarActionPressed("comment")).toBe(false);
      expect(await getCopyEventCount(page)).toBe(0);
    });

    test("a capture that keeps Grab on leaves the Comment action pending", async ({
      reactGrab,
      page,
    }) => {
      await page.evaluate(() => {
        window.__REACT_GRAB__?.setToolbarState({ defaultAction: "comment" });
      });
      await clickToolbarButton(page);

      await page.keyboard.down("ControlOrMeta");
      await shiftDrag(page, CAPTURE_START, CAPTURE_END);
      await page.keyboard.up("ControlOrMeta");

      await expect.poll(() => getImageWrites(page)).toHaveLength(1);
      await expect(reactGrab.getOverlayHost().locator(COMPLETION_SELECTOR)).toContainText(
        "Image copied",
      );
      expect(await isReactGrabActive(page)).toBe(true);
      expect(await reactGrab.isPromptModeActive()).toBe(false);
      expect(await reactGrab.getToolbarActionPressed("comment")).toBe(true);

      const firstCenter = await getTodoItemCenter(page, 0);
      await page.mouse.click(firstCenter.x, firstCenter.y);
      await expect.poll(() => reactGrab.isPromptModeActive()).toBe(true);
    });

    test("releasing Shift mid-drag runs the pending action on the elements", async ({
      reactGrab,
      page,
    }) => {
      await clickToolbarButton(page);
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

    test("a Shift+drag under the minimum size runs the pending action", async ({
      reactGrab,
      page,
    }) => {
      await clickToolbarButton(page);
      const firstCenter = await getTodoItemCenter(page, 0);

      await page.keyboard.down("Shift");
      await page.mouse.move(firstCenter.x, firstCenter.y);
      await page.mouse.down();
      await page.mouse.move(
        firstCenter.x + UNDERSIZED_DRAG_PX,
        firstCenter.y + UNDERSIZED_DRAG_PX,
        { steps: 2 },
      );
      await page.mouse.up();

      await expect.poll(() => reactGrab.getClipboardContent()).toContain("TodoItem");
      await page.keyboard.up("Shift");
      await page.waitForTimeout(NO_IMAGE_SETTLE_MS);
      expect(await getImageWrites(page)).toHaveLength(0);
    });
  });
});

interface CopiedPillGrab {
  captureRect: ClientBox;
  copiedText: string;
  copiedHtml: string;
}

const getGrabbedBoxesUnion = async (reactGrab: ReactGrabPageObject): Promise<ClientBox> => {
  const { grabbedBoxes } = await reactGrab.getState();
  if (grabbedBoxes.length === 0) throw new Error("No grabbed boxes");
  const left = Math.min(...grabbedBoxes.map((box) => box.bounds.x));
  const top = Math.min(...grabbedBoxes.map((box) => box.bounds.y));
  const right = Math.max(...grabbedBoxes.map((box) => box.bounds.x + box.bounds.width));
  const bottom = Math.max(...grabbedBoxes.map((box) => box.bounds.y + box.bounds.height));
  return { x: left, y: top, width: right - left, height: bottom - top };
};

const unionBoxes = (firstBox: ClientBox, secondBox: ClientBox): ClientBox => {
  const left = Math.min(firstBox.x, secondBox.x);
  const top = Math.min(firstBox.y, secondBox.y);
  const right = Math.max(firstBox.x + firstBox.width, secondBox.x + secondBox.width);
  const bottom = Math.max(firstBox.y + firstBox.height, secondBox.y + secondBox.height);
  return { x: left, y: top, width: right - left, height: bottom - top };
};

const padBox = (box: ClientBox): ClientBox => ({
  x: box.x - SCREENSHOT_SELECTION_PADDING_PX,
  y: box.y - SCREENSHOT_SELECTION_PADDING_PX,
  width: box.width + SCREENSHOT_SELECTION_PADDING_PX * 2,
  height: box.height + SCREENSHOT_SELECTION_PADDING_PX * 2,
});

const injectPageButton = (page: Page) =>
  page.evaluate(
    ({ buttonId, position }) => {
      const button = document.createElement("button");
      button.id = buttonId;
      button.textContent = "Page button";
      button.dataset.clickCount = "0";
      button.dataset.pointerDownCount = "0";
      Object.assign(button.style, {
        position: "fixed",
        left: `${position.x}px`,
        top: `${position.y}px`,
        zIndex: "2147483000",
      });
      button.addEventListener("click", () => {
        button.dataset.clickCount = String(Number(button.dataset.clickCount) + 1);
      });
      button.addEventListener(
        "pointerdown",
        () => {
          button.dataset.pointerDownCount = String(Number(button.dataset.pointerDownCount) + 1);
        },
        { capture: true },
      );
      document.body.appendChild(button);
    },
    { buttonId: PAGE_BUTTON_ID, position: PAGE_BUTTON_POSITION },
  );

const getPageButtonClickCount = (page: Page) =>
  page.evaluate(
    (buttonId) => Number(document.getElementById(buttonId)?.dataset.clickCount ?? "0"),
    PAGE_BUTTON_ID,
  );

const getPageButtonPointerDownCount = (page: Page) =>
  page.evaluate(
    (buttonId) => Number(document.getElementById(buttonId)?.dataset.pointerDownCount ?? "0"),
    PAGE_BUTTON_ID,
  );

const getLabelInstanceCount = async (reactGrab: ReactGrabPageObject) =>
  (await reactGrab.getState()).labelInstances.length;

const getCompletion = (reactGrab: ReactGrabPageObject) =>
  reactGrab.getOverlayHost().locator(COMPLETION_SELECTOR);

const grabKeepingGrabActive = async (
  reactGrab: ReactGrabPageObject,
  page: Page,
  selector: string,
) => {
  await reactGrab.hoverUntilSelected(selector);
  await page.keyboard.down("ControlOrMeta");
  await page.mouse.down();
  await page.mouse.up();
  await expect(getCompletion(reactGrab).locator(CAMERA_BUTTON_SELECTOR)).toHaveCount(1);
  await page.waitForTimeout(MODIFIER_RELEASE_DELAY_MS);
  await page.keyboard.up("ControlOrMeta");
  await expect.poll(() => isReactGrabActive(page)).toBe(true);
};

const pressActivationShortcutInPlace = async (reactGrab: ReactGrabPageObject, page: Page) => {
  await page.keyboard.down(reactGrab.modifierKey);
  await page.keyboard.down("c");
  await page.waitForTimeout(KEYBOARD_ACTIVATION_SETTLE_DELAY_MS);
  await page.keyboard.up("c");
  await page.keyboard.up(reactGrab.modifierKey);
  await expect.poll(() => isReactGrabActive(page)).toBe(true);
};

const injectShadowAnchor = (page: Page) =>
  page.evaluate(
    ({ hostId, box }) => {
      const host = document.createElement("div");
      host.id = hostId;
      const shadowRoot = host.attachShadow({ mode: "open" });
      const button = document.createElement("button");
      button.textContent = "Shadow anchor";
      Object.assign(button.style, {
        position: "fixed",
        left: `${box.left}px`,
        top: `${box.top}px`,
        width: `${box.width}px`,
        height: `${box.height}px`,
      });
      shadowRoot.appendChild(button);
      document.body.appendChild(host);
    },
    { hostId: SHADOW_HOST_ID, box: INJECTED_ANCHOR_BOX },
  );

const injectAnchorThatLeavesOnCopy = (page: Page) =>
  page.evaluate(
    ({ anchorId, box }) => {
      const anchor = document.createElement("button");
      anchor.id = anchorId;
      anchor.textContent = "Leaves on copy";
      Object.assign(anchor.style, {
        position: "fixed",
        left: `${box.left}px`,
        top: `${box.top}px`,
        width: `${box.width}px`,
        height: `${box.height}px`,
      });
      document.addEventListener(
        "copy",
        () => {
          anchor.remove();
        },
        { capture: true, once: true },
      );
      document.body.appendChild(anchor);
    },
    { anchorId: DETACHING_ANCHOR_ID, box: INJECTED_ANCHOR_BOX },
  );

const lockSpecsPinWithPill = async (reactGrab: ReactGrabPageObject, page: Page) => {
  await installSpecsFixture(page);
  await switchOnSpecs(page);
  await grabKeepingGrabActive(reactGrab, page, "[data-testid='specs-plain-button']");
  await inspect(page, "specs-token-button");
  await pinAndReach(page, "padding");
  const pinButton = page.locator(SPECS_PIN_SELECTOR);
  await pinButton.focus();
  await page.keyboard.press("Enter");
  await expect(pinButton).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(PINNED_PANEL_SELECTOR)).toHaveCount(1);
  await expect(getCompletion(reactGrab)).toHaveCount(1);
};

const grabFirstTodo = async (
  reactGrab: ReactGrabPageObject,
  page: Page,
): Promise<CopiedPillGrab> => {
  await reactGrab.hoverUntilSelected(FIRST_TODO_SELECTOR);
  const copyPayloadPromise = reactGrab.captureNextClipboardWrites();
  await page.mouse.down();
  await page.mouse.up();
  const copyPayload = await copyPayloadPromise;
  const completion = reactGrab.getOverlayHost().locator(COMPLETION_SELECTOR);
  await expect(completion.locator(CAMERA_BUTTON_SELECTOR)).toHaveCount(1);
  return {
    captureRect: padBox(await getGrabbedBoxesUnion(reactGrab)),
    copiedText: copyPayload["text/plain"],
    copiedHtml: copyPayload["text/html"],
  };
};

test.describe("Copied pill", () => {
  test.beforeEach(async ({ reactGrab, page }) => {
    await expect.poll(() => reactGrab.isToolbarVisible(), { timeout: 3000 }).toBe(true);
    await installClipboardRecorder(page);
    await reactGrab.activate();
  });

  test("a grab shows the camera and more-options buttons on a pill that stays", async ({
    reactGrab,
    page,
  }) => {
    await grabFirstTodo(reactGrab, page);
    const completion = reactGrab.getOverlayHost().locator(COMPLETION_SELECTOR);
    await expect(completion).toContainText("Copied");
    const cameraButton = completion.locator(CAMERA_BUTTON_SELECTOR);
    await expect(cameraButton).toHaveAttribute("aria-label", "Copy with screenshot");
    await expect(cameraButton).toHaveAttribute("type", "button");
    await expect(completion.locator(MORE_OPTIONS_SELECTOR)).toHaveCount(1);

    await page.waitForTimeout(PERSISTENCE_CHECK_MS);
    await expect(completion).toHaveCount(1);
    await expect(completion).toContainText("Copied");
    await expect(completion.locator(CAMERA_BUTTON_SELECTOR)).toHaveCount(1);
  });

  test("a press elsewhere dismisses the pill and still reaches the page", async ({
    reactGrab,
    page,
  }) => {
    await injectPageButton(page);
    await grabFirstTodo(reactGrab, page);
    await expect.poll(() => isReactGrabActive(page)).toBe(false);

    await page.locator(`#${PAGE_BUTTON_ID}`).click();

    expect(await getPageButtonPointerDownCount(page)).toBe(1);
    expect(await getPageButtonClickCount(page)).toBe(1);
    await expect(reactGrab.getOverlayHost().locator(COMPLETION_SELECTOR)).toHaveCount(0);
  });

  test("starting a pen stroke dismisses the pill", async ({ reactGrab, page }) => {
    await grabKeepingGrabActive(reactGrab, page, FIRST_TODO_SELECTOR);
    await page.keyboard.press(reactGrab.modifierKey);
    await expect(page.locator(PEN_TOOL_SELECTOR)).toHaveAttribute("aria-pressed", "true");
    await expect(getCompletion(reactGrab)).toHaveCount(1);

    await page.mouse.move(PEN_STROKE_START.x, PEN_STROKE_START.y);
    await page.mouse.down();
    await page.mouse.move(PEN_STROKE_END.x, PEN_STROKE_END.y, { steps: DRAG_STEPS });
    await page.mouse.up();

    await expect(reactGrab.getOverlayHost().locator(STROKE_SELECTOR)).toHaveCount(1);
    await expect(getCompletion(reactGrab)).toHaveCount(0);
  });

  test("a press under a pinned specs panel dismisses the pill", async ({ reactGrab, page }) => {
    await lockSpecsPinWithPill(reactGrab, page);

    await page.mouse.click(AWAY_POSITION.x, AWAY_POSITION.y);

    await expect(page.locator(PINNED_PANEL_SELECTOR)).toHaveCount(0);
    await expect(getCompletion(reactGrab)).toHaveCount(0);
  });

  test("Escape with the specs pin locked dismisses the pill and unlocks the pin", async ({
    reactGrab,
    page,
  }) => {
    await lockSpecsPinWithPill(reactGrab, page);

    await page.keyboard.press("Escape");

    await expect(page.locator(PINNED_PANEL_SELECTOR)).toHaveCount(0);
    await expect(getCompletion(reactGrab)).toHaveCount(0);
    expect(await isReactGrabActive(page)).toBe(true);
  });

  test("activating with the keyboard shortcut dismisses the pill", async ({ reactGrab, page }) => {
    await grabFirstTodo(reactGrab, page);
    await expect.poll(() => isReactGrabActive(page)).toBe(false);

    await pressActivationShortcutInPlace(reactGrab, page);

    await expect(getCompletion(reactGrab)).toHaveCount(0);
    await expect.poll(() => getLabelInstanceCount(reactGrab)).toBe(0);
  });

  test("the more-options button removes the pill while Grab stays active", async ({
    reactGrab,
    page,
  }) => {
    await grabKeepingGrabActive(reactGrab, page, FIRST_TODO_SELECTOR);

    await getCompletion(reactGrab).locator(MORE_OPTIONS_SELECTOR).click();

    await expect.poll(() => reactGrab.isContextMenuVisible()).toBe(true);
    await expect(getCompletion(reactGrab)).toHaveCount(0);
    await expect.poll(() => getLabelInstanceCount(reactGrab)).toBe(0);
    await installClipboardRecorder(page);
    await reactGrab.clickContextMenuItem("Copy");
    await expect.poll(() => reactGrab.getClipboardContent()).toContain("TodoItem");
  });

  test("the more-options button removes the pill when Grab was off", async ({
    reactGrab,
    page,
  }) => {
    await grabFirstTodo(reactGrab, page);
    await expect.poll(() => isReactGrabActive(page)).toBe(false);

    await getCompletion(reactGrab).locator(MORE_OPTIONS_SELECTOR).click();

    await expect.poll(() => reactGrab.isContextMenuVisible()).toBe(true);
    await expect(getCompletion(reactGrab)).toHaveCount(0);
    await expect.poll(() => getLabelInstanceCount(reactGrab)).toBe(0);
    await installClipboardRecorder(page);
    await reactGrab.clickContextMenuItem("Copy");
    await expect.poll(() => reactGrab.getClipboardContent()).toContain("TodoItem");
  });

  test("removing an anchor inside a shadow root dismisses its pill", async ({
    reactGrab,
    page,
  }) => {
    await injectShadowAnchor(page);
    await reactGrab.hoverUntilSelected(SHADOW_ANCHOR_SELECTOR);
    await page.mouse.down();
    await page.mouse.up();
    await expect(getCompletion(reactGrab).locator(CAMERA_BUTTON_SELECTOR)).toHaveCount(1);

    await page.evaluate((hostId) => {
      document.getElementById(hostId)?.shadowRoot?.querySelector("button")?.remove();
    }, SHADOW_HOST_ID);

    await expect(getCompletion(reactGrab)).toHaveCount(0, {
      timeout: ANCHOR_REMOVAL_DISMISS_TIMEOUT_MS,
    });
  });

  test("a pill whose anchor left before the copy finished is dismissed", async ({
    reactGrab,
    page,
  }) => {
    await injectAnchorThatLeavesOnCopy(page);
    await reactGrab.hoverUntilSelected(`#${DETACHING_ANCHOR_ID}`);
    await page.mouse.down();
    await page.mouse.up();
    await expect.poll(() => reactGrab.getClipboardContent()).toContain("Leaves on copy");
    expect(await page.locator(`#${DETACHING_ANCHOR_ID}`).count()).toBe(0);

    await expect
      .poll(() => getLabelInstanceCount(reactGrab), { timeout: ANCHOR_REMOVAL_DISMISS_TIMEOUT_MS })
      .toBe(0);
    await expect(getCompletion(reactGrab)).toHaveCount(0);
  });

  test("with labels hidden by the theme a grab leaves no pill behind", async ({
    reactGrab,
    page,
  }) => {
    await reactGrab.updateOptions({ theme: { grabbedBoxes: { enabled: false } } });
    await injectPageButton(page);
    await reactGrab.hoverUntilSelected(FIRST_TODO_SELECTOR);
    await page.mouse.down();
    await page.mouse.up();
    await expect.poll(() => reactGrab.getClipboardContent()).toContain("TodoItem");
    await expect(getCompletion(reactGrab)).toHaveCount(0);

    await page.waitForTimeout(HIDDEN_LABEL_REMOVAL_WAIT_MS);
    expect(await getLabelInstanceCount(reactGrab)).toBe(0);

    await page.locator(`#${PAGE_BUTTON_ID}`).click();
    expect(await getPageButtonPointerDownCount(page)).toBe(1);
    expect(await getPageButtonClickCount(page)).toBe(1);
  });

  test("a press inside a same-origin frame dismisses the pill", async ({ reactGrab, page }) => {
    await grabFirstTodo(reactGrab, page);
    await expect.poll(() => isReactGrabActive(page)).toBe(false);

    await page.frameLocator(SAME_ORIGIN_IFRAME_SELECTOR).locator(IFRAME_TARGET_SELECTOR).click();

    await expect(getCompletion(reactGrab)).toHaveCount(0);
  });

  test("Escape inside a same-origin frame dismisses the pill", async ({ reactGrab, page }) => {
    await grabFirstTodo(reactGrab, page);
    await expect.poll(() => isReactGrabActive(page)).toBe(false);
    await page.frameLocator(SAME_ORIGIN_IFRAME_SELECTOR).locator(IFRAME_TARGET_SELECTOR).focus();
    await expect(getCompletion(reactGrab)).toHaveCount(1);

    await page.keyboard.press("Escape");

    await expect(getCompletion(reactGrab)).toHaveCount(0);
  });

  test("Escape dismisses the pill", async ({ reactGrab, page }) => {
    await grabFirstTodo(reactGrab, page);
    await page.keyboard.press("Escape");
    await expect(reactGrab.getOverlayHost().locator(COMPLETION_SELECTOR)).toHaveCount(0);
  });

  test("removing the grabbed element dismisses its pill", async ({ reactGrab, page }) => {
    await grabFirstTodo(reactGrab, page);
    await page.evaluate((selector) => {
      document.querySelector(selector)?.remove();
    }, FIRST_TODO_SELECTOR);
    await expect(reactGrab.getOverlayHost().locator(COMPLETION_SELECTOR)).toHaveCount(0);
  });

  test("a second grab replaces the pill", async ({ reactGrab, page }) => {
    await grabFirstTodo(reactGrab, page);
    const completion = reactGrab.getOverlayHost().locator(COMPLETION_SELECTOR);

    await reactGrab.activate();
    await expect(completion).toHaveCount(0);
    await reactGrab.hoverUntilSelected("[data-testid='main-title']");
    await page.mouse.down();
    await page.mouse.up();

    await expect(completion).toHaveCount(1);
    await expect(completion.locator(CAMERA_BUTTON_SELECTOR)).toHaveCount(1);
    await expect.poll(() => reactGrab.getClipboardContent()).toContain("React Grab");
  });

  test("the camera copies the element text and a padded screenshot in one write", async ({
    reactGrab,
    page,
  }) => {
    const { captureRect, copiedText, copiedHtml } = await grabFirstTodo(reactGrab, page);
    const completion = reactGrab.getOverlayHost().locator(COMPLETION_SELECTOR);

    await completion.locator(CAMERA_BUTTON_SELECTOR).click();

    await expect.poll(() => getImageWrites(page)).toHaveLength(1);
    expect(await getClipboardWriteCallCount(page)).toBe(1);
    const [imageWrite] = await getImageWrites(page);
    expect([...imageWrite.types].sort()).toEqual(["image/png", "text/html", "text/plain"]);
    expect(copiedText).toContain("TodoItem");
    expect(imageWrite.plainText).toBe(copiedText);
    expect(imageWrite.html).toBe(copiedHtml);
    const expectedSize = await getExpectedPixelSize(page, captureRect.width, captureRect.height);
    expect({ width: imageWrite.width, height: imageWrite.height }).toEqual(expectedSize);

    await expect(completion).toContainText("Copied with image");
    await expect(completion.locator(THUMBNAIL_SELECTOR)).toHaveCount(1);
    await expect(completion.locator(CAMERA_BUTTON_SELECTOR)).toHaveCount(0);
    await expect(completion.locator(MORE_OPTIONS_SELECTOR)).toHaveCount(1);
    expect((await reactGrab.getState()).isActive).toBe(false);

    await page.waitForTimeout(PERSISTENCE_CHECK_MS);
    await expect(completion).toContainText("Copied with image");
  });

  test("while the camera's image is copied the pill shows a spinner and still reads Copied", async ({
    reactGrab,
    page,
  }) => {
    await grabFirstTodo(reactGrab, page);
    await installClipboardRecorder(page, { isGated: true });
    const completion = reactGrab.getOverlayHost().locator(COMPLETION_SELECTOR);

    await completion.locator(CAMERA_BUTTON_SELECTOR).click();

    await expect(completion.locator(CAPTURING_SELECTOR)).toHaveCount(1);
    await expect(completion.locator(CAMERA_BUTTON_SELECTOR)).toHaveCount(0);
    await expect(completion.locator(MORE_OPTIONS_SELECTOR)).toHaveCount(1);
    await expect(completion).toContainText("Copied");
    await expect(completion).not.toContainText("Copied with image");
    expect((await reactGrab.getState()).isActive).toBe(false);

    await openClipboardGate(page);
    await expect(completion).toContainText("Copied with image");
    await expect(completion.locator(CAPTURING_SELECTOR)).toHaveCount(0);
  });

  test("the camera on a marquee copy captures the union of the selection", async ({
    reactGrab,
    page,
  }) => {
    const firstBox = await getTodoItemBox(page, 0);
    const thirdBox = await getTodoItemBox(page, 2);
    const dragStart = { x: firstBox.x - DRAG_OUTSET_PX, y: firstBox.y - DRAG_OUTSET_PX };
    const dragEnd = {
      x: thirdBox.x + thirdBox.width + DRAG_OUTSET_PX,
      y: thirdBox.y + thirdBox.height + DRAG_OUTSET_PX,
    };
    await page.mouse.move(dragStart.x, dragStart.y);
    await page.mouse.down();
    await page.mouse.move(dragEnd.x, dragEnd.y, { steps: DRAG_STEPS });
    await page.mouse.up();

    const completion = reactGrab.getOverlayHost().locator(COMPLETION_SELECTOR);
    await expect(completion.locator(CAMERA_BUTTON_SELECTOR)).toHaveCount(1);
    const { grabbedBoxes } = await reactGrab.getState();
    expect(grabbedBoxes.length).toBeGreaterThan(1);
    const captureRect = padBox(
      unionBoxes(await getGrabbedBoxesUnion(reactGrab), {
        x: dragStart.x,
        y: dragStart.y,
        width: dragEnd.x - dragStart.x,
        height: dragEnd.y - dragStart.y,
      }),
    );

    await completion.locator(CAMERA_BUTTON_SELECTOR).click();

    await expect.poll(() => getImageWrites(page)).toHaveLength(1);
    const [imageWrite] = await getImageWrites(page);
    const expectedSize = await getExpectedPixelSize(page, captureRect.width, captureRect.height);
    expect({ width: imageWrite.width, height: imageWrite.height }).toEqual(expectedSize);
    expect(imageWrite.plainText).toContain("TodoItem");
    await expect(completion).toContainText("Copied with image");
  });

  test("a pen stroke over the element is drawn into the camera's image", async ({
    reactGrab,
    page,
  }) => {
    const todoBox = await page.locator(FIRST_TODO_SELECTOR).first().boundingBox();
    if (!todoBox) throw new Error("No box for the first todo item");
    const strokeY = todoBox.y + 2;
    const strokeStart = { x: todoBox.x + 10, y: strokeY };
    const strokeEnd = { x: todoBox.x + 90, y: strokeY };
    const penButton = page.locator('[data-react-grab-toolbar-action="annotate-pen"]');
    await penButton.click();
    await page.mouse.move(strokeStart.x, strokeStart.y);
    await page.mouse.down();
    await page.mouse.move(strokeEnd.x, strokeEnd.y, { steps: DRAG_STEPS });
    await page.mouse.up();
    await expect(reactGrab.getOverlayHost().locator(STROKE_SELECTOR)).toHaveCount(1);
    await penButton.click();

    const { captureRect } = await grabFirstTodo(reactGrab, page);
    await reactGrab
      .getOverlayHost()
      .locator(`${COMPLETION_SELECTOR} ${CAMERA_BUTTON_SELECTOR}`)
      .click();

    await expect.poll(() => getImageWrites(page)).toHaveLength(1);
    const pixel = await sampleLastImagePixel(
      page,
      (strokeStart.x + strokeEnd.x) / 2 - captureRect.x,
      strokeY - captureRect.y,
      captureRect.width,
    );
    expect(pixel).not.toBeNull();
    expect(pixel!.red).toBeGreaterThan(STROKE_RED_MIN);
    expect(pixel!.green).toBeLessThan(STROKE_GREEN_MAX);
    expect(pixel!.blue).toBeLessThan(STROKE_BLUE_MAX);
  });

  test("a rejected camera write keeps the copy and offers the camera again", async ({
    reactGrab,
    page,
  }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await grabFirstTodo(reactGrab, page);
    await installClipboardRecorder(page, { shouldReject: true });
    const overlayHost = reactGrab.getOverlayHost();
    const completion = overlayHost.locator(COMPLETION_SELECTOR);

    await completion.locator(CAMERA_BUTTON_SELECTOR).click();

    await expect(completion.locator(SCREENSHOT_ERROR_SELECTOR)).toHaveText("Couldn't copy image");
    await expect(completion).toContainText("Copied");
    await expect(completion).not.toContainText("Copied with image");
    await expect(completion.locator(CAMERA_BUTTON_SELECTOR)).toHaveCount(1);
    await expect(completion.locator(CAPTURING_SELECTOR)).toHaveCount(0);
    await expect(completion.locator(THUMBNAIL_SELECTOR)).toHaveCount(0);
    await expect(overlayHost.locator(ERROR_SELECTOR)).toHaveCount(0);
    expect(await getClipboardWriteCallCount(page)).toBe(1);
    expect(await getUnhandledRejections(page)).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test("the camera button works from the keyboard", async ({ reactGrab, page }) => {
    await grabFirstTodo(reactGrab, page);
    const completion = reactGrab.getOverlayHost().locator(COMPLETION_SELECTOR);
    await completion.locator(MORE_OPTIONS_SELECTOR).focus();
    await page.keyboard.press("Shift+Tab");
    await expect(completion.locator(CAMERA_BUTTON_SELECTOR)).toBeFocused();

    await page.keyboard.press("Enter");

    await expect.poll(() => getImageWrites(page)).toHaveLength(1);
    await expect(completion).toContainText("Copied with image");
    expect(await getClipboardWriteCallCount(page)).toBe(1);
  });
});
