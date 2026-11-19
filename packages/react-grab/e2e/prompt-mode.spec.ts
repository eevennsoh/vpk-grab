import { test, expect } from "./fixtures.js";
import { MOUNT_ROOT_RECHECK_DELAY_MS } from "../src/constants.js";
import {
  NON_NATIVE_ACTIVATION_KEY,
  OUTSIDE_WINDOW_POSITION_PX,
  POINTER_SETTLE_DELAY_MS,
} from "./constants.js";
import { getCopyEventCount, installClipboardRecorder } from "./screenshot-fixture.js";
import { installSpecsFixture, pinAndReach, specRow, switchOnSpecs } from "./specs-panel-fixture.js";

interface ReviewCopyWindow extends Window {
  releaseReviewCopy?: () => void;
}

test.describe("Prompt Mode", () => {
  test.describe("Entering Prompt Mode", () => {
    test("bare Enter copies when the Comment action is registered", async ({ reactGrab }) => {
      await reactGrab.registerCommentAction();
      await reactGrab.activate();
      await reactGrab.hoverUntilSelected("li:first-child");

      await reactGrab.pressEnter();

      await expect.poll(() => reactGrab.getLabelStatusText()).toBe("Copied");
      expect(await reactGrab.isPromptModeActive()).toBe(false);
    });

    test("single click should copy without entering prompt mode", async ({ reactGrab }) => {
      await reactGrab.activate();
      await reactGrab.hoverUntilSelected("li:first-child");

      await reactGrab.clickElement("li:first-child");

      await expect.poll(() => reactGrab.getClipboardContent()).toBeTruthy();
    });

    test("should focus input textarea when entering prompt mode", async ({ reactGrab }) => {
      await reactGrab.registerCommentAction();
      await reactGrab.enterPromptMode("li:first-child");

      const isFocused = await reactGrab.page.evaluate((attrName) => {
        const host = document.querySelector(`[${attrName}]`);
        const shadowRoot = host?.shadowRoot;
        if (!shadowRoot) return false;
        const root = shadowRoot.querySelector(`[${attrName}]`);
        if (!root) return false;
        const textarea = root.querySelector("textarea");
        return document.activeElement === textarea || shadowRoot.activeElement === textarea;
      }, "data-react-grab");

      expect(isFocused).toBe(true);
    });

    test("prompt mode should show input textarea", async ({ reactGrab }) => {
      await reactGrab.registerCommentAction();
      await reactGrab.enterPromptMode("h1");

      const hasTextarea = await reactGrab.page.evaluate((attrName) => {
        const host = document.querySelector(`[${attrName}]`);
        const shadowRoot = host?.shadowRoot;
        if (!shadowRoot) return false;
        const root = shadowRoot.querySelector(`[${attrName}]`);
        if (!root) return false;
        return root.querySelector("textarea") !== null;
      }, "data-react-grab");

      expect(hasTextarea).toBe(true);
    });
  });

  test.describe("Prompt Mode Control", () => {
    test("API toggle should exit prompt mode", async ({ reactGrab }) => {
      await reactGrab.registerCommentAction();
      await reactGrab.enterPromptMode("li:first-child");

      await reactGrab.toggle();

      await expect.poll(() => reactGrab.isOverlayVisible(), { timeout: 2000 }).toBe(false);
      expect(await reactGrab.isPromptModeActive()).toBe(false);
    });
  });

  test.describe("Text Input and Editing", () => {
    test("should accept text input", async ({ reactGrab }) => {
      await reactGrab.registerCommentAction();
      await reactGrab.enterPromptMode("li:first-child");

      await reactGrab.typeInInput("Test prompt text");

      const inputValue = await reactGrab.getInputValue();
      expect(inputValue).toBe("Test prompt text");
    });

    test("should allow editing typed text", async ({ reactGrab }) => {
      await reactGrab.registerCommentAction();
      await reactGrab.enterPromptMode("li:first-child");

      await reactGrab.typeInInput("Hello");
      await reactGrab.page.keyboard.press("Backspace");
      await reactGrab.page.keyboard.press("Backspace");
      await reactGrab.typeInInput("p!");

      const inputValue = await reactGrab.getInputValue();
      expect(inputValue).toBe("Help!");
    });

    test("should handle long text input", async ({ reactGrab }) => {
      await reactGrab.registerCommentAction();
      await reactGrab.enterPromptMode("li:first-child");

      const longText =
        "This is a very long prompt that should be handled properly by the textarea input field and might need to scroll within the container.";
      await reactGrab.typeInInput(longText);

      const inputValue = await reactGrab.getInputValue();
      expect(inputValue).toBe(longText);
    });

    test("should handle multiline input with shift+enter", async ({ reactGrab }) => {
      await reactGrab.registerCommentAction();
      await reactGrab.enterPromptMode("li:first-child");

      await reactGrab.typeInInput("Line 1");
      await reactGrab.page.keyboard.down("Shift");
      await reactGrab.page.keyboard.press("Enter");
      await reactGrab.page.keyboard.up("Shift");
      await reactGrab.typeInInput("Line 2");

      const inputValue = await reactGrab.getInputValue();
      expect(inputValue).toContain("Line 1");
      expect(inputValue).toContain("Line 2");
    });
  });

  test.describe("Submit and Cancel", () => {
    test("Enter key should submit input", async ({ reactGrab }) => {
      await reactGrab.registerCommentAction();
      await reactGrab.enterPromptMode("li:first-child");

      await reactGrab.typeInInput("Test prompt");
      await reactGrab.submitInput();

      await expect.poll(() => reactGrab.isPromptModeActive()).toBe(false);
      await expect.poll(() => reactGrab.getClipboardContent()).toContain("Test prompt\n");
    });

    test("Escape should cancel prompt mode", async ({ reactGrab }) => {
      await reactGrab.registerCommentAction();
      await reactGrab.enterPromptMode("li:first-child");

      await reactGrab.pressEscape();

      await expect.poll(() => reactGrab.isPromptModeActive()).toBe(false);
    });

    test("Escape in textarea should dismiss prompt mode directly", async ({ reactGrab }) => {
      await reactGrab.registerCommentAction();
      await reactGrab.enterPromptMode("li:first-child");

      expect(await reactGrab.isPromptModeActive()).toBe(true);

      await reactGrab.typeInInput("Some unsaved text");

      await reactGrab.pressEscape();

      await expect.poll(() => reactGrab.isPromptModeActive()).toBe(false);
    });

    test("confirming dismiss should close prompt mode", async ({ reactGrab }) => {
      await reactGrab.registerCommentAction();
      await reactGrab.enterPromptMode("li:first-child");

      await reactGrab.typeInInput("Some text");
      await reactGrab.pressEscape();
      await reactGrab.pressEscape();

      await expect.poll(() => reactGrab.isOverlayVisible()).toBe(false);
    });

    test("empty input should cancel without confirmation", async ({ reactGrab }) => {
      await reactGrab.registerCommentAction();
      await reactGrab.enterPromptMode("li:first-child");

      await reactGrab.pressEscape();

      const isPendingDismiss = await reactGrab.isPendingDismissVisible();
      expect(isPendingDismiss).toBe(false);
    });
  });

  test.describe("Prompt Mode with Selection", () => {
    test("should freeze selection while in prompt mode", async ({ reactGrab }) => {
      await reactGrab.registerCommentAction();
      await reactGrab.enterPromptMode("li:first-child");

      await reactGrab.page.mouse.move(500, 500);

      const isPromptMode = await reactGrab.isPromptModeActive();
      expect(isPromptMode).toBe(true);
    });
  });

  test.describe("Keyboard Shortcuts in Prompt Mode", () => {
    test("arrow keys should not navigate elements in prompt mode", async ({ reactGrab }) => {
      await reactGrab.registerCommentAction();
      await reactGrab.enterPromptMode("li:first-child span");
      await reactGrab.typeInInput("Line 1\nLine 2");

      await reactGrab.pressArrowDown();

      const isPromptMode = await reactGrab.isPromptModeActive();
      expect(isPromptMode).toBe(true);
      expect(await reactGrab.getInputValue()).toBe("Line 1\nLine 2");
      const isFirstItemStillSelected = await reactGrab.page.evaluate(() => {
        const firstItem = document.querySelector("li:first-child span");
        return window.__REACT_GRAB__?.getState().targetElement === firstItem;
      });
      expect(isFirstItemStillSelected).toBe(true);
    });

    test("activation shortcut should not cancel prompt mode when input is focused", async ({
      reactGrab,
    }) => {
      await reactGrab.registerCommentAction();
      await reactGrab.enterPromptMode("li:first-child");

      await reactGrab.page.keyboard.down(reactGrab.modifierKey);
      await reactGrab.page.keyboard.press("c");
      await reactGrab.page.keyboard.up(reactGrab.modifierKey);

      await expect.poll(() => reactGrab.isPromptModeActive()).toBe(true);
    });
  });

  test.describe("Input Preservation", () => {
    test("input should be cleared after dismissing prompt mode", async ({ reactGrab }) => {
      await reactGrab.registerCommentAction();
      await reactGrab.enterPromptMode("li:first-child");

      await reactGrab.typeInInput("Some text");
      await reactGrab.pressEscape();

      await reactGrab.enterPromptMode("li:first-child");

      const inputValue = await reactGrab.getInputValue();
      expect(inputValue).toBe("");
    });
  });

  test.describe("Edge Cases", () => {
    test("clicking outside should cancel prompt mode", async ({ reactGrab }) => {
      await reactGrab.registerCommentAction();
      await reactGrab.enterPromptMode("li:first-child");

      await reactGrab.page.mouse.click(10, 10);
      await reactGrab.page.mouse.click(10, 10);

      await expect.poll(() => reactGrab.isPromptModeActive()).toBe(false);
    });

    test("comment prompt mode maintains the overlay", async ({ reactGrab }) => {
      await reactGrab.registerCommentAction();
      await reactGrab.enterPromptMode("li:first-child");

      const isPromptActive = await reactGrab.isPromptModeActive();
      expect(isPromptActive).toBe(true);

      const isOverlayActive = await reactGrab.isOverlayVisible();
      expect(isOverlayActive).toBe(true);
    });

    test("prompt mode should work after scroll", async ({ reactGrab }) => {
      await reactGrab.registerCommentAction();
      await reactGrab.activate();
      await reactGrab.scrollPage(100);

      await reactGrab.hoverUntilSelected("li:first-child");

      await reactGrab.page.evaluate(() => window.__REACT_GRAB__?.comment());
      await reactGrab.page.mouse.down();
      await reactGrab.page.mouse.up();

      await expect.poll(() => reactGrab.isPromptModeActive()).toBe(true);
    });
  });
});

test.describe("Enter copies first", () => {
  const targetSelector = "[data-testid='todo-list'] h1";
  const pillPromptSelector = "[data-react-grab-pill-prompt] textarea";

  test("Enter copies the same reference as a click and focuses optional context", async ({
    reactGrab,
    page,
  }) => {
    await reactGrab.activate();
    await reactGrab.hoverUntilSelected(targetSelector);
    const waitForClick = await reactGrab.captureNextClipboardWrites();
    await page.mouse.down();
    await page.mouse.up();
    const clickWrites = await waitForClick();
    await page.evaluate(() => window.__REACT_GRAB__?.deactivate());
    await reactGrab.activate();
    await reactGrab.hoverUntilSelected(targetSelector);
    const waitForEnter = await reactGrab.captureNextClipboardWrites();
    await page.keyboard.press("Enter");
    await expect.poll(() => reactGrab.getLabelStatusText()).toBe("Copied");
    const enterWrites = await waitForEnter();
    expect(enterWrites["text/plain"]).toBe(clickWrites["text/plain"]);
    expect(enterWrites["text/html"]).toBe(clickWrites["text/html"]);
    await expect(page.locator(pillPromptSelector)).toBeFocused();
    expect(await reactGrab.isPromptModeActive()).toBe(false);
  });

  test("a hold session focuses optional context after Enter", async ({ reactGrab, page }) => {
    await reactGrab.updateOptions({
      activationMode: "hold",
      activationKey: NON_NATIVE_ACTIVATION_KEY,
    });
    await page.keyboard.down(NON_NATIVE_ACTIVATION_KEY);
    try {
      await expect.poll(() => page.evaluate(() => window.__REACT_GRAB__?.isActive())).toBe(true);
      await reactGrab.hoverUntilSelected(targetSelector);
      await page.keyboard.press("Enter");
      await expect(page.locator(pillPromptSelector)).toBeFocused();
      await expect.poll(() => reactGrab.getClipboardContent()).toContain("Todo List");
      expect(await reactGrab.isPromptModeActive()).toBe(false);
    } finally {
      await page.keyboard.up(NON_NATIVE_ACTIVATION_KEY);
    }
    await expect.poll(() => page.evaluate(() => window.__REACT_GRAB__?.isActive())).toBe(false);
    await expect(page.locator(pillPromptSelector)).toBeFocused();
    await page.keyboard.type("keep context after release");
    await page.keyboard.press("Enter");
    await expect
      .poll(() => reactGrab.getClipboardContent())
      .toContain("keep context after release");
    await expect(page.locator("[data-react-grab-completion]")).toContainText("Copied with prompt");
    expect(await page.evaluate(() => window.__REACT_GRAB__?.isActive())).toBe(false);
  });

  test("dismissing empty optional context allows a different arrow selection", async ({
    reactGrab,
    page,
  }) => {
    await installClipboardRecorder(page);
    await reactGrab.activate();
    await reactGrab.hoverUntilSelected(targetSelector);
    await page.mouse.down();
    await page.mouse.up();
    await expect(page.locator(pillPromptSelector)).toBeFocused();
    await page.keyboard.press("Escape");
    await page.keyboard.press("ArrowUp");
    await expect.poll(async () => (await reactGrab.getSelectionLabelInfo()).tagName).toBe("div");
    await page.keyboard.press("Enter");
    await expect.poll(() => getCopyEventCount(page)).toBe(2);
    await expect.poll(() => reactGrab.getClipboardContent()).toContain("[<div");
    await expect(page.locator(pillPromptSelector)).toBeFocused();
    expect(await reactGrab.isPromptModeActive()).toBe(false);
  });

  test("ArrowDown and Enter copy the next reference after dismissing submitted context", async ({
    reactGrab,
    page,
  }) => {
    await installClipboardRecorder(page);
    await reactGrab.activate();
    await reactGrab.hoverUntilTargetSelected("[data-testid='todo-list'] li:first-child span");
    await page.keyboard.press("ArrowUp");
    await page.keyboard.press("Enter");
    await expect(page.locator(pillPromptSelector)).toBeFocused();
    const reference = await reactGrab.getClipboardContent();
    await page.keyboard.type("make this blue");
    await page.keyboard.press("Enter");
    await expect.poll(() => reactGrab.getClipboardContent()).toBe(`make this blue\n${reference}`);
    await expect(page.locator(pillPromptSelector)).toHaveCount(0);
    await page.keyboard.press("Escape");
    await page.keyboard.press("ArrowDown");
    const nextSelection = await page.evaluate(() =>
      window.__REACT_GRAB__?.getState().targetElement?.tagName.toLowerCase(),
    );
    await page.keyboard.press("Enter");
    await expect.poll(() => getCopyEventCount(page)).toBe(3);
    const nextReference = await reactGrab.getClipboardContent();
    expect(nextReference).toContain(`[<${nextSelection}`);
    expect(nextReference).not.toContain("make this blue");
    expect(nextReference).not.toBe(reference);
    await expect(page.locator(pillPromptSelector)).toBeFocused();
  });

  test("Enter commits every element in a Shift multi-selection only once", async ({
    reactGrab,
    page,
  }) => {
    await installClipboardRecorder(page);
    await reactGrab.activate();
    await page.keyboard.down("Shift");
    try {
      for (const selector of [
        "[data-testid='todo-list'] li:first-child span",
        "[data-testid='todo-list'] li:nth-child(2) span",
      ]) {
        await reactGrab.hoverUntilTargetSelected(selector);
        await page.mouse.down();
        await page.mouse.up();
      }
      await expect(
        page.locator("[data-react-grab-selection-label]:not([data-react-grab-label-instance])"),
      ).toHaveCount(2);
      await page.keyboard.press("Enter");
      await expect.poll(() => getCopyEventCount(page)).toBe(1);
      await expect(page.locator(pillPromptSelector)).toBeFocused();
      const reference = await reactGrab.getClipboardContent();
      expect(reference).toContain("Buy groceries");
      expect(reference).toContain("Walk the dog");
    } finally {
      await page.keyboard.up("Shift");
    }
    expect(await getCopyEventCount(page)).toBe(1);
    expect(await reactGrab.isPromptModeActive()).toBe(false);
  });

  test("Enter copies a frozen marquee selection while the pointer rests on the toolbar", async ({
    reactGrab,
    page,
  }) => {
    await installClipboardRecorder(page);
    await page.evaluate(() => {
      window.__REACT_GRAB__?.registerPlugin({
        name: "freeze-selection",
        actions: [
          {
            id: "freeze-selection",
            label: "Freeze selection",
            showInToolbarMenu: true,
            onAction: () => {},
          },
        ],
      });
      window.__REACT_GRAB__?.setToolbarState({ defaultAction: "freeze-selection" });
    });
    await reactGrab.clickToolbarAction("freeze-selection");
    await reactGrab.dragSelect(
      "[data-testid='todo-list'] li:first-child span",
      "[data-testid='todo-list'] li:nth-child(2) span",
    );
    await expect(
      page.locator("[data-react-grab-selection-label]:not([data-react-grab-label-instance])"),
    ).toHaveCount(2);
    expect(await getCopyEventCount(page)).toBe(0);

    await page.locator('[data-react-grab-toolbar-action="freeze-selection"]').hover();
    await page.keyboard.press("Enter");

    await expect.poll(() => getCopyEventCount(page)).toBe(1);
    const reference = await reactGrab.getClipboardContent();
    expect(reference).toContain("Buy groceries");
    expect(reference).toContain("Walk the dog");
    await expect(page.locator(pillPromptSelector)).toBeFocused();
    expect(await reactGrab.isPromptModeActive()).toBe(false);
  });

  test("Enter with no hovered or selected element does nothing", async ({ reactGrab, page }) => {
    await installClipboardRecorder(page);
    await page.evaluate(() => document.body.setAttribute("data-react-grab-ignore", ""));
    await page.mouse.move(0, 0);
    await reactGrab.activate();
    await expect
      .poll(() => page.evaluate(() => window.__REACT_GRAB__?.getState().targetElement ?? null))
      .toBe(null);
    await page.keyboard.press("Enter");
    expect(await getCopyEventCount(page)).toBe(0);
    expect(await reactGrab.isPromptModeActive()).toBe(false);
    await expect(page.locator("[data-react-grab-completion]")).toHaveCount(0);
  });

  test("an Enter copy focuses context without scrolling", async ({ reactGrab, page }) => {
    await reactGrab.activate();
    await reactGrab.hoverUntilSelected("[data-testid='todo-list'] li:first-child span");
    const scrollPosition = await page.evaluate(() => ({ x: window.scrollX, y: window.scrollY }));
    await page.keyboard.press("Enter");
    await expect(page.locator(pillPromptSelector)).toBeFocused();
    expect(await page.evaluate(() => ({ x: window.scrollX, y: window.scrollY }))).toEqual(
      scrollPosition,
    );
  });

  for (const restackHost of [false, true]) {
    const title = restackHost
      ? "restacking the host preserves focus and a trusted composing Enter"
      : "trusted Enter during IME composition never submits or copies";
    test(title, async ({ reactGrab, page }) => {
      await page.clock.install({ time: new Date(0) });
      await page.clock.pauseAt(Date.now());
      await reactGrab.reinitialize();
      await installClipboardRecorder(page);
      await reactGrab.activate();
      await page.locator(targetSelector).hover({ force: true });
      await page.clock.runFor(POINTER_SETTLE_DELAY_MS);
      await page.keyboard.press("Enter");
      await expect(page.locator(pillPromptSelector)).toBeFocused();
      const host = reactGrab.getOverlayHost();
      await host.evaluate((element) => document.body.moveBefore(element, null));
      const isHostLast = () =>
        host.evaluate((element) => element === document.body.lastElementChild);
      const browserSession = await page.context().newCDPSession(page);
      await browserSession.send("Input.imeSetComposition", {
        text: "青",
        selectionStart: 1,
        selectionEnd: 1,
      });
      const wasHostLast = await host.evaluate((element, shouldRestack) => {
        if (shouldRestack) document.body.append(document.createElement("div"));
        return element === document.body.lastElementChild;
      }, restackHost);
      expect(wasHostLast).toBe(!restackHost);
      await page.clock.fastForward(MOUNT_ROOT_RECHECK_DELAY_MS);
      expect(await isHostLast()).toBe(true);
      await expect(page.locator(pillPromptSelector)).toBeFocused();
      await page.locator(pillPromptSelector).evaluate((textarea) => {
        textarea.addEventListener(
          "keydown",
          (event) => {
            if (event instanceof KeyboardEvent)
              document.documentElement.dataset.composingEnter = String(
                event.isTrusted && event.isComposing,
              );
          },
          { once: true },
        );
      });
      await page.keyboard.press("Enter");
      await expect(page.locator("html")).toHaveAttribute("data-composing-enter", "true");
      expect(await page.locator(pillPromptSelector).inputValue()).toContain("青");
      expect(await getCopyEventCount(page)).toBe(1);
      expect(await reactGrab.isPromptModeActive()).toBe(false);
      await browserSession.send("Input.imeSetComposition", {
        text: "",
        selectionStart: 0,
        selectionEnd: 0,
      });
      await browserSession.detach();
    });
  }
});

test.describe("Enter and Escape review corrections", () => {
  const targetSelector = "[data-testid='todo-list'] h1";
  const promptSelector = "[data-react-grab-pill-prompt] textarea";
  const completionSelector = "[data-react-grab-completion]";

  for (const pageControl of ["input", "dialog"]) {
    test(`Grab off leaves Escape to the page ${pageControl}`, async ({ reactGrab, page }) => {
      await page.evaluate(() => {
        const previousInput = document.createElement("input");
        document.body.append(previousInput);
        previousInput.focus();
      });
      await reactGrab.activate();
      await reactGrab.hoverUntilSelected(targetSelector);
      await page.mouse.down();
      await page.mouse.up();
      await expect(page.locator(promptSelector)).toBeFocused();
      await page.evaluate((control) => {
        window.__REACT_GRAB__?.deactivate();
        const input = document.createElement("input");
        input.id = "review-page-input";
        if (control === "dialog") {
          const dialog = document.createElement("dialog");
          dialog.append(input);
          document.body.append(dialog);
          dialog.showModal();
        } else {
          document.body.append(input);
        }
        input.focus();
        document.addEventListener("keydown", (event) => {
          if (event.key === "Escape") {
            document.documentElement.dataset.reviewEscape = String(event.defaultPrevented);
          }
        });
      }, pageControl);
      await page.keyboard.press("Escape");
      await expect(page.locator("html")).toHaveAttribute("data-review-escape", "false");
      if (pageControl === "dialog") {
        await expect(page.locator("dialog")).not.toHaveAttribute("open", "");
      } else {
        await expect(page.locator("#review-page-input")).toBeFocused();
      }
      await expect(page.locator(completionSelector)).toHaveCount(0);
    });
  }

  test("two quick Escapes dismiss the pill then deactivate during its fade", async ({
    reactGrab,
    page,
  }) => {
    await reactGrab.activate();
    await reactGrab.hoverUntilSelected(targetSelector);
    await page.keyboard.press("Enter");
    await expect(page.locator(promptSelector)).toBeFocused();
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");
    await expect.poll(() => page.evaluate(() => window.__REACT_GRAB__?.isActive())).toBe(false);
    await expect(page.locator(completionSelector)).toHaveCount(0);
  });

  for (const modifier of ["Control", "Meta"]) {
    test(`hold Enter ignores its own ${modifier} modifier and submits after release`, async ({
      reactGrab,
      page,
    }) => {
      await reactGrab.updateOptions({
        activationMode: "hold",
        activationKey: `${modifier}+${NON_NATIVE_ACTIVATION_KEY}`,
      });
      await page.keyboard.down(modifier);
      await page.keyboard.down(NON_NATIVE_ACTIVATION_KEY);
      try {
        await expect.poll(() => page.evaluate(() => window.__REACT_GRAB__?.isActive())).toBe(true);
        await reactGrab.hoverUntilSelected(targetSelector);
        await page.keyboard.press("Alt+Enter");
        await expect(page.locator(completionSelector)).toHaveCount(0);
        await page.keyboard.press("Enter");
        await expect(page.locator(promptSelector)).toBeFocused();
      } finally {
        await page.keyboard.up(NON_NATIVE_ACTIVATION_KEY);
        await page.keyboard.up(modifier);
      }
      await expect.poll(() => page.evaluate(() => window.__REACT_GRAB__?.isActive())).toBe(false);
      await expect(page.locator(promptSelector)).toBeFocused();
      await page.keyboard.type("review context");
      const readClipboard = await reactGrab.captureNextClipboardWrites();
      await page.keyboard.press("Enter");
      const clipboard = await readClipboard();
      expect(clipboard["text/plain"]).toContain("review context");
      expect(clipboard["text/plain"]).toContain("Todo List");
      await expect(page.locator(completionSelector)).toContainText("Copied with prompt");
      expect(await page.evaluate(() => window.__REACT_GRAB__?.isActive())).toBe(false);
    });
  }

  test("armed api.comment opens context instead of copying on Enter", async ({
    reactGrab,
    page,
  }) => {
    await installClipboardRecorder(page);
    await page.evaluate(() => window.__REACT_GRAB__?.comment());
    await reactGrab.hoverUntilSelected(targetSelector);
    await page.keyboard.press("Enter");
    await expect.poll(() => reactGrab.isPromptModeActive()).toBe(true);
    expect(await getCopyEventCount(page)).toBe(0);
  });

  test("hold Enter rejects extra Shift even with a Shift multi-selection", async ({
    reactGrab,
    page,
  }) => {
    await installClipboardRecorder(page);
    await reactGrab.updateOptions({
      activationMode: "hold",
      activationKey: `Meta+${NON_NATIVE_ACTIVATION_KEY}`,
    });
    await page.keyboard.down("Meta");
    await page.keyboard.down(NON_NATIVE_ACTIVATION_KEY);
    try {
      await expect.poll(() => page.evaluate(() => window.__REACT_GRAB__?.isActive())).toBe(true);
      await reactGrab.hoverUntilSelected(targetSelector);
      await page.keyboard.down("Shift");
      await page.mouse.down();
      await page.mouse.up();
      await expect(
        page.locator("[data-react-grab-selection-label]:not([data-react-grab-label-instance])"),
      ).toHaveCount(1);
      await page.keyboard.press("Enter");
      expect(await getCopyEventCount(page)).toBe(0);
      await expect(page.locator("[data-react-grab-label-instance]")).toHaveCount(0);
      await page.keyboard.up("Shift");
      await expect.poll(() => getCopyEventCount(page)).toBe(1);
      await expect.poll(() => reactGrab.getClipboardContent()).toContain("Todo List");
    } finally {
      await page.keyboard.up("Shift");
      await page.keyboard.up(NON_NATIVE_ACTIVATION_KEY);
      await page.keyboard.up("Meta");
    }
  });

  test("toggle Enter never clicks a focused page button during slow copy", async ({
    reactGrab,
    page,
  }) => {
    await page.evaluate(() => {
      const button = document.createElement("button");
      button.textContent = "Review page action";
      button.addEventListener("click", () => {
        document.documentElement.dataset.reviewClicked = "true";
      });
      document.body.append(button);
      button.focus();
      const copyGate = new Promise<void>((resolve) => {
        const reviewWindow: ReviewCopyWindow = window;
        reviewWindow.releaseReviewCopy = resolve;
      });
      window.__REACT_GRAB__?.registerPlugin({
        name: "review-copy-gate",
        hooks: {
          onBeforeCopy: () => {
            document.documentElement.dataset.reviewCopyPending = "true";
            return copyGate;
          },
        },
      });
    });
    await reactGrab.activate();
    await reactGrab.hoverUntilSelected(targetSelector);
    await page.keyboard.press("Enter");
    await expect(page.locator("html")).toHaveAttribute("data-review-copy-pending", "true");
    await page.keyboard.down("Enter");
    await page.keyboard.down("Enter");
    await page.keyboard.up("Enter");
    await expect(page.locator("html")).not.toHaveAttribute("data-review-clicked");
    await page.evaluate(() => {
      const reviewWindow: ReviewCopyWindow = window;
      reviewWindow.releaseReviewCopy?.();
    });
    await expect(page.locator(promptSelector)).toBeFocused();
  });

  test("page input retains arrows and Enter while Grab is active", async ({ reactGrab, page }) => {
    await installClipboardRecorder(page);
    await page.evaluate(() => {
      const input = document.createElement("input");
      input.id = "review-page-input";
      document.body.append(input);
      input.focus();
      document.addEventListener("keydown", (event) => {
        if (event.code === "Enter" || event.code === "ArrowDown") {
          document.documentElement.setAttribute(
            `data-review-${event.code}`,
            String(event.defaultPrevented),
          );
        }
      });
    });
    await reactGrab.activate();
    await reactGrab.hoverUntilSelected(targetSelector);
    await page.keyboard.press("ArrowDown");
    await expect(page.locator("html")).toHaveAttribute("data-review-arrowdown", "false");
    await page.keyboard.press("Enter");
    await expect(page.locator("html")).toHaveAttribute("data-review-enter", "false");
    await expect(page.locator("#review-page-input")).toBeFocused();
    expect(await getCopyEventCount(page)).toBe(0);
    expect((await reactGrab.getSelectionLabelInfo()).tagName).toBe("h1");
  });

  test("toolbar popover takes Escape before the pill and the session", async ({
    reactGrab,
    page,
  }) => {
    await page.evaluate(() =>
      window.__REACT_GRAB__?.registerPlugin({
        name: "review-menu-choice",
        actions: [
          {
            id: "review-choice",
            label: "Review choice",
            showInToolbarMenu: true,
            onAction: () => {},
          },
        ],
      }),
    );
    await reactGrab.activate();
    await reactGrab.hoverUntilSelected(targetSelector);
    await page.keyboard.press("Enter");
    await expect(page.locator(promptSelector)).toBeFocused();
    await page.locator('[data-react-grab-toolbar-action="copy"]').click({ button: "right" });
    await expect(page.locator("[data-react-grab-toolbar-menu]")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator("[data-react-grab-toolbar-menu]")).toHaveCount(0);
    await expect(page.locator(completionSelector)).toBeVisible();
    expect(await page.evaluate(() => window.__REACT_GRAB__?.isActive())).toBe(true);
    await page.keyboard.press("Escape");
    await expect(page.locator(completionSelector)).toHaveCount(0);
    expect(await page.evaluate(() => window.__REACT_GRAB__?.isActive())).toBe(true);
    await page.keyboard.press("Escape");
    await expect.poll(() => page.evaluate(() => window.__REACT_GRAB__?.isActive())).toBe(false);
  });

  test("Enter over the toolbar never copies a stale page target", async ({ reactGrab, page }) => {
    await installClipboardRecorder(page);
    await reactGrab.activate();
    await reactGrab.hoverUntilSelected(targetSelector);
    await page.locator('[data-react-grab-toolbar-action="copy"]').hover();
    await page.keyboard.press("Enter");
    expect(await getCopyEventCount(page)).toBe(0);
    await expect(page.locator(completionSelector)).toHaveCount(0);
    await expect(page.locator("[data-react-grab-label-instance]")).toHaveCount(0);
  });

  test("the copied pill keeps the hierarchy closed until Escape", async ({ reactGrab, page }) => {
    await reactGrab.activate();
    await reactGrab.hoverUntilSelected(targetSelector);
    await page.keyboard.press("Enter");
    await expect(page.locator(promptSelector)).toBeFocused();
    await page.keyboard.press("ArrowUp");
    await expect(page.locator("[data-react-grab-hierarchy-menu]")).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(page.locator(completionSelector)).toHaveCount(0);
    await page.keyboard.press("ArrowUp");
    await expect(page.locator("[data-react-grab-hierarchy-menu]")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator("[data-react-grab-hierarchy-menu]")).toHaveCount(0);
    expect(await page.evaluate(() => window.__REACT_GRAB__?.isActive())).toBe(true);
  });

  test("Specs value menu takes Escape before the copied pill even after losing focus", async ({
    reactGrab,
    page,
  }) => {
    await installSpecsFixture(page);
    await reactGrab.activate();
    await switchOnSpecs(page);
    await reactGrab.hoverUntilSelected("[data-testid='specs-plain-button']");
    await page.keyboard.press("Enter");
    await expect(page.locator(promptSelector)).toBeFocused();
    await pinAndReach(page, "padding");
    await specRow(page, "padding").locator("[data-react-grab-spec-menu-trigger]").focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("[data-react-grab-spec-value-menu]")).toBeVisible();
    await page.locator("body").focus();
    await page.keyboard.press("Escape");
    await expect(page.locator("[data-react-grab-spec-value-menu]")).toHaveCount(0);
    await expect(page.locator(completionSelector)).toBeVisible();
    expect(await page.evaluate(() => window.__REACT_GRAB__?.isActive())).toBe(true);
  });

  test("Enter over Specs never copies a stale page target", async ({ reactGrab, page }) => {
    await installClipboardRecorder(page);
    await reactGrab.activate();
    await switchOnSpecs(page);
    await reactGrab.hoverUntilSelected(targetSelector);
    await pinAndReach(page, "padding");
    await page.keyboard.press("Enter");
    expect(await getCopyEventCount(page)).toBe(0);
    await expect(page.locator("[data-react-grab-label-instance]")).toHaveCount(0);
  });

  test("Enter over a pill never copies a different stale page target", async ({
    reactGrab,
    page,
  }) => {
    await installClipboardRecorder(page);
    await reactGrab.activate();
    await reactGrab.hoverUntilSelected(targetSelector);
    await page.keyboard.press("Enter");
    await expect(page.locator(promptSelector)).toBeFocused();
    await reactGrab.hoverElement("[data-testid='todo-list'] li:first-child span");
    await page.locator(promptSelector).hover();
    await page.keyboard.press("Enter");
    expect(await getCopyEventCount(page)).toBe(1);
    await expect(page.locator(completionSelector)).toHaveCount(1);
    await expect(page.locator("[data-react-grab-label-instance]")).toHaveCount(1);
  });

  test("Grab off owns Escape in a focused context field until the pill is dismissed", async ({
    reactGrab,
    page,
  }) => {
    await page.evaluate(() => {
      const button = document.createElement("button");
      button.id = "review-return-focus";
      document.body.append(button);
      button.focus();
    });
    await reactGrab.updateOptions({
      activationMode: "hold",
      activationKey: NON_NATIVE_ACTIVATION_KEY,
    });
    await page.keyboard.down(NON_NATIVE_ACTIVATION_KEY);
    await expect.poll(() => page.evaluate(() => window.__REACT_GRAB__?.isActive())).toBe(true);
    await reactGrab.hoverUntilSelected(targetSelector);
    await page.keyboard.press("Enter");
    await expect(page.locator(promptSelector)).toBeFocused();
    await page.keyboard.up(NON_NATIVE_ACTIVATION_KEY);
    await expect.poll(() => page.evaluate(() => window.__REACT_GRAB__?.isActive())).toBe(false);
    await page.keyboard.type("context while off");
    await page.evaluate(() =>
      document.addEventListener("keydown", (event) => {
        if (event.key === "Escape")
          document.documentElement.dataset.reviewEscape = String(event.defaultPrevented);
      }),
    );
    await page.keyboard.press("Escape");
    await expect(page.locator(promptSelector)).toHaveValue("");
    await expect(page.locator(promptSelector)).toBeFocused();
    await expect(page.locator(completionSelector)).toBeVisible();
    await expect(page.locator("html")).not.toHaveAttribute("data-review-escape");
    await page.keyboard.press("Escape");
    await expect(page.locator(completionSelector)).toHaveCount(0);
    await expect(page.locator("#review-return-focus")).toBeFocused();
    await expect(page.locator("html")).not.toHaveAttribute("data-review-escape");
  });

  test("toolbar activation copies the arrow selection without moving the pointer", async ({
    reactGrab,
    page,
  }) => {
    await page.evaluate(() => navigator.clipboard.writeText(""));
    await page.locator('[data-react-grab-toolbar-action="copy"]').click();
    await page.keyboard.press("ArrowDown");
    await reactGrab.waitForSelectionBox();
    const selectedTagName = (await reactGrab.getSelectionLabelInfo()).tagName;
    expect(selectedTagName).toBeTruthy();
    await page.keyboard.press("Enter");
    await expect(page.locator(promptSelector)).toBeFocused();
    await expect.poll(() => reactGrab.getClipboardContent()).toContain(`[<${selectedTagName}`);
  });

  test("Enter hit tests the page exposed by Dismiss without a pointer move", async ({
    reactGrab,
    page,
  }) => {
    await installClipboardRecorder(page);
    await reactGrab.activate();
    await reactGrab.hoverUntilSelected(targetSelector);
    await page.keyboard.press("Enter");
    await expect(page.locator(promptSelector)).toBeFocused();
    await page.getByRole("button", { name: "Dismiss", exact: true }).click();
    await expect(page.locator(completionSelector)).toHaveCount(0);
    await page.keyboard.press("Enter");
    await expect.poll(() => getCopyEventCount(page)).toBe(2);
    await expect(page.locator(promptSelector)).toBeFocused();
  });

  test("Enter is not blocked after the pointer leaves the window over the toolbar", async ({
    reactGrab,
    page,
  }) => {
    await installClipboardRecorder(page);
    await reactGrab.activate();
    await reactGrab.hoverUntilSelected(targetSelector);
    await page.locator('[data-react-grab-toolbar-action="copy"]').hover();
    await page.mouse.move(OUTSIDE_WINDOW_POSITION_PX.x, OUTSIDE_WINDOW_POSITION_PX.y);
    await page.keyboard.press("Enter");
    await expect.poll(() => getCopyEventCount(page)).toBe(1);
  });

  test("hold release restores page focus after the copied pill is dismissed", async ({
    reactGrab,
    page,
  }) => {
    await page.evaluate(() => {
      const button = document.createElement("button");
      button.id = "review-return-focus";
      document.body.append(button);
      button.focus();
    });
    await reactGrab.updateOptions({
      activationMode: "hold",
      activationKey: NON_NATIVE_ACTIVATION_KEY,
    });
    await page.keyboard.down(NON_NATIVE_ACTIVATION_KEY);
    try {
      await expect.poll(() => page.evaluate(() => window.__REACT_GRAB__?.isActive())).toBe(true);
      await reactGrab.hoverUntilSelected(targetSelector);
      await page.keyboard.press("Enter");
      await expect(page.locator(promptSelector)).toBeFocused();
      await page.getByRole("button", { name: "Dismiss", exact: true }).click();
      await expect(page.locator(completionSelector)).toHaveCount(0);
    } finally {
      await page.keyboard.up(NON_NATIVE_ACTIVATION_KEY);
    }
    await expect.poll(() => page.evaluate(() => window.__REACT_GRAB__?.isActive())).toBe(false);
    await expect(page.locator("#review-return-focus")).toBeFocused();
  });

  test("hold release checks current field focus rather than the last Enter copy", async ({
    reactGrab,
    page,
  }) => {
    await page.evaluate(() => {
      for (const buttonId of ["review-return-focus", "review-other-focus"]) {
        const button = document.createElement("button");
        button.id = buttonId;
        document.body.append(button);
      }
      document.getElementById("review-return-focus")?.focus();
    });
    await reactGrab.updateOptions({
      activationMode: "hold",
      activationKey: NON_NATIVE_ACTIVATION_KEY,
    });
    await page.keyboard.down(NON_NATIVE_ACTIVATION_KEY);
    try {
      await expect.poll(() => page.evaluate(() => window.__REACT_GRAB__?.isActive())).toBe(true);
      await reactGrab.hoverUntilSelected(targetSelector);
      await page.keyboard.press("Enter");
      await expect(page.locator(promptSelector)).toBeFocused();
      await page.locator("#review-other-focus").focus();
      await expect(page.locator("#review-other-focus")).toBeFocused();
    } finally {
      await page.keyboard.up(NON_NATIVE_ACTIVATION_KEY);
    }
    await expect.poll(() => page.evaluate(() => window.__REACT_GRAB__?.isActive())).toBe(false);
    await expect(page.locator("#review-return-focus")).toBeFocused();
  });

  test("context submitted with Grab off releases focus and the next activation starts clean", async ({
    reactGrab,
    page,
  }) => {
    await page.evaluate(() => {
      const button = document.createElement("button");
      button.id = "review-return-focus";
      button.textContent = "Page focus target";
      document.body.append(button);
      button.focus();
    });
    await reactGrab.updateOptions({
      activationMode: "hold",
      activationKey: NON_NATIVE_ACTIVATION_KEY,
    });
    await page.keyboard.down(NON_NATIVE_ACTIVATION_KEY);
    try {
      await expect.poll(() => page.evaluate(() => window.__REACT_GRAB__?.isActive())).toBe(true);
      await reactGrab.hoverUntilSelected(targetSelector);
      await page.keyboard.press("Enter");
      await expect(page.locator(promptSelector)).toBeFocused();
    } finally {
      await page.keyboard.up(NON_NATIVE_ACTIVATION_KEY);
    }
    await expect.poll(() => page.evaluate(() => window.__REACT_GRAB__?.isActive())).toBe(false);
    await page.keyboard.type("context while off");
    await page.keyboard.press("Enter");
    await expect(page.locator(completionSelector)).toContainText("Copied with prompt");
    await expect(page.locator(promptSelector)).toHaveCount(0);
    expect(
      await page.evaluate(() => Boolean(document.activeElement?.shadowRoot?.activeElement)),
    ).toBe(false);
    await page.locator("#review-return-focus").click();
    await expect(page.locator(completionSelector)).toHaveCount(0);
    await reactGrab.activate();
    await expect(page.locator(promptSelector)).toHaveCount(0);
    expect(await reactGrab.isPromptModeActive()).toBe(false);
    await reactGrab.hoverUntilSelected(targetSelector);
    await page.keyboard.press("Enter");
    await expect(page.locator(promptSelector)).toHaveValue("");
    await expect(page.locator(promptSelector)).toBeFocused();
  });
});
