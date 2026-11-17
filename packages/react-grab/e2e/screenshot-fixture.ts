// Headless clipboards cannot be read back as images, so the page's
// navigator.clipboard.write is replaced with a recorder and each PNG is
// decoded in the page.
import type { Page } from "@playwright/test";

interface RecordedImageWrite {
  types: string[];
  width: number;
  height: number;
  plainText: string | null;
  html: string | null;
}

interface ScreenshotRecorder {
  imageWrites: RecordedImageWrite[];
  imageBlobs: Blob[];
  writeCallCount: number;
  copyEventCount: number;
  unhandledRejections: string[];
  revokedObjectUrls: string[];
  openGate: () => void;
}

interface ScreenshotRecorderWindow extends Window {
  __screenshotRecorder?: ScreenshotRecorder;
  __openImageEncodingGate?: () => void;
}

interface ImageEncodingOptions {
  isGated?: boolean;
  shouldFail?: boolean;
}

interface ClipboardRecorderOptions {
  isGated?: boolean;
  shouldReject?: boolean;
}

interface ImageRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface RgbColor {
  red: number;
  green: number;
  blue: number;
}

interface ColorMatchBounds {
  pixelCount: number;
  matchCount: number;
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export const installClipboardRecorder = (page: Page, options: ClipboardRecorderOptions = {}) =>
  page.evaluate(async ({ isGated, shouldReject }) => {
    await navigator.clipboard.writeText("");
    const recorderWindow: ScreenshotRecorderWindow = window;
    let openGate = () => {};
    const gate = isGated
      ? new Promise<void>((resolve) => {
          openGate = resolve;
        })
      : Promise.resolve();
    const recorder: ScreenshotRecorder = {
      imageWrites: [],
      imageBlobs: [],
      writeCallCount: 0,
      copyEventCount: 0,
      unhandledRejections: [],
      revokedObjectUrls: [],
      openGate: () => openGate(),
    };
    recorderWindow.__screenshotRecorder = recorder;
    const originalRevokeObjectURL = URL.revokeObjectURL.bind(URL);
    URL.revokeObjectURL = (objectUrl) => {
      recorder.revokedObjectUrls.push(objectUrl);
      originalRevokeObjectURL(objectUrl);
    };
    document.addEventListener(
      "copy",
      () => {
        recorder.copyEventCount += 1;
      },
      { capture: true },
    );
    window.addEventListener("unhandledrejection", (event) => {
      recorder.unhandledRejections.push(String(event.reason));
    });
    navigator.clipboard.write = async (items: ClipboardItem[]) => {
      recorder.writeCallCount += 1;
      if (shouldReject) throw new DOMException("Write permission denied.", "NotAllowedError");
      await gate;
      for (const item of items) {
        const readText = async (type: string) =>
          item.types.includes(type) ? (await item.getType(type)).text() : null;
        const blob = await item.getType("image/png");
        const bitmap = await createImageBitmap(blob);
        recorder.imageBlobs.push(blob);
        recorder.imageWrites.push({
          types: [...item.types],
          width: bitmap.width,
          height: bitmap.height,
          plainText: await readText("text/plain"),
          html: await readText("text/html"),
        });
      }
    };
  }, options);

// Holds back (or fails) the PNG encoding at the end of a capture, so a test
// can act while the image is still rendering.
export const controlImageEncoding = (page: Page, options: ImageEncodingOptions) =>
  page.evaluate(({ isGated, shouldFail }) => {
    const recorderWindow: ScreenshotRecorderWindow = window;
    const originalToBlob = HTMLCanvasElement.prototype.toBlob;
    const pendingEncodings: Array<() => void> = [];
    let isGateOpen = !isGated;
    recorderWindow.__openImageEncodingGate = () => {
      isGateOpen = true;
      for (const runEncoding of pendingEncodings.splice(0)) runEncoding();
    };
    HTMLCanvasElement.prototype.toBlob = function (callback, type, quality) {
      const runEncoding = () => {
        if (shouldFail) callback(null);
        else originalToBlob.call(this, callback, type, quality);
      };
      if (isGateOpen) runEncoding();
      else pendingEncodings.push(runEncoding);
    };
  }, options);

export const openImageEncodingGate = (page: Page) =>
  page.evaluate(() => {
    const recorderWindow: ScreenshotRecorderWindow = window;
    recorderWindow.__openImageEncodingGate?.();
  });

export const openClipboardGate = (page: Page) =>
  page.evaluate(() => {
    const recorderWindow: ScreenshotRecorderWindow = window;
    recorderWindow.__screenshotRecorder?.openGate();
  });

export const getImageWrites = (page: Page) =>
  page.evaluate(() => {
    const recorderWindow: ScreenshotRecorderWindow = window;
    return recorderWindow.__screenshotRecorder?.imageWrites ?? [];
  });

export const getClipboardWriteCallCount = (page: Page) =>
  page.evaluate(() => {
    const recorderWindow: ScreenshotRecorderWindow = window;
    return recorderWindow.__screenshotRecorder?.writeCallCount ?? 0;
  });

export const getCopyEventCount = (page: Page) =>
  page.evaluate(() => {
    const recorderWindow: ScreenshotRecorderWindow = window;
    return recorderWindow.__screenshotRecorder?.copyEventCount ?? 0;
  });

export const getUnhandledRejections = (page: Page) =>
  page.evaluate(() => {
    const recorderWindow: ScreenshotRecorderWindow = window;
    return recorderWindow.__screenshotRecorder?.unhandledRejections ?? [];
  });

export const getRevokedObjectUrls = (page: Page) =>
  page.evaluate(() => {
    const recorderWindow: ScreenshotRecorderWindow = window;
    return recorderWindow.__screenshotRecorder?.revokedObjectUrls ?? [];
  });

// Coordinates are CSS pixels from the captured rectangle's top-left corner;
// captureWidth converts them to image pixels.
export const sampleLastImagePixel = (
  page: Page,
  cssX: number,
  cssY: number,
  captureWidth: number,
): Promise<RgbColor | null> =>
  page.evaluate(
    async ({ x, y, width }) => {
      const recorderWindow: ScreenshotRecorderWindow = window;
      const blobs = recorderWindow.__screenshotRecorder?.imageBlobs ?? [];
      const blob = blobs[blobs.length - 1];
      if (!blob) return null;
      const bitmap = await createImageBitmap(blob);
      const scale = bitmap.width / width;
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const context = canvas.getContext("2d");
      if (!context) return null;
      context.drawImage(bitmap, 0, 0);
      const [red, green, blue] = context.getImageData(
        Math.floor(x * scale),
        Math.floor(y * scale),
        1,
        1,
      ).data;
      return { red, green, blue };
    },
    { x: cssX, y: cssY, width: captureWidth },
  );

// Bounds, in CSS pixels from the captured rectangle's corner, of the pixels
// inside region whose colour is within tolerance of color on every channel.
export const findColorInLastImage = (
  page: Page,
  region: ImageRegion,
  color: RgbColor,
  tolerance: number,
  captureWidth: number,
): Promise<ColorMatchBounds | null> =>
  page.evaluate(
    async ({ searchRegion, targetColor, channelTolerance, width }) => {
      const recorderWindow: ScreenshotRecorderWindow = window;
      const blobs = recorderWindow.__screenshotRecorder?.imageBlobs ?? [];
      const blob = blobs[blobs.length - 1];
      if (!blob) return null;
      const bitmap = await createImageBitmap(blob);
      const scale = bitmap.width / width;
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const context = canvas.getContext("2d");
      if (!context) return null;
      context.drawImage(bitmap, 0, 0);
      const regionLeft = Math.max(0, Math.floor(searchRegion.x * scale));
      const regionTop = Math.max(0, Math.floor(searchRegion.y * scale));
      const regionRight = Math.min(
        bitmap.width,
        Math.ceil((searchRegion.x + searchRegion.width) * scale),
      );
      const regionBottom = Math.min(
        bitmap.height,
        Math.ceil((searchRegion.y + searchRegion.height) * scale),
      );
      const pixels = context.getImageData(
        regionLeft,
        regionTop,
        regionRight - regionLeft,
        regionBottom - regionTop,
      );
      const bounds = {
        pixelCount: pixels.width * pixels.height,
        matchCount: 0,
        left: Number.POSITIVE_INFINITY,
        top: Number.POSITIVE_INFINITY,
        right: Number.NEGATIVE_INFINITY,
        bottom: Number.NEGATIVE_INFINITY,
      };
      for (let rowIndex = 0; rowIndex < pixels.height; rowIndex++) {
        for (let columnIndex = 0; columnIndex < pixels.width; columnIndex++) {
          const offset = (rowIndex * pixels.width + columnIndex) * 4;
          const isMatch =
            Math.abs(pixels.data[offset] - targetColor.red) <= channelTolerance &&
            Math.abs(pixels.data[offset + 1] - targetColor.green) <= channelTolerance &&
            Math.abs(pixels.data[offset + 2] - targetColor.blue) <= channelTolerance;
          if (!isMatch) continue;
          bounds.matchCount += 1;
          bounds.left = Math.min(bounds.left, (regionLeft + columnIndex) / scale);
          bounds.top = Math.min(bounds.top, (regionTop + rowIndex) / scale);
          bounds.right = Math.max(bounds.right, (regionLeft + columnIndex + 1) / scale);
          bounds.bottom = Math.max(bounds.bottom, (regionTop + rowIndex + 1) / scale);
        }
      }
      return bounds;
    },
    { searchRegion: region, targetColor: color, channelTolerance: tolerance, width: captureWidth },
  );
