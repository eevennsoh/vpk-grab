import { writeClipboardContent, type CopyContentOptions } from "./write-clipboard-content.js";

export const copyContent = (content: string, options?: CopyContentOptions): boolean =>
  writeClipboardContent(content, options).didCopy;
