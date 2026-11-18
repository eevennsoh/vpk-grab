import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { runCopyFlow } from "../src/core/copy.js";
import { resolveElementReferenceContext } from "../src/core/context.js";

vi.mock("../src/core/context.js", () => ({
  resolveElementReferenceContext: vi.fn(),
}));

afterEach(() => vi.unstubAllGlobals());

const createHooks = () => ({
  onBeforeCopy: vi.fn(async () => {}),
  transformCopyContent: vi.fn(async (content: string) => content),
  onAfterCopy: vi.fn(),
  onCopySuccess: vi.fn(),
  onCopyError: vi.fn(),
});

beforeEach(() => {
  vi.resetAllMocks();
});

describe("copy payload", () => {
  it("uses one reference context resolution and keeps its independent component label", async () => {
    const element = Object.create(null);
    element.tagName = "BUTTON";
    vi.mocked(resolveElementReferenceContext).mockResolvedValue({
      componentName: "LinkComponent",
      fiber: null,
      referenceContext: '<button data-testid="docs-link">Docs</button>',
      source: {
        columnNumber: 1,
        componentName: null,
        filePath: "/src/components/docs-link.tsx",
        lineNumber: 2,
        origin: "app",
      },
      stack: [],
      stackContext: "\n  in DocsLink",
    });
    const writes = new Map<string, string>();
    const documentEvents = new EventTarget();
    vi.stubGlobal(
      "document",
      Object.assign(documentEvents, {
        createElement: () => ({ style: {}, select: vi.fn(), remove: vi.fn() }),
        body: { appendChild: vi.fn() },
        execCommand: () =>
          documentEvents.dispatchEvent(
            Object.assign(new Event("copy"), {
              clipboardData: { setData: (type: string, value: string) => writes.set(type, value) },
            }),
          ),
      }),
    );

    const result = await runCopyFlow({}, createHooks(), [element]);

    expect(resolveElementReferenceContext).toHaveBeenCalledOnce();
    const content = '[<button data-testid="docs-link">Docs</button>]';
    const metadata = writes.get("application/x-react-grab");
    expect(JSON.parse(metadata ?? "")).toMatchObject({
      content,
      entries: [{ componentName: "LinkComponent" }],
      timestamp: expect.any(Number),
    });
    expect(result).toEqual({
      status: "succeeded",
      copiedContent: content,
      copiedMetadata: metadata,
    });
  });
});
