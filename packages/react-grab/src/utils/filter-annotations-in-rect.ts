import { ANNOTATION_STROKE_WIDTH_PX } from "../constants.js";
import type { AnnotationSnapshotForCapture, AnnotationText, Rect } from "../types.js";
import { getAnnotationStrokeFrame } from "./get-annotation-stroke-frame.js";
import { getAnnotationTextFrame } from "./get-annotation-text-frame.js";
import { getRotatedBounds } from "./get-rotated-bounds.js";
import { isRectOverlapping } from "./is-rect-overlapping.js";

export const filterAnnotationsInRect = (
  annotations: AnnotationSnapshotForCapture,
  pageRect: Rect,
  measureTextWidth: (annotationText: AnnotationText) => number,
): AnnotationSnapshotForCapture => ({
  strokes: annotations.strokes.filter(
    (stroke) =>
      stroke.points.length > 0 &&
      isRectOverlapping(
        getRotatedBounds(getAnnotationStrokeFrame(stroke), ANNOTATION_STROKE_WIDTH_PX),
        pageRect,
      ),
  ),
  texts: annotations.texts.filter((annotationText) =>
    isRectOverlapping(
      getRotatedBounds(getAnnotationTextFrame(annotationText, measureTextWidth(annotationText)), 0),
      pageRect,
    ),
  ),
});
