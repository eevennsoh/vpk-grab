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
  ANNOTATION_HIT_WIDTH_PX,
  ANNOTATION_MARQUEE_FILL_OPACITY,
  ANNOTATION_SELECTION_PADDING_PX,
  ANNOTATION_STROKE_WIDTH_PX,
  ANNOTATION_TEXT_FONT_SIZE_PX,
  ANNOTATION_TEXT_FONT_WEIGHT,
  ANNOTATION_TEXT_HALO_BLURS_PX,
  ANNOTATION_TEXT_LINE_HEIGHT_PX,
  INSPECT_ACCENT_COLOR,
  INSPECT_ACCENT_CONTRAST_COLOR,
  MOVE_TOOL_CURSOR,
  MOVE_TOOL_PRESSED_CURSOR,
  Z_INDEX_OVERLAY,
  Z_INDEX_OVERLAY_CANVAS,
} from "../../constants.js";
import type { AnnotationStroke, AnnotationText, Position, Rect } from "../../types.js";
import { getToolCycleDirection } from "../../utils/get-tool-cycle-direction.js";
import { focusInOverlay } from "../../utils/focus-in-overlay.js";
import { getAnnotationStrokeBounds } from "../../utils/get-annotation-stroke-bounds.js";
import { createInkPath } from "../../utils/ink-path.js";
import { isKeyboardEventComposing } from "../../utils/is-keyboard-event-composing.js";
import { nativeRequestAnimationFrame } from "../../utils/native-raf.js";

interface AnnotationLayerProps {
  strokes: AnnotationStroke[];
  draftStroke: AnnotationStroke | null;
  texts: AnnotationText[];
  textDraftPosition: Position | null;
  annotationColor: string;
  isEditing: boolean;
  isEditPressing: boolean;
  selectedAnnotationIds: string[];
  marqueeRect: Rect | null;
  onTextDraftChange: (text: string) => void;
  onTextDraftCommit: (draftPosition: Position) => void;
  onTextDraftCancel: () => void;
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

const stopKeyPropagation = (event: KeyboardEvent) => {
  if (!getToolCycleDirection(event)) event.stopPropagation();
};

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

  const selectedStrokeBounds = createMemo(() => {
    const boundsList: Rect[] = [];
    for (const stroke of props.strokes) {
      if (!isSelected(stroke.id)) continue;
      const bounds = getAnnotationStrokeBounds(stroke.points, ANNOTATION_SELECTION_PADDING_PX);
      if (bounds) boundsList.push(bounds);
    }
    return boundsList;
  });

  // Annotations only take the pointer while they are being rearranged; the
  // rest of the time the page underneath has to stay reachable through them.
  // They sit in the shadow root, out of reach of the page's cursor override,
  // so they carry the Move tool's hand themselves.
  const editingStyle = (hitArea: "all" | "auto" | "stroke"): JSX.CSSProperties =>
    props.isEditing
      ? {
          "pointer-events": hitArea,
          cursor: props.isEditPressing ? MOVE_TOOL_PRESSED_CURSOR : MOVE_TOOL_CURSOR,
        }
      : { "pointer-events": "none" };

  const pageTransform = () => `translate(${-scrollOffset().x}px, ${-scrollOffset().y}px)`;
  const textTop = (pageY: number) => `${pageY - ANNOTATION_TEXT_LINE_HEIGHT_PX / 2}px`;

  return (
    <>
      <svg
        data-react-grab-annotations
        aria-hidden="true"
        class="fixed top-0 left-0 pointer-events-none overflow-visible"
        width="1"
        height="1"
        style={{ "z-index": String(Z_INDEX_OVERLAY_CANVAS) }}
      >
        <g style={{ transform: pageTransform() }}>
          <For each={props.strokes}>
            {(stroke) => {
              const strokePath = createInkPath(
                stroke.points,
                ANNOTATION_STROKE_WIDTH_PX,
                stroke.isStraight,
                stroke.isRectangle,
              );
              return (
                <>
                  <path
                    data-react-grab-annotation-stroke={
                      stroke.isRectangle ? "rectangle" : stroke.isStraight ? "straight" : "freehand"
                    }
                    data-react-grab-annotation-id={stroke.id}
                    data-react-grab-annotation-selected={isSelected(stroke.id) ? "" : undefined}
                    d={strokePath}
                    fill={stroke.isRectangle ? "none" : stroke.color}
                    stroke={stroke.isRectangle ? stroke.color : "transparent"}
                    stroke-width={
                      stroke.isRectangle ? ANNOTATION_STROKE_WIDTH_PX : ANNOTATION_HIT_WIDTH_PX
                    }
                    stroke-linejoin="round"
                    style={editingStyle(stroke.isRectangle ? "stroke" : "all")}
                  />
                  <Show when={stroke.isRectangle}>
                    <path
                      data-react-grab-annotation-id={stroke.id}
                      d={strokePath}
                      fill="none"
                      stroke="transparent"
                      stroke-width={ANNOTATION_HIT_WIDTH_PX}
                      stroke-linejoin="round"
                      style={editingStyle("stroke")}
                    />
                  </Show>
                </>
              );
            }}
          </For>
          <For each={selectedStrokeBounds()}>
            {(bounds) => (
              <rect
                data-react-grab-annotation-selection
                x={bounds.left}
                y={bounds.top}
                width={bounds.right - bounds.left}
                height={bounds.bottom - bounds.top}
                rx="4"
                fill="none"
                stroke={INSPECT_ACCENT_COLOR}
                stroke-width="1"
                stroke-dasharray="4 3"
              />
            )}
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
        style={{ transform: pageTransform(), "z-index": String(Z_INDEX_OVERLAY_CANVAS) }}
      >
        <For each={props.texts}>
          {(annotationText) => (
            <div
              data-react-grab-annotation-text
              data-react-grab-annotation-id={annotationText.id}
              data-react-grab-annotation-selected={isSelected(annotationText.id) ? "" : undefined}
              class="absolute whitespace-pre rounded-[3px]"
              style={{
                ...textBaseStyle,
                ...editingStyle("auto"),
                left: `${annotationText.x}px`,
                top: textTop(annotationText.y),
                color: annotationText.color,
                "text-shadow": TEXT_HALO,
                outline: isSelected(annotationText.id)
                  ? `1px dashed ${INSPECT_ACCENT_COLOR}`
                  : "none",
                "outline-offset": `${ANNOTATION_SELECTION_PADDING_PX - 2}px`,
              }}
              textContent={annotationText.text}
            />
          )}
        </For>
      </div>
      <Show when={props.textDraftPosition} keyed>
        {(draftPosition) => (
          <div
            class="fixed top-0 left-0 font-sans"
            style={{ transform: pageTransform(), "z-index": String(Z_INDEX_OVERLAY) }}
          >
            <input
              ref={(element) => {
                // The ref fires before the input is attached, where focus()
                // is a no-op, so focus waits a microtask: soon enough that the
                // first key typed lands in the note. The frame after is a
                // second chance for browsers that still move focus to the
                // page on the press that placed the note.
                const focusDraftInput = () => {
                  if (element.isConnected && !element.matches(":focus")) {
                    focusInOverlay(element, { preventScroll: true });
                  }
                };
                queueMicrotask(focusDraftInput);
                nativeRequestAnimationFrame(focusDraftInput);
              }}
              data-react-grab-ignore-events
              data-react-grab-annotation-input
              type="text"
              aria-label="Annotation text"
              aria-keyshortcuts="Enter Escape"
              autocomplete="off"
              spellcheck={false}
              class="absolute pointer-events-auto m-0 border-none rounded-[3px] font-sans"
              style={{
                ...textBaseStyle,
                left: `${draftPosition.x - TEXT_DRAFT_PADDING_X_PX}px`,
                top: textTop(draftPosition.y),
                height: `${ANNOTATION_TEXT_LINE_HEIGHT_PX}px`,
                padding: `0 ${TEXT_DRAFT_PADDING_X_PX}px`,
                "min-width": "80px",
                "field-sizing": "content",
                color: props.annotationColor,
                "background-color": INSPECT_ACCENT_CONTRAST_COLOR,
                outline: `1.5px solid ${props.annotationColor}`,
                "caret-color": props.annotationColor,
              }}
              onInput={(event) => props.onTextDraftChange(event.currentTarget.value)}
              onBlur={() => props.onTextDraftCommit(draftPosition)}
              on:keydown={(event) => {
                // Kept inside the overlay: the page's own shortcuts must not
                // fire for keys typed into a note.
                stopKeyPropagation(event);
                if (isKeyboardEventComposing(event)) return;
                if (event.key === "Enter") {
                  event.preventDefault();
                  props.onTextDraftCommit(draftPosition);
                } else if (event.key === "Escape") {
                  event.preventDefault();
                  props.onTextDraftCancel();
                }
              }}
              on:keyup={stopKeyPropagation}
              on:keypress={stopKeyPropagation}
            />
          </div>
        )}
      </Show>
    </>
  );
};
