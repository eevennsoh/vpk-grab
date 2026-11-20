import {
  ANNOTATION_STROKE_WIDTH_PX,
  ANNOTATION_TEXT_CANVAS_FONT,
  ANNOTATION_TEXT_HALO_BLURS_PX,
  ANNOTATION_TEXT_LINE_HEIGHT_PX,
  INSPECT_ACCENT_CONTRAST_COLOR,
} from "../constants.js";
import type { AnnotationFrame, AnnotationSnapshotForCapture, Rect } from "../types.js";
import { filterAnnotationsInRect } from "./filter-annotations-in-rect.js";
import { getAnnotationStrokeFrame } from "./get-annotation-stroke-frame.js";
import { getAnnotationTextFrame } from "./get-annotation-text-frame.js";
import { getAnnotationTextLines } from "./get-annotation-text-lines.js";
import { createInkPath } from "./ink-path.js";
import { measureAnnotationTextWidth } from "./measure-annotation-text-width.js";

const turnAboutFrameCenter = (
  context: CanvasRenderingContext2D,
  frame: AnnotationFrame,
  scale: number,
) => {
  context.translate(frame.centerX, frame.centerY);
  context.rotate(frame.rotation);
  context.scale(scale, scale);
  context.translate(-frame.centerX, -frame.centerY);
};

export const drawAnnotations = (
  context: CanvasRenderingContext2D,
  annotations: AnnotationSnapshotForCapture,
  pageRect: Rect,
  scaleX: number,
  scaleY: number,
): void => {
  context.save();
  context.font = ANNOTATION_TEXT_CANVAS_FONT;
  const visibleAnnotations = filterAnnotationsInRect(
    annotations,
    pageRect,
    measureAnnotationTextWidth,
  );
  context.scale(scaleX, scaleY);
  context.translate(-pageRect.left, -pageRect.top);

  for (const stroke of visibleAnnotations.strokes) {
    context.save();
    turnAboutFrameCenter(context, getAnnotationStrokeFrame(stroke), 1);
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
    context.restore();
  }

  context.textBaseline = "middle";
  context.shadowColor = INSPECT_ACCENT_CONTRAST_COLOR;
  for (const annotationText of visibleAnnotations.texts) {
    context.save();
    turnAboutFrameCenter(
      context,
      getAnnotationTextFrame(annotationText, measureAnnotationTextWidth(annotationText)),
      annotationText.scale,
    );
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
    // Canvas shadows ignore the transform, so the halo is scaled by hand to
    // match the note's on-screen size.
    for (const haloBlurPx of ANNOTATION_TEXT_HALO_BLURS_PX) {
      context.shadowBlur = haloBlurPx * Math.min(scaleX, scaleY) * annotationText.scale;
      fillLines();
    }
    context.shadowBlur = 0;
    fillLines();
    context.restore();
  }
  context.restore();
};
