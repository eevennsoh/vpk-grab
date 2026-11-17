import { ANNOTATION_STROKE_WIDTH_PX, ANNOTATION_TEXT_LINE_HEIGHT_PX } from "../constants.js";
import type { AnnotationSnapshotForCapture, AnnotationText, Rect } from "../types.js";
import { getAnnotationStrokeBounds } from "./get-annotation-stroke-bounds.js";
import { isRectOverlapping } from "./is-rect-overlapping.js";

export const filterAnnotationsInRect = (
  annotations: AnnotationSnapshotForCapture,
  pageRect: Rect,
  measureTextWidth: (annotationText: AnnotationText) => number,
): AnnotationSnapshotForCapture => ({
  strokes: annotations.strokes.filter((stroke) => {
    const strokeBounds = getAnnotationStrokeBounds(stroke.points, ANNOTATION_STROKE_WIDTH_PX);
    return strokeBounds !== null && isRectOverlapping(strokeBounds, pageRect);
  }),
  texts: annotations.texts.filter((annotationText) =>
    isRectOverlapping(
      {
        left: annotationText.x,
        top: annotationText.y - ANNOTATION_TEXT_LINE_HEIGHT_PX / 2,
        right: annotationText.x + measureTextWidth(annotationText),
        bottom: annotationText.y + ANNOTATION_TEXT_LINE_HEIGHT_PX / 2,
      },
      pageRect,
    ),
  ),
});
