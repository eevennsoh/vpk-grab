import { createMemo, createSignal, For, onCleanup, onMount, Show, type Component } from "solid-js";
import {
  SPECS_INPUT_ATTRIBUTE,
  SPECS_PANEL_MARGIN_PX,
  SPECS_VALUE_MENU_GAP_PX,
  SPECS_VALUE_MENU_MAX_HEIGHT_PX,
  SPECS_VALUE_MENU_WIDTH_PX,
  Z_INDEX_OVERLAY,
} from "../../constants.js";
import type { ElementSpecRow, SpecValueOption } from "../../types.js";
import { cn } from "../../utils/cn.js";
import { getSpecValueOptions } from "../../utils/get-spec-value-options.js";
import { getVisualViewport } from "../../utils/get-visual-viewport.js";
import { registerOverlayDismiss } from "../../utils/register-overlay-dismiss.js";
import { IconCheck } from "../icons/icon-check.js";

interface SpecValueMenuProps {
  element: Element;
  row: ElementSpecRow;
  anchorRect: DOMRect;
  onSelect: (option: SpecValueOption) => void;
  onClose: () => void;
}

const isCurrentOption = (row: ElementSpecRow, option: SpecValueOption): boolean => {
  if (option.kind === "keyword") return row.override?.value === option.value;
  if (row.override?.token) return row.override.token === option.label;
  return row.tokens?.some((token) => token.split(/[ ,]/)[0] === option.label) ?? false;
};

// The tokens and keywords a row can take, under a filter box. Options are
// read once when the menu opens: a token set redefined while it is open is
// picked up the next time it opens.
export const SpecValueMenu: Component<SpecValueMenuProps> = (props) => {
  let menuRef: HTMLDivElement | undefined;
  let filterInputRef: HTMLInputElement | undefined;
  const [filterText, setFilterText] = createSignal("");
  const [highlightedIndex, setHighlightedIndex] = createSignal(0);
  const options = getSpecValueOptions(props.element, props.row.property);

  const filteredOptions = createMemo(() => {
    const query = filterText().trim().toLowerCase();
    if (!query) return options;
    return options.filter(
      (option) =>
        option.label.toLowerCase().includes(query) ||
        option.resolvedValue.toLowerCase().includes(query),
    );
  });

  const position = () => {
    const viewport = getVisualViewport();
    const left = Math.max(
      SPECS_PANEL_MARGIN_PX,
      Math.min(
        props.anchorRect.right - SPECS_VALUE_MENU_WIDTH_PX,
        viewport.width - SPECS_VALUE_MENU_WIDTH_PX - SPECS_PANEL_MARGIN_PX,
      ),
    );
    const spaceBelow = viewport.height - props.anchorRect.bottom - SPECS_PANEL_MARGIN_PX;
    const opensUpward =
      spaceBelow < SPECS_VALUE_MENU_MAX_HEIGHT_PX && props.anchorRect.top > spaceBelow;
    return {
      left: `${left}px`,
      top: opensUpward ? "auto" : `${props.anchorRect.bottom + SPECS_VALUE_MENU_GAP_PX}px`,
      bottom: opensUpward
        ? `${viewport.height - props.anchorRect.top + SPECS_VALUE_MENU_GAP_PX}px`
        : "auto",
    };
  };

  const selectOption = (option: SpecValueOption | undefined) => {
    if (option) props.onSelect(option);
  };

  const scrollHighlightedIntoView = () => {
    menuRef
      ?.querySelector(`[data-option-index="${highlightedIndex()}"]`)
      ?.scrollIntoView({ block: "nearest" });
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    const optionCount = filteredOptions().length;
    switch (event.key) {
      case "ArrowDown":
      case "ArrowUp": {
        event.preventDefault();
        if (optionCount === 0) return;
        const step = event.key === "ArrowDown" ? 1 : -1;
        setHighlightedIndex((index) => (index + step + optionCount) % optionCount);
        scrollHighlightedIntoView();
        return;
      }
      case "Enter":
        event.preventDefault();
        selectOption(filteredOptions()[highlightedIndex()]);
        return;
    }
  };

  onMount(() => {
    const unregisterDismiss = registerOverlayDismiss({
      isOpen: () => true,
      onDismiss: () => props.onClose(),
      shouldIgnorePointerEvent: (event) =>
        Boolean(menuRef && event.composedPath().includes(menuRef)),
    });
    onCleanup(unregisterDismiss);
    filterInputRef?.focus();
  });

  return (
    <div
      ref={menuRef}
      data-react-grab-spec-value-menu
      data-react-grab-ignore-events
      role="dialog"
      aria-label={`${props.row.property} values`}
      class="fixed flex flex-col font-sans pointer-events-auto bg-[var(--rg-panel-bg)] border border-[var(--rg-border-subtle)] rounded-[10px] [box-shadow:var(--rg-shadow)] overflow-hidden"
      style={{
        ...position(),
        width: `${SPECS_VALUE_MENU_WIDTH_PX}px`,
        "max-height": `${SPECS_VALUE_MENU_MAX_HEIGHT_PX}px`,
        "z-index": String(Z_INDEX_OVERLAY),
      }}
    >
      <input
        ref={filterInputRef}
        {...{ [SPECS_INPUT_ATTRIBUTE]: "" }}
        data-react-grab-spec-value-filter
        type="text"
        placeholder="Filter tokens and values"
        aria-label="Filter tokens and values"
        autocomplete="off"
        spellcheck={false}
        class="m-0 px-2.5 py-1.5 border-0 border-b border-[var(--rg-border-subtle)] bg-transparent font-mono text-[11px] leading-4 text-[var(--rg-text-primary)] outline-none"
        value={filterText()}
        onInput={(event) => {
          setFilterText(event.currentTarget.value);
          setHighlightedIndex(0);
        }}
        onKeyDown={handleKeyDown}
      />
      <div role="listbox" aria-label={`${props.row.property} options`} class="overflow-y-auto py-1">
        <Show
          when={filteredOptions().length > 0}
          fallback={
            <div class="px-2.5 py-1.5 text-[11px] leading-4 text-[var(--rg-text-secondary)]">
              No matching tokens
            </div>
          }
        >
          <For each={filteredOptions()}>
            {(option, optionIndex) => (
              <div
                role="option"
                data-react-grab-spec-option={option.label}
                data-option-index={optionIndex()}
                aria-selected={isCurrentOption(props.row, option)}
                class={cn(
                  "flex items-center gap-1.5 mx-1 px-1.5 h-[22px] rounded-[6px] cursor-pointer text-[11px] leading-4",
                  optionIndex() === highlightedIndex() && "bg-[var(--rg-surface-hover)]",
                )}
                onPointerEnter={() => setHighlightedIndex(optionIndex())}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => selectOption(option)}
              >
                <span class="shrink-0 w-3 flex items-center justify-center">
                  <Show when={isCurrentOption(props.row, option)}>
                    <IconCheck size={11} class="text-[var(--rg-text-primary)]" />
                  </Show>
                </span>
                <Show when={option.swatchColor}>
                  <span
                    aria-hidden="true"
                    class="shrink-0 size-[10px] rounded-[2.5px] border border-[var(--rg-border-button)]"
                    style={{ "background-color": option.swatchColor }}
                  />
                </Show>
                <span
                  class="min-w-0 flex-1 font-mono text-[var(--rg-text-primary)] overflow-hidden text-ellipsis whitespace-nowrap"
                  title={option.label}
                  textContent={option.label}
                />
                <span
                  class="shrink-0 max-w-[45%] font-mono tabular-nums text-[var(--rg-text-secondary)] overflow-hidden text-ellipsis whitespace-nowrap"
                  textContent={option.resolvedValue}
                />
              </div>
            )}
          </For>
        </Show>
      </div>
    </div>
  );
};
