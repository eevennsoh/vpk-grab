import { ANNOTATION_TEXT_LINE_HEIGHT_PX } from "../constants.js";
import type { AnnotationFrameTransform, AnnotationText } from "../types.js";
import { getAnnotationTextFrame } from "./get-annotation-text-frame.js";
import { getItemAxisScale } from "./get-item-axis-scale.js";
import { normalizeAngle } from "./normalize-angle.js";
import { transformFramePoint } from "./transform-frame-point.js";

// A note only ever scales evenly and never mirrors, so it takes the smaller of
// the two axis scales and stays readable after a flip.
export const transformAnnotationText = (
  annotationText: AnnotationText,
  baseWidth: number,
  transform: AnnotationFrameTransform,
): AnnotationText => {
  const frame = getAnnotationTextFrame(annotationText, baseWidth);
  const center = transformFramePoint(frame.centerX, frame.centerY, transform);
  const relativeRotation = annotationText.rotation - transform.rotation;
  const evenScale = Math.min(
    getItemAxisScale(transform.scaleX, transform.scaleY, relativeRotation, false),
    getItemAxisScale(transform.scaleX, transform.scaleY, relativeRotation, true),
  );
  const baseHeight = frame.height / annotationText.scale;
  return {
    ...annotationText,
    x: center.x - baseWidth / 2,
    y: center.y - baseHeight / 2 + ANNOTATION_TEXT_LINE_HEIGHT_PX / 2,
    scale: annotationText.scale * evenScale,
    rotation: normalizeAngle(annotationText.rotation + transform.angle),
  };
};
