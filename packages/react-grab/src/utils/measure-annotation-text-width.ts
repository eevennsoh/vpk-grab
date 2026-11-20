import { ANNOTATION_TEXT_CANVAS_FONT } from "../constants.js";
import type { AnnotationText } from "../types.js";
import { getAnnotationTextLines } from "./get-annotation-text-lines.js";

let measureContext: CanvasRenderingContext2D | null | undefined;

// Measured the way the screenshot draws the note, so the frame on screen, the
// note's pivot and the captured image all agree on its width.
export const measureAnnotationTextWidth = (annotationText: AnnotationText): number => {
  if (measureContext === undefined) {
    measureContext = document.createElement("canvas").getContext("2d");
    if (measureContext) measureContext.font = ANNOTATION_TEXT_CANVAS_FONT;
  }
  const context = measureContext;
  if (!context) return 0;
  return Math.max(
    ...getAnnotationTextLines(annotationText).map((line) => context.measureText(line).width),
  );
};
