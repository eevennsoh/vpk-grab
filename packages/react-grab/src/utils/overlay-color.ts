import { supportsDisplayP3 } from "./supports-display-p3.js";

// On wide-gamut displays (MacBook Pro, recent iPhones) we use Display P3 for
// more vibrant overlay highlights, falling back to sRGB rgba() elsewhere.
const isWideGamut = supportsDisplayP3();
const SRGB_COMPONENTS = "252, 167, 0";
const P3_COMPONENTS = "0.94 0.67 0.23";

export const overlayColor = (alpha: number): string =>
  isWideGamut
    ? `color(display-p3 ${P3_COMPONENTS} / ${alpha})`
    : `rgba(${SRGB_COMPONENTS}, ${alpha})`;
