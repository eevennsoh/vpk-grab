import {
  createEffect,
  createMemo,
  createSignal,
  For,
  on,
  onCleanup,
  onMount,
  type Component,
} from "solid-js";
import type { AnnotationTool, Position } from "../../types.js";
import { cn } from "../../utils/cn.js";
import { loadToolbarState, saveToolbarState, type SnapEdge, type ToolbarState } from "./state.js";
import { IconSelect } from "../icons/icon-select.jsx";
import { IconClear } from "../icons/icon-clear.jsx";
import { IconMove } from "../icons/icon-move.jsx";
import { ToolbarRevealGroup } from "./toolbar-reveal-group.jsx";
import { IconPen } from "../icons/icon-pen.jsx";
import { IconRedlines } from "../icons/icon-redlines.jsx";
import { IconSpecs } from "../icons/icon-specs.jsx";
import { IconText } from "../icons/icon-text.jsx";
import { ToolbarActionButton } from "./toolbar-action-button.jsx";
import {
  TOOLBAR_SNAP_MARGIN_PX,
  TOOLBAR_FADE_IN_DELAY_MS,
  TOOLBAR_ANNOTATION_ACTIONS_HIDE_DURATION_MS,
  TOOLBAR_ANNOTATION_ACTIONS_REVEAL_DURATION_MS,
  TOOLBAR_COLLAPSE_ANIMATION_DURATION_MS,
  TOOLBAR_DEFAULT_WIDTH_PX,
  TOOLBAR_DEFAULT_HEIGHT_PX,
  TOOLBAR_DEFAULT_POSITION_RATIO,
  Z_INDEX_OVERLAY,
  SELECT_ICON_NATURAL_POINT_ANGLE_DEG,
  SELECT_ICON_POINT_MIN_DISTANCE_PX,
  DEFAULT_ACTION_ID,
  ANNOTATION_COLOR_OPTIONS,
} from "../../constants.js";
import { freezeUpdates } from "../../utils/freeze-updates.js";
import {
  freezeGlobalInteractions,
  unfreezeGlobalInteractions,
} from "../../utils/freeze-global-interactions.js";
import { ToolbarContent } from "./toolbar-content.js";
import { getVisualViewport } from "../../utils/get-visual-viewport.js";
import { getScopeContainer, ignoreRealInput } from "../../utils/runtime-mode.js";
import { nativeCancelAnimationFrame, nativeRequestAnimationFrame } from "../../utils/native-raf.js";
import {
  calculateExpandedPositionFromCollapsed,
  getCollapsedDimsForEdge,
  getCollapsedPosition,
  getPositionFromEdgeAndRatio,
  getRatioFromPosition,
  isHorizontalEdge,
} from "../../utils/toolbar-position.js";
import { createToolbarDrag } from "../../utils/create-toolbar-drag.js";
import { accumulateRotationDeg } from "../../utils/accumulate-rotation.js";

interface ToolbarProps {
  isActive?: boolean;
  isContextMenuOpen?: boolean;
  onToggle?: () => void;
  activeActionId?: string | null;
  defaultActionId?: string;
  defaultActionLabel?: string;
  enabled?: boolean;
  shakeCount?: number;
  onStateChange?: (state: ToolbarState) => void;
  onSubscribeToStateChanges?: (callback: (state: ToolbarState) => void) => () => void;
  onSelectHoverChange?: (isHovered: boolean) => void;
  onContainerRef?: (element: HTMLDivElement) => void;
  onToggleToolbarMenu?: () => void;
  isSpecsEnabled?: boolean;
  isRedlinesEnabled?: boolean;
  annotationTool?: AnnotationTool;
  annotationColor?: string;
  hasAnnotations?: boolean;
  hasSelectedAnnotation?: boolean;
  onToggleSpecs?: () => void;
  onToggleRedlines?: () => void;
  onSelectAnnotationTool?: (tool: AnnotationTool) => void;
  onSelectAnnotationColor?: (color: string) => void;
  onClearAnnotations?: () => void;
  styleChangeCount?: number;
  onToggleChangesMenu?: () => void;
}

const SPECS_ACTION_ID = "inspect-specs";
const REDLINES_ACTION_ID = "inspect-redlines";
const PEN_ACTION_ID = "annotate-pen";
const TEXT_ACTION_ID = "annotate-text";
const EDIT_ACTION_ID = "annotate-edit";
const CLEAR_ACTION_ID = "annotate-clear";
const CHANGES_ACTION_ID = "style-changes";
const ANNOTATION_COLOR_ACTION_ID_PREFIX = "annotation-color-";

export const Toolbar: Component<ToolbarProps> = (props) => {
  let containerRef: HTMLDivElement | undefined;
  let selectButtonRef: HTMLButtonElement | undefined;
  let unfreezeUpdatesCallback: (() => void) | null = null;

  const savedState = loadToolbarState();

  const [isVisible, setIsVisible] = createSignal(false);
  const [isCollapsed, setIsCollapsed] = createSignal(false);
  const [isResizing, setIsResizing] = createSignal(false);
  const [snapEdge, setSnapEdge] = createSignal<SnapEdge>(savedState?.edge ?? "bottom");
  const [positionRatio, setPositionRatio] = createSignal(
    savedState?.ratio ?? TOOLBAR_DEFAULT_POSITION_RATIO,
  );
  const [position, setPosition] = createSignal({ x: 0, y: 0 });
  const [isShaking, setIsShaking] = createSignal(false);
  const [isCollapseAnimating, setIsCollapseAnimating] = createSignal(false);
  const [revealGroupMotion, setRevealGroupMotion] = createSignal<"revealing" | "hiding" | null>(
    null,
  );
  const [isChevronPressed, setIsChevronPressed] = createSignal(false);
  const [isToolbarHovered, setIsToolbarHovered] = createSignal(false);
  const [selectIconRotationDeg, setSelectIconRotationDeg] = createSignal(0);
  const [hoveredActionId, setHoveredActionId] = createSignal<string | null>(null);

  const releaseInteractionFreeze = () => {
    unfreezeUpdatesCallback?.();
    unfreezeUpdatesCallback = null;
    // While grab mode is active, core owns the global freeze and releases it
    // on deactivation; only release it when this hover latch is the sole owner.
    if (!props.isActive) unfreezeGlobalInteractions();
  };

  const drag = createToolbarDrag({
    getContainerRef: () => containerRef,
    isCollapsed,
    getExpandedDimensions: () => expandedDimensions,
    onDragStart: () => {
      // Pointer capture during a drag suppresses the button's mouseleave, so
      // clear the hover here or the tooltip flashes at the snapped position
      // once isDragging/isSnapping settle.
      setHoveredActionId(null);
      if (unfreezeUpdatesCallback) releaseInteractionFreeze();
    },
    onPositionUpdate: (newPosition) => setPosition(newPosition),
    onSnapEdgeChange: (edge, ratio) => {
      syncCollapsedDimensionsToEdge(snapEdge(), edge);
      setSnapEdge(edge);
      setPositionRatio(ratio);
    },
    onSnapComplete: (result) => {
      expandedDimensions = result.expandedDimensions;
      setPosition(result.position);
      saveAndNotify({
        edge: result.edge,
        ratio: result.ratio,
        collapsed: isCollapsed(),
        enabled: !isCollapsed(),
      });
    },
  });

  const isVertical = () => !isHorizontalEdge(snapEdge());

  const buttonSpacingClass = () => (isVertical() ? "mb-1.5" : "mr-1.5");

  // Activation paths that bypass the toolbar button use the implicit Copy flow,
  // while toolbar activation tracks the selected default action explicitly.
  const currentActionId = () => props.defaultActionId ?? DEFAULT_ACTION_ID;
  const currentActionLabel = () => props.defaultActionLabel ?? "Copy";
  const isCurrentActionActive = () =>
    Boolean(props.isActive) && (props.activeActionId ?? DEFAULT_ACTION_ID) === currentActionId();

  const isActionHovered = (actionId: string) =>
    hoveredActionId() === actionId &&
    !isCollapsed() &&
    !drag.isDragging() &&
    !drag.isSnapping() &&
    !props.isContextMenuOpen;
  const isTooltipVisible = (actionId: string) => isActionHovered(actionId) && !props.isActive;
  const isGrabTool = () => (props.annotationTool ?? "grab") === "grab";
  const tooltipPosition = (): "top" | "bottom" | "left" | "right" => {
    switch (snapEdge()) {
      case "top":
        return "bottom";
      case "bottom":
        return "top";
      case "left":
        return "right";
      case "right":
        return "left";
      default:
        return "top";
    }
  };

  const stopEventPropagation = (event: Event) => {
    event.stopImmediatePropagation();
  };

  const createFreezeHandlers = (getActionId: () => string) => ({
    onMouseEnter: (event: MouseEvent) => {
      if (drag.isDragging()) return;
      setHoveredActionId(getActionId());
      if (!unfreezeUpdatesCallback) {
        unfreezeUpdatesCallback = freezeUpdates();
        freezeGlobalInteractions(event.clientX, event.clientY);
      }
    },
    onMouseLeave: () => {
      const actionId = getActionId();
      setHoveredActionId((current) => (current === actionId ? null : current));
      if (!props.isActive && !props.isContextMenuOpen) {
        releaseInteractionFreeze();
      }
    },
  });

  createEffect(
    on(
      () => props.shakeCount,
      (count) => {
        if (count && !props.enabled) {
          setIsShaking(true);
        }
      },
    ),
  );

  createEffect(
    on(
      () => [props.isActive, props.isContextMenuOpen] as const,
      ([isActive, isContextMenuOpen]) => {
        if (!isActive && !isContextMenuOpen && unfreezeUpdatesCallback) {
          releaseInteractionFreeze();
        }
      },
    ),
  );

  createEffect(
    on(
      () => isCurrentActionActive(),
      (didCurrentActionBecomeActive) => {
        if (!didCurrentActionBecomeActive) {
          // The accumulator can drift past ±180° while the user circles the
          // toolbar; resetting to literal 0 would unspin those revolutions
          // through the CSS transition. Snapping to the nearest equivalent
          // of 0° keeps the ease-back to a shortest-path arc.
          setSelectIconRotationDeg((previousRotationDeg) =>
            accumulateRotationDeg(previousRotationDeg, 0),
          );
          return;
        }

        let pointerFrameId: number | null = null;
        let latestPointerX = 0;
        let latestPointerY = 0;
        const updateSelectIconRotation = () => {
          pointerFrameId = null;
          if (!selectButtonRef) return;
          const rect = selectButtonRef.getBoundingClientRect();
          const centerX = rect.left + rect.width / 2;
          const centerY = rect.top + rect.height / 2;
          const deltaX = latestPointerX - centerX;
          const deltaY = latestPointerY - centerY;
          if (Math.hypot(deltaX, deltaY) < SELECT_ICON_POINT_MIN_DISTANCE_PX) return;
          const targetAngleDeg = (Math.atan2(deltaY, deltaX) * 180) / Math.PI;
          const desiredRotationDeg = targetAngleDeg - SELECT_ICON_NATURAL_POINT_ANGLE_DEG;
          setSelectIconRotationDeg((previousRotationDeg) =>
            accumulateRotationDeg(previousRotationDeg, desiredRotationDeg),
          );
        };

        const handlePointerMove = ignoreRealInput((event: PointerEvent | MouseEvent) => {
          latestPointerX = event.clientX;
          latestPointerY = event.clientY;
          if (pointerFrameId !== null) return;
          pointerFrameId = nativeRequestAnimationFrame(updateSelectIconRotation);
        });

        window.addEventListener("pointermove", handlePointerMove, { passive: true });
        onCleanup(() => {
          window.removeEventListener("pointermove", handlePointerMove);
          if (pointerFrameId !== null) nativeCancelAnimationFrame(pointerFrameId);
        });
      },
    ),
  );

  const endToolbarHover = () => {
    setIsToolbarHovered(false);
    props.onSelectHoverChange?.(false);
  };

  // mouseleave alone cannot be trusted to end a hover: the browser sends none
  // when the pointer's next target cannot be hit, which is what a pointer
  // leaving in the frame the page freezes finds. A hover that never ends
  // keeps the selection suppressed for the rest of the session, so while one
  // is open, any pointer move that lands outside the toolbar ends it too.
  createEffect(
    on(isToolbarHovered, (isHovered) => {
      if (!isHovered) return;
      const handlePointerMove = ignoreRealInput((event: PointerEvent) => {
        if (drag.isDragging() || drag.isSnapping()) return;
        if (containerRef && event.composedPath().includes(containerRef)) return;
        endToolbarHover();
      });
      window.addEventListener("pointermove", handlePointerMove, { capture: true, passive: true });
      onCleanup(() => {
        window.removeEventListener("pointermove", handlePointerMove, { capture: true });
      });
    }),
  );

  let expandedDimensions = {
    width: TOOLBAR_DEFAULT_WIDTH_PX,
    height: TOOLBAR_DEFAULT_HEIGHT_PX,
  };
  const [collapsedDimensions, setCollapsedDimensions] = createSignal(
    getCollapsedDimsForEdge(snapEdge()),
  );

  const syncCollapsedDimensionsToEdge = (oldEdge: SnapEdge, newEdge: SnapEdge): void => {
    if (isHorizontalEdge(oldEdge) === isHorizontalEdge(newEdge)) return;
    setCollapsedDimensions(getCollapsedDimsForEdge(newEdge));
  };

  const getExpandedFromCollapsed = (
    collapsedPosition: Position,
    edge: SnapEdge,
  ): { position: Position; ratio: number } => {
    const actualRect = containerRef?.getBoundingClientRect();
    const fallback = getCollapsedDimsForEdge(edge);
    return calculateExpandedPositionFromCollapsed(
      collapsedPosition,
      edge,
      expandedDimensions,
      actualRect?.width ?? fallback.width,
      actualRect?.height ?? fallback.height,
    );
  };

  const recalculatePosition = () => {
    const newPosition = getPositionFromEdgeAndRatio(
      snapEdge(),
      positionRatio(),
      expandedDimensions.width,
      expandedDimensions.height,
    );
    setPosition(newPosition);
  };

  const handleToggle = drag.createDragAwareHandler(() => props.onToggle?.());
  const handleToggleSpecs = drag.createDragAwareHandler(() => props.onToggleSpecs?.());
  const handleToggleRedlines = drag.createDragAwareHandler(() => props.onToggleRedlines?.());
  const handleSelectPen = drag.createDragAwareHandler(() => props.onSelectAnnotationTool?.("pen"));
  const handleSelectText = drag.createDragAwareHandler(() =>
    props.onSelectAnnotationTool?.("text"),
  );
  const handleSelectEdit = drag.createDragAwareHandler(() =>
    props.onSelectAnnotationTool?.("edit"),
  );
  const handleClearAnnotations = drag.createDragAwareHandler(() => props.onClearAnnotations?.());
  const handleToggleChangesMenu = drag.createDragAwareHandler(() => props.onToggleChangesMenu?.());
  const isColorTool = () => props.annotationTool === "pen" || props.annotationTool === "text";
  // Move and Clear act on annotations, so they join the toolbar with the first
  // one and leave with the last. Changes does the same with style overrides.
  const hasAnnotationActions = () => Boolean(props.hasAnnotations);
  const hasStyleChanges = () => (props.styleChangeCount ?? 0) > 0;
  const separatorClass = () =>
    cn(
      "shrink-0 bg-[var(--rg-border-button)]",
      isVertical() ? "h-px w-3 mb-1.5" : "w-px h-3 mr-1.5",
    );
  const actionButtonClass =
    "group contain-layout flex items-center justify-center cursor-pointer interactive-scale a11y-hitbox";
  const actionButtonWrapperClass = () =>
    cn("relative contain-layout flex items-center justify-center", buttonSpacingClass());
  const actionIconClass = (isActive: boolean) =>
    isActive
      ? "text-[var(--rg-text-primary)]"
      : "text-[var(--rg-text-secondary)] group-hover:text-[var(--rg-text-primary)]";

  const handleToggleCollapse = drag.createDragAwareHandler(() => {
    if (isCollapsed()) {
      expandToolbarFromCollapsed();
      return;
    }

    const rect = containerRef?.getBoundingClientRect();
    const currentRatio = positionRatio();
    if (rect) {
      expandedDimensions = { width: rect.width, height: rect.height };
    }

    setIsCollapseAnimating(true);
    setIsCollapsed(true);

    saveAndNotify({
      edge: snapEdge(),
      ratio: currentRatio,
      collapsed: true,
      enabled: false,
    });

    scheduleCollapseAnimationEnd();
  });

  const computeCollapsedPosition = (): Position =>
    getCollapsedPosition(snapEdge(), position(), expandedDimensions, collapsedDimensions());

  let resizeTimeout: ReturnType<typeof setTimeout> | undefined;
  let collapseAnimationTimeout: ReturnType<typeof setTimeout> | undefined;

  let lastObservedExpandedSize: { width: number; height: number } | null = null;

  // Both directions need to refresh their cached dimensions: collapsing
  // updates collapsedDimensions for the next expand-from-collapsed offset
  // calculation, and expanding updates expandedDimensions so handleResize
  // and getExpandedFromCollapsed don't keep using the fallback dimensions that
  // got cached when the toolbar mounted with savedState.collapsed=true and
  // an unmeasurable rect.
  const captureDimensionsAfterAnimation = () => {
    const finalRect = containerRef?.getBoundingClientRect();
    if (!finalRect || finalRect.width === 0 || finalRect.height === 0) return;
    if (isCollapsed()) {
      setCollapsedDimensions({ width: finalRect.width, height: finalRect.height });
    } else {
      expandedDimensions = { width: finalRect.width, height: finalRect.height };
      lastObservedExpandedSize = { width: finalRect.width, height: finalRect.height };
    }
  };

  const scheduleCollapseAnimationEnd = (): void => {
    if (collapseAnimationTimeout) {
      clearTimeout(collapseAnimationTimeout);
    }
    collapseAnimationTimeout = setTimeout(() => {
      setIsCollapseAnimating(false);
      captureDimensionsAfterAnimation();
    }, TOOLBAR_COLLAPSE_ANIMATION_DURATION_MS);
  };

  const expandToolbarFromCollapsed = (): void => {
    const { position: expandedPosition, ratio: newRatio } = getExpandedFromCollapsed(
      currentPosition(),
      snapEdge(),
    );
    setPosition(expandedPosition);
    setPositionRatio(newRatio);
    setIsCollapseAnimating(true);
    setIsCollapsed(false);
    saveAndNotify({
      edge: snapEdge(),
      ratio: newRatio,
      collapsed: false,
      enabled: true,
    });
    scheduleCollapseAnimationEnd();
  };

  // The first onMount measurement can fire before the shadow DOM host is
  // attached to <body> (mountRoot defers attachment to DOMContentLoaded while
  // the renderer's dynamic import can resolve earlier), or before fonts/CSS
  // have settled - both leave getBoundingClientRect returning a 0 rect. The
  // observer adopts the real size once layout commits and re-anchors the
  // toolbar to its saved/default ratio so it lands on the correct edge slot
  // instead of the off-screen position derived from a 0-width measurement.
  const handleObservedSizeChange = (newWidth: number, newHeight: number) => {
    if (newWidth === 0 || newHeight === 0) return;
    if (drag.isDragging() || drag.isSnapping()) return;
    if (isCollapseAnimating() || revealGroupMotion() !== null) return;

    if (isCollapsed()) {
      const currentCollapsed = collapsedDimensions();
      if (currentCollapsed.width === newWidth && currentCollapsed.height === newHeight) return;
      setCollapsedDimensions({ width: newWidth, height: newHeight });
      return;
    }

    if (
      lastObservedExpandedSize &&
      lastObservedExpandedSize.width === newWidth &&
      lastObservedExpandedSize.height === newHeight
    ) {
      return;
    }
    lastObservedExpandedSize = { width: newWidth, height: newHeight };
    expandedDimensions = { width: newWidth, height: newHeight };
    setPosition(getPositionFromEdgeAndRatio(snapEdge(), positionRatio(), newWidth, newHeight));
  };

  // The toolbar is held at a point along its edge, so a change in length has
  // to move it as well. Left to the resize observer, the group would open
  // from one end and the toolbar drift back into place afterwards. Its final
  // length is known up front, so the toolbar is sent straight to where that
  // length belongs and travels there over the same time and curve as the
  // group opens: both ends move apart, and the middle stays put.
  let revealGroupMotionTimeout: ReturnType<typeof setTimeout> | undefined;
  const trackRevealGroup = (
    isRevealed: () => boolean,
    getGroupElement: () => HTMLDivElement | undefined,
  ) => {
    // Memoized so a change that leaves the group as it was (Pen to Text, both
    // showing the colors) does not count its length a second time.
    const isGroupRevealedMemo = createMemo(isRevealed);
    createEffect(
      on(
        isGroupRevealedMemo,
        (isGroupRevealed) => {
          const content = getGroupElement()?.firstElementChild;
          if (!content) return;
          const lengthChange =
            (isGroupRevealed ? 1 : -1) *
            (isVertical() ? content.scrollHeight : content.scrollWidth);
          expandedDimensions = {
            width: expandedDimensions.width + (isVertical() ? 0 : lengthChange),
            height: expandedDimensions.height + (isVertical() ? lengthChange : 0),
          };
          lastObservedExpandedSize = { ...expandedDimensions };
          if (isCollapsed()) return;

          setRevealGroupMotion(isGroupRevealed ? "revealing" : "hiding");
          recalculatePosition();
          clearTimeout(revealGroupMotionTimeout);
          revealGroupMotionTimeout = setTimeout(
            () => setRevealGroupMotion(null),
            isGroupRevealed
              ? TOOLBAR_ANNOTATION_ACTIONS_REVEAL_DURATION_MS
              : TOOLBAR_ANNOTATION_ACTIONS_HIDE_DURATION_MS,
          );
        },
        { defer: true },
      ),
    );
  };
  let annotationColorsRef: HTMLDivElement | undefined;
  let annotationActionsRef: HTMLDivElement | undefined;
  let changesActionsRef: HTMLDivElement | undefined;
  trackRevealGroup(isColorTool, () => annotationColorsRef);
  trackRevealGroup(hasAnnotationActions, () => annotationActionsRef);
  trackRevealGroup(hasStyleChanges, () => changesActionsRef);

  // In scoped mode the toolbar is anchored to a container whose viewport box
  // moves as the page scrolls, so it must re-anchor on scroll. Repositioning
  // only (no ratio/resize dance) keeps it glued to the container edge.
  // rAF-coalesced: scroll events fire per frame (and from every nested
  // scroller, since the listener captures), but one reposition per frame is
  // all the anchor needs.
  let scopedScrollFrameId: number | null = null;
  const handleScopedScroll = () => {
    if (drag.isDragging() || drag.isSnapping()) return;
    if (scopedScrollFrameId !== null) return;
    scopedScrollFrameId = nativeRequestAnimationFrame(() => {
      scopedScrollFrameId = null;
      recalculatePosition();
    });
  };

  const handleResize = () => {
    if (drag.isDragging()) return;

    setIsResizing(true);
    recalculatePosition();

    if (resizeTimeout) {
      clearTimeout(resizeTimeout);
    }

    resizeTimeout = setTimeout(() => {
      setIsResizing(false);

      const newRatio = getRatioFromPosition(
        snapEdge(),
        position().x,
        position().y,
        expandedDimensions.width,
        expandedDimensions.height,
      );
      setPositionRatio(newRatio);
      saveAndNotify({
        edge: snapEdge(),
        ratio: newRatio,
        collapsed: isCollapsed(),
        enabled: !isCollapsed(),
      });
    }, TOOLBAR_FADE_IN_DELAY_MS);
  };

  const saveAndNotify = (state: ToolbarState) => {
    const stateWithDefaultAction: ToolbarState = {
      ...state,
      defaultAction: currentActionId(),
    };
    saveToolbarState(stateWithDefaultAction);
    props.onStateChange?.(stateWithDefaultAction);
  };

  onMount(() => {
    if (containerRef) {
      props.onContainerRef?.(containerRef);
    }

    const rect = containerRef?.getBoundingClientRect();
    const viewport = getVisualViewport();
    // The host's shadow DOM may still be detached from <body> when this
    // synchronous measurement runs (mountRoot defers attachment to
    // DOMContentLoaded, the renderer's dynamic import can resolve earlier).
    // A detached element returns a 0 rect, which would poison
    // expandedDimensions and place the toolbar off-screen. The ResizeObserver
    // installed below adopts the real size as soon as layout commits.
    const hasMeasurableRect = Boolean(rect && rect.width > 0 && rect.height > 0);

    // Because isCollapsed defaults to false the element is always rendered
    // expanded on initial mount, so rect reflects expanded dimensions here
    // regardless of savedState.collapsed. Using it for collapsed dimensions
    // would make the toolbar too wide after restoring a collapsed state.
    if (savedState) {
      if (hasMeasurableRect && rect) {
        expandedDimensions = { width: rect.width, height: rect.height };
      }
      setIsCollapsed(savedState.collapsed);
      const newPosition = getPositionFromEdgeAndRatio(
        savedState.edge,
        savedState.ratio,
        expandedDimensions.width,
        expandedDimensions.height,
      );
      setPosition(newPosition);
    } else if (hasMeasurableRect && rect) {
      expandedDimensions = { width: rect.width, height: rect.height };
      setPosition({
        x: viewport.offsetLeft + (viewport.width - rect.width) / 2,
        y: viewport.offsetTop + viewport.height - rect.height - TOOLBAR_SNAP_MARGIN_PX,
      });
      setPositionRatio(TOOLBAR_DEFAULT_POSITION_RATIO);
    } else {
      const defaultPosition = getPositionFromEdgeAndRatio(
        "bottom",
        TOOLBAR_DEFAULT_POSITION_RATIO,
        expandedDimensions.width,
        expandedDimensions.height,
      );
      setPosition(defaultPosition);
      setPositionRatio(TOOLBAR_DEFAULT_POSITION_RATIO);
    }

    if (props.onSubscribeToStateChanges) {
      const unsubscribe = props.onSubscribeToStateChanges((state: ToolbarState) => {
        if (isCollapseAnimating()) return;

        const rect = containerRef?.getBoundingClientRect();
        if (!rect) return;

        const didCollapsedChange = isCollapsed() !== state.collapsed;

        syncCollapsedDimensionsToEdge(snapEdge(), state.edge);
        setSnapEdge(state.edge);

        if (didCollapsedChange && !state.collapsed) {
          const collapsedPos = currentPosition();
          setIsCollapseAnimating(true);
          setIsCollapsed(state.collapsed);
          const { position: expandedPosition, ratio: newRatio } = getExpandedFromCollapsed(
            collapsedPos,
            state.edge,
          );
          setPosition(expandedPosition);
          setPositionRatio(newRatio);
          scheduleCollapseAnimationEnd();
        } else {
          if (didCollapsedChange) {
            setIsCollapseAnimating(true);
            scheduleCollapseAnimationEnd();
          }
          setIsCollapsed(state.collapsed);
          const newPosition = getPositionFromEdgeAndRatio(
            state.edge,
            state.ratio,
            expandedDimensions.width,
            expandedDimensions.height,
          );
          setPosition(newPosition);
          setPositionRatio(state.ratio);
        }
      });

      onCleanup(unsubscribe);
    }

    window.addEventListener("resize", handleResize);
    window.visualViewport?.addEventListener("resize", handleResize);
    window.visualViewport?.addEventListener("scroll", handleResize);
    // Scoped re-anchoring only matters when init() was given a container
    // (`container` is public library API, not demo-only); unscoped pages —
    // the normal case — register nothing and pay nothing on scroll. The scope
    // is init-only and set before the renderer mounts, so checking once here
    // (and in the matching cleanup) is stable.
    const scopeContainer = getScopeContainer();
    if (scopeContainer) {
      window.addEventListener("scroll", handleScopedScroll, { passive: true, capture: true });
      // The container's box is the toolbar's viewport, so a layout-only
      // container resize (e.g. a responsive aspect-ratio change) must
      // re-anchor just like a scroll does.
      if (typeof ResizeObserver !== "undefined") {
        const scopeResizeObserver = new ResizeObserver(handleScopedScroll);
        scopeResizeObserver.observe(scopeContainer);
        onCleanup(() => scopeResizeObserver.disconnect());
      }
    }

    if (typeof ResizeObserver !== "undefined" && containerRef) {
      const observer = new ResizeObserver((entries) => {
        const entry = entries[0];
        if (!entry) return;
        // entry.contentRect reports content-box, which omits padding; the rest
        // of the toolbar measures border-box via getBoundingClientRect, so
        // mixing them would underestimate the toolbar by its `px-2 py-1.5`
        // padding. borderBoxSize is widely supported (Chrome 84+, Safari 15.4+,
        // Firefox 69+); fall back to getBoundingClientRect for older runtimes.
        const borderBox = entry.borderBoxSize?.[0];
        let width: number;
        let height: number;
        if (borderBox) {
          width = borderBox.inlineSize;
          height = borderBox.blockSize;
        } else {
          const rect = containerRef?.getBoundingClientRect();
          if (!rect) return;
          width = rect.width;
          height = rect.height;
        }
        handleObservedSizeChange(width, height);
      });
      observer.observe(containerRef);
      onCleanup(() => observer.disconnect());
    }

    const fadeInTimeout = setTimeout(() => {
      setIsVisible(true);
    }, TOOLBAR_FADE_IN_DELAY_MS);

    onCleanup(() => {
      clearTimeout(fadeInTimeout);
    });
  });

  onCleanup(() => {
    window.removeEventListener("resize", handleResize);
    window.visualViewport?.removeEventListener("resize", handleResize);
    window.visualViewport?.removeEventListener("scroll", handleResize);
    // Unconditional: removing a never-added listener is a no-op, and the scope
    // singleton may already be cleared by init's own cleanup at this point.
    window.removeEventListener("scroll", handleScopedScroll, { capture: true });
    if (scopedScrollFrameId !== null) nativeCancelAnimationFrame(scopedScrollFrameId);
    clearTimeout(resizeTimeout);
    clearTimeout(collapseAnimationTimeout);
    clearTimeout(revealGroupMotionTimeout);

    if (unfreezeUpdatesCallback) releaseInteractionFreeze();
  });

  const currentPosition = () => {
    const collapsed = isCollapsed();
    return collapsed ? computeCollapsedPosition() : position();
  };

  const getCursorClass = (): string => {
    if (isCollapsed()) {
      return "cursor-pointer";
    }
    if (drag.isDragging()) {
      return "cursor-grabbing";
    }
    return "cursor-grab";
  };

  const isInteracting = (): boolean =>
    isToolbarHovered() ||
    Boolean(props.isContextMenuOpen) ||
    drag.isDragging() ||
    drag.isSnapping() ||
    isCollapseAnimating() ||
    isChevronPressed();

  // Drawing and writing keep the toolbar at full strength: its colors and
  // tools are what the pen and text work from.
  const shouldDim = (): boolean => Boolean(props.isActive) && !isInteracting() && !isColorTool();

  const getTransitionClass = (): string => {
    // Drag must follow the pointer frame-to-frame; any transform transition
    // here would lag the toolbar behind the cursor.
    if (isResizing() || drag.isDragging()) {
      return "";
    }
    if (drag.isSnapping()) {
      return "transition-[transform,opacity] duration-300 ease-out";
    }
    if (isCollapseAnimating()) {
      const duration = isCollapsed() ? "duration-140" : "duration-220";
      return `transition-[transform,opacity] ${duration} ease-drawer`;
    }
    const groupMotion = revealGroupMotion();
    if (groupMotion !== null) {
      const duration = groupMotion === "revealing" ? "duration-220" : "duration-140";
      return `transition-[transform,opacity] ${duration} ease-drawer`;
    }
    return "transition-[transform,opacity] duration-400 ease-drawer";
  };

  const getTransformOrigin = (): string => {
    const edge = snapEdge();
    switch (edge) {
      case "top":
        return "center top";
      case "bottom":
        return "center bottom";
      case "left":
        return "left center";
      case "right":
        return "right center";
      default:
        return "center center";
    }
  };

  return (
    <div
      ref={containerRef}
      data-react-grab-ignore-events
      data-react-grab-toolbar
      class={cn(
        "fixed left-0 top-0 font-sans text-[13px] antialiased select-none",
        getCursorClass(),
        getTransitionClass(),
        // freeze-pseudo-states sets `html { pointer-events: none !important }`
        // during grab; the toolbar must opt back in to stay clickable.
        isVisible() ? "pointer-events-auto" : "pointer-events-none",
      )}
      style={{
        "z-index": String(Z_INDEX_OVERLAY),
        transform: `translate(${currentPosition().x}px, ${currentPosition().y}px) scale(${shouldDim() ? 0.97 : 1})`,
        "transform-origin": getTransformOrigin(),
        opacity: !isVisible() ? 0 : shouldDim() ? 0.55 : 1,
      }}
      on:pointerdown={(event) => {
        stopEventPropagation(event);
        drag.handlePointerDown(event);
      }}
      on:mousedown={stopEventPropagation}
      onMouseEnter={() => {
        setIsToolbarHovered(true);
        if (!isCollapsed()) props.onSelectHoverChange?.(true);
      }}
      onMouseLeave={endToolbarHover}
    >
      <ToolbarContent
        isCollapsed={isCollapsed()}
        snapEdge={snapEdge()}
        isShaking={isShaking()}
        isChevronPressed={isChevronPressed()}
        transformOrigin={getTransformOrigin()}
        onAnimationEnd={() => setIsShaking(false)}
        onCollapseClick={handleToggleCollapse}
        onCollapsePointerDown={() => setIsChevronPressed(true)}
        onCollapsePointerUp={() => setIsChevronPressed(false)}
        onCollapsePointerLeave={() => setIsChevronPressed(false)}
        onPanelClick={(event) => {
          if (isCollapsed()) {
            event.stopPropagation();
            expandToolbarFromCollapsed();
          }
        }}
        actionButtons={
          <>
            <ToolbarActionButton
              actionId={currentActionId()}
              isToggle
              ref={(element) => (selectButtonRef = element)}
              label={
                isCurrentActionActive()
                  ? "Stop selecting element"
                  : `${currentActionLabel()} element`
              }
              isActive={isCurrentActionActive() && isGrabTool()}
              class={actionButtonClass}
              wrapperClass={actionButtonWrapperClass()}
              onClick={handleToggle}
              onContextMenu={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setHoveredActionId(null);
                props.onToggleToolbarMenu?.();
              }}
              {...createFreezeHandlers(currentActionId)}
              icon={
                <IconSelect
                  size={14}
                  rotationDeg={selectIconRotationDeg()}
                  class={actionIconClass(isCurrentActionActive() && isGrabTool())}
                />
              }
              tooltipVisible={isTooltipVisible(currentActionId())}
              tooltipPosition={tooltipPosition()}
              tooltip={currentActionLabel()}
            />
            <span aria-hidden="true" class={separatorClass()} />
            <ToolbarActionButton
              actionId={SPECS_ACTION_ID}
              keepsPageFocus
              label="Show design specs on hover"
              isActive={Boolean(props.isSpecsEnabled)}
              class={actionButtonClass}
              wrapperClass={actionButtonWrapperClass()}
              onClick={handleToggleSpecs}
              {...createFreezeHandlers(() => SPECS_ACTION_ID)}
              icon={<IconSpecs size={14} class={actionIconClass(Boolean(props.isSpecsEnabled))} />}
              tooltipVisible={isActionHovered(SPECS_ACTION_ID)}
              tooltipPosition={tooltipPosition()}
              tooltip="Specs"
            />
            <ToolbarActionButton
              actionId={REDLINES_ACTION_ID}
              keepsPageFocus
              label="Show spacing redlines on hover"
              isActive={Boolean(props.isRedlinesEnabled)}
              class={actionButtonClass}
              wrapperClass={actionButtonWrapperClass()}
              onClick={handleToggleRedlines}
              {...createFreezeHandlers(() => REDLINES_ACTION_ID)}
              icon={
                <IconRedlines size={14} class={actionIconClass(Boolean(props.isRedlinesEnabled))} />
              }
              tooltipVisible={isActionHovered(REDLINES_ACTION_ID)}
              tooltipPosition={tooltipPosition()}
              tooltip="Redlines · hold Alt to measure to another element"
            />
            <ToolbarActionButton
              actionId={PEN_ACTION_ID}
              keepsPageFocus
              label="Draw on the page"
              isActive={props.annotationTool === "pen"}
              class={actionButtonClass}
              wrapperClass={actionButtonWrapperClass()}
              onClick={handleSelectPen}
              {...createFreezeHandlers(() => PEN_ACTION_ID)}
              icon={<IconPen size={14} class={actionIconClass(props.annotationTool === "pen")} />}
              tooltipVisible={isActionHovered(PEN_ACTION_ID)}
              tooltipPosition={tooltipPosition()}
              tooltip="Pen · hold Shift for a straight line"
            />
            <ToolbarActionButton
              actionId={TEXT_ACTION_ID}
              keepsPageFocus
              label="Add text to the page"
              isActive={props.annotationTool === "text"}
              class={actionButtonClass}
              wrapperClass={actionButtonWrapperClass()}
              onClick={handleSelectText}
              {...createFreezeHandlers(() => TEXT_ACTION_ID)}
              icon={<IconText size={14} class={actionIconClass(props.annotationTool === "text")} />}
              tooltipVisible={isActionHovered(TEXT_ACTION_ID)}
              tooltipPosition={tooltipPosition()}
              tooltip="Text"
            />
            <ToolbarRevealGroup
              ref={(element) => (annotationColorsRef = element)}
              dataAttribute="data-react-grab-toolbar-annotation-colors"
              isRevealed={isColorTool()}
              isVertical={isVertical()}
            >
              <span aria-hidden="true" class={separatorClass()} />
              <For each={ANNOTATION_COLOR_OPTIONS}>
                {(colorOption) => {
                  const actionId = `${ANNOTATION_COLOR_ACTION_ID_PREFIX}${colorOption.label.toLowerCase()}`;
                  const isSelected = () => props.annotationColor === colorOption.value;
                  return (
                    <ToolbarActionButton
                      actionId={actionId}
                      keepsPageFocus
                      label={`${colorOption.label} annotation color`}
                      isActive={isSelected()}
                      class={actionButtonClass}
                      wrapperClass={actionButtonWrapperClass()}
                      onClick={drag.createDragAwareHandler(() =>
                        props.onSelectAnnotationColor?.(colorOption.value),
                      )}
                      {...createFreezeHandlers(() => actionId)}
                      icon={
                        <span class="flex size-3.5 items-center justify-center">
                          <span
                            class={cn(
                              "size-2.5 rounded-full transition-shadow duration-150 ease-drawer",
                              isSelected()
                                ? "[box-shadow:0_0_0_1.5px_var(--rg-panel-bg),0_0_0_2.5px_var(--rg-text-primary)]"
                                : "[box-shadow:0_0_0_1px_var(--rg-border-button)]",
                            )}
                            style={{ "background-color": colorOption.value }}
                          />
                        </span>
                      }
                      tooltipVisible={isActionHovered(actionId)}
                      tooltipPosition={tooltipPosition()}
                      tooltip={colorOption.label}
                    />
                  );
                }}
              </For>
            </ToolbarRevealGroup>
            <ToolbarRevealGroup
              ref={(element) => (annotationActionsRef = element)}
              dataAttribute="data-react-grab-toolbar-annotation-actions"
              isRevealed={hasAnnotationActions()}
              isVertical={isVertical()}
            >
              <span aria-hidden="true" class={separatorClass()} />
              <ToolbarActionButton
                actionId={EDIT_ACTION_ID}
                keepsPageFocus
                label="Move or delete drawings and text"
                isActive={props.annotationTool === "edit"}
                class={actionButtonClass}
                wrapperClass={actionButtonWrapperClass()}
                onClick={handleSelectEdit}
                {...createFreezeHandlers(() => EDIT_ACTION_ID)}
                icon={
                  <IconMove size={14} class={actionIconClass(props.annotationTool === "edit")} />
                }
                tooltipVisible={isActionHovered(EDIT_ACTION_ID)}
                tooltipPosition={tooltipPosition()}
                tooltip="Move (v) · drag to move or box-select, Delete to remove"
              />
              <ToolbarActionButton
                actionId={CLEAR_ACTION_ID}
                keepsPageFocus
                label={
                  props.hasSelectedAnnotation
                    ? "Delete the selected annotation"
                    : "Clear drawings and text"
                }
                hasPressedState={false}
                class={actionButtonClass}
                wrapperClass={actionButtonWrapperClass()}
                onClick={handleClearAnnotations}
                {...createFreezeHandlers(() => CLEAR_ACTION_ID)}
                icon={<IconClear size={14} class={actionIconClass(false)} />}
                tooltipVisible={isActionHovered(CLEAR_ACTION_ID)}
                tooltipPosition={tooltipPosition()}
                tooltip={props.hasSelectedAnnotation ? "Delete selected" : "Clear annotations"}
              />
            </ToolbarRevealGroup>
            <ToolbarRevealGroup
              ref={(element) => (changesActionsRef = element)}
              dataAttribute="data-react-grab-toolbar-changes-actions"
              isRevealed={hasStyleChanges()}
              isVertical={isVertical()}
            >
              <span aria-hidden="true" class={separatorClass()} />
              <ToolbarActionButton
                actionId={CHANGES_ACTION_ID}
                keepsPageFocus
                label={`Style changes (${props.styleChangeCount ?? 0})`}
                hasPressedState={false}
                class={actionButtonClass}
                wrapperClass={actionButtonWrapperClass()}
                onClick={handleToggleChangesMenu}
                {...createFreezeHandlers(() => CHANGES_ACTION_ID)}
                icon={
                  <span
                    data-react-grab-changes-count
                    class="min-w-[16px] h-[16px] px-1 rounded-full bg-[var(--rg-text-primary)] text-[var(--rg-panel-bg)] text-[10px] leading-[16px] font-semibold tabular-nums text-center"
                    textContent={String(props.styleChangeCount ?? 0)}
                  />
                }
                tooltipVisible={isActionHovered(CHANGES_ACTION_ID)}
                tooltipPosition={tooltipPosition()}
                tooltip="Style changes"
              />
            </ToolbarRevealGroup>
          </>
        }
      />
    </div>
  );
};
