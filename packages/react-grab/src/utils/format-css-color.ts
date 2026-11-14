const RGB_COLOR_PATTERN =
  /^rgba?\(\s*(\d+(?:\.\d+)?)[\s,]+(\d+(?:\.\d+)?)[\s,]+(\d+(?:\.\d+)?)(?:\s*[,/]\s*(\d*\.?\d+%?))?\s*\)$/;

const UNPARSED_COLOR_SENTINEL = "#010203";

const formattedColorByValue = new Map<string, string>();
let colorProbeContext: CanvasRenderingContext2D | null | undefined;

const toHexChannel = (channel: number): string =>
  Math.max(0, Math.min(255, Math.round(channel)))
    .toString(16)
    .padStart(2, "0");

const formatHexColor = (red: number, green: number, blue: number, alpha: number): string => {
  const hexColor = `#${toHexChannel(red)}${toHexChannel(green)}${toHexChannel(blue)}`.toUpperCase();
  if (alpha >= 1) return hexColor;
  return `${hexColor} / ${Math.round(alpha * 100)}%`;
};

const parseAlpha = (alphaText: string | undefined): number => {
  if (alphaText === undefined) return 1;
  return alphaText.endsWith("%")
    ? Number.parseFloat(alphaText) / 100
    : Number.parseFloat(alphaText);
};

const getColorProbeContext = (): CanvasRenderingContext2D | null => {
  if (colorProbeContext !== undefined) return colorProbeContext;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    colorProbeContext = canvas.getContext("2d", { willReadFrequently: true });
  } catch {
    colorProbeContext = null;
  }
  return colorProbeContext;
};

// Tailwind v4 and modern token sets compute to oklch()/color(); painting one
// pixel is the only way to get the sRGB hex a design tool would show for them.
const formatColorViaCanvas = (colorValue: string): string | null => {
  const context = getColorProbeContext();
  if (!context) return null;
  try {
    context.clearRect(0, 0, 1, 1);
    context.fillStyle = UNPARSED_COLOR_SENTINEL;
    context.fillStyle = colorValue;
    // Canvas ignores a colour it cannot parse and keeps the previous fill.
    if (context.fillStyle === UNPARSED_COLOR_SENTINEL) return null;
    context.fillRect(0, 0, 1, 1);
    const [red, green, blue, alphaByte] = context.getImageData(0, 0, 1, 1).data;
    if (alphaByte === 0) return formatHexColor(0, 0, 0, 0);
    return formatHexColor(red, green, blue, alphaByte === 255 ? 1 : alphaByte / 255);
  } catch {
    return null;
  }
};

export const isTransparentCssColor = (colorValue: string): boolean => {
  if (colorValue === "transparent") return true;
  const rgbMatch = RGB_COLOR_PATTERN.exec(colorValue);
  if (rgbMatch) return parseAlpha(rgbMatch[4]) === 0;
  return /\/\s*0%?\s*\)$/.test(colorValue);
};

export const formatCssColor = (colorValue: string): string => {
  const cachedColor = formattedColorByValue.get(colorValue);
  if (cachedColor !== undefined) return cachedColor;

  const rgbMatch = RGB_COLOR_PATTERN.exec(colorValue);
  const formattedColor = rgbMatch
    ? formatHexColor(
        Number.parseFloat(rgbMatch[1]),
        Number.parseFloat(rgbMatch[2]),
        Number.parseFloat(rgbMatch[3]),
        parseAlpha(rgbMatch[4]),
      )
    : (formatColorViaCanvas(colorValue) ?? colorValue);

  formattedColorByValue.set(colorValue, formattedColor);
  return formattedColor;
};
