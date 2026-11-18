import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { PILL_PROMPT_ATTRIBUTE } from "../src/constants.js";
import { getFocusedPillPrompt } from "../src/utils/get-focused-pill-prompt.js";
import { blurFocusedPillPrompt } from "../src/utils/blur-focused-pill-prompt.js";

class PromptTextarea {
  closest = vi.fn((): object | null => ({}));
  blur = vi.fn();
}

beforeEach(() => vi.stubGlobal("HTMLTextAreaElement", PromptTextarea));
afterEach(() => vi.unstubAllGlobals());

describe("getFocusedPillPrompt", () => {
  it("finds the currently focused field inside the overlay shadow root", () => {
    const textarea = new PromptTextarea();
    vi.stubGlobal("document", { activeElement: { shadowRoot: { activeElement: textarea } } });
    expect(getFocusedPillPrompt()).toBe(textarea);
    expect(textarea.closest).toHaveBeenCalledWith(`[${PILL_PROMPT_ATTRIBUTE}]`);
  });

  it("does not treat a page textarea as a focused pill field", () => {
    vi.stubGlobal("document", { activeElement: new PromptTextarea() });
    expect(getFocusedPillPrompt()).toBeNull();
  });

  it("does not treat another overlay textarea as a pill field", () => {
    const textarea = new PromptTextarea();
    textarea.closest.mockReturnValue(null);
    vi.stubGlobal("document", { activeElement: { shadowRoot: { activeElement: textarea } } });
    expect(getFocusedPillPrompt()).toBeNull();
  });

  it("returns null once the field has lost focus or been removed", () => {
    vi.stubGlobal("document", { activeElement: { shadowRoot: { activeElement: null } } });
    expect(getFocusedPillPrompt()).toBeNull();
    vi.stubGlobal("document", { activeElement: null });
    expect(getFocusedPillPrompt()).toBeNull();
  });

  it("shares the focus check with blurFocusedPillPrompt", () => {
    const textarea = new PromptTextarea();
    vi.stubGlobal("document", { activeElement: { shadowRoot: { activeElement: textarea } } });
    blurFocusedPillPrompt();
    expect(textarea.blur).toHaveBeenCalledOnce();
    textarea.closest.mockReturnValue(null);
    blurFocusedPillPrompt();
    expect(textarea.blur).toHaveBeenCalledOnce();
  });
});
