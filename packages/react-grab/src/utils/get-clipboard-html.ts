import { escapeHtmlText } from "./escape-html-text.js";

export const getClipboardHtml = (content: string): string =>
  `<meta charset='utf-8'><pre><code>${escapeHtmlText(content)}</code></pre>`;
