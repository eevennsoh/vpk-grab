// The specs panel: the design tokens it names for applied properties, the
// Shift pin that lets the pointer reach it, and the checkbox, value field and
// token menu a pinned panel gives every row.
import { test, expect } from "./fixtures.js";
import {
  PANEL_SELECTOR,
  PINNED_PANEL_SELECTOR,
  HIERARCHY_MENU_SELECTOR,
  RESET_SELECTOR,
  AWAY_POSITION,
  installSpecsFixture,
  specRow,
  specTokens,
  getStyle,
  inspect,
  pinAndReach,
  specToggle,
  clickInside,
  toggle,
  typeValue,
} from "./specs-panel-fixture.js";

test.describe("specs panel", () => {
  test.beforeEach(async ({ reactGrab, page }) => {
    await expect.poll(() => reactGrab.isToolbarVisible(), { timeout: 3000 }).toBe(true);
    await installSpecsFixture(page);
    await page.locator('[data-react-grab-toolbar-action="inspect-specs"]').click();
    await page.mouse.move(AWAY_POSITION.x, AWAY_POSITION.y);
    await reactGrab.activate();
  });

  test("names the tokens behind applied properties", async ({ page }) => {
    await inspect(page, "specs-plain-button");

    await expect(specTokens(page, "padding")).toHaveText(["--ds-space-050 × 4"]);
    await expect(specTokens(page, "background-color")).toHaveText(["--ds-background-brand-bold"]);
    await expect(specTokens(page, "color")).toHaveText(["--ds-text-inverse"]);
    await expect(specTokens(page, "border-radius")).toHaveCount(0);
  });

  test("names each token where utilities overlap and follows Tailwind's plumbing", async ({
    page,
  }) => {
    await inspect(page, "specs-token-button");

    await expect(specTokens(page, "padding")).toHaveText([
      "--ds-space-050 × 6",
      "--ds-space-050 × 4",
    ]);
    await expect(specTokens(page, "border-radius")).toHaveText(["--ds-radius-medium"]);
    await expect(specTokens(page, "box-shadow")).toHaveText(["--ds-shadow-raised"]);
  });

  test("Shift pins the panel instead of opening the element tree", async ({ page }) => {
    await inspect(page, "specs-token-button");
    await expect(page.locator(PANEL_SELECTOR)).toHaveCSS("pointer-events", "none");

    await page.keyboard.down("Shift");
    await expect(page.locator(PINNED_PANEL_SELECTOR)).toHaveCount(1);
    await expect(page.locator(PANEL_SELECTOR)).toHaveCSS("pointer-events", "auto");
    await expect(page.locator(HIERARCHY_MENU_SELECTOR)).toHaveCount(0);

    await page.keyboard.up("Shift");
    await expect(page.locator(PINNED_PANEL_SELECTOR)).toHaveCount(0);
  });

  test("a pinned panel holds its element while the pointer travels to it", async ({ page }) => {
    await inspect(page, "specs-token-button");
    const panelBefore = await page.locator(PANEL_SELECTOR).boundingBox();

    await pinAndReach(page, "padding");

    await expect(page.locator(PINNED_PANEL_SELECTOR)).toHaveCount(1);
    expect(await page.locator(PANEL_SELECTOR).boundingBox()).toEqual(panelBefore);
    await expect(specTokens(page, "border-radius")).toHaveText(["--ds-radius-medium"]);

    await page.mouse.move(AWAY_POSITION.x, AWAY_POSITION.y, { steps: 8 });
    await expect(page.locator(PINNED_PANEL_SELECTOR)).toHaveCount(0);
  });

  test("the checkbox switches an applied property off and on again", async ({
    reactGrab,
    page,
  }) => {
    await inspect(page, "specs-token-button");
    await pinAndReach(page, "padding");
    expect(await getStyle(page, "specs-token-button", "padding-left")).toBe("12px");

    await toggle(page, "padding");
    expect(await getStyle(page, "specs-token-button", "padding-left")).toBe("0px");
    await expect(specRow(page, "padding")).toHaveAttribute("data-off", "");
    await expect(specToggle(page, "padding")).toHaveAttribute("aria-checked", "false");
    await expect(specRow(page, "padding").locator("[data-react-grab-spec-value]")).toHaveText(
      "8px 12px",
    );
    expect(await reactGrab.isOverlayVisible()).toBe(true);

    await toggle(page, "padding");
    expect(await getStyle(page, "specs-token-button", "padding-left")).toBe("12px");
    await expect(specRow(page, "padding")).not.toHaveAttribute("data-off");
  });

  test("applied rows sit above the type sections", async ({ page }) => {
    await inspect(page, "specs-token-button");

    const applied = page.locator("[data-react-grab-specs-applied]");
    await expect(applied.locator('[data-react-grab-spec-row="padding"]')).toHaveCount(1);
    await expect(applied.locator('[data-react-grab-spec-row="background-color"]')).toHaveCount(1);
    await expect(applied.locator('[data-react-grab-spec-row="border-width"]')).toHaveCount(0);
    await expect(specRow(page, "gap")).toHaveCount(0);
  });

  test("display falls back to the tag's default rather than inline", async ({ page }) => {
    await inspect(page, "specs-token-button");
    await pinAndReach(page, "display");

    await toggle(page, "display");
    expect(await getStyle(page, "specs-token-button", "display")).toBe("inline-block");
  });

  test("rows that are not applied have no checkbox", async ({ page }) => {
    await inspect(page, "specs-token-button");
    await pinAndReach(page, "border-width");

    await expect(specToggle(page, "border-width")).toHaveCount(0);
  });

  test("a typed value is applied and can be reset", async ({ page }) => {
    await inspect(page, "specs-plain-button");
    await pinAndReach(page, "padding");

    await typeValue(page, "padding", "20px");
    expect(await getStyle(page, "specs-plain-button", "padding-left")).toBe("20px");
    await expect(specRow(page, "padding")).toHaveAttribute("data-overridden", "");

    await clickInside(page, '[data-react-grab-spec-row="padding"] [data-react-grab-spec-reset]');
    expect(await getStyle(page, "specs-plain-button", "padding-left")).toBe("8px");
    await expect(specRow(page, "padding")).not.toHaveAttribute("data-overridden");
  });

  test("a value the browser rejects is not applied", async ({ page }) => {
    await inspect(page, "specs-plain-button");
    await pinAndReach(page, "padding");

    await typeValue(page, "padding", "solidd");
    const input = specRow(page, "padding").locator("[data-react-grab-spec-input]");
    await expect(input).toHaveAttribute("aria-invalid", "true");
    expect(await getStyle(page, "specs-plain-button", "padding-left")).toBe("8px");

    await input.press("Escape");
    await expect(input).toHaveCount(0);
    await expect(page.locator(PINNED_PANEL_SELECTOR)).toHaveCount(1);
  });

  test("Shift typed into a value does not re-pin or open the element tree", async ({ page }) => {
    await inspect(page, "specs-plain-button");
    await pinAndReach(page, "background-color");

    await clickInside(
      page,
      '[data-react-grab-spec-row="background-color"] [data-react-grab-spec-value]',
    );
    const input = specRow(page, "background-color").locator("[data-react-grab-spec-input]");
    await input.pressSequentially("RED");
    await expect(input).toHaveValue("RED");
    await expect(page.locator(HIERARCHY_MENU_SELECTOR)).toHaveCount(0);
    await input.press("Enter");
    expect(await getStyle(page, "specs-plain-button", "background-color")).toBe("rgb(255, 0, 0)");
  });

  test("picking a token from the menu applies it", async ({ page }) => {
    await inspect(page, "specs-plain-button");
    await pinAndReach(page, "background-color");

    await clickInside(
      page,
      '[data-react-grab-spec-row="background-color"] [data-react-grab-spec-menu-trigger]',
    );
    const filter = page.locator("[data-react-grab-spec-value-filter]");
    await expect(filter).toBeFocused();
    await expect(
      page.locator('[data-react-grab-spec-option="--ds-background-brand-bold"]'),
    ).toHaveAttribute("aria-selected", "true");

    await filter.fill("hovered");
    await page
      .locator('[data-react-grab-spec-option="--ds-background-brand-bold-hovered"]')
      .click();
    await expect(page.locator("[data-react-grab-spec-value-menu]")).toHaveCount(0);
    expect(await getStyle(page, "specs-plain-button", "background-color")).toBe("rgb(0, 85, 204)");
    await expect(specRow(page, "background-color")).toHaveAttribute("data-overridden", "");
  });

  test("the menu offers keywords for keyword properties", async ({ page }) => {
    await inspect(page, "specs-token-button");
    await pinAndReach(page, "display");

    await clickInside(
      page,
      '[data-react-grab-spec-row="display"] [data-react-grab-spec-menu-trigger]',
    );
    await page.locator("[data-react-grab-spec-value-filter]").fill("flex");
    await page.locator('[data-react-grab-spec-option="flex"]').click();
    expect(await getStyle(page, "specs-token-button", "display")).toBe("flex");
  });

  test("the pin button keeps the panel open until Escape", async ({ page }) => {
    await inspect(page, "specs-token-button");
    await pinAndReach(page, "padding");

    await clickInside(page, "[data-react-grab-specs-pin]");
    await expect(page.locator("[data-react-grab-specs-pin]")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await page.mouse.move(AWAY_POSITION.x, AWAY_POSITION.y, { steps: 8 });
    await expect(page.locator(PINNED_PANEL_SELECTOR)).toHaveCount(1);

    await page.keyboard.press("Escape");
    await expect(page.locator(PINNED_PANEL_SELECTOR)).toHaveCount(0);
  });

  test("Reset switches everything back on", async ({ page }) => {
    await inspect(page, "specs-plain-button");
    await pinAndReach(page, "background-color");
    await expect(page.locator(RESET_SELECTOR)).toHaveCount(0);

    await toggle(page, "background-color");
    expect(await getStyle(page, "specs-plain-button", "background-color")).toBe("rgba(0, 0, 0, 0)");
    await toggle(page, "padding");
    expect(await getStyle(page, "specs-plain-button", "padding-left")).toBe("0px");

    await page.locator(RESET_SELECTOR).click();
    expect(await getStyle(page, "specs-plain-button", "background-color")).toBe(
      "rgb(12, 102, 228)",
    );
    expect(await getStyle(page, "specs-plain-button", "padding-left")).toBe("8px");
    await expect(page.locator(RESET_SELECTOR)).toHaveCount(0);
    expect(
      await page.locator("[data-testid='specs-plain-button']").getAttribute("style"),
    ).not.toContain("unset");
  });

  test("a property left off stays in Applied when inspected again", async ({ page }) => {
    await inspect(page, "specs-plain-button");
    await pinAndReach(page, "background-color");
    await toggle(page, "background-color");

    await page.mouse.move(AWAY_POSITION.x, AWAY_POSITION.y, { steps: 8 });
    await expect(page.locator(PINNED_PANEL_SELECTOR)).toHaveCount(0);
    await inspect(page, "specs-plain-button");

    const offRow = page.locator(
      '[data-react-grab-specs-applied] [data-react-grab-spec-row="background-color"]',
    );
    await expect(offRow).toHaveAttribute("data-off", "");
    await expect(specTokens(page, "background-color")).toHaveText(["--ds-background-brand-bold"]);
  });
});
