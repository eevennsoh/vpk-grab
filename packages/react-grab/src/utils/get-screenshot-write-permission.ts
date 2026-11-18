import { CLIPBOARD_WRITE_PERMISSION_NAME, WEB_REACT_GRAB_MIME_TYPE } from "../constants.js";
import { IS_DEMO } from "./runtime-mode.js";

export const getScreenshotWritePermission = async (): Promise<PermissionStatus | undefined> => {
  if (
    IS_DEMO ||
    typeof ClipboardItem === "undefined" ||
    !ClipboardItem.supports?.(WEB_REACT_GRAB_MIME_TYPE)
  ) {
    return;
  }
  let recognizesUnsanitizedWrites = false;
  const descriptor = {
    name: CLIPBOARD_WRITE_PERMISSION_NAME,
    allowWithoutGesture: true,
    // Web IDL ignores unknown fields. A generic write grant cannot authorize a custom format.
    get allowWithoutSanitization() {
      recognizesUnsanitizedWrites = true;
      return true;
    },
  };
  try {
    const permission = await navigator.permissions?.query(descriptor);
    if (recognizesUnsanitizedWrites) return permission;
  } catch {}
};
