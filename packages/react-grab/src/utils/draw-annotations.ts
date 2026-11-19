import {
  ANNOTATION_STROKE_WIDTH_PX,
  ANNOTATION_TEXT_FONT_FAMILY,
  ANNOTATION_TEXT_FONT_SIZE_PX,
  ANNOTATION_TEXT_FONT_WEIGHT,
  ANNOTATION_TEXT_HALO_BLURS_PX,
  ANNOTATION_TEXT_LINE_HEIGHT_PX,
  INSPECT_ACCENT_CONTRAST_COLOR,
} from "../constants.js";
import type { AnnotationSnapshotForCapture, Rect } from "../types.js";
import { filterAnnotationsInRect } from "./filter-annotations-in-rect.js";
import { getAnnotationTextLines } from "./get-annotation-text-lines.js";
import { createInkPath } from "./ink-path.js";

export const drawAnnotations = (
  context: CanvasRenderingContext2D,
  annotations: AnnotationSnapshotForCapture,
  pageRect: Rect,
  scaleX: number,
  scaleY: number,
): void => {
  context.save();
  context.font = `${ANNOTATION_TEXT_FONT_WEIGHT} ${ANNOTATION_TEXT_FONT_SIZE_PX}px ${ANNOTATION_TEXT_FONT_FAMILY}`;
  const visibleAnnotations = filterAnnotationsInRect(annotations, pageRect, (annotationText) =>
    Math.max(
      ...getAnnotationTextLines(annotationText).map((line) => context.measureText(line).width),
    ),
  );
  context.scale(scaleX, scaleY);
  context.translate(-pageRect.left, -pageRect.top);

  for (const stroke of visibleAnnotations.strokes) {
    context.fillStyle = stroke.color;
    const path = new Path2D(
      createInkPath(
        stroke.points,
        ANNOTATION_STROKE_WIDTH_PX,
        stroke.isStraight,
        stroke.isRectangle,
      ),
    );
    if (stroke.isRectangle) {
      context.strokeStyle = stroke.color;
      context.lineWidth = ANNOTATION_STROKE_WIDTH_PX;
      context.lineJoin = "round";
      context.stroke(path);
    } else {
      context.fill(path);
    }
  }

  context.textBaseline = "middle";
  context.shadowColor = INSPECT_ACCENT_CONTRAST_COLOR;
  for (const annotationText of visibleAnnotations.texts) {
    context.fillStyle = annotationText.color;
    const lines = getAnnotationTextLines(annotationText);
    const fillLines = () =>
      lines.forEach((line, lineIndex) =>
        context.fillText(
          line,
          annotationText.x,
          annotationText.y + lineIndex * ANNOTATION_TEXT_LINE_HEIGHT_PX,
        ),
      );
    for (const haloBlurPx of ANNOTATION_TEXT_HALO_BLURS_PX) {
      context.shadowBlur = haloBlurPx * Math.min(scaleX, scaleY);
      fillLines();
    }
    context.shadowBlur = 0;
    fillLines();
  }
  context.restore();
};
