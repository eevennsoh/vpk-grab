// Drawings and notes placed with the toolbar's Pen, Rectangle and Text tools, and the
// Move tool that selects, drags and deletes them.
import type { Locator, Page } from "@playwright/test";
import { test, expect, type ReactGrabPageObject } from "./fixtures.js";
import {
  inspect,
  installSpecsFixture,
  pinAndReach,
  specRow,
  switchOnSpecs,
} from "./specs-panel-fixture.js";
import {
  NON_NATIVE_ACTIVATION_KEY,
  RECTANGLE_START_PX,
  RECTANGLE_END_PX,
  RECTANGLE_INTERIOR_PX,
  RECTANGLE_TINY_DELTA_PX,
  RECTANGLE_DRAG_STEPS,
  RECTANGLE_SCROLL_PX,
  RECTANGLE_SCROLL_PAGE_HEIGHT_PX,
  RECTANGLE_EDGE_HIT_OFFSET_PX,
} from "./constants.js";
import { CROP_7_5_ICON_PATHS, PHOTO_CAMERA_ICON_PATHS } from "../src/material-icon-paths.js";

const STROKE_SELECTOR = "[data-react-grab-annotation-stroke]";
const TEXT_SELECTOR = "[data-react-grab-annotation-text]";
const SELECTED_SELECTOR = "[data-react-grab-annotation-selected]";
const TOOLBAR_SELECTOR = "[data-react-grab-toolbar]";
const TOOLBAR_SETTLE_POLL_INTERVAL_MS = 150;
const ANNOTATION_ACTIONS_SELECTOR = "[data-react-grab-toolbar-annotation-actions]";
const ANNOTATION_COLORS_SELECTOR = "[data-react-grab-toolbar-annotation-colors]";
const INSPECT_SETTINGS_STORAGE_KEY = "react-grab-inspect-settings";
const DEFAULT_ANNOTATION_COLOR = "#f24822";
const ORANGE_ANNOTATION_COLOR = "#fb923c";
const DEFAULT_ANNOTATION_COLOR_RGB = "rgb(242, 72, 34)";
const ORANGE_ANNOTATION_COLOR_RGB = "rgb(251, 146, 60)";
// The separator and the two buttons, less whatever a transition still holds.
const ANNOTATION_ACTIONS_MIN_WIDTH_PX = 30;
const LINE_START = { x: 300, y: 320 };
const LINE_END = { x: 520, y: 320 };
const SECOND_LINE_OFFSET_Y = 60;
const NOTE_POSITION = { x: 300, y: 420 };
const EMPTY_POSITION = { x: 700, y: 520 };
const DRAG_DELTA = { x: 60, y: 40 };
const MARQUEE_START = { x: 260, y: 280 };
const MARQUEE_END = { x: 620, y: 460 };
const MARQUEE_SELECTOR = "[data-react-grab-annotation-marquee]";
const INSPECT_TOOLS_SELECTOR = "[data-react-grab-toolbar-inspect-tools]";
const TOOLTIP_SELECTOR = "[data-react-grab-tooltip]";
const TOOLTIP_SHORTCUT_SELECTOR = "[data-react-grab-tooltip-shortcut]";
// From the bottom centre to the right edge's middle, ending inside the viewport.
const TOOLBAR_SIDE_EDGE_DRAG_PX = { x: 640, y: -300 };
// Longer than the toolbar's reveal animation, so its position has settled.
const TOOLBAR_SETTLE_MS = 400;

const toolbarAction = (page: Page, actionId: string) =>
  page.locator(`[data-react-grab-toolbar-action="${actionId}"]`);

const drawStraightLine = async (page: Page) => {
  await toolbarAction(page, "annotate-pen").click();
  await page.keyboard.down("Shift");
  await page.mouse.move(LINE_START.x, LINE_START.y);
  await page.mouse.down();
  await page.mouse.move(LINE_END.x, LINE_END.y, { steps: 6 });
  await page.mouse.up();
  await page.keyboard.up("Shift");
  await expect(page.locator(STROKE_SELECTOR)).toHaveCount(1);
};

const addNote = async (page: Page, text: string) => {
  await toolbarAction(page, "annotate-text").click();
  await page.mouse.click(NOTE_POSITION.x, NOTE_POSITION.y);
  await expect(page.locator("[data-react-grab-annotation-input]")).toBeFocused();
  await page.keyboard.type(text);
  await page.keyboard.press("Enter");
  await expect(page.locator(TEXT_SELECTOR)).toHaveText(text);
};

const getBox = async (page: Page, selector: string) => {
  const box = await page.locator(selector).boundingBox();
  if (!box) throw new Error(`No box for ${selector}`);
  return box;
};

test.describe("Annotations", () => {
  test.beforeEach(async ({ reactGrab, page }) => {
    await expect.poll(() => reactGrab.isToolbarVisible(), { timeout: 3000 }).toBe(true);
    await reactGrab.activate();
    await drawStraightLine(page);
    await addNote(page, "Tighten this gap");
  });

  test("each tool shows its own cursor on the page", async ({ page }) => {
    const readPageCursor = () =>
      page.evaluate(() => document.querySelector("[data-react-grab-cursor]")?.textContent ?? "");

    await toolbarAction(page, "annotate-pen").click();
    await expect.poll(readPageCursor).toContain("data:image/svg+xml");
    expect(await readPageCursor()).toContain("4 20, crosshair");

    await toolbarAction(page, "annotate-rectangle").click();
    await expect.poll(readPageCursor).toMatch(/cursor: crosshair !important/);
    expect(await readPageCursor()).not.toContain("data:image/svg+xml");

    await toolbarAction(page, "annotate-text").click();
    await expect.poll(readPageCursor).toContain("12 12, text");

    await toolbarAction(page, "annotate-edit").click();
    await expect.poll(readPageCursor).toContain("12 12, grab");

    await toolbarAction(page, "annotate-edit").click();
    await expect.poll(readPageCursor).toContain("12 12, text");

    await toolbarAction(page, "copy").click();
    await expect.poll(readPageCursor).toContain("7 7, pointer");
  });

  test("Move keeps its hand over drawings and grips while pressed", async ({ page }) => {
    const readPageCursor = () =>
      page.evaluate(() => document.querySelector("[data-react-grab-cursor]")?.textContent ?? "");
    const stroke = page.locator(STROKE_SELECTOR).first();
    const readStrokeCursor = () => stroke.evaluate((element) => getComputedStyle(element).cursor);

    await toolbarAction(page, "annotate-edit").click();
    await expect.poll(readPageCursor).toContain("12 12, grab");
    await expect.poll(readStrokeCursor).toContain("data:image/svg+xml");
    expect(await readStrokeCursor()).toContain("grab");
    expect(await readStrokeCursor()).not.toContain("grabbing");

    const strokeMiddle = { x: (LINE_START.x + LINE_END.x) / 2, y: LINE_START.y };
    await page.mouse.move(strokeMiddle.x, strokeMiddle.y);
    await page.mouse.down();
    await expect.poll(readPageCursor).toContain("12 12, grabbing");
    await expect.poll(readStrokeCursor).toContain("grabbing");
    await page.mouse.move(strokeMiddle.x + DRAG_DELTA.x, strokeMiddle.y + DRAG_DELTA.y, {
      steps: 4,
    });
    await expect.poll(readPageCursor).toContain("12 12, grabbing");
    await page.mouse.up();
    await expect.poll(readPageCursor).not.toContain("grabbing");
    expect(await readPageCursor()).toContain("12 12, grab");

    await page.mouse.move(EMPTY_POSITION.x, EMPTY_POSITION.y);
    await page.mouse.down();
    await expect.poll(readPageCursor).toContain("12 12, grabbing");
    await page.mouse.up();
    await expect.poll(readPageCursor).not.toContain("grabbing");
  });

  test("Move and Clear leave the toolbar with the last annotation", async ({ page }) => {
    await expect(page.locator(ANNOTATION_ACTIONS_SELECTOR)).toHaveAttribute("data-revealed", "");
    await expect(page.locator(ANNOTATION_ACTIONS_SELECTOR)).not.toHaveAttribute("inert");
    const widthWithActions = (await getBox(page, TOOLBAR_SELECTOR)).width;

    await toolbarAction(page, "annotate-clear").click();
    await expect(page.locator(STROKE_SELECTOR)).toHaveCount(0);
    await expect(page.locator(ANNOTATION_ACTIONS_SELECTOR)).not.toHaveAttribute("data-revealed");
    await expect(page.locator(ANNOTATION_ACTIONS_SELECTOR)).toHaveAttribute("inert");
    await expect
      .poll(async () => (await getBox(page, TOOLBAR_SELECTOR)).width)
      .toBeLessThan(widthWithActions - ANNOTATION_ACTIONS_MIN_WIDTH_PX);
  });

  test("Move and Clear join the toolbar with the first annotation", async ({ page }) => {
    const widthWithActions = (await getBox(page, TOOLBAR_SELECTOR)).width;
    await toolbarAction(page, "annotate-clear").click();
    await expect(page.locator(ANNOTATION_ACTIONS_SELECTOR)).not.toHaveAttribute("data-revealed");
    await expect
      .poll(async () => (await getBox(page, TOOLBAR_SELECTOR)).width)
      .toBeLessThan(widthWithActions - ANNOTATION_ACTIONS_MIN_WIDTH_PX);
    const widthWithoutActions = (await getBox(page, TOOLBAR_SELECTOR)).width;

    await drawStraightLine(page);
    await expect(page.locator(ANNOTATION_ACTIONS_SELECTOR)).toHaveAttribute("data-revealed", "");
    await expect(toolbarAction(page, "annotate-edit")).toHaveCSS("opacity", "1");
    await expect
      .poll(async () => (await getBox(page, TOOLBAR_SELECTOR)).width)
      .toBeGreaterThan(widthWithoutActions + ANNOTATION_ACTIONS_MIN_WIDTH_PX);
  });

  test("deleting the last annotation puts the move tool down", async ({ page }) => {
    await toolbarAction(page, "annotate-edit").click();
    await expect(toolbarAction(page, "annotate-edit")).toHaveAttribute("aria-pressed", "true");

    await toolbarAction(page, "annotate-clear").click();
    await expect(toolbarAction(page, "annotate-edit")).toHaveAttribute("aria-pressed", "false");
    await expect(toolbarAction(page, "annotate-text")).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(ANNOTATION_ACTIONS_SELECTOR)).not.toHaveAttribute("data-revealed");
  });

  test("annotations let the pointer through except notes under Text and everything under Move", async ({
    page,
  }) => {
    await expect(page.locator(TEXT_SELECTOR)).toHaveCSS("pointer-events", "auto");
    await toolbarAction(page, "annotate-pen").click();
    await expect(page.locator(STROKE_SELECTOR)).toHaveCSS("pointer-events", "none");
    await expect(page.locator(TEXT_SELECTOR)).toHaveCSS("pointer-events", "none");
    await toolbarAction(page, "annotate-edit").click();
    await expect(page.locator(STROKE_SELECTOR)).toHaveCSS("pointer-events", "all");
    await expect(page.locator(TEXT_SELECTOR)).toHaveCSS("pointer-events", "auto");
  });

  test("a press near a thin line selects it and a press on empty page deselects", async ({
    page,
  }) => {
    await toolbarAction(page, "annotate-edit").click();
    await page.mouse.click(LINE_START.x + 100, LINE_START.y + 5);
    await expect(page.locator(`${STROKE_SELECTOR}${SELECTED_SELECTOR}`)).toHaveCount(1);
    await expect(page.locator("[data-react-grab-annotation-selection]")).toHaveCount(1);

    await page.mouse.click(EMPTY_POSITION.x, EMPTY_POSITION.y);
    await expect(page.locator(SELECTED_SELECTOR)).toHaveCount(0);
    await expect(page.locator("[data-react-grab-annotation-selection]")).toHaveCount(0);
  });

  test("dragging moves a drawing and leaves the others where they were", async ({ page }) => {
    await toolbarAction(page, "annotate-edit").click();
    const strokeBefore = await getBox(page, STROKE_SELECTOR);
    const noteBefore = await getBox(page, TEXT_SELECTOR);

    await page.mouse.move(LINE_START.x + 100, LINE_START.y);
    await page.mouse.down();
    await page.mouse.move(LINE_START.x + 100 + DRAG_DELTA.x, LINE_START.y + DRAG_DELTA.y, {
      steps: 5,
    });
    await page.mouse.up();

    const strokeAfter = await getBox(page, STROKE_SELECTOR);
    expect(strokeAfter.x - strokeBefore.x).toBeCloseTo(DRAG_DELTA.x, 0);
    expect(strokeAfter.y - strokeBefore.y).toBeCloseTo(DRAG_DELTA.y, 0);
    expect(strokeAfter.width).toBeCloseTo(strokeBefore.width, 0);
    expect(await getBox(page, TEXT_SELECTOR)).toEqual(noteBefore);
    await expect(page.locator(`${STROKE_SELECTOR}${SELECTED_SELECTOR}`)).toHaveCount(1);
  });

  test("dragging moves a note", async ({ page }) => {
    await toolbarAction(page, "annotate-edit").click();
    const noteBefore = await getBox(page, TEXT_SELECTOR);
    const grabPoint = { x: noteBefore.x + 10, y: noteBefore.y + noteBefore.height / 2 };

    await page.mouse.move(grabPoint.x, grabPoint.y);
    await page.mouse.down();
    await page.mouse.move(grabPoint.x + DRAG_DELTA.x, grabPoint.y + DRAG_DELTA.y, { steps: 5 });
    await page.mouse.up();

    const noteAfter = await getBox(page, TEXT_SELECTOR);
    expect(noteAfter.x - noteBefore.x).toBeCloseTo(DRAG_DELTA.x, 0);
    expect(noteAfter.y - noteBefore.y).toBeCloseTo(DRAG_DELTA.y, 0);
  });

  test("double-clicking a note with Move reopens it for editing", async ({ reactGrab, page }) => {
    await toolbarAction(page, "annotate-edit").click();
    const note = await getBox(page, TEXT_SELECTOR);
    await page.mouse.dblclick(note.x + 10, note.y + note.height / 2);

    const input = page.locator("[data-react-grab-annotation-input]");
    await expect(input).toBeFocused();
    await expect(input).toHaveValue("Tighten this gap");
    await page.keyboard.type("Widen this gap");
    await page.keyboard.press("Enter");

    await expect(page.locator(TEXT_SELECTOR)).toHaveCount(1);
    await expect(page.locator(TEXT_SELECTOR)).toHaveText("Widen this gap");
    await expect(page.locator(`${TEXT_SELECTOR}${SELECTED_SELECTOR}`)).toHaveCount(1);

    await page.keyboard.press(`${reactGrab.modifierKey}+z`);
    await expect(page.locator(TEXT_SELECTOR)).toHaveText("Tighten this gap");
  });

  test("number keys pick the color under Text until the new note has text", async ({ page }) => {
    await page.mouse.move(EMPTY_POSITION.x, EMPTY_POSITION.y);
    await page.keyboard.press("2");
    await expect(toolbarAction(page, "annotation-color-orange")).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await page.mouse.click(EMPTY_POSITION.x, EMPTY_POSITION.y);
    const input = page.locator("[data-react-grab-annotation-input]");
    await expect(input).toBeFocused();
    await page.keyboard.press("1");
    await expect(input).toHaveValue("");
    await expect(input).toHaveCSS("color", DEFAULT_ANNOTATION_COLOR_RGB);
    await page.keyboard.type("Step 2");
    await expect(input).toHaveValue("Step 2");
    await expect(toolbarAction(page, "annotation-color-red")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  test("Move outlines what the pointer is over until it is selected", async ({ page }) => {
    const hoverOutline = page.locator("[data-react-grab-annotation-hover-outline]");
    await page.mouse.move(LINE_START.x + 100, LINE_START.y);
    await expect(hoverOutline).toHaveCount(0);

    await toolbarAction(page, "annotate-edit").click();
    await page.mouse.move(EMPTY_POSITION.x, EMPTY_POSITION.y);
    await page.mouse.move(LINE_START.x + 100, LINE_START.y);
    await expect(hoverOutline).toHaveCount(1);
    await page.mouse.move(EMPTY_POSITION.x, EMPTY_POSITION.y);
    await expect(hoverOutline).toHaveCount(0);

    const note = await getBox(page, TEXT_SELECTOR);
    await page.mouse.move(note.x + 10, note.y + note.height / 2);
    await expect(hoverOutline).toHaveCount(1);
    await page.mouse.down();
    await page.mouse.up();
    await expect(hoverOutline).toHaveCount(0);
  });

  test("a note under Text shows an outline on hover", async ({ page }) => {
    const note = page.locator(TEXT_SELECTOR);
    await page.mouse.move(EMPTY_POSITION.x, EMPTY_POSITION.y);
    await expect(note).toHaveCSS("outline-style", "none");
    await note.hover();
    await expect(note).toHaveCSS("outline-style", "dashed");
    await expect(note).toHaveCSS("outline-color", DEFAULT_ANNOTATION_COLOR_RGB);
    await toolbarAction(page, "annotate-edit").click();
    await note.hover();
    await expect(note).toHaveCSS("outline-style", "none");
  });

  test("clicking a note with Text edits it, and Escape leaves it as it was", async ({ page }) => {
    const note = await getBox(page, TEXT_SELECTOR);
    await page.mouse.click(note.x + 10, note.y + note.height / 2);

    const input = page.locator("[data-react-grab-annotation-input]");
    await expect(input).toBeFocused();
    await expect(input).toHaveValue("Tighten this gap");
    await page.keyboard.type("Something else");
    await page.keyboard.press("Escape");

    await expect(input).toHaveCount(0);
    await expect(page.locator(TEXT_SELECTOR)).toHaveText("Tighten this gap");
  });

  test("emptying a reopened note removes it", async ({ page }) => {
    const note = await getBox(page, TEXT_SELECTOR);
    await page.mouse.click(note.x + 10, note.y + note.height / 2);
    await expect(page.locator("[data-react-grab-annotation-input]")).toBeFocused();
    await page.keyboard.press("Backspace");
    await page.keyboard.press("Enter");

    await expect(page.locator(TEXT_SELECTOR)).toHaveCount(0);
  });

  for (const deleteKey of ["Delete", "Backspace"]) {
    test(`${deleteKey} removes only the selected annotation`, async ({ reactGrab, page }) => {
      await toolbarAction(page, "annotate-edit").click();
      await page.mouse.click(LINE_START.x + 100, LINE_START.y);
      await page.keyboard.press(deleteKey);

      await expect(page.locator(STROKE_SELECTOR)).toHaveCount(0);
      await expect(page.locator(TEXT_SELECTOR)).toHaveCount(1);
      expect(await reactGrab.isOverlayVisible()).toBe(true);

      // With nothing selected the key is not a delete any more.
      await page.keyboard.press(deleteKey);
      await expect(page.locator(TEXT_SELECTOR)).toHaveCount(1);
    });
  }

  test("the clear button removes the selection first, then everything", async ({ page }) => {
    await toolbarAction(page, "annotate-edit").click();
    const note = await getBox(page, TEXT_SELECTOR);
    await page.mouse.click(note.x + 10, note.y + note.height / 2);
    await expect(toolbarAction(page, "annotate-clear")).toHaveAttribute(
      "aria-label",
      "Delete the selected annotation",
    );

    await toolbarAction(page, "annotate-clear").click();
    await expect(page.locator(TEXT_SELECTOR)).toHaveCount(0);
    await expect(page.locator(STROKE_SELECTOR)).toHaveCount(1);
    await expect(toolbarAction(page, "annotate-clear")).toHaveAttribute(
      "aria-label",
      "Clear drawings and text",
    );

    await toolbarAction(page, "annotate-clear").click();
    await expect(page.locator(STROKE_SELECTOR)).toHaveCount(0);
  });

  test("a marquee selects everything it touches and the group moves together", async ({ page }) => {
    await toolbarAction(page, "annotate-edit").click();
    const strokeBefore = await getBox(page, STROKE_SELECTOR);
    const noteBefore = await getBox(page, TEXT_SELECTOR);

    await page.mouse.move(MARQUEE_START.x, MARQUEE_START.y);
    await page.mouse.down();
    await page.mouse.move(MARQUEE_END.x, MARQUEE_END.y, { steps: 6 });
    await expect(page.locator(MARQUEE_SELECTOR)).toHaveCount(1);
    await page.mouse.up();
    await expect(page.locator(MARQUEE_SELECTOR)).toHaveCount(0);
    await expect(page.locator(SELECTED_SELECTOR)).toHaveCount(2);

    await page.mouse.move(LINE_START.x + 100, LINE_START.y);
    await page.mouse.down();
    await page.mouse.move(LINE_START.x + 100 + DRAG_DELTA.x, LINE_START.y + DRAG_DELTA.y, {
      steps: 5,
    });
    await page.mouse.up();

    const strokeAfter = await getBox(page, STROKE_SELECTOR);
    const noteAfter = await getBox(page, TEXT_SELECTOR);
    expect(strokeAfter.x - strokeBefore.x).toBeCloseTo(DRAG_DELTA.x, 0);
    expect(strokeAfter.y - strokeBefore.y).toBeCloseTo(DRAG_DELTA.y, 0);
    expect(noteAfter.x - noteBefore.x).toBeCloseTo(DRAG_DELTA.x, 0);
    expect(noteAfter.y - noteBefore.y).toBeCloseTo(DRAG_DELTA.y, 0);

    await page.keyboard.press("Delete");
    await expect(page.locator(STROKE_SELECTOR)).toHaveCount(0);
    await expect(page.locator(TEXT_SELECTOR)).toHaveCount(0);
  });

  test("a marquee only picks up what it touches", async ({ page }) => {
    await toolbarAction(page, "annotate-edit").click();
    await page.mouse.move(LINE_START.x - 20, LINE_START.y - 20);
    await page.mouse.down();
    await page.mouse.move(LINE_START.x + 40, LINE_START.y + 20, { steps: 4 });
    await page.mouse.up();
    await expect(page.locator(SELECTED_SELECTOR)).toHaveCount(1);
    await expect(page.locator(`${STROKE_SELECTOR}${SELECTED_SELECTOR}`)).toHaveCount(1);
  });

  test("Shift-click adds to and removes from the selection", async ({ page }) => {
    await toolbarAction(page, "annotate-edit").click();
    const note = await getBox(page, TEXT_SELECTOR);
    await page.mouse.click(LINE_START.x + 100, LINE_START.y);
    await page.keyboard.down("Shift");
    await page.mouse.click(note.x + 10, note.y + note.height / 2);
    await expect(page.locator(SELECTED_SELECTOR)).toHaveCount(2);
    await page.mouse.click(LINE_START.x + 100, LINE_START.y);
    await page.keyboard.up("Shift");
    await expect(page.locator(SELECTED_SELECTOR)).toHaveCount(1);
    await expect(page.locator(`${TEXT_SELECTOR}${SELECTED_SELECTOR}`)).toHaveCount(1);
  });

  test("leaving the move tool drops the selection", async ({ page }) => {
    await toolbarAction(page, "annotate-edit").click();
    await page.mouse.click(LINE_START.x + 100, LINE_START.y);
    await expect(page.locator(SELECTED_SELECTOR)).toHaveCount(1);

    await toolbarAction(page, "annotate-pen").click();
    await expect(page.locator(SELECTED_SELECTOR)).toHaveCount(0);
    await page.keyboard.press("Delete");
    await expect(page.locator(STROKE_SELECTOR)).toHaveCount(1);
  });

  test("switching between drawing tools leaves the toolbar where it is", async ({ page }) => {
    await toolbarAction(page, "annotate-pen").click();
    await expect(page.locator(ANNOTATION_COLORS_SELECTOR)).toHaveAttribute("data-revealed", "");
    await page.waitForTimeout(TOOLBAR_SETTLE_MS);
    const settledBox = await getBox(page, TOOLBAR_SELECTOR);

    await toolbarAction(page, "annotate-rectangle").click();
    await expect(toolbarAction(page, "annotate-rectangle")).toHaveAttribute("aria-pressed", "true");
    await toolbarAction(page, "annotate-text").click();
    await page.waitForTimeout(TOOLBAR_SETTLE_MS);
    await toolbarAction(page, "annotate-pen").click();
    await page.waitForTimeout(TOOLBAR_SETTLE_MS);

    const finalBox = await getBox(page, TOOLBAR_SELECTOR);
    expect(Math.abs(finalBox.x - settledBox.x)).toBeLessThan(1);
    expect(Math.abs(finalBox.width - settledBox.width)).toBeLessThan(1);
  });

  test("the toolbar stays at full strength while a drawing tool is in hand", async ({ page }) => {
    const readToolbarOpacity = () =>
      page
        .locator(TOOLBAR_SELECTOR)
        .evaluate((element) => Number(getComputedStyle(element).opacity));

    await toolbarAction(page, "annotate-pen").click();
    await page.mouse.move(EMPTY_POSITION.x, EMPTY_POSITION.y);
    await expect.poll(readToolbarOpacity).toBe(1);

    await toolbarAction(page, "annotate-rectangle").click();
    await page.mouse.move(EMPTY_POSITION.x, EMPTY_POSITION.y);
    await expect.poll(readToolbarOpacity).toBe(1);

    await toolbarAction(page, "annotate-text").click();
    await page.mouse.move(EMPTY_POSITION.x, EMPTY_POSITION.y);
    await expect.poll(readToolbarOpacity).toBe(1);

    await toolbarAction(page, "annotate-text").click();
    await page.mouse.move(EMPTY_POSITION.x, EMPTY_POSITION.y);
    await expect.poll(readToolbarOpacity).toBeLessThan(1);
  });

  test("colors join the toolbar only while a drawing tool is in hand", async ({ page }) => {
    const colors = page.locator(ANNOTATION_COLORS_SELECTOR);
    await expect(colors).toHaveAttribute("data-revealed", "");

    await toolbarAction(page, "annotate-text").click();
    await expect(colors).not.toHaveAttribute("data-revealed");
    await expect(colors).toHaveAttribute("inert");

    await toolbarAction(page, "annotate-rectangle").click();
    await expect(colors).toHaveAttribute("data-revealed", "");
    await toolbarAction(page, "annotate-pen").click();
    await expect(colors).toHaveAttribute("data-revealed", "");
    await expect(toolbarAction(page, "annotation-color-red")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  test("a new note takes the picked color and earlier notes keep theirs", async ({ page }) => {
    await toolbarAction(page, "annotation-color-orange").click();
    await expect(toolbarAction(page, "annotation-color-orange")).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await page.mouse.click(NOTE_POSITION.x, NOTE_POSITION.y + SECOND_LINE_OFFSET_Y);
    const input = page.locator("[data-react-grab-annotation-input]");
    await expect(input).toBeFocused();
    await expect(input).toHaveCSS("color", ORANGE_ANNOTATION_COLOR_RGB);
    await page.keyboard.type("Orange note");
    await page.keyboard.press("Enter");

    const notes = page.locator(TEXT_SELECTOR);
    await expect(notes).toHaveCount(2);
    await expect(notes.nth(0)).toHaveCSS("color", DEFAULT_ANNOTATION_COLOR_RGB);
    await expect(notes.nth(1)).toHaveCSS("color", ORANGE_ANNOTATION_COLOR_RGB);
  });

  test("a new stroke takes the picked color and earlier strokes keep theirs", async ({ page }) => {
    await toolbarAction(page, "annotate-pen").click();
    await toolbarAction(page, "annotation-color-orange").click();
    await expect(toolbarAction(page, "annotation-color-orange")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(toolbarAction(page, "annotation-color-red")).toHaveAttribute(
      "aria-pressed",
      "false",
    );

    const secondLineY = LINE_START.y + SECOND_LINE_OFFSET_Y;
    await page.keyboard.down("Shift");
    await page.mouse.move(LINE_START.x, secondLineY);
    await page.mouse.down();
    await page.mouse.move(LINE_END.x, secondLineY, { steps: 6 });
    await page.mouse.up();
    await page.keyboard.up("Shift");

    const strokes = page.locator(STROKE_SELECTOR);
    await expect(strokes).toHaveCount(2);
    await expect(strokes.nth(0)).toHaveAttribute("fill", DEFAULT_ANNOTATION_COLOR);
    await expect(strokes.nth(1)).toHaveAttribute("fill", ORANGE_ANNOTATION_COLOR);
    await expect
      .poll(() =>
        page.evaluate(
          (storageKey) => localStorage.getItem(storageKey),
          INSPECT_SETTINGS_STORAGE_KEY,
        ),
      )
      .toContain(ORANGE_ANNOTATION_COLOR);
  });

  test("undo takes back the note, then the line, and redo brings them back", async ({
    reactGrab,
    page,
  }) => {
    await page.mouse.move(EMPTY_POSITION.x, EMPTY_POSITION.y);

    await page.keyboard.press(`${reactGrab.modifierKey}+z`);
    await expect(page.locator(TEXT_SELECTOR)).toHaveCount(0);
    await expect(page.locator(STROKE_SELECTOR)).toHaveCount(1);

    await page.keyboard.press(`${reactGrab.modifierKey}+z`);
    await expect(page.locator(STROKE_SELECTOR)).toHaveCount(0);

    await page.keyboard.press(`${reactGrab.modifierKey}+Shift+z`);
    await expect(page.locator(STROKE_SELECTOR)).toHaveCount(1);
    await page.keyboard.press(`${reactGrab.modifierKey}+Shift+z`);
    await expect(page.locator(TEXT_SELECTOR)).toHaveText("Tighten this gap");
  });

  test("the modifier with Backspace clears every drawing and note, and undo brings them back", async ({
    reactGrab,
    page,
  }) => {
    await page.mouse.move(EMPTY_POSITION.x, EMPTY_POSITION.y);

    await page.keyboard.press(`${reactGrab.modifierKey}+Backspace`);
    await expect(page.locator(STROKE_SELECTOR)).toHaveCount(0);
    await expect(page.locator(TEXT_SELECTOR)).toHaveCount(0);
    await expect(page.locator(ANNOTATION_ACTIONS_SELECTOR)).not.toHaveAttribute("data-revealed");
    expect(await reactGrab.isOverlayVisible()).toBe(true);

    await page.keyboard.press(`${reactGrab.modifierKey}+z`);
    await expect(page.locator(STROKE_SELECTOR)).toHaveCount(1);
    await expect(page.locator(TEXT_SELECTOR)).toHaveText("Tighten this gap");

    await page.keyboard.press(`${reactGrab.modifierKey}+Delete`);
    await expect(page.locator(STROKE_SELECTOR)).toHaveCount(0);
    await expect(page.locator(TEXT_SELECTOR)).toHaveCount(0);
  });

  test("the clear shortcut still works after Grab is switched off, but not in a page field", async ({
    reactGrab,
    page,
  }) => {
    await reactGrab.deactivate();
    await expect(page.locator(STROKE_SELECTOR)).toHaveCount(1);

    await page.locator("[data-testid='test-input']").fill("keep these words");
    await page.locator("[data-testid='test-input']").press(`${reactGrab.modifierKey}+Backspace`);
    await expect(page.locator(STROKE_SELECTOR)).toHaveCount(1);
    await expect(page.locator(TEXT_SELECTOR)).toHaveText("Tighten this gap");

    await page.locator("[data-testid='test-input']").blur();
    await page.keyboard.press(`${reactGrab.modifierKey}+Backspace`);
    await expect(page.locator(STROKE_SELECTOR)).toHaveCount(0);
    await expect(page.locator(TEXT_SELECTOR)).toHaveCount(0);
    expect(await reactGrab.isOverlayVisible()).toBe(false);
  });

  test("the clear shortcut removes only the selected annotation while one is selected", async ({
    reactGrab,
    page,
  }) => {
    await toolbarAction(page, "annotate-edit").click();
    await page.mouse.click(LINE_START.x + 100, LINE_START.y + 5);
    await expect(page.locator(`${STROKE_SELECTOR}${SELECTED_SELECTOR}`)).toHaveCount(1);

    await page.keyboard.press(`${reactGrab.modifierKey}+Backspace`);
    await expect(page.locator(STROKE_SELECTOR)).toHaveCount(0);
    await expect(page.locator(TEXT_SELECTOR)).toHaveText("Tighten this gap");
  });

  test("the Clear tooltip shows its shortcut", async ({ reactGrab, page }) => {
    await toolbarAction(page, "annotate-clear").hover();
    await expect(page.locator(TOOLTIP_SHORTCUT_SELECTOR)).toHaveAttribute(
      "data-react-grab-tooltip-shortcut",
      reactGrab.modifierKey === "Meta" ? "⌘⌫" : "Ctrl+Backspace",
    );
  });

  test("undo puts a moved drawing back and a new change clears redo", async ({
    reactGrab,
    page,
  }) => {
    await toolbarAction(page, "annotate-edit").click();
    const strokeBefore = await getBox(page, STROKE_SELECTOR);

    await page.mouse.move(LINE_START.x + 100, LINE_START.y);
    await page.mouse.down();
    await page.mouse.move(LINE_START.x + 100 + DRAG_DELTA.x, LINE_START.y + DRAG_DELTA.y, {
      steps: 5,
    });
    await page.mouse.up();
    expect((await getBox(page, STROKE_SELECTOR)).x).not.toBeCloseTo(strokeBefore.x, 0);

    await page.keyboard.press(`${reactGrab.modifierKey}+z`);
    expect(await getBox(page, STROKE_SELECTOR)).toEqual(strokeBefore);

    await page.mouse.click(LINE_START.x + 100, LINE_START.y);
    await page.keyboard.press("Delete");
    await expect(page.locator(STROKE_SELECTOR)).toHaveCount(0);
    await page.keyboard.press(`${reactGrab.modifierKey}+Shift+z`);
    await expect(page.locator(STROKE_SELECTOR)).toHaveCount(0);
    await page.keyboard.press(`${reactGrab.modifierKey}+z`);
    await expect(page.locator(STROKE_SELECTOR)).toHaveCount(1);
  });

  test("V picks the move tool up and puts it down while something is drawn", async ({ page }) => {
    const moveTool = toolbarAction(page, "annotate-edit");
    await page.mouse.move(EMPTY_POSITION.x, EMPTY_POSITION.y);
    await expect(moveTool).toHaveAttribute("aria-pressed", "false");

    await page.keyboard.press("v");
    await expect(moveTool).toHaveAttribute("aria-pressed", "true");

    await page.keyboard.press("v");
    await expect(moveTool).toHaveAttribute("aria-pressed", "false");
  });

  test("putting Move down hands back the drawing tool it was picked up from", async ({ page }) => {
    const moveTool = toolbarAction(page, "annotate-edit");
    await page.mouse.move(EMPTY_POSITION.x, EMPTY_POSITION.y);
    await toolbarAction(page, "annotate-rectangle").click();

    await page.keyboard.press("v");
    await expect(moveTool).toHaveAttribute("aria-pressed", "true");
    await page.keyboard.press("v");
    await expect(toolbarAction(page, "annotate-rectangle")).toHaveAttribute("aria-pressed", "true");

    await moveTool.click();
    await moveTool.click();
    await expect(toolbarAction(page, "annotate-rectangle")).toHaveAttribute("aria-pressed", "true");

    await toolbarAction(page, "copy").click();
    await page.keyboard.press("v");
    await page.keyboard.press("v");
    await expect(toolbarAction(page, "copy")).toHaveAttribute("aria-pressed", "true");
  });
});

test.describe("Tool cycling with the platform modifier and an arrow", () => {
  test.beforeEach(async ({ reactGrab }) => {
    await reactGrab.activate();
  });

  test("steps around the ring in either direction without releasing the modifier", async ({
    reactGrab,
    page,
  }) => {
    await page.keyboard.down(reactGrab.modifierKey);
    for (const action of ["annotate-pen", "annotate-rectangle", "annotate-text", "copy"]) {
      await page.keyboard.press("ArrowRight");
      await expect(toolbarAction(page, action)).toHaveAttribute("aria-pressed", "true");
    }
    for (const action of ["annotate-text", "annotate-rectangle", "annotate-pen", "copy"]) {
      await page.keyboard.press("ArrowLeft");
      await expect(toolbarAction(page, action)).toHaveAttribute("aria-pressed", "true");
    }
    await page.keyboard.up(reactGrab.modifierKey);
  });

  test("Down and Up step like Right and Left, mixed with the modifier held", async ({
    reactGrab,
    page,
  }) => {
    await page.keyboard.down(reactGrab.modifierKey);
    for (const [arrow, action] of [
      ["ArrowDown", "annotate-pen"],
      ["ArrowRight", "annotate-rectangle"],
      ["ArrowDown", "annotate-text"],
      ["ArrowDown", "copy"],
      ["ArrowUp", "annotate-text"],
      ["ArrowLeft", "annotate-rectangle"],
      ["ArrowUp", "annotate-pen"],
      ["ArrowUp", "copy"],
    ]) {
      await page.keyboard.press(arrow);
      await expect(toolbarAction(page, action)).toHaveAttribute("aria-pressed", "true");
    }
    await page.keyboard.up(reactGrab.modifierKey);
  });

  test("from Move, Right and Down land on Grab and Left and Up on Text", async ({
    reactGrab,
    page,
  }) => {
    await drawStraightLine(page);
    for (const [arrow, action] of [
      ["ArrowRight", "copy"],
      ["ArrowLeft", "annotate-text"],
      ["ArrowDown", "copy"],
      ["ArrowUp", "annotate-text"],
    ]) {
      await toolbarAction(page, "annotate-edit").click();
      await page.mouse.click(LINE_START.x, LINE_START.y);
      await expect(page.locator(SELECTED_SELECTOR)).toHaveCount(1);
      await reactGrab.pressKeyCombo([reactGrab.modifierKey], arrow);
      await expect(toolbarAction(page, action)).toHaveAttribute("aria-pressed", "true");
    }
  });

  test("bare and Shift-modified taps and extra modifiers leave Grab in hand", async ({
    reactGrab,
    page,
  }) => {
    const grab = toolbarAction(page, "copy");
    await page.keyboard.press(reactGrab.modifierKey);
    await expect(grab).toHaveAttribute("aria-pressed", "true");
    await page.keyboard.press(`Shift+${reactGrab.modifierKey}`);
    await expect(grab).toHaveAttribute("aria-pressed", "true");
    for (const extraModifier of [
      "Shift",
      "Alt",
      reactGrab.modifierKey === "Meta" ? "Control" : "Meta",
    ]) {
      await reactGrab.pressKeyCombo([reactGrab.modifierKey, extraModifier], "ArrowRight");
      await expect(grab).toHaveAttribute("aria-pressed", "true");
    }
  });

  test("a repeated keydown steps only once", async ({ reactGrab, page }) => {
    await page.keyboard.down(reactGrab.modifierKey);
    await page.keyboard.down("ArrowRight");
    await expect(toolbarAction(page, "annotate-pen")).toHaveAttribute("aria-pressed", "true");
    await page.keyboard.down("ArrowRight");
    await expect(toolbarAction(page, "annotate-pen")).toHaveAttribute("aria-pressed", "true");
    await page.keyboard.up("ArrowRight");
    await page.keyboard.up(reactGrab.modifierKey);
  });

  test("the chord preserves the element selected by plain Left and Right", async ({
    reactGrab,
    page,
  }) => {
    await reactGrab.hoverUntilSelected("[data-testid='todo-list'] li:first-child span");
    await page.keyboard.press("ArrowUp");
    const selected = page.getByRole("menuitemradio", { checked: true });
    const first = await selected.getAttribute("data-react-grab-menu-item");
    if (!first) throw new Error("Missing selected hierarchy row");
    await page.keyboard.press("ArrowRight");
    await expect(selected).not.toHaveAttribute("data-react-grab-menu-item", first);
    await page.keyboard.press("ArrowLeft");
    await expect(selected).toHaveAttribute("data-react-grab-menu-item", first);
    await page.keyboard.down(reactGrab.modifierKey);
    await page.keyboard.press("ArrowRight");
    await expect(toolbarAction(page, "annotate-pen")).toHaveAttribute("aria-pressed", "true");
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.up(reactGrab.modifierKey);
    await expect(selected).toHaveAttribute("data-react-grab-menu-item", first);
  });

  test("plain Up and Down still navigate, and the chord on them leaves the selection", async ({
    reactGrab,
    page,
  }) => {
    await reactGrab.hoverUntilSelected("[data-testid='todo-list'] li:first-child span");
    await page.keyboard.press("ArrowUp");
    const selected = page.getByRole("menuitemradio", { checked: true });
    const first = await selected.textContent();
    if (!first) throw new Error("Missing selected hierarchy row");
    await page.keyboard.press("ArrowUp");
    await expect(selected).not.toHaveText(first);
    await page.keyboard.press("ArrowDown");
    await expect(selected).toHaveText(first);
    await page.keyboard.down(reactGrab.modifierKey);
    await page.keyboard.press("ArrowDown");
    await expect(toolbarAction(page, "annotate-pen")).toHaveAttribute("aria-pressed", "true");
    await page.keyboard.press("ArrowUp");
    await page.keyboard.up(reactGrab.modifierKey);
    await expect(toolbarAction(page, "copy")).toHaveAttribute("aria-pressed", "true");
    await expect(selected).toHaveText(first);
  });

  test("a kept-on session steps on the first arrow with the activation shortcut still down", async ({
    reactGrab,
    page,
  }) => {
    await reactGrab.deactivate();
    await reactGrab.updateOptions({
      activationMode: "toggle",
      activationKey: `${reactGrab.modifierKey}+${NON_NATIVE_ACTIVATION_KEY}`,
    });
    await page.keyboard.down(reactGrab.modifierKey);
    await page.keyboard.down(NON_NATIVE_ACTIVATION_KEY);
    await expect.poll(() => reactGrab.isOverlayVisible()).toBe(true);
    await page.keyboard.press("ArrowRight");
    await expect(toolbarAction(page, "annotate-pen")).toHaveAttribute("aria-pressed", "true");
    await page.keyboard.up(reactGrab.modifierKey);
    await page.keyboard.up(NON_NATIVE_ACTIVATION_KEY);
  });

  test("a hold session keeps sibling and parent navigation with the modifier down", async ({
    reactGrab,
    page,
  }) => {
    await reactGrab.deactivate();
    await reactGrab.updateOptions({
      activationMode: "hold",
      activationKey: NON_NATIVE_ACTIVATION_KEY,
    });
    await page.keyboard.down(NON_NATIVE_ACTIVATION_KEY);
    await expect.poll(() => reactGrab.isOverlayVisible()).toBe(true);
    await reactGrab.hoverUntilSelected("[data-testid='todo-list'] li:first-child span");
    await page.keyboard.press("ArrowUp");
    const selected = page.getByRole("menuitemradio", { checked: true });
    const first = await selected.getAttribute("data-react-grab-menu-item");
    if (!first) throw new Error("Missing selected hierarchy row");
    await page.keyboard.down(reactGrab.modifierKey);
    await page.keyboard.press("ArrowRight");
    await expect(selected).not.toHaveAttribute("data-react-grab-menu-item", first);
    await page.keyboard.press("ArrowLeft");
    await expect(selected).toHaveAttribute("data-react-grab-menu-item", first);
    const parentStart = await selected.textContent();
    if (!parentStart) throw new Error("Missing selected hierarchy row");
    await page.keyboard.press("ArrowUp");
    await expect(selected).not.toHaveText(parentStart);
    await page.keyboard.press("ArrowDown");
    await expect(selected).toHaveText(parentStart);
    await expect(toolbarAction(page, "copy")).toHaveAttribute("aria-pressed", "true");
    await page.keyboard.up(reactGrab.modifierKey);
    await page.keyboard.up(NON_NATIVE_ACTIVATION_KEY);
    await expect.poll(() => reactGrab.isOverlayVisible()).toBe(false);
  });

  const expectCaretMovement = async (
    reactGrab: ReactGrabPageObject,
    field: Locator,
    scope: "page" | "overlay",
  ) => {
    await field.evaluate((element) => {
      window.addEventListener("keydown", (event) => {
        if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
          element.setAttribute("data-page-key", event.defaultPrevented ? "prevented" : event.key);
        }
      });
    });
    const word = "example";
    await field.fill(word);
    await expect(field).toBeFocused();
    await expect(field).toHaveValue(word);
    await reactGrab.page.keyboard.down(reactGrab.modifierKey);
    await reactGrab.page.keyboard.press("ArrowLeft");
    await expect(field).toHaveJSProperty("selectionStart", 0);
    if (scope === "page") await expect(field).toHaveAttribute("data-page-key", "ArrowLeft");
    else await expect(field).not.toHaveAttribute("data-page-key");
    await reactGrab.page.keyboard.press("ArrowRight");
    await expect(field).toHaveJSProperty("selectionStart", word.length);
    if (scope === "page") await expect(field).toHaveAttribute("data-page-key", "ArrowRight");
    else await expect(field).not.toHaveAttribute("data-page-key");
    await reactGrab.page.keyboard.up(reactGrab.modifierKey);
  };

  // Headless Chromium binds no caret command to the modifier with Up and Down,
  // so this checks that the key reaches the field with its default action intact.
  const expectNativeVerticalChord = async (
    reactGrab: ReactGrabPageObject,
    field: Locator,
    scope: "page" | "overlay",
  ) => {
    await field.evaluate((element) => {
      element.addEventListener(
        "keydown",
        (event) => {
          if (!(event instanceof KeyboardEvent)) return;
          const { key } = event;
          if (key !== "ArrowUp" && key !== "ArrowDown") return;
          setTimeout(() => {
            element.setAttribute("data-field-key", event.defaultPrevented ? "prevented" : key);
          });
        },
        true,
      );
      window.addEventListener("keydown", (event) => {
        if (event.key === "ArrowUp" || event.key === "ArrowDown") {
          element.setAttribute("data-page-key", event.key);
        }
      });
    });
    await field.fill("example");
    await expect(field).toBeFocused();
    for (const key of ["ArrowUp", "ArrowDown"]) {
      await reactGrab.pressKeyCombo([reactGrab.modifierKey], key);
      await expect(field).toHaveAttribute("data-field-key", key);
      if (scope === "page") await expect(field).toHaveAttribute("data-page-key", key);
      else await expect(field).not.toHaveAttribute("data-page-key");
    }
    await expect(field).toBeFocused();
  };

  for (const scope of ["page", "same-origin frame"]) {
    test(`the ${scope} field keeps native caret movement and propagation`, async ({
      reactGrab,
      page,
    }) => {
      const root =
        scope === "page" ? page : page.frameLocator("[data-testid='same-origin-iframe']");
      await root.locator("body").evaluate((body) => {
        const field = document.createElement("input");
        field.dataset.testid = "cycle-page-field";
        body.prepend(field);
      });
      await expectCaretMovement(reactGrab, root.getByTestId("cycle-page-field"), "page");
      await expect(toolbarAction(page, "copy")).toHaveAttribute("aria-pressed", "true");
    });
  }

  test("a page field keeps the modifier with Up and Down", async ({ reactGrab, page }) => {
    await page.locator("body").evaluate((body) => {
      const field = document.createElement("input");
      field.dataset.testid = "cycle-page-field";
      body.prepend(field);
    });
    await expectNativeVerticalChord(reactGrab, page.getByTestId("cycle-page-field"), "page");
    await expect(toolbarAction(page, "copy")).toHaveAttribute("aria-pressed", "true");
  });

  test("an empty focused page field, like a menu's search box, gives the chord to the toolbar", async ({
    reactGrab,
    page,
  }) => {
    await page.locator("body").evaluate((body) => {
      const menu = document.createElement("div");
      menu.setAttribute("role", "menu");
      const search = document.createElement("input");
      search.type = "search";
      search.dataset.testid = "menu-search";
      const item = document.createElement("div");
      item.setAttribute("role", "menuitem");
      item.tabIndex = 0;
      item.dataset.testid = "menu-item";
      item.textContent = "Parent";
      menu.append(search, item);
      body.prepend(menu);
      search.focus();
    });
    const search = page.getByTestId("menu-search");
    await expect(search).toBeFocused();

    await reactGrab.pressKeyCombo([reactGrab.modifierKey], "ArrowRight");
    await expect(toolbarAction(page, "annotate-pen")).toHaveAttribute("aria-pressed", "true");
    await reactGrab.pressKeyCombo([reactGrab.modifierKey], "ArrowLeft");
    await expect(toolbarAction(page, "copy")).toHaveAttribute("aria-pressed", "true");

    await page.getByTestId("menu-item").focus();
    await reactGrab.pressKeyCombo([reactGrab.modifierKey], "ArrowDown");
    await expect(toolbarAction(page, "annotate-pen")).toHaveAttribute("aria-pressed", "true");
    await reactGrab.pressKeyCombo([reactGrab.modifierKey], "ArrowUp");
    await expect(toolbarAction(page, "copy")).toHaveAttribute("aria-pressed", "true");

    await search.fill("parent");
    await expect(search).toBeFocused();
    await reactGrab.pressKeyCombo([reactGrab.modifierKey], "ArrowLeft");
    await expect(toolbarAction(page, "copy")).toHaveAttribute("aria-pressed", "true");
    await expect(search).toBeFocused();
  });

  const observePageArrowRight = () => {
    window.addEventListener(
      "keydown",
      (event) => {
        if (event.key.startsWith("Arrow")) document.body.dataset.pageArrow = event.key;
      },
      true,
    );
  };

  const observeArrowRight = async (reactGrab: ReactGrabPageObject) => {
    const page = reactGrab.page;
    await page.addInitScript(() => {
      window.addEventListener(
        "keydown",
        (event) => {
          if (event.key.startsWith("Arrow")) {
            setTimeout(() => {
              document.body.dataset.arrowPrevented = String(event.defaultPrevented);
            });
          }
        },
        true,
      );
    });
    await page.reload();
    await reactGrab.activate();
    await page.evaluate(observePageArrowRight);
  };

  const grabWithEmptyPillField = async (reactGrab: ReactGrabPageObject) => {
    await reactGrab.hoverUntilSelected("[data-testid='todo-list'] h1");
    await reactGrab.page.keyboard.press("Enter");
    const field = reactGrab.page.getByPlaceholder("Optional context");
    await expect(field).toBeFocused();
    await expect(field).toHaveValue("");
    return field;
  };

  test("cycles tools from the focused empty pill field", async ({ reactGrab, page }) => {
    await observeArrowRight(reactGrab);
    const field = await grabWithEmptyPillField(reactGrab);
    const body = page.locator("body");
    await page.keyboard.down(reactGrab.modifierKey);
    for (const action of ["annotate-pen", "annotate-rectangle"]) {
      await page.keyboard.press("ArrowRight");
      await expect(toolbarAction(page, action)).toHaveAttribute("aria-pressed", "true");
      await expect(field).toBeFocused();
      await expect(body).toHaveAttribute("data-arrow-prevented", "true");
      await expect(body).not.toHaveAttribute("data-page-arrow");
    }
    await page.keyboard.up(reactGrab.modifierKey);
    await page.keyboard.type("note");
    await expect(field).toHaveValue("note");
  });

  test("cycles tools with Down and Up from the focused empty pill field", async ({
    reactGrab,
    page,
  }) => {
    await observeArrowRight(reactGrab);
    const field = await grabWithEmptyPillField(reactGrab);
    const body = page.locator("body");
    await page.keyboard.down(reactGrab.modifierKey);
    for (const [arrow, action] of [
      ["ArrowDown", "annotate-pen"],
      ["ArrowUp", "copy"],
      ["ArrowUp", "annotate-text"],
    ]) {
      await page.keyboard.press(arrow);
      await expect(toolbarAction(page, action)).toHaveAttribute("aria-pressed", "true");
      await expect(field).toBeFocused();
      await expect(body).toHaveAttribute("data-arrow-prevented", "true");
      await expect(body).not.toHaveAttribute("data-page-arrow");
    }
    await page.keyboard.up(reactGrab.modifierKey);
  });

  test("the pill field keeps caret movement until its context is cleared", async ({
    reactGrab,
    page,
  }) => {
    const field = await grabWithEmptyPillField(reactGrab);
    await expectCaretMovement(reactGrab, field, "overlay");
    await expectNativeVerticalChord(reactGrab, field, "overlay");
    const grab = toolbarAction(page, "copy");
    await expect(grab).toHaveAttribute("aria-pressed", "true");

    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.type(" ");
    await expect(field).toHaveValue(" ");
    await reactGrab.pressKeyCombo([reactGrab.modifierKey], "ArrowLeft");
    await expect(field).not.toHaveAttribute("data-page-key");
    await expect(field).toHaveJSProperty("selectionStart", 0);
    await expect(grab).toHaveAttribute("aria-pressed", "true");

    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.press("Backspace");
    await expect(field).toHaveValue("");
    await reactGrab.pressKeyCombo([reactGrab.modifierKey], "ArrowLeft");
    await expect(toolbarAction(page, "annotate-text")).toHaveAttribute("aria-pressed", "true");
  });

  test("the comment field keeps caret movement inside the overlay", async ({ reactGrab, page }) => {
    await reactGrab.enterPromptMode("[data-testid='todo-list'] h1");
    await expectCaretMovement(reactGrab, page.getByPlaceholder("Add context"), "overlay");
    expect(await reactGrab.isPromptModeActive()).toBe(true);
  });

  test("Shift+Enter starts a new line in a note and Enter commits both lines", async ({
    reactGrab,
    page,
  }) => {
    await toolbarAction(page, "annotate-text").click();
    await page.mouse.click(NOTE_POSITION.x, NOTE_POSITION.y);
    const noteInput = page.locator("[data-react-grab-annotation-input]");
    await expect(noteInput).toBeFocused();
    await page.keyboard.type("First line");
    const singleLineHeight = (await noteInput.boundingBox())?.height ?? 0;
    await page.keyboard.press("Shift+Enter");
    await page.keyboard.type("Second line");
    await expect(noteInput).toHaveValue("First line\nSecond line");
    expect((await noteInput.boundingBox())?.height ?? 0).toBeGreaterThan(singleLineHeight);
    expect(await reactGrab.isOverlayVisible()).toBe(true);

    await page.keyboard.press("Enter");
    await expect(noteInput).toHaveCount(0);
    const note = page.locator(TEXT_SELECTOR).last();
    await expect(note).toHaveText("First line\nSecond line", { useInnerText: true });
    const noteBox = await note.boundingBox();
    expect(noteBox?.height ?? 0).toBeGreaterThan(singleLineHeight);
  });

  test("the note field keeps caret movement inside the overlay", async ({ reactGrab, page }) => {
    await toolbarAction(page, "annotate-text").click();
    await page.mouse.click(NOTE_POSITION.x, NOTE_POSITION.y);
    await expectCaretMovement(reactGrab, page.getByLabel("Annotation text"), "overlay");
    await expect(toolbarAction(page, "annotate-text")).toHaveAttribute("aria-pressed", "true");
  });

  for (const control of ["value", "filter"]) {
    test(`the Specs ${control} field keeps caret movement inside the overlay`, async ({
      reactGrab,
      page,
    }) => {
      await installSpecsFixture(page);
      await switchOnSpecs(page);
      await inspect(page, "specs-token-button");
      await pinAndReach(page, "padding");
      const row = specRow(page, "padding");
      if (control === "filter") {
        await row.locator("[data-react-grab-spec-menu-trigger]").click();
        await expectCaretMovement(
          reactGrab,
          page.getByPlaceholder("Filter tokens and values"),
          "overlay",
        );
      } else {
        await row.locator("[data-react-grab-spec-value]").click();
        await expectCaretMovement(
          reactGrab,
          row.locator("[data-react-grab-specs-input]"),
          "overlay",
        );
      }
      await expect(toolbarAction(page, "copy")).toHaveAttribute("aria-pressed", "true");
    });
  }

  test("claims the chord during a selection drag", async ({ reactGrab, page }) => {
    await observeArrowRight(reactGrab);
    await page.mouse.move(MARQUEE_START.x, MARQUEE_START.y);
    await page.mouse.down();
    await page.mouse.move(MARQUEE_END.x, MARQUEE_END.y);
    await expect.poll(async () => (await reactGrab.getState()).isDragging).toBe(true);
    await reactGrab.pressKeyCombo([reactGrab.modifierKey], "ArrowRight");
    await expect(page.locator("body")).toHaveAttribute("data-arrow-prevented", "true");
    await expect(page.locator("body")).not.toHaveAttribute("data-page-arrow");
    await expect(toolbarAction(page, "copy")).toHaveAttribute("aria-pressed", "true");
    await page.mouse.up();
  });

  test("claims the chord during a pending copy", async ({ reactGrab, page }) => {
    await observeArrowRight(reactGrab);
    await page.evaluate(() =>
      window.__REACT_GRAB__?.registerPlugin({
        name: "pending-tool-cycle-copy",
        hooks: {
          onBeforeCopy: () =>
            new Promise<void>((resolve) => {
              window.addEventListener("finish-copy", () => resolve(), { once: true });
            }),
        },
      }),
    );
    await reactGrab.hoverUntilSelected("[data-testid='todo-list'] h1");
    await page.keyboard.press("Enter");
    await expect.poll(async () => (await reactGrab.getState()).isCopying).toBe(true);
    await reactGrab.pressKeyCombo([reactGrab.modifierKey], "ArrowRight");
    await expect(page.locator("body")).toHaveAttribute("data-arrow-prevented", "true");
    await expect(page.locator("body")).not.toHaveAttribute("data-page-arrow");
    await expect(toolbarAction(page, "annotate-pen")).toHaveAttribute("aria-pressed", "false");
    const frameBody = page.frameLocator("[data-testid='same-origin-iframe']").locator("body");
    await frameBody.evaluate(observePageArrowRight);
    await frameBody.evaluate((body) => {
      body.tabIndex = -1;
      body.focus();
    });
    await expect(frameBody).toBeFocused();
    await reactGrab.pressKeyCombo([reactGrab.modifierKey], "ArrowRight");
    await expect(frameBody).toHaveAttribute("data-arrow-prevented", "true");
    await expect(frameBody).not.toHaveAttribute("data-page-arrow");
    await page.evaluate(() => window.dispatchEvent(new Event("finish-copy")));
    await expect(page.getByPlaceholder("Optional context")).toBeFocused();
    await expect(toolbarAction(page, "copy")).toHaveAttribute("aria-pressed", "true");
  });

  test("claims the chord with a toolbar menu item focused", async ({ reactGrab, page }) => {
    await observeArrowRight(reactGrab);
    await page.evaluate(() =>
      window.__REACT_GRAB__?.registerPlugin({
        name: "tool-cycle-menu-choice",
        actions: [{ id: "choice", label: "Choice", showInToolbarMenu: true, onAction: () => {} }],
      }),
    );
    await reactGrab.rightClickToolbarToggle();
    const item = page.locator(
      '[data-react-grab-toolbar-menu] [data-react-grab-menu-item="choice"]',
    );
    await item.focus();
    await expect(item).toBeFocused();
    await reactGrab.pressKeyCombo([reactGrab.modifierKey], "ArrowRight");
    await expect(page.locator("body")).toHaveAttribute("data-arrow-prevented", "true");
    await expect(page.locator("body")).not.toHaveAttribute("data-page-arrow");
    await expect(item).toBeFocused();
    await expect(toolbarAction(page, "copy")).toHaveAttribute("aria-pressed", "true");
  });

  test("claims the chord before page listeners only while active", async ({ reactGrab, page }) => {
    await observeArrowRight(reactGrab);
    const body = page.locator("body");
    await reactGrab.pressKeyCombo([reactGrab.modifierKey], "ArrowRight");
    await expect(body).toHaveAttribute("data-arrow-prevented", "true");
    await expect(body).not.toHaveAttribute("data-page-arrow");
    await reactGrab.deactivate();
    await reactGrab.pressKeyCombo([reactGrab.modifierKey], "ArrowRight");
    await expect(body).toHaveAttribute("data-arrow-prevented", "false");
    await expect(body).toHaveAttribute("data-page-arrow", "ArrowRight");
  });

  test("claims the chord on Down and Up before page listeners only while active", async ({
    reactGrab,
    page,
  }) => {
    await observeArrowRight(reactGrab);
    const body = page.locator("body");
    for (const [arrow, action] of [
      ["ArrowDown", "annotate-pen"],
      ["ArrowUp", "copy"],
    ]) {
      await reactGrab.pressKeyCombo([reactGrab.modifierKey], arrow);
      await expect(toolbarAction(page, action)).toHaveAttribute("aria-pressed", "true");
      await expect(body).toHaveAttribute("data-arrow-prevented", "true");
      await expect(body).not.toHaveAttribute("data-page-arrow");
    }
    await reactGrab.deactivate();
    await reactGrab.pressKeyCombo([reactGrab.modifierKey], "ArrowDown");
    await expect(body).toHaveAttribute("data-arrow-prevented", "false");
    await expect(body).toHaveAttribute("data-page-arrow", "ArrowDown");
  });

  test("using the modifier for undo leaves the tool in hand", async ({ reactGrab, page }) => {
    await drawStraightLine(page);
    await reactGrab.pressKeyCombo([reactGrab.modifierKey], "z");
    await expect(page.locator(STROKE_SELECTOR)).toHaveCount(0);
    await expect(toolbarAction(page, "annotate-pen")).toHaveAttribute("aria-pressed", "true");
  });

  test("tooltips name the key that reaches each tool from the one in hand", async ({
    reactGrab,
    page,
  }) => {
    const modifier = reactGrab.modifierKey === "Meta" ? "⌘" : "Ctrl+";
    const readShortcut = async (actionId: string, name: string) => {
      await page.mouse.move(EMPTY_POSITION.x, EMPTY_POSITION.y);
      await toolbarAction(page, actionId).hover();
      const tooltip = page.locator(TOOLTIP_SELECTOR).filter({ hasText: name });
      await expect(tooltip).toBeVisible();
      const shortcut = tooltip.locator(TOOLTIP_SHORTCUT_SELECTOR);
      return (await shortcut.count()) === 0
        ? null
        : shortcut.getAttribute("data-react-grab-tooltip-shortcut");
    };

    expect(await readShortcut("annotate-pen", "Pen")).toBe(`${modifier}→`);
    expect(await readShortcut("annotate-text", "Text")).toBe(`${modifier}←`);
    expect(await readShortcut("annotate-rectangle", "Rectangle")).toBeNull();
    expect(await readShortcut("copy", "Grab")).toBeNull();

    await toolbarAction(page, "annotate-pen").click();
    expect(await readShortcut("annotate-rectangle", "Rectangle")).toBe(`${modifier}→`);
    expect(await readShortcut("copy", "Grab")).toBe(`${modifier}←`);
    expect(await readShortcut("annotate-text", "Text")).toBeNull();
    expect(await readShortcut("annotate-pen", "Pen")).toBeNull();

    await reactGrab.pressKeyCombo([reactGrab.modifierKey], "ArrowRight");
    await expect(toolbarAction(page, "annotate-rectangle")).toHaveAttribute("aria-pressed", "true");
    expect(await readShortcut("annotate-text", "Text")).toBe(`${modifier}→`);
    expect(await readShortcut("annotate-pen", "Pen")).toBe(`${modifier}←`);
    expect(await readShortcut("copy", "Grab")).toBeNull();
  });

  test("tooltips show the arrows along the toolbar's edge", async ({ reactGrab, page }) => {
    await expect.poll(() => reactGrab.isToolbarVisible()).toBe(true);
    await page.waitForTimeout(TOOLBAR_SETTLE_MS);
    const modifier = reactGrab.modifierKey === "Meta" ? "⌘" : "Ctrl+";
    const readShortcut = async (actionId: string, name: string) => {
      await page.mouse.move(EMPTY_POSITION.x, EMPTY_POSITION.y);
      await toolbarAction(page, actionId).hover();
      const tooltip = page.locator(TOOLTIP_SELECTOR).filter({ hasText: name });
      await expect(tooltip).toBeVisible();
      return tooltip
        .locator(TOOLTIP_SHORTCUT_SELECTOR)
        .getAttribute("data-react-grab-tooltip-shortcut");
    };

    expect((await reactGrab.getToolbarInfo()).snapEdge).toBe("bottom");
    expect(await readShortcut("annotate-pen", "Pen")).toBe(`${modifier}→`);
    expect(await readShortcut("annotate-text", "Text")).toBe(`${modifier}←`);

    await page.mouse.move(EMPTY_POSITION.x, EMPTY_POSITION.y);
    await page.waitForTimeout(TOOLBAR_SETTLE_MS);
    await reactGrab.dragToolbar(TOOLBAR_SIDE_EDGE_DRAG_PX.x, TOOLBAR_SIDE_EDGE_DRAG_PX.y);
    await expect.poll(async () => (await reactGrab.getToolbarInfo()).isVertical).toBe(true);
    expect(
      await page.evaluate(
        () => JSON.parse(localStorage.getItem("react-grab-toolbar-state") ?? "{}").edge,
      ),
    ).toBe("right");
    expect(await readShortcut("annotate-pen", "Pen")).toBe(`${modifier}↓`);
    expect(await readShortcut("annotate-text", "Text")).toBe(`${modifier}↑`);
    await reactGrab.pressKeyCombo([reactGrab.modifierKey], "ArrowDown");
    await expect(toolbarAction(page, "annotate-pen")).toHaveAttribute("aria-pressed", "true");
    expect(await readShortcut("copy", "Grab")).toBe(`${modifier}↑`);
  });

  test("before activating, only Grab shows a key: the one that activates", async ({
    reactGrab,
    page,
  }) => {
    await reactGrab.deactivate();
    await page.mouse.move(EMPTY_POSITION.x, EMPTY_POSITION.y);
    await toolbarAction(page, "copy").hover();
    const grabTooltip = page.locator(TOOLTIP_SELECTOR).filter({ hasText: "Grab" });
    await expect(grabTooltip.locator(TOOLTIP_SHORTCUT_SELECTOR)).toHaveAttribute(
      "data-react-grab-tooltip-shortcut",
      reactGrab.modifierKey === "Meta" ? "⌘C" : "Ctrl+C",
    );

    await page.mouse.move(EMPTY_POSITION.x, EMPTY_POSITION.y);
    await toolbarAction(page, "annotate-pen").hover();
    const penTooltip = page.locator(TOOLTIP_SELECTOR).filter({ hasText: "Pen" });
    await expect(penTooltip).toBeVisible();
    await expect(penTooltip.locator(TOOLTIP_SHORTCUT_SELECTOR)).toHaveCount(0);
  });
});

test.describe("Grab, Pen, Rectangle and Text are one choice", () => {
  test.beforeEach(async ({ reactGrab }) => {
    await expect.poll(() => reactGrab.isToolbarVisible(), { timeout: 3000 }).toBe(true);
  });

  test("Specs and Spacing show only while Grab is the tool in hand", async ({
    reactGrab,
    page,
  }) => {
    const inspectTools = page.locator(INSPECT_TOOLS_SELECTOR);
    await expect(inspectTools).not.toHaveAttribute("data-revealed");
    await expect(inspectTools).toHaveAttribute("inert");

    await reactGrab.activate();
    await expect(inspectTools).toHaveAttribute("data-revealed", "");

    await toolbarAction(page, "annotate-pen").click();
    await expect(inspectTools).not.toHaveAttribute("data-revealed");
    await toolbarAction(page, "annotate-rectangle").click();
    await expect(inspectTools).not.toHaveAttribute("data-revealed");
    await toolbarAction(page, "annotate-text").click();
    await expect(inspectTools).not.toHaveAttribute("data-revealed");

    await toolbarAction(page, "copy").click();
    await expect(inspectTools).toHaveAttribute("data-revealed", "");
  });

  test("1, 2 and 3 leave the drawing tool in hand and Specs, Spacing and Screenshot off", async ({
    reactGrab,
    page,
  }) => {
    await reactGrab.activate();
    await page.mouse.move(EMPTY_POSITION.x, EMPTY_POSITION.y);
    for (const toolActionId of [
      "annotate-pen",
      "annotate-rectangle",
      "annotate-text",
      "annotate-edit",
    ]) {
      if (toolActionId === "annotate-edit") await drawStraightLine(page);
      await toolbarAction(page, toolActionId).click();
      await page.mouse.move(EMPTY_POSITION.x, EMPTY_POSITION.y);
      for (const key of ["1", "2", "3"]) {
        await page.keyboard.press(key);
        await expect(toolbarAction(page, toolActionId)).toHaveAttribute("aria-pressed", "true");
      }
    }
    await toolbarAction(page, "copy").click();
    for (const actionId of ["inspect-specs", "inspect-redlines", "auto-screenshot"]) {
      await expect(toolbarAction(page, actionId)).toHaveAttribute("aria-pressed", "false");
    }
  });

  for (const toolActionId of ["annotate-pen", "annotate-rectangle", "annotate-text"]) {
    test(`the activation shortcut takes ${toolActionId} back to Grab`, async ({
      reactGrab,
      page,
    }) => {
      await reactGrab.activate();
      await toolbarAction(page, toolActionId).click();
      await expect(toolbarAction(page, toolActionId)).toHaveAttribute("aria-pressed", "true");
      await page.mouse.move(EMPTY_POSITION.x, EMPTY_POSITION.y);

      await page.keyboard.press(`${reactGrab.modifierKey}+c`);
      await expect(toolbarAction(page, "copy")).toHaveAttribute("aria-pressed", "true");
      await expect(toolbarAction(page, toolActionId)).toHaveAttribute("aria-pressed", "false");
      expect(await reactGrab.isOverlayVisible()).toBe(true);
    });
  }
});

test.describe("Collapsing with the colors showing", () => {
  test("the toolbar keeps its place across collapse and expand", async ({ reactGrab, page }) => {
    await expect.poll(() => reactGrab.isToolbarVisible(), { timeout: 3000 }).toBe(true);
    const collapseButton = page.locator("[data-react-grab-toolbar-collapse]");
    const readCentreX = async () => {
      const box = await getBox(page, TOOLBAR_SELECTOR);
      return Math.round(box.x + box.width / 2);
    };
    // Settled: the toolbar slides into place on load and between steps, so
    // readings are spaced out to be sure it has stopped, not caught mid-frame.
    const settledCentreX = async () => {
      let previousCentreX = await readCentreX();
      await expect
        .poll(async () => {
          await page.waitForTimeout(TOOLBAR_SETTLE_POLL_INTERVAL_MS);
          const centreX = await readCentreX();
          const isSettled = centreX === previousCentreX;
          previousCentreX = centreX;
          return isSettled;
        })
        .toBe(true);
      return previousCentreX;
    };

    const startCentreX = await settledCentreX();
    for (let cycle = 0; cycle < 2; cycle++) {
      await toolbarAction(page, "annotate-pen").click();
      await expect(page.locator(ANNOTATION_COLORS_SELECTOR)).toHaveAttribute("data-revealed", "");
      await collapseButton.click();
      expect(Math.abs((await settledCentreX()) - startCentreX)).toBeLessThanOrEqual(1);
      await collapseButton.click();
      expect(Math.abs((await settledCentreX()) - startCentreX)).toBeLessThanOrEqual(1);
    }
  });
});

test.describe("Number keys pick up the toolbar's tools", () => {
  test.beforeEach(async ({ reactGrab, page }) => {
    await expect.poll(() => reactGrab.isToolbarVisible(), { timeout: 3000 }).toBe(true);
    await reactGrab.activate();
    await page.mouse.move(EMPTY_POSITION.x, EMPTY_POSITION.y);
  });

  test("1 and 2 switch Specs and Spacing on and off", async ({ page }) => {
    const specs = toolbarAction(page, "inspect-specs");
    const spacing = toolbarAction(page, "inspect-redlines");
    await expect(specs).toHaveAttribute("aria-pressed", "false");
    await expect(spacing).toHaveAttribute("aria-pressed", "false");

    await page.keyboard.press("1");
    await expect(specs).toHaveAttribute("aria-pressed", "true");
    await page.keyboard.press("2");
    await expect(spacing).toHaveAttribute("aria-pressed", "true");

    await page.keyboard.press("1");
    await page.keyboard.press("2");
    await expect(specs).toHaveAttribute("aria-pressed", "false");
    await expect(spacing).toHaveAttribute("aria-pressed", "false");
  });

  test("a tooltip shows the tool's name and its key", async ({ page }) => {
    await toolbarAction(page, "inspect-redlines").hover();
    const tooltip = page.locator(TOOLTIP_SELECTOR).filter({ hasText: "Spacing" });
    await expect(tooltip).toBeVisible();
    await expect(tooltip.locator(TOOLTIP_SHORTCUT_SELECTOR)).toHaveAttribute(
      "data-react-grab-tooltip-shortcut",
      "2",
    );
  });

  test("Specs and Spacing start off and are remembered after a reload", async ({
    reactGrab,
    page,
  }) => {
    const specs = toolbarAction(page, "inspect-specs");
    const spacing = toolbarAction(page, "inspect-redlines");
    await expect(specs).toHaveAttribute("aria-pressed", "false");
    await expect(spacing).toHaveAttribute("aria-pressed", "false");

    await page.keyboard.press("1");
    await page.keyboard.press("2");
    await expect(spacing).toHaveAttribute("aria-pressed", "true");
    await page.reload();
    await expect.poll(() => reactGrab.isToolbarVisible(), { timeout: 3000 }).toBe(true);
    await reactGrab.activate();
    await expect(specs).toHaveAttribute("aria-pressed", "true");
    await expect(spacing).toHaveAttribute("aria-pressed", "true");

    await specs.click();
    await spacing.click();
    await expect(spacing).toHaveAttribute("aria-pressed", "false");
    await page.reload();
    await expect.poll(() => reactGrab.isToolbarVisible(), { timeout: 3000 }).toBe(true);
    await reactGrab.activate();
    await expect(specs).toHaveAttribute("aria-pressed", "false");
    await expect(spacing).toHaveAttribute("aria-pressed", "false");
  });
});

test.describe("The screenshot toggle", () => {
  const readIconPath = (page: Page) =>
    toolbarAction(page, "auto-screenshot").locator("svg path").getAttribute("d");

  test.beforeEach(async ({ reactGrab, page }) => {
    await expect.poll(() => reactGrab.isToolbarVisible(), { timeout: 3000 }).toBe(true);
    await reactGrab.activate();
    await page.mouse.move(EMPTY_POSITION.x, EMPTY_POSITION.y);
  });

  test("sits after Spacing in Grab's group and shows only with Grab in hand", async ({ page }) => {
    const inspectTools = page.locator(INSPECT_TOOLS_SELECTOR);
    const actionIds = await inspectTools
      .locator("[data-react-grab-toolbar-action]")
      .evaluateAll((buttons) =>
        buttons.map((button) => button.getAttribute("data-react-grab-toolbar-action")),
      );
    expect(actionIds).toEqual(["inspect-specs", "inspect-redlines", "auto-screenshot"]);
    await expect(toolbarAction(page, "auto-screenshot")).toHaveAttribute(
      "aria-label",
      "Copy a screenshot with every grab",
    );
    await expect(inspectTools).toHaveAttribute("data-revealed", "");

    await toolbarAction(page, "annotate-pen").click();
    await expect(inspectTools).not.toHaveAttribute("data-revealed");
    await toolbarAction(page, "copy").click();
    await expect(inspectTools).toHaveAttribute("data-revealed", "");
  });

  test("a click and 3 switch it, with the outline camera off and the filled one on", async ({
    page,
  }) => {
    const toggle = toolbarAction(page, "auto-screenshot");
    await expect(toggle).toHaveAttribute("aria-pressed", "false");
    expect(await readIconPath(page)).toBe(PHOTO_CAMERA_ICON_PATHS.outline);

    await page.keyboard.press("3");
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
    expect(await readIconPath(page)).toBe(PHOTO_CAMERA_ICON_PATHS.filled);

    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-pressed", "false");
    expect(await readIconPath(page)).toBe(PHOTO_CAMERA_ICON_PATHS.outline);

    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
    await page.mouse.move(EMPTY_POSITION.x, EMPTY_POSITION.y);
    await page.keyboard.press("3");
    await expect(toggle).toHaveAttribute("aria-pressed", "false");
  });

  test("its tooltip shows Screenshot and 3", async ({ page }) => {
    await toolbarAction(page, "auto-screenshot").hover();
    const tooltip = page.locator(TOOLTIP_SELECTOR).filter({ hasText: "Screenshot" });
    await expect(tooltip).toBeVisible();
    await expect(tooltip.locator(TOOLTIP_SHORTCUT_SELECTOR)).toHaveAttribute(
      "data-react-grab-tooltip-shortcut",
      "3",
    );
  });

  test("4 does nothing with Grab in hand, and with Pen in hand 3 and 4 leave Pen in hand", async ({
    page,
  }) => {
    const toggle = toolbarAction(page, "auto-screenshot");
    await page.keyboard.press("4");
    await expect(toggle).toHaveAttribute("aria-pressed", "false");
    await expect(toolbarAction(page, "copy")).toHaveAttribute("aria-pressed", "true");
    for (const actionId of ["inspect-specs", "inspect-redlines"]) {
      await expect(toolbarAction(page, actionId)).toHaveAttribute("aria-pressed", "false");
    }

    await toolbarAction(page, "annotate-pen").click();
    await page.mouse.move(EMPTY_POSITION.x, EMPTY_POSITION.y);
    await page.keyboard.press("4");
    await expect(toolbarAction(page, "annotate-pen")).toHaveAttribute("aria-pressed", "true");
    await page.keyboard.press("3");
    await expect(toolbarAction(page, "annotate-pen")).toHaveAttribute("aria-pressed", "true");

    await toolbarAction(page, "copy").click();
    await expect(toggle).toHaveAttribute("aria-pressed", "false");
  });

  test("starts off and is remembered after a reload", async ({ reactGrab, page }) => {
    const toggle = toolbarAction(page, "auto-screenshot");
    await page.keyboard.press("3");
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
    await expect
      .poll(() =>
        page.evaluate(
          (storageKey) => JSON.parse(localStorage.getItem(storageKey) ?? "{}"),
          INSPECT_SETTINGS_STORAGE_KEY,
        ),
      )
      .toMatchObject({ isAutoScreenshotEnabled: true });

    await page.reload();
    await expect.poll(() => reactGrab.isToolbarVisible(), { timeout: 3000 }).toBe(true);
    await reactGrab.activate();
    await expect(toggle).toHaveAttribute("aria-pressed", "true");

    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-pressed", "false");
    await page.reload();
    await expect.poll(() => reactGrab.isToolbarVisible(), { timeout: 3000 }).toBe(true);
    await reactGrab.activate();
    await expect(toggle).toHaveAttribute("aria-pressed", "false");
  });
});

test.describe("Grab", () => {
  test("the toolbar names Grab and shows its activation shortcut", async ({ reactGrab, page }) => {
    await expect.poll(() => reactGrab.isToolbarVisible(), { timeout: 3000 }).toBe(true);
    await toolbarAction(page, "copy").hover();
    const tooltip = page.locator(TOOLTIP_SELECTOR).filter({ hasText: "Grab" });
    await expect(tooltip).toBeVisible();
    await expect(tooltip.locator(TOOLTIP_SHORTCUT_SELECTOR)).toHaveAttribute(
      "data-react-grab-tooltip-shortcut",
      /^(⌘C|Ctrl\+C)$/,
    );
  });

  test("the Grab tooltip shows when the pointer glides over from Pen", async ({
    reactGrab,
    page,
  }) => {
    await expect.poll(() => reactGrab.isToolbarVisible(), { timeout: 3000 }).toBe(true);
    const penBox = await getBox(page, '[data-react-grab-toolbar-action="annotate-pen"]');
    const grabBox = await getBox(page, '[data-react-grab-toolbar-action="copy"]');
    await page.mouse.move(penBox.x + penBox.width / 2, penBox.y + penBox.height / 2, {
      steps: 4,
    });
    await page.mouse.move(grabBox.x + grabBox.width / 2, grabBox.y + grabBox.height / 2, {
      steps: 8,
    });
    await expect(page.locator(TOOLTIP_SELECTOR).filter({ hasText: "Grab" })).toBeVisible();
  });

  test("the Grab tooltip also shows while active and with a tool in hand", async ({
    reactGrab,
    page,
  }) => {
    await expect.poll(() => reactGrab.isToolbarVisible(), { timeout: 3000 }).toBe(true);
    await reactGrab.activate();
    const grabButton = toolbarAction(page, "copy");
    const tooltip = page.locator(TOOLTIP_SELECTOR).filter({ hasText: "Grab" });

    await grabButton.hover();
    await expect(tooltip).toBeVisible();

    await page.mouse.move(EMPTY_POSITION.x, EMPTY_POSITION.y);
    await expect(tooltip).toHaveCount(0);
    await toolbarAction(page, "annotate-pen").click();
    await grabButton.hover();
    await expect(tooltip).toBeVisible();
  });
});

const RECTANGLE_SELECTOR = '[data-react-grab-annotation-stroke="rectangle"]';

const getSvgBox = (page: Page, selector: string) =>
  page.locator(selector).evaluate((element) => {
    if (!(element instanceof SVGGraphicsElement)) throw new Error("Expected an SVG shape");
    const box = element.getBBox();
    return { x: box.x, y: box.y, width: box.width, height: box.height };
  });

const dragRectangle = async (page: Page, isReversed = false, isSquare = false, offsetY = 0) => {
  const start = isReversed ? RECTANGLE_END_PX : RECTANGLE_START_PX;
  const end = isReversed ? RECTANGLE_START_PX : RECTANGLE_END_PX;
  if (isSquare) await page.keyboard.down("Shift");
  await page.mouse.move(start.x, start.y + offsetY);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y + offsetY, { steps: RECTANGLE_DRAG_STEPS });
  await expect(page.locator("[data-react-grab-annotation-draft]")).toBeVisible();
  await page.mouse.up();
  if (isSquare) await page.keyboard.up("Shift");
};

test.describe("Rectangle and drawing shortcuts", () => {
  test.beforeEach(async ({ reactGrab }) => {
    await expect.poll(() => reactGrab.isToolbarVisible()).toBe(true);
    await reactGrab.activate();
  });

  test("Rectangle sits between Pen and Text and switches its icon", async ({ page }) => {
    const rectangle = toolbarAction(page, "annotate-rectangle");
    await expect(rectangle).toHaveAttribute("aria-label", "Draw a rectangle on the page");
    const penBox = await getBox(page, '[data-react-grab-toolbar-action="annotate-pen"]');
    const rectangleBox = await getBox(
      page,
      '[data-react-grab-toolbar-action="annotate-rectangle"]',
    );
    const textBox = await getBox(page, '[data-react-grab-toolbar-action="annotate-text"]');
    expect(rectangleBox.x).toBeGreaterThan(penBox.x);
    expect(rectangleBox.x).toBeLessThan(textBox.x);
    await expect(rectangle.locator("path")).toHaveAttribute("d", CROP_7_5_ICON_PATHS.outline);
    await rectangle.click();
    await expect(rectangle.locator("path")).toHaveAttribute("d", CROP_7_5_ICON_PATHS.filled);
  });

  test("number keys pick the rectangle's color and the swatch tooltips show them", async ({
    page,
  }) => {
    await toolbarAction(page, "annotate-rectangle").click();
    await page.keyboard.press("4");
    await expect(toolbarAction(page, "annotation-color-green")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(toolbarAction(page, "inspect-redlines")).toHaveAttribute("aria-pressed", "false");
    await toolbarAction(page, "annotation-color-black").hover();
    await expect(page.locator(TOOLTIP_SHORTCUT_SELECTOR)).toHaveText("5");
    await dragRectangle(page, false);
    await expect(page.locator(RECTANGLE_SELECTOR)).toHaveAttribute("stroke", "#22c55e");
  });

  for (const isReversed of [false, true]) {
    test(`rectangle follows the drag and color, reversed=${isReversed}`, async ({ page }) => {
      await toolbarAction(page, "annotate-rectangle").click();
      await toolbarAction(page, "annotation-color-orange").click();
      await dragRectangle(page, isReversed);
      const rectangle = page.locator(RECTANGLE_SELECTOR);
      await expect(rectangle).toHaveCount(1);
      await expect(rectangle).toHaveAttribute("fill", "none");
      await expect(rectangle).toHaveAttribute("stroke", ORANGE_ANNOTATION_COLOR);
      await expect(rectangle).toHaveAttribute("stroke-linejoin", "round");
      expect(await getSvgBox(page, RECTANGLE_SELECTOR)).toEqual({
        x: RECTANGLE_START_PX.x,
        y: RECTANGLE_START_PX.y,
        width: RECTANGLE_END_PX.x - RECTANGLE_START_PX.x,
        height: RECTANGLE_END_PX.y - RECTANGLE_START_PX.y,
      });
    });

    test(`Shift constrains a rectangle to a square, reversed=${isReversed}`, async ({ page }) => {
      await toolbarAction(page, "annotate-rectangle").click();
      await dragRectangle(page, isReversed, true);
      const box = await getSvgBox(page, RECTANGLE_SELECTOR);
      expect(box.width).toBe(RECTANGLE_END_PX.x - RECTANGLE_START_PX.x);
      expect(box.height).toBe(box.width);
    });
  }

  test("Shift updates the square draft without another pointer movement", async ({ page }) => {
    await toolbarAction(page, "annotate-rectangle").click();
    await page.mouse.move(RECTANGLE_START_PX.x, RECTANGLE_START_PX.y);
    await page.mouse.down();
    await page.mouse.move(RECTANGLE_END_PX.x, RECTANGLE_END_PX.y, { steps: RECTANGLE_DRAG_STEPS });
    const readDraftBox = () => getSvgBox(page, "[data-react-grab-annotation-draft]");
    await expect
      .poll(async () => (await readDraftBox()).height)
      .toBe(RECTANGLE_END_PX.y - RECTANGLE_START_PX.y);
    await page.keyboard.down("Shift");
    await expect
      .poll(async () => (await readDraftBox()).height)
      .toBe(RECTANGLE_END_PX.x - RECTANGLE_START_PX.x);
    await page.keyboard.up("Shift");
    await expect
      .poll(async () => (await readDraftBox()).height)
      .toBe(RECTANGLE_END_PX.y - RECTANGLE_START_PX.y);
    await page.mouse.up();
    await expect(page.locator(RECTANGLE_SELECTOR)).toHaveCount(1);
  });

  test("a Shift whose keyup was swallowed does not square the rectangle draft", async ({
    page,
  }) => {
    await toolbarAction(page, "annotate-rectangle").click();
    await page.evaluate(() =>
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Shift", shiftKey: true })),
    );
    await page.mouse.move(RECTANGLE_START_PX.x, RECTANGLE_START_PX.y);
    await page.mouse.down();
    await page.mouse.move(RECTANGLE_END_PX.x, RECTANGLE_END_PX.y, { steps: RECTANGLE_DRAG_STEPS });
    expect((await getSvgBox(page, "[data-react-grab-annotation-draft]")).height).toBe(
      RECTANGLE_END_PX.y - RECTANGLE_START_PX.y,
    );
    await page.mouse.up();
    expect((await getSvgBox(page, RECTANGLE_SELECTOR)).height).toBe(
      RECTANGLE_END_PX.y - RECTANGLE_START_PX.y,
    );
  });

  test("a tiny drag draws nothing and Escape cancels the draft", async ({ reactGrab, page }) => {
    await toolbarAction(page, "annotate-rectangle").click();
    await page.mouse.move(RECTANGLE_START_PX.x, RECTANGLE_START_PX.y);
    await page.mouse.down();
    await page.mouse.move(
      RECTANGLE_START_PX.x + RECTANGLE_TINY_DELTA_PX,
      RECTANGLE_START_PX.y + RECTANGLE_TINY_DELTA_PX,
    );
    await page.mouse.up();
    await expect(page.locator(STROKE_SELECTOR)).toHaveCount(0);
    await page.mouse.down();
    await page.mouse.move(RECTANGLE_END_PX.x, RECTANGLE_END_PX.y);
    await expect(page.locator("[data-react-grab-annotation-draft]")).toBeVisible();
    await page.keyboard.press("Escape");
    await page.mouse.up();
    await expect(page.locator("[data-react-grab-annotation-draft]")).toHaveCount(0);
    await reactGrab.activate();
    await expect(page.locator(STROKE_SELECTOR)).toHaveCount(0);
  });

  test("the next-tool shortcut cancels an active rectangle and the next Pen drag is freehand", async ({
    reactGrab,
    page,
  }) => {
    await toolbarAction(page, "annotate-rectangle").click();
    await page.mouse.move(RECTANGLE_START_PX.x, RECTANGLE_START_PX.y);
    await page.mouse.down();
    await page.mouse.move(RECTANGLE_END_PX.x, RECTANGLE_END_PX.y, {
      steps: RECTANGLE_DRAG_STEPS,
    });
    const draft = page.locator("[data-react-grab-annotation-draft]");
    await expect(draft).toBeVisible();
    await reactGrab.pressKeyCombo([reactGrab.modifierKey], "ArrowRight");
    await expect(toolbarAction(page, "annotate-text")).toHaveAttribute("aria-pressed", "true");
    await expect(draft).toHaveCount(0);
    await page.mouse.up();
    await expect(draft).toHaveCount(0);
    await expect(page.locator(STROKE_SELECTOR)).toHaveCount(0);
    await reactGrab.pressKeyCombo([reactGrab.modifierKey], "ArrowLeft");
    await reactGrab.pressKeyCombo([reactGrab.modifierKey], "ArrowLeft");
    await expect(toolbarAction(page, "annotate-pen")).toHaveAttribute("aria-pressed", "true");
    await page.mouse.move(RECTANGLE_START_PX.x, RECTANGLE_START_PX.y);
    await page.mouse.down();
    await page.mouse.move(RECTANGLE_INTERIOR_PX.x, RECTANGLE_END_PX.y, {
      steps: RECTANGLE_DRAG_STEPS,
    });
    await page.mouse.move(RECTANGLE_END_PX.x, RECTANGLE_START_PX.y, {
      steps: RECTANGLE_DRAG_STEPS,
    });
    await page.mouse.up();
    await expect(draft).toHaveCount(0);
    await expect(page.locator(STROKE_SELECTOR)).toHaveCount(1);
    await expect(page.locator(STROKE_SELECTOR)).toHaveAttribute(
      "data-react-grab-annotation-stroke",
      "freehand",
    );
  });

  for (const thinAxis of ["height", "width"]) {
    for (const thinSizePx of [0, RECTANGLE_TINY_DELTA_PX]) {
      test(`a rectangle drag with ${thinSizePx}px ${thinAxis} draws nothing`, async ({ page }) => {
        await toolbarAction(page, "annotate-rectangle").click();
        await page.mouse.move(RECTANGLE_START_PX.x, RECTANGLE_START_PX.y);
        await page.mouse.down();
        await page.mouse.move(
          thinAxis === "width" ? RECTANGLE_START_PX.x + thinSizePx : RECTANGLE_END_PX.x,
          thinAxis === "height" ? RECTANGLE_START_PX.y + thinSizePx : RECTANGLE_END_PX.y,
          { steps: RECTANGLE_DRAG_STEPS },
        );
        await page.mouse.up();
        await expect(page.locator("[data-react-grab-annotation-draft]")).toHaveCount(0);
        await expect(page.locator(STROKE_SELECTOR)).toHaveCount(0);
      });
    }
  }

  test("the drag does not click or select the page and the rectangle scrolls with it", async ({
    page,
  }) => {
    await page.evaluate((pageHeight) => {
      document.body.style.minHeight = `${pageHeight}px`;
      document.body.setAttribute("data-rectangle-page-clicks", "0");
      document.addEventListener("click", () => {
        document.body.setAttribute("data-rectangle-page-clicks", "1");
      });
    }, RECTANGLE_SCROLL_PAGE_HEIGHT_PX);
    await toolbarAction(page, "annotate-rectangle").click();
    await dragRectangle(page);
    await expect(page.locator("body")).toHaveAttribute("data-rectangle-page-clicks", "0");
    expect(await page.evaluate(() => window.getSelection()?.toString())).toBe("");
    const before = await getBox(page, RECTANGLE_SELECTOR);
    await page.mouse.wheel(0, RECTANGLE_SCROLL_PX);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(RECTANGLE_SCROLL_PX);
    await expect
      .poll(async () => (await getBox(page, RECTANGLE_SELECTOR)).y)
      .toBe(before.y - RECTANGLE_SCROLL_PX);
  });

  test("Move hits only the outline and moves, undoes, redoes and deletes one rectangle", async ({
    reactGrab,
    page,
  }) => {
    await toolbarAction(page, "annotate-rectangle").click();
    await dragRectangle(page);
    await page.keyboard.press("v");
    await page.mouse.click(
      RECTANGLE_INTERIOR_PX.x,
      RECTANGLE_START_PX.y + RECTANGLE_EDGE_HIT_OFFSET_PX,
    );
    await expect(page.locator(`${RECTANGLE_SELECTOR}${SELECTED_SELECTOR}`)).toHaveCount(1);
    await page.mouse.click(RECTANGLE_INTERIOR_PX.x, RECTANGLE_INTERIOR_PX.y);
    await expect(page.locator(SELECTED_SELECTOR)).toHaveCount(0);
    const before = await getBox(page, RECTANGLE_SELECTOR);
    await page.mouse.move(RECTANGLE_INTERIOR_PX.x, RECTANGLE_START_PX.y);
    await page.mouse.down();
    await page.mouse.move(
      RECTANGLE_INTERIOR_PX.x + DRAG_DELTA.x,
      RECTANGLE_START_PX.y + DRAG_DELTA.y,
      { steps: RECTANGLE_DRAG_STEPS },
    );
    await page.mouse.up();
    const after = await getBox(page, RECTANGLE_SELECTOR);
    expect(after.x - before.x).toBe(DRAG_DELTA.x);
    expect(after.y - before.y).toBe(DRAG_DELTA.y);
    await page.keyboard.press(`${reactGrab.modifierKey}+z`);
    expect(await getBox(page, RECTANGLE_SELECTOR)).toEqual(before);
    await page.keyboard.press(`${reactGrab.modifierKey}+Shift+z`);
    expect(await getBox(page, RECTANGLE_SELECTOR)).toEqual(after);
    await page.mouse.click(
      RECTANGLE_INTERIOR_PX.x + DRAG_DELTA.x,
      RECTANGLE_START_PX.y + DRAG_DELTA.y,
    );
    await page.keyboard.press("Delete");
    await expect(page.locator(STROKE_SELECTOR)).toHaveCount(0);
    await page.keyboard.press(`${reactGrab.modifierKey}+z`);
    await expect(page.locator(RECTANGLE_SELECTOR)).toHaveCount(1);
    await page.keyboard.press(`${reactGrab.modifierKey}+z`);
    expect(await getBox(page, RECTANGLE_SELECTOR)).toEqual(before);
    await page.keyboard.press(`${reactGrab.modifierKey}+z`);
    await expect(page.locator(STROKE_SELECTOR)).toHaveCount(0);
    await page.keyboard.press(`${reactGrab.modifierKey}+Shift+z`);
    await expect(page.locator(RECTANGLE_SELECTOR)).toHaveCount(1);
    await toolbarAction(page, "annotate-clear").click();
    await expect(page.locator(STROKE_SELECTOR)).toHaveCount(0);
  });

  test("a rectangle and stroke can be Shift-selected, marquee-selected and moved together", async ({
    page,
  }) => {
    await drawStraightLine(page);
    await toolbarAction(page, "annotate-rectangle").click();
    await dragRectangle(page, false, false, SECOND_LINE_OFFSET_Y);
    await page.keyboard.press("v");
    await page.mouse.click(RECTANGLE_START_PX.x, RECTANGLE_INTERIOR_PX.y + SECOND_LINE_OFFSET_Y);
    await page.keyboard.down("Shift");
    await page.mouse.click(RECTANGLE_INTERIOR_PX.x, LINE_START.y);
    await page.keyboard.up("Shift");
    await expect(page.locator(`${STROKE_SELECTOR}${SELECTED_SELECTOR}`)).toHaveCount(2);
    await page.mouse.click(EMPTY_POSITION.x, EMPTY_POSITION.y);
    await page.mouse.move(MARQUEE_START.x, MARQUEE_START.y);
    await page.mouse.down();
    await page.mouse.move(MARQUEE_END.x, MARQUEE_END.y, { steps: RECTANGLE_DRAG_STEPS });
    await page.mouse.up();
    await expect(page.locator(`${STROKE_SELECTOR}${SELECTED_SELECTOR}`)).toHaveCount(2);
    const before = await page
      .locator(STROKE_SELECTOR)
      .evaluateAll((elements) => elements.map((element) => element.getAttribute("d")));
    await page.mouse.move(RECTANGLE_START_PX.x, RECTANGLE_INTERIOR_PX.y + SECOND_LINE_OFFSET_Y);
    await page.mouse.down();
    await page.mouse.move(
      RECTANGLE_START_PX.x + DRAG_DELTA.x,
      RECTANGLE_INTERIOR_PX.y + SECOND_LINE_OFFSET_Y + DRAG_DELTA.y,
      { steps: RECTANGLE_DRAG_STEPS },
    );
    await page.mouse.up();
    const after = await page
      .locator(STROKE_SELECTOR)
      .evaluateAll((elements) => elements.map((element) => element.getAttribute("d")));
    for (const [index, path] of before.entries()) expect(after[index]).not.toBe(path);
  });

  test("Grab keeps 3 for Screenshot, leaves 4 to the page, and numbers typed into a note stay text", async ({
    page,
  }) => {
    await page.evaluate(() => {
      document.addEventListener("keydown", (event) => {
        if (event.key !== "3" && event.key !== "4") return;
        document.body.setAttribute("data-page-key", event.key);
      });
    });
    await page.keyboard.press("3");
    await expect(toolbarAction(page, "auto-screenshot")).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("body")).not.toHaveAttribute("data-page-key");
    await page.keyboard.press("3");
    await expect(toolbarAction(page, "auto-screenshot")).toHaveAttribute("aria-pressed", "false");
    await page.keyboard.press("4");
    await expect(page.locator("body")).toHaveAttribute("data-page-key", "4");
    await expect(toolbarAction(page, "copy")).toHaveAttribute("aria-pressed", "true");
    for (const actionId of ["inspect-specs", "inspect-redlines", "auto-screenshot"]) {
      await expect(toolbarAction(page, actionId)).toHaveAttribute("aria-pressed", "false");
    }
    for (const tool of ["pen", "rectangle", "text"]) {
      await expect(toolbarAction(page, `annotate-${tool}`)).toHaveAttribute(
        "aria-pressed",
        "false",
      );
    }
    await toolbarAction(page, "annotate-text").click();
    await page.mouse.click(NOTE_POSITION.x, NOTE_POSITION.y);
    const input = page.locator("[data-react-grab-annotation-input]");
    await expect(input).toBeFocused();
    await page.keyboard.type("Gap 123");
    await expect(input).toHaveValue("Gap 123");
    await expect(toolbarAction(page, "annotate-text")).toHaveAttribute("aria-pressed", "true");
  });

  test("stored Blue falls back to Red on reload", async ({ reactGrab, page }) => {
    await page.evaluate(
      (storageKey) =>
        localStorage.setItem(storageKey, JSON.stringify({ annotationColor: "#0d99ff" })),
      INSPECT_SETTINGS_STORAGE_KEY,
    );
    await page.reload();
    await expect.poll(() => reactGrab.isToolbarVisible()).toBe(true);
    await reactGrab.activate();
    await toolbarAction(page, "annotate-rectangle").click();
    await expect(toolbarAction(page, "annotation-color-red")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await dragRectangle(page);
    await expect(page.locator(RECTANGLE_SELECTOR)).toHaveAttribute(
      "stroke",
      DEFAULT_ANNOTATION_COLOR,
    );
  });

  test("only Black swatches have an inner ring while selection rings and dot sizes stay consistent in both themes", async ({
    reactGrab,
    page,
  }, testInfo) => {
    await toolbarAction(page, "annotate-pen").click();
    const swatches = page.locator(`${ANNOTATION_COLORS_SELECTOR} button`);
    expect(
      await swatches.evaluateAll((buttons) =>
        buttons.map((button) => button.getAttribute("aria-label")),
      ),
    ).toEqual(
      ["Red", "Orange", "Yellow", "Green", "Black"].map((color) => `${color} annotation color`),
    );
    for (const theme of ["light", "dark"]) {
      await reactGrab
        .getOverlayHost()
        .evaluate((host, theme) => host.setAttribute("data-rg-theme", theme), theme);
      const expectedBorder = theme === "dark" ? "rgba(255, 255, 255, 0.2)" : "rgba(0, 0, 0, 0.15)";
      const expectedSelectionRing =
        theme === "dark"
          ? "rgb(22, 22, 22) 0px 0px 0px 1.5px, rgb(255, 255, 255) 0px 0px 0px 2.5px"
          : "rgb(255, 255, 255) 0px 0px 0px 1.5px, rgb(23, 23, 23) 0px 0px 0px 2.5px";
      for (const selectedColor of ["red", "orange", "yellow", "green", "black"]) {
        const selectedSwatch = toolbarAction(page, `annotation-color-${selectedColor}`);
        await selectedSwatch.click();
        await expect(selectedSwatch).toHaveAttribute("aria-pressed", "true");
        for (const color of ["red", "orange", "yellow", "green", "black"]) {
          const dot = toolbarAction(page, `annotation-color-${color}`).locator("span.rounded-full");
          const expectedShadow =
            [
              color === "black" ? `${expectedBorder} 0px 0px 0px 1px inset` : "",
              color === selectedColor ? expectedSelectionRing : "",
            ]
              .filter(Boolean)
              .join(", ") || "none";
          await expect(dot).toHaveCSS("box-shadow", expectedShadow);
          await expect(dot).toHaveCSS("width", "10px");
          await expect(dot).toHaveCSS("height", "10px");
        }
      }
      await page
        .locator(TOOLBAR_SELECTOR)
        .screenshot({ path: testInfo.outputPath(`swatches-${theme}.png`), animations: "disabled" });
    }
    await expect(toolbarAction(page, "annotation-color-blue")).toHaveCount(0);
  });
});
