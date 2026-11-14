import { LOGO_SVG } from "./logo-svg.js";

// Upstream also asks react-grab.com for its latest version here and warns to
// run `npx grab@latest upgrade` when they differ. This fork versions itself,
// and that command would replace it with upstream, so nothing is requested.
export const logIntro = () => {
  try {
    const version = process.env.VERSION;
    const logoDataUri = `data:image/svg+xml;base64,${btoa(LOGO_SVG)}`;
    console.log(
      `%cvpk-grab${version ? ` v${version}` : ""}%c\nhttps://github.com/eevennsoh/vpk-grab`,
      `background: #330039; color: #ffffff; border: 1px solid #d75fcb; padding: 4px 4px 4px 24px; border-radius: 4px; background-image: url("${logoDataUri}"); background-size: 16px 16px; background-repeat: no-repeat; background-position: 4px center; display: inline-block; margin-bottom: 4px;`,
      "",
    );
  } catch {}
};
