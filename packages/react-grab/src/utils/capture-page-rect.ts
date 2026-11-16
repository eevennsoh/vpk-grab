import { snapdom } from "@zumer/snapdom";
import type { AnnotationSnapshotForCapture, PageRect } from "../types.js";
import { drawAnnotations } from "./draw-annotations.js";
import { getPageCanvasColor } from "./get-page-canvas-color.js";
import { getScreenshotSize } from "./get-screenshot-size.js";
import { isReactGrabHost } from "./is-react-grab-host.js";

const canvasToPngBlob = (canvas: HTMLCanvasElement): Promise<Blob> =>
  new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Couldn't encode image"));
    }, "image/png");
  });

export const capturePageRect = async (
  pageRect: PageRect,
  annotations: AnnotationSnapshotForCapture,
): Promise<Blob> => {
  const { scale, pixelWidth, pixelHeight } = getScreenshotSize(
    pageRect.width,
    pageRect.height,
    window.devicePixelRatio,
  );
  const capture = await snapdom(document.documentElement, {
    clip: { x: pageRect.pageX, y: pageRect.pageY, width: pageRect.width, height: pageRect.height },
    dpr: 1,
    scale,
    exclude: isReactGrabHost,
    excludeMode: "remove",
  });
  const pageCanvas = await capture.toCanvas();

  const outputCanvas = document.createElement("canvas");
  outputCanvas.width = pixelWidth;
  outputCanvas.height = pixelHeight;
  const context = outputCanvas.getContext("2d");
  if (!context) throw new Error("Couldn't capture image");
  context.fillStyle = getPageCanvasColor();
  context.fillRect(0, 0, pixelWidth, pixelHeight);
  context.drawImage(pageCanvas, 0, 0, pixelWidth, pixelHeight);
  drawAnnotations(
    context,
    annotations,
    {
      left: pageRect.pageX,
      top: pageRect.pageY,
      right: pageRect.pageX + pageRect.width,
      bottom: pageRect.pageY + pageRect.height,
    },
    pixelWidth / pageRect.width,
  );
  return canvasToPngBlob(outputCanvas);
};
