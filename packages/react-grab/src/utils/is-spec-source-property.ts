const BOX_SIDE = "(-(top|right|bottom|left|inline|block)(-(start|end))?)?";

// The panel reads one row from several CSS properties (a "padding" row is four
// sides, and a side can be set by `padding`, `padding-inline` or
// `padding-left`). Rows missing here are fed by the property they are named
// after and nothing else.
const SOURCE_PROPERTY_PATTERNS: Record<string, RegExp> = {
  "background-color": /^background(-color)?$/,
  "background-image": /^background(-image)?$/,
  "border-color": new RegExp(`^border${BOX_SIDE}(-color)?$`),
  "border-width": new RegExp(`^border${BOX_SIDE}(-width)?$`),
  "border-style": new RegExp(`^border${BOX_SIDE}(-style)?$`),
  "border-radius": /^border(-[a-z]+){0,2}-radius$/,
  margin: new RegExp(`^margin${BOX_SIDE}$`),
  padding: new RegExp(`^padding${BOX_SIDE}$`),
  gap: /^((row|column)-)?gap$/,
  inset: new RegExp(`^(inset${BOX_SIDE}|top|right|bottom|left)$`),
  overflow: /^overflow(-(x|y|inline|block))?$/,
  width: /^(width|inline-size)$/,
  height: /^(height|block-size)$/,
  "min-width": /^min-(width|inline-size)$/,
  "max-width": /^max-(width|inline-size)$/,
  "min-height": /^min-(height|block-size)$/,
  "max-height": /^max-(height|block-size)$/,
  "flex-direction": /^flex-(direction|flow)$/,
  "flex-wrap": /^flex-(wrap|flow)$/,
  "flex-grow": /^flex(-grow)?$/,
  "flex-shrink": /^flex(-shrink)?$/,
  "flex-basis": /^flex(-basis)?$/,
  "grid-template-columns": /^grid(-template(-columns)?)?$/,
  "grid-template-rows": /^grid(-template(-rows)?)?$/,
  "justify-content": /^(justify|place)-content$/,
  "align-items": /^(align|place)-items$/,
  "align-self": /^(align|place)-self$/,
  "font-family": /^font(-family)?$/,
  "font-size": /^font(-size)?$/,
  "font-weight": /^font(-weight)?$/,
  "font-style": /^font(-style)?$/,
  "line-height": /^(font|line-height)$/,
  "text-decoration-line": /^text-decoration(-line)?$/,
};

export const isSpecSourceProperty = (specProperty: string, cssProperty: string): boolean =>
  SOURCE_PROPERTY_PATTERNS[specProperty]?.test(cssProperty) ?? specProperty === cssProperty;
