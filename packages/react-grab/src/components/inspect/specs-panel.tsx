import { createEffect, createMemo, createSignal, For, on, Show, type Component } from "solid-js";
import {
  SPECS_PANEL_FALLBACK_HEIGHT_PX,
  SPECS_PANEL_MARGIN_PX,
  SPECS_PANEL_WIDTH_PX,
  Z_INDEX_OVERLAY,
} from "../../constants.js";
import type {
  ElementSpecRow,
  ElementSpecs,
  Position,
  Rect,
  SpecsPanelCorner,
} from "../../types.js";
import { cn } from "../../utils/cn.js";
import { createElementBounds } from "../../utils/create-element-bounds.js";
import { getElementSpecs } from "../../utils/get-element-specs.js";
import { getSpecsPanelCorner } from "../../utils/get-specs-panel-corner.js";
import { getVisualViewport } from "../../utils/get-visual-viewport.js";
import { overlayBoundsToRect } from "../../utils/overlay-bounds-to-rect.js";
import {
  canOverrideSpecs,
  disableSpec,
  enableAllSpecs,
  enableSpec,
} from "../../utils/spec-overrides.js";
import { Surface } from "../ui/surface.js";

interface SpecsPanelProps {
  element: Element | null;
  componentName?: string;
  measureTarget: Element | null;
  pointer: Position;
  viewportVersion: number;
  isPinned: boolean;
  onHoverChange: (isHovered: boolean) => void;
  onStylesChange: () => void;
}

const HEADER_HEIGHT_PX = 44;
const SECTION_TITLE_HEIGHT_PX = 24;
const ROW_HEIGHT_PX = 18;
const TOKEN_HEIGHT_PX = 14;
const FOOTER_HEIGHT_PX = 27;

const estimateSingleColumnHeight = (specs: ElementSpecs): number =>
  specs.sections.reduce(
    (totalHeight, section) =>
      section.rows.reduce(
        (sectionHeight, row) =>
          sectionHeight + ROW_HEIGHT_PX + (row.tokens?.length ?? 0) * TOKEN_HEIGHT_PX,
        totalHeight + SECTION_TITLE_HEIGHT_PX,
      ),
    HEADER_HEIGHT_PX + FOOTER_HEIGHT_PX,
  );

// Click-through while it follows the hover: the panel answers "what is applied
// here" for whatever is under the pointer, including UI that only exists while
// hovered, so it may not ask for the pointer. Holding Shift pins it to the
// element it is showing; only then does it take the pointer, and its applied
// rows become switches.
export const SpecsPanel: Component<SpecsPanelProps> = (props) => {
  let panelRef: HTMLDivElement | undefined;
  const [panelHeight, setPanelHeight] = createSignal(SPECS_PANEL_FALLBACK_HEIGHT_PX);
  const [overrideVersion, setOverrideVersion] = createSignal(0);

  const specs = createMemo(() => {
    void overrideVersion();
    return props.element ? getElementSpecs(props.element) : null;
  });

  const isEditable = () =>
    props.isPinned && props.element !== null && canOverrideSpecs(props.element);
  const hasDisabledRows = () =>
    specs()?.sections.some((section) => section.rows.some((row) => row.isDisabled)) ?? false;

  const notifyStylesChanged = () => {
    setOverrideVersion((version) => version + 1);
    props.onStylesChange();
  };

  const toggleRow = (sectionTitle: string, rowIndex: number, row: ElementSpecRow) => {
    const element = props.element;
    if (!element) return;
    if (row.isDisabled) enableSpec(element, row.property);
    else disableSpec(element, { sectionTitle, rowIndex, row });
    notifyStylesChanged();
  };

  const resetRows = () => {
    if (!props.element) return;
    enableAllSpecs(props.element);
    notifyStylesChanged();
  };

  // Keeps the press from moving the page's focus or extending its text
  // selection (Shift is usually still held).
  const preventPress = (event: MouseEvent) => event.preventDefault();

  const viewport = createMemo(() => {
    void props.viewportVersion;
    return getVisualViewport();
  });

  // The panel cannot scroll, so a viewport too short for one column gets two.
  const isTwoColumn = createMemo(() => {
    const currentSpecs = specs();
    if (!currentSpecs) return false;
    return estimateSingleColumnHeight(currentSpecs) > viewport().height - SPECS_PANEL_MARGIN_PX * 2;
  });

  const panelWidth = () => (isTwoColumn() ? SPECS_PANEL_WIDTH_PX * 2 : SPECS_PANEL_WIDTH_PX);

  const avoidRects = createMemo((): Rect[] => {
    void props.viewportVersion;
    const element = props.element;
    if (!element) return [];
    const rects: Rect[] = [overlayBoundsToRect(createElementBounds(element))];
    // The far end of a measurement is where the pointer is, and it is being
    // read just as much as the element the panel describes.
    if (props.measureTarget) {
      rects.push(overlayBoundsToRect(createElementBounds(props.measureTarget)));
    }
    const toolbarRect = panelRef?.parentElement
      ?.querySelector("[data-react-grab-toolbar]")
      ?.getBoundingClientRect();
    if (toolbarRect) rects.push(toolbarRect);
    return rects;
  });

  // A pinned panel is being reached for and clicked in, so it holds its
  // corner even when a toggled property resizes the element underneath it.
  const corner = createMemo<SpecsPanelCorner>(
    (currentCorner) =>
      props.isPinned
        ? currentCorner
        : getSpecsPanelCorner({
            viewportWidth: viewport().width,
            viewportHeight: viewport().height,
            panelWidth: panelWidth(),
            panelHeight: panelHeight(),
            margin: SPECS_PANEL_MARGIN_PX,
            currentCorner,
            pointer: props.pointer,
            avoidRects: avoidRects(),
          }),
    "top-right",
  );

  createEffect(
    on([specs, isTwoColumn], () => {
      if (panelRef && panelRef.offsetHeight > 0) setPanelHeight(panelRef.offsetHeight);
    }),
  );

  const cornerStyle = () => {
    const margin = `${SPECS_PANEL_MARGIN_PX}px`;
    return {
      top: corner().startsWith("top") ? margin : "auto",
      bottom: corner().startsWith("bottom") ? margin : "auto",
      left: corner().endsWith("left") ? margin : "auto",
      right: corner().endsWith("right") ? margin : "auto",
    };
  };

  return (
    <div
      ref={panelRef}
      data-react-grab-specs-panel
      data-react-grab-ignore-events
      data-pinned={props.isPinned ? "" : undefined}
      class={cn(
        "fixed font-sans select-none",
        props.isPinned ? "pointer-events-auto" : "pointer-events-none",
      )}
      onPointerEnter={() => props.onHoverChange(true)}
      onPointerLeave={() => props.onHoverChange(false)}
      style={{
        ...cornerStyle(),
        width: `${panelWidth()}px`,
        "max-height": `calc(100vh - ${SPECS_PANEL_MARGIN_PX * 2}px)`,
        "z-index": String(Z_INDEX_OVERLAY),
        display: specs() ? "block" : "none",
      }}
    >
      <Show when={specs()}>
        {(currentSpecs) => (
          <Surface
            class={cn(
              "[box-shadow:var(--rg-shadow)] border px-3 pt-2.5 pb-2 overflow-hidden",
              props.isPinned
                ? "border-[var(--rg-text-secondary)]"
                : "border-[var(--rg-border-subtle)]",
            )}
          >
            <div
              data-react-grab-specs-header
              class="flex items-baseline justify-between gap-3 pb-1.5 border-b border-[var(--rg-border-subtle)]"
            >
              <span class="min-w-0 flex items-baseline gap-1.5">
                <Show when={props.componentName}>
                  <span
                    class="text-[13px] leading-5 font-semibold text-[var(--rg-text-primary)] overflow-hidden text-ellipsis whitespace-nowrap"
                    textContent={props.componentName}
                  />
                </Show>
                <span
                  class={cn(
                    "font-mono leading-5 whitespace-nowrap",
                    props.componentName
                      ? "text-[11px] text-[var(--rg-text-secondary)]"
                      : "text-[13px] font-semibold text-[var(--rg-text-primary)]",
                  )}
                  textContent={`<${currentSpecs().tagName}>`}
                />
              </span>
              <span
                class="shrink-0 font-mono text-[11px] leading-5 tabular-nums text-[var(--rg-text-secondary)]"
                textContent={`${currentSpecs().width} × ${currentSpecs().height}`}
              />
            </div>
            <div
              style={{
                "column-count": isTwoColumn() ? "2" : "1",
                "column-gap": "20px",
              }}
            >
              <For each={currentSpecs().sections}>
                {(section) => (
                  <section class="break-inside-avoid">
                    <h3
                      class="m-0 pt-2 pb-0.5 text-[10px] leading-[14px] font-semibold uppercase tracking-[0.06em] text-[var(--rg-text-secondary)]"
                      textContent={section.title}
                    />
                    <For each={section.rows}>
                      {(row, rowIndex) => {
                        const isToggleable = () =>
                          isEditable() && (row.isApplied || Boolean(row.isDisabled));
                        return (
                          <div
                            data-react-grab-spec-row={row.property}
                            data-applied={row.isApplied ? "" : undefined}
                            data-disabled={row.isDisabled ? "" : undefined}
                            role={isToggleable() ? "checkbox" : undefined}
                            aria-checked={isToggleable() ? !row.isDisabled : undefined}
                            aria-label={isToggleable() ? row.property : undefined}
                            class={cn(
                              "-mx-1 px-1 rounded-[4px]",
                              row.isApplied
                                ? "text-[var(--rg-text-primary)]"
                                : "text-[var(--rg-text-secondary)]",
                              !row.isApplied && !row.isDisabled && "opacity-70",
                              isToggleable() && "cursor-pointer hover:bg-[var(--rg-surface-hover)]",
                            )}
                            onMouseDown={preventPress}
                            onClick={() => {
                              if (isToggleable()) toggleRow(section.title, rowIndex(), row);
                            }}
                          >
                            <div class="flex items-center gap-1.5 h-[18px] text-[11px] leading-[18px]">
                              <span
                                aria-hidden="true"
                                class={cn(
                                  "shrink-0 size-[9px] rounded-[2.5px] border",
                                  row.isApplied &&
                                    "bg-[var(--rg-text-primary)] border-[var(--rg-text-primary)]",
                                  row.isDisabled && "border-[var(--rg-text-primary)]",
                                  !row.isApplied &&
                                    !row.isDisabled &&
                                    "border-[var(--rg-border-button)]",
                                )}
                              />
                              <span class="shrink-0 font-mono" textContent={row.property} />
                              <span class="flex-1 min-w-2" />
                              <Show when={row.swatchColor}>
                                <span
                                  aria-hidden="true"
                                  class="shrink-0 size-[10px] rounded-[2.5px] border border-[var(--rg-border-button)]"
                                  style={{ "background-color": row.swatchColor }}
                                />
                              </Show>
                              <span
                                data-react-grab-spec-value
                                class={cn(
                                  "min-w-0 font-mono tabular-nums overflow-hidden text-ellipsis whitespace-nowrap",
                                  row.isDisabled && "line-through",
                                )}
                                textContent={row.value}
                              />
                            </div>
                            <For each={row.tokens}>
                              {(token) => (
                                <div
                                  data-react-grab-spec-token
                                  class="pl-[15px] h-[14px] font-mono text-[10px] leading-[14px] text-[var(--rg-text-secondary)] overflow-hidden text-ellipsis whitespace-nowrap"
                                  title={token}
                                  textContent={token}
                                />
                              )}
                            </For>
                          </div>
                        );
                      }}
                    </For>
                  </section>
                )}
              </For>
            </div>
            <div
              data-react-grab-specs-footer
              class="flex items-center justify-between gap-2 mt-2 pt-1.5 border-t border-[var(--rg-border-subtle)] text-[10px] leading-[14px] text-[var(--rg-text-secondary)]"
            >
              <span
                textContent={
                  props.isPinned
                    ? "Pinned · click a property to toggle it"
                    : "Hold ⇧ to pin and edit"
                }
              />
              <Show when={props.isPinned && hasDisabledRows()}>
                <button
                  type="button"
                  data-react-grab-specs-reset
                  class="shrink-0 m-0 p-0 border-0 bg-transparent font-sans text-[10px] leading-[14px] text-[var(--rg-text-primary)] underline cursor-pointer"
                  onMouseDown={preventPress}
                  onClick={resetRows}
                >
                  Reset
                </button>
              </Show>
            </div>
          </Surface>
        )}
      </Show>
    </div>
  );
};
