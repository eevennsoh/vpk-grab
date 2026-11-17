import { FADE_COMPLETE_BUFFER_MS, FEEDBACK_DURATION_MS } from "../constants.js";
import { createElementBounds } from "../utils/create-element-bounds.js";
import { generateId } from "../utils/generate-id.js";
import { isElementConnected } from "../utils/is-element-connected.js";
import type {
  OverlayBounds,
  PageRect,
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
}

interface PerElementLabelEntry {
  element: Element;
  tagName: string;
  componentName?: string;
  mouseX?: number;
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
  ) => string[];
  updateAfterCopy: (instanceId: string, didSucceed: boolean, errorMessage?: string) => void;
  markRetrying: (instanceId: string) => void;
  setCopiedContent: (instanceId: string, copiedContent: string) => void;
  setImage: (instanceId: string, statusText: string, imageBlob: Blob) => void;
  startScreenshotCapture: (instanceId: string) => AbortSignal;
  failScreenshotCapture: (instanceId: string, errorMessage: string) => void;
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
    revokeThumbnail(findInstance(instanceId));
    store.removeLabelInstance(instanceId);
  };

  const clearAll = () => {
    cancelAllFades();
    for (const instance of getLabelInstances()) {
      abortScreenshotCapture(instance.id);
      revokeThumbnail(instance);
    }
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
    });
    store.addLabelInstance(instance);
    return instance.id;
  };

  const createPerElementInstances = (
    entries: PerElementLabelEntry[],
    status: SelectionLabelInstance["status"],
  ): string[] => {
    clearAll();
    const instanceIds: string[] = [];
    for (const entry of entries) {
      const instance = buildLabelInstance({
        bounds: createElementBounds(entry.element),
        tagName: entry.tagName,
        componentName: entry.componentName,
        status,
        element: entry.element,
        mouseX: entry.mouseX,
      });
      store.addLabelInstance(instance);
      instanceIds.push(instance.id);
    }
    return instanceIds;
  };

  const updateAfterCopy = (instanceId: string, didSucceed: boolean, errorMessage?: string) => {
    cancelFade(instanceId);
    if (didSucceed) {
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

  const setCopiedContent = (instanceId: string, copiedContent: string) => {
    store.patchLabelInstance(instanceId, { copiedContent });
  };

  const setImage = (instanceId: string, statusText: string, imageBlob: Blob) => {
    const instance = findInstance(instanceId);
    if (!instance) return;
    screenshotCaptureControllers.delete(instanceId);
    revokeThumbnail(instance);
    store.patchLabelInstance(instanceId, {
      statusText,
      thumbnailUrl: URL.createObjectURL(imageBlob),
      isCapturingScreenshot: undefined,
      screenshotErrorMessage: undefined,
    });
  };

  const startScreenshotCapture = (instanceId: string): AbortSignal => {
    abortScreenshotCapture(instanceId);
    const captureController = new AbortController();
    screenshotCaptureControllers.set(instanceId, captureController);
    store.patchLabelInstance(instanceId, {
      isCapturingScreenshot: true,
      screenshotErrorMessage: undefined,
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

  const cancelScreenshotCaptures = () => {
    for (const instanceId of [...screenshotCaptureControllers.keys()]) {
      abortScreenshotCapture(instanceId);
      store.patchLabelInstance(instanceId, { isCapturingScreenshot: undefined });
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
    setCopiedContent,
    setImage,
    startScreenshotCapture,
    failScreenshotCapture,
    cancelScreenshotCaptures,
    dismissInstance,
    dismissCompleted,
    dismissCompletedIfAnchorDetached,
    cancelAllFades,
    clearAll,
  };
};
