import { test, expect } from "./fixtures.js";

test.describe("Activation Flows", () => {
  test("should activate overlay via API", async ({ reactGrab }) => {
    const isVisibleBefore = await reactGrab.isOverlayVisible();
    expect(isVisibleBefore).toBe(false);

    await reactGrab.activate();

    const isVisibleAfter = await reactGrab.isOverlayVisible();
    expect(isVisibleAfter).toBe(true);
  });

  test("should not activate when pressing C without Cmd/Ctrl modifier", async ({ reactGrab }) => {
    await reactGrab.page.keyboard.down("c");
    await reactGrab.page.keyboard.up("c");

    const isVisible = await reactGrab.isOverlayVisible();
    expect(isVisible).toBe(false);
  });

  test("should deactivate overlay when pressing Escape", async ({ reactGrab }) => {
    await reactGrab.activate();
    expect(await reactGrab.isOverlayVisible()).toBe(true);

    await reactGrab.deactivate();

    expect(await reactGrab.isOverlayVisible()).toBe(false);
  });

  test("should toggle activation state with repeated activation", async ({ reactGrab }) => {
    await reactGrab.activate();
    expect(await reactGrab.isOverlayVisible()).toBe(true);

    await reactGrab.deactivate();
    expect(await reactGrab.isOverlayVisible()).toBe(false);

    await reactGrab.activate();
    expect(await reactGrab.isOverlayVisible()).toBe(true);
  });

  test("should maintain activation during mouse movement", async ({ reactGrab }) => {
    await reactGrab.activate();
    expect(await reactGrab.isOverlayVisible()).toBe(true);

    await reactGrab.page.mouse.move(100, 100);
    await reactGrab.page.mouse.move(200, 200);
    await reactGrab.page.mouse.move(300, 300);

    expect(await reactGrab.isOverlayVisible()).toBe(true);
  });

  test("should create overlay host element with correct attribute", async ({ reactGrab }) => {
    await reactGrab.activate();

    const hostExists = await reactGrab.page.evaluate(() => {
      const host = document.querySelector("[data-react-grab]");
      return host !== null && host.getAttribute("data-react-grab") === "true";
    });
    expect(hostExists).toBe(true);
  });

  test("should have shadow DOM structure", async ({ reactGrab }) => {
    await reactGrab.activate();

    const hasShadowRoot = await reactGrab.page.evaluate(() => {
      const host = document.querySelector("[data-react-grab]");
      return host?.shadowRoot !== null;
    });

    expect(hasShadowRoot).toBe(true);
  });
});

test.describe("Activation Mode Configuration", () => {
  test("toggle mode should activate on first keyboard activation", async ({ reactGrab }) => {
    await reactGrab.activateViaKeyboard();
    expect(await reactGrab.isOverlayVisible()).toBe(true);
  });

  test("API toggle should deactivate on second call", async ({ reactGrab }) => {
    await reactGrab.toggle();
    expect(await reactGrab.isOverlayVisible()).toBe(true);

    await reactGrab.toggle();
    expect(await reactGrab.isOverlayVisible()).toBe(false);
  });

  test("keyboard activation in toggle mode requires Escape to deactivate", async ({
    reactGrab,
  }) => {
    await reactGrab.activateViaKeyboard();
    expect(await reactGrab.isOverlayVisible()).toBe(true);

    await reactGrab.deactivate();
    expect(await reactGrab.isOverlayVisible()).toBe(false);
  });

  test.describe("Escape closes one layer at a time", () => {
    const openPageLayers = (page: import("@playwright/test").Page, withModalDialog = true) =>
      page.evaluate((shouldOpenDialog) => {
        if (shouldOpenDialog) {
          const dialog = document.createElement("dialog");
          dialog.innerHTML = `<input data-testid="dialog-input" />`;
          document.body.append(dialog);
          dialog.showModal();
        }
        document.documentElement.dataset.keydownMenu = "open";
        document.documentElement.dataset.keyupMenu = "open";
        document.addEventListener(
          "keydown",
          (event) => {
            if (event.key === "Escape") document.documentElement.dataset.keydownMenu = "closed";
          },
          { capture: true },
        );
        document.addEventListener("keyup", (event) => {
          if (event.key === "Escape") document.documentElement.dataset.keyupMenu = "closed";
        });
      }, withModalDialog);

    const expectPageLayers = async (
      page: import("@playwright/test").Page,
      expectedState: "open" | "closed",
      withModalDialog = true,
    ) => {
      const html = page.locator("html");
      await expect(html).toHaveAttribute("data-keydown-menu", expectedState);
      await expect(html).toHaveAttribute("data-keyup-menu", expectedState);
      if (!withModalDialog) return;
      if (expectedState === "open") {
        await expect(page.locator("dialog")).toHaveAttribute("open", "");
      } else {
        await expect(page.locator("dialog")).not.toHaveAttribute("open", "");
      }
    };

    test("first Escape turns a toggled session off and leaves page UI open", async ({
      reactGrab,
    }) => {
      await reactGrab.activateViaKeyboard();
      await openPageLayers(reactGrab.page);

      await reactGrab.pressEscape();
      await expect.poll(() => reactGrab.isOverlayVisible()).toBe(false);
      await expectPageLayers(reactGrab.page, "open");

      await reactGrab.pressEscape();
      await expectPageLayers(reactGrab.page, "closed");
    });

    test("Escape from a page field turns Grab off before the page sees it", async ({
      reactGrab,
    }) => {
      await openPageLayers(reactGrab.page);
      await reactGrab.activateViaKeyboardFrom("[data-testid='dialog-input']");

      await reactGrab.pressEscape();
      await expect.poll(() => reactGrab.isOverlayVisible()).toBe(false);
      await expectPageLayers(reactGrab.page, "open");
    });

    test("Escape cancelling the prompt leaves page UI open", async ({ reactGrab }) => {
      await reactGrab.registerCommentAction();
      await reactGrab.enterPromptMode("li:first-child");
      await openPageLayers(reactGrab.page, false);

      await reactGrab.pressEscape();
      await expect.poll(() => reactGrab.isPromptModeActive()).toBe(false);
      await expectPageLayers(reactGrab.page, "open", false);
    });
  });

  test("should activate when focused on input element", async ({ reactGrab }) => {
    await reactGrab.activateViaKeyboardFrom("[data-testid='test-input']");
    expect(await reactGrab.isOverlayVisible()).toBe(true);
  });

  test("should activate when focused on textarea", async ({ reactGrab }) => {
    await reactGrab.activateViaKeyboardFrom("[data-testid='test-textarea']");
    expect(await reactGrab.isOverlayVisible()).toBe(true);
  });

  test("activation should work after clicking outside input", async ({ reactGrab }) => {
    await reactGrab.page.click("[data-testid='test-input']");
    await reactGrab.page.click("body", { position: { x: 10, y: 10 } });

    await reactGrab.activateViaKeyboard();
    expect(await reactGrab.isOverlayVisible()).toBe(true);
  });

  test("API activation should work even when input is focused", async ({ reactGrab }) => {
    await reactGrab.page.click("[data-testid='test-input']");

    await reactGrab.activate();

    expect(await reactGrab.isOverlayVisible()).toBe(true);
  });

  test("should handle activation during page scroll", async ({ reactGrab }) => {
    await reactGrab.scrollPage(200);

    await reactGrab.activate();

    expect(await reactGrab.isOverlayVisible()).toBe(true);
  });

  test("should remain activated after viewport resize", async ({ reactGrab }) => {
    await reactGrab.activate();
    expect(await reactGrab.isOverlayVisible()).toBe(true);

    await reactGrab.setViewportSize(1024, 768);

    expect(await reactGrab.isOverlayVisible()).toBe(true);

    await reactGrab.setViewportSize(1280, 720);
  });

  test("activation state should survive DOM changes", async ({ reactGrab }) => {
    await reactGrab.activate();
    expect(await reactGrab.isOverlayVisible()).toBe(true);

    await reactGrab.page.evaluate(() => {
      const newDiv = document.createElement("div");
      newDiv.textContent = "Dynamic content";
      document.body.appendChild(newDiv);
    });

    expect(await reactGrab.isOverlayVisible()).toBe(true);
  });

  test("should handle multiple rapid API toggle calls", async ({ reactGrab }) => {
    for (let i = 0; i < 5; i++) {
      await reactGrab.toggle();
    }

    const state = await reactGrab.getState();
    expect(typeof state.isActive).toBe("boolean");
  });

  test("restoring focus on deactivate does not scroll the page", async ({ reactGrab, page }) => {
    // Focus a near-top element, then scroll far away from it so restoring focus
    // to it on deactivate would jump the page back up without preventScroll.
    await page.locator("[data-testid='grab-smoke-target']").focus();
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    const scrollBeforeGrab = await page.evaluate(() => window.scrollY);
    expect(scrollBeforeGrab).toBeGreaterThan(0);

    await reactGrab.activate();
    // The copy flow moves focus through the clipboard textarea, so the
    // previously-focused element no longer holds focus and deactivate's restore
    // actually runs (a bare activate→deactivate leaves focus untouched).
    await reactGrab.copyElementViaApi("[data-testid='footer']");
    await reactGrab.deactivate();

    // Focus restoration must not jump back toward the previously focused element.
    const scrollAfterGrab = await page.evaluate(() => window.scrollY);
    expect(scrollAfterGrab).toBeGreaterThanOrEqual(scrollBeforeGrab);
  });
});
