import { ANNOTATION_TEXT_LINE_HEIGHT_PX } from "../constants.js";
import type { AnnotationText } from "../types.js";
import { getAnnotationTextLines } from "./get-annotation-text-lines.js";
import { measureAnnotationTextWidth } from "./measure-annotation-text-width.js";

export const getAnnotationTextCenterOrigin = (
  annotationText: AnnotationText,
  offsetX: number,
): string => {
  const baseWidth = measureAnnotationTextWidth(annotationText);
  const baseHeight = getAnnotationTextLines(annotationText).length * ANNOTATION_TEXT_LINE_HEIGHT_PX;
  return `${offsetX + baseWidth / 2}px ${baseHeight / 2}px`;
};
