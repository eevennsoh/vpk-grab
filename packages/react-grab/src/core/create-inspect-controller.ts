import { batch, createMemo, createSignal, type Accessor } from "solid-js";
import {
  ANNOTATION_ID_ATTRIBUTE,
  ANNOTATION_MARQUEE_MIN_DRAG_PX,
  ANNOTATION_MIN_SAMPLE_DISTANCE_PX,
  ANNOTATION_MIN_STROKE_LENGTH_PX,
  ELEMENT_DETECTION_THROTTLE_MS,
} from "../constants.js";
import type {
  AnnotationPoint,
  AnnotationStroke,
  AnnotationText,
  AnnotationTool,
  Position,
  Rect,
} from "../types.js";
import { createRectFromCorners } from "../utils/create-rect-from-corners.js";
import { generateId } from "../utils/generate-id.js";
import { getNextInkWeight, INK_NEUTRAL_WEIGHT } from "../utils/ink-path.js";
import { loadInspectSettings, saveInspectSettings } from "../utils/inspect-settings.js";
import { isRectOverlapping } from "../utils/is-rect-overlapping.js";
import { snapStraightLineEnd } from "../utils/snap-straight-line-end.js";

interface InspectControllerOptions {
  isShiftKeyHeld: Accessor<boolean>;
  getElementAtPosition: (clientX: number, clientY: number) => Element | null;
  getAnnotationElements: () => Iterable<Element>;
}

interface ActiveDrawing {
  pointerId: number;
  points: AnnotationPoint[];
  lastSampleTimestamp: number;
  lengthPx: number;
}

interface ActiveMove {
  pointerId: number;
  lastPoint: Position;
}

interface AnnotationHitBox {
  annotationId: string;
  pageRect: Rect;
}

interface ActiveMarquee {
  pointerId: number;
  origin: Position;
  baseSelectionIds: string[];
  hitBoxes: AnnotationHitBox[];
}

const DRAFT_STROKE_ID = "draft";

// Annotations live in page coordinates so they stay on what they point at
// while the page scrolls.
const toPagePoint = (event: { clientX: number; clientY: number }): Position => ({
  x: event.clientX + window.scrollX,
  y: event.clientY + window.scrollY,
});

// The browser has already hit-tested the press against the annotations'
// own shapes, so the one under the pointer is whichever is in the event path.
const getPressedAnnotationId = (event: PointerEvent): string | null => {
  for (const target of event.composedPath()) {
    if (!(target instanceof Element)) continue;
    const annotationId = target.getAttribute(ANNOTATION_ID_ATTRIBUTE);
    if (annotationId) return annotationId;
  }
  return null;
};

// Measured once when the marquee starts: nothing moves while it is drawn, and
// the browser's own boxes cover notes, whose width depends on the font.
const measureAnnotationHitBoxes = (elements: Iterable<Element>): AnnotationHitBox[] => {
  const hitBoxes: AnnotationHitBox[] = [];
  for (const element of elements) {
    const annotationId = element.getAttribute(ANNOTATION_ID_ATTRIBUTE);
    if (!annotationId) continue;
    const clientRect = element.getBoundingClientRect();
    hitBoxes.push({
      annotationId,
      pageRect: {
        left: clientRect.left + window.scrollX,
        top: clientRect.top + window.scrollY,
        right: clientRect.right + window.scrollX,
        bottom: clientRect.bottom + window.scrollY,
      },
    });
  }
  return hitBoxes;
};

const createStraightPoints = (points: AnnotationPoint[]): AnnotationPoint[] => {
  const startPoint = points[0];
  const endPoint = snapStraightLineEnd(startPoint, points[points.length - 1]);
  return [
    { x: startPoint.x, y: startPoint.y, weight: INK_NEUTRAL_WEIGHT },
    { x: endPoint.x, y: endPoint.y, weight: INK_NEUTRAL_WEIGHT },
  ];
};

export const createInspectController = (options: InspectControllerOptions) => {
  const initialSettings = loadInspectSettings();
  const [isSpecsEnabled, setIsSpecsEnabled] = createSignal(initialSettings.isSpecsEnabled);
  const [isRedlinesEnabled, setIsRedlinesEnabled] = createSignal(initialSettings.isRedlinesEnabled);
  const [annotationTool, setAnnotationTool] = createSignal<AnnotationTool>("grab");
  const [strokes, setStrokes] = createSignal<AnnotationStroke[]>([]);
  const [texts, setTexts] = createSignal<AnnotationText[]>([]);
  const [drawingPoints, setDrawingPoints] = createSignal<AnnotationPoint[]>([]);
  const [textDraftPosition, setTextDraftPosition] = createSignal<Position | null>(null);
  const [selectedAnnotationIds, setSelectedAnnotationIds] = createSignal<string[]>([]);
  const [marqueeRect, setMarqueeRect] = createSignal<Rect | null>(null);
  const [pinnedSpecsElement, setPinnedSpecsElement] = createSignal<Element | null>(null);
  const [isSpecsPanelHovered, setIsSpecsPanelHovered] = createSignal(false);
  const [isSpecsPanelEngaged, setIsSpecsPanelEngaged] = createSignal(false);
  const [isSpecsPinLocked, setIsSpecsPinLocked] = createSignal(false);
  const [styleOverridesVersion, setStyleOverridesVersion] = createSignal(0);
  const [measureAnchorElement, setMeasureAnchorElement] = createSignal<Element | null>(null);
  const [measureTargetElement, setMeasureTargetElement] = createSignal<Element | null>(null);

  let measurePointer: Position | null = null;
  let measureDetectionTimeoutId: ReturnType<typeof setTimeout> | null = null;
  let activeDrawing: ActiveDrawing | null = null;
  let activeMove: ActiveMove | null = null;
  let activeMarquee: ActiveMarquee | null = null;
  let textDraftValue = "";

  const draftStroke = createMemo((): AnnotationStroke | null => {
    const points = drawingPoints();
    if (points.length === 0) return null;
    return options.isShiftKeyHeld()
      ? { id: DRAFT_STROKE_ID, points: createStraightPoints(points), isStraight: true }
      : { id: DRAFT_STROKE_ID, points, isStraight: false };
  });

  const hasAnnotations = createMemo(() => strokes().length > 0 || texts().length > 0);

  const persistSettings = () =>
    saveInspectSettings({
      isSpecsEnabled: isSpecsEnabled(),
      isRedlinesEnabled: isRedlinesEnabled(),
    });

  const unpinSpecs = () => {
    setPinnedSpecsElement(null);
    setIsSpecsPanelHovered(false);
    setIsSpecsPanelEngaged(false);
    setIsSpecsPinLocked(false);
  };

  // The pin outlives the Shift press while anything is still using the panel:
  // the pointer is over it, a field or menu in it has focus, or it was locked.
  const isSpecsPinHeld = () =>
    options.isShiftKeyHeld() ||
    isSpecsPanelHovered() ||
    isSpecsPanelEngaged() ||
    isSpecsPinLocked();

  const releaseSpecsPin = () => {
    if (!isSpecsPinHeld()) unpinSpecs();
  };

  // Locked before the element is pinned, in one batch: the panel's effects
  // run on the pin and would otherwise release a pin nothing yet holds.
  const lockSpecsPin = (element: Element) =>
    batch(() => {
      setIsSpecsPinLocked(true);
      setPinnedSpecsElement(element);
    });

  const toggleSpecsPinLock = () => {
    if (pinnedSpecsElement() === null) return;
    if (!isSpecsPinLocked()) {
      setIsSpecsPinLocked(true);
      return;
    }
    setIsSpecsPinLocked(false);
    releaseSpecsPin();
  };

  const startMeasuring = (anchorElement: Element) => {
    measurePointer = null;
    setMeasureTargetElement(null);
    setMeasureAnchorElement(anchorElement);
  };

  // Hands back where the pointer went while the selection was held on the
  // anchor, so the selection can catch up with it.
  const stopMeasuring = (): Position | null => {
    if (measureDetectionTimeoutId !== null) clearTimeout(measureDetectionTimeoutId);
    measureDetectionTimeoutId = null;
    const lastPointer = measurePointer;
    measurePointer = null;
    setMeasureAnchorElement(null);
    setMeasureTargetElement(null);
    return lastPointer;
  };

  const trackMeasureTarget = (clientX: number, clientY: number) => {
    measurePointer = { x: clientX, y: clientY };
    if (measureDetectionTimeoutId !== null) return;
    measureDetectionTimeoutId = setTimeout(() => {
      measureDetectionTimeoutId = null;
      if (!measurePointer || measureAnchorElement() === null) return;
      setMeasureTargetElement(options.getElementAtPosition(measurePointer.x, measurePointer.y));
    }, ELEMENT_DETECTION_THROTTLE_MS);
  };

  const toggleSpecs = () => {
    if (isSpecsEnabled()) unpinSpecs();
    setIsSpecsEnabled((isEnabled) => !isEnabled);
    persistSettings();
  };

  const toggleRedlines = () => {
    if (isRedlinesEnabled()) stopMeasuring();
    setIsRedlinesEnabled((isEnabled) => !isEnabled);
    persistSettings();
  };

  const setSpecsPanelHovered = (isHovered: boolean) => {
    setIsSpecsPanelHovered(isHovered);
    if (!isHovered) releaseSpecsPin();
  };

  const setSpecsPanelEngaged = (isEngaged: boolean) => {
    setIsSpecsPanelEngaged(isEngaged);
    if (!isEngaged) releaseSpecsPin();
  };

  const notifyStyleOverridesChanged = () => setStyleOverridesVersion((version) => version + 1);

  const cancelPointerGesture = () => {
    activeDrawing = null;
    activeMove = null;
    activeMarquee = null;
    setDrawingPoints([]);
    setMarqueeRect(null);
  };

  const discardTextDraft = () => {
    textDraftValue = "";
    setTextDraftPosition(null);
  };

  // `draftPosition` names the draft a late event belongs to: the blur of an
  // input that was already replaced must not commit (and so empty) the draft
  // that replaced it.
  const commitTextDraft = (draftPosition?: Position) => {
    const currentPosition = textDraftPosition();
    if (!currentPosition) return;
    if (draftPosition && draftPosition !== currentPosition) return;
    const text = textDraftValue.trim();
    if (text) {
      setTexts((previousTexts) => [
        ...previousTexts,
        { id: generateId("annotation-text"), x: currentPosition.x, y: currentPosition.y, text },
      ]);
    }
    discardTextDraft();
  };

  const selectTool = (tool: AnnotationTool) => {
    cancelPointerGesture();
    commitTextDraft();
    setSelectedAnnotationIds([]);
    setAnnotationTool(tool);
  };

  // The move tool has nothing left to act on once the last annotation is
  // gone, and its button leaves the toolbar with it.
  const putDownEditToolIfEmpty = () => {
    if (annotationTool() !== "edit") return;
    if (strokes().length === 0 && texts().length === 0) setAnnotationTool("grab");
  };

  const clearAnnotations = () => {
    cancelPointerGesture();
    discardTextDraft();
    setSelectedAnnotationIds([]);
    setStrokes([]);
    setTexts([]);
    putDownEditToolIfEmpty();
  };

  const removeSelectedAnnotations = () => {
    const removedIds = new Set(selectedAnnotationIds());
    if (removedIds.size === 0) return;
    activeMove = null;
    setSelectedAnnotationIds([]);
    setStrokes((previousStrokes) => previousStrokes.filter((stroke) => !removedIds.has(stroke.id)));
    setTexts((previousTexts) => previousTexts.filter((text) => !removedIds.has(text.id)));
    putDownEditToolIfEmpty();
  };

  const moveSelectedAnnotations = (deltaX: number, deltaY: number) => {
    const movedIds = new Set(selectedAnnotationIds());
    batch(() => {
      setStrokes((previousStrokes) =>
        previousStrokes.map((stroke) =>
          movedIds.has(stroke.id)
            ? {
                ...stroke,
                points: stroke.points.map((point) => ({
                  ...point,
                  x: point.x + deltaX,
                  y: point.y + deltaY,
                })),
              }
            : stroke,
        ),
      );
      setTexts((previousTexts) =>
        previousTexts.map((text) =>
          movedIds.has(text.id) ? { ...text, x: text.x + deltaX, y: text.y + deltaY } : text,
        ),
      );
    });
  };

  const pressAnnotation = (event: PointerEvent, annotationId: string) => {
    const isAlreadySelected = selectedAnnotationIds().includes(annotationId);
    if (event.shiftKey && isAlreadySelected) {
      setSelectedAnnotationIds((previousIds) => previousIds.filter((id) => id !== annotationId));
      return;
    }
    if (event.shiftKey) {
      setSelectedAnnotationIds((previousIds) => [...previousIds, annotationId]);
    } else if (!isAlreadySelected) {
      setSelectedAnnotationIds([annotationId]);
    }
    activeMove = { pointerId: event.pointerId, lastPoint: toPagePoint(event) };
  };

  // A press on empty page deselects, as it does in a design tool, and a drag
  // from there boxes in whatever it touches; Shift adds to the selection.
  const startMarquee = (event: PointerEvent) => {
    const baseSelectionIds = event.shiftKey ? selectedAnnotationIds() : [];
    setSelectedAnnotationIds(baseSelectionIds);
    activeMarquee = {
      pointerId: event.pointerId,
      origin: toPagePoint(event),
      baseSelectionIds,
      hitBoxes: measureAnnotationHitBoxes(options.getAnnotationElements()),
    };
  };

  const updateMarquee = (marquee: ActiveMarquee, event: PointerEvent) => {
    const currentPoint = toPagePoint(event);
    // Until the pointer really travels this is a click, which only deselects.
    if (
      marqueeRect() === null &&
      Math.hypot(currentPoint.x - marquee.origin.x, currentPoint.y - marquee.origin.y) <
        ANNOTATION_MARQUEE_MIN_DRAG_PX
    ) {
      return;
    }
    const nextMarqueeRect = createRectFromCorners(marquee.origin, currentPoint);
    const nextSelectionIds = new Set(marquee.baseSelectionIds);
    for (const hitBox of marquee.hitBoxes) {
      if (isRectOverlapping(nextMarqueeRect, hitBox.pageRect)) {
        nextSelectionIds.add(hitBox.annotationId);
      }
    }
    batch(() => {
      setMarqueeRect(nextMarqueeRect);
      setSelectedAnnotationIds([...nextSelectionIds]);
    });
  };

  const addDrawingSample = (sample: PointerEvent, isFinalSample: boolean) => {
    if (!activeDrawing) return;
    const samplePoint = toPagePoint(sample);
    const previousPoint = activeDrawing.points[activeDrawing.points.length - 1];
    const distancePx = Math.hypot(samplePoint.x - previousPoint.x, samplePoint.y - previousPoint.y);
    // The final sample is kept however close it is, so the stroke ends where
    // the pointer was let go.
    if (isFinalSample ? distancePx === 0 : distancePx < ANNOTATION_MIN_SAMPLE_DISTANCE_PX) return;
    const weight = getNextInkWeight(
      previousPoint.weight,
      distancePx,
      sample.timeStamp - activeDrawing.lastSampleTimestamp,
      // Only a stylus reports real pressure; mouse and touch report a constant.
      sample.pointerType === "pen" ? sample.pressure : undefined,
    );
    activeDrawing.points.push({ ...samplePoint, weight });
    activeDrawing.lastSampleTimestamp = sample.timeStamp;
    activeDrawing.lengthPx += distancePx;
  };

  const handlePointerDown = (event: PointerEvent) => {
    const tool = annotationTool();
    switch (tool) {
      case "grab":
        return;
      case "pen": {
        activeDrawing = {
          pointerId: event.pointerId,
          points: [{ ...toPagePoint(event), weight: INK_NEUTRAL_WEIGHT }],
          lastSampleTimestamp: event.timeStamp,
          lengthPx: 0,
        };
        setDrawingPoints([...activeDrawing.points]);
        return;
      }
      case "text": {
        commitTextDraft();
        setTextDraftPosition(toPagePoint(event));
        return;
      }
      case "edit": {
        const annotationId = getPressedAnnotationId(event);
        if (annotationId) pressAnnotation(event, annotationId);
        else startMarquee(event);
        return;
      }
      default: {
        const unhandledTool: never = tool;
        return unhandledTool;
      }
    }
  };

  const handlePointerMove = (event: PointerEvent) => {
    if (activeMove && activeMove.pointerId === event.pointerId) {
      const currentPoint = toPagePoint(event);
      moveSelectedAnnotations(
        currentPoint.x - activeMove.lastPoint.x,
        currentPoint.y - activeMove.lastPoint.y,
      );
      activeMove.lastPoint = currentPoint;
      return;
    }
    if (activeMarquee && activeMarquee.pointerId === event.pointerId) {
      updateMarquee(activeMarquee, event);
      return;
    }
    if (!activeDrawing || activeDrawing.pointerId !== event.pointerId) return;
    const previousPointCount = activeDrawing.points.length;
    // Every reading the browser took since the last event, so a fast stroke
    // is drawn through all of them rather than cut straight across.
    const coalescedSamples = event.getCoalescedEvents?.() ?? [];
    for (const sample of coalescedSamples.length > 0 ? coalescedSamples : [event]) {
      addDrawingSample(sample, false);
    }
    if (activeDrawing.points.length !== previousPointCount) {
      setDrawingPoints([...activeDrawing.points]);
    }
  };

  const handlePointerUp = (event: PointerEvent) => {
    if (activeMove && activeMove.pointerId === event.pointerId) {
      activeMove = null;
      return;
    }
    if (activeMarquee && activeMarquee.pointerId === event.pointerId) {
      activeMarquee = null;
      setMarqueeRect(null);
      return;
    }
    if (!activeDrawing || activeDrawing.pointerId !== event.pointerId) return;
    addDrawingSample(event, true);
    const isStraight = event.shiftKey;
    const points = isStraight ? createStraightPoints(activeDrawing.points) : activeDrawing.points;
    // Measured along the stroke, not end to end: a loop ends where it began.
    const lengthPx = isStraight
      ? Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y)
      : activeDrawing.lengthPx;
    if (lengthPx >= ANNOTATION_MIN_STROKE_LENGTH_PX) {
      setStrokes((previousStrokes) => [
        ...previousStrokes,
        { id: generateId("annotation-stroke"), points, isStraight },
      ]);
    }
    cancelPointerGesture();
  };

  return {
    isSpecsEnabled,
    isRedlinesEnabled,
    annotationTool,
    strokes,
    texts,
    draftStroke,
    textDraftPosition,
    hasAnnotations,
    selectedAnnotationIds,
    marqueeRect,
    pinnedSpecsElement,
    pinSpecs: setPinnedSpecsElement,
    unpinSpecs,
    releaseSpecsPin,
    isSpecsPinLocked,
    lockSpecsPin,
    toggleSpecsPinLock,
    setSpecsPanelHovered,
    setSpecsPanelEngaged,
    styleOverridesVersion,
    notifyStyleOverridesChanged,
    measureAnchorElement,
    measureTargetElement,
    startMeasuring,
    stopMeasuring,
    trackMeasureTarget,
    toggleSpecs,
    toggleRedlines,
    selectTool,
    clearAnnotations,
    removeSelectedAnnotations,
    cancelPointerGesture,
    commitTextDraft,
    discardTextDraft,
    setTextDraftValue: (text: string) => {
      textDraftValue = text;
    },
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
  };
};
