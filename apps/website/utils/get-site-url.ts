const LOCAL_SITE_URL = "http://localhost:3000";

// The fork has no fixed domain: an explicit SITE_URL wins, then the production
// domain Vercel exposes on its deployments, then the local dev server.
export const getSiteUrl = (): string => {
  if (process.env.SITE_URL) return process.env.SITE_URL;
  const vercelProductionHost = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return vercelProductionHost ? `https://${vercelProductionHost}` : LOCAL_SITE_URL;
};
