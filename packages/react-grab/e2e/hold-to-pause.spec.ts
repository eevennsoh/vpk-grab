// Holding Space pauses vpk-grab without switching it off: the page takes the
// pointer and keyboard as if Grab were off, and letting go resumes the same
// session with its tool, toggles, pill and drawings untouched.
import type { Page } from "@playwright/test";
import {
  PAUSED_ANNOUNCEMENT,
  PAUSED_PAGE_LAYER_OPACITY,
  RESUMED_ANNOUNCEMENT,
  TOOLBAR_PAUSED_OPACITY,
} from "../src/constants.js";
import { test, expect, type ReactGrabPageObject } from "./fixtures.js";

const FIRST_TODO_SELECTOR = "[data-testid='todo-list'] li:first-child span";
const LIVE_LABEL_SELECTOR =
  "[data-react-grab-selection-label]:not([data-react-grab-label-instance])";
const COPIED_PILL_SELECTOR = "[data-react-grab-selection-label][data-react-grab-label-instance]";
const COMPLETION_SELECTOR = "[data-react-grab-completion]";
const PILL_PROMPT_SELECTOR = "[data-react-grab-pill-prompt] textarea";
const DISMISS_BUTTON_SELECTOR = 'button[aria-label="Dismiss"]';
const TOOLBAR_SELECTOR = "[data-react-grab-toolbar]";
const PAUSE_CHIP_SELECTOR = "[data-react-grab-pause-chip]";
const PAUSE_STATUS_SELECTOR = "[data-react-grab-pause-status]";
const SPACING_TOGGLE_SELECTOR = '[data-react-grab-toolbar-action="inspect-redlines"]';
const STROKE_SELECTOR = "[data-react-grab-annotation-stroke]";
const NOTE_INPUT_SELECTOR = "[data-react-grab-annotation-input]";
const DRAG_BOX_PAGE_POSITION_PX = { x: 420, y: 300 };
const DRAG_END_POSITION_PX = { x: 560, y: 400 };
const DRAG_REPOSITION_OFFSET_PX = { x: 40, y: 30 };
const DRAG_STEPS = 6;
const NOTE_POSITION_PX = { x: 640, y: 260 };
const HOVER_COLOR = "rgb(255, 0, 0)";
const RESTING_COLOR = "rgb(240, 240, 240)";
const FIXTURE_Z_INDEX = "2147483000";
const PAGE_HEIGHT_PX = 4000;
const SPACE_REPEAT_COUNT = 3;
const SCROLL_SETTLE_MS = 300;
const NO_COPY_SETTLE_MS = 400;
const RAPID_TAP_COUNT = 5;
const RECTANGLE_INSET_PX = 12;
const RECTANGLE_OVERHANG_PX = 40;
const FRAME_SELECTOR = "[data-testid='same-origin-iframe']";
const FRAME_TARGET_SELECTOR = "[data-testid='iframe-target']";
const FRAME_INPUT_ID = "pause-frame-input";
const SECOND_TODO_SELECTOR = "[data-testid='todo-list'] li:nth-child(2) span";
const ANNOTATION_SELECTION_SELECTOR = "[data-react-grab-annotation-selection]";
const ANNOTATION_FRAME_SELECTOR = "[data-react-grab-annotation-frame]";

declare global {
  interface Window {
    __pageKeyEvents?: string[];
    __pagePointerEvents?: string[];
    __bodyStyleHistory?: (string | null)[];
    __pauseAnnouncements?: string[];
  }
}

const injectPageFixtures = (page: Page) =>
  page.evaluate(
    ({ zIndex, pageHeight, hoverColor, restingColor }) => {
      document.body.style.minHeight = `${pageHeight}px`;
      const style = document.createElement("style");
      style.textContent = `#pause-hover-target:hover { background-color: ${hoverColor} !important; }`;
      document.head.append(style);
      const container = document.createElement("div");
      Object.assign(container.style, {
        position: "fixed",
        left: "40px",
        top: "120px",
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: "16px",
        padding: "8px",
        background: "white",
        zIndex,
      });
      const button = document.createElement("button");
      button.id = "pause-button";
      button.textContent = "Page button";
      button.dataset.clicks = "0";
      button.addEventListener("click", () => {
        button.dataset.clicks = String(Number(button.dataset.clicks) + 1);
      });
      const link = document.createElement("a");
      link.id = "pause-link";
      link.href = "#pause-link-target";
      link.textContent = "Page link";
      const hoverTarget = document.createElement("div");
      hoverTarget.id = "pause-hover-target";
      hoverTarget.textContent = "Hover target";
      Object.assign(hoverTarget.style, {
        width: "160px",
        height: "40px",
        backgroundColor: restingColor,
      });
      const input = document.createElement("input");
      input.id = "pause-input";
      container.append(button, link, hoverTarget, input);
      document.body.append(container);
      window.__pageKeyEvents = [];
      for (const eventName of ["keydown", "keyup"]) {
        window.addEventListener(eventName, (event) => {
          if (event instanceof KeyboardEvent) {
            window.__pageKeyEvents?.push(`${event.type}:${event.code}`);
          }
        });
      }
    },
    {
      zIndex: FIXTURE_Z_INDEX,
      pageHeight: PAGE_HEIGHT_PX,
      hoverColor: HOVER_COLOR,
      restingColor: RESTING_COLOR,
    },
  );

const getPauseStatus = (reactGrab: ReactGrabPageObject) =>
  reactGrab.getOverlayHost().locator(PAUSE_STATUS_SELECTOR);

const getPauseChip = (reactGrab: ReactGrabPageObject) =>
  reactGrab.getOverlayHost().locator(PAUSE_CHIP_SELECTOR);

const expectPaused = async (reactGrab: ReactGrabPageObject) => {
  await expect(getPauseStatus(reactGrab)).toHaveText(PAUSED_ANNOUNCEMENT);
  await expect(getPauseChip(reactGrab)).toHaveAttribute("data-visible", "");
};

const expectNotPaused = async (reactGrab: ReactGrabPageObject) => {
  await expect(getPauseStatus(reactGrab)).not.toHaveText(PAUSED_ANNOUNCEMENT);
  await expect(getPauseChip(reactGrab)).not.toHaveAttribute("data-visible", "");
};

const clickCenter = async (page: Page, selector: string) => {
  const box = await page.locator(selector).boundingBox();
  if (!box) throw new Error(`Missing ${selector}`);
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
};

const getCenter = async (page: Page, selector: string): Promise<[number, number]> => {
  const box = await page.locator(selector).boundingBox();
  if (!box) throw new Error(`Missing ${selector}`);
  return [box.x + box.width / 2, box.y + box.height / 2];
};

const moveToCenter = async (page: Page, selector: string) => {
  const box = await page.locator(selector).boundingBox();
  if (!box) throw new Error(`Missing ${selector}`);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
};

const getTargetId = (page: Page) =>
  page.evaluate(() => window.__REACT_GRAB__?.getState().targetElement?.id ?? null);

const getBackgroundColor = (page: Page, selector: string) =>
  page.locator(selector).evaluate((element) => getComputedStyle(element).backgroundColor);

const getOpacity = (reactGrab: ReactGrabPageObject, selector: string) =>
  reactGrab
    .getOverlayHost()
    .locator(selector)
    .first()
    .evaluate((element) => Number(getComputedStyle(element).opacity));

const copyFirstTodo = async (reactGrab: ReactGrabPageObject, page: Page) => {
  await reactGrab.hoverUntilSelected(FIRST_TODO_SELECTOR);
  await page.mouse.down();
  await page.mouse.up();
  await expect(reactGrab.getOverlayHost().locator(COMPLETION_SELECTOR)).toContainText("Copied");
  await expect(reactGrab.getOverlayHost().locator(PILL_PROMPT_SELECTOR)).toHaveCount(1);
};

test.describe("Hold Space to pause", () => {
  test.beforeEach(async ({ reactGrab }) => {
    await injectPageFixtures(reactGrab.page);
  });

  test("holding Space hands the page back and letting go resumes at the pointer", async ({
    reactGrab,
    page,
  }) => {
    await reactGrab.activate();
    await reactGrab.hoverUntilSelected(FIRST_TODO_SELECTOR);
    expect(await reactGrab.isSelectionBoxVisible()).toBe(true);

    await page.keyboard.down("Space");
    await expectPaused(reactGrab);
    expect(await reactGrab.isOverlayVisible()).toBe(true);
    await expect.poll(() => reactGrab.isSelectionBoxVisible()).toBe(false);
    await expect(reactGrab.getOverlayHost().locator(LIVE_LABEL_SELECTOR)).toHaveCount(0);
    expect(
      await page.evaluate(() => document.querySelector("style[data-react-grab-cursor]")),
    ).toBeNull();
    expect(await page.evaluate(() => document.body.style.touchAction)).toBe("");

    await moveToCenter(page, "#pause-hover-target");
    await expect.poll(() => getBackgroundColor(page, "#pause-hover-target")).toBe(HOVER_COLOR);
    await expect(reactGrab.getOverlayHost().locator(LIVE_LABEL_SELECTOR)).toHaveCount(0);

    await clickCenter(page, "#pause-link");
    await expect.poll(() => page.evaluate(() => window.location.hash)).toBe("#pause-link-target");
    await clickCenter(page, "#pause-button");
    await expect(page.locator("#pause-button")).toHaveAttribute("data-clicks", "1");

    await page.keyboard.up("Space");
    await expect(getPauseStatus(reactGrab)).toHaveText(RESUMED_ANNOUNCEMENT);
    await expect(getPauseChip(reactGrab)).not.toHaveAttribute("data-visible", "");
    await expect.poll(() => getTargetId(page)).toBe("pause-button");
    await expect.poll(() => reactGrab.isSelectionBoxVisible()).toBe(true);
    expect(
      await page.evaluate(() => Boolean(document.querySelector("style[data-react-grab-cursor]"))),
    ).toBe(true);
    expect(await page.evaluate(() => document.body.style.touchAction)).toBe("none");

    await clickCenter(page, "#pause-button");
    await expect(page.locator("#pause-button")).toHaveAttribute("data-clicks", "1");
  });

  test("the session comes back with its tool and toggles, and stays on throughout", async ({
    reactGrab,
    page,
  }) => {
    await reactGrab.activate();
    await reactGrab.getOverlayHost().locator(SPACING_TOGGLE_SELECTOR).click();
    expect(await reactGrab.getToolbarActionPressed("inspect-redlines")).toBe(true);
    await page.mouse.move(0, 0);
    await reactGrab.setupCallbackTracking();
    await reactGrab.clearCallbackHistory();

    await page.keyboard.down("Space");
    await expectPaused(reactGrab);
    expect(await reactGrab.isOverlayVisible()).toBe(true);
    await page.keyboard.up("Space");
    await expectNotPaused(reactGrab);

    const callbackHistory = await reactGrab.getCallbackHistory();
    expect(
      callbackHistory.filter(
        (callback) => callback.name === "onActivate" || callback.name === "onDeactivate",
      ),
    ).toEqual([]);
    expect(await reactGrab.isOverlayVisible()).toBe(true);
    expect(await reactGrab.getToolbarActionPressed("inspect-redlines")).toBe(true);
    await reactGrab.hoverUntilSelected(FIRST_TODO_SELECTOR);
    expect(await reactGrab.isSelectionBoxVisible()).toBe(true);
  });

  test("toolbar controls work while paused and do not end the pause", async ({
    reactGrab,
    page,
  }) => {
    await reactGrab.activate();
    await page.keyboard.down("Space");
    await expectPaused(reactGrab);

    await reactGrab.getOverlayHost().locator(SPACING_TOGGLE_SELECTOR).click();
    await expect.poll(() => reactGrab.getToolbarActionPressed("inspect-redlines")).toBe(true);
    await expect(getPauseStatus(reactGrab)).toHaveText(PAUSED_ANNOUNCEMENT);
    expect(await reactGrab.isOverlayVisible()).toBe(true);

    await page.mouse.move(0, 0);
    await page.keyboard.up("Space");
    await expectNotPaused(reactGrab);
    expect(await reactGrab.getToolbarActionPressed("inspect-redlines")).toBe(true);
  });

  // Grab already holds back keys typed into a page field while it is on; the
  // pause must leave that field's Space exactly as it was.
  test("Space in a page input does not pause and still reaches the page", async ({
    reactGrab,
    page,
  }) => {
    await reactGrab.activate();
    await page.locator("#pause-input").focus();
    await page.evaluate(() => {
      window.__pageKeyEvents = [];
    });
    await page.keyboard.down("Space");
    await page.keyboard.up("Space");
    expect(await page.evaluate(() => window.__pageKeyEvents)).toEqual([
      "keydown:Space",
      "keyup:Space",
    ]);
    await expect(getPauseStatus(reactGrab)).toHaveText("");
    await expect(getPauseChip(reactGrab)).not.toHaveAttribute("data-visible", "");
    expect(await reactGrab.isOverlayVisible()).toBe(true);
  });

  test("Space types into a pill prompt holding text, and pauses from an empty one", async ({
    reactGrab,
    page,
  }) => {
    await reactGrab.activate();
    await copyFirstTodo(reactGrab, page);
    const pillPrompt = reactGrab.getOverlayHost().locator(PILL_PROMPT_SELECTOR);
    await expect(pillPrompt).toBeFocused();

    await page.keyboard.down("Space");
    await expectPaused(reactGrab);
    await expect(pillPrompt).toHaveValue("");
    await page.keyboard.up("Space");
    await expectNotPaused(reactGrab);

    await pillPrompt.focus();
    await page.keyboard.type("x");
    await page.keyboard.press("Space");
    await expect(pillPrompt).toHaveValue("x ");
    await expect(getPauseStatus(reactGrab)).toHaveText(RESUMED_ANNOUNCEMENT);
  });

  test("Space types a space in a note being written", async ({ reactGrab, page }) => {
    await reactGrab.activate();
    await reactGrab.clickToolbarAction("annotate-text");
    await page.mouse.click(NOTE_POSITION_PX.x, NOTE_POSITION_PX.y);
    const noteInput = reactGrab.getOverlayHost().locator(NOTE_INPUT_SELECTOR);
    await expect(noteInput).toBeFocused();
    await page.keyboard.type("a b");
    await expect(noteInput).toHaveValue("a b");
    await expect(getPauseStatus(reactGrab)).toHaveText("");
  });

  test("Space during a marquee drag keeps repositioning it", async ({ reactGrab, page }) => {
    await reactGrab.activate();
    await page.mouse.move(DRAG_BOX_PAGE_POSITION_PX.x, DRAG_BOX_PAGE_POSITION_PX.y);
    await page.mouse.down();
    await page.mouse.move(DRAG_END_POSITION_PX.x, DRAG_END_POSITION_PX.y, { steps: DRAG_STEPS });
    const originalBounds = await reactGrab.getDragBoxBounds();
    if (!originalBounds) throw new Error("Missing marquee");

    await page.keyboard.down("Space");
    await page.mouse.move(
      DRAG_END_POSITION_PX.x + DRAG_REPOSITION_OFFSET_PX.x,
      DRAG_END_POSITION_PX.y + DRAG_REPOSITION_OFFSET_PX.y,
      { steps: DRAG_STEPS },
    );
    await expect
      .poll(() => reactGrab.getDragBoxBounds())
      .toMatchObject({
        x: originalBounds.x + DRAG_REPOSITION_OFFSET_PX.x,
        y: originalBounds.y + DRAG_REPOSITION_OFFSET_PX.y,
        width: originalBounds.width,
        height: originalBounds.height,
      });
    await expect(getPauseStatus(reactGrab)).toHaveText("");
    await page.keyboard.press("Escape");
    await page.mouse.up();
    await page.keyboard.up("Space");
  });

  test("a held Space neither scrolls the page nor clicks a focused page button", async ({
    reactGrab,
    page,
  }) => {
    await reactGrab.activate();
    await page.locator("#pause-button").focus();
    const scrollBefore = await page.evaluate(() => window.scrollY);
    await page.evaluate(() => {
      window.__pageKeyEvents = [];
    });

    await page.keyboard.down("Space");
    await expectPaused(reactGrab);
    for (let repeatIndex = 0; repeatIndex < SPACE_REPEAT_COUNT; repeatIndex++) {
      await page.keyboard.down("Space");
    }
    await page.waitForTimeout(SCROLL_SETTLE_MS);
    expect(await page.evaluate(() => window.scrollY)).toBe(scrollBefore);
    await page.keyboard.up("Space");
    await page.waitForTimeout(SCROLL_SETTLE_MS);

    expect(await page.evaluate(() => window.scrollY)).toBe(scrollBefore);
    await expect(page.locator("#pause-button")).toHaveAttribute("data-clicks", "0");
    expect(await page.evaluate(() => window.__pageKeyEvents)).toEqual(["keyup:Space"]);
  });

  test("a copied pill stays put, dims, and neither blocks nor dismisses on a page click", async ({
    reactGrab,
    page,
  }) => {
    await reactGrab.activate();
    await copyFirstTodo(reactGrab, page);
    const copiedPill = reactGrab.getOverlayHost().locator(COPIED_PILL_SELECTOR);
    const pillBoxBefore = await copiedPill.boundingBox();

    await page.keyboard.down("Space");
    await expectPaused(reactGrab);
    await expect
      .poll(() => getOpacity(reactGrab, COPIED_PILL_SELECTOR))
      .toBeCloseTo(PAUSED_PAGE_LAYER_OPACITY, 1);
    await clickCenter(page, "#pause-button");
    await expect(page.locator("#pause-button")).toHaveAttribute("data-clicks", "1");
    await expect(copiedPill).toHaveCount(1);
    expect(await copiedPill.boundingBox()).toEqual(pillBoxBefore);

    await page.keyboard.up("Space");
    await expectNotPaused(reactGrab);
    await expect(copiedPill).toHaveCount(1);
    await expect.poll(() => getOpacity(reactGrab, COPIED_PILL_SELECTOR)).toBe(1);
  });

  test("a copied pill's own buttons work while paused", async ({ reactGrab, page }) => {
    await reactGrab.activate();
    await copyFirstTodo(reactGrab, page);
    await page.keyboard.down("Space");
    await expectPaused(reactGrab);

    await reactGrab
      .getOverlayHost()
      .locator(`${COMPLETION_SELECTOR} ${DISMISS_BUTTON_SELECTOR}`)
      .click();
    await expect(reactGrab.getOverlayHost().locator(COPIED_PILL_SELECTOR)).toHaveCount(0);
    await expect(getPauseStatus(reactGrab)).toHaveText(PAUSED_ANNOUNCEMENT);
    await page.keyboard.up("Space");
  });

  test("the Pen lets a click through to the page and draws nothing while paused", async ({
    reactGrab,
    page,
  }) => {
    await reactGrab.activate();
    await reactGrab.clickToolbarAction("annotate-pen");
    await page.keyboard.down("Space");
    await expectPaused(reactGrab);

    await clickCenter(page, "#pause-button");
    const hoverBox = await page.locator("#pause-hover-target").boundingBox();
    if (!hoverBox) throw new Error("Missing hover target");
    await page.mouse.move(hoverBox.x + 4, hoverBox.y + 4);
    await page.mouse.down();
    await page.mouse.move(hoverBox.x + hoverBox.width - 4, hoverBox.y + hoverBox.height - 4, {
      steps: DRAG_STEPS,
    });
    await page.mouse.up();

    await expect(page.locator("#pause-button")).toHaveAttribute("data-clicks", "1");
    await expect(reactGrab.getOverlayHost().locator(STROKE_SELECTOR)).toHaveCount(0);
    await page.keyboard.up("Space");
    await expectNotPaused(reactGrab);
    expect(await reactGrab.getToolbarActionPressed("annotate-pen")).toBe(true);
  });

  test("Escape while paused is the page's Escape and keeps Grab on", async ({
    reactGrab,
    page,
  }) => {
    await reactGrab.activate();
    await page.keyboard.down("Space");
    await expectPaused(reactGrab);
    await page.evaluate(() => {
      window.__pageKeyEvents = [];
    });
    await page.keyboard.press("Escape");
    expect(await page.evaluate(() => window.__pageKeyEvents)).toEqual([
      "keydown:Escape",
      "keyup:Escape",
    ]);
    expect(await reactGrab.isOverlayVisible()).toBe(true);
    await page.keyboard.up("Space");
  });

  test("the window losing focus ends the pause", async ({ reactGrab, page }) => {
    await reactGrab.activate();
    await page.keyboard.down("Space");
    await expectPaused(reactGrab);

    await page.evaluate(() => window.dispatchEvent(new FocusEvent("blur")));

    await expect(getPauseStatus(reactGrab)).toHaveText(RESUMED_ANNOUNCEMENT);
    await expect(getPauseChip(reactGrab)).not.toHaveAttribute("data-visible", "");
    expect(await reactGrab.isOverlayVisible()).toBe(true);
    await reactGrab.hoverUntilSelected(FIRST_TODO_SELECTOR);
    expect(await reactGrab.isSelectionBoxVisible()).toBe(true);
    await page.keyboard.up("Space");
  });

  test("deactivating while paused does not freeze the page again on the way out", async ({
    reactGrab,
    page,
  }) => {
    await reactGrab.activate();
    await page.keyboard.down("Space");
    await expectPaused(reactGrab);
    await page.evaluate(() => {
      window.__bodyStyleHistory = [];
      new MutationObserver((records) => {
        for (const record of records) window.__bodyStyleHistory?.push(record.oldValue);
      }).observe(document.body, {
        attributes: true,
        attributeFilter: ["style"],
        attributeOldValue: true,
      });
    });

    await page.keyboard.down(reactGrab.modifierKey);
    await page.keyboard.press("c");
    await page.keyboard.up(reactGrab.modifierKey);
    await expect.poll(() => reactGrab.isOverlayVisible()).toBe(false);
    await page.keyboard.up("Space");

    const bodyStyleHistory = await page.evaluate(() => window.__bodyStyleHistory ?? []);
    expect(bodyStyleHistory.filter((styleText) => styleText?.includes("touch-action"))).toEqual([]);
    expect(await page.evaluate(() => document.body.style.touchAction)).toBe("");
  });

  test("rapid Space taps leave the session intercepting and announce each change once", async ({
    reactGrab,
    page,
  }) => {
    await reactGrab.activate();
    await page.evaluate((statusSelector) => {
      window.__pauseAnnouncements = [];
      const status = document
        .querySelector("[data-react-grab]")
        ?.shadowRoot?.querySelector(statusSelector);
      if (!status) throw new Error("Missing pause status");
      new MutationObserver((records) => {
        for (const record of records) {
          if (record.type === "characterData" || record.addedNodes.length > 0) {
            window.__pauseAnnouncements?.push(status.textContent ?? "");
          }
        }
      }).observe(status, { childList: true, characterData: true, subtree: true });
    }, PAUSE_STATUS_SELECTOR);

    for (let tapIndex = 0; tapIndex < RAPID_TAP_COUNT; tapIndex++) {
      await page.keyboard.press("Space");
    }

    await expect(getPauseStatus(reactGrab)).toHaveText(RESUMED_ANNOUNCEMENT);
    await expect(getPauseChip(reactGrab)).not.toHaveAttribute("data-visible", "");
    const announcements = await page.evaluate(() => window.__pauseAnnouncements ?? []);
    expect(announcements.length).toBeGreaterThanOrEqual(2);
    expect(announcements.length).toBeLessThanOrEqual(RAPID_TAP_COUNT * 2);
    expect(
      announcements.every(
        (announcement, announcementIndex) =>
          announcementIndex === 0 || announcement !== announcements[announcementIndex - 1],
      ),
    ).toBe(true);
    expect(announcements.at(-1)).toBe(RESUMED_ANNOUNCEMENT);
    expect(await page.evaluate(() => document.body.style.touchAction)).toBe("none");
    expect(
      await page.evaluate(() => Boolean(document.querySelector("style[data-react-grab-cursor]"))),
    ).toBe(true);
    await reactGrab.hoverUntilSelected(FIRST_TODO_SELECTOR);
    expect(await reactGrab.isSelectionBoxVisible()).toBe(true);
  });

  test("wheel, context menu, drag and text selection reach the page while paused", async ({
    reactGrab,
    page,
  }) => {
    await page.evaluate(() => {
      const draggable = document.createElement("div");
      draggable.id = "pause-draggable";
      draggable.draggable = true;
      draggable.textContent = "Drag me";
      const selectable = document.createElement("p");
      selectable.id = "pause-selectable";
      selectable.textContent = "Selectable page text for the pause";
      document.getElementById("pause-button")?.parentElement?.append(draggable, selectable);
      window.__pagePointerEvents = [];
      for (const eventName of ["wheel", "contextmenu", "dragstart", "selectstart"]) {
        window.addEventListener(eventName, (event) => {
          window.__pagePointerEvents?.push(`${event.type}:${event.defaultPrevented}`);
          if (event.type === "contextmenu" || event.type === "dragstart") event.preventDefault();
        });
      }
    });
    await reactGrab.activate();
    await page.keyboard.down("Space");
    await expectPaused(reactGrab);

    await moveToCenter(page, "#pause-hover-target");
    await page.mouse.wheel(0, 40);
    await page.mouse.click(...(await getCenter(page, "#pause-hover-target")), { button: "right" });
    const selectableBox = await page.locator("#pause-selectable").boundingBox();
    if (!selectableBox) throw new Error("Missing selectable text");
    await page.mouse.move(selectableBox.x + 2, selectableBox.y + selectableBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(
      selectableBox.x + selectableBox.width - 2,
      selectableBox.y + selectableBox.height / 2,
      {
        steps: DRAG_STEPS,
      },
    );
    await page.mouse.up();
    await moveToCenter(page, "#pause-draggable");
    await page.mouse.down();
    const draggableBox = await page.locator("#pause-draggable").boundingBox();
    if (!draggableBox) throw new Error("Missing draggable");
    await page.mouse.move(draggableBox.x + 80, draggableBox.y + 60, { steps: DRAG_STEPS });
    await page.mouse.up();

    await expect
      .poll(() => page.evaluate(() => [...new Set(window.__pagePointerEvents)]))
      .toEqual(
        expect.arrayContaining([
          "wheel:false",
          "contextmenu:false",
          "selectstart:false",
          "dragstart:false",
        ]),
      );
    await page.keyboard.up("Space");
  });

  test("the activation shortcut while paused switches Grab off and ends the pause", async ({
    reactGrab,
    page,
  }) => {
    await reactGrab.activate();
    await page.keyboard.down("Space");
    await expectPaused(reactGrab);

    await page.keyboard.down(reactGrab.modifierKey);
    await page.keyboard.press("c");
    await page.keyboard.up(reactGrab.modifierKey);

    await expect.poll(() => reactGrab.isOverlayVisible()).toBe(false);
    await expect(getPauseChip(reactGrab)).not.toHaveAttribute("data-visible", "");
    await expect(getPauseStatus(reactGrab)).not.toHaveText(PAUSED_ANNOUNCEMENT);
    await page.keyboard.up("Space");
    expect(await reactGrab.isOverlayVisible()).toBe(false);
  });

  test("the toolbar steps back with a status chip above it while paused", async ({
    reactGrab,
    page,
  }) => {
    await reactGrab.activate();
    await page.mouse.move(0, 0);
    const toolbar = reactGrab.getOverlayHost().locator(TOOLBAR_SELECTOR);
    const status = reactGrab.getOverlayHost().getByRole("status");
    await expect(status).toHaveAttribute("aria-live", "polite");
    await expect(status).toHaveText("");

    await page.keyboard.down("Space");
    await expect(status).toHaveText(PAUSED_ANNOUNCEMENT);
    const chip = getPauseChip(reactGrab);
    await expect(chip).toHaveAttribute("data-visible", "");
    await expect(chip).toContainText("Paused");
    await expect(chip).toContainText("Space");
    await expect(toolbar).toHaveAttribute("data-react-grab-toolbar-paused", "");
    await expect
      .poll(() => toolbar.evaluate((element) => Number(getComputedStyle(element).opacity)))
      .toBeCloseTo(TOOLBAR_PAUSED_OPACITY, 2);
    await expect
      .poll(() => toolbar.evaluate((element) => getComputedStyle(element).filter))
      .toBe("saturate(0)");
    await expect
      .poll(() => chip.evaluate((element) => getComputedStyle(element).opacity))
      .toBe("1");
    const toolbarBox = await toolbar.boundingBox();
    const chipBox = await chip.boundingBox();
    if (!toolbarBox || !chipBox) throw new Error("Missing toolbar or chip");
    expect(chipBox.y + chipBox.height).toBeLessThanOrEqual(toolbarBox.y);

    await page.keyboard.up("Space");
    await expect(status).toHaveText(RESUMED_ANNOUNCEMENT);
    await expect(chip).not.toHaveAttribute("data-visible", "");
    await expect(toolbar).not.toHaveAttribute("data-react-grab-toolbar-paused", "");
    await expect
      .poll(() => chip.evaluate((element) => getComputedStyle(element).opacity))
      .toBe("0");
  });

  test("drawings dim while paused", async ({ reactGrab, page }) => {
    await reactGrab.activate();
    await reactGrab.clickToolbarAction("annotate-pen");
    await page.mouse.move(DRAG_BOX_PAGE_POSITION_PX.x, DRAG_BOX_PAGE_POSITION_PX.y);
    await page.mouse.down();
    await page.mouse.move(DRAG_END_POSITION_PX.x, DRAG_END_POSITION_PX.y, { steps: DRAG_STEPS });
    await page.mouse.up();
    await expect(reactGrab.getOverlayHost().locator(STROKE_SELECTOR)).toHaveCount(1);

    await page.keyboard.down("Space");
    await expectPaused(reactGrab);
    await expect
      .poll(() => getOpacity(reactGrab, "[data-react-grab-annotations]"))
      .toBeCloseTo(PAUSED_PAGE_LAYER_OPACITY, 1);
    await page.keyboard.up("Space");
    await expect.poll(() => getOpacity(reactGrab, "[data-react-grab-annotations]")).toBe(1);
    await expect(reactGrab.getOverlayHost().locator(STROKE_SELECTOR)).toHaveCount(1);
  });

  test("reduced motion steps back by opacity alone", async ({ reactGrab, page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await reactGrab.activate();
    await page.mouse.move(0, 0);
    const toolbar = reactGrab.getOverlayHost().locator(TOOLBAR_SELECTOR);
    const transformBefore = await toolbar.evaluate((element) => element.style.transform);

    await page.keyboard.down("Space");
    await expectPaused(reactGrab);
    await expect
      .poll(() => toolbar.evaluate((element) => Number(getComputedStyle(element).opacity)))
      .toBeCloseTo(TOOLBAR_PAUSED_OPACITY, 2);
    expect(await toolbar.evaluate((element) => getComputedStyle(element).scale)).toBe("none");
    expect(await toolbar.evaluate((element) => element.style.transform)).toBe(transformBefore);
    expect(
      await getPauseChip(reactGrab).evaluate((element) => getComputedStyle(element).transform),
    ).toBe("none");

    await page.keyboard.up("Space");
    await expectNotPaused(reactGrab);
    expect(await toolbar.evaluate((element) => getComputedStyle(element).animationName)).toBe(
      "none",
    );
  });

  test("a selected drawing and its handles let clicks through to the page while paused", async ({
    reactGrab,
    page,
  }) => {
    await reactGrab.activate();
    const buttonBox = await page.locator("#pause-button").boundingBox();
    if (!buttonBox) throw new Error("Missing page button");
    const rectangleCorner = {
      x: buttonBox.x + RECTANGLE_INSET_PX,
      y: buttonBox.y + RECTANGLE_INSET_PX / 2,
    };
    const outlineOverButton = { x: rectangleCorner.x, y: buttonBox.y + buttonBox.height - 4 };
    await reactGrab.clickToolbarAction("annotate-rectangle");
    await page.mouse.move(rectangleCorner.x, rectangleCorner.y);
    await page.mouse.down();
    await page.mouse.move(
      buttonBox.x + buttonBox.width + RECTANGLE_OVERHANG_PX,
      buttonBox.y + buttonBox.height + RECTANGLE_OVERHANG_PX,
      { steps: DRAG_STEPS },
    );
    await page.mouse.up();
    await expect(reactGrab.getOverlayHost().locator(STROKE_SELECTOR)).toHaveCount(1);
    await reactGrab.clickToolbarAction("annotate-edit");
    await page.mouse.click(outlineOverButton.x, outlineOverButton.y);
    await expect(reactGrab.getOverlayHost().locator(ANNOTATION_SELECTION_SELECTOR)).toHaveCount(1);
    await expect(page.locator("#pause-button")).toHaveAttribute("data-clicks", "0");

    await page.keyboard.down("Space");
    await expectPaused(reactGrab);
    await expect(reactGrab.getOverlayHost().locator(ANNOTATION_FRAME_SELECTOR)).toHaveCSS(
      "visibility",
      "hidden",
    );
    await page.mouse.click(rectangleCorner.x, rectangleCorner.y);
    await page.mouse.click(outlineOverButton.x, outlineOverButton.y);
    await expect(page.locator("#pause-button")).toHaveAttribute("data-clicks", "2");

    await page.keyboard.up("Space");
    await expectNotPaused(reactGrab);
    await expect(reactGrab.getOverlayHost().locator(ANNOTATION_FRAME_SELECTOR)).toHaveCSS(
      "visibility",
      "visible",
    );
    await expect(reactGrab.getOverlayHost().locator(ANNOTATION_SELECTION_SELECTOR)).toHaveCount(1);
  });

  test("a Shift selection released while paused copies on resume, not during the pause", async ({
    reactGrab,
    page,
  }) => {
    await reactGrab.activate();
    await page.evaluate(() => navigator.clipboard.writeText(""));
    await page.keyboard.down("Shift");
    await reactGrab.clickElement(FIRST_TODO_SELECTOR);
    await reactGrab.clickElement(SECOND_TODO_SELECTOR);
    await page.keyboard.down("Space");
    await expectPaused(reactGrab);
    await page.keyboard.up("Shift");
    await page.waitForTimeout(NO_COPY_SETTLE_MS);
    expect(await reactGrab.getClipboardContent()).toBe("");
    await expect(reactGrab.getOverlayHost().locator(COMPLETION_SELECTOR)).toHaveCount(0);

    await page.keyboard.up("Space");
    await expect.poll(() => reactGrab.getClipboardContent()).toContain("TodoItem");
  });

  test("a Shift selection released while paused is dropped if Grab switches off", async ({
    reactGrab,
    page,
  }) => {
    await reactGrab.activate();
    await page.evaluate(() => navigator.clipboard.writeText(""));
    await page.keyboard.down("Shift");
    await reactGrab.clickElement(FIRST_TODO_SELECTOR);
    await reactGrab.clickElement(SECOND_TODO_SELECTOR);
    await page.keyboard.down("Space");
    await expectPaused(reactGrab);
    await page.keyboard.up("Shift");
    await page.keyboard.down(reactGrab.modifierKey);
    await page.keyboard.press("c");
    await page.keyboard.up(reactGrab.modifierKey);
    await expect.poll(() => reactGrab.isOverlayVisible()).toBe(false);
    await page.keyboard.up("Space");
    await page.waitForTimeout(NO_COPY_SETTLE_MS);
    expect(await reactGrab.getClipboardContent()).toBe("");
  });

  test("pausing from the pill prompt hands Escape to the page and keeps the pill", async ({
    reactGrab,
    page,
  }) => {
    await reactGrab.activate();
    await copyFirstTodo(reactGrab, page);
    const pillPrompt = reactGrab.getOverlayHost().locator(PILL_PROMPT_SELECTOR);
    await expect(pillPrompt).toBeFocused();

    await page.keyboard.down("Space");
    await expectPaused(reactGrab);
    await expect(pillPrompt).not.toBeFocused();
    await page.evaluate(() => {
      window.__pageKeyEvents = [];
    });
    await page.keyboard.press("Escape");
    expect(await page.evaluate(() => window.__pageKeyEvents)).toEqual([
      "keydown:Escape",
      "keyup:Escape",
    ]);
    await expect(reactGrab.getOverlayHost().locator(COPIED_PILL_SELECTOR)).toHaveCount(1);
    await page.keyboard.up("Space");
  });

  test("resuming after arrow navigation follows the pointer", async ({ reactGrab, page }) => {
    await reactGrab.activate();
    await reactGrab.hoverUntilSelected("[data-testid='todo-list'] li:first-child");
    await reactGrab.pressArrowUp();
    await expect
      .poll(() =>
        page.evaluate(() => window.__REACT_GRAB__?.getState().targetElement?.tagName ?? null),
      )
      .not.toBe("LI");

    await page.keyboard.down("Space");
    await expectPaused(reactGrab);
    await moveToCenter(page, "#pause-button");
    await page.keyboard.up("Space");
    await expectNotPaused(reactGrab);
    await expect.poll(() => getTargetId(page)).toBe("pause-button");
  });

  test.describe("with a same-origin frame", () => {
    const getFrame = (page: Page) => page.frameLocator(FRAME_SELECTOR);

    test.beforeEach(async ({ page }) => {
      await getFrame(page)
        .locator(FRAME_TARGET_SELECTOR)
        .evaluate((frameTarget, inputId) => {
          frameTarget.setAttribute("data-clicks", "0");
          frameTarget.addEventListener("click", () => {
            frameTarget.setAttribute(
              "data-clicks",
              String(Number(frameTarget.getAttribute("data-clicks")) + 1),
            );
          });
          const frameInput = frameTarget.ownerDocument.createElement("input");
          frameInput.id = inputId;
          frameTarget.after(frameInput);
        }, FRAME_INPUT_ID);
      await page.locator(FRAME_SELECTOR).scrollIntoViewIfNeeded();
    });

    test("a click inside the frame reaches it, keeps the pause, and its Space release resumes", async ({
      reactGrab,
      page,
    }) => {
      await reactGrab.activate();
      await page.keyboard.down("Space");
      await expectPaused(reactGrab);

      const frameTarget = getFrame(page).locator(FRAME_TARGET_SELECTOR);
      await frameTarget.click();
      await expect(frameTarget).toHaveAttribute("data-clicks", "1");
      await expect(frameTarget).toBeFocused();
      await expect(getPauseStatus(reactGrab)).toHaveText(PAUSED_ANNOUNCEMENT);

      await page.keyboard.up("Space");
      await expect(getPauseStatus(reactGrab)).toHaveText(RESUMED_ANNOUNCEMENT);
      await expect(frameTarget).toHaveAttribute("data-clicks", "1");
    });

    test("Space from a focused frame control pauses and its release resumes", async ({
      reactGrab,
      page,
    }) => {
      await reactGrab.activate();
      const frameTarget = getFrame(page).locator(FRAME_TARGET_SELECTOR);
      await frameTarget.focus();

      await page.keyboard.down("Space");
      await expectPaused(reactGrab);
      await page.keyboard.up("Space");
      await expectNotPaused(reactGrab);
      await expect(frameTarget).toHaveAttribute("data-clicks", "0");
    });

    test("Space in a text field inside the frame does not pause", async ({ reactGrab, page }) => {
      await reactGrab.activate();
      await getFrame(page).locator(`#${FRAME_INPUT_ID}`).focus();

      await page.keyboard.down("Space");
      await page.keyboard.up("Space");
      await expect(getPauseStatus(reactGrab)).toHaveText("");
      await expect(getPauseChip(reactGrab)).not.toHaveAttribute("data-visible", "");
    });

    test("the window losing focus from inside the frame ends the pause", async ({
      reactGrab,
      page,
    }) => {
      await reactGrab.activate();
      await page.keyboard.down("Space");
      await expectPaused(reactGrab);
      const frameTarget = getFrame(page).locator(FRAME_TARGET_SELECTOR);
      await frameTarget.click();
      await expect(getPauseStatus(reactGrab)).toHaveText(PAUSED_ANNOUNCEMENT);

      await frameTarget.evaluate((element) =>
        element.ownerDocument.defaultView?.dispatchEvent(new FocusEvent("blur")),
      );
      await expect(getPauseStatus(reactGrab)).toHaveText(RESUMED_ANNOUNCEMENT);
      await page.keyboard.up("Space");
    });
  });
});
