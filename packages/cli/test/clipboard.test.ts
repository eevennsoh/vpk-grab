import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it, vi } from "vite-plus/test";
import {
  GRAB_MIME,
  HISTORY_FILE_NAME,
  readLinuxGrab,
  runWatchLoop,
  compileSwiftReader,
  detectLinuxTool,
  extractGrab,
  extractPrompt,
  isGrabText,
  parseChromiumPickle,
} from "../src/utils/clipboard.js";
import * as timer from "../src/utils/sleep.js";
import { DARWIN_READER_BINARY_NAME } from "../src/utils/constants.js";
import {
  canUseClipboard,
  encodeChromiumPickle,
  encodeGrabPickle,
  hasCommand,
  prepareDarwinGrabWriter,
  writeGrab,
  writeText,
  writeX11Format,
} from "./clipboard-helpers.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CLI_BIN = path.join(HERE, "..", "bin", "cli.js");
// The spawned watcher runs the built CLI, which compiles its reader from here.
const BUILT_READERS_DIR = path.join(HERE, "..", "dist");
// A cold Swift module cache makes each first compile take tens of seconds.
const SWIFT_WARM_UP_TIMEOUT_MS = 240_000;

// Real bytes captured from Chromium copying application/x-react-grab on macOS
// (see fixtures/golden-pickle.bin). Proves the parser matches actual browser
// output, independent of our own encoder.
const GOLDEN_PICKLE = fs.readFileSync(path.join(HERE, "fixtures", "golden-pickle.bin"));

interface CapturedRecord {
  source: string;
  content: string;
  entries: { componentName?: string }[];
}

// Spawns the foreground watch daemon body (polls until killed) and returns the
// records written to history.jsonl. The watcher never exits on its own, so it is
// always killed once the timeout lapses — captured grabs are read from disk.
const POLL_MS = 100;

interface CollectGrabsOptions {
  timeoutMs?: number;
  minRecords?: number;
  prebuiltReader?: string | null;
}

const collectGrabs = (
  extraArgs: string[],
  { timeoutMs = 6000, minRecords = 0, prebuiltReader = null }: CollectGrabsOptions = {},
): Promise<CapturedRecord[]> =>
  new Promise((resolve) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rg-test-"));
    const logPath = path.join(dir, "history.jsonl");
    // A copy is newer than the reader's source, so the watcher takes it as up
    // to date and skips its own compile.
    if (prebuiltReader) fs.copyFileSync(prebuiltReader, path.join(dir, DARWIN_READER_BINARY_NAME));
    const child = spawn(
      process.execPath,
      [CLI_BIN, "watch", "--dir", dir, "--interval", "120", "--replay-last", ...extraArgs],
      { stdio: "ignore" },
    );
    const readRecords = (): CapturedRecord[] => {
      try {
        return fs
          .readFileSync(logPath, "utf8")
          .split("\n")
          .filter(Boolean)
          .map((line) => JSON.parse(line) as CapturedRecord);
      } catch {
        return [];
      }
    };
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      clearInterval(poll);
      child.kill();
      resolve(readRecords());
    };
    // Resolve as soon as the expected grabs land so capture tests stay fast; the
    // "ignores" case sets no minimum and falls through to the timeout.
    const poll = setInterval(() => {
      if (minRecords > 0 && readRecords().length >= minRecords) finish();
    }, POLL_MS);
    const timer = setTimeout(finish, timeoutMs);
    child.on("exit", finish);
  });

describe("parseChromiumPickle", () => {
  it("decodes a real Chromium web-custom-data pickle (golden)", () => {
    const formats = parseChromiumPickle(GOLDEN_PICKLE);
    const grab = formats[GRAB_MIME];
    expect(grab).toBeTruthy();
    const parsed = JSON.parse(grab);
    expect(parsed.version).toBe("0.1.0");
    expect(parsed.content.startsWith("GOLDEN_SAMPLE")).toBe(true);
    expect(parsed.entries[0].componentName).toBe("SaveButton");
    expect(parsed.timestamp).toBe(1780000000000);
  });

  it("round-trips through the encoder, including 4-byte alignment padding", () => {
    // An odd code-unit length ("odd") forces 2 bytes of padding after the value.
    const grabJson = JSON.stringify({ content: "odd", entries: [], timestamp: 1 });
    const formats = parseChromiumPickle(encodeGrabPickle(grabJson));
    expect(formats[GRAB_MIME]).toBe(grabJson);
  });

  it("decodes multiple format pairs", () => {
    const pickle = encodeChromiumPickle({ "text/plain": "hi", [GRAB_MIME]: "{}" });
    const formats = parseChromiumPickle(pickle);
    expect(formats["text/plain"]).toBe("hi");
    expect(formats[GRAB_MIME]).toBe("{}");
  });

  it("returns an empty map for short or malformed buffers", () => {
    expect(parseChromiumPickle(Buffer.alloc(0))).toEqual({});
    expect(parseChromiumPickle(Buffer.from([1, 2, 3]))).toEqual({});
  });
});

describe("extractGrab", () => {
  it("prefers an already-resolved grab string", () => {
    expect(extractGrab({ grab: '{"a":1}' })).toBe('{"a":1}');
  });

  it("parses a base64 pickle when no resolved grab is present", () => {
    const grabJson = JSON.stringify({ content: "x", entries: [], timestamp: 2 });
    const pickleBase64 = encodeGrabPickle(grabJson).toString("base64");
    expect(extractGrab({ pickleBase64 })).toBe(grabJson);
  });

  it("returns undefined when nothing is available", () => {
    expect(extractGrab({})).toBe(undefined);
  });
});

const MAP_FORMAT = 'application/web;type="custom/formatmap"';
const ENTRY_FORMAT = 'application/web;type="custom/format7"';
const PICKLE_FORMAT = "chromium/x-web-custom-data";
const REPEATED_TEXT = "[<button> in Button (at App.tsx)]";

const metadataAt = (timestamp: number) =>
  JSON.stringify({ content: REPEATED_TEXT, entries: [], timestamp });

describe("extractGrab timestamp preference", () => {
  for (const [webTimestamp, pickleTimestamp] of [
    [2, 1],
    [1, 2],
  ]) {
    it(`selects the newer entry for web ${webTimestamp} and pickle ${pickleTimestamp}`, () => {
      expect(
        extractGrab({
          grab: metadataAt(webTimestamp),
          pickleBase64: encodeGrabPickle(metadataAt(pickleTimestamp)).toString("base64"),
        }),
      ).toBe(metadataAt(Math.max(webTimestamp, pickleTimestamp)));
    });
  }

  it("keeps a valid pickle alongside a malformed web entry", () => {
    expect(
      extractGrab({ grab: "?", pickleBase64: encodeGrabPickle(metadataAt(1)).toString("base64") }),
    ).toBe(metadataAt(1));
  });
});

const webFormats = (timestamp: number) =>
  new Map([
    [
      MAP_FORMAT,
      Buffer.from(
        JSON.stringify({
          "application/example": 'application/web;type="custom/format0"',
          [GRAB_MIME]: ENTRY_FORMAT,
        }),
      ),
    ],
    [ENTRY_FORMAT, Buffer.from(metadataAt(timestamp))],
  ]);

describe("readLinuxGrab", () => {
  it("skips absent formats and falls back to the legacy pickle if listing fails", () => {
    const read = vi.fn(() => encodeGrabPickle(metadataAt(1)));
    expect(readLinuxGrab("text/plain\nimage/png\n", read)).toBeUndefined();
    expect(read).not.toHaveBeenCalled();
    for (const listing of [PICKLE_FORMAT, null]) {
      read.mockClear();
      expect(readLinuxGrab(listing, read)).toBe(metadataAt(1));
      expect(read.mock.calls).toEqual([[PICKLE_FORMAT]]);
    }
  });

  it("uses the mapped entry and prefers the newer timestamp", () => {
    const formats = webFormats(2);
    const read = (format: string) => formats.get(format) ?? null;
    formats.set(PICKLE_FORMAT, encodeGrabPickle(metadataAt(1)));
    expect(readLinuxGrab([...formats.keys()].join("\n"), read)).toBe(metadataAt(2));
    formats.set(PICKLE_FORMAT, encodeGrabPickle(metadataAt(3)));
    expect(readLinuxGrab([...formats.keys()].join("\n"), read)).toBe(metadataAt(3));
  });

  it("ignores malformed maps and unrelated native targets", () => {
    for (const invalidMap of ["?", "null", JSON.stringify({ [GRAB_MIME]: "image/png" })]) {
      const formats = new Map([
        [MAP_FORMAT, Buffer.from(invalidMap)],
        [PICKLE_FORMAT, encodeGrabPickle(metadataAt(1))],
      ]);
      const read = vi.fn((format: string) => formats.get(format) ?? null);
      expect(readLinuxGrab([...formats.keys()].join("\n"), read)).toBe(metadataAt(1));
      expect(read).not.toHaveBeenCalledWith("image/png");
    }
  });
});

describe("runWatchLoop image polling", () => {
  for (const seeTextWrite of [true, false]) {
    it(`records a repeat grab once when the poll sees ${seeTextWrite ? "both writes" : "only the image"}`, async () => {
      const formats = webFormats(2);
      const imageGrab = readLinuxGrab(
        [...formats.keys()].join("\n"),
        (format) => formats.get(format) ?? null,
      );
      const baseline = { changeCount: 1, text: REPEATED_TEXT, grab: metadataAt(1) };
      const textWrite = { changeCount: 2, text: REPEATED_TEXT, grab: metadataAt(2) };
      const imageWrite = { changeCount: 3, text: REPEATED_TEXT, grab: imageGrab };
      const polls = [baseline, ...(seeTextWrite ? [textWrite] : []), imageWrite];
      const finished = new Error("Finished polling");
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rg-polls-"));
      const sleep = vi.spyOn(timer, "sleep").mockImplementation(async () => {
        if (!polls.length) throw finished;
      });
      try {
        await expect(
          runWatchLoop({
            reader: { mode: "fake", read: () => polls.shift() ?? null },
            dir,
            intervalMs: POLL_MS,
            replayLast: false,
          }),
        ).rejects.toBe(finished);
        const records = fs
          .readFileSync(path.join(dir, HISTORY_FILE_NAME), "utf8")
          .trim()
          .split("\n")
          .map((line) => JSON.parse(line));
        expect(records).toMatchObject([{ source: "custom", timestamp: 2, content: REPEATED_TEXT }]);
      } finally {
        sleep.mockRestore();
        fs.rmSync(dir, { recursive: true, force: true });
      }
    });
  }
});

describe("extractPrompt", () => {
  it("returns the comment prepended above the element references (prompt mode)", () => {
    const record = {
      content: "Make this disabled until valid\n[<button>Submit</button> in Btn (at a.tsx:1:1)]",
      entries: [],
    };
    expect(extractPrompt(record)).toBe("Make this disabled until valid");
  });

  it("prefers structured entry commentText", () => {
    const record = {
      content: "[<a> in NavLink (at nav.tsx:8:2)]",
      entries: [{ componentName: "NavLink", commentText: "fix the aria-label" }],
    };
    expect(extractPrompt(record)).toBe("fix the aria-label");
  });

  it("returns undefined for a plain grab with no comment", () => {
    const record = { content: "[<button>Submit</button> in Btn (at a.tsx:1:1)]", entries: [] };
    expect(extractPrompt(record)).toBe(undefined);
  });

  it("does not throw on forged records (non-array entries, non-string content)", () => {
    expect(extractPrompt({ entries: "x", content: 5 })).toBe(undefined);
    expect(extractPrompt({ entries: [1, null], content: undefined })).toBe(undefined);
  });

  it("returns undefined for a whitespace-only prefix (no empty-string prompt)", () => {
    expect(extractPrompt({ content: "   \n[<a> in A (at a.tsx:1:1)]", entries: [] })).toBe(
      undefined,
    );
  });
});

describe("isGrabText", () => {
  it("matches a React Grab component-stack frame", () => {
    expect(isGrabText("in LoginForm (at src/auth/login.tsx:22:7)")).toBe(true);
  });

  it("matches a frame with parentheses in the path (Next.js route groups)", () => {
    expect(isGrabText("in LoginForm (at src/app/(auth)/login/page.tsx:22:7)")).toBe(true);
  });

  it("rejects ordinary copied text", () => {
    expect(isGrabText("just some copied text, not a grab")).toBe(false);
  });
});

describe(`clipboard round-trip via text fallback (${process.platform})`, () => {
  const runnable = canUseClipboard();

  it.skipIf(!runnable)("captures a grab from real clipboard text", async () => {
    const grabText =
      "<button>Save</button>\n\n// src/widgets/save-button.tsx:42\n  in SaveButton (at src/widgets/save-button.tsx:42:3)";
    if (!writeText(grabText)) return;
    const records = await collectGrabs(["--text-only"], { timeoutMs: 6000, minRecords: 1 });
    expect(records.length >= 1).toBe(true);
    expect(records[0].source).toBe("text");
    expect(records[0].content).toMatch(/in SaveButton/);
  });

  it.skipIf(!runnable)("ignores ordinary copied text", async () => {
    if (!writeText("hello world, just some copied text")) return;
    const records = await collectGrabs(["--text-only"], { timeoutMs: 2500 });
    expect(records.length).toBe(0);
  });
});

describe(`clipboard round-trip via custom format (${process.platform})`, () => {
  const grabJson = JSON.stringify({
    version: "0.1.0",
    content: '<a href="#">Link</a>\n\n// src/nav.tsx:8\n  in NavLink (at src/nav.tsx:8:2)',
    entries: [{ tagName: "a", componentName: "NavLink", content: '<a href="#">Link</a>' }],
    timestamp: Date.now(),
  });

  if (process.platform === "linux") {
    const runnable = canUseClipboard();
    // xclip serves one X11 target per invocation, so the full reader (which
    // needs a text target too) can't see a custom-only selection. Exercise the
    // Linux custom fetch + shared parser directly instead.
    it.skipIf(!runnable)("reads chromium/x-web-custom-data and parses the grab", () => {
      if (!writeGrab({ text: "", grabJson })) return;
      const tool = detectLinuxTool();
      expect(tool?.readCustom).toBeTruthy();
      const buffer = tool?.readCustom?.("chromium/x-web-custom-data");
      expect(buffer).toBeTruthy();
      expect(parseChromiumPickle(buffer)[GRAB_MIME]).toBe(grabJson);
    });
    it.skipIf(!runnable)("reads Chromium's X11 web format map and its numbered entry", () => {
      const readCustom = detectLinuxTool()?.readCustom;
      if (!readCustom) throw new Error("No X11 custom format reader");
      const formats = webFormats(2);
      // xclip owns a single target at a time, so offer each browser representation
      // as the reader requests it. Both the map and payload pass through X11.
      const grab = readLinuxGrab([...formats.keys()].join("\n"), (format) => {
        const data = formats.get(format);
        if (!data) return null;
        expect(writeX11Format(format, data)).toBe(true);
        return readCustom(format);
      });
      expect(grab).toBe(metadataAt(2));
    });
    return;
  }

  const customSupported =
    process.platform === "win32"
      ? canUseClipboard()
      : process.platform === "darwin" && hasCommand("swift") && hasCommand("swiftc");

  // The macOS round-trip needs two Swift binaries: the fixture that writes the
  // pasteboard and the reader the watcher compiles. Both are built once here,
  // through the CLI's own compile step for the reader, so the capture test's
  // budget covers capturing rather than a cold compiler.
  const swiftToolsDir = fs.mkdtempSync(path.join(os.tmpdir(), "rg-swift-tools-"));
  let prebuiltReader: string | null = null;

  beforeAll(() => {
    if (!customSupported || process.platform !== "darwin") return;
    const warmUpStartedAt = Date.now();
    expect(prepareDarwinGrabWriter(swiftToolsDir)).toBe(true);
    prebuiltReader = compileSwiftReader(BUILT_READERS_DIR, swiftToolsDir);
    expect(prebuiltReader).toBeTruthy();
    console.info(`Swift clipboard tools built in ${Date.now() - warmUpStartedAt}ms`);
  }, SWIFT_WARM_UP_TIMEOUT_MS);

  afterAll(() => {
    fs.rmSync(swiftToolsDir, { recursive: true, force: true });
  });

  it.skipIf(!customSupported)(
    "captures a structured grab end-to-end",
    async () => {
      if (!writeGrab({ text: "plain text alongside", grabJson })) return;
      const records = await collectGrabs([], {
        timeoutMs: 20000,
        minRecords: 1,
        prebuiltReader,
      });
      expect(records.length >= 1).toBe(true);
      expect(records[0].source).toBe("custom");
      expect(records[0].entries[0].componentName).toBe("NavLink");
    },
    25000,
  );
});
