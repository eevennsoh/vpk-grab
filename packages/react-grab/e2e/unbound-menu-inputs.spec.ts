import { test, expect } from "./fixtures.js";
import { KEYBOARD_ACTIVATION_SETTLE_DELAY_MS, NON_NATIVE_ACTIVATION_KEY } from "./constants.js";

const TARGET_SELECTOR = "[data-testid='todo-list'] li:first-child span";
const MENU_SELECTOR = "[data-react-grab-context-menu]";
const PEN_SELECTOR = '[data-react-grab-toolbar-action="annotate-pen"]';

test.describe("Unbound menu inputs", () => {
  for (const releasesPointer of [false, true]) {
    test(`Ctrl+click contextmenu cancels the press (release: ${releasesPointer})`, async ({
      reactGrab,
      page,
    }) => {
      await reactGrab.activate();
      await reactGrab.hoverUntilSelected(TARGET_SELECTOR);
      await page.evaluate(() => navigator.clipboard.writeText("baseline"));
      await page.mouse.down();
      expect((await reactGrab.getState()).isDragging).toBe(true);
      await page.locator(TARGET_SELECTOR).dispatchEvent("contextmenu", {
        button: 0,
        ctrlKey: true,
      });
      if (releasesPointer) await page.mouse.up();
      expect((await reactGrab.getState()).isDragging).toBe(false);
      expect(await reactGrab.getClipboardContent()).toBe("baseline");
      await expect(page.locator("[data-react-grab-label-instance]")).toHaveCount(0);
      if (!releasesPointer) await page.mouse.up();
    });
  }

  for (const waitsForActivation of [false, true]) {
    test(`right-click ends a hold session without keyup (activated: ${waitsForActivation})`, async ({
      reactGrab,
      page,
    }) => {
      await page.evaluate((activationKey) => {
        window.__REACT_GRAB__?.setOptions({ activationKey, activationMode: "hold" });
      }, NON_NATIVE_ACTIVATION_KEY);
      await page.keyboard.down(NON_NATIVE_ACTIVATION_KEY);
      if (waitsForActivation) {
        await expect.poll(() => page.evaluate(() => window.__REACT_GRAB__?.isActive())).toBe(true);
      }
      await page.locator(TARGET_SELECTOR).click({ button: "right", force: true });
      await page.waitForTimeout(KEYBOARD_ACTIVATION_SETTLE_DELAY_MS);
      expect(await page.evaluate(() => window.__REACT_GRAB__?.isActive())).toBe(false);
      await page.keyboard.up(NON_NATIVE_ACTIVATION_KEY);
      expect(await page.evaluate(() => window.__REACT_GRAB__?.isActive())).toBe(false);
      expect((await reactGrab.getState()).isDragging).toBe(false);
    });
  }

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
