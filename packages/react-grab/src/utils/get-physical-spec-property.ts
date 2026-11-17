export const getPhysicalSpecProperty = (
  property: string,
  writingMode: string,
  direction: string,
): string => {
  const isHorizontal = writingMode === "horizontal-tb";
  const isInlineReversed = (direction === "rtl") !== (writingMode === "sideways-lr");
  const inlineStart = isHorizontal
    ? isInlineReversed
      ? "right"
      : "left"
    : isInlineReversed
      ? "bottom"
      : "top";
  const inlineEnd = isHorizontal
    ? isInlineReversed
      ? "left"
      : "right"
    : isInlineReversed
      ? "top"
      : "bottom";
  const blockStart = isHorizontal ? "top" : writingMode.endsWith("-lr") ? "left" : "right";
  const blockEnd = isHorizontal ? "bottom" : writingMode.endsWith("-lr") ? "right" : "left";
  const physicalSides: Record<string, string> = {
    "inline-start": inlineStart,
    "inline-end": inlineEnd,
    "block-start": blockStart,
    "block-end": blockEnd,
  };
  return property
    .replace(/(?:inline|block)-(?:start|end)/g, (logicalSide) => physicalSides[logicalSide])
    .replace(
      /^border-(start|end)-(start|end)-radius$/,
      (_match, blockSide: string, inlineSide: string) => {
        const physicalBlockSide = blockSide === "start" ? blockStart : blockEnd;
        const physicalInlineSide = inlineSide === "start" ? inlineStart : inlineEnd;
        return isHorizontal
          ? `border-${physicalBlockSide}-${physicalInlineSide}-radius`
          : `border-${physicalInlineSide}-${physicalBlockSide}-radius`;
      },
    );
};
