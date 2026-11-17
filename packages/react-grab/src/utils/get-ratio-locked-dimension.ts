import { formatCssNumber } from "./format-css-number.js";

interface RatioLockedDimensionOptions {
  previousEditedSizePx: number;
  previousPairedSizePx: number;
  nextEditedSizePx: number;
  currentPairedSizePx: number;
  currentPairedCssSizePx: number;
  pairedBorderBoxSizePx: number;
}

export const getRatioLockedDimension = (options: RatioLockedDimensionOptions): string | null => {
  if (
    options.previousEditedSizePx <= 0 ||
    options.previousPairedSizePx <= 0 ||
    options.nextEditedSizePx <= 0 ||
    options.currentPairedSizePx <= 0 ||
    options.pairedBorderBoxSizePx <= 0
  )
    return null;
  const pairedScale = options.currentPairedSizePx / options.pairedBorderBoxSizePx;
  const desiredBoxSizePx =
    (options.nextEditedSizePx * options.previousPairedSizePx) / options.previousEditedSizePx;
  const desiredCssSizePx =
    options.currentPairedCssSizePx + (desiredBoxSizePx - options.currentPairedSizePx) / pairedScale;
  return Number.isFinite(desiredCssSizePx) && desiredCssSizePx > 0
    ? formatCssNumber(`${desiredCssSizePx}px`)
    : null;
};
