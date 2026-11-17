import { test, expect } from "./fixtures.js";
import { TEXT_SELECTION_SHORTCUT_PRESS_MS } from "./constants.js";

test.describe("Keyboard Shortcuts", () => {
  test("a press longer than the configured hold keeps Grab on after activating with page text selected", async ({
    reactGrab,
  }) => {
    const { page } = reactGrab;
    await page.click("body");
    await page.evaluate(() => {
      const title = document.querySelector("[data-testid='main-title']");
      if (!title) throw new Error("Missing main title");
      const range = document.createRange();
      range.selectNodeContents(title);
      window.getSelection()?.removeAllRanges();
      window.getSelection()?.addRange(range);
    });

    await page.keyboard.down(reactGrab.modifierKey);
    await page.keyboard.down("c");
    await expect.poll(() => reactGrab.isOverlayVisible()).toBe(true);
    await page.keyboard.up("c");
    await page.keyboard.up(reactGrab.modifierKey);

    await page.keyboard.down(reactGrab.modifierKey);
    await page.keyboard.down("c");
    await page.waitForTimeout(TEXT_SELECTION_SHORTCUT_PRESS_MS);
    await page.keyboard.up("c");
    await page.keyboard.up(reactGrab.modifierKey);

    expect(await reactGrab.isOverlayVisible()).toBe(true);
  });

  test("should copy selected element when clicking", async ({ reactGrab }) => {
    await reactGrab.activate();
    await reactGrab.hoverUntilSelected("[data-testid='todo-list'] h1");

    await reactGrab.clickElement("[data-testid='todo-list'] h1");
    await reactGrab.page.waitForTimeout(500);

    const clipboardContent = await reactGrab.getClipboardContent();
    expect(clipboardContent).toContain("Todo List");
  });

  test("should deactivate when pressing Escape while hovering", async ({ reactGrab }) => {
    await reactGrab.activate();
    await reactGrab.hoverUntilSelected("li:first-child");

    await reactGrab.pressEscape();
    await reactGrab.page.waitForTimeout(100);

    const isVisible = await reactGrab.isOverlayVisible();
    expect(isVisible).toBe(false);
  });

  test("should not activate when pressing C without Cmd/Ctrl modifier", async ({ reactGrab }) => {
    await reactGrab.page.keyboard.down("c");
    await reactGrab.page.waitForTimeout(50);
    await reactGrab.page.keyboard.up("c");

    const isVisible = await reactGrab.isOverlayVisible();
    expect(isVisible).toBe(false);
  });

  test("should copy list item when clicked", async ({ reactGrab }) => {
    await reactGrab.activate();
    await reactGrab.hoverUntilSelected("[data-testid='todo-list'] li:nth-child(2) span");

    await reactGrab.clickElement("[data-testid='todo-list'] li:nth-child(2) span");
    await reactGrab.page.waitForTimeout(500);

    const clipboardContent = await reactGrab.getClipboardContent();
    expect(clipboardContent).toContain("TodoItem");
  });

  test("should keep overlay active while navigating with arrow keys", async ({ reactGrab }) => {
    await reactGrab.activate();
    await reactGrab.hoverUntilSelected("li:first-child");

    for (let i = 0; i < 5; i++) {
      await reactGrab.page.keyboard.press("ArrowDown");
      await reactGrab.page.waitForTimeout(50);
    }

    const isVisible = await reactGrab.isOverlayVisible();
    expect(isVisible).toBe(true);
  });

  test("should stay active after successful click copy in toggle mode", async ({ reactGrab }) => {
    await reactGrab.activate();
    await reactGrab.hoverUntilSelected("li:first-child");

    await reactGrab.clickElement("li:first-child");
    await reactGrab.page.waitForTimeout(2000);

    const isVisible = await reactGrab.isOverlayVisible();
    expect(isVisible).toBe(true);
  });
});
