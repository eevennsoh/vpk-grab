import type { ImageDeliveryResult } from "../types.js";
import { downloadBlob } from "./download-blob.js";
import { getClipboardHtml } from "./get-clipboard-html.js";
import { getScreenshotFileName } from "./get-screenshot-file-name.js";
import { IS_DEMO } from "./runtime-mode.js";

const buildClipboardRepresentations = (
  blobPromise: Promise<Blob>,
  textContent: string | undefined,
): Record<string, Blob | Promise<Blob>> => {
  if (textContent === undefined) return { "image/png": blobPromise };
  return {
    "text/plain": new Blob([textContent], { type: "text/plain" }),
    "text/html": new Blob([getClipboardHtml(textContent)], { type: "text/html" }),
    "image/png": blobPromise,
  };
};

// Must be called synchronously from the user's gesture: the clipboard write
// is issued at once with the still-pending blob, so the gesture is not lost
// while the image renders. Insecure origins (no async clipboard) get a
// download instead, and the clipboard is left alone.
export const deliverPngBlob = async (
  blobPromise: Promise<Blob>,
  textContent?: string,
): Promise<ImageDeliveryResult> => {
  if (IS_DEMO) {
    await blobPromise;
    return "copied";
  }
  if (typeof ClipboardItem === "undefined" || !navigator.clipboard?.write) {
    downloadBlob(await blobPromise, getScreenshotFileName(new Date()));
    return "saved";
  }
  await navigator.clipboard.write([
    new ClipboardItem(buildClipboardRepresentations(blobPromise, textContent)),
  ]);
  return "copied";
};
