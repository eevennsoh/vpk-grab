import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { FADE_COMPLETE_BUFFER_MS, FEEDBACK_DURATION_MS } from "../src/constants.js";
import { createLabelController } from "../src/core/label-controller.js";
import type { SelectionLabelInstance } from "../src/types.js";

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
  setLabelInstanceImage: (instanceId: string, statusText: string, thumbnailUrl: string) => {
    const instance = labelInstances.find((labelInstance) => labelInstance.id === instanceId);
    if (!instance) return;
    instance.statusText = statusText;
    instance.thumbnailUrl = thumbnailUrl;
  },
  removeLabelInstance: (instanceId: string) => {
    const instanceIndex = labelInstances.findIndex(
      (labelInstance) => labelInstance.id === instanceId,
    );
    if (instanceIndex >= 0) labelInstances.splice(instanceIndex, 1);
  },
});

describe("createLabelController", () => {
  it("restores a fading copied label while it is hovered", () => {
    const labelInstances: SelectionLabelInstance[] = [];
    const controller = createLabelController(
      createLabelStore(labelInstances),
      () => labelInstances,
    );
    const instanceId = controller.createInstance(LABEL_BOUNDS, "button", undefined, "copying");

    controller.updateAfterCopy(instanceId, true);
    vi.advanceTimersByTime(FEEDBACK_DURATION_MS);
    expect(labelInstances[0]?.status).toBe("fading");

    controller.handleHoverChange(instanceId, true);
    expect(labelInstances[0]?.status).toBe("copied");

    vi.advanceTimersByTime(FADE_COMPLETE_BUFFER_MS);
    expect(labelInstances).toHaveLength(1);

    controller.handleHoverChange(instanceId, false);
    vi.advanceTimersByTime(FEEDBACK_DURATION_MS + FADE_COMPLETE_BUFFER_MS);
    expect(labelInstances).toHaveLength(0);
  });

  it("revokes an image label's thumbnail when the label goes away", () => {
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { revokeObjectURL });
    const labelInstances: SelectionLabelInstance[] = [];
    const controller = createLabelController(
      createLabelStore(labelInstances),
      () => labelInstances,
    );
    const instanceId = controller.createInstance(LABEL_BOUNDS, "", undefined, "copying", {
      statusText: "Capturing…",
    });
    expect(labelInstances[0]?.statusText).toBe("Capturing…");

    controller.setImage(instanceId, "Image copied", "blob:first");
    controller.setImage(instanceId, "Image copied", "blob:second");
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:first");

    controller.updateAfterCopy(instanceId, true);
    vi.advanceTimersByTime(FEEDBACK_DURATION_MS + FADE_COMPLETE_BUFFER_MS);
    expect(labelInstances).toHaveLength(0);
    expect(revokeObjectURL).toHaveBeenLastCalledWith("blob:second");

    const clearedInstanceId = controller.createInstance(LABEL_BOUNDS, "", undefined, "copying");
    controller.setImage(clearedInstanceId, "Image saved", "blob:third");
    controller.clearAll();
    expect(revokeObjectURL).toHaveBeenLastCalledWith("blob:third");
  });
});
