// Resizing and rotating drawn annotations with the Move tool, as in a design
// tool: a selection frame with eight handles, Shift to lock the aspect ratio
// or snap the angle, Alt to resize from the centre.
import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures.js";
import {
  RECTANGLE_DRAG_STEPS,
  RECTANGLE_END_PX,
  RECTANGLE_INTERIOR_PX,
  RECTANGLE_START_PX,
} from "./constants.js";
import {
  findColorInLastImage,
  getImageWrites,
  installClipboardRecorder,
} from "./screenshot-fixture.js";

const RECTANGLE_SELECTOR = '[data-react-grab-annotation-stroke="rectangle"]';
const TEXT_SELECTOR = "[data-react-grab-annotation-text]";
const SELECTED_SELECTOR = "[data-react-grab-annotation-selected]";
const FRAME_SELECTOR = "[data-react-grab-annotation-selection]";
const RESIZE_HANDLE_SELECTOR = "[data-react-grab-annotation-resize-handle]";
const ROTATE_HANDLE_SELECTOR = "[data-react-grab-annotation-rotate-handle]";
const ITEM_OUTLINE_SELECTOR = "[data-react-grab-annotation-item-outline]";
const LABEL_SELECTOR = "[data-react-grab-annotation-transform-label]";
const RECTANGLE_WIDTH_PX = RECTANGLE_END_PX.x - RECTANGLE_START_PX.x;
const RECTANGLE_HEIGHT_PX = RECTANGLE_END_PX.y - RECTANGLE_START_PX.y;
const RECTANGLE_CENTER = {
  x: (RECTANGLE_START_PX.x + RECTANGLE_END_PX.x) / 2,
  y: (RECTANGLE_START_PX.y + RECTANGLE_END_PX.y) / 2,
};
const SELECTION_PADDING_PX = 6;
const MIN_SIZE_PX = 8;
// Far enough outside a corner handle to miss it, inside the rotate zone.
const ROTATE_ZONE_OFFSET_PX = 10;
const SECOND_RECTANGLE_OFFSET_Y = 160;
const EMPTY_POSITION = { x: 900, y: 560 };
const NOTE_POSITION = { x: 700, y: 200 };
const NOTE_TEXT = "Resize me";
const DEGREES_TO_RADIANS = Math.PI / 180;
const ANGLE_TOLERANCE_DEG = 1.5;
const RIGHT_ANGLE_COSINE_TOLERANCE = 0.001;
const SCREENSHOT_BOUNDS_TOLERANCE_PX = 4;
const RED_COLOR = { red: 242, green: 72, blue: 34 };
const RED_COLOR_TOLERANCE = 40;
const CAPTURE_START = { x: 230, y: 200 };
const CAPTURE_END = { x: 600, y: 540 };

interface Point {
  x: number;
  y: number;
}

const toolbarAction = (page: Page, actionId: string) =>
  page.locator(`[data-react-grab-toolbar-action="${actionId}"]`);

const resizeHandle = (page: Page, name: string) =>
  page.locator(`[data-react-grab-annotation-resize-handle="${name}"]`);

const drawRectangle = async (page: Page, offsetY = 0) => {
  const rectangleTool = toolbarAction(page, "annotate-rectangle");
  if ((await rectangleTool.getAttribute("aria-pressed")) !== "true") await rectangleTool.click();
  await page.mouse.move(RECTANGLE_START_PX.x, RECTANGLE_START_PX.y + offsetY);
  await page.mouse.down();
  await page.mouse.move(RECTANGLE_END_PX.x, RECTANGLE_END_PX.y + offsetY, {
    steps: RECTANGLE_DRAG_STEPS,
  });
  await page.mouse.up();
};

const selectRectangle = async (page: Page) => {
  await page.keyboard.press("v");
  await page.mouse.click(RECTANGLE_INTERIOR_PX.x, RECTANGLE_START_PX.y);
  await expect(page.locator(`${RECTANGLE_SELECTOR}${SELECTED_SELECTOR}`)).toHaveCount(1);
};

const getCenter = async (page: Page, selector: string, index = 0): Promise<Point> => {
  const box = await page.locator(selector).nth(index).boundingBox();
  if (!box) throw new Error(`No box for ${selector}`);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
};

const drag = async (page: Page, start: Point, end: Point) => {
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: RECTANGLE_DRAG_STEPS });
  await page.mouse.up();
};

const dragHandle = async (page: Page, name: string, delta: Point) => {
  const start = await getCenter(page, `[data-react-grab-annotation-resize-handle="${name}"]`);
  await drag(page, start, { x: start.x + delta.x, y: start.y + delta.y });
};

// The rectangle's own (unrotated) box: its points, before any turn.
const getRectangleBox = (page: Page, index = 0) =>
  page
    .locator(RECTANGLE_SELECTOR)
    .nth(index)
    .evaluate((element) => {
      if (!(element instanceof SVGGraphicsElement)) throw new Error("Expected an SVG shape");
      const box = element.getBBox();
      return { x: box.x, y: box.y, width: box.width, height: box.height };
    });

// Where the rectangle's four corners land on screen, turn included.
const getRenderedCorners = (page: Page, index = 0) =>
  page
    .locator(RECTANGLE_SELECTOR)
    .nth(index)
    .evaluate((element) => {
      if (!(element instanceof SVGGraphicsElement)) throw new Error("Expected an SVG shape");
      const box = element.getBBox();
      const matrix = element.getScreenCTM();
      if (!matrix) throw new Error("No screen matrix");
      return [
        [box.x, box.y],
        [box.x + box.width, box.y],
        [box.x + box.width, box.y + box.height],
        [box.x, box.y + box.height],
      ].map(([x, y]) => {
        const point = new DOMPoint(x, y).matrixTransform(matrix);
        return { x: point.x, y: point.y };
      });
    });

const getClientRect = (page: Page, selector: string, index = 0) =>
  page
    .locator(selector)
    .nth(index)
    .evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom };
    });

const getRotationDeg = async (page: Page, index = 0): Promise<number> => {
  const transform = await page.locator(RECTANGLE_SELECTOR).nth(index).getAttribute("transform");
  if (!transform) return 0;
  const match = transform.match(/rotate\((-?[\d.e-]+)/);
  return match ? Number(match[1]) : 0;
};

const rotatePointAround = (point: Point, center: Point, angleDeg: number): Point => {
  const angle = angleDeg * DEGREES_TO_RADIANS;
  const offsetX = point.x - center.x;
  const offsetY = point.y - center.y;
  return {
    x: center.x + offsetX * Math.cos(angle) - offsetY * Math.sin(angle),
    y: center.y + offsetX * Math.sin(angle) + offsetY * Math.cos(angle),
  };
};

const getTopRightRotateZone = (frameCorner: Point): Point => ({
  x: frameCorner.x + ROTATE_ZONE_OFFSET_PX,
  y: frameCorner.y - ROTATE_ZONE_OFFSET_PX,
});

const rectangleFrameTopRight = (): Point => ({
  x: RECTANGLE_END_PX.x + SELECTION_PADDING_PX,
  y: RECTANGLE_START_PX.y - SELECTION_PADDING_PX,
});

// Presses just outside the frame's top-right corner and turns the pointer
// about the frame centre by the given angle.
const rotateBy = async (
  page: Page,
  frameCenter: Point,
  frameTopRight: Point,
  angleDeg: number,
  isSnapped = false,
) => {
  const start = getTopRightRotateZone(frameTopRight);
  const end = rotatePointAround(start, frameCenter, angleDeg);
  if (isSnapped) await page.keyboard.down("Shift");
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  for (let stepIndex = 1; stepIndex <= RECTANGLE_DRAG_STEPS; stepIndex++) {
    const stepPoint = rotatePointAround(
      start,
      frameCenter,
      (angleDeg * stepIndex) / RECTANGLE_DRAG_STEPS,
    );
    await page.mouse.move(stepPoint.x, stepPoint.y);
  }
  await page.mouse.move(end.x, end.y);
  await page.mouse.up();
  if (isSnapped) await page.keyboard.up("Shift");
};

const expectRightAngles = (corners: Point[]) => {
  for (let cornerIndex = 0; cornerIndex < corners.length; cornerIndex++) {
    const previous = corners[(cornerIndex + corners.length - 1) % corners.length];
    const current = corners[cornerIndex];
    const next = corners[(cornerIndex + 1) % corners.length];
    const incomingX = current.x - previous.x;
    const incomingY = current.y - previous.y;
    const outgoingX = next.x - current.x;
    const outgoingY = next.y - current.y;
    const cosine =
      (incomingX * outgoingX + incomingY * outgoingY) /
      (Math.hypot(incomingX, incomingY) * Math.hypot(outgoingX, outgoingY));
    expect(Math.abs(cosine)).toBeLessThan(RIGHT_ANGLE_COSINE_TOLERANCE);
  }
};

const readPageCursor = (page: Page) =>
  page.evaluate(() => document.querySelector("[data-react-grab-cursor]")?.textContent ?? "");

test.describe("Resizing and rotating annotations", () => {
  test.beforeEach(async ({ reactGrab, page }) => {
    await expect.poll(() => reactGrab.isToolbarVisible(), { timeout: 3000 }).toBe(true);
    await reactGrab.activate();
    await drawRectangle(page);
    await expect(page.locator(RECTANGLE_SELECTOR)).toHaveCount(1);
  });

  test("handles show around a selection and leave with it, the tool, or a drawing tool", async ({
    page,
  }) => {
    await page.keyboard.press("v");
    await expect(page.locator(RESIZE_HANDLE_SELECTOR)).toHaveCount(0);
    await page.mouse.click(RECTANGLE_INTERIOR_PX.x, RECTANGLE_START_PX.y);
    await expect(page.locator(FRAME_SELECTOR)).toHaveCount(1);
    await expect(page.locator(RESIZE_HANDLE_SELECTOR)).toHaveCount(8);
    await expect(page.locator(ROTATE_HANDLE_SELECTOR)).toHaveCount(4);
    await expect(page.locator(ITEM_OUTLINE_SELECTOR)).toHaveCount(0);
    const handleBox = await resizeHandle(page, "top-left").boundingBox();
    const frameTopLeft = {
      x: RECTANGLE_START_PX.x - SELECTION_PADDING_PX,
      y: RECTANGLE_START_PX.y - SELECTION_PADDING_PX,
    };
    expect(handleBox!.x + handleBox!.width / 2).toBeCloseTo(frameTopLeft.x, 0);
    expect(handleBox!.y + handleBox!.height / 2).toBeCloseTo(frameTopLeft.y, 0);
    await expect(page.locator("[data-react-grab-annotation-handle]").first()).toHaveAttribute(
      "fill",
      "white",
    );

    await page.mouse.click(EMPTY_POSITION.x, EMPTY_POSITION.y);
    await expect(page.locator(RESIZE_HANDLE_SELECTOR)).toHaveCount(0);
    await expect(page.locator(FRAME_SELECTOR)).toHaveCount(0);

    await drag(page, RECTANGLE_START_PX, { x: RECTANGLE_START_PX.x + 30, y: RECTANGLE_START_PX.y });
    await expect(page.locator(RESIZE_HANDLE_SELECTOR)).toHaveCount(8);

    await page.keyboard.press("v");
    await expect(page.locator(RESIZE_HANDLE_SELECTOR)).toHaveCount(0);

    await page.keyboard.press("v");
    await page.mouse.click(RECTANGLE_INTERIOR_PX.x + 30, RECTANGLE_START_PX.y);
    await expect(page.locator(RESIZE_HANDLE_SELECTOR)).toHaveCount(8);
    await toolbarAction(page, "annotate-pen").click();
    await expect(page.locator(RESIZE_HANDLE_SELECTOR)).toHaveCount(0);
    await page.mouse.move(EMPTY_POSITION.x, EMPTY_POSITION.y);
    await page.mouse.down();
    await page.mouse.move(EMPTY_POSITION.x - 80, EMPTY_POSITION.y - 40, { steps: 4 });
    await expect(page.locator(RESIZE_HANDLE_SELECTOR)).toHaveCount(0);
    await page.mouse.up();
    await toolbarAction(page, "annotate-pen").click();
    await expect(page.locator(RESIZE_HANDLE_SELECTOR)).toHaveCount(0);
  });

  test("a corner resizes both axes about the opposite corner and shows the size", async ({
    page,
  }) => {
    await selectRectangle(page);
    const start = await getCenter(
      page,
      '[data-react-grab-annotation-resize-handle="bottom-right"]',
    );
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x + 40, start.y + 20, { steps: RECTANGLE_DRAG_STEPS });
    await expect(page.locator(LABEL_SELECTOR)).toHaveText(
      `${RECTANGLE_WIDTH_PX + 40} × ${RECTANGLE_HEIGHT_PX + 20}`,
    );
    await expect(page.locator(LABEL_SELECTOR)).toHaveCSS("background-color", "rgb(252, 167, 0)");
    await page.mouse.up();
    await expect(page.locator(LABEL_SELECTOR)).toHaveCount(0);

    expect(await getRectangleBox(page)).toEqual({
      x: RECTANGLE_START_PX.x,
      y: RECTANGLE_START_PX.y,
      width: RECTANGLE_WIDTH_PX + 40,
      height: RECTANGLE_HEIGHT_PX + 20,
    });
    await expect(page.locator(RESIZE_HANDLE_SELECTOR)).toHaveCount(8);
    await expect(page.locator(RECTANGLE_SELECTOR)).toHaveAttribute("stroke-width", "3");
  });

  test("an edge resizes one axis only", async ({ page }) => {
    await selectRectangle(page);
    await dragHandle(page, "right", { x: 50, y: 30 });
    expect(await getRectangleBox(page)).toEqual({
      x: RECTANGLE_START_PX.x,
      y: RECTANGLE_START_PX.y,
      width: RECTANGLE_WIDTH_PX + 50,
      height: RECTANGLE_HEIGHT_PX,
    });
    await dragHandle(page, "top", { x: 25, y: -20 });
    expect(await getRectangleBox(page)).toEqual({
      x: RECTANGLE_START_PX.x,
      y: RECTANGLE_START_PX.y - 20,
      width: RECTANGLE_WIDTH_PX + 50,
      height: RECTANGLE_HEIGHT_PX + 20,
    });
  });

  test("Shift locks the aspect ratio on a corner and on an edge", async ({ reactGrab, page }) => {
    await selectRectangle(page);
    await page.keyboard.down("Shift");
    await dragHandle(page, "bottom-right", { x: RECTANGLE_WIDTH_PX / 2, y: 0 });
    await page.keyboard.up("Shift");
    expect(await getRectangleBox(page)).toEqual({
      x: RECTANGLE_START_PX.x,
      y: RECTANGLE_START_PX.y,
      width: RECTANGLE_WIDTH_PX * 1.5,
      height: RECTANGLE_HEIGHT_PX * 1.5,
    });

    await page.keyboard.press(`${reactGrab.modifierKey}+z`);
    expect((await getRectangleBox(page)).width).toBe(RECTANGLE_WIDTH_PX);
    await page.mouse.click(RECTANGLE_INTERIOR_PX.x, RECTANGLE_START_PX.y);

    await page.keyboard.down("Shift");
    await dragHandle(page, "left", { x: -RECTANGLE_WIDTH_PX / 2, y: 0 });
    await page.keyboard.up("Shift");
    expect(await getRectangleBox(page)).toEqual({
      x: RECTANGLE_START_PX.x - RECTANGLE_WIDTH_PX / 2,
      y: RECTANGLE_CENTER.y - (RECTANGLE_HEIGHT_PX * 1.5) / 2,
      width: RECTANGLE_WIDTH_PX * 1.5,
      height: RECTANGLE_HEIGHT_PX * 1.5,
    });
  });

  test("Shift pressed and let go mid-drag locks and unlocks without moving", async ({ page }) => {
    await selectRectangle(page);
    const start = await getCenter(
      page,
      '[data-react-grab-annotation-resize-handle="bottom-right"]',
    );
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x + RECTANGLE_WIDTH_PX / 2, start.y, {
      steps: RECTANGLE_DRAG_STEPS,
    });
    await expect.poll(async () => (await getRectangleBox(page)).height).toBe(RECTANGLE_HEIGHT_PX);
    await page.keyboard.down("Shift");
    await expect
      .poll(async () => (await getRectangleBox(page)).height)
      .toBe(RECTANGLE_HEIGHT_PX * 1.5);
    await expect(page.locator(LABEL_SELECTOR)).toHaveText(
      `${RECTANGLE_WIDTH_PX * 1.5} × ${RECTANGLE_HEIGHT_PX * 1.5}`,
    );
    await page.keyboard.up("Shift");
    await expect.poll(async () => (await getRectangleBox(page)).height).toBe(RECTANGLE_HEIGHT_PX);
    await page.mouse.up();
    expect((await getRectangleBox(page)).width).toBe(RECTANGLE_WIDTH_PX * 1.5);
  });

  test("Alt resizes from the centre", async ({ page }) => {
    await selectRectangle(page);
    await page.keyboard.down("Alt");
    await dragHandle(page, "right", { x: 20, y: 0 });
    await page.keyboard.up("Alt");
    expect(await getRectangleBox(page)).toEqual({
      x: RECTANGLE_START_PX.x - 20,
      y: RECTANGLE_START_PX.y,
      width: RECTANGLE_WIDTH_PX + 40,
      height: RECTANGLE_HEIGHT_PX,
    });
  });

  test("dragging past the opposite side flips the shape", async ({ page }) => {
    await selectRectangle(page);
    await dragHandle(page, "right", { x: -(RECTANGLE_WIDTH_PX + 100), y: 0 });
    expect(await getRectangleBox(page)).toEqual({
      x: RECTANGLE_START_PX.x - 100,
      y: RECTANGLE_START_PX.y,
      width: 100,
      height: RECTANGLE_HEIGHT_PX,
    });
    await expect(page.locator(RECTANGLE_SELECTOR)).toHaveAttribute(
      "d",
      new RegExp(
        `^M${RECTANGLE_START_PX.x} ${RECTANGLE_START_PX.y}L${RECTANGLE_START_PX.x - 100} `,
      ),
    );
  });

  test("a shape never shrinks below the minimum size", async ({ page }) => {
    await selectRectangle(page);
    await dragHandle(page, "right", { x: -(RECTANGLE_WIDTH_PX - 2), y: 0 });
    expect((await getRectangleBox(page)).width).toBeCloseTo(MIN_SIZE_PX, 5);
    await dragHandle(page, "bottom", { x: 0, y: -RECTANGLE_HEIGHT_PX });
    expect((await getRectangleBox(page)).height).toBeCloseTo(MIN_SIZE_PX, 5);
  });

  test("the rotate zone turns the shape about its centre and shows the angle", async ({ page }) => {
    await selectRectangle(page);
    const zone = getTopRightRotateZone(rectangleFrameTopRight());
    await page.mouse.move(zone.x, zone.y);
    const zoneCursor = await page
      .locator('[data-react-grab-annotation-rotate-handle="top-right"]')
      .evaluate((element) => getComputedStyle(element).cursor);
    expect(zoneCursor).toContain("data:image/svg+xml");
    expect(zoneCursor).toContain("crosshair");

    const end = rotatePointAround(zone, RECTANGLE_CENTER, 40);
    await page.mouse.down();
    await expect.poll(() => readPageCursor(page)).toContain("12 12, crosshair");
    await page.mouse.move(end.x, end.y, { steps: RECTANGLE_DRAG_STEPS });
    await expect(page.locator(LABEL_SELECTOR)).toHaveText(/^(39|40|41)°$/);
    await page.mouse.up();
    await expect(page.locator(LABEL_SELECTOR)).toHaveCount(0);
    await expect.poll(() => readPageCursor(page)).toContain("12 12, grab");

    expect(Math.abs((await getRotationDeg(page)) - 40)).toBeLessThan(ANGLE_TOLERANCE_DEG);
    expect(await getRectangleBox(page)).toEqual({
      x: RECTANGLE_START_PX.x,
      y: RECTANGLE_START_PX.y,
      width: RECTANGLE_WIDTH_PX,
      height: RECTANGLE_HEIGHT_PX,
    });
    const corners = await getRenderedCorners(page);
    const renderedCenter = {
      x: (corners[0].x + corners[2].x) / 2,
      y: (corners[0].y + corners[2].y) / 2,
    };
    expect(renderedCenter.x).toBeCloseTo(RECTANGLE_CENTER.x, 1);
    expect(renderedCenter.y).toBeCloseTo(RECTANGLE_CENTER.y, 1);

    const frameTransform = await page
      .locator(FRAME_SELECTOR)
      .evaluate((element) => element.parentElement?.getAttribute("transform") ?? "");
    const frameAngle = Number(frameTransform.match(/rotate\((-?[\d.e-]+)/)?.[1]);
    expect(Math.abs(frameAngle - 40)).toBeLessThan(ANGLE_TOLERANCE_DEG);
  });

  test("Shift snaps the angle to 15° steps", async ({ page }) => {
    await selectRectangle(page);
    const zone = getTopRightRotateZone(rectangleFrameTopRight());
    await page.keyboard.down("Shift");
    await page.mouse.move(zone.x, zone.y);
    await page.mouse.down();
    const end = rotatePointAround(zone, RECTANGLE_CENTER, 50);
    await page.mouse.move(end.x, end.y, { steps: RECTANGLE_DRAG_STEPS });
    await expect(page.locator(LABEL_SELECTOR)).toHaveText("45°");
    await page.mouse.up();
    await page.keyboard.up("Shift");
    expect(await getRotationDeg(page)).toBeCloseTo(45, 6);
  });

  test("resizing a rotated rectangle keeps it a rectangle", async ({ page }) => {
    await selectRectangle(page);
    await rotateBy(page, RECTANGLE_CENTER, rectangleFrameTopRight(), 30, true);
    expect(await getRotationDeg(page)).toBeCloseTo(30, 6);
    // 30° is nearer the diagonal than the horizontal.
    expect(
      await resizeHandle(page, "right").evaluate((element) => getComputedStyle(element).cursor),
    ).toBe("nwse-resize");

    await dragHandle(page, "right", { x: 40, y: 10 });
    expectRightAngles(await getRenderedCorners(page));
    const afterEdge = await getRectangleBox(page);
    expect(afterEdge.width).toBeGreaterThan(RECTANGLE_WIDTH_PX + 30);
    expect(afterEdge.height).toBeCloseTo(RECTANGLE_HEIGHT_PX, 5);

    await dragHandle(page, "bottom-left", { x: -30, y: 25 });
    expectRightAngles(await getRenderedCorners(page));
    expect(await getRotationDeg(page)).toBeCloseTo(30, 6);
    expect((await getRectangleBox(page)).height).toBeGreaterThan(RECTANGLE_HEIGHT_PX);
  });

  test("a group resizes and rotates as one about its frame", async ({ page }) => {
    await drawRectangle(page, SECOND_RECTANGLE_OFFSET_Y);
    await page.keyboard.press("v");
    await drag(
      page,
      { x: RECTANGLE_START_PX.x - 40, y: RECTANGLE_START_PX.y - 40 },
      { x: RECTANGLE_END_PX.x + 40, y: RECTANGLE_END_PX.y + SECOND_RECTANGLE_OFFSET_Y + 40 },
    );
    await expect(page.locator(`${RECTANGLE_SELECTOR}${SELECTED_SELECTOR}`)).toHaveCount(2);
    await expect(page.locator(FRAME_SELECTOR)).toHaveCount(1);
    await expect(page.locator(ITEM_OUTLINE_SELECTOR)).toHaveCount(2);
    await expect(page.locator(RESIZE_HANDLE_SELECTOR)).toHaveCount(8);

    const groupHeight = RECTANGLE_HEIGHT_PX + SECOND_RECTANGLE_OFFSET_Y;
    await dragHandle(page, "bottom-right", {
      x: RECTANGLE_WIDTH_PX / 4,
      y: groupHeight / 4,
    });
    expect(await getRectangleBox(page, 0)).toEqual({
      x: RECTANGLE_START_PX.x,
      y: RECTANGLE_START_PX.y,
      width: RECTANGLE_WIDTH_PX * 1.25,
      height: RECTANGLE_HEIGHT_PX * 1.25,
    });
    expect(await getRectangleBox(page, 1)).toEqual({
      x: RECTANGLE_START_PX.x,
      y: RECTANGLE_START_PX.y + SECOND_RECTANGLE_OFFSET_Y * 1.25,
      width: RECTANGLE_WIDTH_PX * 1.25,
      height: RECTANGLE_HEIGHT_PX * 1.25,
    });

    const groupCenter = {
      x: RECTANGLE_START_PX.x + (RECTANGLE_WIDTH_PX * 1.25) / 2,
      y: RECTANGLE_START_PX.y + (groupHeight * 1.25) / 2,
    };
    const groupTopRight = {
      x: RECTANGLE_START_PX.x + RECTANGLE_WIDTH_PX * 1.25 + SELECTION_PADDING_PX,
      y: RECTANGLE_START_PX.y - SELECTION_PADDING_PX,
    };
    await rotateBy(page, groupCenter, groupTopRight, 90, true);
    for (const index of [0, 1]) {
      expect(await getRotationDeg(page, index)).toBeCloseTo(90, 6);
    }
    const firstCorners = await getRenderedCorners(page, 0);
    const firstCenter = {
      x: (firstCorners[0].x + firstCorners[2].x) / 2,
      y: (firstCorners[0].y + firstCorners[2].y) / 2,
    };
    const firstStartCenter = {
      x: RECTANGLE_START_PX.x + (RECTANGLE_WIDTH_PX * 1.25) / 2,
      y: RECTANGLE_START_PX.y + (RECTANGLE_HEIGHT_PX * 1.25) / 2,
    };
    const expectedCenter = rotatePointAround(firstStartCenter, groupCenter, 90);
    expect(firstCenter.x).toBeCloseTo(expectedCenter.x, 1);
    expect(firstCenter.y).toBeCloseTo(expectedCenter.y, 1);
    await expect(page.locator(FRAME_SELECTOR)).toHaveCount(1);
  });

  test("undo and redo take back a resize and a rotate one at a time", async ({
    reactGrab,
    page,
  }) => {
    await selectRectangle(page);
    await dragHandle(page, "bottom-right", { x: 40, y: 20 });
    await rotateBy(
      page,
      { x: RECTANGLE_CENTER.x + 20, y: RECTANGLE_CENTER.y + 10 },
      {
        x: RECTANGLE_END_PX.x + 40 + SELECTION_PADDING_PX,
        y: RECTANGLE_START_PX.y - SELECTION_PADDING_PX,
      },
      30,
      true,
    );
    expect(await getRotationDeg(page)).toBeCloseTo(30, 6);
    const resizedBox = await getRectangleBox(page);

    await page.keyboard.press(`${reactGrab.modifierKey}+z`);
    expect(await getRotationDeg(page)).toBe(0);
    expect(await getRectangleBox(page)).toEqual(resizedBox);

    await page.keyboard.press(`${reactGrab.modifierKey}+z`);
    expect((await getRectangleBox(page)).width).toBe(RECTANGLE_WIDTH_PX);

    await page.keyboard.press(`${reactGrab.modifierKey}+Shift+z`);
    expect(await getRectangleBox(page)).toEqual(resizedBox);
    expect(await getRotationDeg(page)).toBe(0);

    await page.keyboard.press(`${reactGrab.modifierKey}+Shift+z`);
    expect(await getRotationDeg(page)).toBeCloseTo(30, 6);
  });

  test("a click on a handle without a drag records nothing", async ({ reactGrab, page }) => {
    await selectRectangle(page);
    const handleCenter = await getCenter(
      page,
      '[data-react-grab-annotation-resize-handle="right"]',
    );
    await page.mouse.click(handleCenter.x, handleCenter.y);
    expect(await getRectangleBox(page)).toEqual({
      x: RECTANGLE_START_PX.x,
      y: RECTANGLE_START_PX.y,
      width: RECTANGLE_WIDTH_PX,
      height: RECTANGLE_HEIGHT_PX,
    });
    await page.keyboard.press(`${reactGrab.modifierKey}+z`);
    await expect(page.locator(RECTANGLE_SELECTOR)).toHaveCount(0);
  });

  test("Escape calls off a resize and a rotate mid-drag and keeps the session", async ({
    reactGrab,
    page,
  }) => {
    await selectRectangle(page);
    const before = await getRectangleBox(page);
    const start = await getCenter(
      page,
      '[data-react-grab-annotation-resize-handle="bottom-right"]',
    );
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x + 60, start.y + 40, { steps: RECTANGLE_DRAG_STEPS });
    expect((await getRectangleBox(page)).width).toBe(RECTANGLE_WIDTH_PX + 60);
    await page.keyboard.press("Escape");
    expect(await getRectangleBox(page)).toEqual(before);
    await expect(page.locator(LABEL_SELECTOR)).toHaveCount(0);
    await page.mouse.move(start.x + 90, start.y + 50);
    await page.mouse.up();
    expect(await getRectangleBox(page)).toEqual(before);
    expect(await reactGrab.isOverlayVisible()).toBe(true);

    const zone = getTopRightRotateZone(rectangleFrameTopRight());
    await page.mouse.move(zone.x, zone.y);
    await page.mouse.down();
    const end = rotatePointAround(zone, RECTANGLE_CENTER, 30);
    await page.mouse.move(end.x, end.y, { steps: RECTANGLE_DRAG_STEPS });
    expect(await getRotationDeg(page)).not.toBe(0);
    await page.keyboard.press("Escape");
    expect(await getRotationDeg(page)).toBe(0);
    await page.mouse.up();
    expect(await getRotationDeg(page)).toBe(0);

    await page.keyboard.press(`${reactGrab.modifierKey}+z`);
    await expect(page.locator(RECTANGLE_SELECTOR)).toHaveCount(0);
  });

  test("handles show the resize cursor for their direction, turned with the shape", async ({
    page,
  }) => {
    await selectRectangle(page);
    const readHandleCursor = (name: string) =>
      resizeHandle(page, name).evaluate((element) => getComputedStyle(element).cursor);
    expect(await readHandleCursor("bottom-right")).toBe("nwse-resize");
    expect(await readHandleCursor("top-right")).toBe("nesw-resize");
    expect(await readHandleCursor("top")).toBe("ns-resize");
    expect(await readHandleCursor("left")).toBe("ew-resize");

    const start = await getCenter(
      page,
      '[data-react-grab-annotation-resize-handle="bottom-right"]',
    );
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x + 30, start.y + 30, { steps: RECTANGLE_DRAG_STEPS });
    await expect.poll(() => readPageCursor(page)).toContain("cursor: nwse-resize !important");
    await page.mouse.up();
    await expect.poll(() => readPageCursor(page)).toContain("12 12, grab");

    await rotateBy(
      page,
      { x: RECTANGLE_CENTER.x + 15, y: RECTANGLE_CENTER.y + 15 },
      {
        x: RECTANGLE_END_PX.x + 30 + SELECTION_PADDING_PX,
        y: RECTANGLE_START_PX.y - SELECTION_PADDING_PX,
      },
      90,
      true,
    );
    expect(await getRotationDeg(page)).toBeCloseTo(90, 6);
    expect(await readHandleCursor("right")).toBe("ns-resize");
    expect(await readHandleCursor("bottom-right")).toBe("nesw-resize");
  });

  test("a marquee picks up a rotated shape by where it shows", async ({ page }) => {
    await selectRectangle(page);
    await rotateBy(page, RECTANGLE_CENTER, rectangleFrameTopRight(), 90, true);
    expect(await getRotationDeg(page)).toBeCloseTo(90, 6);
    await page.mouse.click(EMPTY_POSITION.x, EMPTY_POSITION.y);
    await expect(page.locator(SELECTED_SELECTOR)).toHaveCount(0);

    // Above the drawn (unrotated) box but inside the turned one.
    const marqueeTop = RECTANGLE_CENTER.y - RECTANGLE_WIDTH_PX / 2 + 10;
    await drag(
      page,
      { x: RECTANGLE_CENTER.x - 20, y: marqueeTop },
      { x: RECTANGLE_CENTER.x - 10, y: RECTANGLE_START_PX.y - 20 },
    );
    await expect(page.locator(`${RECTANGLE_SELECTOR}${SELECTED_SELECTOR}`)).toHaveCount(1);
  });

  test("a note scales from its corners and rotates, and has no edge handles", async ({ page }) => {
    await toolbarAction(page, "annotate-text").click();
    await page.mouse.click(NOTE_POSITION.x, NOTE_POSITION.y);
    await expect(page.locator("[data-react-grab-annotation-input]")).toBeFocused();
    await page.keyboard.type(NOTE_TEXT);
    await page.keyboard.press("Enter");
    await expect(page.locator(TEXT_SELECTOR)).toHaveText(NOTE_TEXT);
    await page.keyboard.press("v");
    const noteCenter = await getCenter(page, TEXT_SELECTOR);
    await page.mouse.click(noteCenter.x, noteCenter.y);
    await expect(page.locator(`${TEXT_SELECTOR}${SELECTED_SELECTOR}`)).toHaveCount(1);
    await expect(page.locator(RESIZE_HANDLE_SELECTOR)).toHaveCount(4);
    await expect(page.locator(ROTATE_HANDLE_SELECTOR)).toHaveCount(4);
    await expect(resizeHandle(page, "right")).toHaveCount(0);

    const before = await getClientRect(page, TEXT_SELECTOR);
    const beforeWidth = before.right - before.left;
    await dragHandle(page, "bottom-right", { x: beforeWidth, y: 0 });
    const scaled = await getClientRect(page, TEXT_SELECTOR);
    expect((scaled.right - scaled.left) / beforeWidth).toBeCloseTo(2, 1);
    expect(scaled.bottom - scaled.top).toBeCloseTo((before.bottom - before.top) * 2, 0);
    expect(scaled.left).toBeCloseTo(before.left, 0);
    expect(scaled.top).toBeCloseTo(before.top, 0);

    const scaledCenter = {
      x: (scaled.left + scaled.right) / 2,
      y: (scaled.top + scaled.bottom) / 2,
    };
    const topRight = await getCenter(
      page,
      '[data-react-grab-annotation-resize-handle="top-right"]',
    );
    await rotateBy(page, scaledCenter, topRight, 90, true);
    const turned = await getClientRect(page, TEXT_SELECTOR);
    expect(turned.right - turned.left).toBeCloseTo(scaled.bottom - scaled.top, 0);
    expect(turned.bottom - turned.top).toBeCloseTo(scaled.right - scaled.left, 0);
    expect((turned.left + turned.right) / 2).toBeCloseTo(scaledCenter.x, 0);
  });
});

test.describe("Transformed annotations in a screenshot", () => {
  test.beforeEach(async ({ reactGrab, page }) => {
    await expect.poll(() => reactGrab.isToolbarVisible(), { timeout: 3000 }).toBe(true);
    await installClipboardRecorder(page);
    await reactGrab.activate();
    await drawRectangle(page);
  });

  test("a resized and rotated rectangle is drawn into the image where it shows", async ({
    page,
  }) => {
    await selectRectangle(page);
    await dragHandle(page, "left", { x: 40, y: 0 });
    const resizedCenter = { x: RECTANGLE_CENTER.x + 20, y: RECTANGLE_CENTER.y };
    await rotateBy(page, resizedCenter, rectangleFrameTopRight(), 30, true);
    expect(await getRotationDeg(page)).toBeCloseTo(30, 6);
    const onScreen = await getClientRect(page, RECTANGLE_SELECTOR);
    await page.keyboard.press("v");
    await expect(page.locator(RESIZE_HANDLE_SELECTOR)).toHaveCount(0);

    await page.keyboard.down("Shift");
    await page.mouse.move(CAPTURE_START.x, CAPTURE_START.y);
    await page.mouse.down();
    await page.mouse.move(CAPTURE_END.x, CAPTURE_END.y, { steps: RECTANGLE_DRAG_STEPS });
    await page.mouse.up();
    await page.keyboard.up("Shift");
    await expect.poll(() => getImageWrites(page)).toHaveLength(1);

    const captureWidth = CAPTURE_END.x - CAPTURE_START.x;
    const drawn = await findColorInLastImage(
      page,
      { x: 0, y: 0, width: captureWidth, height: CAPTURE_END.y - CAPTURE_START.y },
      RED_COLOR,
      RED_COLOR_TOLERANCE,
      captureWidth,
    );
    expect(drawn).not.toBeNull();
    expect(Math.abs(drawn!.left - (onScreen.left - CAPTURE_START.x))).toBeLessThan(
      SCREENSHOT_BOUNDS_TOLERANCE_PX,
    );
    expect(Math.abs(drawn!.right - (onScreen.right - CAPTURE_START.x))).toBeLessThan(
      SCREENSHOT_BOUNDS_TOLERANCE_PX,
    );
    expect(Math.abs(drawn!.top - (onScreen.top - CAPTURE_START.y))).toBeLessThan(
      SCREENSHOT_BOUNDS_TOLERANCE_PX,
    );
    expect(Math.abs(drawn!.bottom - (onScreen.bottom - CAPTURE_START.y))).toBeLessThan(
      SCREENSHOT_BOUNDS_TOLERANCE_PX,
    );
  });
});
