// The specs panel: the design tokens it names for applied properties, the
// Shift pin that lets the pointer reach it, and the switches a pinned panel
// turns its applied rows into.
import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures.js";

const FIXTURE_STYLE_ID = "specs-panel-fixture-style";
const FIXTURE_ROOT_ID = "specs-panel-fixture-root";
const PANEL_SELECTOR = "[data-react-grab-specs-panel]";
const PINNED_PANEL_SELECTOR = `${PANEL_SELECTOR}[data-pinned]`;
const HIERARCHY_MENU_SELECTOR = "[data-react-grab-hierarchy-menu]";
const RESET_SELECTOR = "[data-react-grab-specs-reset]";
const AWAY_POSITION = { x: 620, y: 520 };

const installSpecsFixture = (page: Page) =>
  page.evaluate(
    ({ styleId, rootId }) => {
      document.getElementById(styleId)?.remove();
      document.getElementById(rootId)?.remove();

      const styleElement = document.createElement("style");
      styleElement.id = styleId;
      styleElement.textContent = `
        :root {
          --ds-space-050: 2px;
          --ds-radius-medium: 6px;
          --ds-shadow-raised: 0 1px 2px rgba(9, 30, 66, 0.25);
          --ds-background-brand-bold: #0c66e4;
          --ds-background-brand-bold-hovered: #0055cc;
          --ds-text-inverse: #ffffff;
        }
        #${rootId} { position: fixed; left: 80px; top: 320px; z-index: 900; }
        #${rootId} button { display: block; border: 0; margin: 0 0 24px; }
        @layer utilities {
          .tk-pad { padding: calc(var(--ds-space-050) * 4); }
          .tk-px { padding-inline: calc(var(--ds-space-050) * 6); }
          .tk-bg { background-color: var(--ds-background-brand-bold); }
          .tk-bg-hover { &:hover { @media (hover: hover) { background-color: var(--ds-background-brand-bold-hovered); } } }
          .tk-radius { border-radius: var(--ds-radius-medium); }
          .tk-shadow { --tw-shadow: var(--ds-shadow-raised); box-shadow: var(--tw-inset-shadow, 0 0 #0000), var(--tw-shadow); }
          .tk-text { color: var(--ds-text-inverse); }
        }
      `;
      document.head.appendChild(styleElement);

      const rootElement = document.createElement("div");
      rootElement.id = rootId;
      rootElement.innerHTML = `
        <button data-testid="specs-token-button" class="tk-pad tk-px tk-bg tk-bg-hover tk-radius tk-shadow tk-text">Tokens</button>
        <button data-testid="specs-plain-button" class="tk-pad tk-bg tk-text">Plain</button>
      `;
      document.body.appendChild(rootElement);
    },
    { styleId: FIXTURE_STYLE_ID, rootId: FIXTURE_ROOT_ID },
  );

const getCenter = async (page: Page, selector: string) => {
  const box = await page.locator(selector).boundingBox();
  if (!box) throw new Error(`No box for ${selector}`);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
};

const specRow = (page: Page, property: string) =>
  page.locator(`[data-react-grab-spec-row="${property}"]`);

const specTokens = (page: Page, property: string) =>
  specRow(page, property).locator("[data-react-grab-spec-token]");

const getStyle = (page: Page, testId: string, property: string) =>
  page.evaluate(
    ({ targetTestId, propertyName }) => {
      const element = document.querySelector(`[data-testid='${targetTestId}']`);
      return element ? getComputedStyle(element).getPropertyValue(propertyName) : null;
    },
    { targetTestId: testId, propertyName: property },
  );

const inspect = async (page: Page, testId: string) => {
  const center = await getCenter(page, `[data-testid='${testId}']`);
  await page.mouse.move(center.x, center.y, { steps: 6 });
  await expect(page.locator("[data-react-grab-specs-header]")).toContainText("<button>");
};

// Shift is held only for the trip to the panel, as it would be by hand.
const pinAndReach = async (page: Page, property: string) => {
  await page.keyboard.down("Shift");
  await expect(page.locator(PINNED_PANEL_SELECTOR)).toHaveCount(1);
  const rowCenter = await getCenter(page, `[data-react-grab-spec-row="${property}"]`);
  await page.mouse.move(rowCenter.x, rowCenter.y, { steps: 10 });
  await page.keyboard.up("Shift");
  return rowCenter;
};

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

  test("clicking an applied row switches the property off and on again", async ({
    reactGrab,
    page,
  }) => {
    await inspect(page, "specs-token-button");
    const paddingRow = await pinAndReach(page, "padding");
    expect(await getStyle(page, "specs-token-button", "padding-left")).toBe("12px");

    await page.mouse.click(paddingRow.x, paddingRow.y);
    expect(await getStyle(page, "specs-token-button", "padding-left")).toBe("0px");
    await expect(specRow(page, "padding")).toHaveAttribute("data-disabled", "");
    await expect(specRow(page, "padding")).toHaveAttribute("aria-checked", "false");
    await expect(specRow(page, "padding").locator("[data-react-grab-spec-value]")).toHaveText(
      "8px 12px",
    );
    expect(await reactGrab.isOverlayVisible()).toBe(true);

    const disabledRow = await getCenter(page, '[data-react-grab-spec-row="padding"]');
    await page.mouse.click(disabledRow.x, disabledRow.y);
    expect(await getStyle(page, "specs-token-button", "padding-left")).toBe("12px");
    await expect(specRow(page, "padding")).not.toHaveAttribute("data-disabled");
  });

  test("display falls back to the tag's default rather than inline", async ({ page }) => {
    await inspect(page, "specs-token-button");
    const displayRow = await pinAndReach(page, "display");

    await page.mouse.click(displayRow.x, displayRow.y);
    expect(await getStyle(page, "specs-token-button", "display")).toBe("inline-block");
  });

  test("rows that are not applied are not switches", async ({ page }) => {
    await inspect(page, "specs-token-button");
    const borderRow = await pinAndReach(page, "border-width");

    await expect(specRow(page, "border-width")).not.toHaveAttribute("role");
    await page.mouse.click(borderRow.x, borderRow.y);
    await expect(specRow(page, "border-width")).not.toHaveAttribute("data-disabled");
  });

  test("Reset switches everything back on", async ({ page }) => {
    await inspect(page, "specs-plain-button");
    const backgroundRow = await pinAndReach(page, "background-color");
    await expect(page.locator(RESET_SELECTOR)).toHaveCount(0);

    await page.mouse.click(backgroundRow.x, backgroundRow.y);
    expect(await getStyle(page, "specs-plain-button", "background-color")).toBe("rgba(0, 0, 0, 0)");
    const paddingRow = await getCenter(page, '[data-react-grab-spec-row="padding"]');
    await page.mouse.click(paddingRow.x, paddingRow.y);
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

  test("a property left off is still listed as off when inspected again", async ({ page }) => {
    await inspect(page, "specs-plain-button");
    const backgroundRow = await pinAndReach(page, "background-color");
    await page.mouse.click(backgroundRow.x, backgroundRow.y);

    await page.mouse.move(AWAY_POSITION.x, AWAY_POSITION.y, { steps: 8 });
    await expect(page.locator(PINNED_PANEL_SELECTOR)).toHaveCount(0);
    await inspect(page, "specs-plain-button");

    await expect(specRow(page, "background-color")).toHaveAttribute("data-disabled", "");
    await expect(specTokens(page, "background-color")).toHaveText(["--ds-background-brand-bold"]);
  });
});
