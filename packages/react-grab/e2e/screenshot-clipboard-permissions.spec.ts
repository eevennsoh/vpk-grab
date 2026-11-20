import { test, expect } from "./fixtures.js";
import {
  CLIPBOARD_ACTIVATION_EXPIRY_MS,
  GRAB_CLIPBOARD_TYPE,
  IMAGE_AND_TEXT_TYPES,
  IMAGE_ONLY_TYPES,
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
    await expect(page.locator(COMPLETION_SELECTOR)).toContainText(
      automatic ? "Copied prompt & image" : "Copied image",
    );
    expect(await readPermission()).toBe("prompt");

    await context.grantPermissions(["clipboard-read"]);
    const image = await page.evaluate(async () => {
      const [item] = await navigator.clipboard.read();
      const types = [...item.types].sort();
      return {
        types,
        text: types.includes("text/plain") ? await (await item.getType("text/plain")).text() : null,
        html: types.includes("text/html") ? await (await item.getType("text/html")).text() : null,
        pngSize: (await item.getType("image/png")).size,
      };
    });
    expect(image.pngSize).toBeGreaterThan(0);
    if (!automatic) {
      expect(image.types).toEqual(IMAGE_ONLY_TYPES);
      return;
    }
    expect(image.types).toEqual(IMAGE_AND_TEXT_TYPES);
    expect(image.text).toBe(copied["text/plain"]);
    expect(image.html).toContain("TodoItem");
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
  await reactGrab.clickElement(TODO_SELECTOR);
  await page.locator(CAMERA_SELECTOR).evaluate(async (button, delayMs) => {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    if (navigator.userActivation.isActive || !(button instanceof HTMLButtonElement)) {
      throw new Error("Expected a camera button without transient activation");
    }
    button.click();
  }, CLIPBOARD_ACTIVATION_EXPIRY_MS);
  await expect(page.locator(COMPLETION_SELECTOR)).toContainText("Copied image");
  const types = await page.evaluate(async () => {
    const [item] = await navigator.clipboard.read();
    return [...item.types];
  });
  expect(types).toEqual(IMAGE_ONLY_TYPES);
});
