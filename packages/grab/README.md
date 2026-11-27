# vpk-grab

[React Grab](https://github.com/aidenybai/react-grab) with a design inspector built in: applied styles and the design tokens behind them, spacing measurements, element-to-element measuring, and pen, rectangle and text annotations.

It is a fork, and a drop-in one. The package is still named `react-grab` and the global is still `window.__REACT_GRAB__`, so everything written for React Grab (its CLI, its plugins, its agent skill) keeps working.

## What it adds

Everything lives in React Grab's own toolbar and behind its one shortcut. Hover something, hold **⌘C** (**Ctrl+C** on Windows and Linux) and the page freezes with the hover state intact, so UI that only exists on hover can be inspected too. Tap the shortcut or click the toolbar button to keep Grab on. After each copy, the pill holds the selection. Click elsewhere, click its close button or press **Esc** before grabbing the next element. Tap the shortcut again or click the toolbar button to switch Grab off; **Esc** leaves once the pill and any unfinished context are dismissed.

| Toolbar control        | What it does                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Specs** (**1**)      | A panel of the styles applied to the hovered element, applied ones on top and the rest by type: appearance, spacing, layout, size, typography. Under each value it names the design token it came from, such as `--ds-space-050 × 3`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| **Spacing** (**2**)    | The element’s distance to the nearest sibling or container edge on each side. Around elements too small to hold them, the numbers move out past the end of each line so they never overlap.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| **Screenshot** (**3**) | Copies a screenshot with every grab: once the references are copied, a PNG is added to them, so one paste brings both and the pill reads **Copied prompt & image**. Off by default and remembered, like Specs and Spacing. On an address without HTTPS that means a download per grab.                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| **Pen**                | Draw on the page in Red, Orange, Yellow, Green or Black. Hold **Shift** for a straight line. With Grab toggled on, hold **⌘** (**Ctrl** on Windows and Linux) and press **→** or **↓** to step Grab → Pen → Rectangle → Text, or **←** or **↑** to step back, whichever edge the toolbar sits on.                                                                                                                                                                                                                                                                                                                                                                                                                               |
| **Rectangle**          | Drag an outline in the selected color. Hold **Shift** for a square.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| **Text**               | Click to place a note, in the same colors as the pen. **Shift+Enter** starts a new line; **Enter** places the note.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| **Move** and **Clear** | Appear once something is drawn; press **v** to pick Move up or put it down. Drag a box to select several annotations (**Shift**-click adds or removes one), drag any selected one to move them together, drag a handle on the selection frame to resize (**Shift** keeps the proportions, **Alt** resizes from the centre, dragging past the far side flips it; a group that includes a note or a shape turned at a slant always keeps its proportions) or just outside a corner to rotate (**Shift** snaps to 15°), press **Delete** to remove them, or clear them all with **⌘⌫** (**Ctrl+Backspace** on Windows and Linux; with a selection it removes just that), even after Grab is switched off. **⌘Z** brings them back. |
| **Changes**            | Appears with the first style change, showing how many there are. Lists every change by element: remove one, click an element to reopen its panel, or reset them all.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |

With Grab in hand, **1**, **2** and **3** toggle **Specs**, **Spacing** and **Screenshot**, which appear only with Grab. The numbers never pick a drawing tool: with Pen, Rectangle, Text or Move in hand they do nothing, and **⌘** (**Ctrl**) with an arrow steps between tools. **⌘C** (**Ctrl+C**) picks Grab back up from any drawing tool or Move.

Holding a key changes what the pointer does:

| Key            | With     | What it does                                                                                                                                                                                                                                                                                                                                                                 |
| -------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hold **Shift** | Specs on | Pins the panel to the element so the pointer can reach it. Each row gets a checkbox to switch it off and on, a value to type into, a menu of tokens and keywords, and a reset. The pin button keeps it open; **Esc** releases it.                                                                                                                                            |
| Hold **Alt**   | Grab     | Shows the spacing for as long as it is held, even with Spacing off, and anchors it to the element. Move to any other element to read the distances between the two.                                                                                                                                                                                                          |
| **Shift**+drag | Grab     | Copies a PNG of the dragged area, with your drawings and notes, instead of the elements in it. The **Screenshot** toggle lights up while **Shift** is held, and another **Shift**+drag takes the next screenshot straight away, even with a pill up. Let go of **Shift** before the mouse to select elements again. On an address without HTTPS the image downloads instead. |

While drawing either marquee, hold **Space** to move the rectangle without changing its size. Release **Space** to resize it again.

Hold **Space** at any other time while vpk-grab is on, with any tool, to pause it: the page takes clicks, hovers, scrolling and keys as if vpk-grab were off, so you can follow a link or open a menu to reach the next element. Release **Space** to carry on with the same tool, toggles, pill and drawings, and the element under the pointer is picked up straight away. While paused the toolbar itself shows **Paused** in place of its tools (just the pause icon when it's docked to a side) without moving, the pill and drawings dim and stay put, **Esc** goes to the page, and the activation shortcut still switches vpk-grab off. Space doesn't pause from a page field, including one inside a same-origin frame, and in a note, the Specs panel or the pill's **Optional context** once it has text it types a space. Switching windows ends the pause.

Every change in the panel (switching a property off, picking a token, typing a value) is a temporary inline override in the browser. It never touches source files and is gone on reload.

While vpk-grab is active, **⌘Z** undoes the last drawing, note, move, removal or style change, and **⌘⇧Z** redoes it (**Ctrl+Z** and **Ctrl+Shift+Z** or **Ctrl+Y** on Windows and Linux).

While you hover, the label names the element and always shows its width × height; a long name is cut short before the size is.

After a grab, the **Copied** pill holds the selection until you click elsewhere, press its **Dismiss** close button (its tooltip names **Esc**), press **Esc** or start Grab again. While Grab is on, a click on the page dismisses the pill. A second click copies the next element. While Grab is on, an open menu takes Esc first; otherwise Esc clears Optional context if it has text, then dismisses the pill on the next press, then switches Grab off. Dismiss leaves Grab on if it was on. With Grab off and Optional context focused, Esc belongs to Grab: it clears text first, then dismisses the empty pill and returns focus to the page. Neither press reaches the page. Elsewhere with Grab off, Esc dismisses the pill without consuming the page's Escape or restoring an earlier focus, so page dialogs still close normally. Its camera button (**Copy image**, or **⌘↵** / **Ctrl+Enter** with Optional context empty or filled) replaces the clipboard with a PNG alone of the element and a little space around it, with your drawings and notes, since apps and terminals paste mixed clipboards differently; your typed context stays in the field. The pill then reads **Copied image** and offers **Copy element** (the Grab icon, same shortcut) to put the element references back. On an address without HTTPS the image downloads instead and the references stay on the clipboard. With the toolbar's **Screenshot** toggle on, a screenshot is taken by itself after every grab: the references are copied at once, then replaced by the references and the image when it is ready. On Chromium sites that already have permission to write unsanitized clipboard formats, the image also carries the original grab metadata. The fork’s watcher records a grab once whichever copy its poll sees first. Its native macOS and Windows readers tell the image copy from the text copy, so a grab seen only with its image is still recorded, including a repeat of the same element. On Linux and with the text-only readers, a repeat of the same element is missed when the poll sees only an image copy without that metadata. A copy with several pills takes one image, on the pill with Optional context.

The pill also has an **Optional context** field for a quick follow-up. When Grab stays on after the copy, the field takes focus as the pill appears, so you can type straight away. In a hold session, Enter copies even with the shortcut's own modifiers held, focuses the field, and keeps it focused when you release the shortcut and Grab switches off, provided the field still has focus. You can then type context and submit it without switching Grab back on; submitting releases focus to the page. Explicitly switching Grab off still releases focus. After a pointer copy in a hold session, or on touch, click the field first. **Enter** copies the same elements again with your text above them, and the pill reads **Copied prompt** for a moment, then **Copied** again with an empty field for the next prompt. The field stays on one line: longer text scrolls sideways and fades at the edge that has more. **Esc** clears the text. With the pill up, arrows and Tab leave the element selection in place, and **Enter** in an empty field does nothing. After dismissal, **Enter** copies a keyboard or frozen multi-selection wherever the pointer rests; copying the hovered element requires the pointer not to be over an interactive overlay. Single keys such as a control's number type into the field instead. Page inputs retain their native arrow keys and Enter while Grab is on; only an empty page field (such as a menu’s search box focused on opening) or a menu item lets **⌘** with an arrow switch tools in a toggled session. There is no field after a Shift+drag screenshot. With the **Screenshot** toggle on, a prompt sent with **Enter** is copied with a fresh image. Right-click keeps the browser’s menu; use **Enter** to copy the hovered or keyboard-selected elements and **⌘O / Ctrl+O** to open the hovered component.

## Install

Install it for development only. Releases are listed at [github.com/eevennsoh/vpk-grab/releases](https://github.com/eevennsoh/vpk-grab/releases); the examples use `v0.2.0-vpk.23`.

### Let your agent do it

Paste this into your coding agent:

```txt
Install vpk-grab in this project. Follow https://raw.githubusercontent.com/eevennsoh/vpk-grab/main/skills/vpk-grab/SKILL.md
```

### Script tag

Works in any React app, and is the right choice for Next.js because the script must load before React does.

```html
<script
  src="https://cdn.jsdelivr.net/gh/eevennsoh/vpk-grab@v0.2.0-vpk.23/dist/vpk-grab.global.js"
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
            src="https://cdn.jsdelivr.net/gh/eevennsoh/vpk-grab@v0.2.0-vpk.23/dist/vpk-grab.global.js"
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
npm install --save-dev https://github.com/eevennsoh/vpk-grab/releases/download/v0.2.0-vpk.23/react-grab-0.2.0-vpk.23.tgz
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
