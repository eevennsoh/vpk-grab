// Shared by the specs panel and style changes specs: a fixed fixture with
// design tokens, and the pointer and keyboard steps that pin and edit the panel.
import type { Page } from "@playwright/test";
import { expect } from "./fixtures.js";

export const FIXTURE_STYLE_ID = "specs-panel-fixture-style";
export const FIXTURE_ROOT_ID = "specs-panel-fixture-root";
export const PANEL_SELECTOR = "[data-react-grab-specs-panel]";
export const PINNED_PANEL_SELECTOR = `${PANEL_SELECTOR}[data-pinned]`;
export const HIERARCHY_MENU_SELECTOR = "[data-react-grab-hierarchy-menu]";
export const RESET_SELECTOR = "[data-react-grab-specs-reset]";
export const AWAY_POSITION = { x: 620, y: 520 };
const TOOLBAR_SELECTOR = "[data-react-grab-toolbar]";
const SPECS_TOGGLE_SELECTOR = '[data-react-grab-toolbar-action="inspect-specs"]';

// Specs only joins the toolbar once Grab is active, so it is switched on
// after activating. Leaving the toolbar eases it back, and the panel keeps
// clear of it, so measuring waits until the toolbar has settled.
export const switchOnSpecs = async (page: Page) => {
  await page.locator(SPECS_TOGGLE_SELECTOR).click();
  await page.mouse.move(AWAY_POSITION.x, AWAY_POSITION.y);
  const toolbar = page.locator(TOOLBAR_SELECTOR);
  let previousBox = await toolbar.boundingBox();
  await expect
    .poll(async () => {
      const box = await toolbar.boundingBox();
      const isSettled = JSON.stringify(box) === JSON.stringify(previousBox);
      previousBox = box;
      return isSettled;
    })
    .toBe(true);
};

export const installSpecsFixture = (page: Page) =>
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

export const getCenter = async (page: Page, selector: string) => {
  const box = await page.locator(selector).boundingBox();
  if (!box) throw new Error(`No box for ${selector}`);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
};

export const specRow = (page: Page, property: string) =>
  page.locator(`[data-react-grab-spec-row="${property}"]`);

export const specTokens = (page: Page, property: string) =>
  specRow(page, property).locator("[data-react-grab-spec-token]");

export const getStyle = (page: Page, testId: string, property: string) =>
  page.evaluate(
    ({ targetTestId, propertyName }) => {
      const element = document.querySelector(`[data-testid='${targetTestId}']`);
      return element ? getComputedStyle(element).getPropertyValue(propertyName) : null;
    },
    { targetTestId: testId, propertyName: property },
  );

export const inspect = async (page: Page, testId: string) => {
  const center = await getCenter(page, `[data-testid='${testId}']`);
  await page.mouse.move(center.x, center.y, { steps: 6 });
  await expect(page.locator("[data-react-grab-specs-header]")).toContainText("<button>");
};

// Shift is held only for the trip to the panel, as it would be by hand.
export const pinAndReach = async (page: Page, property: string) => {
  await page.keyboard.down("Shift");
  await expect(page.locator(PINNED_PANEL_SELECTOR)).toHaveCount(1);
  const rowCenter = await getCenter(page, `[data-react-grab-spec-row="${property}"]`);
  await page.mouse.move(rowCenter.x, rowCenter.y, { steps: 10 });
  await page.keyboard.up("Shift");
  return rowCenter;
};

export const specToggle = (page: Page, property: string) =>
  specRow(page, property).locator("[data-react-grab-spec-toggle]");

export const clickInside = async (page: Page, selector: string) => {
  const center = await getCenter(page, selector);
  await page.mouse.click(center.x, center.y);
};

export const toggle = (page: Page, property: string) =>
  clickInside(page, `[data-react-grab-spec-row="${property}"] [data-react-grab-spec-toggle]`);

export const typeValue = async (page: Page, property: string, value: string) => {
  await clickInside(page, `[data-react-grab-spec-row="${property}"] [data-react-grab-spec-value]`);
  const input = specRow(page, property).locator("[data-react-grab-spec-input]");
  await expect(input).toBeFocused();
  await input.fill(value);
  await input.press("Enter");
};
