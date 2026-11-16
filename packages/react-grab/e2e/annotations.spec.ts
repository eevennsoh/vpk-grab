// Drawings and notes placed with the toolbar's Pen and Text tools, and the
// Move tool that selects, drags and deletes them.
import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures.js";

const STROKE_SELECTOR = "[data-react-grab-annotation-stroke]";
const TEXT_SELECTOR = "[data-react-grab-annotation-text]";
const SELECTED_SELECTOR = "[data-react-grab-annotation-selected]";
const TOOLBAR_SELECTOR = "[data-react-grab-toolbar]";
const ANNOTATION_ACTIONS_SELECTOR = "[data-react-grab-toolbar-annotation-actions]";
const ANNOTATION_COLORS_SELECTOR = "[data-react-grab-toolbar-annotation-colors]";
const INSPECT_SETTINGS_STORAGE_KEY = "react-grab-inspect-settings";
const DEFAULT_ANNOTATION_COLOR = "#f24822";
const BLUE_ANNOTATION_COLOR = "#0d99ff";
const DEFAULT_ANNOTATION_COLOR_RGB = "rgb(242, 72, 34)";
const BLUE_ANNOTATION_COLOR_RGB = "rgb(13, 153, 255)";
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
const TOOLTIP_SELECTOR = "[data-react-grab-tooltip]";
const TOOLTIP_SHORTCUT_SELECTOR = "[data-react-grab-tooltip-shortcut]";
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

    await toolbarAction(page, "annotate-text").click();
    await expect.poll(readPageCursor).toContain("12 12, text");

    await toolbarAction(page, "annotate-edit").click();
    await expect.poll(readPageCursor).toContain("12 12, move");

    await toolbarAction(page, "annotate-edit").click();
    await expect.poll(readPageCursor).toContain("7 7, crosshair");
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
    await expect(page.locator(ANNOTATION_ACTIONS_SELECTOR)).not.toHaveAttribute("data-revealed");
  });

  test("annotations let the pointer through unless the move tool is active", async ({ page }) => {
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

  test("switching between pen and text leaves the toolbar where it is", async ({ page }) => {
    await toolbarAction(page, "annotate-pen").click();
    await expect(page.locator(ANNOTATION_COLORS_SELECTOR)).toHaveAttribute("data-revealed", "");
    await page.waitForTimeout(TOOLBAR_SETTLE_MS);
    const settledBox = await getBox(page, TOOLBAR_SELECTOR);

    await toolbarAction(page, "annotate-text").click();
    await page.waitForTimeout(TOOLBAR_SETTLE_MS);
    await toolbarAction(page, "annotate-pen").click();
    await page.waitForTimeout(TOOLBAR_SETTLE_MS);

    const finalBox = await getBox(page, TOOLBAR_SELECTOR);
    expect(Math.abs(finalBox.x - settledBox.x)).toBeLessThan(1);
    expect(Math.abs(finalBox.width - settledBox.width)).toBeLessThan(1);
  });

  test("the toolbar stays at full strength while the pen or text tool is in hand", async ({
    page,
  }) => {
    const readToolbarOpacity = () =>
      page
        .locator(TOOLBAR_SELECTOR)
        .evaluate((element) => Number(getComputedStyle(element).opacity));

    await toolbarAction(page, "annotate-pen").click();
    await page.mouse.move(EMPTY_POSITION.x, EMPTY_POSITION.y);
    await expect.poll(readToolbarOpacity).toBe(1);

    await toolbarAction(page, "annotate-text").click();
    await page.mouse.move(EMPTY_POSITION.x, EMPTY_POSITION.y);
    await expect.poll(readToolbarOpacity).toBe(1);

    await toolbarAction(page, "annotate-text").click();
    await page.mouse.move(EMPTY_POSITION.x, EMPTY_POSITION.y);
    await expect.poll(readToolbarOpacity).toBeLessThan(1);
  });

  test("colors join the toolbar only while the pen or text tool is in hand", async ({ page }) => {
    const colors = page.locator(ANNOTATION_COLORS_SELECTOR);
    await expect(colors).toHaveAttribute("data-revealed", "");

    await toolbarAction(page, "annotate-text").click();
    await expect(colors).not.toHaveAttribute("data-revealed");
    await expect(colors).toHaveAttribute("inert");

    await toolbarAction(page, "annotate-pen").click();
    await expect(colors).toHaveAttribute("data-revealed", "");
    await expect(toolbarAction(page, "annotation-color-red")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  test("a new note takes the picked color and earlier notes keep theirs", async ({ page }) => {
    await toolbarAction(page, "annotation-color-blue").click();
    await expect(toolbarAction(page, "annotation-color-blue")).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await page.mouse.click(NOTE_POSITION.x, NOTE_POSITION.y + SECOND_LINE_OFFSET_Y);
    const input = page.locator("[data-react-grab-annotation-input]");
    await expect(input).toBeFocused();
    await expect(input).toHaveCSS("color", BLUE_ANNOTATION_COLOR_RGB);
    await page.keyboard.type("Blue note");
    await page.keyboard.press("Enter");

    const notes = page.locator(TEXT_SELECTOR);
    await expect(notes).toHaveCount(2);
    await expect(notes.nth(0)).toHaveCSS("color", DEFAULT_ANNOTATION_COLOR_RGB);
    await expect(notes.nth(1)).toHaveCSS("color", BLUE_ANNOTATION_COLOR_RGB);
  });

  test("a new stroke takes the picked color and earlier strokes keep theirs", async ({ page }) => {
    await toolbarAction(page, "annotate-pen").click();
    await toolbarAction(page, "annotation-color-blue").click();
    await expect(toolbarAction(page, "annotation-color-blue")).toHaveAttribute(
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
    await expect(strokes.nth(1)).toHaveAttribute("fill", BLUE_ANNOTATION_COLOR);
    await expect
      .poll(() =>
        page.evaluate(
          (storageKey) => localStorage.getItem(storageKey),
          INSPECT_SETTINGS_STORAGE_KEY,
        ),
      )
      .toContain(BLUE_ANNOTATION_COLOR);
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
});

test.describe("Control toggles the pen on a Mac", () => {
  test.beforeEach(async ({ reactGrab, page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "platform", { get: () => "MacIntel" });
    });
    await page.reload();
    await expect.poll(() => reactGrab.isToolbarVisible(), { timeout: 3000 }).toBe(true);
    await reactGrab.activate();
  });

  test("a bare Control press picks the pen up and puts it down", async ({ reactGrab, page }) => {
    const pen = toolbarAction(page, "annotate-pen");
    await expect(pen).toHaveAttribute("aria-pressed", "false");

    await page.keyboard.press("Control");
    await expect(pen).toHaveAttribute("aria-pressed", "true");

    await page.keyboard.press("Control");
    await expect(pen).toHaveAttribute("aria-pressed", "false");
    expect(await reactGrab.isOverlayVisible()).toBe(true);
  });

  test("Control switches from the text tool to the pen", async ({ page }) => {
    await toolbarAction(page, "annotate-text").click();
    await page.keyboard.press("Control");
    await expect(toolbarAction(page, "annotate-pen")).toHaveAttribute("aria-pressed", "true");
    await expect(toolbarAction(page, "annotate-text")).toHaveAttribute("aria-pressed", "false");
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

  test("3 and 4 pick up the pen and text tools and put them down", async ({ page }) => {
    const pen = toolbarAction(page, "annotate-pen");
    const text = toolbarAction(page, "annotate-text");

    await page.keyboard.press("3");
    await expect(pen).toHaveAttribute("aria-pressed", "true");
    await page.keyboard.press("4");
    await expect(text).toHaveAttribute("aria-pressed", "true");
    await expect(pen).toHaveAttribute("aria-pressed", "false");

    await page.keyboard.press("4");
    await expect(text).toHaveAttribute("aria-pressed", "false");
  });

  test("a tooltip shows the tool's name and its key", async ({ page }) => {
    await toolbarAction(page, "inspect-redlines").hover();
    const tooltip = page.locator(TOOLTIP_SELECTOR).filter({ hasText: "Spacing" });
    await expect(tooltip).toBeVisible();
    await expect(tooltip.locator(TOOLTIP_SHORTCUT_SELECTOR)).toHaveText("2");
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
    await expect(specs).toHaveAttribute("aria-pressed", "true");
    await expect(spacing).toHaveAttribute("aria-pressed", "true");

    await specs.click();
    await spacing.click();
    await expect(spacing).toHaveAttribute("aria-pressed", "false");
    await page.reload();
    await expect.poll(() => reactGrab.isToolbarVisible(), { timeout: 3000 }).toBe(true);
    await expect(specs).toHaveAttribute("aria-pressed", "false");
    await expect(spacing).toHaveAttribute("aria-pressed", "false");
  });
});

test.describe("Grab", () => {
  test("the toolbar names Grab and shows its activation shortcut", async ({ reactGrab, page }) => {
    await expect.poll(() => reactGrab.isToolbarVisible(), { timeout: 3000 }).toBe(true);
    await toolbarAction(page, "copy").hover();
    const tooltip = page.locator(TOOLTIP_SELECTOR).filter({ hasText: "Grab" });
    await expect(tooltip).toBeVisible();
    await expect(tooltip.locator(TOOLTIP_SHORTCUT_SELECTOR)).toHaveText(/^(⌘C|Ctrl\+C)$/);
  });

  test("the Grab tooltip shows when the pointer glides over from Specs", async ({
    reactGrab,
    page,
  }) => {
    await expect.poll(() => reactGrab.isToolbarVisible(), { timeout: 3000 }).toBe(true);
    const specsBox = await getBox(page, '[data-react-grab-toolbar-action="inspect-specs"]');
    const grabBox = await getBox(page, '[data-react-grab-toolbar-action="copy"]');
    await page.mouse.move(specsBox.x + specsBox.width / 2, specsBox.y + specsBox.height / 2, {
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
    await page.keyboard.press("3");
    await grabButton.hover();
    await expect(tooltip).toBeVisible();
  });
});
