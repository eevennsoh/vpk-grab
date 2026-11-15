import {
  createEffect,
  createMemo,
  createSignal,
  Index,
  on,
  Show,
  untrack,
  type Component,
} from "solid-js";
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
  SpecValueOption,
  StyleChangeRunner,
} from "../../types.js";
import { cn } from "../../utils/cn.js";
import { createElementBounds } from "../../utils/create-element-bounds.js";
import { getElementSpecs } from "../../utils/get-element-specs.js";
import { getSpecsPanelCorner } from "../../utils/get-specs-panel-corner.js";
import { getVisualViewport } from "../../utils/get-visual-viewport.js";
import { overlayBoundsToRect } from "../../utils/overlay-bounds-to-rect.js";
import {
  canOverrideStyles,
  resetElementStyleOverrides,
  resetStyleOverride,
  setStyleOverrideOff,
  setStyleOverrideValue,
} from "../../utils/style-override-store.js";
import { IconPin } from "../icons/icon-pin.js";
import { Surface } from "../ui/surface.js";
import { SpecRow } from "./spec-row.js";
import { SpecValueMenu } from "./spec-value-menu.js";

interface SpecsPanelProps {
  element: Element | null;
  componentName?: string;
  measureTarget: Element | null;
  pointer: Position;
  viewportVersion: number;
  styleOverridesVersion: number;
  isPinned: boolean;
  isPinLocked: boolean;
  onHoverChange: (isHovered: boolean) => void;
  onEngagedChange: (isEngaged: boolean) => void;
  onTogglePinLock: () => void;
  onStyleChange: StyleChangeRunner;
}

interface OpenValueMenu {
  property: string;
  anchorRect: DOMRect;
}

const HEADER_HEIGHT_PX = 44;
const SECTION_TITLE_HEIGHT_PX = 24;
const SEPARATOR_HEIGHT_PX = 9;
const ROW_HEIGHT_PX = 20;
const TOKEN_HEIGHT_PX = 14;
const FOOTER_HEIGHT_PX = 27;

const estimateRowsHeight = (rows: ElementSpecRow[]): number =>
  rows.reduce(
    (totalHeight, row) => totalHeight + ROW_HEIGHT_PX + (row.tokens?.length ?? 0) * TOKEN_HEIGHT_PX,
    0,
  );

const estimateSingleColumnHeight = (specs: ElementSpecs): number =>
  specs.sections.reduce(
    (totalHeight, section) =>
      totalHeight + SECTION_TITLE_HEIGHT_PX + estimateRowsHeight(section.rows),
    HEADER_HEIGHT_PX +
      FOOTER_HEIGHT_PX +
      SECTION_TITLE_HEIGHT_PX +
      SEPARATOR_HEIGHT_PX +
      estimateRowsHeight(specs.appliedRows),
  );

const sectionTitleClass =
  "m-0 pt-2 pb-0.5 text-[10px] leading-[14px] font-semibold uppercase tracking-[0.06em] text-[var(--rg-text-secondary)]";

// Click-through while it follows the hover: the panel answers "what is applied
// here" for whatever is under the pointer, including UI that only exists while
// hovered, so it may not ask for the pointer. Holding Shift pins it to the
// element it is showing; only then does it take the pointer, and its rows
// become editable.
export const SpecsPanel: Component<SpecsPanelProps> = (props) => {
  let panelRef: HTMLDivElement | undefined;
  const [panelHeight, setPanelHeight] = createSignal(SPECS_PANEL_FALLBACK_HEIGHT_PX);
  const [requestedValueMenu, setOpenValueMenu] = createSignal<OpenValueMenu | null>(null);
  const openValueMenu = () => (isEditable() ? requestedValueMenu() : null);
  const [hasFocusWithin, setHasFocusWithin] = createSignal(false);

  // The applied group as it stood when the panel was pinned. Rows do not move
  // while it is pinned; an edited lower row joins the group the next time.
  let frozenElement: Element | null = null;
  const frozenAppliedProperties = createMemo<string[] | null>((previousProperties) => {
    const element = props.element;
    if (!props.isPinned || !element) {
      frozenElement = null;
      return null;
    }
    if (previousProperties && frozenElement === element) return previousProperties;
    frozenElement = element;
    return untrack(() => getElementSpecs(element)?.appliedRows.map((row) => row.property) ?? null);
  }, null);

  const specs = createMemo(() => {
    void props.styleOverridesVersion;
    return props.element ? getElementSpecs(props.element, frozenAppliedProperties()) : null;
  });

  const isEditable = () =>
    props.isPinned && props.element !== null && canOverrideStyles(props.element);
  const hasOverrides = () =>
    specs()?.appliedRows.some((row) => row.override) ||
    specs()?.sections.some((section) => section.rows.some((row) => row.override)) ||
    false;

  createEffect(
    on(
      () => hasFocusWithin() || openValueMenu() !== null,
      (isEngaged) => props.onEngagedChange(isEngaged),
      { defer: true },
    ),
  );

  const toggleRow = (row: ElementSpecRow) => {
    const element = props.element;
    if (!element) return;
    const isOff = row.override ? !row.override.isOff : true;
    props.onStyleChange(() => setStyleOverrideOff(element, row, isOff));
  };

  const commitRowValue = (row: ElementSpecRow, value: string, token: string | null): boolean => {
    const element = props.element;
    if (!element) return false;
    return props.onStyleChange(() => setStyleOverrideValue(element, row, value, token));
  };

  const resetRow = (row: ElementSpecRow) => {
    const element = props.element;
    if (!element) return;
    props.onStyleChange(() => resetStyleOverride(element, row.property));
  };

  const resetRows = () => {
    const element = props.element;
    if (!element) return;
    props.onStyleChange(() => resetElementStyleOverrides(element));
  };

  const selectValueOption = (row: ElementSpecRow, option: SpecValueOption) => {
    commitRowValue(row, option.value, option.kind === "token" ? option.label : null);
    setOpenValueMenu(null);
  };

  const menuRow = () => {
    const menu = openValueMenu();
    const currentSpecs = specs();
    if (!menu || !currentSpecs) return null;
    return (
      [
        ...currentSpecs.appliedRows,
        ...currentSpecs.sections.flatMap((section) => section.rows),
      ].find((row) => row.property === menu.property) ?? null
    );
  };

  // Rows are kept by position, not by object: every override change rebuilds
  // the row objects, and a row node replaced under the pointer leaves Chrome
  // without a pointerleave for the panel, which would then stay pinned.
  const renderRow = (row: () => ElementSpecRow) => (
    <SpecRow
      row={row()}
      isEditable={isEditable()}
      isMenuOpen={openValueMenu()?.property === row().property}
      onToggle={() => toggleRow(row())}
      onCommitValue={(value) => commitRowValue(row(), value, null)}
      onOpenMenu={(anchorRect) =>
        setOpenValueMenu((menu) =>
          menu?.property === row().property ? null : { property: row().property, anchorRect },
        )
      }
      onReset={() => resetRow(row())}
    />
  );

  const viewport = createMemo(() => {
    void props.viewportVersion;
    return getVisualViewport();
  });

  // A panel following the hover cannot be scrolled, so a viewport too short
  // for one column gets two. A pinned panel takes the pointer and scrolls.
  const isTwoColumn = createMemo(() => {
    const currentSpecs = specs();
    if (!currentSpecs || props.isPinned) return false;
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
      data-pin-locked={props.isPinLocked ? "" : undefined}
      class={cn(
        "fixed font-sans select-none",
        props.isPinned ? "pointer-events-auto" : "pointer-events-none",
      )}
      onPointerEnter={() => props.onHoverChange(true)}
      onPointerLeave={() => props.onHoverChange(false)}
      onFocusIn={() => setHasFocusWithin(true)}
      onFocusOut={(event) => {
        const nextFocus = event.relatedTarget;
        if (!(nextFocus instanceof Node) || !panelRef?.contains(nextFocus)) {
          setHasFocusWithin(false);
        }
      }}
      style={{
        ...cornerStyle(),
        width: `${panelWidth()}px`,
        "z-index": String(Z_INDEX_OVERLAY),
        display: specs() ? "block" : "none",
      }}
    >
      <Show when={specs()}>
        {(currentSpecs) => (
          <Surface
            class={cn(
              "[box-shadow:var(--rg-shadow)] border flex flex-col overflow-hidden",
              props.isPinned
                ? "border-[var(--rg-text-secondary)]"
                : "border-[var(--rg-border-subtle)]",
            )}
            style={{ "max-height": `calc(100vh - ${SPECS_PANEL_MARGIN_PX * 2}px)` }}
          >
            <div
              data-react-grab-specs-header
              class="flex items-center justify-between gap-3 mx-3 mt-2.5 pb-1.5 border-b border-[var(--rg-border-subtle)]"
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
              <span class="shrink-0 flex items-center gap-1.5">
                <span
                  class="font-mono text-[11px] leading-5 tabular-nums text-[var(--rg-text-secondary)]"
                  textContent={`${currentSpecs().width} × ${currentSpecs().height}`}
                />
                <Show when={props.isPinned}>
                  <button
                    type="button"
                    data-react-grab-specs-pin
                    aria-label={props.isPinLocked ? "Unpin the panel" : "Keep the panel pinned"}
                    aria-pressed={props.isPinLocked}
                    title={props.isPinLocked ? "Unpin" : "Keep pinned"}
                    class={cn(
                      "flex items-center justify-center size-5 m-0 p-0 border-0 rounded-[5px] cursor-pointer hover:bg-[var(--rg-surface-hover)]",
                      props.isPinLocked
                        ? "bg-[var(--rg-surface-hover)] text-[var(--rg-text-primary)]"
                        : "bg-transparent text-[var(--rg-text-secondary)]",
                    )}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => props.onTogglePinLock()}
                  >
                    <IconPin size={12} />
                  </button>
                </Show>
              </span>
            </div>
            <div
              data-react-grab-specs-body
              class={cn("px-3 min-h-0", props.isPinned && "overflow-y-auto overscroll-contain")}
              style={{
                "column-count": isTwoColumn() ? "2" : "1",
                "column-gap": "20px",
              }}
            >
              <Show when={currentSpecs().appliedRows.length > 0}>
                <section data-react-grab-specs-applied class="break-inside-avoid">
                  <h3 class={sectionTitleClass} textContent="Applied" />
                  <Index each={currentSpecs().appliedRows}>{renderRow}</Index>
                </section>
                <Show when={currentSpecs().sections.length > 0}>
                  <hr
                    aria-hidden="true"
                    class="mt-2 mb-0 border-0 border-t border-[var(--rg-border-subtle)]"
                  />
                </Show>
              </Show>
              <Index each={currentSpecs().sections}>
                {(section) => (
                  <section
                    data-react-grab-specs-section={section().title}
                    class="break-inside-avoid"
                  >
                    <h3 class={sectionTitleClass} textContent={section().title} />
                    <Index each={section().rows}>{renderRow}</Index>
                  </section>
                )}
              </Index>
            </div>
            <div
              data-react-grab-specs-footer
              class="flex items-center justify-between gap-2 mx-3 mt-2 mb-2 pt-1.5 border-t border-[var(--rg-border-subtle)] text-[10px] leading-[14px] text-[var(--rg-text-secondary)]"
            >
              <span
                textContent={
                  props.isPinned
                    ? "Pinned · edit a value or pick a token"
                    : "Hold ⇧ to pin and edit"
                }
              />
              <Show when={props.isPinned && hasOverrides()}>
                <button
                  type="button"
                  data-react-grab-specs-reset
                  class="shrink-0 m-0 p-0 border-0 bg-transparent font-sans text-[10px] leading-[14px] text-[var(--rg-text-primary)] underline cursor-pointer"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={resetRows}
                >
                  Reset
                </button>
              </Show>
            </div>
          </Surface>
        )}
      </Show>
      <Show when={openValueMenu()}>
        {(menu) => (
          <Show when={props.element && menuRow()}>
            {(row) => (
              <SpecValueMenu
                element={props.element as Element}
                row={row()}
                anchorRect={menu().anchorRect}
                onSelect={(option) => selectValueOption(row(), option)}
                onClose={() => setOpenValueMenu(null)}
              />
            )}
          </Show>
        )}
      </Show>
    </div>
  );
};
