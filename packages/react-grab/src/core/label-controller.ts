import { FADE_COMPLETE_BUFFER_MS, FEEDBACK_DURATION_MS } from "../constants.js";
import { createElementBounds } from "../utils/create-element-bounds.js";
import { findNearestBoundsIndex } from "../utils/find-nearest-bounds-index.js";
import { generateId } from "../utils/generate-id.js";
import { isElementConnected } from "../utils/is-element-connected.js";
import type {
  OverlayBounds,
  PageRect,
  Position,
  PromptCopyTarget,
  SelectionLabelInstance,
  SelectionLabelInstancePatch,
} from "../types.js";

interface LabelStoreBridge {
  clearLabelInstances: () => void;
  addLabelInstance: (instance: SelectionLabelInstance) => void;
  updateLabelInstance: (
    instanceId: string,
    status: SelectionLabelInstance["status"],
    errorMessage?: string,
  ) => void;
  patchLabelInstance: (instanceId: string, patch: SelectionLabelInstancePatch) => void;
  removeLabelInstance: (instanceId: string) => void;
}

interface CreateLabelInstanceOptions {
  element?: Element;
  mouseX?: number;
  elements?: Element[];
  boundsMultiple?: OverlayBounds[];
  hideArrow?: boolean;
  statusText?: string;
  selectionPageRect?: PageRect;
  promptTarget?: PromptCopyTarget;
}

interface PerElementLabelEntry {
  element: Element;
  tagName: string;
  componentName?: string;
  mouseX?: number;
}

interface PerElementPromptOptions {
  target: PromptCopyTarget;
  pointer: Position;
}

interface BuildLabelInstanceOptions {
  bounds: OverlayBounds;
  tagName: string;
  componentName: string | undefined;
  status: SelectionLabelInstance["status"];
  element?: Element;
  mouseX?: number;
  elements?: Element[];
  boundsMultiple?: OverlayBounds[];
  hideArrow?: boolean;
  statusText?: string;
  selectionPageRect?: PageRect;
  promptTarget?: PromptCopyTarget;
}

interface LabelController {
  createInstance: (
    bounds: OverlayBounds,
    tagName: string,
    componentName: string | undefined,
    status: SelectionLabelInstance["status"],
    options?: CreateLabelInstanceOptions,
  ) => string;
  createPerElementInstances: (
    entries: PerElementLabelEntry[],
    status: SelectionLabelInstance["status"],
    prompt?: PerElementPromptOptions,
  ) => string[];
  updateAfterCopy: (instanceId: string, didSucceed: boolean, errorMessage?: string) => void;
  markRetrying: (instanceId: string) => void;
  startPromptCopy: (instanceId: string, copiedStatusText: string) => void;
  setCopiedContent: (instanceId: string, copiedContent: string) => void;
  setImage: (
    instanceId: string,
    statusText: string,
    imageBlob: Blob,
    shouldKeepPrompt?: boolean,
  ) => void;
  startScreenshotCapture: (instanceId: string) => AbortSignal;
  failScreenshotCapture: (instanceId: string, errorMessage: string) => void;
  cancelScreenshotCapture: (instanceId: string) => void;
  cancelScreenshotCaptures: () => void;
  dismissInstance: (instanceId: string) => void;
  dismissCompleted: () => void;
  dismissCompletedIfAnchorDetached: () => void;
  cancelAllFades: () => void;
  clearAll: () => void;
}

const buildLabelInstance = (options: BuildLabelInstanceOptions): SelectionLabelInstance => {
  const boundsCenterX = options.bounds.x + options.bounds.width / 2;
  const boundsHalfWidth = options.bounds.width / 2;
  const mouseXOffset = options.mouseX !== undefined ? options.mouseX - boundsCenterX : undefined;
  return {
    id: generateId("label"),
    bounds: options.bounds,
    boundsMultiple: options.boundsMultiple,
    tagName: options.tagName,
    componentName: options.componentName,
    status: options.status,
    createdAt: Date.now(),
    element: options.element,
    elements: options.elements,
    mouseX: options.mouseX,
    mouseXOffsetFromCenter: mouseXOffset,
    mouseXOffsetRatio:
      mouseXOffset !== undefined && boundsHalfWidth > 0
        ? mouseXOffset / boundsHalfWidth
        : undefined,
    hideArrow: options.hideArrow,
    statusText: options.statusText,
    selectionPageRect: options.selectionPageRect,
    promptTarget: options.promptTarget,
  };
};

export const createLabelController = (
  store: LabelStoreBridge,
  getLabelInstances: () => readonly SelectionLabelInstance[],
  onClearAll?: () => void,
  areLabelsShown: () => boolean = () => true,
): LabelController => {
  const fadeTimeouts = new Map<string, number>();
  const screenshotCaptureControllers = new Map<string, AbortController>();
  const copiedStatusTextById = new Map<string, string>();

  const abortScreenshotCapture = (instanceId: string) => {
    screenshotCaptureControllers.get(instanceId)?.abort();
    screenshotCaptureControllers.delete(instanceId);
  };

  const cancelFade = (instanceId: string) => {
    const existingTimeout = fadeTimeouts.get(instanceId);
    if (existingTimeout !== undefined) {
      window.clearTimeout(existingTimeout);
      fadeTimeouts.delete(instanceId);
    }
  };

  const cancelAllFades = () => {
    for (const timeoutId of fadeTimeouts.values()) {
      window.clearTimeout(timeoutId);
    }
    fadeTimeouts.clear();
  };

  const findInstance = (instanceId: string) =>
    getLabelInstances().find((labelInstance) => labelInstance.id === instanceId);

  const revokeThumbnail = (instance: SelectionLabelInstance | undefined) => {
    if (instance?.thumbnailUrl) URL.revokeObjectURL(instance.thumbnailUrl);
  };

  const removeInstance = (instanceId: string) => {
    abortScreenshotCapture(instanceId);
    copiedStatusTextById.delete(instanceId);
    revokeThumbnail(findInstance(instanceId));
    store.removeLabelInstance(instanceId);
  };

  const clearAll = () => {
    cancelAllFades();
    for (const instance of getLabelInstances()) {
      abortScreenshotCapture(instance.id);
      revokeThumbnail(instance);
    }
    copiedStatusTextById.clear();
    store.clearLabelInstances();
    onClearAll?.();
  };

  const fadeOut = (instanceId: string) => {
    cancelFade(instanceId);
    abortScreenshotCapture(instanceId);
    store.updateLabelInstance(instanceId, "fading");
    const removalTimeoutId = window.setTimeout(() => {
      fadeTimeouts.delete(instanceId);
      removeInstance(instanceId);
    }, FADE_COMPLETE_BUFFER_MS);
    fadeTimeouts.set(instanceId, removalTimeoutId);
  };

  const scheduleFadeOut = (instanceId: string) => {
    cancelFade(instanceId);
    fadeTimeouts.set(
      instanceId,
      window.setTimeout(() => fadeOut(instanceId), FEEDBACK_DURATION_MS),
    );
  };

  const createInstance = (
    bounds: OverlayBounds,
    tagName: string,
    componentName: string | undefined,
    status: SelectionLabelInstance["status"],
    options?: CreateLabelInstanceOptions,
  ): string => {
    clearAll();
    const instance = buildLabelInstance({
      bounds,
      tagName,
      componentName,
      status,
      element: options?.element,
      mouseX: options?.mouseX,
      elements: options?.elements,
      boundsMultiple: options?.boundsMultiple,
      hideArrow: options?.hideArrow,
      statusText: options?.statusText,
      selectionPageRect: options?.selectionPageRect,
      promptTarget: options?.promptTarget,
    });
    store.addLabelInstance(instance);
    return instance.id;
  };

  const createPerElementInstances = (
    entries: PerElementLabelEntry[],
    status: SelectionLabelInstance["status"],
    prompt?: PerElementPromptOptions,
  ): string[] => {
    clearAll();
    const boundsList = entries.map((entry) => createElementBounds(entry.element));
    const promptEntryIndex = prompt ? findNearestBoundsIndex(boundsList, prompt.pointer) : -1;
    return entries.map((entry, entryIndex) => {
      const instance = buildLabelInstance({
        bounds: boundsList[entryIndex],
        tagName: entry.tagName,
        componentName: entry.componentName,
        status,
        element: entry.element,
        mouseX: entry.mouseX,
        promptTarget: entryIndex === promptEntryIndex ? prompt?.target : undefined,
      });
      store.addLabelInstance(instance);
      return instance.id;
    });
  };

  const updateAfterCopy = (instanceId: string, didSucceed: boolean, errorMessage?: string) => {
    cancelFade(instanceId);
    if (didSucceed) {
      const copiedStatusText = copiedStatusTextById.get(instanceId);
      if (copiedStatusText !== undefined) {
        copiedStatusTextById.delete(instanceId);
        store.patchLabelInstance(instanceId, { statusText: copiedStatusText });
      }
      store.updateLabelInstance(instanceId, "copied");
      if (!areLabelsShown()) scheduleFadeOut(instanceId);
    } else {
      store.updateLabelInstance(instanceId, "error", errorMessage || "Unknown error");
    }
  };

  const markRetrying = (instanceId: string) => {
    cancelFade(instanceId);
    store.updateLabelInstance(instanceId, "copying");
  };

  // The status text waits for the copy to land: until then the pill shows the
  // in-progress view, which would read that text in place of its own.
  const startPromptCopy = (instanceId: string, copiedStatusText: string) => {
    copiedStatusTextById.set(instanceId, copiedStatusText);
    store.patchLabelInstance(instanceId, { promptTarget: undefined });
    markRetrying(instanceId);
  };

  const setCopiedContent = (instanceId: string, copiedContent: string) => {
    store.patchLabelInstance(instanceId, { copiedContent });
  };

  const setImage = (
    instanceId: string,
    statusText: string,
    imageBlob: Blob,
    shouldKeepPrompt = false,
  ) => {
    const instance = findInstance(instanceId);
    if (!instance) return;
    screenshotCaptureControllers.delete(instanceId);
    revokeThumbnail(instance);
    store.patchLabelInstance(instanceId, {
      statusText,
      thumbnailUrl: URL.createObjectURL(imageBlob),
      isCapturingScreenshot: undefined,
      screenshotErrorMessage: undefined,
      promptTarget: shouldKeepPrompt ? instance.promptTarget : undefined,
    });
  };

  // A new capture follows a new copy, which the old image is no longer part
  // of, so its thumbnail goes now rather than sitting beside a later failure.
  const startScreenshotCapture = (instanceId: string): AbortSignal => {
    abortScreenshotCapture(instanceId);
    revokeThumbnail(findInstance(instanceId));
    const captureController = new AbortController();
    screenshotCaptureControllers.set(instanceId, captureController);
    store.patchLabelInstance(instanceId, {
      isCapturingScreenshot: true,
      screenshotErrorMessage: undefined,
      thumbnailUrl: undefined,
    });
    return captureController.signal;
  };

  const failScreenshotCapture = (instanceId: string, errorMessage: string) => {
    screenshotCaptureControllers.delete(instanceId);
    store.patchLabelInstance(instanceId, {
      isCapturingScreenshot: undefined,
      screenshotErrorMessage: errorMessage,
    });
  };

  const cancelScreenshotCapture = (instanceId: string) => {
    if (!screenshotCaptureControllers.has(instanceId)) return;
    abortScreenshotCapture(instanceId);
    store.patchLabelInstance(instanceId, { isCapturingScreenshot: undefined });
  };

  const cancelScreenshotCaptures = () => {
    for (const instanceId of [...screenshotCaptureControllers.keys()]) {
      cancelScreenshotCapture(instanceId);
    }
  };

  const dismissInstance = (instanceId: string) => {
    cancelFade(instanceId);
    removeInstance(instanceId);
  };

  const dismissCompleted = () => {
    const completedInstanceIds = getLabelInstances()
      .filter((labelInstance) => labelInstance.status === "copied")
      .map((labelInstance) => labelInstance.id);
    for (const instanceId of completedInstanceIds) fadeOut(instanceId);
  };

  const dismissCompletedIfAnchorDetached = () => {
    const hasDetachedAnchor = getLabelInstances().some(
      (labelInstance) =>
        labelInstance.status === "copied" &&
        labelInstance.element !== undefined &&
        !isElementConnected(labelInstance.element),
    );
    if (hasDetachedAnchor) dismissCompleted();
  };

  return {
    createInstance,
    createPerElementInstances,
    updateAfterCopy,
    markRetrying,
    startPromptCopy,
    setCopiedContent,
    setImage,
    startScreenshotCapture,
    failScreenshotCapture,
    cancelScreenshotCapture,
    cancelScreenshotCaptures,
    dismissInstance,
    dismissCompleted,
    dismissCompletedIfAnchorDetached,
    cancelAllFades,
    clearAll,
  };
};
