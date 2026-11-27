import { ANNOTATION_COLOR_OPTIONS } from "../constants.js";
import { getAnnotationColorKey } from "./get-annotation-color-key.js";

export const getAnnotationColorForKey = (key: string): string | undefined =>
  ANNOTATION_COLOR_OPTIONS.find((_, optionIndex) => key === getAnnotationColorKey(optionIndex))
    ?.value;
