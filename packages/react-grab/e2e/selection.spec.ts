import { TOGGLE_OFF_TAP_MAX_MS } from "../src/constants.js";
import { test, expect, type ReactGrabPageObject } from "./fixtures.js";
import {
  ATTRIBUTE_NAME,
  MARQUEE_START_PX,
  MARQUEE_END_PX,
  MARQUEE_FIRST_MOVE_PX,
  MARQUEE_RESIZE_PX,
  MARQUEE_SECOND_MOVE_PX,
  MARQUEE_SOURCE_BOX_PX,
  MARQUEE_TARGET_BOX_PX,
  MARQUEE_MOVE_STEP_COUNT,
  MARQUEE_SCROLL_SETTLE_MS,
  MARQUEE_PAGE_HEIGHT_PX,
  MARQUEE_TARGET_Z_INDEX,
  MARQUEE_EDGE_INSET_PX,
} from "./constants.js";

declare global {
  interface Window {
    __INTERCEPTED_ACTION_RUN_COUNT__?: number;
  }
}

const armInterceptedToolbarAction = async (reactGrab: ReactGrabPageObject) => {
  await reactGrab.page.evaluate(() => {
    let hasInterceptedSelect = false;
    window.__INTERCEPTED_ACTION_RUN_COUNT__ = 0;
    window.__REACT_GRAB__?.registerPlugin({
      name: "intercept-first-select",
      actions: [
        {
          id: "intercepted-action",
          label: "Intercepted",
          showInToolbarMenu: true,
          onAction: () => {
            window.__INTERCEPTED_ACTION_RUN_COUNT__ =
              (window.__INTERCEPTED_ACTION_RUN_COUNT__ ?? 0) + 1;
          },
        },
      ],
      hooks: {
        onElementSelect: () => {
          if (hasInterceptedSelect) return false;
          hasInterceptedSelect = true;
          return true;
        },
      },
    });
    window.__REACT_GRAB__?.setToolbarState({ defaultAction: "intercepted-action" });
  });
  await reactGrab.clickToolbarAction("intercepted-action");
  expect(await reactGrab.getToolbarActionPressed("intercepted-action")).toBe(true);
};

const expectInterceptedPickClearedPendingAction = async (reactGrab: ReactGrabPageObject) => {
  await expect.poll(() => reactGrab.getToolbarActionPressed("intercepted-action")).toBe(false);
  await reactGrab.clickElement("[data-testid='todo-list'] h1");
  await expect.poll(() => reactGrab.getLabelStatusText()).toBe("Copied");
  expect(await reactGrab.page.evaluate(() => window.__INTERCEPTED_ACTION_RUN_COUNT__)).toBe(0);
  await expect(reactGrab.page.locator("[data-react-grab-context-menu]")).toHaveCount(0);
};

test.describe("Element Selection", () => {
  test("should show selection box when hovering over element while active", async ({
    reactGrab,
  }) => {
    await reactGrab.activate();
    await reactGrab.hoverUntilSelected("li");

    const hasSelectionContent = await reactGrab.page.evaluate((attrName) => {
      const host = document.querySelector(`[${attrName}]`);
      const shadowRoot = host?.shadowRoot;
      if (!shadowRoot) return false;
      const root = shadowRoot.querySelector(`[${attrName}]`);
      return root !== null && root.innerHTML.length > 0;
    }, ATTRIBUTE_NAME);

    expect(hasSelectionContent).toBe(true);
  });

  test("should copy element content to clipboard on click", async ({ reactGrab }) => {
    await reactGrab.activate();
    await reactGrab.hoverUntilSelected("li");

    await reactGrab.clickElement("li");
    await expect.poll(() => reactGrab.getClipboardContent()).toBeTruthy();

    const clipboardContent = await reactGrab.getClipboardContent();
    expect(clipboardContent.length).toBeGreaterThan(0);
  });

  test("should copy heading element to clipboard", async ({ reactGrab }) => {
    await reactGrab.activate();
    await reactGrab.hoverUntilSelected("[data-testid='todo-list'] h1");

    await reactGrab.clickElement("[data-testid='todo-list'] h1");
    await expect.poll(() => reactGrab.getClipboardContent()).toContain("Todo List");
  });

  test("should write React Grab clipboard metadata on copy", async ({ reactGrab }) => {
    await reactGrab.activate();
    await reactGrab.hoverUntilSelected("[data-testid='todo-list'] h1");

    const waitForCopyPayload = await reactGrab.captureNextClipboardWrites();
    await reactGrab.clickElement("[data-testid='todo-list'] h1");
    const copyPayload = await waitForCopyPayload();
    const clipboardMetadataText = copyPayload["application/x-react-grab"];
    if (!clipboardMetadataText) {
      throw new Error("Missing React Grab clipboard metadata");
    }

    const clipboardMetadata = JSON.parse(clipboardMetadataText);
    expect(clipboardMetadata.content).toContain("Todo List");
    expect(clipboardMetadata.entries).toHaveLength(1);
    expect(clipboardMetadata.entries[0].content).toContain("Todo List");
    expect(clipboardMetadata.entries[0].source).toMatchObject({
      componentName: "TodoList",
      filePath: "App.tsx",
      origin: "app",
    });
    expect(clipboardMetadata.entries[0].stackContext).toContain("TodoList");
    expect(Array.isArray(clipboardMetadata.entries[0].frames)).toBe(true);
    expect(clipboardMetadata.entries[0].frames.length).toBeGreaterThan(0);
  });

  // PR #349 ("fix: keep page interactive while grabbing") intentionally
  // stopped treating the copying state as a global selection-interaction
  // lock so that clicks, scrolling, and native text selection on the page
  // continue to work while React Grab finishes a slow copy hook.
  test("should keep page interactive (allowing text selection) while a copy is pending", async ({
    reactGrab,
  }) => {
    await reactGrab.page.evaluate(() => {
      const api = (
        window as {
          __REACT_GRAB__?: {
            unregisterPlugin: (name: string) => void;
            registerPlugin: (plugin: Record<string, unknown>) => void;
          };
        }
      ).__REACT_GRAB__;
      api?.unregisterPlugin("pending-copy-hook");
      api?.registerPlugin({
        name: "pending-copy-hook",
        hooks: {
          onBeforeCopy: () => new Promise<void>(() => {}),
        },
      });
    });

    await reactGrab.activate();
    await reactGrab.hoverUntilSelected("[data-testid='main-description']");
    await reactGrab.clickElement("[data-testid='main-description']");

    await expect
      .poll(async () => {
        const state = await reactGrab.getState();
        return state.isCopying;
      })
      .toBe(true);

    const description = reactGrab.page.locator("[data-testid='main-description']");
    const descriptionBounds = await description.boundingBox();
    if (!descriptionBounds) {
      throw new Error("Could not get main description bounds");
    }

    await reactGrab.page.mouse.move(
      descriptionBounds.x + 5,
      descriptionBounds.y + descriptionBounds.height / 2,
    );
    await reactGrab.page.mouse.down();
    await reactGrab.page.mouse.move(
      descriptionBounds.x + descriptionBounds.width - 5,
      descriptionBounds.y + descriptionBounds.height / 2,
      { steps: 8 },
    );
    await reactGrab.page.mouse.up();

    const selectedText = await reactGrab.page.evaluate(() => {
      return window.getSelection()?.toString().trim() ?? "";
    });
    expect(selectedText).not.toBe("");
  });

  test("should highlight different elements when hovering", async ({ reactGrab }) => {
    await reactGrab.activate();

    await reactGrab.hoverUntilSelected("h1");

    await reactGrab.hoverUntilSelected("li:first-child");

    await reactGrab.hoverUntilSelected("ul");

    const isVisible = await reactGrab.isOverlayVisible();
    expect(isVisible).toBe(true);
  });

  test("should stay active after successful copy in toggle mode", async ({ reactGrab }) => {
    await reactGrab.activate();
    await reactGrab.hoverElement("li");
    await reactGrab.clickElement("li");

    await expect.poll(() => reactGrab.getClipboardContent()).toBeTruthy();
    await expect.poll(() => reactGrab.isOverlayVisible()).toBe(true);
  });

  test("should not show selection when inactive", async ({ reactGrab }) => {
    const isVisibleBefore = await reactGrab.isOverlayVisible();
    expect(isVisibleBefore).toBe(false);

    await reactGrab.hoverElement("li");

    const isVisibleAfter = await reactGrab.isOverlayVisible();
    expect(isVisibleAfter).toBe(false);
  });

  test("should select nested elements correctly", async ({ reactGrab }) => {
    await reactGrab.activate();

    await reactGrab.hoverUntilSelected("li:nth-child(3)");
    await reactGrab.clickElement("li:nth-child(3)");

    await expect.poll(() => reactGrab.getClipboardContent()).toBeTruthy();
  });

  test("should maintain selection target while hovering", async ({ reactGrab }) => {
    await reactGrab.activate();

    const listItem = reactGrab.page.locator("li").first();
    const box = await listItem.boundingBox();
    if (!box) throw new Error("Could not get bounding box");

    await reactGrab.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await reactGrab.waitForSelectionBox();

    await reactGrab.page.mouse.move(box.x + box.width / 2 + 5, box.y + box.height / 2 + 5);
    await reactGrab.waitForSelectionBox();

    const isVisible = await reactGrab.isOverlayVisible();
    expect(isVisible).toBe(true);
  });
});

test.describe("Selection Bounds and Mutations", () => {
  test("selection box should update when element size changes", async ({ reactGrab }) => {
    await reactGrab.activate();
    await reactGrab.hoverUntilSelected("li:first-child");

    const initialBounds = await reactGrab.getSelectionBoxBounds();
    expect(initialBounds).not.toBeNull();

    await reactGrab.page.evaluate(() => {
      const element = document.querySelector("li:first-child") as HTMLElement;
      if (element) {
        element.style.height = "200px";
      }
    });

    await expect
      .poll(async () => {
        const bounds = await reactGrab.getSelectionBoxBounds();
        return bounds?.height ?? 0;
      })
      .toBeGreaterThan(initialBounds?.height ?? 0);
  });

  test("selection should handle element being hidden", async ({ reactGrab }) => {
    await reactGrab.activate();
    await reactGrab.hoverUntilSelected("[data-testid='toggleable-element']");

    await reactGrab.hideElement("[data-testid='toggleable-element']");

    await reactGrab.hoverUntilSelected("li:first-child");

    const isVisible = await reactGrab.isSelectionBoxVisible();
    expect(isVisible).toBe(true);
  });

  test("selection should recalculate after scroll", async ({ reactGrab }) => {
    await reactGrab.activate();
    await reactGrab.hoverUntilSelected("li:first-child");

    const boundsBefore = await reactGrab.getSelectionBoxBounds();

    await reactGrab.scrollPage(50);

    if (boundsBefore) {
      await expect
        .poll(async () => {
          const bounds = await reactGrab.getSelectionBoxBounds();
          return bounds?.y;
        })
        .not.toBe(boundsBefore.y);
    }
  });

  test("multiple selection boxes should display for drag selection", async ({ reactGrab }) => {
    await reactGrab.activate();
    await reactGrab.dragSelect("li:first-child", "li:nth-child(3)");
    await reactGrab.page.waitForTimeout(500);

    await expect
      .poll(async () => {
        const info = await reactGrab.getGrabbedBoxInfo();
        return info.count;
      })
      .toBeGreaterThan(1);
  });

  test("selection should work on deeply nested elements", async ({ reactGrab }) => {
    await reactGrab.activate();
    await reactGrab.hoverUntilSelected("[data-testid='deeply-nested-text']");

    await reactGrab.clickElement("[data-testid='deeply-nested-text']");

    await expect.poll(() => reactGrab.getClipboardContent()).toContain("deeply nested");
  });

  test("selects page content through a modal's body pointer-events:none", async ({
    reactGrab,
    page,
  }) => {
    // Open a Radix-style modal that sets `body { pointer-events: none }`.
    await page.locator("[data-testid='pe-modal-trigger']").click();
    await expect.poll(() => page.evaluate(() => document.body.style.pointerEvents)).toBe("none");

    await reactGrab.activate();
    // The hit-test override must see through the page's pointer-events:none so an
    // element outside the popover is still detectable. Without it,
    // elementsFromPoint returns nothing and selection never registers.
    await reactGrab.hoverUntilSelected("[data-testid='pe-outside-target']");
    expect(await reactGrab.isSelectionBoxVisible()).toBe(true);

    await reactGrab.clickElement("[data-testid='pe-outside-target']");
    await expect.poll(() => reactGrab.getClipboardContent()).toContain("outside the popover");
  });
});

test.describe("Persistent Grab sessions", () => {
  test("shortcut tap keeps Grab on for consecutive copies until the pill is dismissed and Escape leaves", async ({
    reactGrab,
    page,
  }) => {
    await reactGrab.activateViaKeyboard();
    await expect.poll(() => reactGrab.isOverlayVisible()).toBe(true);
    await reactGrab.hoverUntilSelected("[data-testid='todo-list'] h1");
    await reactGrab.clickElement("[data-testid='todo-list'] h1");
    await expect.poll(() => reactGrab.getClipboardContent()).toContain("Todo List");
    await expect.poll(() => reactGrab.isOverlayVisible()).toBe(true);
    await reactGrab.page.getByRole("button", { name: "Dismiss", exact: true }).click();
    await reactGrab.hoverUntilSelected("[data-testid='main-title']");
    await reactGrab.clickElement("[data-testid='main-title']");
    await expect.poll(() => reactGrab.getClipboardContent()).toContain("React Grab");
    await expect.poll(() => reactGrab.isOverlayVisible()).toBe(true);
    await page.keyboard.press("Escape");
    await expect(reactGrab.getOverlayHost().locator("[data-react-grab-completion]")).toHaveCount(0);
    await expect.poll(() => reactGrab.isOverlayVisible()).toBe(true);
    await page.keyboard.press("Escape");
    await expect.poll(() => reactGrab.isOverlayVisible()).toBe(false);
  });

  test("marquee and committed Shift selection keep Grab on", async ({ reactGrab, page }) => {
    await reactGrab.activate();
    await reactGrab.dragSelect(
      "[data-testid='todo-list'] li:first-child span",
      "[data-testid='todo-list'] li:nth-child(3) span",
    );
    await expect.poll(() => reactGrab.getClipboardContent()).toContain("TodoItem");
    await expect.poll(async () => (await reactGrab.getState()).isCopying).toBe(false);
    expect(await reactGrab.isOverlayVisible()).toBe(true);
    await page.keyboard.press("Escape");
    await page.evaluate(() => navigator.clipboard.writeText(""));
    await page.keyboard.down("Shift");
    await reactGrab.clickElement("[data-testid='todo-list'] li:first-child span");
    await reactGrab.clickElement("[data-testid='todo-list'] li:nth-child(2) span");
    await page.keyboard.up("Shift");
    await expect.poll(() => reactGrab.getClipboardContent()).toContain("TodoItem");
    await expect.poll(async () => (await reactGrab.getState()).isCopying).toBe(false);
    expect(await reactGrab.isOverlayVisible()).toBe(true);
    await reactGrab.pressEscape();
    await reactGrab.hoverUntilTargetSelected("h1");
  });

  test("click Copy keeps Grab on", async ({ reactGrab }) => {
    await reactGrab.activate();
    await reactGrab.hoverUntilSelected("[data-testid='todo-list'] h1");
    await reactGrab.clickElement("[data-testid='todo-list'] h1");
    await expect.poll(() => reactGrab.getClipboardContent()).toContain("Todo List");
    await expect.poll(async () => (await reactGrab.getState()).isCopying).toBe(false);
    expect(await reactGrab.isOverlayVisible()).toBe(true);
    await reactGrab.page.getByRole("button", { name: "Dismiss", exact: true }).click();
    await reactGrab.hoverUntilSelected("[data-testid='main-title']");
  });

  test("keyboard selection copy keeps Grab on", async ({ reactGrab, page }) => {
    await page.evaluate(() => {
      window.__REACT_GRAB__?.registerPlugin({
        name: "keyboard-copy-test",
        actions: [
          {
            id: "keyboard-copy-test",
            label: "Copy selection",
            shortcut: "c",
            shortcutModifier: false,
            onAction: (context) => context.copy?.(),
          },
        ],
      });
    });
    await reactGrab.activate();
    await reactGrab.hoverUntilSelected("[data-testid='todo-list'] h1");
    await page.keyboard.press("ArrowUp");
    await reactGrab.waitForSelectionBox();
    await page.keyboard.press("c");
    await expect.poll(() => reactGrab.getClipboardContent()).toContain("[<div");
    await expect.poll(async () => (await reactGrab.getState()).isCopying).toBe(false);
    expect(await reactGrab.isOverlayVisible()).toBe(true);
    await reactGrab.page.getByRole("button", { name: "Dismiss", exact: true }).click();
    await reactGrab.hoverUntilSelected("[data-testid='main-title']");
    await reactGrab.clickElement("[data-testid='main-title']");
    await expect.poll(() => reactGrab.getClipboardContent()).toContain("React Grab");
  });

  test("prompt submission keeps Grab on and restores hover", async ({ reactGrab }) => {
    await reactGrab.enterPromptMode("li:first-child");
    await reactGrab.typeInInput("Update this element");
    await reactGrab.submitInput();
    await expect.poll(() => reactGrab.getClipboardContent()).toContain("Update this element");
    await expect.poll(async () => (await reactGrab.getState()).isCopying).toBe(false);
    expect(await reactGrab.isOverlayVisible()).toBe(true);
    expect(await reactGrab.isPromptModeActive()).toBe(false);
    await reactGrab.pressEscape();
    await reactGrab.hoverUntilTargetSelected("h1");
  });
});

test("a successful plugin copy with feedback keeps Grab on", async ({ reactGrab, page }) => {
  await page.evaluate(() => {
    window.__REACT_GRAB__?.registerPlugin({
      name: "copy-tag-test",
      actions: [
        {
          id: "copy-tag-test",
          label: "Copy tag",
          shortcut: "K",
          shortcutModifier: false,
          onAction: (context) =>
            context.performWithFeedback(async () => {
              await navigator.clipboard.writeText(context.element.tagName);
              return true;
            }),
        },
      ],
    });
  });
  await reactGrab.activate();
  await reactGrab.hoverUntilSelected("[data-testid='todo-list'] h1");
  await reactGrab.pressKey("k");
  await expect.poll(() => reactGrab.getClipboardContent()).toBe("H1");
  await expect.poll(() => reactGrab.getLabelStatusText()).toBe("Copied");
  expect(await reactGrab.isOverlayVisible()).toBe(true);
  await reactGrab.pressEscape();
  await reactGrab.hoverUntilTargetSelected("[data-testid='todo-list'] li:first-child span");
});

test("tapping the shortcut again after a copy switches Grab off", async ({ reactGrab, page }) => {
  await reactGrab.activateViaKeyboard();
  await reactGrab.hoverUntilSelected("[data-testid='todo-list'] h1");
  await reactGrab.clickElement("[data-testid='todo-list'] h1");
  await expect.poll(() => reactGrab.getClipboardContent()).toContain("Todo List");
  await expect.poll(async () => (await reactGrab.getState()).isCopying).toBe(false);
  await page.keyboard.press(`${reactGrab.modifierKey}+c`);
  await expect.poll(() => reactGrab.isOverlayVisible()).toBe(false);
});

for (const tapDurationMs of [180, 400]) {
  test(`a ${tapDurationMs}ms human-length tap of the shortcut switches a toggled session off`, async ({
    reactGrab,
    page,
  }) => {
    await reactGrab.activateViaKeyboard();
    await expect.poll(() => reactGrab.isOverlayVisible()).toBe(true);
    await page.keyboard.down(reactGrab.modifierKey);
    await page.keyboard.down("c");
    await page.waitForTimeout(tapDurationMs);
    await page.keyboard.up("c");
    await page.keyboard.up(reactGrab.modifierKey);
    await expect.poll(() => reactGrab.isOverlayVisible()).toBe(false);
  });
}

test("a long deliberate hold of the shortcut leaves a toggled session on", async ({
  reactGrab,
  page,
}) => {
  await reactGrab.activateViaKeyboard();
  await expect.poll(() => reactGrab.isOverlayVisible()).toBe(true);
  await page.keyboard.down(reactGrab.modifierKey);
  await page.keyboard.down("c");
  await page.waitForTimeout(TOGGLE_OFF_TAP_MAX_MS + 200);
  await page.keyboard.up("c");
  await page.keyboard.up(reactGrab.modifierKey);
  await page.waitForTimeout(200);
  expect(await reactGrab.isOverlayVisible()).toBe(true);
});

test.describe("Space marquee movement", () => {
  test("normal marquee moves, resizes, and copies the moved targets", async ({
    reactGrab,
    page,
  }) => {
    await page.evaluate(
      ({ originalBox, movedBox, zIndex }) => {
        for (const target of [
          { label: "Original target", box: originalBox },
          { label: "Moved target", box: movedBox },
        ]) {
          const button = document.createElement("button");
          button.textContent = target.label;
          button.dataset.marqueeTarget = target.label;
          Object.assign(button.style, {
            position: "fixed",
            left: `${target.box.x}px`,
            top: `${target.box.y}px`,
            width: `${target.box.width}px`,
            height: `${target.box.height}px`,
            zIndex,
          });
          document.body.append(button);
        }
        document.body.dataset.marqueeSpaceEvents = "0";
        for (const eventName of ["keydown", "keypress", "keyup"]) {
          window.addEventListener(
            eventName,
            (event) => {
              if (event instanceof KeyboardEvent && event.code === "Space") {
                document.body.dataset.marqueeSpaceEvents = String(
                  Number(document.body.dataset.marqueeSpaceEvents) + 1,
                );
              }
            },
            { capture: true },
          );
        }
      },
      {
        originalBox: MARQUEE_SOURCE_BOX_PX,
        movedBox: MARQUEE_TARGET_BOX_PX,
        zIndex: MARQUEE_TARGET_Z_INDEX,
      },
    );
    await reactGrab.activate();
    await page.mouse.move(MARQUEE_START_PX.x, MARQUEE_START_PX.y);
    await page.mouse.down();
    await page.mouse.move(MARQUEE_END_PX.x, MARQUEE_END_PX.y, { steps: MARQUEE_MOVE_STEP_COUNT });
    const originalBounds = await reactGrab.getDragBoxBounds();
    expect(originalBounds).not.toBeNull();
    if (!originalBounds) throw new Error("Missing original marquee");
    await page.keyboard.down("Space");
    await page.mouse.move(
      MARQUEE_END_PX.x + MARQUEE_FIRST_MOVE_PX.x,
      MARQUEE_END_PX.y + MARQUEE_FIRST_MOVE_PX.y,
      { steps: MARQUEE_MOVE_STEP_COUNT },
    );
    await expect
      .poll(() => reactGrab.getDragBoxBounds())
      .toMatchObject({
        x: originalBounds.x + MARQUEE_FIRST_MOVE_PX.x,
        y: originalBounds.y + MARQUEE_FIRST_MOVE_PX.y,
        width: originalBounds.width,
        height: originalBounds.height,
      });
    await page.keyboard.down("Space");
    await page.keyboard.up("Space");
    const resizedEnd = {
      x: MARQUEE_END_PX.x + MARQUEE_FIRST_MOVE_PX.x + MARQUEE_RESIZE_PX.x,
      y: MARQUEE_END_PX.y + MARQUEE_FIRST_MOVE_PX.y + MARQUEE_RESIZE_PX.y,
    };
    await page.mouse.move(resizedEnd.x, resizedEnd.y, { steps: MARQUEE_MOVE_STEP_COUNT });
    await expect
      .poll(() => reactGrab.getDragBoxBounds())
      .toMatchObject({
        x: originalBounds.x + MARQUEE_FIRST_MOVE_PX.x,
        y: originalBounds.y + MARQUEE_FIRST_MOVE_PX.y,
        width: originalBounds.width + MARQUEE_RESIZE_PX.x,
        height: originalBounds.height + MARQUEE_RESIZE_PX.y,
      });
    await page.keyboard.down("Space");
    await page.mouse.move(
      resizedEnd.x + MARQUEE_SECOND_MOVE_PX.x,
      resizedEnd.y + MARQUEE_SECOND_MOVE_PX.y,
      { steps: MARQUEE_MOVE_STEP_COUNT },
    );
    await expect
      .poll(() => reactGrab.getDragBoxBounds())
      .toMatchObject({
        x: originalBounds.x + MARQUEE_FIRST_MOVE_PX.x + MARQUEE_SECOND_MOVE_PX.x,
        y: originalBounds.y + MARQUEE_FIRST_MOVE_PX.y + MARQUEE_SECOND_MOVE_PX.y,
        width: originalBounds.width + MARQUEE_RESIZE_PX.x,
        height: originalBounds.height + MARQUEE_RESIZE_PX.y,
      });
    expect(await page.evaluate(() => document.body.dataset.marqueeSpaceEvents)).toBe("0");
    await page.mouse.up();
    await page.keyboard.up("Space");
    await expect.poll(() => reactGrab.getClipboardContent()).toContain("Moved target");
    expect(await reactGrab.getClipboardContent()).not.toContain("Original target");
    await expect.poll(async () => (await reactGrab.getState()).isCopying).toBe(false);
    expect(await reactGrab.isOverlayVisible()).toBe(true);
  });

  test("Space is claimed only during a drag and cannot activate a focused button", async ({
    reactGrab,
    page,
  }) => {
    await page.evaluate(
      ({ sourceBox, pageHeight }) => {
        document.body.style.minHeight = `${pageHeight}px`;
        const button = document.createElement("button");
        button.id = "marquee-space-button";
        button.textContent = "Page button";
        Object.assign(button.style, {
          position: "fixed",
          left: `${sourceBox.x}px`,
          top: `${sourceBox.y}px`,
        });
        button.dataset.clicks = "0";
        button.addEventListener("click", () => {
          button.dataset.clicks = String(Number(button.dataset.clicks) + 1);
        });
        document.body.append(button);
        button.focus();
      },
      { sourceBox: MARQUEE_SOURCE_BOX_PX, pageHeight: MARQUEE_PAGE_HEIGHT_PX },
    );
    const button = page.locator("#marquee-space-button");
    await reactGrab.activate();
    await page.mouse.move(MARQUEE_START_PX.x, MARQUEE_START_PX.y);
    await page.mouse.down();
    await page.mouse.move(MARQUEE_END_PX.x, MARQUEE_END_PX.y, { steps: MARQUEE_MOVE_STEP_COUNT });
    const scrollBefore = await page.evaluate(() => window.scrollY);
    await page.keyboard.press("Space");
    await page.waitForTimeout(MARQUEE_SCROLL_SETTLE_MS);
    expect(await page.evaluate(() => window.scrollY)).toBe(scrollBefore);
    await expect(button).toHaveAttribute("data-clicks", "0");
    await page.keyboard.press("Escape");
    await page.mouse.up();
    await button.focus();
    await page.keyboard.press("Space");
    await expect(button).toHaveAttribute("data-clicks", "1");
    await button.evaluate((element) => element.blur());
    await page.keyboard.press("Space");
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(scrollBefore);
  });

  test("Space held before drawing pauses instead of starting a marquee", async ({
    reactGrab,
    page,
  }) => {
    await reactGrab.activate();
    await page.keyboard.down("Space");
    await page.mouse.move(MARQUEE_START_PX.x, MARQUEE_START_PX.y);
    await page.mouse.down();
    await page.mouse.move(MARQUEE_END_PX.x, MARQUEE_END_PX.y, { steps: MARQUEE_MOVE_STEP_COUNT });
    expect(await reactGrab.getDragBoxBounds()).toBeNull();
    await page.mouse.up();
    await page.keyboard.up("Space");
    await page.mouse.move(MARQUEE_START_PX.x, MARQUEE_START_PX.y);
    await page.mouse.down();
    await page.mouse.move(MARQUEE_END_PX.x, MARQUEE_END_PX.y, { steps: MARQUEE_MOVE_STEP_COUNT });
    await expect
      .poll(() => reactGrab.getDragBoxBounds())
      .toMatchObject({
        x: MARQUEE_START_PX.x,
        y: MARQUEE_START_PX.y,
        width: MARQUEE_END_PX.x - MARQUEE_START_PX.x,
        height: MARQUEE_END_PX.y - MARQUEE_START_PX.y,
      });
    await page.keyboard.press("Escape");
    await page.mouse.up();
  });
});

test("Space marquee preserves size beyond the page edge and during auto-scroll", async ({
  reactGrab,
  page,
}) => {
  await reactGrab.activate();
  await page.mouse.move(MARQUEE_START_PX.x, MARQUEE_START_PX.y);
  await page.mouse.down();
  await page.mouse.move(MARQUEE_END_PX.x, MARQUEE_END_PX.y, { steps: MARQUEE_MOVE_STEP_COUNT });
  const originalBounds = await reactGrab.getDragBoxBounds();
  if (!originalBounds) throw new Error("Missing marquee");
  await page.keyboard.down("Space");
  await page.mouse.move(0, MARQUEE_END_PX.y, { steps: MARQUEE_MOVE_STEP_COUNT });
  await expect
    .poll(() => reactGrab.getDragBoxBounds())
    .toMatchObject({
      x: -originalBounds.width,
      width: originalBounds.width,
      height: originalBounds.height,
    });
  const viewport = await reactGrab.getViewportSize();
  const scrollBefore = await page.evaluate(() => window.scrollY);
  await page.mouse.move(MARQUEE_END_PX.x, viewport.height - MARQUEE_EDGE_INSET_PX, {
    steps: MARQUEE_MOVE_STEP_COUNT,
  });
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(scrollBefore);
  await expect
    .poll(() => reactGrab.getDragBoxBounds())
    .toMatchObject({ width: originalBounds.width, height: originalBounds.height });
  await page.keyboard.press("Escape");
  await page.mouse.up();
  await page.keyboard.up("Space");
});

test("Escape after copying allows immediate keyboard activation", async ({ reactGrab }) => {
  await reactGrab.activate();
  await reactGrab.hoverUntilSelected("[data-testid='todo-list'] h1");
  await reactGrab.clickElement("[data-testid='todo-list'] h1");
  await expect.poll(() => reactGrab.getLabelStatusText()).toBe("Copied");
  await reactGrab.page.keyboard.press("Escape");
  await expect(reactGrab.getOverlayHost().locator("[data-react-grab-completion]")).toHaveCount(0);
  await expect.poll(() => reactGrab.isOverlayVisible()).toBe(true);
  await reactGrab.deactivate();
  await reactGrab.activateViaKeyboard();
  expect(await reactGrab.isOverlayVisible()).toBe(true);
});

test("custom shortcut switches Grab off with zero activation delay", async ({
  reactGrab,
  page,
}) => {
  expect(await reactGrab.reinitialize({ activationKey: "F8", keyHoldDuration: 0 })).toBe(true);
  await reactGrab.activate();
  await reactGrab.hoverUntilSelected("[data-testid='todo-list'] h1");
  await reactGrab.clickElement("[data-testid='todo-list'] h1");
  await expect.poll(() => reactGrab.getLabelStatusText()).toBe("Copied");
  await page.keyboard.press("F8");
  await expect.poll(() => reactGrab.isOverlayVisible()).toBe(false);
});

test("a plugin intercepting a clicked pick for a pending toolbar action clears the pending pick", async ({
  reactGrab,
}) => {
  await armInterceptedToolbarAction(reactGrab);
  await reactGrab.hoverUntilSelected("li:first-child");
  await reactGrab.clickElement("li:first-child");
  await expectInterceptedPickClearedPendingAction(reactGrab);
});

test("a plugin intercepting a keyboard pick for a pending toolbar action clears the pending pick", async ({
  reactGrab,
}) => {
  await armInterceptedToolbarAction(reactGrab);
  await reactGrab.hoverUntilSelected("li:first-child span");
  await reactGrab.pressArrowUp();
  await reactGrab.waitForSelectionBox();
  await reactGrab.clickElement("li:first-child span");
  await expectInterceptedPickClearedPendingAction(reactGrab);
});

test.describe("Copy routes retained from the element menu", () => {
  test("should copy element when clicking Copy", async ({ reactGrab }) => {
    await reactGrab.activate();
    await reactGrab.hoverUntilSelected("[data-testid='todo-list'] h1");
    await reactGrab.clickElement("[data-testid='todo-list'] h1");

    await reactGrab.page.waitForTimeout(500);

    const clipboardContent = await reactGrab.getClipboardContent();
    expect(clipboardContent).toContain("Todo List");
  });
  test("should copy list item content correctly", async ({ reactGrab }) => {
    await reactGrab.activate();
    await reactGrab.hoverUntilSelected("li:first-child");
    await reactGrab.clickElement("li:first-child");

    await reactGrab.page.waitForTimeout(500);

    const clipboardContent = await reactGrab.getClipboardContent();
    expect(clipboardContent).toBeTruthy();
  });
  test("should copy correct element after keyboard navigation via click", async ({ reactGrab }) => {
    await reactGrab.activate();
    await reactGrab.hoverUntilSelected("li:first-child span");

    await reactGrab.pressArrowUp();
    await reactGrab.waitForSelectionBox();
    await reactGrab.page.waitForTimeout(100);

    await reactGrab.clickElement("li:first-child span");

    await expect.poll(() => reactGrab.getClipboardContent()).toContain("TodoItem");
  });
  test("should copy different elements via click", async ({ reactGrab }) => {
    await reactGrab.activate();
    await reactGrab.hoverUntilSelected("[data-testid='todo-list'] h1");
    await reactGrab.clickElement("[data-testid='todo-list'] h1");
    await reactGrab.page.waitForTimeout(1600);

    const firstCopy = await reactGrab.getClipboardContent();
    expect(firstCopy).toContain("Todo List");

    await reactGrab.pressEscape();
    await reactGrab.hoverUntilSelected("[data-testid='todo-list'] li:first-child");
    await reactGrab.clickElement("[data-testid='todo-list'] li:first-child");
    await reactGrab.page.waitForTimeout(500);

    const secondCopy = await reactGrab.getClipboardContent();
    expect(secondCopy).toBeTruthy();
    expect(secondCopy).not.toContain("Todo List");
  });
});
