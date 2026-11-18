import { createSignal } from "solid-js";

interface OverlayDismissHandler {
  isOpen: () => boolean;
  onEscape: (event: KeyboardEvent) => boolean;
}

const [registeredHandlers, setRegisteredHandlers] = createSignal<OverlayDismissHandler[]>([]);

export const overlayDismiss = {
  register: (handler: OverlayDismissHandler) => {
    setRegisteredHandlers((currentHandlers) => [...currentHandlers, handler]);
    return () =>
      setRegisteredHandlers((currentHandlers) =>
        currentHandlers.filter((currentHandler) => currentHandler !== handler),
      );
  },
  isOpen: () => {
    for (const handler of registeredHandlers()) {
      if (handler.isOpen()) return true;
    }
    return false;
  },
  onEscape: (event: KeyboardEvent) => {
    if (event.code !== "Escape") return false;
    for (const handler of [...registeredHandlers()].reverse()) {
      if (handler.onEscape(event)) return true;
    }
    return false;
  },
};
