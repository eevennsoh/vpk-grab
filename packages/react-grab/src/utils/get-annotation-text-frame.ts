import { ANNOTATION_TEXT_LINE_HEIGHT_PX } from "../constants.js";
import type { AnnotationFrame, AnnotationText } from "../types.js";
import { getAnnotationTextLines } from "./get-annotation-text-lines.js";

// A note's x and y are the start of its first line's middle; it scales and
// turns about the centre of its unscaled box, which therefore stays put.
export const getAnnotationTextFrame = (
  annotationText: AnnotationText,
  baseWidth: number,
): AnnotationFrame => {
  const baseHeight = getAnnotationTextLines(annotationText).length * ANNOTATION_TEXT_LINE_HEIGHT_PX;
  return {
    centerX: annotationText.x + baseWidth / 2,
    centerY: annotationText.y - ANNOTATION_TEXT_LINE_HEIGHT_PX / 2 + baseHeight / 2,
    width: baseWidth * annotationText.scale,
    height: baseHeight * annotationText.scale,
    rotation: annotationText.rotation,
  };
};
