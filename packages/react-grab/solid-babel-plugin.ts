import * as babel from "@babel/core";
import { createRequire } from "node:module";
import fs from "node:fs";
import { dirname, resolve } from "node:path";

const CSS_TEXT_SUFFIX = "?css-text";

export const cssTextPlugin = () => {
  return {
    name: "css-text",
    enforce: "pre" as const,
    async resolveId(
      this: { resolve: (source: string, importer?: string) => Promise<{ id: string } | null> },
      source: string,
      importer: string | undefined,
    ) {
      if (!source.endsWith(".css")) return;
      if (source.startsWith(".") || source.startsWith("/")) {
        const resolved = importer ? resolve(dirname(importer), source) : source;
        return resolved + CSS_TEXT_SUFFIX;
      }
      const resolved = await this.resolve(source, importer);
      if (resolved) return resolved.id + CSS_TEXT_SUFFIX;
    },
    load(id: string) {
      if (!id.endsWith(CSS_TEXT_SUFFIX)) return;
      const filePath = id.slice(0, -CSS_TEXT_SUFFIX.length);
      const content = fs.readFileSync(filePath, "utf8");
      return `export default ${JSON.stringify(content)};`;
    },
  };
};

export const solidWebBrowserPlugin = () => {
  const require = createRequire(import.meta.url);
  const serverPath = require.resolve("solid-js/web");
  const distDir = dirname(serverPath);
  const browserPath = resolve(distDir, "web.js");
  return {
    name: "solid-web-browser",
    enforce: "pre" as const,
    resolveId(source: string) {
      if (source === "solid-js/web") return browserPath;
    },
  };
};

const REACT_STUB_MODULE_ID = "\0react-global-stub";

// bippy 0.7 reads `useSyncExternalStore` off the `react` namespace at module
// evaluation for its `useFiber` hook, which React Grab never calls. Left
// external, the IIFE build ends in `})({}, react)` and throws "react is not
// defined" on any page that loads it from a script tag, so the script-tag
// build resolves `react` to an empty module instead.
export const reactGlobalStubPlugin = () => ({
  name: "react-global-stub",
  enforce: "pre" as const,
  resolveId(source: string) {
    if (source === "react") return REACT_STUB_MODULE_ID;
  },
  load(id: string) {
    if (id === REACT_STUB_MODULE_ID) return "export {};";
  },
});

export interface SolidBabelPluginOptions {
  filter?: RegExp;
  plugins?: babel.PluginItem[];
}

export const solidBabelPlugin = (options: SolidBabelPluginOptions = {}) => ({
  name: "solid-babel",
  transform(code: string, id: string) {
    const filter = options.filter ?? /\.(tsx|jsx)$/;
    if (!filter.test(id)) return;

    const result = babel.transformSync(code, {
      presets: [
        ["@babel/preset-typescript", { onlyRemoveTypeImports: true }],
        "babel-preset-solid",
      ],
      plugins: options.plugins,
      filename: id,
      sourceMaps: true,
      caller: { name: "solid-babel", supportsStaticESM: true },
    });

    if (!result?.code) return;
    return { code: result.code, map: result.map };
  },
});
