import { expect, test, type ReactGrabPageObject } from "./fixtures.js";
import { ATTRIBUTE_NAME } from "./constants.js";

const selectTodoListItem = async (reactGrab: ReactGrabPageObject, selector: string) => {
  await reactGrab.hoverUntilSelected(`${selector} span`);
  await reactGrab.page.keyboard.press("ArrowUp");
  await reactGrab.waitForSelectionBox();
};

test.describe("Keyboard Navigation", () => {
  test("should navigate to next element with ArrowDown", async ({ reactGrab }) => {
    await reactGrab.activate();
    await reactGrab.hoverUntilSelected("li:first-child");

    await reactGrab.page.keyboard.press("ArrowDown");
    await reactGrab.waitForSelectionBox();

    const isVisible = await reactGrab.isOverlayVisible();
    expect(isVisible).toBe(true);
  });

  test("should navigate to previous element with ArrowUp", async ({ reactGrab }) => {
    await reactGrab.activate();
    await reactGrab.hoverUntilSelected("li:nth-child(3)");

    await reactGrab.page.keyboard.press("ArrowUp");
    await reactGrab.waitForSelectionBox();

    const isVisible = await reactGrab.isOverlayVisible();
    expect(isVisible).toBe(true);
  });

  test("should navigate to a sibling with ArrowLeft", async ({ reactGrab }) => {
    await reactGrab.activate();
    await selectTodoListItem(reactGrab, "[data-testid='todo-list'] li:nth-child(2)");

    await reactGrab.page.keyboard.press("ArrowLeft");
    await reactGrab.waitForSelectionBox();

    // The previous sibling is another list item, not the parent or a child.
    const labelInfo = await reactGrab.getSelectionLabelInfo();
    expect(labelInfo.isVisible).toBe(true);
    expect(labelInfo.tagName).toBe("li");
  });

  test("should navigate to a sibling with ArrowRight", async ({ reactGrab }) => {
    await reactGrab.activate();
    await selectTodoListItem(reactGrab, "[data-testid='todo-list'] li:first-child");

    await reactGrab.page.keyboard.press("ArrowRight");
    await reactGrab.waitForSelectionBox();

    // The next sibling is another list item; ArrowRight no longer descends
    // into the item's inner content (which would report a "span").
    const labelInfo = await reactGrab.getSelectionLabelInfo();
    expect(labelInfo.isVisible).toBe(true);
    expect(labelInfo.tagName).toBe("li");
  });

  test("Tab should navigate to the next sibling like ArrowRight", async ({ reactGrab }) => {
    await reactGrab.activate();
    await selectTodoListItem(reactGrab, "[data-testid='todo-list'] li:first-child");

    await reactGrab.page.keyboard.press("Tab");
    await reactGrab.waitForSelectionBox();

    const labelInfo = await reactGrab.getSelectionLabelInfo();
    expect(labelInfo.isVisible).toBe(true);
    expect(labelInfo.tagName).toBe("li");
  });

  test("Shift+Tab should navigate to the previous sibling like ArrowLeft", async ({
    reactGrab,
  }) => {
    await reactGrab.activate();
    await selectTodoListItem(reactGrab, "[data-testid='todo-list'] li:nth-child(2)");

    await reactGrab.page.keyboard.press("Shift+Tab");
    await reactGrab.waitForSelectionBox();

    const labelInfo = await reactGrab.getSelectionLabelInfo();
    expect(labelInfo.isVisible).toBe(true);
    expect(labelInfo.tagName).toBe("li");
  });

  test("arrow keys reveal the hierarchy dropdown without Shift", async ({ reactGrab }) => {
    const isHierarchyMenuVisible = () =>
      reactGrab.page.evaluate(
        (attrName) =>
          Boolean(
            document
              .querySelector(`[${attrName}]`)
              ?.shadowRoot?.querySelector("[data-react-grab-hierarchy-menu]"),
          ),
        ATTRIBUTE_NAME,
      );

    await reactGrab.activate();
    await reactGrab.hoverUntilSelected("[data-testid='todo-list'] li:first-child");

    expect(await isHierarchyMenuVisible()).toBe(false);

    await reactGrab.page.keyboard.down("Shift");
    await reactGrab.page.waitForTimeout(200);
    expect(await isHierarchyMenuVisible()).toBe(false);
    await reactGrab.page.keyboard.up("Shift");

    await reactGrab.page.keyboard.press("ArrowDown");
    await expect.poll(isHierarchyMenuVisible, { timeout: 1000 }).toBe(true);
  });

  test("should maintain activation during keyboard navigation", async ({ reactGrab }) => {
    await reactGrab.activate();
    await reactGrab.hoverUntilSelected("li:first-child");

    await reactGrab.page.keyboard.press("ArrowDown");
    await reactGrab.page.keyboard.press("ArrowDown");
    await reactGrab.page.keyboard.press("ArrowUp");

    const isVisible = await reactGrab.isOverlayVisible();
    expect(isVisible).toBe(true);
  });

  test("arrow focus hands back to hover when the mouse moves, without a prompt", async ({
    reactGrab,
  }) => {
    await reactGrab.activate();
    await reactGrab.hoverUntilSelected("[data-testid='todo-list'] li:first-child");

    await reactGrab.page.keyboard.press("ArrowDown");
    await reactGrab.waitForSelectionBox();

    await reactGrab.hoverUntilSelected("[data-testid='todo-list'] h1");
    expect(await reactGrab.isPendingDismissVisible()).toBe(false);
    const labelInfo = await reactGrab.getSelectionLabelInfo();
    expect(labelInfo.isVisible).toBe(true);
    expect(labelInfo.tagName).toBe("h1");
  });

  test("arrow focus copies nothing on its own", async ({ reactGrab }) => {
    await reactGrab.page.evaluate(() => navigator.clipboard.writeText(""));
    await reactGrab.activate();
    await reactGrab.hoverUntilSelected("[data-testid='todo-list'] li:first-child");

    await reactGrab.page.keyboard.press("ArrowDown");
    await reactGrab.page.keyboard.press("ArrowUp");
    await reactGrab.waitForSelectionBox();
    await reactGrab.page.waitForTimeout(300);

    expect(await reactGrab.getClipboardContent()).toBe("");
    expect(await reactGrab.isPromptModeActive()).toBe(false);
  });

  test("Enter commits the arrow-focused element to its Enter action", async ({ reactGrab }) => {
    await reactGrab.registerCommentAction();
    await reactGrab.activate();
    await reactGrab.hoverUntilSelected("[data-testid='todo-list'] li:first-child");

    await reactGrab.page.keyboard.press("ArrowDown");
    await reactGrab.waitForSelectionBox();
    await reactGrab.pressEnter();

    await expect.poll(() => reactGrab.isPromptModeActive()).toBe(true);
  });

  test("should copy keyboard-selected element when clicking over previous mouse target", async ({
    reactGrab,
  }) => {
    await reactGrab.page.evaluate(() => navigator.clipboard.writeText(""));
    await reactGrab.activate();
    await reactGrab.hoverUntilSelected("[data-testid='todo-list'] h1");

    await reactGrab.page.keyboard.press("ArrowUp");
    await reactGrab.waitForSelectionBox();

    await reactGrab.page.mouse.down();
    await reactGrab.page.mouse.up();

    await expect.poll(() => reactGrab.getClipboardContent(), { timeout: 5000 }).toContain("[<div");
    expect(await reactGrab.getClipboardContent()).not.toContain("[<h1");
  });
});

test.describe("Navigation History and Wrapping", () => {
  interface ArrowUpBoundaryClickSelectionScenario {
    targetSelector: string;
    expectedClipboardContent: string;
    arrowUpPressCount: number;
  }

  const runArrowUpBoundaryClickSelectionScenario = async (
    reactGrab: ReactGrabPageObject,
    scenario: ArrowUpBoundaryClickSelectionScenario,
  ) => {
    await reactGrab.activate();
    await reactGrab.hoverUntilSelected("li:first-child");

    await reactGrab.page.evaluate(() => navigator.clipboard.writeText(""));

    for (let pressCount = 0; pressCount < scenario.arrowUpPressCount; pressCount++) {
      await reactGrab.pressArrowUp();
      await reactGrab.waitForSelectionBox();
    }

    await reactGrab.page.locator(scenario.targetSelector).hover({ force: true });
    await reactGrab.page.locator(scenario.targetSelector).click({ force: true });

    await expect
      .poll(() => reactGrab.getClipboardContent(), { timeout: 5000 })
      .toContain(scenario.expectedClipboardContent);
  };

  test("ArrowLeft should go back to previous element", async ({ reactGrab }) => {
    await reactGrab.activate();
    await reactGrab.hoverUntilSelected("li:first-child");

    await reactGrab.pressArrowDown();
    await reactGrab.pressArrowDown();

    await reactGrab.pressArrowLeft();
    await reactGrab.waitForSelectionBox();

    const isVisible = await reactGrab.isSelectionBoxVisible();
    expect(isVisible).toBe(true);
  });

  test("multiple ArrowDown should navigate through siblings", async ({ reactGrab }) => {
    await reactGrab.activate();
    await reactGrab.hoverUntilSelected("li:first-child");

    await reactGrab.pressArrowDown();
    await reactGrab.pressArrowDown();
    await reactGrab.pressArrowDown();
    await reactGrab.waitForSelectionBox();

    const isVisible = await reactGrab.isOverlayVisible();
    expect(isVisible).toBe(true);
  });

  test("ArrowUp at first sibling should stay on element", async ({ reactGrab }) => {
    await reactGrab.activate();
    await reactGrab.hoverUntilSelected("li:first-child");

    await reactGrab.pressArrowUp();
    await reactGrab.waitForSelectionBox();

    const isVisible = await reactGrab.isSelectionBoxVisible();
    expect(isVisible).toBe(true);
  });

  test("ArrowUp at first sibling should not lock later click selection", async ({ reactGrab }) => {
    await runArrowUpBoundaryClickSelectionScenario(reactGrab, {
      targetSelector: "[data-testid='nested-button']",
      expectedClipboardContent: "Nested Button",
      arrowUpPressCount: 1,
    });
  });

  test("repeated ArrowUp at first sibling should still allow click selection changes", async ({
    reactGrab,
  }) => {
    await runArrowUpBoundaryClickSelectionScenario(reactGrab, {
      targetSelector: "[data-testid='cancel-button']",
      expectedClipboardContent: "Cancel",
      arrowUpPressCount: 4,
    });
  });

  test("ArrowUp boundary should allow selecting form controls", async ({ reactGrab }) => {
    await runArrowUpBoundaryClickSelectionScenario(reactGrab, {
      targetSelector: "[data-testid='submit-button']",
      expectedClipboardContent: "Submit",
      arrowUpPressCount: 2,
    });
  });

  test("ArrowDown at last sibling should stay on element", async ({ reactGrab }) => {
    await reactGrab.activate();
    await reactGrab.hoverUntilSelected("li:last-child");

    await reactGrab.pressArrowDown();
    await reactGrab.waitForSelectionBox();

    const isVisible = await reactGrab.isSelectionBoxVisible();
    expect(isVisible).toBe(true);
  });

  test("navigation should work on deeply nested elements", async ({ reactGrab }) => {
    await reactGrab.activate();
    await reactGrab.hoverUntilSelected("[data-testid='deeply-nested-text']");

    await reactGrab.pressArrowLeft();
    await reactGrab.waitForSelectionBox();

    const isVisible = await reactGrab.isSelectionBoxVisible();
    expect(isVisible).toBe(true);
  });

  test("keyboard navigation should update selection label", async ({ reactGrab }) => {
    await reactGrab.activate();
    await reactGrab.hoverUntilSelected("li:first-child");

    const labelBefore = await reactGrab.getSelectionLabelInfo();

    await reactGrab.pressArrowLeft();
    await reactGrab.waitForSelectionBox();

    const labelAfter = await reactGrab.getSelectionLabelInfo();

    expect(labelBefore.isVisible).toBe(true);
    expect(labelAfter.isVisible).toBe(true);
  });
});

test.describe("ArrowUp Vertical Traversal", () => {
  test("ArrowUp should reach parent element from child", async ({ reactGrab }) => {
    await reactGrab.activate();
    await selectTodoListItem(reactGrab, "[data-testid='todo-list'] li:first-child");

    const initialLabel = await reactGrab.getSelectionLabelInfo();

    await reactGrab.pressArrowUp();
    await reactGrab.waitForSelectionBox();

    const afterUpLabel = await reactGrab.getSelectionLabelInfo();

    expect(initialLabel.tagName).toBe("li");
    expect(afterUpLabel.tagName).not.toBe("li");
    expect(afterUpLabel.isVisible).toBe(true);
  });

  test("repeated ArrowUp should not oscillate between elements", async ({ reactGrab }) => {
    await reactGrab.activate();
    await selectTodoListItem(reactGrab, "[data-testid='todo-list'] li:first-child");

    const visitedTags: string[] = [];
    for (let step = 0; step < 8; step++) {
      await reactGrab.pressArrowUp();
      await reactGrab.page.waitForTimeout(50);
      const labelInfo = await reactGrab.getSelectionLabelInfo();
      if (!labelInfo.isVisible) break;
      visitedTags.push(labelInfo.tagName ?? "unknown");
    }

    let oscillationCount = 0;
    for (let index = 2; index < visitedTags.length; index++) {
      const isRepeatingTwoStepPattern =
        visitedTags[index] === visitedTags[index - 2] &&
        visitedTags[index] !== visitedTags[index - 1];
      if (isRepeatingTwoStepPattern) {
        oscillationCount++;
      }
    }
    expect(oscillationCount).toBeLessThan(2);
  });

  test("ArrowUp bounds should never shrink", async ({ reactGrab }) => {
    await reactGrab.activate();
    await selectTodoListItem(reactGrab, "[data-testid='todo-list'] li:first-child");

    let previousBounds = await reactGrab.getSelectionBoxBounds();
    expect(previousBounds).not.toBeNull();
    let boundsShrunk = false;

    for (let step = 0; step < 5; step++) {
      await reactGrab.pressArrowUp();
      await reactGrab.page.waitForTimeout(50);
      const currentBounds = await reactGrab.getSelectionBoxBounds();
      if (!currentBounds) break;

      const previousArea = previousBounds!.width * previousBounds!.height;
      const currentArea = currentBounds.width * currentBounds.height;
      if (currentArea < previousArea - 1) {
        boundsShrunk = true;
        break;
      }
      previousBounds = currentBounds;
    }

    expect(boundsShrunk).toBe(false);
  });

  test("ArrowDown should reverse ArrowUp and maintain selection", async ({ reactGrab }) => {
    await reactGrab.activate();
    await selectTodoListItem(reactGrab, "[data-testid='todo-list'] li:first-child");

    await reactGrab.pressArrowUp();
    await reactGrab.waitForSelectionBox();
    await reactGrab.pressArrowUp();
    await reactGrab.waitForSelectionBox();

    const afterUpVisible = await reactGrab.isSelectionBoxVisible();
    expect(afterUpVisible).toBe(true);

    await reactGrab.pressArrowDown();
    await reactGrab.waitForSelectionBox();
    await reactGrab.pressArrowDown();
    await reactGrab.waitForSelectionBox();

    const afterDownVisible = await reactGrab.isSelectionBoxVisible();
    expect(afterDownVisible).toBe(true);

    const afterDownBounds = await reactGrab.getSelectionBoxBounds();
    expect(afterDownBounds).not.toBeNull();
    expect(afterDownBounds!.width).toBeGreaterThan(0);
    expect(afterDownBounds!.height).toBeGreaterThan(0);
  });
});
