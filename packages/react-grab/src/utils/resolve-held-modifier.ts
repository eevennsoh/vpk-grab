// A modifier pressed or let go without the pointer moving reaches only the
// key tracker, so a tracker that changed since the last pointer event wins;
// otherwise the pointer event's own flag is the fresher of the two.
export const resolveHeldModifier = (
  isTrackedHeld: boolean,
  wasTrackedHeldAtPointerEvent: boolean,
  isHeldInPointerEvent: boolean,
): boolean =>
  isTrackedHeld !== wasTrackedHeldAtPointerEvent ? isTrackedHeld : isHeldInPointerEvent;
