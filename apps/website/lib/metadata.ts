import type { Metadata } from "next";

interface PageMetadataOptions {
  title: string;
  description: string;
  path: string;
}

// One place for the per-page metadata shape (title pattern, OG image endpoint,
// social cards) so pages differ only in copy and path.
export const createPageMetadata = ({ title, description, path }: PageMetadataOptions): Metadata => {
  const fullTitle = `${title} - vpk-grab`;
  const ogImageUrl = `/api/og?title=${encodeURIComponent(title)}&subtitle=${encodeURIComponent(description)}`;
  return {
    title: fullTitle,
    description,
    openGraph: {
      title: fullTitle,
      description,
      url: path,
      siteName: "vpk-grab",
      images: [{ url: ogImageUrl, width: 1200, height: 630, alt: `vpk-grab - ${title}` }],
      locale: "en_US",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
      images: [ogImageUrl],
    },
  };
};
