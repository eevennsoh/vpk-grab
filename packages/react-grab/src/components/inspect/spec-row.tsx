import { createEffect, createSignal, For, on, Show, type Component } from "solid-js";
import { SPECS_INPUT_ATTRIBUTE } from "../../constants.js";
import type { ElementSpecRow } from "../../types.js";
import { cn } from "../../utils/cn.js";
import { IconChevron } from "../icons/icon-chevron.js";
import { IconReset } from "../icons/icon-reset.js";

interface SpecRowProps {
  row: ElementSpecRow;
  isEditable: boolean;
  isMenuOpen: boolean;
  onToggle: () => void;
  onCommitValue: (value: string) => boolean;
  onOpenMenu: (anchorRect: DOMRect) => void;
  onReset: () => void;
}

// Keeps a press from moving the page's focus or extending its text selection
// (Shift is usually still held).
const preventPress = (event: MouseEvent) => event.preventDefault();

const iconButtonClass =
  "shrink-0 flex items-center justify-center size-4 m-0 p-0 border-0 rounded-[4px] bg-transparent text-[var(--rg-text-secondary)] cursor-pointer hover:bg-[var(--rg-surface-hover)] hover:text-[var(--rg-text-primary)]";

export const SpecRow: Component<SpecRowProps> = (props) => {
  let rowRef: HTMLDivElement | undefined;
  const [draftValue, setDraftValue] = createSignal<string | null>(null);
  const [isDraftInvalid, setIsDraftInvalid] = createSignal(false);

  const isOff = () => Boolean(props.row.override?.isOff);
  const hasOverride = () => props.row.override !== undefined;
  const isToggleable = () => props.isEditable && (props.row.isApplied || hasOverride());
  const isChecked = () => (hasOverride() ? !isOff() : props.row.isApplied);

  const startEditing = () => {
    setIsDraftInvalid(false);
    setDraftValue(props.row.override?.value ?? props.row.value);
  };

  let inputRef: HTMLInputElement | undefined;
  let isStoppingEdit = false;

  // Blurred before it unmounts: a focused input that is simply removed sends
  // no focusout to the panel, which would then hold its pin on focus forever.
  const stopEditing = () => {
    isStoppingEdit = true;
    inputRef?.blur();
    isStoppingEdit = false;
    setDraftValue(null);
    setIsDraftInvalid(false);
  };

  const commitDraft = (shouldKeepInvalidDraft: boolean) => {
    const value = draftValue();
    if (value === null) return;
    const currentValue = props.row.override?.value ?? props.row.value;
    if (value.trim() === currentValue || props.onCommitValue(value)) {
      stopEditing();
      return;
    }
    if (shouldKeepInvalidDraft) setIsDraftInvalid(true);
    else stopEditing();
  };

  // The row node is reused when its slot shows another property.
  createEffect(
    on(
      () => props.row.property,
      () => stopEditing(),
      { defer: true },
    ),
  );

  const handleInputKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Enter") {
      event.preventDefault();
      commitDraft(true);
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      stopEditing();
    }
  };

  return (
    <div
      ref={rowRef}
      data-react-grab-spec-row={props.row.property}
      data-applied={props.row.isApplied ? "" : undefined}
      data-off={isOff() ? "" : undefined}
      data-overridden={hasOverride() ? "" : undefined}
      class={cn(
        "group/row -mx-1 px-1 rounded-[4px]",
        props.row.isApplied || hasOverride()
          ? "text-[var(--rg-text-primary)]"
          : "text-[var(--rg-text-secondary)] opacity-70",
        props.isEditable && "hover:bg-[var(--rg-surface-hover)]",
      )}
    >
      <div class="flex items-center gap-1.5 h-[20px] text-[11px] leading-[18px]">
        <Show
          when={isToggleable()}
          fallback={
            <span
              aria-hidden="true"
              class={cn(
                "shrink-0 size-[9px] rounded-[2.5px] border",
                isChecked()
                  ? "bg-[var(--rg-text-primary)] border-[var(--rg-text-primary)]"
                  : "border-[var(--rg-border-button)]",
              )}
            />
          }
        >
          <button
            type="button"
            role="checkbox"
            data-react-grab-spec-toggle
            aria-checked={isChecked()}
            aria-label={`${props.row.property} on`}
            class="shrink-0 flex items-center justify-center size-[13px] -m-[2px] p-0 border-0 bg-transparent cursor-pointer"
            onMouseDown={preventPress}
            onClick={() => props.onToggle()}
          >
            <span
              aria-hidden="true"
              class={cn(
                "size-[9px] rounded-[2.5px] border border-[var(--rg-text-primary)]",
                isChecked() && "bg-[var(--rg-text-primary)]",
              )}
            />
          </button>
        </Show>
        <span
          class={cn("shrink-0 font-mono", isOff() && "line-through")}
          textContent={props.row.property}
        />
        <span class="flex-1 min-w-2" />
        <Show when={props.row.swatchColor}>
          <span
            aria-hidden="true"
            class="shrink-0 size-[10px] rounded-[2.5px] border border-[var(--rg-border-button)]"
            style={{ "background-color": props.row.swatchColor }}
          />
        </Show>
        <Show
          when={draftValue() !== null}
          fallback={
            <Show
              when={props.isEditable}
              fallback={
                <span
                  data-react-grab-spec-value
                  class={cn(
                    "min-w-0 font-mono tabular-nums overflow-hidden text-ellipsis whitespace-nowrap",
                    isOff() && "line-through",
                  )}
                  textContent={props.row.value}
                />
              }
            >
              <button
                type="button"
                data-react-grab-spec-value
                aria-label={`Edit ${props.row.property}`}
                title={props.row.value}
                class={cn(
                  "min-w-0 m-0 px-1 -mx-1 border-0 rounded-[3px] bg-transparent font-mono text-[11px] leading-[18px] tabular-nums text-inherit overflow-hidden text-ellipsis whitespace-nowrap cursor-text hover:bg-[var(--rg-surface-hover)]",
                  isOff() && "line-through",
                )}
                onMouseDown={preventPress}
                onClick={startEditing}
                textContent={props.row.value}
              />
            </Show>
          }
        >
          <input
            ref={(inputElement) => {
              inputRef = inputElement;
              queueMicrotask(() => inputElement.select());
            }}
            {...{ [SPECS_INPUT_ATTRIBUTE]: "" }}
            data-react-grab-spec-input
            type="text"
            aria-label={`${props.row.property} value`}
            aria-invalid={isDraftInvalid()}
            data-invalid={isDraftInvalid() ? "" : undefined}
            autocomplete="off"
            spellcheck={false}
            class={cn(
              "min-w-0 w-[120px] h-[18px] m-0 px-1 border rounded-[3px] bg-[var(--rg-panel-bg)] font-mono text-[11px] leading-[16px] text-right text-[var(--rg-text-primary)] outline-none",
              isDraftInvalid() ? "border-[#e5484d]" : "border-[var(--rg-border-button)]",
            )}
            value={draftValue() ?? ""}
            onInput={(event) => {
              setDraftValue(event.currentTarget.value);
              setIsDraftInvalid(false);
            }}
            onKeyDown={handleInputKeyDown}
            onBlur={() => {
              if (!isStoppingEdit) commitDraft(false);
            }}
          />
        </Show>
        <Show when={props.isEditable}>
          <button
            type="button"
            data-react-grab-spec-menu-trigger
            aria-label={`Choose a ${props.row.property} token or value`}
            aria-haspopup="dialog"
            aria-expanded={props.isMenuOpen}
            class={iconButtonClass}
            onMouseDown={preventPress}
            onClick={() => {
              if (rowRef) props.onOpenMenu(rowRef.getBoundingClientRect());
            }}
          >
            <IconChevron size={12} />
          </button>
          <Show when={hasOverride()}>
            <button
              type="button"
              data-react-grab-spec-reset
              aria-label={`Reset ${props.row.property}`}
              title="Reset"
              class={iconButtonClass}
              onMouseDown={preventPress}
              onClick={() => props.onReset()}
            >
              <IconReset size={10} />
            </button>
          </Show>
        </Show>
      </div>
      <For each={props.row.tokens}>
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
};
