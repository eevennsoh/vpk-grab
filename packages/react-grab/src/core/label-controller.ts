import { FADE_COMPLETE_BUFFER_MS, FEEDBACK_DURATION_MS } from "../constants.js";
import { createElementBounds } from "../utils/create-element-bounds.js";
import { generateId } from "../utils/generate-id.js";
import type { OverlayBounds, SelectionLabelInstance } from "../types.js";

interface LabelStoreBridge {
  clearLabelInstances: () => void;
  addLabelInstance: (instance: SelectionLabelInstance) => void;
  updateLabelInstance: (
    instanceId: string,
    status: SelectionLabelInstance["status"],
    errorMessage?: string,
  ) => void;
  setLabelInstanceImage: (instanceId: string, statusText: string, thumbnailUrl: string) => void;
  removeLabelInstance: (instanceId: string) => void;
}

interface CreateLabelInstanceOptions {
  element?: Element;
  mouseX?: number;
  elements?: Element[];
  boundsMultiple?: OverlayBounds[];
  hideArrow?: boolean;
  statusText?: string;
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
  setImage: (instanceId: string, statusText: string, thumbnailUrl: string) => void;
  dismissInstance: (instanceId: string) => void;
  cancelAllFades: () => void;
  clearAll: () => void;
  handleHoverChange: (instanceId: string, isHovered: boolean) => void;
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
  };
};

export const createLabelController = (
  store: LabelStoreBridge,
  getLabelInstances: () => readonly SelectionLabelInstance[],
  onClearAll?: () => void,
): LabelController => {
  const fadeTimeouts = new Map<string, number>();

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
    revokeThumbnail(findInstance(instanceId));
    store.removeLabelInstance(instanceId);
  };

  const clearAll = () => {
    cancelAllFades();
    for (const instance of getLabelInstances()) revokeThumbnail(instance);
    store.clearLabelInstances();
    onClearAll?.();
  };

  const scheduleFade = (instanceId: string) => {
    cancelFade(instanceId);
    const fadeStartTimeoutId = window.setTimeout(() => {
      store.updateLabelInstance(instanceId, "fading");
      const removalTimeoutId = window.setTimeout(() => {
        fadeTimeouts.delete(instanceId);
        removeInstance(instanceId);
      }, FADE_COMPLETE_BUFFER_MS);
      fadeTimeouts.set(instanceId, removalTimeoutId);
    }, FEEDBACK_DURATION_MS);
    fadeTimeouts.set(instanceId, fadeStartTimeoutId);
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
    if (didSucceed) {
      store.updateLabelInstance(instanceId, "copied");
      scheduleFade(instanceId);
    } else {
      // Errors are actionable (Retry/Ok), so the label persists until it is
      // acknowledged or superseded by the next grab instead of auto-fading.
      cancelFade(instanceId);
      store.updateLabelInstance(instanceId, "error", errorMessage || "Unknown error");
    }
  };

  const markRetrying = (instanceId: string) => {
    cancelFade(instanceId);
    store.updateLabelInstance(instanceId, "copying");
  };

  const setImage = (instanceId: string, statusText: string, thumbnailUrl: string) => {
    revokeThumbnail(findInstance(instanceId));
    store.setLabelInstanceImage(instanceId, statusText, thumbnailUrl);
  };

  const dismissInstance = (instanceId: string) => {
    cancelFade(instanceId);
    removeInstance(instanceId);
  };

  const handleHoverChange = (instanceId: string, isHovered: boolean) => {
    const instance = findInstance(instanceId);
    if (!instance) return;

    if (isHovered) {
      cancelFade(instanceId);
      if (instance.status === "fading") {
        store.updateLabelInstance(instanceId, "copied");
      }
      return;
    }
    // Error labels are dismissed explicitly (Retry/Ok), so unhovering must not
    // start a fade; only the transient copied/fading labels fade on hover-out.
    if (instance.status === "copied" || instance.status === "fading") {
      scheduleFade(instanceId);
    }
  };

  return {
    createInstance,
    createPerElementInstances,
    updateAfterCopy,
    markRetrying,
    setImage,
    dismissInstance,
    cancelAllFades,
    clearAll,
    handleHoverChange,
  };
};
