export const isDefiniteSpecDimension = (value: string): boolean =>
  /^(?:[+-]?(?:\d|\.\d)|(?:calc|min|max|clamp)\()/.test(value.trim());
