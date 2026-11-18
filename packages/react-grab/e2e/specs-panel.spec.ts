import type { Page } from "@playwright/test";
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
  switchOnSpecs,
  specRow,
  specTokens,
  getStyle,
  inspect,
  pinAndReach,
  specToggle,
  clickInside,
  toggle,
  typeValue,
  expandSpecRow,
  prepareBoxSpecs,
  resetSpecRow,
  expectStyles,
  getRenderedSize,
  expectRenderedRatio,
  moveToSpecsElement,
} from "./specs-panel-fixture.js";

test.describe("specs panel", () => {
  test.beforeEach(async ({ reactGrab, page }) => {
    await expect.poll(() => reactGrab.isToolbarVisible(), { timeout: 3000 }).toBe(true);
    await installSpecsFixture(page);
    await page.mouse.move(AWAY_POSITION.x, AWAY_POSITION.y);
    await reactGrab.activate();
    await switchOnSpecs(page);
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
    // The component name is looked up after the panel opens and makes its
    // header a line taller, so measure once the panel has stopped resizing.
    const panel = page.locator(PANEL_SELECTOR);
    let panelBefore = await panel.boundingBox();
    await expect
      .poll(async () => {
        const box = await panel.boundingBox();
        const isSettled = JSON.stringify(box) === JSON.stringify(panelBefore);
        panelBefore = box;
        return isSettled;
      })
      .toBe(true);

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

const PADDING_PROPERTIES = ["padding-top", "padding-right", "padding-bottom", "padding-left"];
const CORNER_PROPERTIES = [
  "border-top-left-radius",
  "border-top-right-radius",
  "border-bottom-right-radius",
  "border-bottom-left-radius",
];
const RATIO_LOCK_SELECTOR = "[data-react-grab-specs-ratio-lock]";

const rowValue = (page: Page, property: string) =>
  specRow(page, property).locator("[data-react-grab-spec-value]");

test.describe("expanded specs and ratio lock", () => {
  test.beforeEach(async ({ reactGrab, page }) => {
    await expect.poll(() => reactGrab.isToolbarVisible(), { timeout: 3000 }).toBe(true);
    await installSpecsFixture(page);
    await page.mouse.move(AWAY_POSITION.x, AWAY_POSITION.y);
    await reactGrab.activate();
    await switchOnSpecs(page);
  });

  test("expands padding in side order and collapses without changing the shorthand", async ({
    page,
  }) => {
    await prepareBoxSpecs(page);
    const children = page.locator('[data-react-grab-spec-row^="padding-"]');
    await expect(children.locator("[data-react-grab-spec-value]")).toHaveText([
      "4px",
      "8px",
      "12px",
      "16px",
    ]);
    await expect(children.locator("span.font-mono")).toHaveText(["Top", "Right", "Bottom", "Left"]);
    await expect(rowValue(page, "padding")).toHaveText("4px 8px 12px 16px");
    await specRow(page, "padding").locator("[data-react-grab-spec-expand]").click();
    await expect(children).toHaveCount(0);
    await expect(rowValue(page, "padding")).toHaveText("4px 8px 12px 16px");
  });

  test("collapsing commits valid side drafts, discards invalid drafts and releases focus", async ({
    page,
  }) => {
    await prepareBoxSpecs(page);
    const expandControl = specRow(page, "padding").locator("[data-react-grab-spec-expand]");
    await rowValue(page, "padding-top").click();
    await specRow(page, "padding-top").locator("[data-react-grab-spec-input]").fill("22px");
    await expandControl.click();
    await expect(specRow(page, "padding-top")).toHaveCount(0);
    await expectStyles(page, "specs-box-button", PADDING_PROPERTIES, [
      "22px",
      "8px",
      "12px",
      "16px",
    ]);
    await expandSpecRow(page, "padding");
    await rowValue(page, "padding-top").click();
    await specRow(page, "padding-top").locator("[data-react-grab-spec-input]").fill("invalid");
    await expandControl.click();
    await expect(specRow(page, "padding-top")).toHaveCount(0);
    await expectStyles(page, "specs-box-button", PADDING_PROPERTIES, [
      "22px",
      "8px",
      "12px",
      "16px",
    ]);
    await page.mouse.move(AWAY_POSITION.x, AWAY_POSITION.y, { steps: 8 });
    await expect(page.locator(PINNED_PANEL_SELECTOR)).toHaveCount(0);
  });

  test("editing one side updates only that side and the applied shorthand", async ({ page }) => {
    await prepareBoxSpecs(page);
    await typeValue(page, "padding-right", "24px");
    await expectStyles(page, "specs-box-button", PADDING_PROPERTIES, [
      "4px",
      "24px",
      "12px",
      "16px",
    ]);
    await expect(rowValue(page, "padding")).toHaveText("4px 24px 12px 16px");
    await expect(
      page.locator('[data-react-grab-specs-applied] [data-react-grab-spec-row="padding"]'),
    ).toHaveAttribute("data-overridden", "");
  });

  test("the last shorthand or side edit wins without changing other sides", async ({ page }) => {
    await prepareBoxSpecs(page);
    await typeValue(page, "padding-right", "24px");
    await typeValue(page, "padding", "20px");
    await expectStyles(page, "specs-box-button", PADDING_PROPERTIES, [
      "20px",
      "20px",
      "20px",
      "20px",
    ]);
    await expect(
      page.locator('[data-react-grab-spec-row^="padding-"] [data-react-grab-spec-value]'),
    ).toHaveText(["20px", "20px", "20px", "20px"]);
    await typeValue(page, "padding-bottom", "30px");
    await expectStyles(page, "specs-box-button", PADDING_PROPERTIES, [
      "20px",
      "20px",
      "30px",
      "20px",
    ]);
    await expect(rowValue(page, "padding")).toHaveText("20px 20px 30px");
    await typeValue(page, "padding", "var(--ds-space-050)");
    await typeValue(page, "padding-bottom", "30px");
    await expectStyles(page, "specs-box-button", PADDING_PROPERTIES, ["2px", "2px", "30px", "2px"]);
  });

  test("side and row resets restore originals and undo and redo each move one edit", async ({
    reactGrab,
    page,
  }) => {
    await prepareBoxSpecs(page);
    await typeValue(page, "padding", "20px");
    await typeValue(page, "padding-right", "30px");
    await page.keyboard.press(`${reactGrab.modifierKey}+z`);
    await expectStyles(page, "specs-box-button", PADDING_PROPERTIES, [
      "20px",
      "20px",
      "20px",
      "20px",
    ]);
    await page.keyboard.press(`${reactGrab.modifierKey}+Shift+z`);
    await expectStyles(page, "specs-box-button", PADDING_PROPERTIES, [
      "20px",
      "30px",
      "20px",
      "20px",
    ]);
    await resetSpecRow(page, "padding-right");
    await expectStyles(page, "specs-box-button", PADDING_PROPERTIES, [
      "20px",
      "8px",
      "20px",
      "20px",
    ]);
    await page.keyboard.press(`${reactGrab.modifierKey}+z`);
    await expectStyles(page, "specs-box-button", PADDING_PROPERTIES, [
      "20px",
      "30px",
      "20px",
      "20px",
    ]);
    await page.keyboard.press(`${reactGrab.modifierKey}+Shift+z`);
    await expectStyles(page, "specs-box-button", PADDING_PROPERTIES, [
      "20px",
      "8px",
      "20px",
      "20px",
    ]);
    await resetSpecRow(page, "padding");
    await expectStyles(page, "specs-box-button", PADDING_PROPERTIES, [
      "4px",
      "8px",
      "12px",
      "16px",
    ]);
    await expect(specRow(page, "padding")).not.toHaveAttribute("data-overridden");
  });

  test("the shorthand toggle preserves side overrides", async ({ page }) => {
    await prepareBoxSpecs(page);
    await typeValue(page, "padding-left", "40px");
    await toggle(page, "padding");
    await expectStyles(page, "specs-box-button", PADDING_PROPERTIES, ["0px", "0px", "0px", "0px"]);
    await toggle(page, "padding");
    await expectStyles(page, "specs-box-button", PADDING_PROPERTIES, [
      "4px",
      "8px",
      "12px",
      "40px",
    ]);
  });

  test("a side toggle restores its value and removes its override when turned back on", async ({
    page,
  }) => {
    await prepareBoxSpecs(page);
    await toggle(page, "padding-top");
    await expectStyles(page, "specs-box-button", PADDING_PROPERTIES, [
      "0px",
      "8px",
      "12px",
      "16px",
    ]);
    await toggle(page, "padding-top");
    await expectStyles(page, "specs-box-button", PADDING_PROPERTIES, [
      "4px",
      "8px",
      "12px",
      "16px",
    ]);
    await expect(specRow(page, "padding")).not.toHaveAttribute("data-overridden");
  });

  test("radius corners follow clockwise order and edit independently", async ({ page }) => {
    await prepareBoxSpecs(page, "border-radius");
    await expect(
      page
        .locator('[data-react-grab-spec-row$="-radius"] [data-react-grab-spec-value]')
        .filter({ hasText: /^\d+px$/ }),
    ).toHaveText(["2px", "4px", "6px", "8px"]);
    await expect(page.locator('[data-react-grab-spec-row$="-radius"] span.font-mono')).toHaveText([
      "border-radius",
      "Top left",
      "Top right",
      "Bottom right",
      "Bottom left",
    ]);
    await typeValue(page, "border-bottom-right-radius", "25px");
    await expectStyles(page, "specs-box-button", CORNER_PROPERTIES, ["2px", "4px", "25px", "8px"]);
    await expect(rowValue(page, "border-radius")).toHaveText("2px 4px 25px 8px");
    await typeValue(page, "border-top-left-radius", "10px 20px");
    await expectStyles(page, "specs-box-button", CORNER_PROPERTIES, [
      "10px 20px",
      "4px",
      "25px",
      "8px",
    ]);
    await expect(rowValue(page, "border-radius")).toHaveText(
      "10px 4px 25px 8px / 20px 4px 25px 8px",
    );
  });

  test("margin and border width sides expand and border width expands without a border", async ({
    page,
  }) => {
    await prepareBoxSpecs(page, "margin");
    await typeValue(page, "margin-left", "18px");
    await expectStyles(
      page,
      "specs-box-button",
      ["margin-top", "margin-right", "margin-bottom", "margin-left"],
      ["2px", "4px", "6px", "18px"],
    );
    await expandSpecRow(page, "border-width");
    await typeValue(page, "border-left-width", "9px");
    await expectStyles(
      page,
      "specs-box-button",
      ["border-top-width", "border-right-width", "border-bottom-width", "border-left-width"],
      ["1px", "2px", "3px", "9px"],
    );
    await moveToSpecsElement(page, "specs-plain-button");
    await expect(
      specRow(page, "border-width").locator("[data-react-grab-spec-expand]"),
    ).toHaveAttribute("aria-expanded", "true");
    await expect(
      specRow(page, "border-top-width").locator("[data-react-grab-spec-value]"),
    ).toHaveText("0px");
  });

  test("expanded rows stay open on another element", async ({ page }) => {
    await prepareBoxSpecs(page);
    await moveToSpecsElement(page, "specs-plain-button");
    await expect(specRow(page, "padding").locator("[data-react-grab-spec-expand]")).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    await expect(
      page.locator('[data-react-grab-spec-row^="padding-"] [data-react-grab-spec-value]'),
    ).toHaveText(["8px", "8px", "8px", "8px"]);
  });

  test("sub-row input validates, cancels, commits on blur and tabs in side order", async ({
    page,
  }) => {
    await prepareBoxSpecs(page);
    await typeValue(page, "padding-top", "invalid");
    const input = specRow(page, "padding-top").locator("[data-react-grab-specs-input]");
    await expect(input).toHaveAttribute("aria-invalid", "true");
    await input.press("Escape");
    await expect(input).toHaveCount(0);
    await rowValue(page, "padding-top").click();
    await input.fill("invalid");
    await input.press("Tab");
    await expectStyles(page, "specs-box-button", PADDING_PROPERTIES, [
      "4px",
      "8px",
      "12px",
      "16px",
    ]);
    for (const property of ["padding-right", "padding-bottom", "padding-left"]) {
      const sideInput = specRow(page, property).locator("[data-react-grab-specs-input]");
      await expect(sideInput).toBeFocused();
      await sideInput.press("Tab");
    }
    await rowValue(page, "padding-top").click();
    await input.fill("22px");
    await rowValue(page, "padding-right").click();
    await expect(input).toHaveCount(0);
    await expectStyles(page, "specs-box-button", PADDING_PROPERTIES, [
      "22px",
      "8px",
      "12px",
      "16px",
    ]);
    await rowValue(page, "padding-top").click();
    await input.fill("invalid");
    await rowValue(page, "padding-right").click();
    await expect(input).toHaveCount(0);
    await expect(rowValue(page, "padding-top")).toHaveText("22px");
  });

  test("sub-row token menu changes only that side", async ({ page }) => {
    await prepareBoxSpecs(page);
    await specRow(page, "padding-left").locator("[data-react-grab-spec-menu-trigger]").click();
    await page.locator("[data-react-grab-spec-value-filter]").fill("--ds-space-050");
    await page.locator('[data-react-grab-spec-option="--ds-space-050"]').click();
    await expectStyles(page, "specs-box-button", PADDING_PROPERTIES, ["4px", "8px", "12px", "2px"]);
  });

  test("ratio lock scales width and height and undo and redo restore both together", async ({
    reactGrab,
    page,
  }) => {
    await inspect(page, "specs-ratio-button");
    await pinAndReach(page, "width");
    const originalSize = await getRenderedSize(page, "specs-ratio-button");
    const ratio = originalSize.width / originalSize.height;
    const lock = page.locator(RATIO_LOCK_SELECTOR);
    await expect(lock).toHaveAccessibleName("Lock width and height ratio");
    await lock.click();
    await expect(lock).toHaveAccessibleName("Unlock width and height ratio");
    await typeValue(page, "width", "300px");
    await expectStyles(page, "specs-ratio-button", ["width"], ["300px"]);
    await expectRenderedRatio(page, "specs-ratio-button", ratio);
    const widthEditSize = await getRenderedSize(page, "specs-ratio-button");
    await page.keyboard.press(`${reactGrab.modifierKey}+z`);
    await expectStyles(page, "specs-ratio-button", ["width", "height"], ["200px", "100px"]);
    await page.keyboard.press(`${reactGrab.modifierKey}+Shift+z`);
    await expectRenderedRatio(page, "specs-ratio-button", ratio);
    expect(await getRenderedSize(page, "specs-ratio-button")).toEqual(widthEditSize);
    await typeValue(page, "height", "200px");
    await expectStyles(page, "specs-ratio-button", ["height"], ["200px"]);
    await expectRenderedRatio(page, "specs-ratio-button", ratio);
  });

  test("ratio lock resolves relative units, skips auto and zero and resets rows independently", async ({
    page,
  }) => {
    await inspect(page, "specs-ratio-button");
    await pinAndReach(page, "width");
    const originalSize = await getRenderedSize(page, "specs-ratio-button");
    const ratio = originalSize.width / originalSize.height;
    await page.locator(RATIO_LOCK_SELECTOR).click();
    await typeValue(page, "width", "10rem");
    await expectRenderedRatio(page, "specs-ratio-button", ratio);
    await typeValue(page, "width", "50%");
    await expectRenderedRatio(page, "specs-ratio-button", ratio);
    const pairedHeight = await getStyle(page, "specs-ratio-button", "height");
    await typeValue(page, "width", "auto");
    expect(await getStyle(page, "specs-ratio-button", "height")).toBe(pairedHeight);
    await typeValue(page, "width", "0px");
    expect(await getStyle(page, "specs-ratio-button", "height")).toBe(pairedHeight);
    await resetSpecRow(page, "width");
    await expectStyles(page, "specs-ratio-button", ["width"], ["200px"]);
    expect(await getStyle(page, "specs-ratio-button", "height")).toBe(pairedHeight);
    await expect(page.locator(RATIO_LOCK_SELECTOR)).toHaveAttribute("aria-pressed", "true");
  });

  test("ratio lock skips pairing when the previous rendered box has a zero dimension", async ({
    page,
  }) => {
    await inspect(page, "specs-box-button");
    await pinAndReach(page, "width");
    await typeValue(page, "padding", "0px");
    await typeValue(page, "border-width", "0px");
    await typeValue(page, "width", "0px");
    await expect.poll(async () => (await getRenderedSize(page, "specs-box-button")).width).toBe(0);
    await page.locator(RATIO_LOCK_SELECTOR).click();
    await typeValue(page, "width", "200px");
    await expectStyles(page, "specs-box-button", ["width", "height"], ["200px", "100px"]);
    await expect(page.locator(RATIO_LOCK_SELECTOR)).toHaveAttribute("aria-pressed", "true");
  });

  test("dimensions are independent with ratio lock off and another element starts unlocked", async ({
    page,
  }) => {
    await inspect(page, "specs-ratio-button");
    await pinAndReach(page, "width");
    await expect(page.locator(RATIO_LOCK_SELECTOR)).toHaveAttribute("aria-pressed", "false");
    await typeValue(page, "width", "300px");
    await expectStyles(page, "specs-ratio-button", ["width", "height"], ["300px", "100px"]);
    await page.locator(RATIO_LOCK_SELECTOR).click();
    await moveToSpecsElement(page, "specs-box-button");
    await pinAndReach(page, "width");
    await expect(page.locator(RATIO_LOCK_SELECTOR)).toHaveAttribute("aria-pressed", "false");
    await typeValue(page, "height", "120px");
    await expectStyles(page, "specs-box-button", ["width", "height"], ["200px", "120px"]);
  });

  test("hover keeps the panel corner and root node when the corner stays clear", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1600, height: 1200 });
    await page.getByTestId("specs-box-button").evaluate((element) => {
      element.style.left = "1300px";
      element.style.top = "100px";
      element.style.height = "1000px";
    });
    await inspect(page, "specs-box-button");
    const panel = page.locator(PANEL_SELECTOR);
    await expect(panel).toHaveCSS("left", "12px");
    const originalPanel = await panel.elementHandle();
    const originalCorner = await panel.evaluate((element) => [
      element.style.top,
      element.style.left,
    ]);
    await inspect(page, "specs-ratio-button");
    await expect(rowValue(page, "padding")).toHaveText("10px");
    expect(await panel.evaluate((element, previous) => element === previous, originalPanel)).toBe(
      true,
    );
    expect(await panel.evaluate((element) => [element.style.top, element.style.left])).toEqual(
      originalCorner,
    );
  });

  test("returning to a previously locked element starts unlocked", async ({ page }) => {
    await inspect(page, "specs-ratio-button");
    await pinAndReach(page, "width");
    await page.locator(RATIO_LOCK_SELECTOR).click();
    await moveToSpecsElement(page, "specs-box-button");
    await expect(page.locator(RATIO_LOCK_SELECTOR)).toHaveAttribute("aria-pressed", "false");
    await moveToSpecsElement(page, "specs-ratio-button");
    await expect(page.locator(RATIO_LOCK_SELECTOR)).toHaveAttribute("aria-pressed", "false");
  });

  test("an off shorthand disables every side and preserves its base and patches", async ({
    page,
    reactGrab,
  }) => {
    await prepareBoxSpecs(page);
    await typeValue(page, "padding", "20px");
    await typeValue(page, "padding-left", "40px");
    await rowValue(page, "padding-left").click();
    await specRow(page, "padding-left").locator("[data-react-grab-spec-input]").fill("50px");
    await toggle(page, "padding");
    await expect(page.locator("[data-react-grab-spec-input]")).toHaveCount(0);
    for (const property of PADDING_PROPERTIES) {
      await expect(specRow(page, property)).toHaveAttribute("data-off", "");
      await expect(specToggle(page, property)).toHaveCount(0);
      await expect(rowValue(page, property)).toHaveText(
        property === "padding-left" ? "40px" : "20px",
      );
      await expect(rowValue(page, property)).not.toHaveRole("button");
      await expect(
        specRow(page, property).locator("[data-react-grab-spec-menu-trigger]"),
      ).toHaveCount(0);
    }
    await toggle(page, "padding");
    await expectStyles(page, "specs-box-button", PADDING_PROPERTIES, [
      "20px",
      "20px",
      "20px",
      "40px",
    ]);
    await page.keyboard.press(`${reactGrab.modifierKey}+z`);
    await expect(specRow(page, "padding-left")).toHaveAttribute("data-off", "");
    await expect(rowValue(page, "padding-left")).toHaveText("40px");
    await page.keyboard.press(`${reactGrab.modifierKey}+Shift+z`);
    await expectStyles(page, "specs-box-button", PADDING_PROPERTIES, [
      "20px",
      "20px",
      "20px",
      "40px",
    ]);
  });

  test("ratio lock leaves height untouched when max-width prevents a width change", async ({
    page,
  }) => {
    await page.getByTestId("specs-ratio-button").evaluate((element) => {
      element.style.maxWidth = "200px";
    });
    await inspect(page, "specs-ratio-button");
    await pinAndReach(page, "width");
    await page.locator(RATIO_LOCK_SELECTOR).click();
    await typeValue(page, "width", "400px");
    await expectStyles(page, "specs-ratio-button", ["width", "height"], ["200px", "100px"]);
    expect(
      await page
        .getByTestId("specs-ratio-button")
        .evaluate((element) => element.style.getPropertyPriority("height")),
    ).toBe("");
    await expect(specRow(page, "height")).not.toHaveAttribute("data-overridden");
  });

  test("ratio lock preserves auto height when aspect-ratio already follows width", async ({
    page,
  }) => {
    await page.getByTestId("specs-box-button").evaluate((element) => {
      element.style.height = "auto";
      element.style.aspectRatio = "2 / 1";
    });
    await inspect(page, "specs-box-button");
    await pinAndReach(page, "width");
    await page.locator(RATIO_LOCK_SELECTOR).click();
    await typeValue(page, "width", "300px");
    await expectStyles(page, "specs-box-button", ["width", "height"], ["300px", "150px"]);
    expect(
      await page.getByTestId("specs-box-button").evaluate((element) => element.style.height),
    ).toBe("auto");
    await expect(specRow(page, "height")).not.toHaveAttribute("data-overridden");
  });

  test("ratio lock preserves the layout ratio of a rotated element", async ({ page }) => {
    await page.getByTestId("specs-box-button").evaluate((element) => {
      element.style.transform = "rotate(30deg) scale(0.8)";
    });
    await inspect(page, "specs-box-button");
    await pinAndReach(page, "width");
    await page.locator(RATIO_LOCK_SELECTOR).click();
    await typeValue(page, "width", "300px");
    await expect
      .poll(() =>
        page
          .getByTestId("specs-box-button")
          .evaluate((element) =>
            element instanceof HTMLElement ? element.offsetWidth / element.offsetHeight : null,
          ),
      )
      .toBeCloseTo(2, 2);
  });

  test("picking the same side token again adds no undo step", async ({ page, reactGrab }) => {
    await prepareBoxSpecs(page);
    const pickTopToken = async () => {
      await specRow(page, "padding-top").locator("[data-react-grab-spec-menu-trigger]").click();
      await page.locator("[data-react-grab-spec-value-filter]").fill("--ds-space-050");
      await page.locator('[data-react-grab-spec-option="--ds-space-050"]').click();
      await expect(page.locator("[data-react-grab-spec-value-menu]")).toHaveCount(0);
    };
    await pickTopToken();
    await typeValue(page, "padding-right", "30px");
    await pickTopToken();
    await page.keyboard.press(`${reactGrab.modifierKey}+z`);
    await expectStyles(page, "specs-box-button", PADDING_PROPERTIES, [
      "2px",
      "8px",
      "12px",
      "16px",
    ]);
  });

  test("keyboard expansion keeps focus and the panel pinned", async ({ page }) => {
    await inspect(page, "specs-box-button");
    await pinAndReach(page, "padding");
    await rowValue(page, "padding").click();
    await page.keyboard.press("Shift+Tab");
    const expandControl = specRow(page, "padding").locator("[data-react-grab-spec-expand]");
    await expect(expandControl).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(expandControl).toHaveAttribute("aria-expanded", "true");
    await expect(expandControl).toBeFocused();
    await page.mouse.move(AWAY_POSITION.x, AWAY_POSITION.y, { steps: 8 });
    await expect(page.locator(PINNED_PANEL_SELECTOR)).toHaveCount(1);
  });

  test("Tab crosses expanded row boundaries in both directions", async ({ page }) => {
    await prepareBoxSpecs(page);
    const nextProperty = await specRow(page, "padding-left").evaluate((element) =>
      element.nextElementSibling?.getAttribute("data-react-grab-spec-row"),
    );
    expect(nextProperty).toBeTruthy();
    await rowValue(page, "padding-left").click();
    await page.keyboard.press("Tab");
    const nextInput = specRow(page, nextProperty ?? "").locator("[data-react-grab-spec-input]");
    await expect(nextInput).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(
      specRow(page, "padding-left").locator("[data-react-grab-spec-input]"),
    ).toBeFocused();
    await rowValue(page, "padding-top").click();
    await page.keyboard.press("Shift+Tab");
    await expect(specRow(page, "padding").locator("[data-react-grab-spec-input]")).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(
      specRow(page, "padding-top").locator("[data-react-grab-spec-input]"),
    ).toBeFocused();
  });

  test("expanding while pinned looks up side tokens immediately", async ({ page }) => {
    await inspect(page, "specs-plain-button");
    await pinAndReach(page, "padding");
    await expect(specRow(page, "padding-top")).toHaveCount(0);
    await expandSpecRow(page, "padding");
    for (const property of PADDING_PROPERTIES)
      await expect(specTokens(page, property)).toHaveText(["--ds-space-050 × 4"]);
  });

  test("expanded side tokens follow overlapping logical and physical padding", async ({ page }) => {
    await inspect(page, "specs-token-button");
    await pinAndReach(page, "padding");
    await expandSpecRow(page, "padding");
    await expect(specTokens(page, "padding-top")).toHaveText(["--ds-space-050 × 4"]);
    await expect(specTokens(page, "padding-right")).toHaveText(["--ds-space-050 × 6"]);
    await expect(specTokens(page, "padding-bottom")).toHaveText(["--ds-space-050 × 4"]);
    await expect(specTokens(page, "padding-left")).toHaveText(["--ds-space-050 × 6"]);
  });

  test("expanded sides name only their component of a two-token shorthand", async ({ page }) => {
    await inspect(page, "specs-split-padding-button");
    await pinAndReach(page, "padding");
    await expect(specTokens(page, "padding")).toHaveText(["--vertical, --horizontal"]);
    await expandSpecRow(page, "padding");
    await expect(page.locator(PINNED_PANEL_SELECTOR)).toHaveCount(1);
    await expect(specTokens(page, "padding-top")).toHaveText(["--vertical"]);
    await expect(specTokens(page, "padding-bottom")).toHaveText(["--vertical"]);
    await expect(specTokens(page, "padding-left")).toHaveText(["--horizontal"]);
    await expect(specTokens(page, "padding-right")).toHaveText(["--horizontal"]);
    await expect(specTokens(page, "padding")).toHaveText(["--vertical, --horizontal"]);
  });

  test("reopening Changes pinned keeps a corner clear of its element", async ({
    page,
    reactGrab,
  }) => {
    await page.setViewportSize({ width: 1600, height: 1200 });
    await page.getByTestId("specs-box-button").evaluate((element) => {
      element.style.left = "1300px";
      element.style.top = "100px";
      element.style.height = "1000px";
    });
    await inspect(page, "specs-box-button");
    await pinAndReach(page, "padding");
    await typeValue(page, "padding", "20px");
    await expect(page.locator(PANEL_SELECTOR)).toHaveCSS("left", "12px");
    await reactGrab.deactivate();
    await page.locator('[data-react-grab-toolbar-action="style-changes"]').click();
    await page.locator("[data-react-grab-changes-configure]").click();
    await expect(page.locator(PINNED_PANEL_SELECTOR)).toHaveAttribute("data-pin-locked", "");
    await expect(page.locator(PANEL_SELECTOR)).toHaveCSS("left", "12px");
  });
});
