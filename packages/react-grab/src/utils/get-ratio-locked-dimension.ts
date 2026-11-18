import { SPECS_RATIO_CHANGE_THRESHOLD_PX } from "../constants.js";
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
    Math.abs(options.nextEditedSizePx - options.previousEditedSizePx) <
      SPECS_RATIO_CHANGE_THRESHOLD_PX ||
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
  if (Math.abs(desiredBoxSizePx - options.currentPairedSizePx) <= SPECS_RATIO_CHANGE_THRESHOLD_PX)
    return null;
  const desiredCssSizePx =
    options.currentPairedCssSizePx + (desiredBoxSizePx - options.currentPairedSizePx) / pairedScale;
  return Number.isFinite(desiredCssSizePx) && desiredCssSizePx > 0
    ? formatCssNumber(`${desiredCssSizePx}px`)
    : null;
};
