import { test, expect } from "./fixtures.js";

test.describe("Toolbar Menu", () => {
  test("the default Copy action has no menu trigger", async ({ reactGrab }) => {
    await reactGrab.page.evaluate(() => window.__REACT_GRAB__?.unregisterPlugin("custom-default"));
    await expect.poll(() => reactGrab.isToolbarVisible()).toBe(true);
    await reactGrab.rightClickToolbarToggle();
    await expect(reactGrab.page.locator("[data-react-grab-toolbar-menu]")).toHaveCount(0);
  });

  test.beforeEach(async ({ reactGrab }) => {
    await reactGrab.page.evaluate(() =>
      window.__REACT_GRAB__?.registerPlugin({
        name: "custom-default",
        actions: [
          {
            id: "custom-default",
            label: "Custom copy",
            showInToolbarMenu: true,
            onAction: (context) => context.copy?.(),
          },
        ],
      }),
    );
  });

  test.describe("Open and Close", () => {
    test("right-clicking select button should open the menu", async ({ reactGrab }) => {
      await expect.poll(() => reactGrab.isToolbarVisible(), { timeout: 2000 }).toBe(true);

      await reactGrab.rightClickToolbarToggle();

      await expect.poll(() => reactGrab.isToolbarMenuVisible(), { timeout: 2000 }).toBe(true);
    });

    test("pressing Escape should close the menu", async ({ reactGrab }) => {
      await expect.poll(() => reactGrab.isToolbarVisible(), { timeout: 2000 }).toBe(true);

      await reactGrab.rightClickToolbarToggle();
      await expect.poll(() => reactGrab.isToolbarMenuVisible(), { timeout: 2000 }).toBe(true);

      await reactGrab.pressEscape();

      await expect.poll(() => reactGrab.isToolbarMenuVisible(), { timeout: 2000 }).toBe(false);
    });
  });

  test.describe("Menu Items", () => {
    test("menu should display registered actions", async ({ reactGrab }) => {
      await expect.poll(() => reactGrab.isToolbarVisible(), { timeout: 2000 }).toBe(true);

      await reactGrab.rightClickToolbarToggle();

      await expect.poll(() => reactGrab.isToolbarMenuVisible(), { timeout: 2000 }).toBe(true);

      const actionIds = await reactGrab.page
        .locator("[data-react-grab-toolbar-menu] [data-react-grab-menu-item]")
        .evaluateAll((elements) =>
          elements.map((element) => element.getAttribute("data-react-grab-menu-item")),
        );
      expect(actionIds).toEqual(["copy", "custom-default"]);
    });

    test("clicking a menu item should close the menu", async ({ reactGrab }) => {
      await expect.poll(() => reactGrab.isToolbarVisible(), { timeout: 2000 }).toBe(true);

      await reactGrab.rightClickToolbarToggle();
      await expect.poll(() => reactGrab.isToolbarMenuVisible(), { timeout: 2000 }).toBe(true);

      const labels = await reactGrab.getToolbarMenuItemLabels();
      expect(labels.length).toBeGreaterThan(0);

      await reactGrab.clickToolbarMenuItem("custom-default");

      await expect.poll(() => reactGrab.isToolbarMenuVisible(), { timeout: 2000 }).toBe(false);
    });

    for (const removedAction of ["comment", "open"]) {
      test(`normalizes ${removedAction} persisted as the default`, async ({ reactGrab }) => {
        await reactGrab.page.evaluate((defaultAction) => {
          localStorage.setItem(
            "react-grab-toolbar-state",
            JSON.stringify({
              edge: "bottom",
              ratio: 0.5,
              collapsed: false,
              enabled: true,
              defaultAction,
            }),
          );
        }, removedAction);
        await reactGrab.page.reload();

        await expect
          .poll(() =>
            reactGrab.page.evaluate(() => window.__REACT_GRAB__?.getToolbarState()?.defaultAction),
          )
          .toBe("copy");
      });
    }

    test("preserves the default action when toolbar state changes", async ({ reactGrab }) => {
      await reactGrab.page.evaluate(() => {
        window.__REACT_GRAB__?.setToolbarState({ defaultAction: "custom-default" });
      });

      await reactGrab.clickToolbarCollapse();

      const defaultActions = () =>
        reactGrab.page.evaluate(() => {
          const persistedState = JSON.parse(
            localStorage.getItem("react-grab-toolbar-state") ?? "null",
          );
          return {
            api: window.__REACT_GRAB__?.getToolbarState()?.defaultAction,
            persisted: persistedState?.defaultAction,
          };
        });
      await expect
        .poll(defaultActions)
        .toEqual({ api: "custom-default", persisted: "custom-default" });
    });

    test("normalizes the removed Style action persisted as the default", async ({ reactGrab }) => {
      await reactGrab.page.evaluate(() => {
        localStorage.setItem(
          "react-grab-toolbar-state",
          JSON.stringify({
            edge: "bottom",
            ratio: 0.5,
            collapsed: false,
            enabled: true,
            defaultAction: "edit",
          }),
        );
      });
      await reactGrab.page.reload();

      const defaultAction = () =>
        reactGrab.page.evaluate(() => {
          const apiDefaultAction = window.__REACT_GRAB__?.getToolbarState()?.defaultAction;
          const persistedState = JSON.parse(
            localStorage.getItem("react-grab-toolbar-state") ?? "null",
          );
          return { apiDefaultAction, persistedDefaultAction: persistedState?.defaultAction };
        });
      await expect.poll(defaultAction).toEqual({
        apiDefaultAction: "copy",
        persistedDefaultAction: "copy",
      });
    });

    test("Enter chooses a plugin default in the open menu", async ({ reactGrab, page }) => {
      await expect.poll(() => reactGrab.isToolbarVisible()).toBe(true);
      await reactGrab.rightClickToolbarToggle();
      const pluginOption = page.locator(
        '[data-react-grab-toolbar-menu] [data-react-grab-menu-item="custom-default"]',
      );
      await pluginOption.focus();
      await page.keyboard.press("Enter");
      await expect
        .poll(() => page.evaluate(() => window.__REACT_GRAB__?.getToolbarState()?.defaultAction))
        .toBe("custom-default");
      await expect(page.locator("[data-react-grab-toolbar-menu]")).toHaveCount(0);
      expect(await reactGrab.isPromptModeActive()).toBe(false);
    });

    test("preserves a custom default until its plugin registers", async ({ reactGrab }) => {
      await reactGrab.page.evaluate(() => {
        localStorage.setItem(
          "react-grab-toolbar-state",
          JSON.stringify({
            edge: "bottom",
            ratio: 0.5,
            collapsed: false,
            enabled: true,
            defaultAction: "custom-action",
          }),
        );
      });
      await reactGrab.page.reload();

      await expect
        .poll(() =>
          reactGrab.page.evaluate(() => window.__REACT_GRAB__?.getToolbarState()?.defaultAction),
        )
        .toBe("custom-action");

      await expect(
        reactGrab.page.locator('[data-react-grab-toolbar-action="custom-action"]'),
      ).toBeVisible();
      await reactGrab.clickToolbarAction("custom-action");
      await reactGrab.hoverUntilSelected("li:first-child span");
      await reactGrab.clickElement("li:first-child span");
      await expect.poll(() => reactGrab.getClipboardContent()).toContain("TodoItem");
      await expect
        .poll(() =>
          reactGrab.page.evaluate(() => window.__REACT_GRAB__?.getToolbarState()?.defaultAction),
        )
        .toBe("custom-action");

      await reactGrab.page.evaluate(() => {
        window.__REACT_GRAB__?.registerPlugin({
          name: "custom-action",
          actions: [
            {
              id: "custom-action",
              label: "Custom",
              showInToolbarMenu: true,
              onAction: () => {},
            },
          ],
        });
      });
      await expect(
        reactGrab.page.locator('[data-react-grab-toolbar-action="custom-action"]'),
      ).toHaveAttribute("aria-label", "Custom element");
    });
  });
});
