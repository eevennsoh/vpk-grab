// The toolbar's style changes control: it appears with the first override,
// lists every change by element, and removes, reopens or resets them.
import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures.js";
import {
  AWAY_POSITION,
  PINNED_PANEL_SELECTOR,
  clickInside,
  getStyle,
  installSpecsFixture,
  inspect,
  pinAndReach,
  specRow,
  toggle,
  typeValue,
} from "./specs-panel-fixture.js";

const CHANGES_BUTTON_SELECTOR = '[data-react-grab-toolbar-action="style-changes"]';
const CHANGES_COUNT_SELECTOR = "[data-react-grab-changes-count]";
const CHANGES_MENU_SELECTOR = "[data-react-grab-changes-menu]";
const CHANGES_GROUP_SELECTOR = "[data-react-grab-changes-group]";
const CHANGES_ACTIONS_SELECTOR = "[data-react-grab-toolbar-changes-actions]";

test.describe("style changes", () => {
  test.beforeEach(async ({ reactGrab, page }) => {
    await expect.poll(() => reactGrab.isToolbarVisible(), { timeout: 3000 }).toBe(true);
    await installSpecsFixture(page);
    await page.locator('[data-react-grab-toolbar-action="inspect-specs"]').click();
    await page.mouse.move(AWAY_POSITION.x, AWAY_POSITION.y);
    await reactGrab.activate();
  });

  const makeTwoChanges = async (page: Page) => {
    await inspect(page, "specs-plain-button");
    await pinAndReach(page, "padding");
    await typeValue(page, "padding", "20px");
    await toggle(page, "background-color");
    await page.mouse.move(AWAY_POSITION.x, AWAY_POSITION.y, { steps: 8 });
    await expect(page.locator(PINNED_PANEL_SELECTOR)).toHaveCount(0);
  };

  test("the button appears with the first change and counts them", async ({ page }) => {
    const changesActions = page.locator(CHANGES_ACTIONS_SELECTOR);
    await expect(changesActions).not.toHaveAttribute("data-revealed");
    await makeTwoChanges(page);

    await expect(changesActions).toHaveAttribute("data-revealed", "");
    await expect(page.locator(CHANGES_COUNT_SELECTOR)).toHaveText("2");
  });

  test("the menu lists changes by element and removes one", async ({ page }) => {
    await makeTwoChanges(page);
    await page.locator(CHANGES_BUTTON_SELECTOR).click();

    const menu = page.locator(CHANGES_MENU_SELECTOR);
    await expect(menu.locator(CHANGES_GROUP_SELECTOR)).toHaveCount(1);
    await expect(menu.locator('[data-react-grab-change="padding"]')).toContainText("20px");
    await expect(menu.locator('[data-react-grab-change="background-color"]')).toHaveAttribute(
      "data-off",
      "",
    );

    await menu
      .locator('[data-react-grab-change="padding"] [data-react-grab-change-remove]')
      .click();
    expect(await getStyle(page, "specs-plain-button", "padding-left")).toBe("8px");
    await expect(page.locator(CHANGES_COUNT_SELECTOR)).toHaveText("1");
  });

  test("Reset all removes every change and hides the button", async ({ page }) => {
    await makeTwoChanges(page);
    await page.locator(CHANGES_BUTTON_SELECTOR).click();
    await page.locator("[data-react-grab-changes-reset-all]").click();

    expect(await getStyle(page, "specs-plain-button", "padding-left")).toBe("8px");
    expect(await getStyle(page, "specs-plain-button", "background-color")).toBe(
      "rgb(12, 102, 228)",
    );
    await expect(page.locator(CHANGES_MENU_SELECTOR)).toHaveCount(0);
    await expect(page.locator(CHANGES_ACTIONS_SELECTOR)).not.toHaveAttribute("data-revealed");
  });

  test("changes outlive the overlay and reopen the panel locked", async ({ reactGrab, page }) => {
    await makeTwoChanges(page);
    await reactGrab.deactivate();
    expect(await getStyle(page, "specs-plain-button", "padding-left")).toBe("20px");

    await page.locator(CHANGES_BUTTON_SELECTOR).click();
    await page.locator("[data-react-grab-changes-configure]").click();

    expect(await reactGrab.isOverlayVisible()).toBe(true);
    await expect(page.locator(PINNED_PANEL_SELECTOR)).toHaveCount(1);
    await expect(page.locator("[data-react-grab-specs-pin]")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(specRow(page, "padding")).toHaveAttribute("data-overridden", "");
    await clickInside(page, '[data-react-grab-spec-row="padding"] [data-react-grab-spec-reset]');
    expect(await getStyle(page, "specs-plain-button", "padding-left")).toBe("8px");
  });
});
