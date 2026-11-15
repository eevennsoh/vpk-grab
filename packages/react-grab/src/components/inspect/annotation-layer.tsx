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
  ANNOTATION_SELECTION_PADDING_PX,
  ANNOTATION_STROKE_WIDTH_PX,
  ANNOTATION_TEXT_FONT_SIZE_PX,
  ANNOTATION_TEXT_LINE_HEIGHT_PX,
  INSPECT_ACCENT_COLOR,
  INSPECT_ACCENT_CONTRAST_COLOR,
  Z_INDEX_OVERLAY,
  Z_INDEX_OVERLAY_CANVAS,
} from "../../constants.js";
import type { AnnotationStroke, AnnotationText, Position } from "../../types.js";
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
  isEditing: boolean;
  selectedAnnotationId: string | null;
  onTextDraftChange: (text: string) => void;
  onTextDraftCommit: (draftPosition: Position) => void;
  onTextDraftCancel: () => void;
}

const TEXT_DRAFT_PADDING_X_PX = 4;
// A halo in the contrast colour keeps the note legible on any page background.
const TEXT_HALO = `0 0 2px ${INSPECT_ACCENT_CONTRAST_COLOR}, 0 0 2px ${INSPECT_ACCENT_CONTRAST_COLOR}, 0 0 1px ${INSPECT_ACCENT_CONTRAST_COLOR}`;

const textBaseStyle = {
  "font-size": `${ANNOTATION_TEXT_FONT_SIZE_PX}px`,
  "line-height": `${ANNOTATION_TEXT_LINE_HEIGHT_PX}px`,
  "font-weight": "600",
  color: INSPECT_ACCENT_COLOR,
};

const stopKeyPropagation = (event: KeyboardEvent) => event.stopPropagation();

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

  const selectedStrokeBounds = createMemo(() => {
    const selectedStroke = props.strokes.find((stroke) => stroke.id === props.selectedAnnotationId);
    return selectedStroke
      ? getAnnotationStrokeBounds(selectedStroke.points, ANNOTATION_SELECTION_PADDING_PX)
      : null;
  });

  // Annotations only take the pointer while they are being rearranged; the
  // rest of the time the page underneath has to stay reachable through them.
  const editingStyle = (hitArea: "all" | "auto"): JSX.CSSProperties =>
    props.isEditing ? { "pointer-events": hitArea, cursor: "move" } : { "pointer-events": "none" };

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
            {(stroke) => (
              <path
                data-react-grab-annotation-stroke={stroke.isStraight ? "straight" : "freehand"}
                data-react-grab-annotation-id={stroke.id}
                data-react-grab-annotation-selected={
                  stroke.id === props.selectedAnnotationId ? "" : undefined
                }
                d={createInkPath(stroke.points, ANNOTATION_STROKE_WIDTH_PX, stroke.isStraight)}
                fill={stroke.color}
                // Invisible, so it only widens what counts as a press on a thin line.
                stroke="transparent"
                stroke-width={ANNOTATION_HIT_WIDTH_PX}
                stroke-linejoin="round"
                style={editingStyle("all")}
              />
            )}
          </For>
          <Show when={selectedStrokeBounds()}>
            {(bounds) => (
              <rect
                data-react-grab-annotation-selection
                x={bounds().left}
                y={bounds().top}
                width={bounds().right - bounds().left}
                height={bounds().bottom - bounds().top}
                rx="4"
                fill="none"
                stroke={INSPECT_ACCENT_COLOR}
                stroke-width="1"
                stroke-dasharray="4 3"
              />
            )}
          </Show>
          <Show when={props.draftStroke}>
            {(draftStroke) => (
              <path
                data-react-grab-annotation-draft
                fill={draftStroke().color}
                d={createInkPath(
                  draftStroke().points,
                  ANNOTATION_STROKE_WIDTH_PX,
                  draftStroke().isStraight,
                )}
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
              data-react-grab-annotation-selected={
                annotationText.id === props.selectedAnnotationId ? "" : undefined
              }
              class="absolute whitespace-pre rounded-[3px]"
              style={{
                ...textBaseStyle,
                ...editingStyle("auto"),
                left: `${annotationText.x}px`,
                top: textTop(annotationText.y),
                "text-shadow": TEXT_HALO,
                outline:
                  annotationText.id === props.selectedAnnotationId
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
                "background-color": INSPECT_ACCENT_CONTRAST_COLOR,
                outline: `1.5px solid ${INSPECT_ACCENT_COLOR}`,
                "caret-color": INSPECT_ACCENT_COLOR,
              }}
              onInput={(event) => props.onTextDraftChange(event.currentTarget.value)}
              onBlur={() => props.onTextDraftCommit(draftPosition)}
              on:keydown={(event) => {
                // Kept inside the overlay: the page's own shortcuts must not
                // fire for keys typed into a note.
                event.stopPropagation();
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
