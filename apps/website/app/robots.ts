import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/utils/get-site-url";

const robots = (): MetadataRoute.Robots => {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api"],
    },
    sitemap: `${getSiteUrl()}/sitemap.xml`,
  };
};

export default robots;
