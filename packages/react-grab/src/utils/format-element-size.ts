import { formatPixels } from "./format-pixels.js";

export const formatElementSize = (width: number, height: number): string =>
  `${formatPixels(width)} × ${formatPixels(height)}`;
