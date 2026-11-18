import { createMemo, For, Show, type Component } from "solid-js";
import type { ReactGrabRendererProps } from "../types.js";
import { DEFAULT_ACTION_ID } from "../constants.js";
import { hasLabelCompletionActions } from "../utils/has-label-completion-actions.js";
import { formatElementSize } from "../utils/format-element-size.js";
import { getElementRedlines } from "../utils/get-element-redlines.js";
import { getPairRedlines } from "../utils/get-pair-redlines.js";
import { getRedlineLabelClearance } from "../utils/get-redline-label-clearance.js";
import { OverlayCanvas } from "./overlay-canvas.js";
import { FrozenGlow } from "./frozen-glow.js";
import { ScreenshotMarquee } from "./screenshot-marquee.js";
import { SelectionLabel } from "./selection-label/index.js";
import { Toolbar } from "./toolbar/index.js";
import { ToolbarMenu } from "./toolbar/toolbar-menu.js";
import { HierarchyMenu } from "./toolbar/hierarchy-menu.js";
import { AnnotationLayer } from "./inspect/annotation-layer.js";
import { RedlinesOverlay } from "./inspect/redlines-overlay.js";
import { SpecsPanel } from "./inspect/specs-panel.js";
import { ChangesMenu } from "./toolbar/changes-menu.js";

export const ReactGrabRenderer: Component<ReactGrabRendererProps> = (props) => {
  // With a measure target the element's own spacing gives way to the
  // distances between the two; a target with no box to measure falls back.
  const redlines = createMemo(() => {
    const inspect = props.inspect;
    if (!inspect?.isRedlinesEnabled()) return null;
    void inspect.viewportVersion();
    const element = inspect.element();
    if (!element) return null;
    const measureTarget = inspect.measureTarget();
    const pairRedlines =
      measureTarget && measureTarget !== element ? getPairRedlines(element, measureTarget) : null;
    return pairRedlines ?? getElementRedlines(element);
  });
  const isSelectionLabelShown = () =>
    Boolean(
      props.selectionLabelVisible &&
      props.selectionBounds &&
      !props.isSelectionLabelCovered &&
      (props.frozenLabelEntryAccessors?.length ?? 0) === 0,
    );
  const selectionSizeText = () => {
    const bounds = props.selectionBounds;
    if (!bounds || !redlines() || !isSelectionLabelShown()) return undefined;
    return formatElementSize(bounds.width, bounds.height);
  };

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
      <Show when={props.screenshotMarqueeBounds}>
        {(bounds) => <ScreenshotMarquee bounds={bounds()} />}
      </Show>
      <Show when={props.inspect}>
        {(inspect) => (
          <AnnotationLayer
            strokes={inspect().strokes()}
            draftStroke={inspect().draftStroke()}
            texts={inspect().texts()}
            textDraftPosition={inspect().textDraftPosition()}
            annotationColor={inspect().annotationColor()}
            isEditing={inspect().annotationTool() === "edit"}
            isEditPressing={inspect().isEditPressing()}
            selectedAnnotationIds={inspect().selectedAnnotationIds()}
            marqueeRect={inspect().annotationMarqueeRect()}
            onTextDraftChange={inspect().onTextDraftChange}
            onTextDraftCommit={inspect().onTextDraftCommit}
            onTextDraftCancel={inspect().onTextDraftCancel}
          />
        )}
      </Show>
      <Show when={redlines()}>
        {(currentRedlines) => (
          <RedlinesOverlay redlines={currentRedlines()} showsSizeLabel={!selectionSizeText()} />
        )}
      </Show>
      {/* Before the live labels, which share its z-index: a label for whatever
          is under the pointer must stay readable over a pill it overlaps. */}
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
                isLabelInstance
                status={instance().status}
                statusText={instance().statusText}
                isPromptMode={instance().isPromptMode}
                inputValue={instance().inputValue}
                error={instance().errorMessage}
                hideArrow={instance().hideArrow}
                thumbnailUrl={instance().thumbnailUrl}
                isCapturingScreenshot={instance().isCapturingScreenshot}
                screenshotError={instance().screenshotErrorMessage}
                onCopyScreenshot={(() => {
                  const currentInstance = instance();
                  if (
                    !hasLabelCompletionActions(currentInstance) ||
                    currentInstance.copiedContent === undefined ||
                    currentInstance.thumbnailUrl
                  ) {
                    return undefined;
                  }
                  return () => props.onCopyScreenshotInstance?.(currentInstance.id);
                })()}
                onSubmitPrompt={(() => {
                  const currentInstance = instance();
                  if (
                    currentInstance.status !== "copied" ||
                    !currentInstance.promptTarget ||
                    !hasLabelCompletionActions(currentInstance)
                  ) {
                    return undefined;
                  }
                  return (prompt: string) =>
                    props.onSubmitPromptInstance?.(currentInstance.id, prompt);
                })()}
                shouldFocusPrompt={props.shouldFocusInstancePrompt}
                isGrabActive={props.isActive}
                onPromptFocusRelease={props.onInstancePromptFocusRelease}
                onDismissPill={props.onDismissPill}
                onRetry={() => props.onRetryInstance?.(instance().id)}
                onAcknowledgeError={() => props.onAcknowledgeErrorInstance?.(instance().id)}
              />
            )}
          </Show>
        )}
      </For>
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
      <Show when={isSelectionLabelShown()}>
        <SelectionLabel
          tagName={props.selectionTagName}
          componentName={props.selectionComponentName}
          sizeText={selectionSizeText()}
          clearanceBelowPx={selectionSizeText() ? getRedlineLabelClearance(redlines()) : 0}
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
            onStyleChange={inspect().onSpecsStyleChange}
          />
        )}
      </Show>
      <Show when={props.toolbarVisible !== false}>
        <Toolbar
          isActive={props.isActive}
          onToggle={props.onToggleActive}
          activeActionId={props.activeActionId}
          defaultActionId={props.defaultActionId}
          defaultActionLabel={props.defaultActionLabel}
          grabShortcut={props.grabShortcut}
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
          annotationColor={props.inspect?.annotationColor()}
          hasAnnotations={props.inspect?.hasAnnotations()}
          hasSelectedAnnotation={(props.inspect?.selectedAnnotationIds().length ?? 0) > 0}
          onToggleSpecs={props.inspect?.onToggleSpecs}
          onToggleRedlines={props.inspect?.onToggleRedlines}
          onSelectAnnotationTool={props.inspect?.onSelectAnnotationTool}
          onSelectAnnotationColor={props.inspect?.onSelectAnnotationColor}
          onClearAnnotations={props.inspect?.onClearAnnotations}
          styleChangeCount={props.inspect?.styleChangeCount()}
          onToggleChangesMenu={props.inspect?.onToggleChangesMenu}
        />
      </Show>
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
            onStyleChange={inspect().onSpecsStyleChange}
          />
        )}
      </Show>
      <HierarchyMenu position={props.hierarchyMenuPosition ?? null} state={props.hierarchyState} />
    </>
  );
};
