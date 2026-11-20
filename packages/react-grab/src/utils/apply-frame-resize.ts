import {
  ANNOTATION_TRANSFORM_MIN_AXIS_EXTENT_PX,
  ANNOTATION_TRANSFORM_MIN_SIZE_PX,
} from "../constants.js";
import type { AnnotationFrame, AnnotationFrameTransform } from "../types.js";
import { getSign } from "./get-sign.js";

const getMinScale = (extentPx: number): number =>
  Math.min(ANNOTATION_TRANSFORM_MIN_SIZE_PX, extentPx) / extentPx;

const clampScale = (scale: number, minScale: number): number =>
  Math.abs(scale) < minScale ? getSign(scale) * minScale : scale;

// Resizes a frame along its own (possibly turned) axes by the pointer's travel
// from where the handle was pressed. The side opposite the handle stays put,
// or the centre does when resizing from the centre; dragging past that side
// flips the frame. A locked ratio follows the axis that changed most in
// proportion, shrinking as well as growing. Writes into `result` so a drag
// allocates nothing per move.
export const applyFrameResize = (
  frame: AnnotationFrame,
  handleDirectionX: number,
  handleDirectionY: number,
  pointerDeltaX: number,
  pointerDeltaY: number,
  isAspectLocked: boolean,
  isFromCenter: boolean,
  result: AnnotationFrameTransform,
): void => {
  const cosine = Math.cos(frame.rotation);
  const sine = Math.sin(frame.rotation);
  const localDeltaX = pointerDeltaX * cosine + pointerDeltaY * sine;
  const localDeltaY = -pointerDeltaX * sine + pointerDeltaY * cosine;
  const centerFactor = isFromCenter ? 2 : 1;
  const isWidthScalable = frame.width >= ANNOTATION_TRANSFORM_MIN_AXIS_EXTENT_PX;
  const isHeightScalable = frame.height >= ANNOTATION_TRANSFORM_MIN_AXIS_EXTENT_PX;
  const isDraggingWidth = handleDirectionX !== 0 && isWidthScalable;
  const isDraggingHeight = handleDirectionY !== 0 && isHeightScalable;

  let scaleX = isDraggingWidth
    ? (frame.width + handleDirectionX * localDeltaX * centerFactor) / frame.width
    : 1;
  let scaleY = isDraggingHeight
    ? (frame.height + handleDirectionY * localDeltaY * centerFactor) / frame.height
    : 1;

  if (isAspectLocked && (isDraggingWidth || isDraggingHeight)) {
    const minScaleX = isWidthScalable ? getMinScale(frame.width) : 0;
    const minScaleY = isHeightScalable ? getMinScale(frame.height) : 0;
    const isWidthLeading =
      isDraggingWidth && (!isDraggingHeight || Math.abs(scaleX - 1) >= Math.abs(scaleY - 1));
    const evenScale = Math.max(Math.abs(isWidthLeading ? scaleX : scaleY), minScaleX, minScaleY);
    scaleX = isWidthScalable ? (isDraggingWidth ? getSign(scaleX) : 1) * evenScale : 1;
    scaleY = isHeightScalable ? (isDraggingHeight ? getSign(scaleY) : 1) * evenScale : 1;
  } else {
    if (isDraggingWidth) scaleX = clampScale(scaleX, getMinScale(frame.width));
    if (isDraggingHeight) scaleY = clampScale(scaleY, getMinScale(frame.height));
  }

  const offsetX = isFromCenter ? 0 : (handleDirectionX * frame.width * (scaleX - 1)) / 2;
  const offsetY = isFromCenter ? 0 : (handleDirectionY * frame.height * (scaleY - 1)) / 2;
  result.originX = frame.centerX;
  result.originY = frame.centerY;
  result.targetX = frame.centerX + offsetX * cosine - offsetY * sine;
  result.targetY = frame.centerY + offsetX * sine + offsetY * cosine;
  result.rotation = frame.rotation;
  result.scaleX = scaleX;
  result.scaleY = scaleY;
  result.angle = 0;
};
