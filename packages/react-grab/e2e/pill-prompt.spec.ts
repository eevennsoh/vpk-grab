// A text copy's Copied pill carries a prompt input: Enter with text copies the
// same elements again with the prompt, as prompt mode would.
import type { Page } from "@playwright/test";
import { test, expect, type ReactGrabPageObject } from "./fixtures.js";
import {
  KEYBOARD_ACTIVATION_SETTLE_DELAY_MS,
  PILL_DISMISS_PARENT_RECT_PX,
  PILL_DISMISS_TARGET_HEIGHT_PX,
  PILL_DISMISS_Z_INDEX,
  PILL_MODIFIER_RELEASE_DELAY_MS,
  SCREENSHOT_TOOLBAR_VISIBLE_TIMEOUT_MS,
  SHIFT_LABEL_SETTLE_DELAY_MS,
} from "./constants.js";
import {
  controlImageEncoding,
  getCopyEventCount,
  getImageWrites,
  getPendingImageEncodingCount,
  getSettledClipboardWriteCount,
  getUnhandledRejections,
  installClipboardRecorder,
  openImageEncodingGate,
} from "./screenshot-fixture.js";
import { AWAY_POSITION, PINNED_PANEL_SELECTOR, switchOnSpecs } from "./specs-panel-fixture.js";

const FIRST_TODO_SELECTOR = "[data-testid='todo-list'] li:first-child span";
const SECOND_TODO_SELECTOR = "[data-testid='todo-list'] li:nth-child(2) span";
const TODO_HEADING_SELECTOR = "[data-testid='todo-list'] h1";
const COMPLETION_SELECTOR = "[data-react-grab-completion]";
const LIVE_LABEL_SELECTOR =
  "[data-react-grab-selection-label]:not([data-react-grab-label-instance])";
const PILL_PROMPT_SELECTOR = "[data-react-grab-pill-prompt] textarea";
const CAMERA_BUTTON_SELECTOR = "[data-react-grab-copy-screenshot]";
const DISMISS_BUTTON_SELECTOR = 'button[aria-label="Dismiss"]';
const MORE_OPTIONS_SELECTOR = "[data-react-grab-more-options]";
const ERROR_SELECTOR = "[data-react-grab-error]";
const RETRY_SELECTOR = "[data-react-grab-retry]";
const SPECS_TOGGLE_SELECTOR = '[data-react-grab-toolbar-action="inspect-specs"]';
const SPACING_TOGGLE_SELECTOR = '[data-react-grab-toolbar-action="inspect-redlines"]';
const MEASURE_TARGET_SELECTOR = "[data-react-grab-redline-target]";
const CAPTURING_SELECTOR = "[data-react-grab-screenshot-capturing]";
const THUMBNAIL_SELECTOR = "[data-react-grab-screenshot-thumbnail]";
const AUTO_SCREENSHOT_TOGGLE_SELECTOR = '[data-react-grab-toolbar-action="auto-screenshot"]';
const INNER_HTML_TOKEN_SELECTOR = ".inner-html-token";
const PAGE_INPUT_ID = "pill-prompt-page-input";
const SHORT_PROMPT_TEXT = "make this a bit wider";
const PLACEHOLDER_SLACK_PX = 2;
const SINGLE_LINE_HEIGHT_PX = 16;
const PILL_MAX_WIDTH_PX = 280;
const PILL_WITH_THUMBNAIL_MAX_WIDTH_PX = 300;
const REACT_GRAB_MIME_TYPE = "application/x-react-grab";
const HELD_ACTIVATION_KEY = "F8";
const PROMPT_TEXT = "make this blue";
const LONG_PROMPT_TEXT = "make this button blue and give it a little more room on both sides";
const EDGE_TARGET_ID = "pill-prompt-edge-target";
const EDGE_TARGET_WIDTH_PX = 60;
const SAME_ORIGIN_IFRAME_SELECTOR = "[data-testid='same-origin-iframe']";
const IFRAME_TARGET_SELECTOR = "[data-testid='iframe-target']";
const NO_SECOND_COPY_WAIT_MS = 500;
const CAPTURE_START = { x: 250, y: 280 };
const CAPTURE_END = { x: 610, y: 380 };
const DRAG_STEPS = 8;

interface ReactGrabClipboardMetadata {
  content: string;
  entries: Array<{ commentText?: string; content: string }>;
}

const getCompletion = (reactGrab: ReactGrabPageObject) =>
  reactGrab.getOverlayHost().locator(COMPLETION_SELECTOR);

const getPillPrompt = (reactGrab: ReactGrabPageObject) =>
  reactGrab.getOverlayHost().locator(PILL_PROMPT_SELECTOR);

const isPillPromptFocused = (page: Page) =>
  page.evaluate(() => {
    const shadowRoot = document.querySelector("[data-react-grab]")?.shadowRoot;
    return Boolean(shadowRoot?.activeElement?.closest("[data-react-grab-pill-prompt]"));
  });

const isFocusInOverlay = (page: Page) =>
  page.evaluate(() => {
    const shadowRoot = document.querySelector("[data-react-grab]")?.shadowRoot;
    return Boolean(shadowRoot?.activeElement);
  });

const isReactGrabActive = (page: Page) =>
  page.evaluate(() => window.__REACT_GRAB__?.isActive() ?? false);

const readMetadata = (clipboardWrites: Record<string, string>): ReactGrabClipboardMetadata => {
  const metadata: ReactGrabClipboardMetadata & { timestamp?: number } = JSON.parse(
    clipboardWrites[REACT_GRAB_MIME_TYPE],
  );
  return { content: metadata.content, entries: metadata.entries };
};

const clickCopy = async (reactGrab: ReactGrabPageObject, page: Page, selector: string) => {
  await reactGrab.hoverUntilSelected(selector);
  const waitForClipboardWrites = await reactGrab.captureNextClipboardWrites();
  await page.mouse.down();
  await page.mouse.up();
  const clipboardWrites = await waitForClipboardWrites();
  await expect(getCompletion(reactGrab)).toContainText("Copied");
  await expect(getPillPrompt(reactGrab)).toHaveCount(1);
  return clipboardWrites;
};

const submitPillPrompt = async (reactGrab: ReactGrabPageObject, page: Page, prompt: string) => {
  await page.keyboard.type(prompt);
  const waitForClipboardWrites = await reactGrab.captureNextClipboardWrites();
  await page.keyboard.press("Enter");
  const clipboardWrites = await waitForClipboardWrites();
  await expect(getCompletion(reactGrab).filter({ hasText: "Copied with prompt" })).toHaveCount(1);
  await expect(getCompletion(reactGrab).getByRole("button").last()).toHaveAccessibleName("Dismiss");
  return clipboardWrites;
};

const getLiveLabels = (reactGrab: ReactGrabPageObject) =>
  reactGrab.getOverlayHost().locator(LIVE_LABEL_SELECTOR);

const getFocusState = (page: Page) =>
  page.evaluate(() => {
    const shadowRoot = document.querySelector("[data-react-grab]")?.shadowRoot;
    const activeElement = document.activeElement;
    return {
      hasOverlayFocus: Boolean(shadowRoot?.activeElement),
      pageFocus: activeElement === document.body ? "body" : (activeElement?.id ?? null),
    };
  });

const getSelectionTargetText = (page: Page) =>
  page.evaluate(() => window.__REACT_GRAB__?.getState().targetElement?.textContent?.trim());

const tapActivationShortcut = async (reactGrab: ReactGrabPageObject, page: Page) => {
  await page.waitForTimeout(PILL_MODIFIER_RELEASE_DELAY_MS);
  await page.keyboard.down(reactGrab.modifierKey);
  await page.keyboard.press("c");
  await page.keyboard.up(reactGrab.modifierKey);
};

const measurePillPrompt = (reactGrab: ReactGrabPageObject) =>
  getCompletion(reactGrab).evaluate((completion) => {
    const promptContainer = completion.querySelector<HTMLElement>("[data-react-grab-pill-prompt]");
    const textarea = promptContainer?.querySelector("textarea");
    if (!promptContainer || !textarea) throw new Error("No pill prompt");
    const textareaStyle = getComputedStyle(textarea);
    const measuringContext = document.createElement("canvas").getContext("2d");
    if (!measuringContext) throw new Error("No canvas context");
    measuringContext.font = textareaStyle.font;
    const statusText = promptContainer.previousElementSibling;
    return {
      isStatusTextClipped: Boolean(statusText && statusText.scrollWidth > statusText.clientWidth),
      pillWidth: completion.getBoundingClientRect().width,
      promptWidth: promptContainer.getBoundingClientRect().width,
      textareaHeight: textarea.getBoundingClientRect().height,
      placeholderWidth: measuringContext.measureText(textarea.placeholder).width,
    };
  });

const addEdgeTarget = (page: Page) =>
  page.evaluate(
    ({ edgeTargetId, edgeTargetWidth }) => {
      const edgeTarget = document.createElement("button");
      edgeTarget.id = edgeTargetId;
      edgeTarget.textContent = "Edge";
      Object.assign(edgeTarget.style, {
        position: "fixed",
        right: "2px",
        top: "320px",
        width: `${edgeTargetWidth}px`,
        height: "30px",
        zIndex: "2147483000",
      });
      document.body.append(edgeTarget);
    },
    { edgeTargetId: EDGE_TARGET_ID, edgeTargetWidth: EDGE_TARGET_WIDTH_PX },
  );

const switchOnScreenshotToggle = async (page: Page) => {
  const screenshotToggle = page.locator(AUTO_SCREENSHOT_TOGGLE_SELECTOR);
  await screenshotToggle.click();
  await expect(screenshotToggle).toHaveAttribute("aria-pressed", "true");
  await page.mouse.move(AWAY_POSITION.x, AWAY_POSITION.y);
};

const getPillAnchor = (reactGrab: ReactGrabPageObject) =>
  getCompletion(reactGrab).evaluate((completion) => {
    const label = completion.closest<HTMLElement>("[data-react-grab-selection-label]");
    return { label, left: label?.style.left, top: label?.style.top };
  });

test.describe("Copied pill prompt", () => {
  test.beforeEach(async ({ reactGrab }) => {
    await expect
      .poll(() => reactGrab.isToolbarVisible(), { timeout: SCREENSHOT_TOOLBAR_VISIBLE_TIMEOUT_MS })
      .toBe(true);
  });

  test("Enter with text copies again with the prompt, as prompt mode does", async ({
    reactGrab,
    page,
  }) => {
    await reactGrab.enterPromptMode(FIRST_TODO_SELECTOR);
    await reactGrab.typeInInput(PROMPT_TEXT);
    const waitForClipboardWrites = await reactGrab.captureNextClipboardWrites();
    await reactGrab.submitInput();
    const promptModeWrites = await waitForClipboardWrites();
    await expect(getCompletion(reactGrab)).toContainText("Copied");
    await expect(
      reactGrab.getOverlayHost().getByRole("button", { name: "More options", exact: true }),
    ).toHaveCount(0);
    expect(promptModeWrites["text/plain"]).toContain(PROMPT_TEXT);

    const clickWrites = await clickCopy(reactGrab, page, FIRST_TODO_SELECTOR);
    expect(clickWrites["text/plain"]).not.toContain(PROMPT_TEXT);
    expect(promptModeWrites["text/plain"]).toBe(`${PROMPT_TEXT}\n${clickWrites["text/plain"]}`);
    expect(await isPillPromptFocused(page)).toBe(true);

    const pillPromptWrites = await submitPillPrompt(reactGrab, page, PROMPT_TEXT);

    expect(pillPromptWrites["text/plain"]).toBe(promptModeWrites["text/plain"]);
    expect(pillPromptWrites["text/html"]).toBe(promptModeWrites["text/html"]);
    expect(readMetadata(pillPromptWrites)).toEqual(readMetadata(promptModeWrites));
    expect(readMetadata(pillPromptWrites).entries[0]?.commentText).toBe(PROMPT_TEXT);
    const completion = getCompletion(reactGrab);
    await expect(completion).toHaveCount(1);
    await expect(getPillPrompt(reactGrab)).toHaveCount(0);
    await expect(completion.locator(CAMERA_BUTTON_SELECTOR)).toHaveCount(1);
    await expect(completion.locator(MORE_OPTIONS_SELECTOR)).toHaveCount(0);
    expect(await isReactGrabActive(page)).toBe(true);
    expect(await isFocusInOverlay(page)).toBe(false);
  });

  test("the same pill stays on its anchor while the prompt is copied", async ({
    reactGrab,
    page,
  }) => {
    await reactGrab.activate();
    await clickCopy(reactGrab, page, FIRST_TODO_SELECTOR);
    await page.evaluate(() => {
      const shadowRoot = document.querySelector("[data-react-grab]")?.shadowRoot;
      const pillLabel = shadowRoot
        ?.querySelector("[data-react-grab-completion]")
        ?.closest("[data-react-grab-selection-label]");
      Reflect.set(window, "__pillLabelBeforePrompt", pillLabel);
    });
    const anchorBefore = await getPillAnchor(reactGrab);

    await submitPillPrompt(reactGrab, page, PROMPT_TEXT);

    const anchorAfter = await getPillAnchor(reactGrab);
    expect({ left: anchorAfter.left, top: anchorAfter.top }).toEqual({
      left: anchorBefore.left,
      top: anchorBefore.top,
    });
    const isSameLabel = await page.evaluate(() => {
      const shadowRoot = document.querySelector("[data-react-grab]")?.shadowRoot;
      const pillLabel = shadowRoot
        ?.querySelector("[data-react-grab-completion]")
        ?.closest("[data-react-grab-selection-label]");
      return pillLabel === Reflect.get(window, "__pillLabelBeforePrompt");
    });
    expect(isSameLabel).toBe(true);
  });

  test("Dismiss restores page focus and the hover label without copying or switching Grab off", async ({
    reactGrab,
    page,
  }) => {
    await page.evaluate(
      ({ parentRect, targetHeight, pageInputId, zIndex }) => {
        const parent = document.createElement("article");
        parent.id = "pill-dismiss-parent";
        Object.assign(parent.style, {
          position: "fixed",
          left: `${parentRect.x}px`,
          top: `${parentRect.y}px`,
          width: `${parentRect.width}px`,
          height: `${parentRect.height}px`,
          zIndex,
        });
        const target = document.createElement("button");
        target.id = "pill-dismiss-target";
        target.textContent = "Dismiss target";
        target.style.height = `${targetHeight}px`;
        parent.append(target);
        const pageInput = document.createElement("input");
        pageInput.id = pageInputId;
        document.body.append(parent, pageInput);
        pageInput.focus({ preventScroll: true });
      },
      {
        parentRect: PILL_DISMISS_PARENT_RECT_PX,
        targetHeight: PILL_DISMISS_TARGET_HEIGHT_PX,
        pageInputId: PAGE_INPUT_ID,
        zIndex: PILL_DISMISS_Z_INDEX,
      },
    );
    await installClipboardRecorder(page);
    await reactGrab.activate();
    const clipboardWrites = await clickCopy(reactGrab, page, "#pill-dismiss-target");
    await expect(getCompletion(reactGrab).getByRole("button").last()).toHaveAccessibleName(
      "Dismiss",
    );

    await getCompletion(reactGrab).locator(DISMISS_BUTTON_SELECTOR).click();

    await expect(getCompletion(reactGrab)).toHaveCount(0);
    expect(await isReactGrabActive(page)).toBe(true);
    await expect(getLiveLabels(reactGrab)).toHaveCount(1);
    await expect
      .poll(() => page.evaluate(() => window.__REACT_GRAB__?.getState().targetElement?.id))
      .toBe("pill-dismiss-parent");
    expect(await getFocusState(page)).toEqual({ hasOverlayFocus: false, pageFocus: PAGE_INPUT_ID });
    expect(await getCopyEventCount(page)).toBe(1);
    expect(await reactGrab.getClipboardContent()).toBe(clipboardWrites["text/plain"]);
  });

  test("Enter activates the focused Dismiss button without another copy", async ({
    reactGrab,
    page,
  }) => {
    await installClipboardRecorder(page);
    await reactGrab.activate();
    await clickCopy(reactGrab, page, FIRST_TODO_SELECTOR);
    await getCompletion(reactGrab).locator(DISMISS_BUTTON_SELECTOR).focus();

    await page.keyboard.press("Enter");

    await expect(getCompletion(reactGrab)).toHaveCount(0);
    expect(await getCopyEventCount(page)).toBe(1);
    expect(await isReactGrabActive(page)).toBe(true);
    await expect(getLiveLabels(reactGrab)).toHaveCount(1);
  });

  test("Dismiss leaves a released hold session off", async ({ reactGrab, page }) => {
    await reactGrab.updateOptions({ activationMode: "hold", activationKey: HELD_ACTIVATION_KEY });
    await page.keyboard.down(HELD_ACTIVATION_KEY);
    try {
      await expect.poll(() => isReactGrabActive(page)).toBe(true);
      await clickCopy(reactGrab, page, FIRST_TODO_SELECTOR);
    } finally {
      await page.keyboard.up(HELD_ACTIVATION_KEY);
    }
    await expect.poll(() => isReactGrabActive(page)).toBe(false);

    await getCompletion(reactGrab).locator(DISMISS_BUTTON_SELECTOR).click();

    await expect(getCompletion(reactGrab)).toHaveCount(0);
    expect(await isReactGrabActive(page)).toBe(false);
    expect(await isFocusInOverlay(page)).toBe(false);
  });

  test("Dismiss cancels a held camera capture without an image write or error", async ({
    reactGrab,
    page,
  }) => {
    await installClipboardRecorder(page);
    await reactGrab.activate();
    await clickCopy(reactGrab, page, FIRST_TODO_SELECTOR);
    await controlImageEncoding(page, { isGated: true });
    await getCompletion(reactGrab).locator(CAMERA_BUTTON_SELECTOR).click();
    await expect.poll(() => getPendingImageEncodingCount(page)).toBeGreaterThan(0);

    await getCompletion(reactGrab).locator(DISMISS_BUTTON_SELECTOR).click();
    await expect(getCompletion(reactGrab)).toHaveCount(0);
    await openImageEncodingGate(page);

    await expect.poll(() => getPendingImageEncodingCount(page)).toBe(0);
    await expect.poll(() => getSettledClipboardWriteCount(page)).toBe(1);
    expect(await getImageWrites(page)).toHaveLength(0);
    expect(await getUnhandledRejections(page)).toHaveLength(0);
    await expect(reactGrab.getOverlayHost().locator(ERROR_SELECTOR)).toHaveCount(0);
    expect(await isReactGrabActive(page)).toBe(true);
  });

  test("an Image saved pill ends with Dismiss", async ({ reactGrab, page }) => {
    await page.evaluate(() =>
      Object.defineProperty(navigator.clipboard, "write", { configurable: true, value: undefined }),
    );
    await reactGrab.activate();
    await page.keyboard.down("Shift");
    await page.mouse.move(CAPTURE_START.x, CAPTURE_START.y);
    await page.mouse.down();
    await page.mouse.move(CAPTURE_END.x, CAPTURE_END.y, { steps: DRAG_STEPS });
    await page.mouse.up();
    await page.keyboard.up("Shift");

    await expect(getCompletion(reactGrab)).toContainText("Image saved");
    await expect(getCompletion(reactGrab).getByRole("button").last()).toHaveAccessibleName(
      "Dismiss",
    );
  });

  test("a copy without typing writes the clipboard once", async ({ reactGrab, page }) => {
    await installClipboardRecorder(page);
    await reactGrab.activate();
    const clickWrites = await clickCopy(reactGrab, page, FIRST_TODO_SELECTOR);

    expect(clickWrites["text/plain"]).toContain("Buy groceries");
    await page.waitForTimeout(NO_SECOND_COPY_WAIT_MS);
    expect(await getCopyEventCount(page)).toBe(1);
    await expect.poll(() => reactGrab.getClipboardContent()).toBe(clickWrites["text/plain"]);
  });

  test.describe("with an empty prompt", () => {
    test.beforeEach(async ({ reactGrab, page }) => {
      await installClipboardRecorder(page);
      await reactGrab.activate();
      await clickCopy(reactGrab, page, FIRST_TODO_SELECTOR);
      expect(await isPillPromptFocused(page)).toBe(true);
    });

    test("an arrow key moves the element selection", async ({ reactGrab, page }) => {
      await expect(getLiveLabels(reactGrab)).toHaveCount(0);

      await page.keyboard.press("ArrowUp");

      await expect(getLiveLabels(reactGrab)).toHaveCount(1);
      await expect.poll(async () => (await reactGrab.getSelectionLabelInfo()).tagName).toBe("li");
      await expect(getPillPrompt(reactGrab)).toHaveValue("");
    });

    test("Enter on the copied elements does nothing", async ({ reactGrab, page }) => {
      await page.keyboard.press("Enter");

      await page.waitForTimeout(NO_SECOND_COPY_WAIT_MS);
      expect(await getCopyEventCount(page)).toBe(1);
      expect(await reactGrab.isPromptModeActive()).toBe(false);
      await expect(getPillPrompt(reactGrab)).toHaveValue("");
      await expect(getCompletion(reactGrab)).toHaveText(/^Copied$/);
      expect(await isReactGrabActive(page)).toBe(true);
    });

    test("Escape dismisses the pill before a second Escape switches Grab off", async ({
      reactGrab,
      page,
    }) => {
      await page.keyboard.press("Escape");

      await expect(getCompletion(reactGrab)).toHaveCount(0);
      expect(await isReactGrabActive(page)).toBe(true);
      expect(await isFocusInOverlay(page)).toBe(false);
      await page.keyboard.press("Escape");
      await expect.poll(() => isReactGrabActive(page)).toBe(false);
    });

    test("a tap of the activation shortcut switches Grab off", async ({ reactGrab, page }) => {
      await page.waitForTimeout(PILL_MODIFIER_RELEASE_DELAY_MS);
      await page.keyboard.down(reactGrab.modifierKey);
      await page.keyboard.press("c");
      await page.keyboard.up(reactGrab.modifierKey);

      await expect.poll(() => isReactGrabActive(page)).toBe(false);
    });

    test("a single-key shortcut is text", async ({ reactGrab, page }) => {
      await page.keyboard.press("1");

      await expect(getPillPrompt(reactGrab)).toHaveValue("1");
      await expect(page.locator(SPECS_TOGGLE_SELECTOR)).toHaveAttribute("aria-pressed", "false");
    });

    test("Enter during IME composition does not submit", async ({ reactGrab, page }) => {
      await page.keyboard.insertText("blue");
      await getPillPrompt(reactGrab).dispatchEvent("keydown", {
        key: "Enter",
        code: "Enter",
        isComposing: true,
        bubbles: true,
        composed: true,
      });

      await page.waitForTimeout(NO_SECOND_COPY_WAIT_MS);
      expect(await getCopyEventCount(page)).toBe(1);
      await expect(getPillPrompt(reactGrab)).toHaveValue("blue");
    });
  });

  test.describe("with text in the prompt", () => {
    test.beforeEach(async ({ reactGrab, page }) => {
      await reactGrab.activate();
      await clickCopy(reactGrab, page, FIRST_TODO_SELECTOR);
      await page.keyboard.type("ab");
    });

    test("arrow keys move the caret, not the selection", async ({ reactGrab, page }) => {
      await page.keyboard.press("ArrowLeft");
      await page.keyboard.press("ArrowUp");

      const caretPosition = await getPillPrompt(reactGrab).evaluate(
        (textarea: HTMLTextAreaElement) => textarea.selectionStart,
      );
      expect(caretPosition).toBe(0);
      await page.waitForTimeout(NO_SECOND_COPY_WAIT_MS);
      await expect(getLiveLabels(reactGrab)).toHaveCount(0);
    });

    test("Shift+Enter inserts a newline", async ({ reactGrab, page }) => {
      await page.keyboard.press("Shift+Enter");
      await page.keyboard.type("c");

      await expect(getPillPrompt(reactGrab)).toHaveValue("ab\nc");
      await expect(getCompletion(reactGrab)).toHaveText(/^Copied/);
      await expect(getCompletion(reactGrab)).not.toContainText("with prompt");
    });

    test("Escape clears the text and hands focus back, leaving the pill and Grab", async ({
      reactGrab,
      page,
    }) => {
      await page.keyboard.press("Escape");

      await expect(getPillPrompt(reactGrab)).toHaveValue("");
      expect(await isFocusInOverlay(page)).toBe(false);
      await expect(getCompletion(reactGrab)).toHaveCount(1);
      expect(await isReactGrabActive(page)).toBe(true);

      await page.keyboard.press("Escape");
      await expect(getCompletion(reactGrab)).toHaveCount(0);
      expect(await isReactGrabActive(page)).toBe(true);
      await page.keyboard.press("Escape");
      await expect.poll(() => isReactGrabActive(page)).toBe(false);
    });

    test("the camera copies the original text and the image", async ({ reactGrab, page }) => {
      await installClipboardRecorder(page);

      await getCompletion(reactGrab).locator(CAMERA_BUTTON_SELECTOR).click();

      await expect(getCompletion(reactGrab)).toContainText("Copied with image");
      await expect(getCompletion(reactGrab).getByRole("button").last()).toHaveAccessibleName(
        "Dismiss",
      );
      await expect(
        reactGrab.getOverlayHost().getByRole("button", { name: "More options", exact: true }),
      ).toHaveCount(0);
      await expect(getPillPrompt(reactGrab)).toHaveCount(0);
      await expect.poll(() => getImageWrites(page)).toHaveLength(1);
      const [imageWrite] = await getImageWrites(page);
      expect(imageWrite.plainText).toContain("Buy groceries");
      expect(imageWrite.plainText).not.toContain("ab");
    });
  });

  test("typing keeps going while the pointer moves to other elements", async ({
    reactGrab,
    page,
  }) => {
    await reactGrab.activate();
    await clickCopy(reactGrab, page, FIRST_TODO_SELECTOR);
    await page.keyboard.type("make ");

    await reactGrab.hoverUntilSelected(TODO_HEADING_SELECTOR);
    await expect(getLiveLabels(reactGrab)).toHaveCount(1);
    await page.keyboard.type("it blue");

    await expect(getPillPrompt(reactGrab)).toHaveValue("make it blue");
    expect(await isPillPromptFocused(page)).toBe(true);
  });

  test("a click on another element copies it and drops the unsent text", async ({
    reactGrab,
    page,
  }) => {
    await reactGrab.activate();
    await clickCopy(reactGrab, page, FIRST_TODO_SELECTOR);
    await page.keyboard.type(PROMPT_TEXT);

    const clipboardWrites = await clickCopy(reactGrab, page, TODO_HEADING_SELECTOR);

    expect(clipboardWrites["text/plain"]).toContain("Todo List");
    expect(clipboardWrites["text/plain"]).not.toContain(PROMPT_TEXT);
    await expect(getCompletion(reactGrab)).toHaveCount(1);
    await expect(getPillPrompt(reactGrab)).toHaveValue("");
  });

  test("the camera after a prompt copies the prompt with the image", async ({
    reactGrab,
    page,
  }) => {
    await reactGrab.activate();
    await clickCopy(reactGrab, page, FIRST_TODO_SELECTOR);
    const pillPromptWrites = await submitPillPrompt(reactGrab, page, PROMPT_TEXT);
    await installClipboardRecorder(page);

    await getCompletion(reactGrab).locator(CAMERA_BUTTON_SELECTOR).click();

    await expect(getCompletion(reactGrab)).toContainText("Copied with image");
    await expect(getCompletion(reactGrab).getByRole("button").last()).toHaveAccessibleName(
      "Dismiss",
    );
    await expect(
      reactGrab.getOverlayHost().getByRole("button", { name: "More options", exact: true }),
    ).toHaveCount(0);
    await expect.poll(() => getImageWrites(page)).toHaveLength(1);
    const [imageWrite] = await getImageWrites(page);
    expect(imageWrite.plainText).toBe(pillPromptWrites["text/plain"]);
    expect(imageWrite.plainText?.startsWith(`${PROMPT_TEXT}\n`)).toBe(true);
  });

  test("a failed prompt copy keeps the prompt for Retry", async ({ reactGrab, page }) => {
    await reactGrab.activate();
    await clickCopy(reactGrab, page, FIRST_TODO_SELECTOR);
    await page.evaluate(() => {
      document.execCommand = () => false;
    });
    await page.keyboard.type(PROMPT_TEXT);
    await page.keyboard.press("Enter");

    const completionLabel = reactGrab.getOverlayHost().locator(ERROR_SELECTOR);
    await expect(completionLabel).toContainText("Failed to copy");
    await expect(reactGrab.getOverlayHost().locator(DISMISS_BUTTON_SELECTOR)).toHaveCount(0);
    expect(await isReactGrabActive(page)).toBe(true);

    await page.evaluate(() => Reflect.deleteProperty(document, "execCommand"));
    const waitForClipboardWrites = await reactGrab.captureNextClipboardWrites();
    await reactGrab.getOverlayHost().locator(RETRY_SELECTOR).click();
    const clipboardWrites = await waitForClipboardWrites();

    expect(clipboardWrites["text/plain"]?.startsWith(`${PROMPT_TEXT}\n`)).toBe(true);
    await expect(getCompletion(reactGrab)).toContainText("Copied with prompt");
    await expect(getCompletion(reactGrab).getByRole("button").last()).toHaveAccessibleName(
      "Dismiss",
    );
    await expect(
      reactGrab.getOverlayHost().getByRole("button", { name: "More options", exact: true }),
    ).toHaveCount(0);
  });

  test("a hold session shows the prompt without taking focus", async ({ reactGrab, page }) => {
    await reactGrab.updateOptions({ activationMode: "hold", activationKey: HELD_ACTIVATION_KEY });
    await page.keyboard.down(HELD_ACTIVATION_KEY);
    try {
      await page.waitForTimeout(KEYBOARD_ACTIVATION_SETTLE_DELAY_MS);
      await expect.poll(() => isReactGrabActive(page)).toBe(true);
      await clickCopy(reactGrab, page, FIRST_TODO_SELECTOR);
      await page.waitForTimeout(NO_SECOND_COPY_WAIT_MS);
      expect(await isFocusInOverlay(page)).toBe(false);
    } finally {
      await page.keyboard.up(HELD_ACTIVATION_KEY);
    }

    await getPillPrompt(reactGrab).click();
    expect(await isPillPromptFocused(page)).toBe(true);
    await expect(getCompletion(reactGrab)).toHaveCount(1);
  });

  test("per-element pills carry one prompt, on the pill nearest the pointer", async ({
    reactGrab,
    page,
  }) => {
    await reactGrab.activate();
    const firstCenter = await page.locator(FIRST_TODO_SELECTOR).boundingBox();
    const secondCenter = await page.locator(SECOND_TODO_SELECTOR).boundingBox();
    if (!firstCenter || !secondCenter) throw new Error("No todo boxes");
    await page.keyboard.down("Shift");
    await page.mouse.click(
      firstCenter.x + firstCenter.width / 2,
      firstCenter.y + firstCenter.height / 2,
    );
    await page.waitForTimeout(SHIFT_LABEL_SETTLE_DELAY_MS);
    await page.mouse.click(
      secondCenter.x + secondCenter.width / 2,
      secondCenter.y + secondCenter.height / 2,
    );
    await page.waitForTimeout(SHIFT_LABEL_SETTLE_DELAY_MS);
    await page.keyboard.up("Shift");

    const completion = getCompletion(reactGrab);
    await expect(completion).toHaveCount(2);
    await expect(completion.locator(CAMERA_BUTTON_SELECTOR)).toHaveCount(2);
    await expect(completion.locator(DISMISS_BUTTON_SELECTOR)).toHaveCount(2);
    await expect(getPillPrompt(reactGrab)).toHaveCount(1);
    const pillTops = await completion.evaluateAll((pills) =>
      pills.map((pill) => ({
        top: pill.getBoundingClientRect().y,
        hasPrompt: Boolean(pill.querySelector("[data-react-grab-pill-prompt]")),
      })),
    );
    const lowerPill = pillTops.reduce((lowest, pill) => (pill.top > lowest.top ? pill : lowest));
    expect(lowerPill.hasPrompt).toBe(true);

    const pillPromptWrites = await submitPillPrompt(reactGrab, page, PROMPT_TEXT);
    expect(pillPromptWrites["text/plain"]).toContain("Buy groceries");
    expect(pillPromptWrites["text/plain"]).toContain("Walk the dog");
    await getCompletion(reactGrab).first().locator(DISMISS_BUTTON_SELECTOR).click();
    await expect(getCompletion(reactGrab)).toHaveCount(0);
    expect(await isReactGrabActive(page)).toBe(true);
    expect(await reactGrab.getClipboardContent()).toBe(pillPromptWrites["text/plain"]);
  });

  test("a screenshot's Image copied pill has no prompt", async ({ reactGrab, page }) => {
    await installClipboardRecorder(page);
    await reactGrab.activate();
    await page.keyboard.down("Shift");
    await page.mouse.move(CAPTURE_START.x, CAPTURE_START.y);
    await page.mouse.down();
    await page.mouse.move(CAPTURE_END.x, CAPTURE_END.y, { steps: DRAG_STEPS });
    await page.mouse.up();
    await page.keyboard.up("Shift");

    await expect(getCompletion(reactGrab)).toContainText("Image copied");
    await expect(getCompletion(reactGrab).getByRole("button").last()).toHaveAccessibleName(
      "Dismiss",
    );
    await expect(getPillPrompt(reactGrab)).toHaveCount(0);
  });

  test("a pill at the right edge stays inside the viewport as it grows", async ({
    reactGrab,
    page,
  }) => {
    await addEdgeTarget(page);
    await reactGrab.activate();
    await clickCopy(reactGrab, page, `#${EDGE_TARGET_ID}`);
    const viewportWidth = page.viewportSize()?.width ?? 0;
    const expectInsideViewport = async () => {
      const pillBox = await getCompletion(reactGrab).boundingBox();
      if (!pillBox) throw new Error("No pill box");
      expect(pillBox.x).toBeGreaterThanOrEqual(0);
      expect(pillBox.x + pillBox.width).toBeLessThanOrEqual(viewportWidth);
    };
    await expectInsideViewport();

    await page.keyboard.type(LONG_PROMPT_TEXT);
    await expect(getPillPrompt(reactGrab)).toHaveValue(LONG_PROMPT_TEXT);
    await expectInsideViewport();
  });

  test("a copy inside a same-origin frame takes a prompt", async ({ reactGrab, page }) => {
    await reactGrab.activate();
    const frameTarget = page
      .frameLocator(SAME_ORIGIN_IFRAME_SELECTOR)
      .locator(IFRAME_TARGET_SELECTOR);
    await frameTarget.scrollIntoViewIfNeeded();
    const frameTargetBox = await frameTarget.boundingBox();
    if (!frameTargetBox) throw new Error("No frame target box");
    await page.mouse.move(frameTargetBox.x + 4, frameTargetBox.y + 4);
    await page.mouse.move(
      frameTargetBox.x + frameTargetBox.width / 2,
      frameTargetBox.y + frameTargetBox.height / 2,
      { steps: 4 },
    );
    await expect.poll(() => reactGrab.isSelectionBoxVisible()).toBe(true);
    await page.mouse.down();
    await page.mouse.up();
    await expect(getPillPrompt(reactGrab)).toHaveCount(1);
    expect(await isPillPromptFocused(page)).toBe(true);

    const pillPromptWrites = await submitPillPrompt(reactGrab, page, PROMPT_TEXT);

    expect(pillPromptWrites["text/plain"]?.startsWith(`${PROMPT_TEXT}\n`)).toBe(true);
    expect(pillPromptWrites["text/plain"]).toContain("iframe-target");
  });

  test("the toolbar switches Grab off and leaves the pill", async ({ reactGrab, page }) => {
    await reactGrab.activate();
    await clickCopy(reactGrab, page, FIRST_TODO_SELECTOR);

    await reactGrab.getOverlayHost().locator('[data-react-grab-toolbar-action="copy"]').click();

    await expect.poll(() => isReactGrabActive(page)).toBe(false);
    await expect
      .poll(async () =>
        (await reactGrab.getLabelInstancesInfo()).map((instance) => instance.status),
      )
      .toEqual(["copied"]);
    await expect(getCompletion(reactGrab)).toHaveCount(1);
  });

  test.describe("switching Grab off with the pill still up", () => {
    const switchOffMethods = [
      {
        name: "api.deactivate()",
        switchOff: (_reactGrab: ReactGrabPageObject, page: Page) =>
          page.evaluate(() => window.__REACT_GRAB__?.deactivate()),
      },
      { name: "a tap of the shortcut", switchOff: tapActivationShortcut },
    ];
    const focusOrigins = [
      { name: "the body", focusedElementId: null },
      { name: "a page input", focusedElementId: PAGE_INPUT_ID },
    ];

    for (const switchOffMethod of switchOffMethods) {
      for (const focusOrigin of focusOrigins) {
        test(`${switchOffMethod.name} hands focus back to ${focusOrigin.name}`, async ({
          reactGrab,
          page,
        }) => {
          if (focusOrigin.focusedElementId) {
            await page.evaluate((pageInputId) => {
              const pageInput = document.createElement("input");
              pageInput.id = pageInputId;
              Object.assign(pageInput.style, { position: "fixed", left: "8px", bottom: "8px" });
              document.body.append(pageInput);
              pageInput.focus();
            }, focusOrigin.focusedElementId);
          }
          await reactGrab.activate();
          await clickCopy(reactGrab, page, FIRST_TODO_SELECTOR);
          expect(await isPillPromptFocused(page)).toBe(true);

          await switchOffMethod.switchOff(reactGrab, page);

          await expect.poll(() => isReactGrabActive(page)).toBe(false);
          await expect(getCompletion(reactGrab)).toHaveCount(1);
          expect(await getFocusState(page)).toEqual({
            hasOverlayFocus: false,
            pageFocus: focusOrigin.focusedElementId ?? "body",
          });
        });
      }
    }
  });

  test("a capital letter typed with Shift does not pin Specs", async ({ reactGrab, page }) => {
    await reactGrab.activate();
    await switchOnSpecs(page);
    await clickCopy(reactGrab, page, FIRST_TODO_SELECTOR);
    await page.keyboard.type("a");

    await page.keyboard.down("Shift");
    await page.keyboard.press("B");
    await expect(getPillPrompt(reactGrab)).toHaveValue("aB");
    await expect(page.locator(PINNED_PANEL_SELECTOR)).toHaveCount(0);
    await page.keyboard.press("Backspace");
    await page.keyboard.press("Backspace");
    await expect(getPillPrompt(reactGrab)).toHaveValue("");
    await expect(page.locator(PINNED_PANEL_SELECTOR)).toHaveCount(0);
    await page.keyboard.up("Shift");

    await page.keyboard.type("b");
    await expect(getPillPrompt(reactGrab)).toHaveValue("b");
    await expect(page.locator(PINNED_PANEL_SELECTOR)).toHaveCount(0);
  });

  test("a letter typed with Alt does not start measuring", async ({ reactGrab, page }) => {
    await reactGrab.activate();
    await page.locator(SPACING_TOGGLE_SELECTOR).click();
    await clickCopy(reactGrab, page, FIRST_TODO_SELECTOR);
    await page.keyboard.type("ab");

    await page.keyboard.down("Alt");
    await page.keyboard.press("x");
    await reactGrab.hoverUntilSelected(TODO_HEADING_SELECTOR);
    await expect.poll(() => getSelectionTargetText(page)).toBe("Todo List");
    await expect(page.locator(MEASURE_TARGET_SELECTOR)).toHaveCount(0);
    await page.keyboard.up("Alt");

    await expect(page.locator(MEASURE_TARGET_SELECTOR)).toHaveCount(0);
    expect(await isPillPromptFocused(page)).toBe(true);
  });

  test("a hold session ends on release after typing into the prompt", async ({
    reactGrab,
    page,
  }) => {
    await reactGrab.updateOptions({ activationMode: "hold", activationKey: HELD_ACTIVATION_KEY });
    await page.keyboard.down(HELD_ACTIVATION_KEY);
    try {
      await page.waitForTimeout(KEYBOARD_ACTIVATION_SETTLE_DELAY_MS);
      await expect.poll(() => isReactGrabActive(page)).toBe(true);
      await clickCopy(reactGrab, page, FIRST_TODO_SELECTOR);
      await getPillPrompt(reactGrab).click();
      await page.keyboard.type("ab");
      await expect(getPillPrompt(reactGrab)).toHaveValue("ab");
      expect(await isReactGrabActive(page)).toBe(true);
    } finally {
      await page.keyboard.up(HELD_ACTIVATION_KEY);
    }

    await expect.poll(() => isReactGrabActive(page)).toBe(false);
  });

  test("a prompt after the page re-renders the copied element copies the new one", async ({
    reactGrab,
    page,
  }) => {
    await reactGrab.updateOptions({ freezeReactUpdates: false });
    await reactGrab.activate();
    await clickCopy(reactGrab, page, INNER_HTML_TOKEN_SELECTOR);
    await expect.poll(() => getSelectionTargetText(page)).toBe("token-initial");

    await page.evaluate(() => Reflect.get(window, "__triggerInnerHtmlSwap")?.());
    await expect.poll(() => getSelectionTargetText(page)).toBe("token-swapped");

    await expect(getLiveLabels(reactGrab)).toHaveCount(0);
    expect(await isPillPromptFocused(page)).toBe(true);
    const pillPromptWrites = await submitPillPrompt(reactGrab, page, PROMPT_TEXT);
    expect(pillPromptWrites["text/plain"]?.startsWith(`${PROMPT_TEXT}\n`)).toBe(true);
    expect(pillPromptWrites["text/plain"]).toContain("token-swapped");
    expect(pillPromptWrites["text/plain"]).not.toContain("token-initial");
    await expect(getLiveLabels(reactGrab)).toHaveCount(0);
  });

  test("a prompt sent while the camera's image renders drops the image", async ({
    reactGrab,
    page,
  }) => {
    await installClipboardRecorder(page);
    await reactGrab.activate();
    await clickCopy(reactGrab, page, FIRST_TODO_SELECTOR);
    await controlImageEncoding(page, { isGated: true });
    await getCompletion(reactGrab).locator(CAMERA_BUTTON_SELECTOR).click();
    await expect(getCompletion(reactGrab).locator(CAPTURING_SELECTOR)).toHaveCount(1);
    await getPillPrompt(reactGrab).click();
    await page.keyboard.type(PROMPT_TEXT);
    await page.evaluate(() => {
      window.addEventListener(
        "keydown",
        (event) => {
          if (event.key === "Enter") Reflect.get(window, "__openImageEncodingGate")?.();
        },
        { capture: true, once: true },
      );
    });

    await page.keyboard.press("Enter");
    await expect(getCompletion(reactGrab).filter({ hasText: "Copied with prompt" })).toHaveCount(1);
    await openImageEncodingGate(page);
    await page.waitForTimeout(NO_SECOND_COPY_WAIT_MS);

    expect(await getImageWrites(page)).toHaveLength(0);
    expect((await reactGrab.getClipboardContent()).startsWith(`${PROMPT_TEXT}\n`)).toBe(true);
    await expect(getCompletion(reactGrab)).toHaveText(/^Copied with prompt/);
  });

  test("the empty prompt is as wide as its placeholder and grows before it wraps", async ({
    reactGrab,
    page,
  }) => {
    await reactGrab.activate();
    await clickCopy(reactGrab, page, FIRST_TODO_SELECTOR);
    await expect(getPillPrompt(reactGrab)).toHaveAttribute("placeholder", "Optional context");
    const emptyPrompt = await measurePillPrompt(reactGrab);
    expect(Math.abs(emptyPrompt.promptWidth - emptyPrompt.placeholderWidth)).toBeLessThanOrEqual(
      PLACEHOLDER_SLACK_PX,
    );
    const pillWidthOutsidePrompt = emptyPrompt.pillWidth - emptyPrompt.promptWidth;
    expect(emptyPrompt.pillWidth).toBeLessThanOrEqual(
      pillWidthOutsidePrompt + emptyPrompt.placeholderWidth + PLACEHOLDER_SLACK_PX,
    );

    await page.keyboard.type(SHORT_PROMPT_TEXT);
    const shortPrompt = await measurePillPrompt(reactGrab);
    expect(shortPrompt.textareaHeight).toBe(SINGLE_LINE_HEIGHT_PX);
    expect(shortPrompt.promptWidth).toBeGreaterThan(emptyPrompt.promptWidth);

    await page.keyboard.type(` ${LONG_PROMPT_TEXT}`);
    const longPrompt = await measurePillPrompt(reactGrab);
    expect(longPrompt.textareaHeight).toBeGreaterThan(SINGLE_LINE_HEIGHT_PX);
    expect(longPrompt.pillWidth).toBeCloseTo(PILL_MAX_WIDTH_PX, 0);
    expect(longPrompt.isStatusTextClipped).toBe(false);
  });

  test("with an image the empty prompt still shows its whole placeholder on one line", async ({
    reactGrab,
    page,
  }) => {
    await installClipboardRecorder(page);
    await reactGrab.activate();
    await switchOnScreenshotToggle(page);
    await clickCopy(reactGrab, page, SECOND_TODO_SELECTOR);
    await expect(getCompletion(reactGrab)).toContainText("Copied with image");
    await expect(getCompletion(reactGrab).locator(THUMBNAIL_SELECTOR)).toHaveCount(1);

    const emptyPrompt = await measurePillPrompt(reactGrab);
    expect(emptyPrompt.promptWidth).toBeGreaterThanOrEqual(emptyPrompt.placeholderWidth);
    expect(emptyPrompt.textareaHeight).toBe(SINGLE_LINE_HEIGHT_PX);
    expect(emptyPrompt.isStatusTextClipped).toBe(false);
    expect(emptyPrompt.pillWidth).toBeLessThanOrEqual(PILL_WITH_THUMBNAIL_MAX_WIDTH_PX);

    await getPillPrompt(reactGrab).click();
    await page.keyboard.type(LONG_PROMPT_TEXT);
    const longPrompt = await measurePillPrompt(reactGrab);
    expect(longPrompt.textareaHeight).toBeGreaterThan(SINGLE_LINE_HEIGHT_PX);
    expect(longPrompt.pillWidth).toBeCloseTo(PILL_WITH_THUMBNAIL_MAX_WIDTH_PX, 0);
    expect(longPrompt.isStatusTextClipped).toBe(false);
  });

  test("with an image at the right edge the pill keeps the whole placeholder inside the viewport", async ({
    reactGrab,
    page,
  }) => {
    await installClipboardRecorder(page);
    await addEdgeTarget(page);
    await reactGrab.activate();
    await switchOnScreenshotToggle(page);
    await clickCopy(reactGrab, page, `#${EDGE_TARGET_ID}`);
    await expect(getCompletion(reactGrab)).toContainText("Copied with image");

    await expect
      .poll(async () => {
        const emptyPrompt = await measurePillPrompt(reactGrab);
        return emptyPrompt.promptWidth >= emptyPrompt.placeholderWidth;
      })
      .toBe(true);
    const pillBox = await getCompletion(reactGrab).boundingBox();
    if (!pillBox) throw new Error("No pill box");
    expect(pillBox.x + pillBox.width).toBeLessThanOrEqual(page.viewportSize()?.width ?? 0);
  });
});

test.describe("Copied pill prompt on touch", () => {
  test.use({ hasTouch: true });

  test("a touch copy shows the prompt without taking focus", async ({ reactGrab, page }) => {
    await reactGrab.activate();
    await reactGrab.touchTap(FIRST_TODO_SELECTOR);

    await expect(getPillPrompt(reactGrab)).toHaveCount(1);
    await page.waitForTimeout(NO_SECOND_COPY_WAIT_MS);
    expect(await isFocusInOverlay(page)).toBe(false);

    await getPillPrompt(reactGrab).tap();
    expect(await isPillPromptFocused(page)).toBe(true);
  });
});
