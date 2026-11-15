# vpk-grab

[React Grab](https://github.com/aidenybai/react-grab) with a design inspector built in: applied styles and the design tokens behind them, spacing redlines, element-to-element measuring, and pen and text annotations.

It is a fork, and a drop-in one. The package is still named `react-grab` and the global is still `window.__REACT_GRAB__`, so everything written for React Grab (its CLI, its plugins, its agent skill) keeps working.

## What it adds

Everything lives in React Grab's own toolbar and behind its one shortcut. Hover something, hold **⌘C** (**Ctrl+C** on Windows and Linux) and the page freezes with the hover state intact, so UI that only exists on hover can be inspected too.

| Toolbar control        | What it does                                                                                                                                                                                                                                                 |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Specs**              | A panel of the styles applied to the hovered element, applied ones on top and the rest by type: appearance, spacing, layout, size, typography. Under each value it names the design token it came from, such as `--ds-space-050 × 3`.                        |
| **Redlines**           | The element's distance to the nearest sibling or container edge on each side, with its size in the name tag. Around elements too small to hold them, the numbers move out past the end of each line so they never overlap.                                   |
| **Pen**                | Draw on the page in one of five colors. Hold **Shift** for a straight line. On a Mac, press **Control** while active to pick the pen up or put it down, without going back to the toolbar.                                                                   |
| **Text**               | Click to place a note, in the same colors as the pen.                                                                                                                                                                                                        |
| **Move** and **Clear** | Appear once something is drawn; press **v** to pick Move up or put it down. Drag a box to select several annotations (**Shift**-click adds or removes one), drag any selected one to move them together, press **Delete** to remove them, or clear them all. |
| **Changes**            | Appears with the first style change, showing how many there are. Lists every change by element: remove one, click an element to reopen its panel, or reset them all.                                                                                         |

Two keys work on whatever is hovered, without clicking:

| Key            | With        | What it does                                                                                                                                                                                                                      |
| -------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hold **Shift** | Specs on    | Pins the panel to the element so the pointer can reach it. Each row gets a checkbox to switch it off and on, a value to type into, a menu of tokens and keywords, and a reset. The pin button keeps it open; **Esc** releases it. |
| Hold **Alt**   | Redlines on | Anchors the redlines to the element. Move to any other element to read the distances between the two.                                                                                                                             |

Every change in the panel (switching a property off, picking a token, typing a value) is a temporary inline override in the browser. It never touches source files and is gone on reload.

While vpk-grab is active, **⌘Z** undoes the last drawing, note, move, removal or style change, and **⌘⇧Z** redoes it (**Ctrl+Z** and **Ctrl+Shift+Z** or **Ctrl+Y** on Windows and Linux).

## Install

Install it for development only. Releases are listed at [github.com/eevennsoh/vpk-grab/releases](https://github.com/eevennsoh/vpk-grab/releases); the examples use `v0.2.0-vpk.5`.

### Let your agent do it

Paste this into your coding agent:

```txt
Install vpk-grab in this project. Follow https://raw.githubusercontent.com/eevennsoh/vpk-grab/main/skills/vpk-grab/SKILL.md
```

### Script tag

Works in any React app, and is the right choice for Next.js because the script must load before React does.

```html
<script
  src="https://cdn.jsdelivr.net/gh/eevennsoh/vpk-grab@v0.2.0-vpk.5/dist/vpk-grab.global.js"
  crossorigin="anonymous"
></script>
```

Next.js App Router, in `app/layout.tsx`:

```jsx
import Script from "next/script";

export default function RootLayout({ children }) {
  return (
    <html>
      <head>
        {process.env.NODE_ENV === "development" && (
          <Script
            src="https://cdn.jsdelivr.net/gh/eevennsoh/vpk-grab@v0.2.0-vpk.5/dist/vpk-grab.global.js"
            crossOrigin="anonymous"
            strategy="beforeInteractive"
          />
        )}
      </head>
      <body>{children}</body>
    </html>
  );
}
```

### Package

For Vite, webpack and other bundled apps. This also replaces an existing `react-grab` dependency in place.

```bash
npm install --save-dev https://github.com/eevennsoh/vpk-grab/releases/download/v0.2.0-vpk.5/react-grab-0.2.0-vpk.5.tgz
```

Then load it at the top of the entry file:

```tsx
// Vite
if (import.meta.env.DEV) {
  import("grab");
}

// webpack and others
if (process.env.NODE_ENV === "development") {
  import("grab");
}
```

## For AI agents

One skill, [`vpk-grab`](skills/vpk-grab/SKILL.md), covers everything an agent needs:

- installing the tool in a project;
- acting on what you bring back from it: a pasted grab, a token the panel named, a property you switched off, a measurement;
- the hands-free loop, where each grab you make in the browser is picked up and acted on without pasting.

The skill lives in this repository and is not published to any skill registry. The install prompt above saves it into the project as part of the setup. To add it by hand, copy the file into the folder your agent reads skills from:

```bash
mkdir -p .agents/skills/vpk-grab
curl -fsSL https://raw.githubusercontent.com/eevennsoh/vpk-grab/main/skills/vpk-grab/SKILL.md \
  -o .agents/skills/vpk-grab/SKILL.md
```

Claude Code reads `.claude/skills/` and Cursor also reads `.cursor/skills/`; use whichever your project already has.

## Develop

```bash
pnpm install
pnpm --filter react-grab dev        # rebuild on change
pnpm --filter react-grab test:unit
```

The inspector lives in `packages/react-grab/src/components/inspect/` and `packages/react-grab/src/core/create-inspect-controller.ts`. [AGENTS.md](AGENTS.md) has the conventions.

To release, set the version in `packages/react-grab/package.json`, commit, and run `node scripts/release-fork.mjs` from a clean `main`. It builds, tags `v<version>` with the bundle the script tag serves, and publishes a GitHub release carrying the package tarball.

To pick up upstream changes:

```bash
git remote add upstream https://github.com/aidenybai/react-grab.git
git fetch upstream && git merge upstream/main
```

## Credits and license

MIT, like the projects it builds on.

- [React Grab](https://github.com/aidenybai/react-grab) by Aiden Bai is the tool this forks. Selection, source lookup, copying, the toolbar and the page freeze are all its work.
- [Mesurer](https://github.com/ibelick/mesurer) by Julien Thibeaut inspired the annotation tools, and its ink smoothing is adapted here. See [THIRD_PARTY_NOTICES.md](packages/react-grab/THIRD_PARTY_NOTICES.md).
