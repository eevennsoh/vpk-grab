export const splitCssBoxComponents = (value: string): string[][] | null => {
  const halves: string[][] = [];
  let components: string[] = [];
  let component = "";
  let parenthesisDepth = 0;

  for (const character of value) {
    if (/["'\\{}[\];]/.test(character)) return null;
    if (character === "(") parenthesisDepth++;
    else if (character === ")") {
      parenthesisDepth--;
      if (parenthesisDepth < 0) return null;
    }

    if (parenthesisDepth === 0 && (character === "/" || /\s/.test(character))) {
      if (component) components.push(component);
      component = "";
      if (character === "/") {
        if (components.length === 0) return null;
        halves.push(components);
        components = [];
      }
    } else {
      if (parenthesisDepth === 0 && character === ",") return null;
      component += character;
    }
  }

  if (parenthesisDepth !== 0) return null;
  if (component) components.push(component);
  if (components.length === 0) return null;
  halves.push(components);
  return halves;
};
