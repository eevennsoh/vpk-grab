// A modifier pressed or let go without the pointer moving reaches only the
// key tracker, so a tracker that changed since the last pointer event wins;
// otherwise either source reporting the key held counts.
export const resolveHeldModifier = (
  isTrackedHeld: boolean,
  wasTrackedHeldAtPointerEvent: boolean,
  isHeldInPointerEvent: boolean,
): boolean =>
  isTrackedHeld !== wasTrackedHeldAtPointerEvent
    ? isTrackedHeld
    : isTrackedHeld || isHeldInPointerEvent;
