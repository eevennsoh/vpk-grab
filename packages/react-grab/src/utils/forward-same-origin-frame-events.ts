import { convertClientPositionToTopWindow } from "./convert-client-position-to-top-window.js";
import { registerAnimationFreezeDocument } from "./freeze-animations.js";
import { registerPseudoStateDocument } from "./freeze-pseudo-states.js";
import { observeSameOriginFrameDocuments } from "./observe-same-origin-frame-documents.js";
import { throwCollectedErrors } from "./throw-collected-errors.js";

interface FrameEventForwardingOptions {
  shouldForwardInteraction: (event: Event) => boolean;
  shouldForwardKeyboardEvent: (event: KeyboardEvent) => boolean;
  shouldForwardViewportEvent: (frameDocument: Document) => boolean;
  onInactiveFramePointerDown: (event: PointerEvent) => void;
  onFrameKeyDown: (event: KeyboardEvent) => boolean;
}

const dispatchForwardedEvent = (sourceEvent: Event, forwardedEvent: Event): void => {
  window.dispatchEvent(forwardedEvent);
  if (forwardedEvent.defaultPrevented) {
    sourceEvent.preventDefault();
    sourceEvent.stopImmediatePropagation();
  }
};

const createMouseEventInit = (
  event: MouseEvent,
  clientX: number,
  clientY: number,
): MouseEventInit => ({
  bubbles: true,
  cancelable: true,
  composed: true,
  clientX,
  clientY,
  screenX: event.screenX,
  screenY: event.screenY,
  detail: event.detail,
  button: event.button,
  buttons: event.buttons,
  altKey: event.altKey,
  ctrlKey: event.ctrlKey,
  metaKey: event.metaKey,
  shiftKey: event.shiftKey,
});

const forwardPointerEvent = (event: PointerEvent): void => {
  const topPosition = convertClientPositionToTopWindow(event.view, event.clientX, event.clientY);
  const forwardedEvent = new PointerEvent(event.type, {
    ...createMouseEventInit(event, topPosition.x, topPosition.y),
    pointerId: event.pointerId,
    pointerType: event.pointerType,
    isPrimary: event.isPrimary,
    pressure: event.pressure,
    tangentialPressure: event.tangentialPressure,
    tiltX: event.tiltX,
    tiltY: event.tiltY,
    twist: event.twist,
    width: event.width,
    height: event.height,
  });
  dispatchForwardedEvent(event, forwardedEvent);
};

const forwardMouseEvent = (event: MouseEvent): void => {
  const topPosition = convertClientPositionToTopWindow(event.view, event.clientX, event.clientY);
  const forwardedEvent = new MouseEvent(
    event.type,
    createMouseEventInit(event, topPosition.x, topPosition.y),
  );
  dispatchForwardedEvent(event, forwardedEvent);
};

const forwardKeyboardEvent = (event: KeyboardEvent): void => {
  const forwardedEvent = new KeyboardEvent(event.type, {
    bubbles: true,
    cancelable: true,
    composed: true,
    key: event.key,
    code: event.code,
    location: event.location,
    repeat: event.repeat,
    isComposing: event.isComposing,
    altKey: event.altKey,
    ctrlKey: event.ctrlKey,
    metaKey: event.metaKey,
    shiftKey: event.shiftKey,
  });
  dispatchForwardedEvent(event, forwardedEvent);
};

export const forwardSameOriginFrameEvents = (options: FrameEventForwardingOptions): (() => void) =>
  observeSameOriginFrameDocuments((frameDocument) => {
    if (frameDocument === document) return;
    const frameWindow = frameDocument.defaultView;
    if (!frameWindow) return;
    const abortController = new AbortController();
    const unregisterAnimationFreezeDocument = registerAnimationFreezeDocument(frameDocument);
    const unregisterPseudoStateDocument = registerPseudoStateDocument(frameDocument);
    const eventOptions = { capture: true, signal: abortController.signal };

    const forwardPointerEventWhenActive = (event: PointerEvent): void => {
      if (options.shouldForwardInteraction(event)) forwardPointerEvent(event);
    };
    const forwardMouseEventWhenActive = (event: MouseEvent): void => {
      if (options.shouldForwardInteraction(event)) forwardMouseEvent(event);
    };
    const forwardKeyboardEventWhenActive = (event: KeyboardEvent): void => {
      if (options.shouldForwardInteraction(event) || options.shouldForwardKeyboardEvent(event)) {
        forwardKeyboardEvent(event);
      }
    };
    const handleFrameKeyDown = (event: KeyboardEvent): void => {
      if (options.onFrameKeyDown(event)) return;
      forwardKeyboardEventWhenActive(event);
    };
    const forwardViewportEventWhenActive = (event: Event): void => {
      if (
        options.shouldForwardInteraction(event) &&
        options.shouldForwardViewportEvent(frameDocument)
      ) {
        window.dispatchEvent(new Event(event.type));
      }
    };

    const handleFramePointerDown = (event: PointerEvent): void => {
      if (options.shouldForwardInteraction(event)) forwardPointerEvent(event);
      else options.onInactiveFramePointerDown(event);
    };
    frameWindow.addEventListener("pointermove", forwardPointerEventWhenActive, eventOptions);
    frameWindow.addEventListener("pointerdown", handleFramePointerDown, eventOptions);
    frameWindow.addEventListener("pointerup", forwardPointerEventWhenActive, eventOptions);
    frameWindow.addEventListener("pointercancel", forwardPointerEventWhenActive, eventOptions);
    frameWindow.addEventListener("contextmenu", forwardMouseEventWhenActive, eventOptions);
    frameWindow.addEventListener("click", forwardMouseEventWhenActive, eventOptions);
    frameWindow.addEventListener("keydown", handleFrameKeyDown, eventOptions);
    frameWindow.addEventListener("keyup", forwardKeyboardEventWhenActive, eventOptions);
    frameWindow.addEventListener("keypress", forwardKeyboardEventWhenActive, eventOptions);
    frameWindow.addEventListener("scroll", forwardViewportEventWhenActive, eventOptions);
    frameWindow.addEventListener("resize", forwardViewportEventWhenActive, eventOptions);

    return () => {
      abortController.abort();
      const cleanupErrors: unknown[] = [];
      for (const unregisterDocument of [
        unregisterAnimationFreezeDocument,
        unregisterPseudoStateDocument,
      ]) {
        try {
          unregisterDocument();
        } catch (error) {
          cleanupErrors.push(error);
        }
      }
      throwCollectedErrors(cleanupErrors, "Cleaning up frame event forwarding failed");
    };
  });
