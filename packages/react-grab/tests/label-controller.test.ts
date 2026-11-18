import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { FADE_COMPLETE_BUFFER_MS, FEEDBACK_DURATION_MS } from "../src/constants.js";
import { createLabelController } from "../src/core/label-controller.js";
import type {
  OverlayBounds,
  SelectionLabelInstance,
  SelectionLabelInstancePatch,
} from "../src/types.js";

interface ElementWithBounds extends Element {
  testBounds: OverlayBounds;
}

vi.mock("../src/utils/create-element-bounds.js", () => ({
  createElementBounds: (element: ElementWithBounds) => element.testBounds,
}));

const LABEL_BOUNDS = {
  borderRadius: "0px",
  height: 20,
  width: 40,
  x: 10,
  y: 10,
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("window", {
    clearTimeout: globalThis.clearTimeout,
    setTimeout: globalThis.setTimeout,
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const createAnchorElement = (isConnected: boolean): Element =>
  ({ isConnected }) as unknown as Element;

const createLabelStore = (labelInstances: SelectionLabelInstance[]) => ({
  clearLabelInstances: () => {
    labelInstances.length = 0;
  },
  addLabelInstance: (instance: SelectionLabelInstance) => {
    labelInstances.push(instance);
  },
  updateLabelInstance: (
    instanceId: string,
    status: SelectionLabelInstance["status"],
    errorMessage?: string,
  ) => {
    const instance = labelInstances.find((labelInstance) => labelInstance.id === instanceId);
    if (!instance) return;
    instance.status = status;
    instance.errorMessage = errorMessage;
  },
  patchLabelInstance: (instanceId: string, patch: SelectionLabelInstancePatch) => {
    const instance = labelInstances.find((labelInstance) => labelInstance.id === instanceId);
    if (!instance) return;
    Object.assign(instance, patch);
  },
  removeLabelInstance: (instanceId: string) => {
    const instanceIndex = labelInstances.findIndex(
      (labelInstance) => labelInstance.id === instanceId,
    );
    if (instanceIndex >= 0) labelInstances.splice(instanceIndex, 1);
  },
});

describe("createLabelController", () => {
  it("keeps a copied label on screen until it is dismissed", () => {
    const labelInstances: SelectionLabelInstance[] = [];
    const controller = createLabelController(
      createLabelStore(labelInstances),
      () => labelInstances,
    );
    const instanceId = controller.createInstance(LABEL_BOUNDS, "button", undefined, "copying");

    controller.updateAfterCopy(instanceId, true);
    vi.advanceTimersByTime(FEEDBACK_DURATION_MS * 4);
    expect(labelInstances[0]?.status).toBe("copied");

    controller.dismissCompleted();
    expect(labelInstances[0]?.status).toBe("fading");
    vi.advanceTimersByTime(FADE_COMPLETE_BUFFER_MS);
    expect(labelInstances).toHaveLength(0);
  });

  it("dismisses every label of one copy together", () => {
    const labelInstances: SelectionLabelInstance[] = [];
    const controller = createLabelController(
      createLabelStore(labelInstances),
      () => labelInstances,
    );
    const firstInstanceId = controller.createInstance(LABEL_BOUNDS, "li", undefined, "copying");
    labelInstances.push({ ...labelInstances[0], id: "label-sibling" });
    for (const instanceId of [firstInstanceId, "label-sibling"]) {
      controller.updateAfterCopy(instanceId, true);
    }

    controller.dismissCompleted();
    expect(labelInstances.map((labelInstance) => labelInstance.status)).toEqual([
      "fading",
      "fading",
    ]);
    vi.advanceTimersByTime(FADE_COMPLETE_BUFFER_MS);
    expect(labelInstances).toHaveLength(0);
  });

  it("leaves in-progress and error labels alone when dismissing", () => {
    const labelInstances: SelectionLabelInstance[] = [];
    const controller = createLabelController(
      createLabelStore(labelInstances),
      () => labelInstances,
    );
    const copyingInstanceId = controller.createInstance(LABEL_BOUNDS, "a", undefined, "copying");
    controller.dismissCompleted();
    vi.advanceTimersByTime(FADE_COMPLETE_BUFFER_MS);
    expect(labelInstances[0]?.id).toBe(copyingInstanceId);
    expect(labelInstances[0]?.status).toBe("copying");

    controller.updateAfterCopy(copyingInstanceId, false, "Failed to copy");
    controller.dismissCompleted();
    vi.advanceTimersByTime(FADE_COMPLETE_BUFFER_MS);
    expect(labelInstances[0]?.status).toBe("error");
  });

  it("replaces the previous copy's labels when a new copy starts", () => {
    const labelInstances: SelectionLabelInstance[] = [];
    const controller = createLabelController(
      createLabelStore(labelInstances),
      () => labelInstances,
    );
    const firstInstanceId = controller.createInstance(LABEL_BOUNDS, "a", undefined, "copying");
    controller.updateAfterCopy(firstInstanceId, true);

    const secondInstanceId = controller.createInstance(LABEL_BOUNDS, "b", undefined, "copying");
    expect(labelInstances.map((labelInstance) => labelInstance.id)).toEqual([secondInstanceId]);
  });

  it("keeps the copied text on the label and drops it with the label", () => {
    const labelInstances: SelectionLabelInstance[] = [];
    const controller = createLabelController(
      createLabelStore(labelInstances),
      () => labelInstances,
    );
    const instanceId = controller.createInstance(LABEL_BOUNDS, "a", undefined, "copying");
    controller.setCopiedContent(instanceId, "[button]");
    controller.updateAfterCopy(instanceId, true);
    expect(labelInstances[0]?.copiedContent).toBe("[button]");

    controller.startScreenshotCapture(instanceId);
    expect(labelInstances[0]?.isCapturingScreenshot).toBe(true);
    controller.failScreenshotCapture(instanceId, "Couldn't copy image");
    expect(labelInstances[0]?.isCapturingScreenshot).toBeUndefined();
    expect(labelInstances[0]?.screenshotErrorMessage).toBe("Couldn't copy image");
    expect(labelInstances[0]?.status).toBe("copied");

    controller.dismissCompleted();
    vi.advanceTimersByTime(FADE_COMPLETE_BUFFER_MS);
    expect(labelInstances).toHaveLength(0);
  });

  it("cancels a label's screenshot capture silently when a newer copy supersedes it", () => {
    const labelInstances: SelectionLabelInstance[] = [];
    const controller = createLabelController(
      createLabelStore(labelInstances),
      () => labelInstances,
    );
    const instanceId = controller.createInstance(LABEL_BOUNDS, "a", undefined, "copying");
    controller.updateAfterCopy(instanceId, true);
    const captureSignal = controller.startScreenshotCapture(instanceId);
    expect(captureSignal.aborted).toBe(false);

    controller.cancelScreenshotCaptures();

    expect(captureSignal.aborted).toBe(true);
    expect(labelInstances[0]?.isCapturingScreenshot).toBeUndefined();
    expect(labelInstances[0]?.screenshotErrorMessage).toBeUndefined();
    expect(labelInstances[0]?.status).toBe("copied");
  });

  it("cancels one label's screenshot capture and leaves the others running", () => {
    const labelInstances: SelectionLabelInstance[] = [];
    const controller = createLabelController(
      createLabelStore(labelInstances),
      () => labelInstances,
    );
    const elements = [createElementAt(0, 40), createElementAt(100, 40)];
    const [firstInstanceId, secondInstanceId] = controller.createPerElementInstances(
      elements.map((element) => ({ element, tagName: "li" })),
      "copying",
    );
    controller.updateAfterCopy(firstInstanceId, true);
    controller.updateAfterCopy(secondInstanceId, true);
    const firstCaptureSignal = controller.startScreenshotCapture(firstInstanceId);
    const secondCaptureSignal = controller.startScreenshotCapture(secondInstanceId);

    controller.cancelScreenshotCapture(firstInstanceId);

    expect(firstCaptureSignal.aborted).toBe(true);
    expect(labelInstances[0]?.isCapturingScreenshot).toBeUndefined();
    expect(secondCaptureSignal.aborted).toBe(false);
    expect(labelInstances[1]?.isCapturingScreenshot).toBe(true);
  });

  it("cancels a label's screenshot capture when the label is dismissed or replaced", () => {
    const labelInstances: SelectionLabelInstance[] = [];
    const controller = createLabelController(
      createLabelStore(labelInstances),
      () => labelInstances,
    );
    const firstInstanceId = controller.createInstance(LABEL_BOUNDS, "a", undefined, "copying");
    controller.updateAfterCopy(firstInstanceId, true);
    const dismissedCaptureSignal = controller.startScreenshotCapture(firstInstanceId);
    controller.dismissCompleted();
    expect(dismissedCaptureSignal.aborted).toBe(true);

    const secondInstanceId = controller.createInstance(LABEL_BOUNDS, "b", undefined, "copying");
    controller.updateAfterCopy(secondInstanceId, true);
    const replacedCaptureSignal = controller.startScreenshotCapture(secondInstanceId);
    controller.createInstance(LABEL_BOUNDS, "c", undefined, "copying");
    expect(replacedCaptureSignal.aborted).toBe(true);
  });

  it("leaves a finished screenshot capture alone when later copies cancel captures", () => {
    const labelInstances: SelectionLabelInstance[] = [];
    const controller = createLabelController(
      createLabelStore(labelInstances),
      () => labelInstances,
    );
    const instanceId = controller.createInstance(LABEL_BOUNDS, "a", undefined, "copying");
    controller.updateAfterCopy(instanceId, true);
    const captureSignal = controller.startScreenshotCapture(instanceId);
    controller.failScreenshotCapture(instanceId, "Couldn't capture image");

    controller.cancelScreenshotCaptures();

    expect(captureSignal.aborted).toBe(false);
    expect(labelInstances[0]?.screenshotErrorMessage).toBe("Couldn't capture image");
  });

  it("revokes an image label's thumbnail when the label goes away", () => {
    let createdUrlCount = 0;
    const createObjectURL = vi.fn(() => {
      createdUrlCount += 1;
      return `blob:${createdUrlCount}`;
    });
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });
    const imageBlob = new Blob();
    const labelInstances: SelectionLabelInstance[] = [];
    const controller = createLabelController(
      createLabelStore(labelInstances),
      () => labelInstances,
    );
    const instanceId = controller.createInstance(LABEL_BOUNDS, "", undefined, "copying", {
      statusText: "Capturing…",
    });
    expect(labelInstances[0]?.statusText).toBe("Capturing…");

    controller.setImage(instanceId, "Image copied", imageBlob);
    controller.setImage(instanceId, "Image copied", imageBlob);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:1");
    expect(labelInstances[0]?.thumbnailUrl).toBe("blob:2");

    controller.updateAfterCopy(instanceId, true);
    controller.dismissCompleted();
    vi.advanceTimersByTime(FADE_COMPLETE_BUFFER_MS);
    expect(labelInstances).toHaveLength(0);
    expect(revokeObjectURL).toHaveBeenLastCalledWith("blob:2");

    const clearedInstanceId = controller.createInstance(LABEL_BOUNDS, "", undefined, "copying");
    controller.setImage(clearedInstanceId, "Image saved", imageBlob);
    controller.clearAll();
    expect(revokeObjectURL).toHaveBeenLastCalledWith("blob:3");
  });

  it("creates no thumbnail URL for a label that is already gone", () => {
    const createObjectURL = vi.fn(() => "blob:orphan");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });
    const labelInstances: SelectionLabelInstance[] = [];
    const controller = createLabelController(
      createLabelStore(labelInstances),
      () => labelInstances,
    );
    const instanceId = controller.createInstance(LABEL_BOUNDS, "", undefined, "copying");
    controller.clearAll();

    controller.setImage(instanceId, "Image copied", new Blob());

    expect(createObjectURL).not.toHaveBeenCalled();
    expect(labelInstances).toHaveLength(0);
  });

  it("fades a copied label on the old timer when labels are not shown", () => {
    const labelInstances: SelectionLabelInstance[] = [];
    const controller = createLabelController(
      createLabelStore(labelInstances),
      () => labelInstances,
      undefined,
      () => false,
    );
    const instanceId = controller.createInstance(LABEL_BOUNDS, "a", undefined, "copying");

    controller.updateAfterCopy(instanceId, true);
    vi.advanceTimersByTime(FEEDBACK_DURATION_MS - 1);
    expect(labelInstances[0]?.status).toBe("copied");
    vi.advanceTimersByTime(1);
    expect(labelInstances[0]?.status).toBe("fading");
    vi.advanceTimersByTime(FADE_COMPLETE_BUFFER_MS);
    expect(labelInstances).toHaveLength(0);
  });

  it("keeps a hidden error label until it is acknowledged", () => {
    const labelInstances: SelectionLabelInstance[] = [];
    const controller = createLabelController(
      createLabelStore(labelInstances),
      () => labelInstances,
      undefined,
      () => false,
    );
    const instanceId = controller.createInstance(LABEL_BOUNDS, "a", undefined, "copying");

    controller.updateAfterCopy(instanceId, false, "Failed to copy");
    vi.advanceTimersByTime(FEEDBACK_DURATION_MS * 4);
    expect(labelInstances[0]?.status).toBe("error");
  });

  it("cleans up completed labels when visibility dismisses them, leaving unfinished labels alone", () => {
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", {
      createObjectURL: () => "blob:hidden-thumbnail",
      revokeObjectURL,
    });
    const labelInstances: SelectionLabelInstance[] = [];
    let areLabelsShown = true;
    const controller = createLabelController(
      createLabelStore(labelInstances),
      () => labelInstances,
      undefined,
      () => areLabelsShown,
    );
    const instanceId = controller.createInstance(LABEL_BOUNDS, "button", undefined, "copying");
    controller.setImage(instanceId, "Copied with image", new Blob());
    controller.updateAfterCopy(instanceId, true);
    labelInstances.push(
      { ...labelInstances[0], id: "pending-camera", thumbnailUrl: undefined },
      { ...labelInstances[0], id: "unfinished-copy", thumbnailUrl: undefined, status: "copying" },
      { ...labelInstances[0], id: "failed-copy", thumbnailUrl: undefined, status: "error" },
    );
    const captureSignal = controller.startScreenshotCapture("pending-camera");

    areLabelsShown = false;
    controller.dismissCompleted();

    expect(captureSignal.aborted).toBe(true);
    vi.advanceTimersByTime(FADE_COMPLETE_BUFFER_MS);
    expect(revokeObjectURL).toHaveBeenCalledExactlyOnceWith("blob:hidden-thumbnail");
    expect(labelInstances.map((instance) => instance.id)).toEqual([
      "unfinished-copy",
      "failed-copy",
    ]);
  });

  it("keeps timed removal for a hidden success after labels become visible again", () => {
    const labelInstances: SelectionLabelInstance[] = [];
    let areLabelsShown = false;
    const controller = createLabelController(
      createLabelStore(labelInstances),
      () => labelInstances,
      undefined,
      () => areLabelsShown,
    );
    const instanceId = controller.createInstance(LABEL_BOUNDS, "button", undefined, "copying");
    controller.updateAfterCopy(instanceId, true);
    areLabelsShown = true;

    vi.advanceTimersByTime(FEEDBACK_DURATION_MS + FADE_COMPLETE_BUFFER_MS);
    expect(labelInstances).toHaveLength(0);
  });

  it("dismisses every copied label once one anchor has left the document", () => {
    const labelInstances: SelectionLabelInstance[] = [];
    const controller = createLabelController(
      createLabelStore(labelInstances),
      () => labelInstances,
    );
    const firstInstanceId = controller.createInstance(LABEL_BOUNDS, "li", undefined, "copying", {
      element: createAnchorElement(true),
    });
    labelInstances.push({
      ...labelInstances[0],
      id: "label-sibling",
      element: createAnchorElement(true),
    });
    for (const instanceId of [firstInstanceId, "label-sibling"]) {
      controller.updateAfterCopy(instanceId, true);
    }

    controller.dismissCompletedIfAnchorDetached();
    expect(labelInstances.map((labelInstance) => labelInstance.status)).toEqual([
      "copied",
      "copied",
    ]);

    labelInstances[1].element = createAnchorElement(false);
    controller.dismissCompletedIfAnchorDetached();
    expect(labelInstances.map((labelInstance) => labelInstance.status)).toEqual([
      "fading",
      "fading",
    ]);
    vi.advanceTimersByTime(FADE_COMPLETE_BUFFER_MS);
    expect(labelInstances).toHaveLength(0);
  });

  it("leaves an in-progress label alone when its anchor has left the document", () => {
    const labelInstances: SelectionLabelInstance[] = [];
    const controller = createLabelController(
      createLabelStore(labelInstances),
      () => labelInstances,
    );
    controller.createInstance(LABEL_BOUNDS, "a", undefined, "copying", {
      element: createAnchorElement(false),
    });

    controller.dismissCompletedIfAnchorDetached();
    vi.advanceTimersByTime(FADE_COMPLETE_BUFFER_MS);
    expect(labelInstances[0]?.status).toBe("copying");
  });

  const createElementAt = (x: number, width: number): ElementWithBounds =>
    ({
      isConnected: true,
      testBounds: { borderRadius: "0px", height: 20, width, x, y: 10 },
    }) as unknown as ElementWithBounds;

  it("offers the prompt on the one per-element label the pointer is on or nearest to", () => {
    const labelInstances: SelectionLabelInstance[] = [];
    const controller = createLabelController(
      createLabelStore(labelInstances),
      () => labelInstances,
    );
    const elements = [createElementAt(0, 40), createElementAt(100, 40), createElementAt(200, 40)];
    const entries = elements.map((element) => ({ element, tagName: "li" }));
    const target = { primaryElement: elements[0], elements };

    controller.createPerElementInstances(entries, "copying", {
      target,
      pointer: { x: 120, y: 20 },
    });
    expect(labelInstances.map((instance) => instance.promptTarget)).toEqual([
      undefined,
      target,
      undefined,
    ]);

    controller.createPerElementInstances(entries, "copying", {
      target,
      pointer: { x: 260, y: 90 },
    });
    expect(labelInstances.map((instance) => Boolean(instance.promptTarget))).toEqual([
      false,
      false,
      true,
    ]);

    controller.createPerElementInstances(entries, "copying");
    expect(labelInstances.some((instance) => instance.promptTarget)).toBe(false);
  });

  it("reads a prompt copy's status text only once that copy lands, through a retry", () => {
    const labelInstances: SelectionLabelInstance[] = [];
    const controller = createLabelController(
      createLabelStore(labelInstances),
      () => labelInstances,
    );
    const element = createAnchorElement(true);
    const instanceId = controller.createInstance(LABEL_BOUNDS, "a", undefined, "copying", {
      element,
      promptTarget: { primaryElement: element, elements: [element] },
    });
    controller.updateAfterCopy(instanceId, true);

    controller.startPromptCopy(instanceId, "Copied with prompt");
    expect(labelInstances[0]).toMatchObject({ status: "copying", statusText: undefined });
    expect(labelInstances[0]?.promptTarget).toBeUndefined();

    controller.updateAfterCopy(instanceId, false, "Failed to copy");
    expect(labelInstances[0]).toMatchObject({ status: "error", statusText: undefined });

    controller.markRetrying(instanceId);
    controller.updateAfterCopy(instanceId, true);
    expect(labelInstances[0]).toMatchObject({
      status: "copied",
      statusText: "Copied with prompt",
    });
  });

  it("drops a pending prompt status text with its label", () => {
    const labelInstances: SelectionLabelInstance[] = [];
    const controller = createLabelController(
      createLabelStore(labelInstances),
      () => labelInstances,
    );
    const firstInstanceId = controller.createInstance(LABEL_BOUNDS, "a", undefined, "copied");
    controller.startPromptCopy(firstInstanceId, "Copied with prompt");
    controller.dismissInstance(firstInstanceId);

    const nextInstanceId = controller.createInstance(LABEL_BOUNDS, "b", undefined, "copying");
    controller.updateAfterCopy(nextInstanceId, true);
    expect(labelInstances[0]?.statusText).toBeUndefined();
  });

  it("takes the prompt away once the camera has copied an image", () => {
    vi.stubGlobal("URL", { createObjectURL: () => "blob:camera", revokeObjectURL: vi.fn() });
    const labelInstances: SelectionLabelInstance[] = [];
    const controller = createLabelController(
      createLabelStore(labelInstances),
      () => labelInstances,
    );
    const element = createAnchorElement(true);
    const instanceId = controller.createInstance(LABEL_BOUNDS, "a", undefined, "copied", {
      element,
      promptTarget: { primaryElement: element, elements: [element] },
    });

    controller.setImage(instanceId, "Copied with image", new Blob());

    expect(labelInstances[0]).toMatchObject({
      statusText: "Copied with image",
      thumbnailUrl: "blob:camera",
    });
    expect(labelInstances[0]?.promptTarget).toBeUndefined();
  });
});
