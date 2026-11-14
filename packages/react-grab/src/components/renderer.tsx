import { For, Show, type Component } from "solid-js";
import type { ReactGrabRendererProps } from "../types.js";
import { DEFAULT_ACTION_ID } from "../constants.js";
import { isElementConnected } from "../utils/is-element-connected.js";
import { OverlayCanvas } from "./overlay-canvas.js";
import { FrozenGlow } from "./frozen-glow.js";
import { SelectionLabel } from "./selection-label/index.js";
import { Toolbar } from "./toolbar/index.js";
import { ContextMenu } from "./context-menu.js";
import { ToolbarMenu } from "./toolbar/toolbar-menu.js";
import { HierarchyMenu } from "./toolbar/hierarchy-menu.js";
import { AnnotationLayer } from "./inspect/annotation-layer.js";
import { RedlinesOverlay } from "./inspect/redlines-overlay.js";
import { SpecsPanel } from "./inspect/specs-panel.js";
import { ChangesMenu } from "./toolbar/changes-menu.js";

export const ReactGrabRenderer: Component<ReactGrabRendererProps> = (props) => {
  return (
    <>
      <OverlayCanvas
        selectionVisible={props.selectionVisible}
        selectionBounds={props.selectionBounds}
        selectionBoundsMultiple={props.selectionBoundsMultiple}
        selectionShouldSnap={props.selectionShouldSnap}
        dragVisible={props.dragVisible}
        dragBounds={props.dragBounds}
        grabbedBoxes={props.grabbedBoxes}
        labelInstances={props.labelInstances}
      />
      <FrozenGlow visible={props.isFrozen ?? false} />
      <Show when={props.inspect}>
        {(inspect) => (
          <>
            <AnnotationLayer
              strokes={inspect().strokes()}
              draftStroke={inspect().draftStroke()}
              texts={inspect().texts()}
              textDraftPosition={inspect().textDraftPosition()}
              isEditing={inspect().annotationTool() === "edit"}
              selectedAnnotationId={inspect().selectedAnnotationId()}
              onTextDraftChange={inspect().onTextDraftChange}
              onTextDraftCommit={inspect().onTextDraftCommit}
              onTextDraftCancel={inspect().onTextDraftCancel}
            />
            <Show when={inspect().isRedlinesEnabled()}>
              <RedlinesOverlay
                element={inspect().element()}
                measureTarget={inspect().measureTarget()}
                viewportVersion={inspect().viewportVersion()}
              />
            </Show>
          </>
        )}
      </Show>
      <Show
        when={props.selectionLabelVisible && (props.frozenLabelEntryAccessors?.length ?? 0) > 0}
      >
        <For each={props.frozenLabelEntryAccessors ?? []}>
          {(entryAccessor) => (
            <Show when={entryAccessor.read()}>
              {(entry) => (
                <SelectionLabel
                  tagName={entry().tagName}
                  componentName={entry().componentName}
                  selectionBounds={entry().bounds}
                  mouseX={entry().mouseX}
                  visible={true}
                />
              )}
            </Show>
          )}
        </For>
      </Show>
      <Show when={props.selectionLabelVisible && props.pendingShiftPreviewEntry}>
        {(pendingEntry) => (
          <SelectionLabel
            tagName={pendingEntry().tagName}
            componentName={pendingEntry().componentName}
            selectionBounds={pendingEntry().bounds}
            mouseX={pendingEntry().mouseX}
            visible={true}
          />
        )}
      </Show>
      <Show
        when={
          props.selectionLabelVisible &&
          props.selectionBounds &&
          (props.frozenLabelEntryAccessors?.length ?? 0) === 0
        }
      >
        <SelectionLabel
          tagName={props.selectionTagName}
          componentName={props.selectionComponentName}
          elementsCount={props.selectionElementsCount}
          selectionBounds={props.selectionBounds}
          mouseX={props.mouseX}
          visible={props.selectionLabelVisible}
          isPromptMode={props.isPromptMode}
          inputValue={props.inputValue}
          status={props.selectionLabelStatus}
          filePath={props.selectionFilePath}
          onInputChange={props.onInputChange}
          onSubmit={props.onInputSubmit}
          selectionLabelShakeCount={props.selectionLabelShakeCount}
          onConfirmDismiss={props.onConfirmDismiss}
          discardPrompt={props.discardPrompt}
          onOpen={props.onOpenSelectionFile}
        />
      </Show>
      <For each={props.labelInstanceAccessors ?? []}>
        {(instanceAccessor) => (
          <Show when={instanceAccessor.read()}>
            {(instance) => (
              <SelectionLabel
                tagName={instance().tagName}
                componentName={instance().componentName}
                elementsCount={instance().elementsCount}
                selectionBounds={instance().bounds}
                mouseX={instance().mouseX}
                visible={true}
                status={instance().status}
                statusText={instance().statusText}
                isPromptMode={instance().isPromptMode}
                inputValue={instance().inputValue}
                error={instance().errorMessage}
                hideArrow={instance().hideArrow}
                onShowContextMenu={(() => {
                  const currentInstance = instance();
                  const hasCompletedStatus =
                    currentInstance.status === "copied" || currentInstance.status === "fading";
                  if (!hasCompletedStatus || !isElementConnected(currentInstance.element)) {
                    return undefined;
                  }
                  return () => props.onShowContextMenuInstance?.(currentInstance.id);
                })()}
                onRetry={() => props.onRetryInstance?.(instance().id)}
                onAcknowledgeError={() => props.onAcknowledgeErrorInstance?.(instance().id)}
                onHoverChange={(isHovered) =>
                  props.onLabelInstanceHoverChange?.(instance().id, isHovered)
                }
              />
            )}
          </Show>
        )}
      </For>
      {/* After the selection labels, which share its z-index: a label that
          reaches the panel's corner must not cover the values being read. */}
      <Show when={props.inspect?.isSpecsEnabled() ? props.inspect : undefined}>
        {(inspect) => (
          <SpecsPanel
            element={inspect().element()}
            componentName={props.selectionComponentName}
            measureTarget={inspect().measureTarget()}
            pointer={inspect().pointer()}
            viewportVersion={inspect().viewportVersion()}
            styleOverridesVersion={inspect().styleOverridesVersion()}
            isPinned={inspect().isSpecsPinned()}
            isPinLocked={inspect().isSpecsPinLocked()}
            onHoverChange={inspect().onSpecsPanelHoverChange}
            onEngagedChange={inspect().onSpecsPanelEngagedChange}
            onTogglePinLock={inspect().onToggleSpecsPinLock}
            onStylesChange={inspect().onSpecsStylesChange}
          />
        )}
      </Show>
      <Show when={props.toolbarVisible !== false}>
        <Toolbar
          isActive={props.isActive}
          isContextMenuOpen={props.contextMenuPosition !== null}
          onToggle={props.onToggleActive}
          activeActionId={props.activeActionId}
          defaultActionId={props.defaultActionId}
          defaultActionLabel={props.defaultActionLabel}
          enabled={props.enabled}
          shakeCount={props.shakeCount}
          onStateChange={props.onToolbarStateChange}
          onSubscribeToStateChanges={props.onSubscribeToToolbarStateChanges}
          onSelectHoverChange={props.onToolbarSelectHoverChange}
          onContainerRef={props.onToolbarRef}
          onToggleToolbarMenu={props.onToggleToolbarMenu}
          isSpecsEnabled={props.inspect?.isSpecsEnabled()}
          isRedlinesEnabled={props.inspect?.isRedlinesEnabled()}
          annotationTool={props.inspect?.annotationTool()}
          hasAnnotations={props.inspect?.hasAnnotations()}
          hasSelectedAnnotation={Boolean(props.inspect?.selectedAnnotationId())}
          onToggleSpecs={props.inspect?.onToggleSpecs}
          onToggleRedlines={props.inspect?.onToggleRedlines}
          onSelectAnnotationTool={props.inspect?.onSelectAnnotationTool}
          onClearAnnotations={props.inspect?.onClearAnnotations}
          styleChangeCount={props.inspect?.styleChangeCount()}
          onToggleChangesMenu={props.inspect?.onToggleChangesMenu}
        />
      </Show>
      <ContextMenu
        position={props.contextMenuPosition ?? null}
        selectionBounds={props.contextMenuBounds ?? null}
        tagName={props.contextMenuTagName}
        componentName={props.contextMenuComponentName}
        hasFilePath={props.contextMenuHasFilePath ?? false}
        actions={props.actions}
        actionContext={props.actionContext}
        onDismiss={props.onContextMenuDismiss ?? (() => {})}
        onHide={props.onContextMenuHide ?? (() => {})}
      />
      <ToolbarMenu
        position={props.toolbarMenuPosition ?? null}
        actions={props.toolbarMenuActions ?? []}
        defaultActionId={props.defaultActionId ?? DEFAULT_ACTION_ID}
        onSetDefaultAction={props.onSetDefaultAction ?? (() => {})}
        onDismiss={props.onToolbarMenuDismiss ?? (() => {})}
      />
      <Show when={props.inspect}>
        {(inspect) => (
          <ChangesMenu
            position={inspect().changesMenuPosition()}
            styleOverridesVersion={inspect().styleOverridesVersion()}
            onDismiss={inspect().onDismissChangesMenu}
            onConfigure={inspect().onConfigureStyleChanges}
            onStylesChange={inspect().onSpecsStylesChange}
          />
        )}
      </Show>
      <HierarchyMenu position={props.hierarchyMenuPosition ?? null} state={props.hierarchyState} />
    </>
  );
};
