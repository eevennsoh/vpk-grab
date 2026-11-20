import type { AnnotationFrameTransform, AnnotationStroke } from "../types.js";
import { getAnnotationStrokeFrame } from "./get-annotation-stroke-frame.js";
import { getItemAxisScale } from "./get-item-axis-scale.js";
import { getSign } from "./get-sign.js";
import { normalizeAngle } from "./normalize-angle.js";
import { transformFramePoint } from "./transform-frame-point.js";

// Only the points move: the ink keeps its width however far it is stretched.
// A flip across one axis mirrors the points and turns the stroke the other way.
export const transformAnnotationStroke = (
  stroke: AnnotationStroke,
  transform: AnnotationFrameTransform,
): AnnotationStroke => {
  const frame = getAnnotationStrokeFrame(stroke);
  const center = transformFramePoint(frame.centerX, frame.centerY, transform);
  const relativeRotation = stroke.rotation - transform.rotation;
  const mirrorSign = getSign(transform.scaleX) * getSign(transform.scaleY);
  const pointScaleX =
    getSign(transform.scaleX) *
    getItemAxisScale(transform.scaleX, transform.scaleY, relativeRotation, false);
  const pointScaleY =
    getSign(transform.scaleY) *
    getItemAxisScale(transform.scaleX, transform.scaleY, relativeRotation, true);
  return {
    ...stroke,
    points: stroke.points.map((point) => ({
      x: center.x + (point.x - frame.centerX) * pointScaleX,
      y: center.y + (point.y - frame.centerY) * pointScaleY,
      weight: point.weight,
    })),
    rotation: normalizeAngle(transform.rotation + relativeRotation * mirrorSign + transform.angle),
  };
};
