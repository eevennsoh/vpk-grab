export interface CssVariableSubstitution {
  value: string;
  variableNames: string[];
}

const VARIABLE_FUNCTION = "var(";

const findClosingParenthesis = (text: string, openIndex: number): number => {
  let depth = 0;
  for (let index = openIndex; index < text.length; index++) {
    if (text[index] === "(") depth++;
    else if (text[index] === ")") {
      depth--;
      if (depth === 0) return index;
    }
  }
  return -1;
};

const findTopLevelComma = (text: string): number => {
  let depth = 0;
  for (let index = 0; index < text.length; index++) {
    if (text[index] === "(") depth++;
    else if (text[index] === ")") depth--;
    else if (text[index] === "," && depth === 0) return index;
  }
  return -1;
};

// Replaces every var() in a value with what `readVariable` returns for it, the
// way the browser would: an unset variable takes its fallback, and one without
// a fallback makes the whole declaration invalid (null). `variableNames` lists
// the variables that ended up supplying the value, in order.
export const substituteCssVariables = (
  value: string,
  readVariable: (variableName: string) => string,
): CssVariableSubstitution | null => {
  const variableNames: string[] = [];
  let substitutedValue = "";
  let cursor = 0;

  while (cursor < value.length) {
    const functionIndex = value.indexOf(VARIABLE_FUNCTION, cursor);
    if (functionIndex === -1) break;
    const closeIndex = findClosingParenthesis(value, functionIndex + VARIABLE_FUNCTION.length - 1);
    if (closeIndex === -1) return null;

    const functionArguments = value.slice(functionIndex + VARIABLE_FUNCTION.length, closeIndex);
    const commaIndex = findTopLevelComma(functionArguments);
    const variableName = (
      commaIndex === -1 ? functionArguments : functionArguments.slice(0, commaIndex)
    ).trim();
    const variableValue = readVariable(variableName).trim();

    substitutedValue += value.slice(cursor, functionIndex);
    if (variableValue) {
      variableNames.push(variableName);
      substitutedValue += variableValue;
    } else {
      if (commaIndex === -1) return null;
      const fallback = substituteCssVariables(
        functionArguments.slice(commaIndex + 1),
        readVariable,
      );
      if (!fallback) return null;
      variableNames.push(...fallback.variableNames);
      substitutedValue += fallback.value.trim();
    }
    cursor = closeIndex + 1;
  }

  return { value: substitutedValue + value.slice(cursor), variableNames };
};
