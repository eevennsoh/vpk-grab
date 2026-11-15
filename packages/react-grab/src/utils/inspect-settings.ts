import {
  INSPECT_ACCENT_COLOR,
  INSPECT_SETTINGS_STORAGE_KEY,
  ANNOTATION_COLOR_OPTIONS,
} from "../constants.js";
import type { InspectSettings } from "../types.js";
import { IS_DEMO } from "./runtime-mode.js";

const DEFAULT_INSPECT_SETTINGS: InspectSettings = {
  isSpecsEnabled: false,
  isRedlinesEnabled: false,
  annotationColor: INSPECT_ACCENT_COLOR,
};

const isAnnotationColor = (value: unknown): value is string =>
  ANNOTATION_COLOR_OPTIONS.some((option) => option.value === value);

export const loadInspectSettings = (): InspectSettings => {
  if (IS_DEMO) return DEFAULT_INSPECT_SETTINGS;
  try {
    const serializedSettings = localStorage.getItem(INSPECT_SETTINGS_STORAGE_KEY);
    if (!serializedSettings) return DEFAULT_INSPECT_SETTINGS;
    const parsed: unknown = JSON.parse(serializedSettings);
    if (typeof parsed !== "object" || parsed === null) return DEFAULT_INSPECT_SETTINGS;
    const record = parsed as Record<string, unknown>;
    return {
      isSpecsEnabled: record.isSpecsEnabled === true,
      isRedlinesEnabled: record.isRedlinesEnabled === true,
      annotationColor: isAnnotationColor(record.annotationColor)
        ? record.annotationColor
        : DEFAULT_INSPECT_SETTINGS.annotationColor,
    };
  } catch {
    return DEFAULT_INSPECT_SETTINGS;
  }
};

export const saveInspectSettings = (settings: InspectSettings): void => {
  if (IS_DEMO) return;
  try {
    localStorage.setItem(INSPECT_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Storage can be unavailable (private mode, blocked third-party context);
    // the toggles still work for the session.
  }
};
