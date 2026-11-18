import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures.js";
import { ATTRIBUTE_NAME, UI_STATE_TIMEOUT_MS } from "./constants.js";

const hoverToolbar = async (page: Page) =>
  page.locator(`[${ATTRIBUTE_NAME}] [data-react-grab-toolbar]`).first().hover();

const hoverAwayFromToolbar = async (page: Page) => {
  await page.mouse.move(10, 10);
  await page.waitForTimeout(150);
};

test.describe("Toolbar Selection Hover", () => {
  test.describe("Selection Mode", () => {
    test("should hide selection box when hovering toolbar", async ({ reactGrab }) => {
      await reactGrab.activate();
      await reactGrab.hoverUntilSelected("li");

      await expect
        .poll(() => reactGrab.isSelectionBoxVisible(), { timeout: UI_STATE_TIMEOUT_MS })
        .toBe(true);

      await hoverToolbar(reactGrab.page);

      await expect.poll(() => reactGrab.isSelectionBoxVisible(), { timeout: 2000 }).toBe(false);
    });

    test("should hide selection label when hovering toolbar", async ({ reactGrab }) => {
      await reactGrab.activate();
      await reactGrab.hoverUntilSelected("li");

      await expect.poll(() => reactGrab.isSelectionLabelVisible(), { timeout: 2000 }).toBe(true);

      await hoverToolbar(reactGrab.page);

      await expect.poll(() => reactGrab.isSelectionLabelVisible(), { timeout: 2000 }).toBe(false);
    });

    test("should restore selection after moving mouse back from toolbar", async ({ reactGrab }) => {
      await reactGrab.activate();
      await reactGrab.hoverUntilSelected("li");

      await hoverToolbar(reactGrab.page);

      await expect.poll(() => reactGrab.isSelectionBoxVisible(), { timeout: 2000 }).toBe(false);

      await hoverAwayFromToolbar(reactGrab.page);

      await expect
        .poll(() => reactGrab.isSelectionBoxVisible(), { timeout: UI_STATE_TIMEOUT_MS })
        .toBe(true);
    });

    test("should restore selection when the toolbar never hears the pointer leave", async ({
      reactGrab,
    }) => {
      await reactGrab.activate();
      await hoverToolbar(reactGrab.page);
      // The browser sends no mouseleave when the pointer's next target cannot
      // be hit, which is what a pointer leaving in the frame the page freezes
      // finds. Swallowing the event reproduces that on every run.
      await reactGrab.page.evaluate((attributeName) => {
        const shadowRoot = document.querySelector(`[${attributeName}]`)?.shadowRoot;
        shadowRoot?.addEventListener("mouseleave", (event) => event.stopPropagation(), {
          capture: true,
        });
      }, ATTRIBUTE_NAME);

      const listItem = await reactGrab.page.locator("li").first().boundingBox();
      if (!listItem) throw new Error("No list item to hover");
      await reactGrab.page.mouse.move(
        listItem.x + listItem.width / 2,
        listItem.y + listItem.height / 2,
        { steps: 5 },
      );

      await expect
        .poll(() => reactGrab.isSelectionBoxVisible(), { timeout: UI_STATE_TIMEOUT_MS })
        .toBe(true);
    });
  });

  test.describe("Frozen Mode", () => {
    test("should keep selection box visible when hovering toolbar after prompt freeze", async ({
      reactGrab,
    }) => {
      await reactGrab.enterPromptMode("li:first-child span");

      await expect.poll(() => reactGrab.isSelectionBoxVisible(), { timeout: 2000 }).toBe(true);

      await hoverToolbar(reactGrab.page);

      await expect.poll(() => reactGrab.isSelectionBoxVisible(), { timeout: 2000 }).toBe(true);
    });

    test("should keep selection box visible after prompt selection and toolbar hover", async ({
      reactGrab,
    }) => {
      await reactGrab.enterPromptMode("li:first-child span");

      await expect.poll(() => reactGrab.isSelectionBoxVisible(), { timeout: 2000 }).toBe(true);

      await hoverToolbar(reactGrab.page);

      await expect.poll(() => reactGrab.isSelectionBoxVisible(), { timeout: 2000 }).toBe(true);
    });

    test("selection box should not flicker when moving between frozen element and toolbar", async ({
      reactGrab,
    }) => {
      await reactGrab.enterPromptMode("li:first-child span");

      for (let hoverIndex = 0; hoverIndex < 3; hoverIndex++) {
        await hoverToolbar(reactGrab.page);
        await expect.poll(() => reactGrab.isSelectionBoxVisible(), { timeout: 2000 }).toBe(true);

        await hoverAwayFromToolbar(reactGrab.page);
        await expect.poll(() => reactGrab.isSelectionBoxVisible(), { timeout: 2000 }).toBe(true);
      }
    });
  });
});
