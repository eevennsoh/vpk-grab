import {
  createMemo,
  createSignal,
  For,
  onCleanup,
  onMount,
  Show,
  type Component,
  type JSX,
} from "solid-js";
import {
  ANNOTATION_HANDLE_HIT_SIZE_PX,
  ANNOTATION_HANDLE_SIZE_PX,
  ANNOTATION_HIT_WIDTH_PX,
  ANNOTATION_ITEM_OUTLINE_PADDING_PX,
  ANNOTATION_MARQUEE_FILL_OPACITY,
  ANNOTATION_ROTATE_ZONE_SIZE_PX,
  ANNOTATION_SELECTION_PADDING_PX,
  ANNOTATION_STROKE_WIDTH_PX,
  ANNOTATION_TEXT_FONT_SIZE_PX,
  ANNOTATION_TEXT_FONT_WEIGHT,
  ANNOTATION_TEXT_HALO_BLURS_PX,
  ANNOTATION_TEXT_LINE_HEIGHT_PX,
  INSPECT_ACCENT_COLOR,
  INSPECT_ACCENT_CONTRAST_COLOR,
  Z_INDEX_OVERLAY,
  Z_INDEX_OVERLAY_CANVAS,
  PAUSED_LAYER_TRANSITION,
  PAUSED_PAGE_LAYER_OPACITY,
  TEXT_TOOL_CURSOR,
} from "../../constants.js";
import type {
  AnnotationFrame,
  AnnotationSelectionFrame,
  AnnotationStroke,
  AnnotationText,
  AnnotationTextDraft,
  AnnotationTransformHandle,
  AnnotationTransformLabel,
  Position,
  Rect,
} from "../../types.js";
import { focusInOverlay } from "../../utils/focus-in-overlay.js";
import { getAnnotationColorForKey } from "../../utils/get-annotation-color-for-key.js";
import { getAnnotationStrokeFrame } from "../../utils/get-annotation-stroke-frame.js";
import { getAnnotationTextFrame } from "../../utils/get-annotation-text-frame.js";
import { getAnnotationTextLines } from "../../utils/get-annotation-text-lines.js";
import { getResizeCursor } from "../../utils/get-resize-cursor.js";
import { getRotateCursor } from "../../utils/get-rotate-cursor.js";
import { createInkPath } from "../../utils/ink-path.js";
import { isBareKeyPress } from "../../utils/is-bare-key-press.js";
import { isKeyboardEventComposing } from "../../utils/is-keyboard-event-composing.js";
import { measureAnnotationTextWidth } from "../../utils/measure-annotation-text-width.js";
import { nativeRequestAnimationFrame } from "../../utils/native-raf.js";

interface AnnotationLayerProps {
  strokes: AnnotationStroke[];
  draftStroke: AnnotationStroke | null;
  texts: AnnotationText[];
  textDraft: AnnotationTextDraft | null;
  annotationColor: string;
  isEditing: boolean;
  isTextToolActive: boolean;
  editCursor: string;
  isTransforming: boolean;
  selectionFrame: AnnotationSelectionFrame | null;
  selectedAnnotationFrames: AnnotationFrame[];
  getPreviewStroke: (stroke: AnnotationStroke) => AnnotationStroke;
  getPreviewText: (annotationText: AnnotationText) => AnnotationText;
  transformLabel: AnnotationTransformLabel | null;
  selectedAnnotationIds: string[];
  marqueeRect: Rect | null;
  onTextDraftChange: (text: string) => void;
  onTextDraftCommit: (draft: AnnotationTextDraft) => void;
  onTextDraftCancel: () => void;
  onSelectAnnotationColor: (color: string) => void;
  isPaused: boolean;
}

interface ItemOutlineProps {
  frame: AnnotationFrame;
  isHover?: boolean;
}

const TEXT_DRAFT_PADDING_X_PX = 4;
const TEXT_HALO = ANNOTATION_TEXT_HALO_BLURS_PX.map(
  (blurPx) => `0 0 ${blurPx}px ${INSPECT_ACCENT_CONTRAST_COLOR}`,
).join(", ");

const textBaseStyle = {
  "font-size": `${ANNOTATION_TEXT_FONT_SIZE_PX}px`,
  "line-height": `${ANNOTATION_TEXT_LINE_HEIGHT_PX}px`,
  "font-weight": String(ANNOTATION_TEXT_FONT_WEIGHT),
};

const RADIANS_TO_DEGREES = 180 / Math.PI;

const stopKeyPropagation = (event: KeyboardEvent) => event.stopPropagation();

const getFrameTransform = (frame: AnnotationFrame) =>
  `translate(${frame.centerX} ${frame.centerY}) rotate(${frame.rotation * RADIANS_TO_DEGREES})`;

const getStrokeTransform = (stroke: AnnotationStroke): string | undefined => {
  if (stroke.rotation === 0) return undefined;
  const frame = getAnnotationStrokeFrame(stroke);
  return `rotate(${stroke.rotation * RADIANS_TO_DEGREES} ${frame.centerX} ${frame.centerY})`;
};

const getHandleCenter = (frame: AnnotationFrame, handle: AnnotationTransformHandle): Position => ({
  x: handle.directionX * (frame.width / 2 + ANNOTATION_SELECTION_PADDING_PX),
  y: handle.directionY * (frame.height / 2 + ANNOTATION_SELECTION_PADDING_PX),
});

// The square around a corner less the quarter that lies inside the frame, so
// the pointer only turns into the rotate cursor just outside the corner.
const getRotateZonePath = (frame: AnnotationFrame, handle: AnnotationTransformHandle): string => {
  const corner = getHandleCenter(frame, handle);
  const outwardX = handle.directionX * ANNOTATION_ROTATE_ZONE_SIZE_PX;
  const outwardY = handle.directionY * ANNOTATION_ROTATE_ZONE_SIZE_PX;
  return [
    `M${corner.x + outwardX} ${corner.y + outwardY}`,
    `L${corner.x - outwardX} ${corner.y + outwardY}`,
    `L${corner.x - outwardX} ${corner.y}`,
    `L${corner.x} ${corner.y}`,
    `L${corner.x} ${corner.y - outwardY}`,
    `L${corner.x + outwardX} ${corner.y - outwardY}`,
    "Z",
  ].join("");
};

const getTextTransformStyle = (
  annotationText: AnnotationText,
  getTransformOrigin: () => string,
): JSX.CSSProperties => {
  if (annotationText.rotation === 0 && annotationText.scale === 1) return {};
  return {
    transform: `rotate(${annotationText.rotation}rad) scale(${annotationText.scale})`,
    "transform-origin": getTransformOrigin(),
  };
};

const getTextCenterOrigin = (annotationText: AnnotationText, offsetX: number): string => {
  const baseWidth = measureAnnotationTextWidth(annotationText);
  const baseHeight = getAnnotationTextLines(annotationText).length * ANNOTATION_TEXT_LINE_HEIGHT_PX;
  return `${offsetX + baseWidth / 2}px ${baseHeight / 2}px`;
};

const ItemOutline: Component<ItemOutlineProps> = (props) => (
  <rect
    data-react-grab-annotation-item-outline={props.isHover ? undefined : ""}
    data-react-grab-annotation-hover-outline={props.isHover ? "" : undefined}
    transform={getFrameTransform(props.frame)}
    x={-props.frame.width / 2 - ANNOTATION_ITEM_OUTLINE_PADDING_PX}
    y={-props.frame.height / 2 - ANNOTATION_ITEM_OUTLINE_PADDING_PX}
    width={props.frame.width + ANNOTATION_ITEM_OUTLINE_PADDING_PX * 2}
    height={props.frame.height + ANNOTATION_ITEM_OUTLINE_PADDING_PX * 2}
    fill="none"
    stroke={INSPECT_ACCENT_COLOR}
    stroke-width="1"
  />
);

export const AnnotationLayer: Component<AnnotationLayerProps> = (props) => {
  const [scrollOffset, setScrollOffset] = createSignal<Position>({
    x: window.scrollX,
    y: window.scrollY,
  });

  onMount(() => {
    const syncScrollOffset = () => setScrollOffset({ x: window.scrollX, y: window.scrollY });
    window.addEventListener("scroll", syncScrollOffset, { passive: true });
    window.addEventListener("resize", syncScrollOffset, { passive: true });
    onCleanup(() => {
      window.removeEventListener("scroll", syncScrollOffset);
      window.removeEventListener("resize", syncScrollOffset);
    });
  });

  const draftStrokePath = createMemo(() => {
    const stroke = props.draftStroke;
    return stroke
      ? createInkPath(
          stroke.points,
          ANNOTATION_STROKE_WIDTH_PX,
          stroke.isStraight,
          stroke.isRectangle,
        )
      : "";
  });

  const selectedIds = createMemo(() => new Set(props.selectedAnnotationIds));
  const isSelected = (annotationId: string) => selectedIds().has(annotationId);

  // Each item of a group shows a thin outline of its own inside the group's
  // frame; a single item is outlined by the frame itself.
  const itemOutlineFrames = createMemo(() =>
    props.selectedAnnotationFrames.length > 1 ? props.selectedAnnotationFrames : [],
  );

  // Under Move, whatever a press would pick up is outlined before the press.
  const [hoveredAnnotationId, setHoveredAnnotationId] = createSignal<string | null>(null);
  const clearHoveredAnnotation = (annotationId: string) =>
    setHoveredAnnotationId((previousId) => (previousId === annotationId ? null : previousId));
  const hoverOutlineFrame = createMemo((): AnnotationFrame | null => {
    const annotationId = hoveredAnnotationId();
    if (!annotationId || !props.isEditing || props.isPaused) return null;
    if (props.isTransforming || props.marqueeRect || isSelected(annotationId)) return null;
    const stroke = props.strokes.find((innerStroke) => innerStroke.id === annotationId);
    if (stroke) return getAnnotationStrokeFrame(stroke);
    const annotationText = props.texts.find((innerText) => innerText.id === annotationId);
    return annotationText
      ? getAnnotationTextFrame(annotationText, measureAnnotationTextWidth(annotationText))
      : null;
  });

  // Annotations only take the pointer while they are being rearranged; the
  // rest of the time the page underneath has to stay reachable through them.
  // They sit in the shadow root, out of reach of the page's cursor override,
  // so they carry the Move tool's cursor themselves.
  const editingStyle = (hitArea: "all" | "auto" | "stroke"): JSX.CSSProperties =>
    props.isEditing && !props.isPaused
      ? { "pointer-events": hitArea, cursor: props.editCursor }
      : { "pointer-events": "none" };

  const textHitStyle = (annotationText: AnnotationText): JSX.CSSProperties => {
    if (props.textDraft?.sourceText?.id === annotationText.id) return { visibility: "hidden" };
    if (props.isTextToolActive && !props.isPaused) {
      return {
        "pointer-events": "auto",
        cursor: TEXT_TOOL_CURSOR,
        "outline-color": annotationText.color,
      };
    }
    return editingStyle("auto");
  };

  const handleStyle = (handleCursor: string): JSX.CSSProperties =>
    props.isPaused
      ? { "pointer-events": "none" }
      : {
          "pointer-events": "all",
          cursor: props.isTransforming ? props.editCursor : handleCursor,
        };

  const pageTransform = () => `translate(${-scrollOffset().x}px, ${-scrollOffset().y}px)`;
  const layerOpacity = () => (props.isPaused ? PAUSED_PAGE_LAYER_OPACITY : 1);
  const textTop = (pageY: number) => `${pageY - ANNOTATION_TEXT_LINE_HEIGHT_PX / 2}px`;

  return (
    <>
      <svg
        data-react-grab-annotations
        aria-hidden="true"
        class="fixed top-0 left-0 pointer-events-none overflow-visible"
        width="1"
        height="1"
        style={{
          "z-index": String(Z_INDEX_OVERLAY_CANVAS),
          opacity: layerOpacity(),
          transition: PAUSED_LAYER_TRANSITION,
        }}
      >
        <g style={{ transform: pageTransform() }}>
          <For each={props.strokes}>
            {(stroke) => {
              const previewStroke = () => props.getPreviewStroke(stroke);
              const strokePath = createMemo(() =>
                createInkPath(
                  previewStroke().points,
                  ANNOTATION_STROKE_WIDTH_PX,
                  stroke.isStraight,
                  stroke.isRectangle,
                ),
              );
              const strokeTransform = createMemo(() => getStrokeTransform(previewStroke()));
              return (
                <>
                  <path
                    data-react-grab-annotation-stroke={
                      stroke.isRectangle ? "rectangle" : stroke.isStraight ? "straight" : "freehand"
                    }
                    data-react-grab-annotation-id={stroke.id}
                    data-react-grab-annotation-selected={isSelected(stroke.id) ? "" : undefined}
                    d={strokePath()}
                    fill={stroke.isRectangle ? "none" : stroke.color}
                    stroke={stroke.isRectangle ? stroke.color : "transparent"}
                    stroke-width={
                      stroke.isRectangle ? ANNOTATION_STROKE_WIDTH_PX : ANNOTATION_HIT_WIDTH_PX
                    }
                    stroke-linejoin="round"
                    transform={strokeTransform()}
                    style={editingStyle(stroke.isRectangle ? "stroke" : "all")}
                    onPointerEnter={() => setHoveredAnnotationId(stroke.id)}
                    onPointerLeave={() => clearHoveredAnnotation(stroke.id)}
                  />
                  <Show when={stroke.isRectangle}>
                    <path
                      data-react-grab-annotation-id={stroke.id}
                      d={strokePath()}
                      transform={strokeTransform()}
                      fill="none"
                      stroke="transparent"
                      stroke-width={ANNOTATION_HIT_WIDTH_PX}
                      stroke-linejoin="round"
                      style={editingStyle("stroke")}
                      onPointerEnter={() => setHoveredAnnotationId(stroke.id)}
                      onPointerLeave={() => clearHoveredAnnotation(stroke.id)}
                    />
                  </Show>
                </>
              );
            }}
          </For>
          <Show when={props.draftStroke}>
            {(draftStroke) => (
              <path
                data-react-grab-annotation-draft
                fill={draftStroke().isRectangle ? "none" : draftStroke().color}
                stroke={draftStroke().isRectangle ? draftStroke().color : undefined}
                stroke-width={ANNOTATION_STROKE_WIDTH_PX}
                stroke-linejoin="round"
                d={draftStrokePath()}
              />
            )}
          </Show>
          <Show when={props.marqueeRect}>
            {(marqueeRect) => (
              <rect
                data-react-grab-annotation-marquee
                x={marqueeRect().left}
                y={marqueeRect().top}
                width={marqueeRect().right - marqueeRect().left}
                height={marqueeRect().bottom - marqueeRect().top}
                fill-opacity={ANNOTATION_MARQUEE_FILL_OPACITY}
                stroke={INSPECT_ACCENT_COLOR}
                stroke-width="1"
              />
            )}
          </Show>
        </g>
      </svg>
      <div
        class="fixed top-0 left-0 font-sans pointer-events-none select-none"
        style={{
          transform: pageTransform(),
          "z-index": String(Z_INDEX_OVERLAY_CANVAS),
          opacity: layerOpacity(),
          transition: PAUSED_LAYER_TRANSITION,
        }}
      >
        <For each={props.texts}>
          {(annotationText) => {
            const previewText = () => props.getPreviewText(annotationText);
            let transformOrigin: string | undefined;
            const getTransformOrigin = () => {
              transformOrigin ??= getTextCenterOrigin(annotationText, 0);
              return transformOrigin;
            };
            return (
              <div
                data-react-grab-annotation-text
                data-react-grab-annotation-id={annotationText.id}
                data-react-grab-annotation-selected={isSelected(annotationText.id) ? "" : undefined}
                class="absolute whitespace-pre rounded-[3px]"
                classList={{
                  "hover:outline-[1.5px] hover:outline-dashed hover:outline-offset-2":
                    props.isTextToolActive && !props.isPaused,
                }}
                style={{
                  ...textBaseStyle,
                  ...textHitStyle(annotationText),
                  ...getTextTransformStyle(previewText(), getTransformOrigin),
                  left: `${previewText().x}px`,
                  top: textTop(previewText().y),
                  color: annotationText.color,
                  "text-shadow": TEXT_HALO,
                }}
                textContent={annotationText.text}
                onPointerEnter={() => setHoveredAnnotationId(annotationText.id)}
                onPointerLeave={() => clearHoveredAnnotation(annotationText.id)}
              />
            );
          }}
        </For>
      </div>
      <svg
        data-react-grab-annotation-frame
        aria-hidden="true"
        class="fixed top-0 left-0 pointer-events-none overflow-visible"
        width="1"
        height="1"
        style={{
          "z-index": String(Z_INDEX_OVERLAY_CANVAS),
          visibility: props.isPaused ? "hidden" : undefined,
        }}
      >
        <g style={{ transform: pageTransform() }}>
          <For each={itemOutlineFrames()}>{(itemFrame) => <ItemOutline frame={itemFrame} />}</For>
          <Show when={hoverOutlineFrame()}>
            {(frame) => <ItemOutline frame={frame()} isHover />}
          </Show>
          <Show when={props.selectionFrame}>
            {(frame) => (
              <g transform={getFrameTransform(frame())}>
                <rect
                  data-react-grab-annotation-selection
                  x={-frame().width / 2 - ANNOTATION_SELECTION_PADDING_PX}
                  y={-frame().height / 2 - ANNOTATION_SELECTION_PADDING_PX}
                  width={frame().width + ANNOTATION_SELECTION_PADDING_PX * 2}
                  height={frame().height + ANNOTATION_SELECTION_PADDING_PX * 2}
                  fill="none"
                  stroke={INSPECT_ACCENT_COLOR}
                  stroke-width="1"
                />
                <For each={frame().rotateHandles}>
                  {(handle) => (
                    <path
                      data-react-grab-annotation-rotate-handle={handle.name}
                      d={getRotateZonePath(frame(), handle)}
                      fill="transparent"
                      style={handleStyle(
                        getRotateCursor(handle.directionX, handle.directionY, frame().rotation),
                      )}
                    />
                  )}
                </For>
                <For each={frame().resizeHandles}>
                  {(handle) => (
                    <>
                      <rect
                        data-react-grab-annotation-resize-handle={handle.name}
                        x={getHandleCenter(frame(), handle).x - ANNOTATION_HANDLE_HIT_SIZE_PX / 2}
                        y={getHandleCenter(frame(), handle).y - ANNOTATION_HANDLE_HIT_SIZE_PX / 2}
                        width={ANNOTATION_HANDLE_HIT_SIZE_PX}
                        height={ANNOTATION_HANDLE_HIT_SIZE_PX}
                        fill="transparent"
                        style={handleStyle(
                          getResizeCursor(handle.directionX, handle.directionY, frame().rotation),
                        )}
                      />
                      <rect
                        data-react-grab-annotation-handle
                        x={getHandleCenter(frame(), handle).x - ANNOTATION_HANDLE_SIZE_PX / 2}
                        y={getHandleCenter(frame(), handle).y - ANNOTATION_HANDLE_SIZE_PX / 2}
                        width={ANNOTATION_HANDLE_SIZE_PX}
                        height={ANNOTATION_HANDLE_SIZE_PX}
                        fill="white"
                        stroke={INSPECT_ACCENT_COLOR}
                        stroke-width="1"
                      />
                    </>
                  )}
                </For>
              </g>
            )}
          </Show>
        </g>
      </svg>
      <Show when={props.transformLabel}>
        {(label) => (
          <div
            class="fixed top-0 left-0 pointer-events-none"
            style={{ transform: pageTransform(), "z-index": String(Z_INDEX_OVERLAY_CANVAS) }}
          >
            <span
              data-react-grab-annotation-transform-label
              class="absolute whitespace-nowrap rounded-[3px] px-1 font-sans text-[11px] leading-4 font-medium tabular-nums"
              style={{
                left: `${label().pageX}px`,
                top: `${label().pageY}px`,
                color: INSPECT_ACCENT_CONTRAST_COLOR,
                "background-color": INSPECT_ACCENT_COLOR,
              }}
              textContent={label().text}
            />
          </div>
        )}
      </Show>
      <Show when={props.textDraft} keyed>
        {(draft) => {
          const sourceText = draft.sourceText;
          const draftColor = () => sourceText?.color ?? props.annotationColor;
          const sourceTransformStyle = sourceText
            ? getTextTransformStyle(sourceText, () =>
                getTextCenterOrigin(sourceText, TEXT_DRAFT_PADDING_X_PX),
              )
            : {};
          return (
            <div
              class="fixed top-0 left-0 font-sans"
              style={{ transform: pageTransform(), "z-index": String(Z_INDEX_OVERLAY) }}
            >
              <textarea
                ref={(element) => {
                  // The ref fires before the input is attached, where focus()
                  // is a no-op, so focus waits a microtask: soon enough that the
                  // first key typed lands in the note. The frame after is a
                  // second chance for browsers that still move focus to the
                  // page on the press that placed the note.
                  const focusDraftInput = () => {
                    if (element.isConnected && !element.matches(":focus")) {
                      focusInOverlay(element, { preventScroll: true });
                      if (sourceText) element.select();
                    }
                  };
                  queueMicrotask(focusDraftInput);
                  nativeRequestAnimationFrame(focusDraftInput);
                }}
                data-react-grab-ignore-events
                data-react-grab-annotation-input
                rows={1}
                value={sourceText?.text ?? ""}
                aria-label="Annotation text"
                aria-keyshortcuts="Enter Shift+Enter Escape"
                autocomplete="off"
                spellcheck={false}
                class="absolute block pointer-events-auto m-0 border-none rounded-[3px] font-sans resize-none overflow-hidden whitespace-pre"
                style={{
                  ...textBaseStyle,
                  ...sourceTransformStyle,
                  left: `${draft.x - TEXT_DRAFT_PADDING_X_PX}px`,
                  top: textTop(draft.y),
                  "min-height": `${ANNOTATION_TEXT_LINE_HEIGHT_PX}px`,
                  padding: `0 ${TEXT_DRAFT_PADDING_X_PX}px`,
                  "min-width": "80px",
                  "field-sizing": "content",
                  color: draftColor(),
                  "background-color": INSPECT_ACCENT_CONTRAST_COLOR,
                  outline: `1.5px solid ${draftColor()}`,
                  "caret-color": draftColor(),
                }}
                onInput={(event) => props.onTextDraftChange(event.currentTarget.value)}
                onBlur={() => props.onTextDraftCommit(draft)}
                on:keydown={(event) => {
                  // Kept inside the overlay: the page's own shortcuts must not
                  // fire for keys typed into a note.
                  event.stopPropagation();
                  if (isKeyboardEventComposing(event)) return;
                  // Until the first character is typed, a new note's number keys
                  // still pick its color, as they do anywhere else under Text.
                  const keyColor =
                    !sourceText && event.currentTarget.value === "" && isBareKeyPress(event)
                      ? getAnnotationColorForKey(event.key)
                      : undefined;
                  if (keyColor) {
                    event.preventDefault();
                    props.onSelectAnnotationColor(keyColor);
                    return;
                  }
                  // Shift+Enter falls through to the textarea and starts a new line.
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    props.onTextDraftCommit(draft);
                  } else if (event.key === "Escape") {
                    event.preventDefault();
                    props.onTextDraftCancel();
                  }
                }}
                on:keyup={stopKeyPropagation}
                on:keypress={stopKeyPropagation}
              />
            </div>
          );
        }}
      </Show>
    </>
  );
};
