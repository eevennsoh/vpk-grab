import { ImageResponse } from "next/og";

export const runtime = "edge";

/* Light theme — mirrors app/globals.css so social cards match the site. */
const CANVAS = "#fafafa";
const HAIRLINE = "#e2e2e2";
const INK = "#0a0a0a";
const TITLE = "#171717";
const PROSE = "#525252";

const fetchFont = async (request: Request, path: string) => {
  const response = await fetch(new URL(path, request.url));
  if (!response.ok) {
    throw new Error(`Failed to fetch font ${path}: ${response.status}`);
  }
  return response.arrayBuffer();
};

// The font files are immutable static assets, so fetch them once per isolate
// instead of twice per social-card request. Only the request origin is needed
// to resolve the URLs, which is why the promise is keyed off the first request.
// A failed fetch clears the memo so a transient error isn't cached forever.
let fontsPromise: Promise<[ArrayBuffer, ArrayBuffer]> | null = null;
const getFonts = (request: Request) =>
  (fontsPromise ??= Promise.all([
    fetchFont(request, "/fonts/geist-regular.ttf"),
    fetchFont(request, "/fonts/geist-medium.ttf"),
  ]).catch((error) => {
    fontsPromise = null;
    throw error;
  }));

const VpkGrabLogo = () => (
  <svg width="52" height="52" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="32" height="32" rx="8" fill={INK} />
    <circle cx="11" cy="21" r="5" fill={CANVAS} />
    <circle cx="21" cy="21" r="5" fill={CANVAS} />
    <circle cx="11" cy="11" r="5" fill={CANVAS} />
    <circle cx="21" cy="11" r="5" fill={CANVAS} />
  </svg>
);

export const GET = async (request: Request) => {
  const { searchParams } = new URL(request.url);
  const title = searchParams.get("title") ?? "vpk-grab";
  const subtitle = searchParams.get("subtitle");

  // If the font assets can't be fetched, still serve a card with Satori's
  // default font rather than a broken social preview.
  const fonts = await getFonts(request).catch((error) => {
    console.error("[og] failed to load fonts, falling back to default", error);
    return null;
  });

  return new ImageResponse(
    <div
      style={{
        height: "100%",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        justifyContent: "flex-end",
        backgroundColor: CANVAS,
        padding: "80px",
        border: `1px solid ${HAIRLINE}`,
      }}
    >
      <div
        style={{
          position: "absolute",
          top: "76px",
          left: "76px",
          display: "flex",
          alignItems: "center",
          gap: "14px",
        }}
      >
        <VpkGrabLogo />
        <span
          style={{
            fontSize: 30,
            fontFamily: "Geist",
            fontWeight: 500,
            color: INK,
            letterSpacing: "-0.01em",
          }}
        >
          vpk-grab
        </span>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "18px",
          maxWidth: "960px",
        }}
      >
        <h1
          style={{
            fontSize: title.length > 40 ? 60 : 78,
            fontFamily: "Geist",
            fontWeight: 500,
            color: TITLE,
            lineHeight: 1.05,
            letterSpacing: "-0.02em",
            margin: 0,
          }}
        >
          {title}
        </h1>
        {subtitle && (
          <p
            style={{
              fontSize: 30,
              fontFamily: "Geist",
              fontWeight: 400,
              color: PROSE,
              lineHeight: 1.35,
              margin: 0,
            }}
          >
            {subtitle}
          </p>
        )}
      </div>
    </div>,
    {
      width: 1200,
      height: 630,
      ...(fonts && {
        fonts: [
          { name: "Geist", data: fonts[0], style: "normal", weight: 400 },
          { name: "Geist", data: fonts[1], style: "normal", weight: 500 },
        ],
      }),
    },
  );
};
