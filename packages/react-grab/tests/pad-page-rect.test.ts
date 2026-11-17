import { describe, expect, it } from "vite-plus/test";
import { padPageRect } from "../src/utils/pad-page-rect.js";

const DOCUMENT_WIDTH_PX = 1000;
const DOCUMENT_HEIGHT_PX = 3000;

describe("padPageRect", () => {
  it("grows the rectangle by the padding on every side", () => {
    expect(
      padPageRect(
        { pageX: 100, pageY: 200, width: 50, height: 20 },
        8,
        DOCUMENT_WIDTH_PX,
        DOCUMENT_HEIGHT_PX,
      ),
    ).toEqual({ pageX: 92, pageY: 192, width: 66, height: 36 });
  });

  it("stops at the document's top-left corner", () => {
    expect(
      padPageRect(
        { pageX: 3, pageY: 0, width: 50, height: 20 },
        8,
        DOCUMENT_WIDTH_PX,
        DOCUMENT_HEIGHT_PX,
      ),
    ).toEqual({ pageX: 0, pageY: 0, width: 61, height: 28 });
  });

  it("stops at the document's bottom-right corner", () => {
    expect(
      padPageRect(
        { pageX: 960, pageY: 2990, width: 36, height: 10 },
        8,
        DOCUMENT_WIDTH_PX,
        DOCUMENT_HEIGHT_PX,
      ),
    ).toEqual({ pageX: 952, pageY: 2982, width: 48, height: 18 });
  });

  it("never returns a negative size for a rectangle outside the document", () => {
    expect(
      padPageRect(
        { pageX: 1200, pageY: 100, width: 40, height: 40 },
        8,
        DOCUMENT_WIDTH_PX,
        DOCUMENT_HEIGHT_PX,
      ),
    ).toEqual({ pageX: 1192, pageY: 92, width: 0, height: 56 });
  });

  it("keeps fractional element bounds as they are", () => {
    expect(
      padPageRect(
        { pageX: 10.5, pageY: 20.25, width: 100.5, height: 30.75 },
        8,
        DOCUMENT_WIDTH_PX,
        DOCUMENT_HEIGHT_PX,
      ),
    ).toEqual({ pageX: 2.5, pageY: 12.25, width: 116.5, height: 46.75 });
  });
});
