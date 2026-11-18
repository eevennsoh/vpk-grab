import { test, expect } from "./fixtures.js";

const TARGET_SELECTOR = "[data-testid='todo-list'] li:first-child span";
const MENU_SELECTOR = "[data-react-grab-context-menu]";
const PEN_SELECTOR = '[data-react-grab-toolbar-action="annotate-pen"]';

test.describe("Unbound menu inputs", () => {
  for (const frozenSelection of [false, true]) {
    test(`right-click leaves selection and clipboard alone (frozen: ${frozenSelection})`, async ({
      reactGrab,
      page,
    }) => {
      await reactGrab.activate();
      await reactGrab.hoverUntilSelected(TARGET_SELECTOR);
      if (frozenSelection) await reactGrab.pressArrowUp();
      const selectionBefore = await reactGrab.getSelectionBoxBounds();
      await page.evaluate(() => {
        document.addEventListener(
          "contextmenu",
          (event) => {
            document.documentElement.dataset.browserContextMenuPrevented = String(
              event.defaultPrevented,
            );
          },
          { once: true },
        );
        return navigator.clipboard.writeText("baseline");
      });
      await page.mouse.down({ button: "right" });
      await page.mouse.up({ button: "right" });
      await expect(page.locator(MENU_SELECTOR)).toHaveCount(0);
      await expect(page.locator("html")).toHaveAttribute(
        "data-browser-context-menu-prevented",
        "false",
      );
      expect(await reactGrab.getClipboardContent()).toBe("baseline");
      expect(await reactGrab.getSelectionBoxBounds()).toEqual(selectionBefore);
      expect((await reactGrab.getState()).isDragging).toBe(false);
    });
  }

  test("drawing still prevents the browser context menu", async ({ reactGrab, page }) => {
    await reactGrab.activate();
    await page.locator(PEN_SELECTOR).click();
    const wasPrevented = await page.locator(TARGET_SELECTOR).evaluate((element) => {
      const contextMenuEvent = new MouseEvent("contextmenu", { bubbles: true, cancelable: true });
      element.dispatchEvent(contextMenuEvent);
      return contextMenuEvent.defaultPrevented;
    });
    expect(wasPrevented).toBe(true);
    await expect(page.locator(MENU_SELECTOR)).toHaveCount(0);
  });

  for (const key of ["Shift+F10", "ContextMenu"]) {
    test(`${key} stays unbound`, async ({ reactGrab, page }) => {
      await reactGrab.activate();
      await reactGrab.hoverUntilSelected(TARGET_SELECTOR);
      const selectionBefore = await reactGrab.getSelectionBoxBounds();
      const wasPrevented = await page.evaluate((shortcut) => {
        const keyboardEvent = new KeyboardEvent("keydown", {
          key: shortcut === "Shift+F10" ? "F10" : shortcut,
          code: shortcut === "Shift+F10" ? "F10" : shortcut,
          shiftKey: shortcut === "Shift+F10",
          bubbles: true,
          cancelable: true,
        });
        document.body.dispatchEvent(keyboardEvent);
        return keyboardEvent.defaultPrevented;
      }, key);
      const isUnboundKeyPrevented = await page.evaluate(() => {
        const unboundKeyEvent = new KeyboardEvent("keydown", {
          key: "F9",
          code: "F9",
          bubbles: true,
          cancelable: true,
        });
        document.body.dispatchEvent(unboundKeyEvent);
        return unboundKeyEvent.defaultPrevented;
      });
      expect(wasPrevented).toBe(isUnboundKeyPrevented);
      await page.keyboard.press(key);
      await expect(page.locator(MENU_SELECTOR)).toHaveCount(0);
      expect(await reactGrab.getSelectionBoxBounds()).toEqual(selectionBefore);
    });
  }
});
