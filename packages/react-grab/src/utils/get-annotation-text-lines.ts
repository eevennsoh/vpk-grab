import type { AnnotationText } from "../types.js";

export const getAnnotationTextLines = (annotationText: AnnotationText): string[] =>
  annotationText.text.split("\n");
