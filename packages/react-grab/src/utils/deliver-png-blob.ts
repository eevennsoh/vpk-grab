import type { ImageDeliveryResult } from "../types.js";
import { getScreenshotFileName } from "./get-screenshot-file-name.js";
import { IS_DEMO } from "./runtime-mode.js";

const downloadBlob = (blob: Blob, fileName: string) => {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = fileName;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
};

// Must be called synchronously from the user's gesture: the clipboard write
// is issued at once with the still-pending blob, so the gesture is not lost
// while the image renders. Insecure origins (no async clipboard) get a
// download instead.
export const deliverPngBlob = async (blobPromise: Promise<Blob>): Promise<ImageDeliveryResult> => {
  if (IS_DEMO) {
    await blobPromise;
    return "copied";
  }
  if (typeof ClipboardItem === "undefined" || !navigator.clipboard?.write) {
    downloadBlob(await blobPromise, getScreenshotFileName(new Date()));
    return "saved";
  }
  await navigator.clipboard.write([new ClipboardItem({ "image/png": blobPromise })]);
  return "copied";
};
