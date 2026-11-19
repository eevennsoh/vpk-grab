import { test, expect, type ReactGrabPageObject } from "./fixtures.js";
import { TOOLBAR_NO_COPY_SETTLE_MS } from "./constants.js";

const BUTTON_SELECTOR = "button";

const waitForToolbar = async (reactGrab: ReactGrabPageObject) => {
  await expect.poll(() => reactGrab.isToolbarVisible(), { timeout: 2000 }).toBe(true);
};

test.describe("Toolbar Action Buttons", () => {
  test.describe("Layout", () => {
    test("renders the copy button unpressed, then the inspect and annotation controls", async ({
      reactGrab,
    }) => {
      await waitForToolbar(reactGrab);

      const actionIds = await reactGrab.page
        .locator("[data-react-grab-toolbar-action]")
        .evaluateAll((elements) =>
          elements.map((element) => element.getAttribute("data-react-grab-toolbar-action")),
        );
      expect(actionIds).toEqual([
        "copy",
        "annotate-pen",
        "annotate-rectangle",
        "annotate-text",
        "inspect-specs",
        "inspect-redlines",
        "auto-screenshot",
        "annotation-color-red",
        "annotation-color-orange",
        "annotation-color-yellow",
        "annotation-color-green",
        "annotation-color-black",
        "annotate-edit",
        "annotate-clear",
        "style-changes",
      ]);
      expect(await reactGrab.getToolbarActionPressed("copy")).toBe(false);
    });

    for (const removedDefault of ["comment", "open"]) {
      test(`falls back to Copy for the ${removedDefault} default`, async ({ reactGrab, page }) => {
        await waitForToolbar(reactGrab);
        await page.evaluate(
          (defaultAction) => window.__REACT_GRAB__?.setToolbarState({ defaultAction }),
          removedDefault,
        );
        await expect(page.locator('[data-react-grab-toolbar-action="copy"]')).toHaveAttribute(
          "aria-label",
          "Copy element",
        );
        await reactGrab.clickToolbarAction("copy");
        await reactGrab.hoverUntilSelected(BUTTON_SELECTOR);
        await reactGrab.clickElement(BUTTON_SELECTOR);
        await expect.poll(() => reactGrab.getLabelStatusText()).toBe("Copied");
        expect(await reactGrab.isPromptModeActive()).toBe(false);
      });
    }
  });

  test.describe("Active-state attribution", () => {
    test("clicking Copy marks it as pressed", async ({ reactGrab }) => {
      await waitForToolbar(reactGrab);
      await reactGrab.clickToolbarAction("copy");

      expect(await reactGrab.getToolbarActionPressed("copy")).toBe(true);
    });

    test("activating via API (no toolbar button) marks Copy as pressed", async ({ reactGrab }) => {
      await waitForToolbar(reactGrab);
      await reactGrab.activate();

      expect(await reactGrab.getToolbarActionPressed("copy")).toBe(true);
    });

    test("updates the armed action when a plugin default changes", async ({ reactGrab, page }) => {
      await waitForToolbar(reactGrab);
      await page.evaluate(() =>
        window.__REACT_GRAB__?.registerPlugin({
          name: "custom-copy",
          actions: [
            {
              id: "custom-copy",
              label: "Custom copy",
              showInToolbarMenu: true,
              onAction: (context) => context.copy?.(),
            },
          ],
        }),
      );
      await reactGrab.clickToolbarAction("copy");
      await reactGrab.rightClickToolbarToggle();
      await reactGrab.clickToolbarMenuItem("custom-copy");
      expect(await reactGrab.getToolbarActionPressed("custom-copy")).toBe(true);
      await reactGrab.hoverUntilSelected(BUTTON_SELECTOR);
      await reactGrab.clickElement(BUTTON_SELECTOR);
      await expect.poll(() => reactGrab.getLabelStatusText()).toBe("Copied");
    });

    test("the toolbar returns from API comment mode to Copy", async ({ reactGrab }) => {
      await reactGrab.enterPromptMode("[data-testid='todo-list'] h1");
      await reactGrab.clickToolbarAction("copy");
      await expect.poll(() => reactGrab.getClipboardContent()).toContain("Todo List");
      expect(await reactGrab.isPromptModeActive()).toBe(false);
      expect(await reactGrab.getToolbarActionPressed("copy")).toBe(true);
    });

    test("Escape resets the Copy button to unpressed", async ({ reactGrab }) => {
      await waitForToolbar(reactGrab);
      await reactGrab.clickToolbarAction("copy");
      expect(await reactGrab.getToolbarActionPressed("copy")).toBe(true);

      await reactGrab.deactivate();

      expect(await reactGrab.getToolbarActionPressed("copy")).toBe(false);
    });

    test("bare Enter copies and keeps the Copy button pressed", async ({ reactGrab }) => {
      await waitForToolbar(reactGrab);
      await reactGrab.activate();
      await reactGrab.hoverUntilSelected(BUTTON_SELECTOR);
      await reactGrab.pressEnter();

      await expect.poll(() => reactGrab.getLabelStatusText()).toBe("Copied");
      expect(await reactGrab.isPromptModeActive()).toBe(false);
      expect(await reactGrab.getToolbarActionPressed("copy")).toBe(true);
    });
  });
});

for (const selectionRoute of ["click", "marquee", "prompt"]) {
  for (const fallbackReason of ["unknown", "disabled"]) {
    const shouldCopy = selectionRoute !== "prompt" || fallbackReason !== "disabled";
    const testName = shouldCopy
      ? `Copy fallback for ${fallbackReason} action via ${selectionRoute}`
      : "Disabled action leaves the prompt without copying";
    test(testName, async ({ reactGrab, page }) => {
      await waitForToolbar(reactGrab);
      await page.evaluate((reason) => {
        document.documentElement.dataset.toolbarCopyCount = "0";
        document.addEventListener(
          "copy",
          (event) => {
            const previousCount = Number(document.documentElement.dataset.toolbarCopyCount);
            document.documentElement.dataset.toolbarCopyCount = String(previousCount + 1);
            const clipboardData = event.clipboardData;
            if (!clipboardData) return;
            const originalSetData = clipboardData.setData.bind(clipboardData);
            clipboardData.setData = (format, content) => {
              if (format === "text/plain") {
                document.documentElement.dataset.toolbarCopiedText = content;
              }
              originalSetData(format, content);
            };
          },
          { capture: true },
        );
        if (reason === "disabled") {
          window.__REACT_GRAB__?.registerPlugin({
            name: "disabled-default",
            actions: [
              {
                id: "fallback-action",
                label: "Disabled",
                enabled: false,
                onAction: () => {
                  throw new Error("Disabled action ran");
                },
              },
            ],
          });
        }
        window.__REACT_GRAB__?.setToolbarState({ defaultAction: "fallback-action" });
      }, fallbackReason);
      if (selectionRoute === "prompt") {
        await reactGrab.enterPromptMode("[data-testid='todo-list'] h1");
      } else {
        await reactGrab.clickToolbarAction("fallback-action");
        await reactGrab.hoverUntilSelected("[data-testid='todo-list'] h1");
      }
      if (selectionRoute === "prompt") {
        await reactGrab.clickToolbarAction("fallback-action");
      } else if (selectionRoute === "marquee") {
        await reactGrab.dragSelect(
          "[data-testid='todo-list'] h1",
          "[data-testid='todo-list'] li:last-child",
        );
      } else {
        await reactGrab.clickElement("[data-testid='todo-list'] h1");
      }
      if (shouldCopy) {
        await expect(page.locator("html")).toHaveAttribute(
          "data-toolbar-copied-text",
          selectionRoute === "marquee" ? /TodoList/ : /Todo List/,
        );
      } else {
        await expect.poll(() => page.evaluate(() => window.__REACT_GRAB__?.isActive())).toBe(false);
        expect(await reactGrab.isPromptModeActive()).toBe(false);
        await expect(page.locator("[data-react-grab-selection-label]")).toHaveCount(0);
        await page.waitForTimeout(TOOLBAR_NO_COPY_SETTLE_MS);
        await expect(page.locator("html")).toHaveAttribute("data-toolbar-copy-count", "0");
      }
      await expect(page.locator("[data-react-grab-context-menu]")).toHaveCount(0);
    });
  }
}

test("prompt mode keeps its Add context placeholder", async ({ reactGrab, page }) => {
  await reactGrab.enterPromptMode("[data-testid='todo-list'] h1");
  await expect(page.locator("textarea[data-react-grab-input]")).toHaveAttribute(
    "placeholder",
    "Add context",
  );
});

test("a custom toolbar action stays armed across copies", async ({ reactGrab, page }) => {
  await waitForToolbar(reactGrab);
  await page.evaluate(() => {
    window.__REACT_GRAB__?.registerPlugin({
      name: "repeat-copy",
      actions: [
        {
          id: "repeat-copy",
          label: "Repeat copy",
          onAction: (context) => {
            const previousRunCount = Number(
              document.documentElement.dataset.pluginActionRunCount ?? 0,
            );
            document.documentElement.dataset.pluginActionRunCount = String(previousRunCount + 1);
            context.copy?.();
          },
        },
      ],
    });
    window.__REACT_GRAB__?.setToolbarState({ defaultAction: "repeat-copy" });
  });
  await reactGrab.clickToolbarAction("repeat-copy");
  await reactGrab.hoverUntilSelected("[data-testid='todo-list'] h1");
  await reactGrab.clickElement("[data-testid='todo-list'] h1");
  await expect.poll(() => reactGrab.getLabelStatusText()).toBe("Copied");
  expect(await reactGrab.getToolbarActionPressed("repeat-copy")).toBe(true);
  await reactGrab.pressEscape();
  await reactGrab.hoverUntilTargetSelected("[data-testid='todo-list'] li:last-child span");
  await reactGrab.clickElement("[data-testid='todo-list'] li:last-child span");
  await expect(page.locator("html")).toHaveAttribute("data-plugin-action-run-count", "2");
  await expect.poll(() => reactGrab.getClipboardContent()).toContain("TodoItem");
});
