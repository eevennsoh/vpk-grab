import { ANNOTATION_TEXT_LINE_HEIGHT_PX } from "../constants.js";
import type {
  AnnotationFrame,
  AnnotationFrameTransform,
  AnnotationText,
  Position,
} from "../types.js";
import { getItemAxisScale } from "./get-item-axis-scale.js";
import { normalizeAngle } from "./normalize-angle.js";
import { transformFramePoint } from "./transform-frame-point.js";

const transformedCenter: Position = { x: 0, y: 0 };

// A note only ever scales evenly and never mirrors, so it takes the smaller of
// the two axis scales and stays readable after a flip. Writes into `target`,
// a copy of the note, so a drag reuses one note instead of allocating per move.
export const transformAnnotationText = (
  startText: AnnotationText,
  baseWidth: number,
  startFrame: AnnotationFrame,
  transform: AnnotationFrameTransform,
  target: AnnotationText,
): void => {
  transformFramePoint(startFrame.centerX, startFrame.centerY, transform, transformedCenter);
  const relativeRotation = startText.rotation - transform.rotation;
  const evenScale = Math.min(
    getItemAxisScale(transform.scaleX, transform.scaleY, relativeRotation, false),
    getItemAxisScale(transform.scaleX, transform.scaleY, relativeRotation, true),
  );
  const baseHeight = startFrame.height / startText.scale;
  target.x = transformedCenter.x - baseWidth / 2;
  target.y = transformedCenter.y - baseHeight / 2 + ANNOTATION_TEXT_LINE_HEIGHT_PX / 2;
  target.scale = startText.scale * evenScale;
  target.rotation = normalizeAngle(startText.rotation + transform.angle);
};
