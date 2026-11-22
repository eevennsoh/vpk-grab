import { createEffect, createSignal, on, onCleanup, type Component, type JSX } from "solid-js";
import { cn } from "../../utils/cn.js";
import { isHorizontalEdge } from "../../utils/toolbar-position.js";
import { IconChevron } from "../icons/icon-chevron.jsx";
import {
  PAUSED_CONTENT_ENTER_DELAY_MS,
  PAUSED_CROSSFADE_DURATION_MS,
  PAUSED_CROSSFADE_EASING,
  PAUSED_MORPH_DURATION_MS,
  PAUSED_MORPH_EASING,
} from "../../constants.js";

interface ToolbarContentProps {
  isCollapsed?: boolean;
  snapEdge?: "top" | "bottom" | "left" | "right";
  isShaking?: boolean;
  isChevronPressed?: boolean;
  onAnimationEnd?: () => void;
  onPanelClick?: (event: MouseEvent) => void;
  onCollapseClick?: (event: MouseEvent) => void;
  onCollapsePointerDown?: (event: PointerEvent) => void;
  onCollapsePointerUp?: (event: PointerEvent) => void;
  onCollapsePointerLeave?: (event: PointerEvent) => void;
  actionButtons?: JSX.Element;
  transformOrigin?: string;
  isPaused?: boolean;
  pausedContent?: JSX.Element;
}

export const ToolbarContent: Component<ToolbarContentProps> = (props) => {
  const edge = () => props.snapEdge ?? "bottom";
  const isVertical = () => !isHorizontalEdge(edge());

  const sizeDurationClass = () => (props.isCollapsed ? "duration-140" : "duration-220");
  const opacityEnterClass = "transition-opacity duration-180 ease-drawer delay-[80ms]";
  const opacityExitClass = "transition-opacity duration-100 ease-drawer";

  const gridSizeTransitionClass = (): string =>
    isVertical()
      ? `transition-[grid-template-rows] ${sizeDurationClass()} ease-drawer`
      : `transition-[grid-template-columns] ${sizeDurationClass()} ease-drawer`;

  const minDimensionClass = () => (isVertical() ? "min-h-0" : "min-w-0");

  const collapsedEdgeClasses = () => {
    if (!props.isCollapsed) return "";
    const roundedClass = {
      top: "rounded-t-none rounded-b-[10px]",
      bottom: "rounded-b-none rounded-t-[10px]",
      left: "rounded-l-none rounded-r-[10px]",
      right: "rounded-r-none rounded-l-[10px]",
    }[edge()];
    const paddingClass = isVertical() ? "px-0.25 py-2" : "px-2 py-0.25";
    return `${roundedClass} ${paddingClass}`;
  };

  const chevronRotation = () => {
    const collapsed = props.isCollapsed;
    switch (edge()) {
      case "top":
        return collapsed ? "rotate-0" : "rotate-180";
      case "bottom":
        return collapsed ? "rotate-180" : "rotate-0";
      case "left":
        return collapsed ? "-rotate-90" : "rotate-90";
      case "right":
        return collapsed ? "rotate-90" : "-rotate-90";
      default:
        return "rotate-180";
    }
  };

  const pressSquishTransform = (): string | undefined => {
    if (!props.isChevronPressed) return undefined;
    return isVertical() ? "scale(0.97, 1)" : "scale(1, 0.97)";
  };

  const pausedCrossfadeTiming = `${PAUSED_CROSSFADE_DURATION_MS}ms ${PAUSED_CROSSFADE_EASING}`;
  // Set on elements with no transition of their own, so the fade never
  // replaces the collapse's size transition or a button's press scale.
  const pausedFadeStyle = () => ({
    opacity: props.isPaused ? 0 : 1,
    transition: props.isPaused
      ? `opacity ${pausedCrossfadeTiming}`
      : `opacity ${pausedCrossfadeTiming} ${PAUSED_CONTENT_ENTER_DELAY_MS}ms`,
  });

  // The surface slides its sides in until it hugs the Paused content, then
  // back out on release, so the toolbar's own box never changes size.
  let panelRef: HTMLDivElement | undefined;
  let pausedContentRef: HTMLDivElement | undefined;
  const [surfaceInsetPx, setSurfaceInsetPx] = createSignal(0);
  let surfaceMeasureFrameId: number | undefined;
  const measureSurfaceInset = () => {
    surfaceMeasureFrameId = undefined;
    if (!props.isPaused || !panelRef || !pausedContentRef) return;
    // Layout sizes ignore the toolbar's own scale, so the inset is in the
    // panel's unscaled pixels.
    const freeSpacePx = isVertical()
      ? panelRef.offsetHeight - pausedContentRef.offsetHeight
      : panelRef.offsetWidth - pausedContentRef.offsetWidth;
    setSurfaceInsetPx(Math.max(0, freeSpacePx / 2));
  };
  createEffect(
    on(
      () => props.isPaused,
      (isPaused) => {
        if (surfaceMeasureFrameId !== undefined) cancelAnimationFrame(surfaceMeasureFrameId);
        surfaceMeasureFrameId = undefined;
        if (!isPaused) {
          setSurfaceInsetPx(0);
          return;
        }
        surfaceMeasureFrameId = requestAnimationFrame(measureSurfaceInset);
      },
    ),
  );
  // The Paused content can still be settling (fonts, the label's layout)
  // when the pause starts, so the inset follows its size while paused.
  const surfaceResizeObserver = new ResizeObserver(() => {
    if (props.isPaused) measureSurfaceInset();
  });
  onCleanup(() => {
    if (surfaceMeasureFrameId !== undefined) cancelAnimationFrame(surfaceMeasureFrameId);
    surfaceResizeObserver.disconnect();
  });
  const surfaceStyle = (): JSX.CSSProperties => {
    const insetPx = `${surfaceInsetPx()}px`;
    const morphTiming = `${PAUSED_MORPH_DURATION_MS}ms ${PAUSED_MORPH_EASING}`;
    return isVertical()
      ? { top: insetPx, bottom: insetPx, transition: `top ${morphTiming}, bottom ${morphTiming}` }
      : { left: insetPx, right: insetPx, transition: `left ${morphTiming}, right ${morphTiming}` };
  };

  const outerTransitionClass = () =>
    props.isChevronPressed
      ? `transition-[padding,border-radius,transform] duration-60 ease-[cubic-bezier(0,0,0.2,1)]`
      : `transition-[padding,border-radius,transform] ${sizeDurationClass()} ease-drawer`;

  return (
    <div
      data-react-grab-toolbar-panel
      class={cn(
        // rounded-full is calc(infinity * 1px); transitioning border-radius
        // from that clamped huge value to the collapsed 10px/0 stays pill-
        // shaped for the whole duration and snaps on the last frame. 13px is
        // half the expanded 26px thickness, so it renders identically to
        // rounded-full but interpolates visibly in sync with the collapse.
        "flex items-center justify-center rounded-[13px] antialiased relative isolate overflow-visible [font-synthesis:none]",
        outerTransitionClass(),
        isVertical() && "flex-col",
        !props.isCollapsed && (isVertical() ? "px-1.5 gap-0 py-2" : "py-1.5 gap-0 px-2"),
        collapsedEdgeClasses(),
        props.isShaking && (isVertical() ? "animate-shake-vertical" : "animate-shake"),
      )}
      ref={(element) => {
        panelRef = element;
        surfaceResizeObserver.observe(element);
      }}
      style={{ "transform-origin": props.transformOrigin, transform: pressSquishTransform() }}
      onAnimationEnd={props.onAnimationEnd}
      onClick={props.onPanelClick}
    >
      <div
        data-react-grab-toolbar-surface
        aria-hidden="true"
        class="absolute inset-0 -z-10 rounded-[inherit] bg-[var(--rg-panel-bg)] [box-shadow:var(--rg-shadow)] pointer-events-none"
        style={surfaceStyle()}
      />
      <div
        inert={props.isPaused}
        class={cn(
          "grid relative overflow-visible",
          gridSizeTransitionClass(),
          props.isCollapsed
            ? isVertical()
              ? "grid-rows-[0fr] pointer-events-none"
              : "grid-cols-[0fr] pointer-events-none"
            : isVertical()
              ? "grid-rows-[1fr]"
              : "grid-cols-[1fr]",
        )}
      >
        <div
          class={cn(
            "flex",
            isVertical() ? "flex-col items-center min-h-0" : "items-center min-w-0",
            props.isCollapsed ? "opacity-0" : "opacity-100",
            props.isCollapsed ? opacityExitClass : opacityEnterClass,
          )}
        >
          <div
            class={cn(
              "relative overflow-visible flex",
              isVertical() ? "flex-col items-center" : "items-center",
              minDimensionClass(),
            )}
            style={pausedFadeStyle()}
          >
            {props.actionButtons}
          </div>
        </div>
      </div>
      <button
        inert={props.isPaused}
        data-react-grab-ignore-events
        data-react-grab-toolbar-collapse
        aria-label={props.isCollapsed ? "Expand toolbar" : "Collapse toolbar"}
        aria-expanded={!props.isCollapsed}
        type="button"
        class="group contain-layout shrink-0 flex items-center justify-center cursor-pointer interactive-scale a11y-hitbox"
        onClick={props.onCollapseClick}
        on:pointerdown={props.onCollapsePointerDown}
        onPointerUp={props.onCollapsePointerUp}
        onPointerLeave={props.onCollapsePointerLeave}
        onPointerCancel={props.onCollapsePointerLeave}
      >
        <span class="flex" style={pausedFadeStyle()}>
          <IconChevron
            size={18}
            class={cn(
              "text-[var(--rg-text-secondary)] group-hover:text-[var(--rg-text-primary)] transition-[transform,color] duration-150 ease-drawer -m-0.5",
              chevronRotation(),
            )}
          />
        </span>
      </button>
      <div
        data-react-grab-toolbar-paused-content
        aria-hidden={props.isPaused ? undefined : "true"}
        ref={(element) => {
          pausedContentRef = element;
          surfaceResizeObserver.observe(element);
        }}
        class={cn(
          "absolute inset-0 m-auto flex items-center justify-center gap-1 rounded-[13px]",
          isVertical() ? "w-full h-fit py-2" : "h-full w-fit px-2.5",
        )}
        style={{
          opacity: props.isPaused ? 1 : 0,
          visibility: props.isPaused ? "visible" : "hidden",
          "pointer-events": props.isPaused ? "auto" : "none",
          transition: props.isPaused
            ? `opacity ${pausedCrossfadeTiming} ${PAUSED_CONTENT_ENTER_DELAY_MS}ms, visibility 0ms`
            : `opacity ${pausedCrossfadeTiming}, visibility ${pausedCrossfadeTiming}`,
        }}
      >
        {props.pausedContent}
      </div>
    </div>
  );
};
