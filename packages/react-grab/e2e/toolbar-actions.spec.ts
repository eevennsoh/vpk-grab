import { test, expect, type ReactGrabPageObject } from "./fixtures.js";

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

    test("represents the selected default action with the single button", async ({ reactGrab }) => {
      await waitForToolbar(reactGrab);
      await reactGrab.page.evaluate(() => {
        window.__REACT_GRAB__?.setToolbarState({ defaultAction: "comment" });
      });

      await expect
        .poll(() => reactGrab.getToolbarActionPressed("comment"), { timeout: 2000 })
        .toBe(false);
      await expect(
        reactGrab.page.locator('[data-react-grab-toolbar-action="comment"]'),
      ).toHaveAttribute("aria-label", "Comment element");

      await reactGrab.clickToolbarAction("comment");

      expect(await reactGrab.getToolbarActionPressed("comment")).toBe(true);
      await reactGrab.hoverUntilSelected(BUTTON_SELECTOR);
      await reactGrab.clickElement(BUTTON_SELECTOR);
      await expect.poll(() => reactGrab.isPromptModeActive(), { timeout: 2000 }).toBe(true);
    });
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

    test("switches from API activation to the selected Comment default", async ({ reactGrab }) => {
      await waitForToolbar(reactGrab);
      await reactGrab.page.evaluate(() => {
        window.__REACT_GRAB__?.setToolbarState({ defaultAction: "comment" });
      });
      await reactGrab.activate();

      expect(await reactGrab.getToolbarActionPressed("comment")).toBe(false);
      await reactGrab.clickToolbarAction("comment");
      expect(await reactGrab.getToolbarActionPressed("comment")).toBe(true);

      await reactGrab.hoverUntilSelected(BUTTON_SELECTOR);
      await reactGrab.clickElement(BUTTON_SELECTOR);
      await expect.poll(() => reactGrab.isPromptModeActive(), { timeout: 2000 }).toBe(true);
    });

    test("updates the armed action when the default changes", async ({ reactGrab }) => {
      await waitForToolbar(reactGrab);
      await reactGrab.clickToolbarAction("copy");
      await reactGrab.rightClickToolbarToggle();
      await reactGrab.clickToolbarMenuItem("comment");

      expect(await reactGrab.getToolbarActionPressed("comment")).toBe(true);
      await reactGrab.hoverUntilSelected(BUTTON_SELECTOR);
      await reactGrab.clickElement(BUTTON_SELECTOR);
      await expect.poll(() => reactGrab.isPromptModeActive(), { timeout: 2000 }).toBe(true);
    });

    test("Escape resets the Copy button to unpressed", async ({ reactGrab }) => {
      await waitForToolbar(reactGrab);
      await reactGrab.clickToolbarAction("copy");
      expect(await reactGrab.getToolbarActionPressed("copy")).toBe(true);

      await reactGrab.deactivate();

      expect(await reactGrab.getToolbarActionPressed("copy")).toBe(false);
    });

    test("bare Enter leaves the Copy button unpressed", async ({ reactGrab }) => {
      await waitForToolbar(reactGrab);
      await reactGrab.activate();
      await reactGrab.hoverUntilSelected(BUTTON_SELECTOR);
      await reactGrab.pressEnter();

      await expect.poll(() => reactGrab.isPromptModeActive(), { timeout: 2000 }).toBe(true);
      expect(await reactGrab.getToolbarActionPressed("copy")).toBe(false);
    });
  });
});

for (const selectionRoute of ["click", "marquee", "prompt"]) {
  for (const fallbackReason of ["unknown", "disabled"]) {
    test(`Copy fallback for ${fallbackReason} action via ${selectionRoute}`, async ({
      reactGrab,
      page,
    }) => {
      await waitForToolbar(reactGrab);
      await page.evaluate((reason) => {
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
        await reactGrab.clickToolbarAction("fallback-action");
      } else {
        await reactGrab.clickToolbarAction("fallback-action");
        await reactGrab.hoverUntilSelected("[data-testid='todo-list'] h1");
        if (selectionRoute === "marquee") {
          await reactGrab.dragSelect(
            "[data-testid='todo-list'] h1",
            "[data-testid='todo-list'] li:last-child",
          );
        } else {
          await reactGrab.clickElement("[data-testid='todo-list'] h1");
        }
      }
      await expect
        .poll(() => reactGrab.getClipboardContent())
        .toContain(selectionRoute === "marquee" ? "TodoList" : "Todo List");
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
  await reactGrab.hoverUntilTargetSelected("[data-testid='todo-list'] li:last-child span");
  await reactGrab.clickElement("[data-testid='todo-list'] li:last-child span");
  await expect(page.locator("html")).toHaveAttribute("data-plugin-action-run-count", "2");
  await expect.poll(() => reactGrab.getClipboardContent()).toContain("TodoItem");
});
