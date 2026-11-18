import {
  REACT_GRAB_MIME_TYPE,
  WEB_REACT_GRAB_MIME_TYPE,
  WEB_CUSTOM_FORMAT_SIZE_LIMIT_BYTES,
} from "../constants.js";
import type { ImageDeliveryResult } from "../types.js";
import { downloadBlob } from "./download-blob.js";
import { getClipboardHtml } from "./get-clipboard-html.js";
import { getScreenshotFileName } from "./get-screenshot-file-name.js";
import { IS_DEMO } from "./runtime-mode.js";

// Must be called synchronously from the user's gesture, or as soon as the
// copy that gesture made lands: the clipboard write is issued at once with the
// still-pending blob, so the gesture is not lost while the image renders. Insecure origins (no async clipboard) get a
// download instead, and the clipboard is left alone.
export const deliverPngBlob = async (
  blobPromise: Promise<Blob>,
  textContent?: string,
  copiedMetadata?: string,
  unsanitizedWritePermission?: PermissionState,
): Promise<ImageDeliveryResult> => {
  if (IS_DEMO) {
    await blobPromise;
    return "copied";
  }
  if (typeof ClipboardItem === "undefined" || !navigator.clipboard?.write) {
    downloadBlob(await blobPromise, getScreenshotFileName(new Date()));
    return "saved";
  }
  const textRepresentations: Record<string, Blob> =
    textContent === undefined
      ? {}
      : {
          "text/plain": new Blob([textContent], { type: "text/plain" }),
          "text/html": new Blob([getClipboardHtml(textContent)], { type: "text/html" }),
        };
  // Chromium can prompt for a custom format even inside a click. Use only an existing grant.
  if (
    unsanitizedWritePermission === "granted" &&
    textContent !== undefined &&
    copiedMetadata !== undefined &&
    ClipboardItem.supports?.(WEB_REACT_GRAB_MIME_TYPE)
  ) {
    const metadataBlob = new Blob([copiedMetadata], { type: REACT_GRAB_MIME_TYPE });
    if (metadataBlob.size < WEB_CUSTOM_FORMAT_SIZE_LIMIT_BYTES) {
      textRepresentations[WEB_REACT_GRAB_MIME_TYPE] = metadataBlob;
    }
  }
  await navigator.clipboard.write([
    new ClipboardItem({ ...textRepresentations, "image/png": blobPromise }),
  ]);
  return "copied";
};
