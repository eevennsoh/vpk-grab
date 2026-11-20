// Zero counts as positive, so a scale that passes through zero keeps a side.
export const getSign = (value: number): number => (value < 0 ? -1 : 1);
