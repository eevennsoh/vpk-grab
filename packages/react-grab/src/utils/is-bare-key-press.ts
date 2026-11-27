export const isBareKeyPress = (event: KeyboardEvent): boolean =>
  !event.repeat && !event.metaKey && !event.ctrlKey && !event.altKey && !event.shiftKey;
