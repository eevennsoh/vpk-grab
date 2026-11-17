import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { deliverPngBlob } from "../src/utils/deliver-png-blob.js";
import { downloadBlob } from "../src/utils/download-blob.js";

vi.mock("../src/utils/download-blob.js", () => ({
  downloadBlob: vi.fn(),
}));

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
