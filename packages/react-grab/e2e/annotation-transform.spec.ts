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
const EDGE_LENGTH_TOLERANCE_PX = 0.5;
const VERTEX_TOLERANCE_PX = 0.5;
const GROUP_FRAME_TOLERANCE_PX = 1;
const SCREENSHOT_PARITY_TOLERANCE_PX = 2;
const INK_MINIMUM_RED_LEAD = 40;
const GROUP_MARQUEE_START = { x: 250, y: 230 };
const GROUP_MARQUEE_END = { x: 580, y: 610 };
const GROUP_EDGE_DRAG_PX = 100;
const TINY_RECTANGLE_START = { x: 800, y: 300 };
const TINY_RECTANGLE_SIZE_PX = 12;
const SHORT_LINE_START = { x: 800, y: 500 };
const SHORT_LINE_LENGTH_PX = 30;
const TINY_PEN_START = { x: 1000, y: 300 };
const TINY_PEN_LENGTH_PX = 6;
const NOTE_LINES = ["Look here", "and here too"];
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

// Where the rectangle's four drawn vertices land on screen: read from its
// path and carried through its own transform and every one above it.
const getRenderedVertices = (page: Page, index = 0) =>
  page
    .locator(RECTANGLE_SELECTOR)
    .nth(index)
    .evaluate((element) => {
      if (!(element instanceof SVGGraphicsElement)) throw new Error("Expected an SVG shape");
      const matrix = element.getScreenCTM();
      if (!matrix) throw new Error("No screen matrix");
      const coordinates = (element.getAttribute("d") ?? "").match(/-?\d+(\.\d+)?(e-?\d+)?/g);
      if (!coordinates || coordinates.length !== 8) throw new Error("Expected four vertices");
      return [0, 2, 4, 6].map((coordinateIndex) => {
        const point = new DOMPoint(
          Number(coordinates[coordinateIndex]),
          Number(coordinates[coordinateIndex + 1]),
        ).matrixTransform(matrix);
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

// Unskewed: every pair of adjacent edges meets square and opposite edges match.
const expectTrueRectangle = (vertices: Point[]) => {
  const edgeLengths = vertices.map((vertex, vertexIndex) => {
    const next = vertices[(vertexIndex + 1) % vertices.length];
    return Math.hypot(next.x - vertex.x, next.y - vertex.y);
  });
  for (let vertexIndex = 0; vertexIndex < vertices.length; vertexIndex++) {
    const previous = vertices[(vertexIndex + vertices.length - 1) % vertices.length];
    const current = vertices[vertexIndex];
    const next = vertices[(vertexIndex + 1) % vertices.length];
    const dotProduct =
      (current.x - previous.x) * (next.x - current.x) +
      (current.y - previous.y) * (next.y - current.y);
    const cosine =
      dotProduct /
      (edgeLengths[(vertexIndex + vertices.length - 1) % vertices.length] *
        edgeLengths[vertexIndex]);
    expect(Math.abs(cosine)).toBeLessThan(RIGHT_ANGLE_COSINE_TOLERANCE);
  }
  expect(Math.abs(edgeLengths[0] - edgeLengths[2])).toBeLessThan(EDGE_LENGTH_TOLERANCE_PX);
  expect(Math.abs(edgeLengths[1] - edgeLengths[3])).toBeLessThan(EDGE_LENGTH_TOLERANCE_PX);
};

const getVerticesBounds = (vertices: Point[]) => ({
  left: Math.min(...vertices.map((vertex) => vertex.x)),
  top: Math.min(...vertices.map((vertex) => vertex.y)),
  right: Math.max(...vertices.map((vertex) => vertex.x)),
  bottom: Math.max(...vertices.map((vertex) => vertex.y)),
});

// The selection frame's own box, without the padding drawn around it.
const getFrameBounds = async (page: Page) => {
  const frameRect = await getClientRect(page, FRAME_SELECTOR);
  return {
    left: frameRect.left + SELECTION_PADDING_PX,
    top: frameRect.top + SELECTION_PADDING_PX,
    right: frameRect.right - SELECTION_PADDING_PX,
    bottom: frameRect.bottom - SELECTION_PADDING_PX,
  };
};

const expectBoundsClose = (
  actual: { left: number; top: number; right: number; bottom: number },
  expected: { left: number; top: number; right: number; bottom: number },
  tolerancePx: number,
) => {
  expect(Math.abs(actual.left - expected.left)).toBeLessThanOrEqual(tolerancePx);
  expect(Math.abs(actual.top - expected.top)).toBeLessThanOrEqual(tolerancePx);
  expect(Math.abs(actual.right - expected.right)).toBeLessThanOrEqual(tolerancePx);
  expect(Math.abs(actual.bottom - expected.bottom)).toBeLessThanOrEqual(tolerancePx);
};

const expectVerticesClose = (actual: Point[], expected: Point[]) => {
  actual.forEach((vertex, vertexIndex) => {
    expect(Math.abs(vertex.x - expected[vertexIndex].x)).toBeLessThan(VERTEX_TOLERANCE_PX);
    expect(Math.abs(vertex.y - expected[vertexIndex].y)).toBeLessThan(VERTEX_TOLERANCE_PX);
  });
};

// A release the page sees at a point the pointer never moved to, with
// modifiers of its own: what a browser delivers when the last move before the
// release was coalesced away.
const releaseAt = (page: Page, point: Point, isShiftHeld = false) =>
  page.evaluate(
    ({ clientX, clientY, shiftKey }) => {
      window.dispatchEvent(
        new PointerEvent("pointerup", {
          clientX,
          clientY,
          shiftKey,
          button: 0,
          pointerId: 1,
          pointerType: "mouse",
          isPrimary: true,
          bubbles: true,
          composed: true,
        }),
      );
    },
    { clientX: point.x, clientY: point.y, shiftKey: isShiftHeld },
  );

const rememberElement = (page: Page, selector: string, key: string, index = 0) =>
  page
    .locator(selector)
    .nth(index)
    .evaluate((element, storageKey) => {
      Reflect.set(window, storageKey, element);
    }, key);

const isSameElement = (page: Page, selector: string, key: string, index = 0) =>
  page
    .locator(selector)
    .nth(index)
    .evaluate((element, storageKey) => element === Reflect.get(window, storageKey), key);

// Bounds of every pixel led by red, the annotation colour, so the thin,
// softened end of a pen stroke counts the same in either image.
const findInkBounds = (page: Page, imageBase64: string | null, regionWidth: number) =>
  page.evaluate(
    async ({ encodedImage, width, minimumRedLead }) => {
      const recordedBlobs = Reflect.get(window, "__screenshotRecorder")?.imageBlobs ?? [];
      const blob = encodedImage
        ? new Blob([Uint8Array.from(atob(encodedImage), (character) => character.charCodeAt(0))], {
            type: "image/png",
          })
        : recordedBlobs[recordedBlobs.length - 1];
      if (!(blob instanceof Blob)) return null;
      const bitmap = await createImageBitmap(blob);
      const scale = bitmap.width / width;
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const context = canvas.getContext("2d");
      if (!context) return null;
      context.drawImage(bitmap, 0, 0);
      const pixels = context.getImageData(0, 0, bitmap.width, bitmap.height);
      const bounds = {
        left: Number.POSITIVE_INFINITY,
        top: Number.POSITIVE_INFINITY,
        right: Number.NEGATIVE_INFINITY,
        bottom: Number.NEGATIVE_INFINITY,
      };
      for (let rowIndex = 0; rowIndex < pixels.height; rowIndex++) {
        for (let columnIndex = 0; columnIndex < pixels.width; columnIndex++) {
          const offset = (rowIndex * pixels.width + columnIndex) * 4;
          const redLead =
            pixels.data[offset] - Math.max(pixels.data[offset + 1], pixels.data[offset + 2]);
          if (redLead < minimumRedLead) continue;
          bounds.left = Math.min(bounds.left, columnIndex / scale);
          bounds.top = Math.min(bounds.top, rowIndex / scale);
          bounds.right = Math.max(bounds.right, (columnIndex + 1) / scale);
          bounds.bottom = Math.max(bounds.bottom, (rowIndex + 1) / scale);
        }
      }
      return Number.isFinite(bounds.left) ? bounds : null;
    },
    { encodedImage: imageBase64, width: regionWidth, minimumRedLead: INK_MINIMUM_RED_LEAD },
  );

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
    const corners = await getRenderedVertices(page);
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
    expectTrueRectangle(await getRenderedVertices(page));
    const afterEdge = await getRectangleBox(page);
    expect(afterEdge.width).toBeGreaterThan(RECTANGLE_WIDTH_PX + 30);
    expect(afterEdge.height).toBeCloseTo(RECTANGLE_HEIGHT_PX, 5);

    await dragHandle(page, "bottom-left", { x: -30, y: 25 });
    expectTrueRectangle(await getRenderedVertices(page));
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
    const firstCorners = await getRenderedVertices(page, 0);
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
  test("Shift on a corner dragged inward along one axis shrinks both axes", async ({ page }) => {
    await selectRectangle(page);
    await page.keyboard.down("Shift");
    await dragHandle(page, "bottom-right", { x: -RECTANGLE_WIDTH_PX / 2, y: 0 });
    await page.keyboard.up("Shift");
    expect(await getRectangleBox(page)).toEqual({
      x: RECTANGLE_START_PX.x,
      y: RECTANGLE_START_PX.y,
      width: RECTANGLE_WIDTH_PX / 2,
      height: RECTANGLE_HEIGHT_PX / 2,
    });
  });

  test("a group with a slanted item scales evenly and an inverse resize puts it back", async ({
    page,
  }) => {
    await selectRectangle(page);
    await rotateBy(page, RECTANGLE_CENTER, rectangleFrameTopRight(), 45, true);
    expect(await getRotationDeg(page)).toBeCloseTo(45, 6);
    await drawRectangle(page, SECOND_RECTANGLE_OFFSET_Y);
    await page.keyboard.press("v");
    await drag(page, GROUP_MARQUEE_START, GROUP_MARQUEE_END);
    await expect(page.locator(`${RECTANGLE_SELECTOR}${SELECTED_SELECTOR}`)).toHaveCount(2);
    const startVertices = [await getRenderedVertices(page, 0), await getRenderedVertices(page, 1)];
    const startFrame = await getFrameBounds(page);

    const readItemsBounds = async () =>
      getVerticesBounds([
        ...(await getRenderedVertices(page, 0)),
        ...(await getRenderedVertices(page, 1)),
      ]);

    const rightHandle = await getCenter(page, '[data-react-grab-annotation-resize-handle="right"]');
    await page.mouse.move(rightHandle.x, rightHandle.y);
    await page.mouse.down();
    await page.mouse.move(rightHandle.x + GROUP_EDGE_DRAG_PX, rightHandle.y, {
      steps: RECTANGLE_DRAG_STEPS,
    });
    expectBoundsClose(
      await getFrameBounds(page),
      await readItemsBounds(),
      GROUP_FRAME_TOLERANCE_PX,
    );
    await page.mouse.up();

    const grownFrame = await getFrameBounds(page);
    expectBoundsClose(grownFrame, await readItemsBounds(), GROUP_FRAME_TOLERANCE_PX);
    const startWidth = startFrame.right - startFrame.left;
    const evenScale = (startWidth + GROUP_EDGE_DRAG_PX) / startWidth;
    expect(grownFrame.bottom - grownFrame.top).toBeCloseTo(
      (startFrame.bottom - startFrame.top) * evenScale,
      0,
    );
    expectTrueRectangle(await getRenderedVertices(page, 0));

    const grownRightHandle = await getCenter(
      page,
      '[data-react-grab-annotation-resize-handle="right"]',
    );
    await drag(page, grownRightHandle, {
      x: grownRightHandle.x - GROUP_EDGE_DRAG_PX,
      y: grownRightHandle.y,
    });
    expectVerticesClose(await getRenderedVertices(page, 0), startVertices[0]);
    expectVerticesClose(await getRenderedVertices(page, 1), startVertices[1]);
    expectBoundsClose(await getFrameBounds(page), startFrame, GROUP_FRAME_TOLERANCE_PX);
  });

  test("a group of items square to it scales each along its own axes exactly", async ({ page }) => {
    await selectRectangle(page);
    await rotateBy(page, RECTANGLE_CENTER, rectangleFrameTopRight(), 90, true);
    await drawRectangle(page, SECOND_RECTANGLE_OFFSET_Y);
    await page.keyboard.press("v");
    await drag(page, GROUP_MARQUEE_START, GROUP_MARQUEE_END);
    await expect(page.locator(`${RECTANGLE_SELECTOR}${SELECTED_SELECTOR}`)).toHaveCount(2);
    const startFrame = await getFrameBounds(page);
    await dragHandle(page, "right", { x: GROUP_EDGE_DRAG_PX, y: 0 });

    const grownFrame = await getFrameBounds(page);
    expect(grownFrame.bottom - grownFrame.top).toBeCloseTo(startFrame.bottom - startFrame.top, 0);
    const scaleX = (grownFrame.right - grownFrame.left) / (startFrame.right - startFrame.left);
    // The turned rectangle's own height runs across the page, so it takes the stretch.
    const turnedBox = await getRectangleBox(page, 0);
    expect(turnedBox.width).toBeCloseTo(RECTANGLE_WIDTH_PX, 2);
    expect(turnedBox.height).toBeCloseTo(RECTANGLE_HEIGHT_PX * scaleX, 2);
    const uprightBox = await getRectangleBox(page, 1);
    expect(uprightBox.width).toBeCloseTo(RECTANGLE_WIDTH_PX * scaleX, 2);
    expect(uprightBox.height).toBeCloseTo(RECTANGLE_HEIGHT_PX, 2);
  });

  test("the release point and its modifiers decide the committed size", async ({ page }) => {
    await selectRectangle(page);
    const start = await getCenter(
      page,
      '[data-react-grab-annotation-resize-handle="bottom-right"]',
    );
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x + 10, start.y + 10, { steps: 1 });
    await releaseAt(page, { x: start.x + 60, y: start.y + 30 });
    await page.mouse.up();
    expect(await getRectangleBox(page)).toEqual({
      x: RECTANGLE_START_PX.x,
      y: RECTANGLE_START_PX.y,
      width: RECTANGLE_WIDTH_PX + 60,
      height: RECTANGLE_HEIGHT_PX + 30,
    });

    const nextStart = await getCenter(
      page,
      '[data-react-grab-annotation-resize-handle="bottom-right"]',
    );
    await page.mouse.move(nextStart.x, nextStart.y);
    await page.mouse.down();
    await page.mouse.move(nextStart.x + 10, nextStart.y, { steps: 1 });
    await releaseAt(page, { x: nextStart.x + (RECTANGLE_WIDTH_PX + 60) / 2, y: nextStart.y }, true);
    await page.mouse.up();
    expect(await getRectangleBox(page)).toEqual({
      x: RECTANGLE_START_PX.x,
      y: RECTANGLE_START_PX.y,
      width: (RECTANGLE_WIDTH_PX + 60) * 1.5,
      height: (RECTANGLE_HEIGHT_PX + 30) * 1.5,
    });
  });

  test("a jump made just before release still lands where the pointer let go", async ({ page }) => {
    await selectRectangle(page);
    const start = await getCenter(page, '[data-react-grab-annotation-resize-handle="right"]');
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x + 5, start.y, { steps: 1 });
    await page.mouse.move(start.x + 70, start.y, { steps: 1 });
    await page.mouse.up();
    expect((await getRectangleBox(page)).width).toBe(RECTANGLE_WIDTH_PX + 70);
  });

  test("a drag that changes nothing leaves no step to undo", async ({ reactGrab, page }) => {
    await selectRectangle(page);
    await dragHandle(page, "right", { x: 40, y: 0 });
    expect((await getRectangleBox(page)).width).toBe(RECTANGLE_WIDTH_PX + 40);

    const bottomRight = await getCenter(
      page,
      '[data-react-grab-annotation-resize-handle="bottom-right"]',
    );
    await page.mouse.move(bottomRight.x, bottomRight.y);
    await page.mouse.down();
    await page.mouse.move(bottomRight.x + 50, bottomRight.y + 30, { steps: RECTANGLE_DRAG_STEPS });
    await page.mouse.move(bottomRight.x, bottomRight.y, { steps: RECTANGLE_DRAG_STEPS });
    await page.mouse.up();
    await dragHandle(page, "right", { x: 0, y: 40 });
    expect((await getRectangleBox(page)).width).toBe(RECTANGLE_WIDTH_PX + 40);
    expect((await getRectangleBox(page)).height).toBe(RECTANGLE_HEIGHT_PX);

    await page.keyboard.press(`${reactGrab.modifierKey}+z`);
    expect((await getRectangleBox(page)).width).toBe(RECTANGLE_WIDTH_PX);
  });

  test("a drag redraws the shapes in place instead of rebuilding them", async ({ page }) => {
    await drawRectangle(page, SECOND_RECTANGLE_OFFSET_Y);
    await selectRectangle(page);
    await expect(page.locator(`${RECTANGLE_SELECTOR}${SELECTED_SELECTOR}`)).toHaveCount(1);
    await rememberElement(page, RECTANGLE_SELECTOR, "__selectedPath", 0);
    await rememberElement(page, RECTANGLE_SELECTOR, "__otherPath", 1);
    const startPath = await page.locator(RECTANGLE_SELECTOR).nth(0).getAttribute("d");

    const start = await getCenter(
      page,
      '[data-react-grab-annotation-resize-handle="bottom-right"]',
    );
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x + 20, start.y + 10, { steps: 2 });
    const firstStepPath = await page.locator(RECTANGLE_SELECTOR).nth(0).getAttribute("d");
    expect(firstStepPath).not.toBe(startPath);
    expect(await isSameElement(page, RECTANGLE_SELECTOR, "__selectedPath", 0)).toBe(true);
    await page.mouse.move(start.x + 40, start.y + 20, { steps: 2 });
    expect(await page.locator(RECTANGLE_SELECTOR).nth(0).getAttribute("d")).not.toBe(firstStepPath);
    expect(await isSameElement(page, RECTANGLE_SELECTOR, "__selectedPath", 0)).toBe(true);
    expect(await isSameElement(page, RECTANGLE_SELECTOR, "__otherPath", 1)).toBe(true);
    await page.mouse.up();
    expect(await isSameElement(page, RECTANGLE_SELECTOR, "__otherPath", 1)).toBe(true);

    await toolbarAction(page, "annotate-text").click();
    await page.mouse.click(NOTE_POSITION.x, NOTE_POSITION.y);
    await expect(page.locator("[data-react-grab-annotation-input]")).toBeFocused();
    await page.keyboard.type(NOTE_TEXT);
    await page.keyboard.press("Enter");
    await page.keyboard.press("v");
    const noteCenter = await getCenter(page, TEXT_SELECTOR);
    await page.mouse.click(noteCenter.x, noteCenter.y);
    await expect(page.locator(`${TEXT_SELECTOR}${SELECTED_SELECTOR}`)).toHaveCount(1);
    await rememberElement(page, TEXT_SELECTOR, "__selectedNote");
    const zone = getTopRightRotateZone(
      await getCenter(page, '[data-react-grab-annotation-resize-handle="top-right"]'),
    );
    await page.mouse.move(zone.x, zone.y);
    await page.mouse.down();
    const turnedZone = rotatePointAround(zone, noteCenter, 30);
    await page.mouse.move(turnedZone.x, turnedZone.y, { steps: RECTANGLE_DRAG_STEPS });
    await expect(page.locator(TEXT_SELECTOR)).toHaveCSS("transform", /matrix/);
    expect(await isSameElement(page, TEXT_SELECTOR, "__selectedNote")).toBe(true);
    await page.mouse.up();
  });
});

test.describe("Transform handles on small shapes and past the viewport", () => {
  const FREEHAND_SELECTOR = '[data-react-grab-annotation-stroke="freehand"]';
  const STRAIGHT_SELECTOR = '[data-react-grab-annotation-stroke="straight"]';
  const BODY_MOVE_PX = 40;

  test.beforeEach(async ({ reactGrab }) => {
    await expect.poll(() => reactGrab.isToolbarVisible(), { timeout: 3000 }).toBe(true);
    await reactGrab.activate();
  });

  const getShapeBox = async (page: Page, selector: string) => {
    const box = await page.locator(selector).boundingBox();
    if (!box) throw new Error(`No box for ${selector}`);
    return box;
  };

  // The body still takes a press at the shape's middle, and a corner and an
  // edge handle still take theirs, however small the shape.
  const expectBodyAndHandlesWork = async (
    page: Page,
    selector: string,
    bodyPoint: Point,
    edgeHandleName: string,
  ) => {
    await page.keyboard.press("v");
    await page.mouse.click(bodyPoint.x, bodyPoint.y);
    await expect(page.locator(`${selector}${SELECTED_SELECTOR}`)).toHaveCount(1);
    const startBox = await getShapeBox(page, selector);

    await drag(page, bodyPoint, { x: bodyPoint.x + BODY_MOVE_PX, y: bodyPoint.y + BODY_MOVE_PX });
    const movedBox = await getShapeBox(page, selector);
    expect(movedBox.x - startBox.x).toBeCloseTo(BODY_MOVE_PX, 0);
    expect(movedBox.y - startBox.y).toBeCloseTo(BODY_MOVE_PX, 0);
    expect(movedBox.width).toBeCloseTo(startBox.width, 0);

    await dragHandle(page, "bottom-right", { x: 20, y: 20 });
    const cornerBox = await getShapeBox(page, selector);
    expect(cornerBox.width).toBeGreaterThan(movedBox.width + 15);
    expect(cornerBox.x).toBeCloseTo(movedBox.x, 0);

    await dragHandle(page, edgeHandleName, { x: 20, y: 0 });
    const edgeBox = await getShapeBox(page, selector);
    expect(edgeBox.width).toBeGreaterThan(cornerBox.width + 15);
    expect(edgeBox.height).toBeCloseTo(cornerBox.height, 0);
  };

  test("a tiny rectangle keeps its handles and its body", async ({ page }) => {
    await toolbarAction(page, "annotate-rectangle").click();
    await page.mouse.move(TINY_RECTANGLE_START.x, TINY_RECTANGLE_START.y);
    await page.mouse.down();
    await page.mouse.move(
      TINY_RECTANGLE_START.x + TINY_RECTANGLE_SIZE_PX,
      TINY_RECTANGLE_START.y + TINY_RECTANGLE_SIZE_PX,
      { steps: RECTANGLE_DRAG_STEPS },
    );
    await page.mouse.up();
    await expect(page.locator(RECTANGLE_SELECTOR)).toHaveCount(1);
    await expectBodyAndHandlesWork(
      page,
      RECTANGLE_SELECTOR,
      {
        x: TINY_RECTANGLE_START.x + TINY_RECTANGLE_SIZE_PX / 2,
        y: TINY_RECTANGLE_START.y + TINY_RECTANGLE_SIZE_PX / 2,
      },
      "right",
    );
  });

  test("a short straight line keeps its handles and its body", async ({ page }) => {
    await toolbarAction(page, "annotate-pen").click();
    await page.keyboard.down("Shift");
    await page.mouse.move(SHORT_LINE_START.x, SHORT_LINE_START.y);
    await page.mouse.down();
    await page.mouse.move(SHORT_LINE_START.x + SHORT_LINE_LENGTH_PX, SHORT_LINE_START.y, {
      steps: RECTANGLE_DRAG_STEPS,
    });
    await page.mouse.up();
    await page.keyboard.up("Shift");
    await expect(page.locator(STRAIGHT_SELECTOR)).toHaveCount(1);
    await expectBodyAndHandlesWork(
      page,
      STRAIGHT_SELECTOR,
      { x: SHORT_LINE_START.x + SHORT_LINE_LENGTH_PX / 2, y: SHORT_LINE_START.y },
      "right",
    );
  });

  test("a tiny pen stroke keeps its handles and its body", async ({ page }) => {
    await toolbarAction(page, "annotate-pen").click();
    await page.mouse.move(TINY_PEN_START.x, TINY_PEN_START.y);
    await page.mouse.down();
    await page.mouse.move(TINY_PEN_START.x + TINY_PEN_LENGTH_PX, TINY_PEN_START.y, {
      steps: RECTANGLE_DRAG_STEPS,
    });
    await page.mouse.up();
    await expect(page.locator(FREEHAND_SELECTOR)).toHaveCount(1);
    await expectBodyAndHandlesWork(
      page,
      FREEHAND_SELECTOR,
      { x: TINY_PEN_START.x + TINY_PEN_LENGTH_PX / 2, y: TINY_PEN_START.y },
      "right",
    );
  });

  test("a resize released outside the viewport commits where it was let go", async ({ page }) => {
    await drawRectangle(page);
    await selectRectangle(page);
    const viewport = page.viewportSize();
    if (!viewport) throw new Error("No viewport");
    const start = await getCenter(page, '[data-react-grab-annotation-resize-handle="right"]');
    const releasePoint = { x: viewport.width + 40, y: start.y };
    await drag(page, start, releasePoint);
    await expect(page.locator(LABEL_SELECTOR)).toHaveCount(0);
    expect((await getRectangleBox(page)).width).toBeCloseTo(
      RECTANGLE_WIDTH_PX + releasePoint.x - start.x,
      0,
    );

    const topLeft = await getCenter(page, '[data-react-grab-annotation-resize-handle="top-left"]');
    await drag(page, topLeft, { x: -30, y: topLeft.y });
    const box = await getRectangleBox(page);
    expect(box.x).toBeCloseTo(RECTANGLE_START_PX.x - (topLeft.x + 30), 0);
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
    await toolbarAction(page, "copy").click();
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
  const captureRegion = { x: CAPTURE_START.x, y: CAPTURE_START.y };
  const captureSize = {
    width: CAPTURE_END.x - CAPTURE_START.x,
    height: CAPTURE_END.y - CAPTURE_START.y,
  };

  // What shows on screen and what the screenshot draws, both read as the
  // annotation colour's pixels inside the captured area.
  const expectScreenshotMatchesScreen = async (page: Page) => {
    await toolbarAction(page, "copy").click();
    await expect(page.locator(RESIZE_HANDLE_SELECTOR)).toHaveCount(0);
    const screenImage = await page.screenshot({ clip: { ...captureRegion, ...captureSize } });
    const onScreen = await findInkBounds(page, screenImage.toString("base64"), captureSize.width);
    expect(onScreen).not.toBeNull();

    await page.keyboard.down("Shift");
    await page.mouse.move(CAPTURE_START.x, CAPTURE_START.y);
    await page.mouse.down();
    await page.mouse.move(CAPTURE_END.x, CAPTURE_END.y, { steps: RECTANGLE_DRAG_STEPS });
    await page.mouse.up();
    await page.keyboard.up("Shift");
    await expect.poll(() => getImageWrites(page)).toHaveLength(1);
    const drawn = await findInkBounds(page, null, captureSize.width);
    expect(drawn).not.toBeNull();
    expectBoundsClose(drawn!, onScreen!, SCREENSHOT_PARITY_TOLERANCE_PX);
  };

  const selectOnly = async (page: Page, selector: string, point: Point) => {
    await page.keyboard.press("v");
    await page.mouse.click(point.x, point.y);
    await expect(page.locator(`${selector}${SELECTED_SELECTOR}`)).toHaveCount(1);
  };

  const rotateSelectionBy = async (page: Page, angleDeg: number) => {
    const frameRect = await getClientRect(page, FRAME_SELECTOR);
    const frameCenter = {
      x: (frameRect.left + frameRect.right) / 2,
      y: (frameRect.top + frameRect.bottom) / 2,
    };
    const topRight = await getCenter(
      page,
      '[data-react-grab-annotation-resize-handle="top-right"]',
    );
    await rotateBy(page, frameCenter, topRight, angleDeg, true);
  };

  test("a rotated pen stroke is drawn into the image where it shows", async ({
    reactGrab,
    page,
  }) => {
    await page.keyboard.press(`${reactGrab.modifierKey}+z`);
    await expect(page.locator(RECTANGLE_SELECTOR)).toHaveCount(0);
    const strokeStart = { x: 300, y: 300 };
    await toolbarAction(page, "annotate-pen").click();
    await page.mouse.move(strokeStart.x, strokeStart.y);
    await page.mouse.down();
    for (const [offsetX, offsetY] of [
      [40, -30],
      [90, 10],
      [140, -20],
      [200, 40],
    ]) {
      await page.mouse.move(strokeStart.x + offsetX, strokeStart.y + offsetY, { steps: 4 });
    }
    await page.mouse.up();
    const freehandSelector = '[data-react-grab-annotation-stroke="freehand"]';
    await expect(page.locator(freehandSelector)).toHaveCount(1);
    await selectOnly(page, freehandSelector, strokeStart);
    await rotateSelectionBy(page, 30);
    await expect(page.locator(freehandSelector)).toHaveAttribute(
      "transform",
      /rotate\((30|29\.99)/,
    );
    await expectScreenshotMatchesScreen(page);
  });

  test("a rotated and scaled note of two lines is drawn into the image where it shows", async ({
    reactGrab,
    page,
  }) => {
    await page.keyboard.press(`${reactGrab.modifierKey}+z`);
    await expect(page.locator(RECTANGLE_SELECTOR)).toHaveCount(0);
    await toolbarAction(page, "annotate-text").click();
    await page.mouse.click(320, 330);
    await expect(page.locator("[data-react-grab-annotation-input]")).toBeFocused();
    await page.keyboard.type(NOTE_LINES[0]);
    await page.keyboard.press("Shift+Enter");
    await page.keyboard.type(NOTE_LINES[1]);
    await page.keyboard.press("Enter");
    await expect(page.locator(TEXT_SELECTOR)).toHaveText(NOTE_LINES.join("\n"));
    const noteCenter = await getCenter(page, TEXT_SELECTOR);
    await selectOnly(page, TEXT_SELECTOR, noteCenter);
    const noteRect = await getClientRect(page, TEXT_SELECTOR);
    await dragHandle(page, "bottom-right", { x: (noteRect.right - noteRect.left) / 2, y: 0 });
    await rotateSelectionBy(page, 30);
    await expect(page.locator(TEXT_SELECTOR)).toHaveCSS("transform", /matrix/);
    await expectScreenshotMatchesScreen(page);
  });
});
