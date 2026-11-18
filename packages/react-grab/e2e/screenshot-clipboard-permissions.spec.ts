import { test, expect } from "./fixtures.js";
import {
  CLIPBOARD_ACTIVATION_EXPIRY_MS,
  GRAB_CLIPBOARD_TYPE,
  IMAGE_AND_GRAB_TYPES,
  IMAGE_AND_TEXT_TYPES,
  WEB_GRAB_CLIPBOARD_TYPE,
} from "./constants.js";

const TODO_SELECTOR = "[data-testid='todo-list'] li:first-child span";
const CAMERA_SELECTOR = "[data-react-grab-copy-screenshot]";
const COMPLETION_SELECTOR = "[data-react-grab-completion]";
const SCREENSHOT_TOGGLE_SELECTOR = '[data-react-grab-toolbar-action="auto-screenshot"]';

test.use({
  channel: process.env.CI ? "chrome" : "chromium",
  headless: true,
  permissions: [
    async ({ contextOptions }, use) => use(contextOptions.permissions),
    { scope: "test" },
  ],
});

for (const automatic of [true, false]) {
  test(`the ${automatic ? "automatic screenshot" : "pill camera"} copies without a clipboard permission grant`, async ({
    reactGrab,
    page,
    context,
  }) => {
    const readPermission = () =>
      page.evaluate(
        async () =>
          (await navigator.permissions.query({ name: "clipboard-read" as PermissionName })).state,
      );
    expect(await readPermission()).toBe("prompt");
    await reactGrab.activate();
    if (automatic) await page.locator(SCREENSHOT_TOGGLE_SELECTOR).click();
    await reactGrab.hoverUntilSelected(TODO_SELECTOR);
    const readCopy = await reactGrab.captureNextClipboardWrites();
    await reactGrab.clickElement(TODO_SELECTOR);
    const copied = await readCopy();
    expect(copied[GRAB_CLIPBOARD_TYPE]).toBeTruthy();
    if (!automatic) await page.locator(CAMERA_SELECTOR).click();
    await expect(page.locator(COMPLETION_SELECTOR)).toContainText("Copied with image");
    expect(await readPermission()).toBe("prompt");

    await context.grantPermissions(["clipboard-read"]);
    const image = await page.evaluate(async () => {
      const [item] = await navigator.clipboard.read();
      return {
        types: [...item.types].sort(),
        text: await (await item.getType("text/plain")).text(),
        html: await (await item.getType("text/html")).text(),
        pngSize: (await item.getType("image/png")).size,
      };
    });
    expect(image.types).toEqual(IMAGE_AND_TEXT_TYPES);
    expect(image.text).toBe(copied["text/plain"]);
    expect(image.html).toContain("TodoItem");
    expect(image.pngSize).toBeGreaterThan(0);
  });
}

test("the camera still copies after transient activation expires on a granted origin", async ({
  reactGrab,
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await reactGrab.activate();
  await reactGrab.hoverUntilSelected(TODO_SELECTOR);
  const readCopy = await reactGrab.captureNextClipboardWrites();
  await reactGrab.clickElement(TODO_SELECTOR);
  const copied = await readCopy();
  await page.locator(CAMERA_SELECTOR).evaluate(async (button, delayMs) => {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    if (navigator.userActivation.isActive || !(button instanceof HTMLButtonElement)) {
      throw new Error("Expected a camera button without transient activation");
    }
    button.click();
  }, CLIPBOARD_ACTIVATION_EXPIRY_MS);
  await expect(page.locator(COMPLETION_SELECTOR)).toContainText("Copied with image");
  const image = await page.evaluate(async (customType) => {
    const [item] = await navigator.clipboard.read();
    return {
      types: [...item.types].sort(),
      metadata: await (await item.getType(customType)).text(),
    };
  }, WEB_GRAB_CLIPBOARD_TYPE);
  expect(image.types).toEqual(IMAGE_AND_GRAB_TYPES);
  expect(image.metadata).toBe(copied[GRAB_CLIPBOARD_TYPE]);
});
