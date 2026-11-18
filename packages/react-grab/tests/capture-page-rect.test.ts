import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { snapdom, type CaptureResult } from "@zumer/snapdom";
import { canvasToPngBlob } from "../src/utils/canvas-to-png-blob.js";
import { capturePageRect } from "../src/utils/capture-page-rect.js";

vi.mock("@zumer/snapdom", () => ({ snapdom: vi.fn() }));
vi.mock("../src/utils/canvas-to-png-blob.js", () => ({ canvasToPngBlob: vi.fn() }));
vi.mock("../src/utils/draw-annotations.js", () => ({ drawAnnotations: vi.fn() }));
vi.mock("../src/utils/get-page-canvas-color.js", () => ({ getPageCanvasColor: () => "#ffffff" }));

interface Deferred<Value> {
  promise: Promise<Value>;
  resolve: (value: Value) => void;
}

const createDeferred = <Value>(): Deferred<Value> => {
  let resolveDeferred: (value: Value) => void = () => {};
  const promise = new Promise<Value>((resolve) => {
    resolveDeferred = resolve;
  });
  return { promise, resolve: resolveDeferred };
};

const PAGE_RECT = { pageX: 0, pageY: 0, width: 40, height: 20 };
const ANNOTATIONS = { strokes: [], texts: [] };

const createCaptureResult = (toCanvas: () => Promise<unknown>): CaptureResult =>
  ({ toCanvas }) as unknown as CaptureResult;

const createElement = vi.fn(() => ({
  getContext: () => ({ fillRect: vi.fn(), drawImage: vi.fn(), fillStyle: "" }),
}));

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal("window", { devicePixelRatio: 1 });
  vi.stubGlobal("document", { documentElement: {}, createElement });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("capturePageRect", () => {
  it("starts no render once its capture is cancelled", async () => {
    const captureController = new AbortController();
    captureController.abort();

    await expect(
      capturePageRect(PAGE_RECT, ANNOTATIONS, captureController.signal),
    ).rejects.toThrow();

    expect(snapdom).not.toHaveBeenCalled();
  });

  it("does not rasterize a page clone whose capture was cancelled meanwhile", async () => {
    const captureController = new AbortController();
    const pageClone = createDeferred<CaptureResult>();
    const toCanvas = vi.fn(async () => ({}));
    vi.mocked(snapdom).mockReturnValue(pageClone.promise);

    const pendingCapture = capturePageRect(PAGE_RECT, ANNOTATIONS, captureController.signal);
    captureController.abort();
    pageClone.resolve(createCaptureResult(toCanvas));

    await expect(pendingCapture).rejects.toThrow();
    expect(toCanvas).not.toHaveBeenCalled();
    expect(canvasToPngBlob).not.toHaveBeenCalled();
  });

  it("does not encode a raster whose capture was cancelled meanwhile", async () => {
    const captureController = new AbortController();
    const pageRaster = createDeferred<unknown>();
    vi.mocked(snapdom).mockResolvedValue(createCaptureResult(() => pageRaster.promise));

    const pendingCapture = capturePageRect(PAGE_RECT, ANNOTATIONS, captureController.signal);
    await vi.waitFor(() => expect(snapdom).toHaveBeenCalledTimes(1));
    captureController.abort();
    pageRaster.resolve({});

    await expect(pendingCapture).rejects.toThrow();
    expect(createElement).not.toHaveBeenCalled();
    expect(canvasToPngBlob).not.toHaveBeenCalled();
  });

  it("encodes the image of a capture left to finish", async () => {
    const imageBlob = new Blob(["png"], { type: "image/png" });
    vi.mocked(snapdom).mockResolvedValue(createCaptureResult(async () => ({})));
    vi.mocked(canvasToPngBlob).mockResolvedValue(imageBlob);

    await expect(
      capturePageRect(PAGE_RECT, ANNOTATIONS, new AbortController().signal),
    ).resolves.toBe(imageBlob);
    expect(canvasToPngBlob).toHaveBeenCalledTimes(1);
  });
});
