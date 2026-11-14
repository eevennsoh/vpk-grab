import { REDLINE_MIN_DISTANCE_PX, REDLINE_SIBLING_SEARCH_RADIUS } from "../constants.js";
import { getElementAdapter } from "../core/element-adapter.js";
import type { ElementRedlines, Rect } from "../types.js";
import { createElementBounds } from "./create-element-bounds.js";
import { getElementComputedStyle } from "./get-element-computed-style.js";
import { getRedlineMeasurements } from "./get-redline-measurements.js";
import { hasLayoutBox } from "./has-layout-box.js";
import { isReactGrabElement } from "./is-react-grab-element.js";
import { overlayBoundsToRect } from "./overlay-bounds-to-rect.js";

const OUT_OF_FLOW_POSITIONS = new Set(["absolute", "fixed"]);

// `display: contents` wrappers and zero-size shells have no edges to measure
// against, so the first ancestor that actually paints a box stands in.
const findContainer = (element: Element): Element | null => {
  let container = element.parentElement;
  while (container && !hasLayoutBox(createElementBounds(container))) {
    container = container.parentElement;
  }
  return container;
};

const getContainerInnerRect = (container: Element): Rect => {
  const containerStyle = getElementComputedStyle(container);
  const containerRect = overlayBoundsToRect(createElementBounds(container));
  const readBorderWidth = (side: string): number =>
    Number.parseFloat(containerStyle.getPropertyValue(`border-${side}-width`)) || 0;
  return {
    left: containerRect.left + readBorderWidth("left"),
    top: containerRect.top + readBorderWidth("top"),
    right: containerRect.right - readBorderWidth("right"),
    bottom: containerRect.bottom - readBorderWidth("bottom"),
  };
};

const collectSiblingRects = (element: Element, container: Element): Rect[] => {
  const siblings = Array.from(container.children);
  const elementIndex = siblings.indexOf(element);
  // -1 when a boxless wrapper (`display: contents`) sits between the element
  // and its container; that wrapper is skipped below via contains().
  const searchCenter = elementIndex === -1 ? 0 : elementIndex;
  const searchStart = Math.max(0, searchCenter - REDLINE_SIBLING_SEARCH_RADIUS);
  const searchEnd = Math.min(siblings.length, searchCenter + REDLINE_SIBLING_SEARCH_RADIUS + 1);

  const siblingRects: Rect[] = [];
  for (let index = searchStart; index < searchEnd; index++) {
    const sibling = siblings[index];
    if (sibling === element || sibling.contains(element) || isReactGrabElement(sibling)) continue;
    const siblingBounds = createElementBounds(sibling);
    if (!hasLayoutBox(siblingBounds)) continue;
    const siblingStyle = getElementComputedStyle(sibling);
    if (siblingStyle.visibility === "hidden") continue;
    if (OUT_OF_FLOW_POSITIONS.has(siblingStyle.position)) continue;
    siblingRects.push(overlayBoundsToRect(siblingBounds));
  }
  return siblingRects;
};

// A wrapper that hugs the element (an icon's span, a link around an image)
// has no spacing of its own to show, so the spacing worth reading is the
// wrapper's. Climbing stops at the first box with room around the element.
const isHuggedBy = (target: Rect, containerInnerRect: Rect): boolean =>
  Math.abs(target.left - containerInnerRect.left) < REDLINE_MIN_DISTANCE_PX &&
  Math.abs(target.top - containerInnerRect.top) < REDLINE_MIN_DISTANCE_PX &&
  Math.abs(target.right - containerInnerRect.right) < REDLINE_MIN_DISTANCE_PX &&
  Math.abs(target.bottom - containerInnerRect.bottom) < REDLINE_MIN_DISTANCE_PX;

export const getElementRedlines = (element: Element): ElementRedlines | null => {
  if (getElementAdapter(element)) return null;
  const bounds = createElementBounds(element);
  if (!hasLayoutBox(bounds)) return null;

  const targetRect = overlayBoundsToRect(bounds);
  let measuredElement = element;
  let container = findContainer(measuredElement);
  let containerInnerRect = container ? getContainerInnerRect(container) : null;
  while (container && containerInnerRect && isHuggedBy(targetRect, containerInnerRect)) {
    const outerContainer = findContainer(container);
    if (!outerContainer) break;
    measuredElement = container;
    container = outerContainer;
    containerInnerRect = getContainerInnerRect(outerContainer);
  }

  const measurements = getRedlineMeasurements(
    targetRect,
    container ? collectSiblingRects(measuredElement, container) : [],
    containerInnerRect,
  );
  return { bounds, measurements, guides: [], targetBounds: null };
};
