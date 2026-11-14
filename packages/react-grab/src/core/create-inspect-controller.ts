import { createMemo, createSignal, type Accessor } from "solid-js";
import {
  ANNOTATION_ID_ATTRIBUTE,
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
} from "../types.js";
import { generateId } from "../utils/generate-id.js";
import { getNextInkWeight, INK_NEUTRAL_WEIGHT } from "../utils/ink-path.js";
import { loadInspectSettings, saveInspectSettings } from "../utils/inspect-settings.js";
import { snapStraightLineEnd } from "../utils/snap-straight-line-end.js";

interface InspectControllerOptions {
  isShiftKeyHeld: Accessor<boolean>;
  getElementAtPosition: (clientX: number, clientY: number) => Element | null;
}

interface ActiveDrawing {
  pointerId: number;
  points: AnnotationPoint[];
  lastSampleTimestamp: number;
  lengthPx: number;
}

interface ActiveMove {
  pointerId: number;
  annotationId: string;
  lastPoint: Position;
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
  const [selectedAnnotationId, setSelectedAnnotationId] = createSignal<string | null>(null);
  const [pinnedSpecsElement, setPinnedSpecsElement] = createSignal<Element | null>(null);
  const [isSpecsPanelHovered, setIsSpecsPanelHovered] = createSignal(false);
  const [measureAnchorElement, setMeasureAnchorElement] = createSignal<Element | null>(null);
  const [measureTargetElement, setMeasureTargetElement] = createSignal<Element | null>(null);

  let measurePointer: Position | null = null;
  let measureDetectionTimeoutId: ReturnType<typeof setTimeout> | null = null;
  let activeDrawing: ActiveDrawing | null = null;
  let activeMove: ActiveMove | null = null;
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

  // The pin outlives the Shift press for as long as the pointer is in the
  // panel, so the key does not have to be held through every click there.
  const setSpecsPanelHovered = (isHovered: boolean) => {
    setIsSpecsPanelHovered(isHovered);
    if (!isHovered && !options.isShiftKeyHeld()) unpinSpecs();
  };

  const releaseSpecsPin = () => {
    if (!isSpecsPanelHovered()) unpinSpecs();
  };

  const cancelPointerGesture = () => {
    activeDrawing = null;
    activeMove = null;
    setDrawingPoints([]);
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
    setSelectedAnnotationId(null);
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
    setSelectedAnnotationId(null);
    setStrokes([]);
    setTexts([]);
    putDownEditToolIfEmpty();
  };

  const removeSelectedAnnotation = () => {
    const annotationId = selectedAnnotationId();
    if (!annotationId) return;
    activeMove = null;
    setSelectedAnnotationId(null);
    setStrokes((previousStrokes) => previousStrokes.filter((stroke) => stroke.id !== annotationId));
    setTexts((previousTexts) => previousTexts.filter((text) => text.id !== annotationId));
    putDownEditToolIfEmpty();
  };

  const moveAnnotation = (annotationId: string, deltaX: number, deltaY: number) => {
    if (strokes().some((stroke) => stroke.id === annotationId)) {
      setStrokes((previousStrokes) =>
        previousStrokes.map((stroke) =>
          stroke.id === annotationId
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
      return;
    }
    setTexts((previousTexts) =>
      previousTexts.map((text) =>
        text.id === annotationId ? { ...text, x: text.x + deltaX, y: text.y + deltaY } : text,
      ),
    );
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
        // A press on empty page deselects, as it does in a design tool.
        const annotationId = getPressedAnnotationId(event);
        setSelectedAnnotationId(annotationId);
        activeMove = annotationId
          ? { pointerId: event.pointerId, annotationId, lastPoint: toPagePoint(event) }
          : null;
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
      moveAnnotation(
        activeMove.annotationId,
        currentPoint.x - activeMove.lastPoint.x,
        currentPoint.y - activeMove.lastPoint.y,
      );
      activeMove.lastPoint = currentPoint;
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
    selectedAnnotationId,
    pinnedSpecsElement,
    pinSpecs: setPinnedSpecsElement,
    unpinSpecs,
    releaseSpecsPin,
    setSpecsPanelHovered,
    measureAnchorElement,
    measureTargetElement,
    startMeasuring,
    stopMeasuring,
    trackMeasureTarget,
    toggleSpecs,
    toggleRedlines,
    selectTool,
    clearAnnotations,
    removeSelectedAnnotation,
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
