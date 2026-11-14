import { REACT_GRAB_ATTRIBUTE_NAME } from "./react-grab-attribute-name.js";

let probeElement: HTMLElement | null = null;

// Lives in the overlay's shadow root so no page stylesheet reaches it and no
// page observer sees it.
export const getStyleProbe = (): HTMLElement | null => {
  if (probeElement?.isConnected) return probeElement;
  const shadowRoot = document.querySelector(`[${REACT_GRAB_ATTRIBUTE_NAME}]`)?.shadowRoot;
  if (!shadowRoot) return null;
  probeElement = document.createElement("div");
  probeElement.setAttribute("aria-hidden", "true");
  probeElement.style.display = "none";
  shadowRoot.appendChild(probeElement);
  return probeElement;
};
