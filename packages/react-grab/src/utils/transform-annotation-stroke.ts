import type {
  AnnotationFrame,
  AnnotationFrameTransform,
  AnnotationStroke,
  Position,
} from "../types.js";
import { getItemAxisScale } from "./get-item-axis-scale.js";
import { getSign } from "./get-sign.js";
import { normalizeAngle } from "./normalize-angle.js";
import { transformFramePoint } from "./transform-frame-point.js";

const transformedCenter: Position = { x: 0, y: 0 };

// Only the points move: the ink keeps its width however far it is stretched.
// A flip across one axis mirrors the points and turns the stroke the other way.
// Writes into `target`, a copy of the stroke with its own points, so a drag
// reuses one stroke and its points instead of allocating them per move.
export const transformAnnotationStroke = (
  startStroke: AnnotationStroke,
  startFrame: AnnotationFrame,
  transform: AnnotationFrameTransform,
  target: AnnotationStroke,
): void => {
  transformFramePoint(startFrame.centerX, startFrame.centerY, transform, transformedCenter);
  const relativeRotation = startStroke.rotation - transform.rotation;
  const mirrorSign = getSign(transform.scaleX) * getSign(transform.scaleY);
  const pointScaleX =
    getSign(transform.scaleX) *
    getItemAxisScale(transform.scaleX, transform.scaleY, relativeRotation, false);
  const pointScaleY =
    getSign(transform.scaleY) *
    getItemAxisScale(transform.scaleX, transform.scaleY, relativeRotation, true);
  for (let pointIndex = 0; pointIndex < startStroke.points.length; pointIndex++) {
    const startPoint = startStroke.points[pointIndex];
    const targetPoint = target.points[pointIndex];
    targetPoint.x = transformedCenter.x + (startPoint.x - startFrame.centerX) * pointScaleX;
    targetPoint.y = transformedCenter.y + (startPoint.y - startFrame.centerY) * pointScaleY;
  }
  target.rotation = normalizeAngle(
    transform.rotation + relativeRotation * mirrorSign + transform.angle,
  );
};
