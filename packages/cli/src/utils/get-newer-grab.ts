const getTimestamp = (grab: string): number => {
  try {
    const timestamp: unknown = JSON.parse(grab)?.timestamp;
    if (typeof timestamp === "number") return timestamp;
  } catch {}
  return -Infinity;
};

export const getNewerGrab = (webGrab?: string, pickleGrab?: string): string | undefined => {
  if (!webGrab) return pickleGrab;
  if (!pickleGrab) return webGrab;
  return getTimestamp(pickleGrab) > getTimestamp(webGrab) ? pickleGrab : webGrab;
};
