const CSS_DECIMAL_PATTERN = /-?\d*\.\d+/g;

// Computed lengths carry layout noise such as 12.800000190734863px.
export const formatCssNumber = (value: string): string =>
  value.replace(CSS_DECIMAL_PATTERN, (decimal) =>
    String(Math.round(Number.parseFloat(decimal) * 100) / 100),
  );
