import { createMemo, createResource, For, Show, type Component } from "solid-js";
import {
  CHANGES_MENU_MAX_HEIGHT_PX,
  CHANGES_MENU_WIDTH_PX,
  SPECS_VALUE_MAX_LENGTH,
} from "../../constants.js";
import { getNearestComponentName } from "../../core/context.js";
import type {
  DropdownAnchor,
  StyleChangeRunner,
  StyleOverride,
  StyleOverrideGroup,
} from "../../types.js";
import { cn } from "../../utils/cn.js";
import { formatCssColor } from "../../utils/format-css-color.js";
import { formatCssNumber } from "../../utils/format-css-number.js";
import { getElementComputedStyle } from "../../utils/get-element-computed-style.js";
import { getTagName } from "../../utils/get-tag-name.js";
import { groupStyleOverrides } from "../../utils/group-style-overrides.js";
import {
  getAllStyleOverrides,
  resetAllStyleOverrides,
  resetStyleOverride,
} from "../../utils/style-override-store.js";
import { truncateString } from "../../utils/truncate-string.js";
import { IconClose } from "../icons/icon-close.js";
import { Menu } from "../menu/index.js";
import { AnchoredDropdownSurface } from "../ui/anchored-dropdown-surface.js";

interface ChangesMenuProps {
  position: DropdownAnchor | null;
  styleOverridesVersion: number;
  onDismiss: () => void;
  onConfigure: (element: Element) => void;
  onStyleChange: StyleChangeRunner;
}

interface ChangesGroupProps {
  group: StyleOverrideGroup;
  onConfigure: (element: Element) => void;
  onRemove: (override: StyleOverride) => void;
}

interface ChangeLineProps {
  override: StyleOverride;
  onRemove: () => void;
}

const formatCurrentValue = (override: StyleOverride): string => {
  const computedValue = getElementComputedStyle(override.element).getPropertyValue(
    override.property,
  );
  const formattedValue = override.original.swatchColor
    ? formatCssColor(computedValue)
    : formatCssNumber(computedValue);
  return truncateString(formattedValue || (override.value ?? ""), SPECS_VALUE_MAX_LENGTH);
};

const ChangeLine: Component<ChangeLineProps> = (props) => (
  <li
    data-react-grab-change={props.override.property}
    data-off={props.override.isOff ? "" : undefined}
    class="group/change flex items-center gap-2 min-h-[22px] pl-2.5 pr-1 font-mono text-[11px] leading-4"
  >
    <span class="min-w-0 flex-1 flex items-baseline gap-2">
      <span
        class={cn("shrink-0 text-[var(--rg-text-primary)]", props.override.isOff && "line-through")}
        textContent={props.override.property}
      />
      <span
        class="min-w-0 text-[var(--rg-text-secondary)] overflow-hidden text-ellipsis whitespace-nowrap"
        title={props.override.token ?? undefined}
      >
        <Show
          when={!props.override.isOff}
          fallback={<span class="line-through" textContent={props.override.original.value} />}
        >
          <span textContent={`${props.override.original.value} → `} />
          <span
            class="text-[var(--rg-text-primary)]"
            textContent={formatCurrentValue(props.override)}
          />
          <Show when={props.override.token}>
            {(token) => <span textContent={` (${token()})`} />}
          </Show>
        </Show>
      </span>
    </span>
    <button
      type="button"
      data-react-grab-change-remove
      aria-label={`Remove the ${props.override.property} change`}
      title="Remove"
      class="shrink-0 flex items-center justify-center size-5 m-0 p-0 border-0 rounded-[5px] bg-transparent text-[var(--rg-text-secondary)] cursor-pointer hover:bg-[var(--rg-surface-hover)] hover:text-[var(--rg-text-primary)]"
      onClick={() => props.onRemove()}
    >
      <IconClose size={11} />
    </button>
  </li>
);

const ChangesGroup: Component<ChangesGroupProps> = (props) => {
  const [componentName] = createResource(
    () => props.group.element,
    (element) => getNearestComponentName(element),
  );

  return (
    <section data-react-grab-changes-group class="py-1">
      <button
        type="button"
        data-react-grab-changes-configure
        aria-label={`Edit the specs of ${componentName() ?? getTagName(props.group.element)}`}
        title="Open in the specs panel"
        class="flex items-baseline gap-1.5 w-full m-0 px-2.5 py-1 border-0 bg-transparent text-left cursor-pointer rounded-[6px] hover:bg-[var(--rg-surface-hover)]"
        onClick={() => props.onConfigure(props.group.element)}
      >
        <Show when={componentName()}>
          {(name) => (
            <span
              class="text-[12px] leading-4 font-semibold text-[var(--rg-text-primary)] overflow-hidden text-ellipsis whitespace-nowrap"
              textContent={name()}
            />
          )}
        </Show>
        <span
          class="font-mono text-[11px] leading-4 text-[var(--rg-text-secondary)]"
          textContent={`<${getTagName(props.group.element)}>`}
        />
      </button>
      <ul class="m-0 p-0 list-none">
        <For each={props.group.overrides}>
          {(override) => (
            <ChangeLine override={override} onRemove={() => props.onRemove(override)} />
          )}
        </For>
      </ul>
    </section>
  );
};

// Every style override on the page, grouped by element. An element's heading
// reopens the specs panel on it; each line can be removed on its own.
export const ChangesMenu: Component<ChangesMenuProps> = (props) => {
  const isOpen = createMemo(() => props.position !== null);
  const groups = createMemo(() => {
    void props.styleOverridesVersion;
    if (!isOpen()) return [];
    return groupStyleOverrides(getAllStyleOverrides());
  });

  const removeOverride = (override: StyleOverride) => {
    props.onStyleChange(() => resetStyleOverride(override.element, override.property));
  };

  const resetAll = () => {
    props.onStyleChange(resetAllStyleOverrides);
  };

  return (
    <AnchoredDropdownSurface
      position={props.position}
      dataAttribute="data-react-grab-changes-menu"
      onDismiss={props.onDismiss}
    >
      <Menu.Panel class="overflow-hidden" style={{ width: `${CHANGES_MENU_WIDTH_PX}px` }}>
        <div class="flex items-center justify-between px-3 pt-2.5 pb-1.5 border-b border-[var(--rg-border-subtle)]">
          <span class="text-[12px] leading-4 font-semibold text-[var(--rg-text-primary)]">
            Style changes
          </span>
          <span
            class="font-mono text-[11px] leading-4 tabular-nums text-[var(--rg-text-secondary)]"
            textContent={String(
              groups().reduce((count, group) => count + group.overrides.length, 0),
            )}
          />
        </div>
        <div
          class="overflow-y-auto overscroll-contain px-1"
          style={{ "max-height": `${CHANGES_MENU_MAX_HEIGHT_PX}px` }}
        >
          <For each={groups()}>
            {(group) => (
              <ChangesGroup
                group={group}
                onConfigure={props.onConfigure}
                onRemove={removeOverride}
              />
            )}
          </For>
        </div>
        <div class="flex items-center justify-between gap-2 px-3 py-1.5 border-t border-[var(--rg-border-subtle)] text-[10px] leading-[14px] text-[var(--rg-text-secondary)]">
          <span>Browser-only until written to code</span>
          <button
            type="button"
            data-react-grab-changes-reset-all
            class="shrink-0 m-0 p-0 border-0 bg-transparent font-sans text-[10px] leading-[14px] text-[var(--rg-text-primary)] underline cursor-pointer"
            onClick={resetAll}
          >
            Reset all
          </button>
        </div>
      </Menu.Panel>
    </AnchoredDropdownSurface>
  );
};
