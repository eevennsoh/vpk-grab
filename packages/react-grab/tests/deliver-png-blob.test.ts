import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { deliverPngBlob } from "../src/utils/deliver-png-blob.js";
import { downloadBlob } from "../src/utils/download-blob.js";

vi.mock("../src/utils/download-blob.js", () => ({
  downloadBlob: vi.fn(),
}));

afterEach(() => vi.unstubAllGlobals());

beforeEach(() => {
  vi.resetAllMocks();
});

describe("deliverPngBlob without the async clipboard", () => {
  it("downloads the image once it resolves", async () => {
    const blob = new Blob(["png"], { type: "image/png" });

    await expect(deliverPngBlob(Promise.resolve(blob))).resolves.toBe("saved");

    expect(downloadBlob).toHaveBeenCalledTimes(1);
    expect(vi.mocked(downloadBlob).mock.calls[0][0]).toBe(blob);
  });

  it("downloads nothing when the image rejects", async () => {
    const cancellation = new Error("Screenshot capture cancelled");

    await expect(deliverPngBlob(Promise.reject(cancellation))).rejects.toBe(cancellation);

    expect(downloadBlob).not.toHaveBeenCalled();
  });
});

describe("deliverPngBlob with grab metadata", () => {
  const cases: [boolean | undefined, PermissionState | undefined][] = [
    [true, "granted"],
    [false, "granted"],
    [undefined, "granted"],
    [true, "denied"],
    [true, "prompt"],
    [true, undefined],
  ];
  for (const [supports, permission] of cases) {
    it(`writes the supported representations when supports is ${supports} and permission is ${permission}`, async () => {
      const customType = "web application/x-react-grab";
      const metadata = '{"timestamp":123}';
      const png = Promise.resolve(new Blob(["png"], { type: "image/png" }));
      class TestClipboardItem {
        static supports = supports === undefined ? undefined : () => supports;
        constructor(readonly representations: Record<string, Blob | Promise<Blob>>) {}
      }
      const write = vi.fn(async (_items: TestClipboardItem[]) => {});
      vi.stubGlobal("ClipboardItem", TestClipboardItem);
      vi.stubGlobal("navigator", { clipboard: { write } });

      await expect(deliverPngBlob(png, "text", metadata, permission)).resolves.toBe("copied");
      const [items] = write.mock.calls[0];
      expect(items).toHaveLength(1);
      const { representations } = items[0];
      const includesMetadata = supports && permission === "granted";
      expect(Object.keys(representations).sort()).toEqual([
        "image/png",
        "text/html",
        "text/plain",
        ...(includesMetadata ? [customType] : []),
      ]);
      if (includesMetadata) {
        const blob = await representations[customType];
        expect(blob.type).toBe("application/x-react-grab");
        expect(await blob.text()).toBe(metadata);
      }
    });
  }
});
