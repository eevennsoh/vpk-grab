---
name: vpk-grab
description: >-
  Use for anything involving vpk-grab, the React Grab fork with a design
  inspector. Installing it in a React project. Acting on what the user brings
  back from it: a pasted grab, a style value or design token read from its
  specs panel, a property they switched off there, a spacing measurement, or a
  screenshot with drawn annotations. And running the hands-free loop, where
  each grab the user makes in the browser reaches the agent as a task with no
  copy-paste. Triggers: "install vpk-grab", "add vpk-grab", "the specs panel
  says", "I turned off the padding and it looks right", "the gap measures 12",
  "watch my grabs", "monitor my grabs", "watch my clipboard for grabs".
---

# vpk-grab

vpk-grab is React Grab plus a design inspector. In the browser the user hovers
an element and holds ⌘C (Ctrl+C on Windows and Linux): the page freezes, the
element is selected, and clicking it copies the element with its component and
source location. The fork adds a specs panel, spacing measurements, measuring
between two elements, and pen, rectangle and text annotations.

It is a drop-in fork. The package is named `react-grab` and the global is
`window.__REACT_GRAB__`, exactly as upstream.

## Installing it

Install for development only. It must never load in a production build.

1. Find the newest release tag. Use it wherever `<tag>` appears below; the
   package version is the tag without its leading `v`.

```bash
gh release view --repo eevennsoh/vpk-grab --json tagName --jq .tagName
# without gh:
curl -s https://api.github.com/repos/eevennsoh/vpk-grab/releases/latest | grep '"tag_name"'
```

2. Check whether React Grab is already there: a `react-grab` dependency in
   `package.json`, or a script tag pointing at `unpkg.com/react-grab`. If so,
   replace that one reference and leave the rest of the setup as it is. Do not
   load both. Do not run `npx grab@latest init` or `npx grab@latest upgrade`
   either: they install upstream React Grab over the fork.

3. Otherwise install by framework.

**Next.js.** Use the script tag, because it has to run before React loads. App
Router: inside `<head>` in `app/layout.tsx`. Pages Router: inside `<Head>` in
`pages/_document.tsx`.

```jsx
{
  process.env.NODE_ENV === "development" && (
    <Script
      src="https://cdn.jsdelivr.net/gh/eevennsoh/vpk-grab@<tag>/dist/vpk-grab.global.js"
      crossOrigin="anonymous"
      strategy="beforeInteractive"
    />
  );
}
```

**Vite, webpack, and other bundled apps.** Add the release tarball as a dev
dependency with the project's own package manager, then import it at the very
top of the entry file.

```bash
npm install --save-dev https://github.com/eevennsoh/vpk-grab/releases/download/<tag>/react-grab-<version>.tgz
```

```tsx
// Vite
if (import.meta.env.DEV) {
  import("react-grab");
}

// webpack and others
if (process.env.NODE_ENV === "development") {
  import("react-grab");
}
```

**No bundler.** A plain `<script>` tag with the same `src` as the Next.js
example, in `<head>` before the app's own scripts, on development pages only.

4. Verify. Start the dev server, open the app, and confirm
   `typeof window.__REACT_GRAB__` is `"object"` and the browser console shows the
   `vpk-grab` intro line. If the project has a Content Security Policy, the
   script tag needs `cdn.jsdelivr.net` allowed in `script-src` for development.

5. Keep this skill with the project, so later sessions know how to act on
   what the tool reports. Save this file as `vpk-grab/SKILL.md` in the folder
   the project's agent reads skills from: `.agents/skills/`, `.claude/skills/`
   or `.cursor/skills/`, whichever already exists. Skip this if it is already
   there.

6. Tell the user how to use it (next section). They will not find the inspector
   unless they know about the toolbar toggles.

## What the user can do with it

- **Hold ⌘C / Ctrl+C** over an element: activate. Click to copy it. Esc clears
  context or dismisses the pill before leaving.
- The **Copied** pill’s **Optional context** field adds a follow-up: type, then
  press Enter to copy the same elements with that context; "Copied prompt"
  shows briefly, then the field returns empty. The field stays on one line and scrolls
  sideways, fading at the edge with more text. With Screenshot on, the pill
  reads "Copied prompt & image". Its camera (Copy image,
  or Cmd+Enter / Ctrl+Enter) replaces the clipboard with the image alone; the
  pill then offers Copy element (Grab icon, same shortcut) to put the element
  text back. The pill holds the selection until you click elsewhere, click its
  Dismiss close button or press Esc. While Grab is on, the first click on the
  page dismisses the pill and the next click grabs an element. Dismissal
  leaves Grab on if it was on; the next Esc leaves Grab. While Grab is on, an open
  menu takes Esc first; otherwise text in Optional context is cleared before
  another Esc dismisses the pill. With Grab off and Optional context focused,
  Esc clears text first, then dismisses the empty pill and returns focus to the
  page; neither press reaches the page. Elsewhere with Grab off, Esc dismisses
  the pill without consuming the page's Escape or moving focus.
  Enter copies the hovered or keyboard-selected elements first, then focuses
  Optional context, including while the hold shortcut's modifiers are down.
  Releasing the shortcut switches Grab off but preserves the field's focus only
  if it still has focus: type and submit context without reactivating Grab.
  Submitting with Grab off returns focus to the page. Explicitly switching Grab
  off releases focus. With the pill up, arrows and Tab leave the element selection in place and
  Enter in the empty field does nothing. After dismissal, Enter copies a
  keyboard or frozen multi-selection even with the
  pointer over the toolbar; a hovered-element copy requires the pointer not to
  be over an interactive overlay. Page inputs keep their own
  arrow keys and Enter. Use
  ⌘O / Ctrl+O or the hover label’s component name to open the source.
  Right-click keeps the browser’s menu.
- **Specs** (toolbar toggle, key 1 with Grab in hand): a panel of the hovered element's applied styles,
  with the design token under each value that came from one.
- **Spacing** (toolbar toggle, key 2 with Grab in hand): the element's distance to neighbours and
  container edges, with its size in the name tag.
- **Screenshot** (toolbar toggle, key 3 with Grab in hand, off by default and
  remembered): every grab copies its references at once, then a screenshot is
  taken by itself so the clipboard ends with the references and a PNG. Chromium sites
  with an existing unsanitized clipboard write grant also keep the metadata
  with the PNG. The fork’s watcher records each grab once whichever copy it sees
  first; on Linux, or with a text-only reader, a poll that sees only an image
  copy without that metadata can still miss a repeated grab of the same element.
  A copy with several pills takes one image, on the pill with Optional context,
  and Optional context stays after the image; a prompt is copied with a fresh
  image. Over plain HTTP each grab downloads its image instead.
- **Hold Shift** with Specs on: pins the panel so they can edit it: switch a
  property off and on, pick another token or keyword, or type a value.
- **Changes** (toolbar, once something is edited): every style change on the
  page, by element, with remove, reopen and reset all.
- **Hold Alt** with Grab in hand: shows Spacing while held, even when it is
  toggled off, anchored on the hovered element; moving to another element
  shows the distances between the two. Letting go restores the toggle.
- **Pen**, **Rectangle**, **Text**: draw, outline a rectangle or write on the page
  in Red, Orange, Yellow, Green or Black. Hold Shift for a straight pen line or a
  square. In a note, Shift+Enter starts a new line and Enter places it. With Grab toggled on, hold Cmd (Ctrl off the Mac) and press Right or
  Down to step through Grab, Pen, Rectangle and Text, or Left or Up to step back,
  on either toolbar orientation; the tooltips show the arrows along the toolbar.
  In a hold session the modifier with an arrow still navigates. 1, 2 and 3 only
  ever toggle Specs, Spacing and Screenshot, with Grab in hand. **Move**
  and **Clear** appear once something is drawn. Move box-selects and drags
  annotations together, and v picks it up or puts it down. The selection frame's
  handles resize (Shift keeps the proportions, Alt resizes from the centre,
  dragging past the far side flips) and the area just outside a corner rotates
  (Shift snaps to 15°); Escape mid-drag calls a resize or rotate off; notes scale
  from their corners, and a group that includes a note or a shape turned at a
  slant always keeps its proportions. **⌘⌫** (Ctrl+Backspace
  elsewhere) clears every drawing and note, or just the selection, even after Grab is
  switched off; ⌘Z undoes it.
- **⌘Z / ⌘⇧Z** (Ctrl+Z / Ctrl+Shift+Z elsewhere) while active: undo and redo
  drawings, notes, moves, resizes, rotations, removals and style changes.

## Acting on what the user brings back

**A pasted grab** looks like this:

```txt
[<a class="ml-auto inline-block text-sm" href="#">Forgot your password?</a> in LoginForm (at components/login-form.tsx:46:19)]
```

Open the file and line it names. Do not search the codebase for the markup
first; the location is already resolved from the running app.

**A token from the specs panel**, such as `padding: 6px` with
`--ds-space-050 × 3` under it. The token is the source of truth, the pixel
value is only what it computes to. Write the change with that token, or with
the project utility class that maps to it, and never hardcode the pixels. A
value with no token under it was not set through one; match how nearby code
sets that property.

**"I switched off X and it looks right."** Switching a property off in the
panel is a temporary inline override in their browser. Nothing in the source
changed, and it disappears on reload. Make the real change: find where that
property is set for the element (the grab gives the file) and remove or change
it there. If the property comes from a shared component, say so and ask before
changing it for every consumer.

**"I set padding to `--ds-space-200`" or a typed value**, often read off the
Changes list as `padding 12px → 16px (--ds-space-200)`. Like switching off, it
is a browser-only override. Write the real change with the token they picked
(or the utility class mapping to it); for a typed value, use the project token
that matches it rather than the raw value.

**A measurement.** Redline numbers are CSS pixels between border edges. A
single-element reading is the gap to the nearest sibling or the container's
inner edge on that side. An Alt reading is between two elements the user
chose, so ask which two if they have not said. Turn a requested distance into
the project's spacing scale or token, not a raw pixel value, unless the
project uses raw values.

**A screenshot with drawings or notes.** Annotations exist only on screen and
are not part of any grab. Read them from the image, and ask for a grab of the
element they point at if the source location is not obvious.

## Using it yourself from a browser tool

If you can run JavaScript in the user's dev page, the same lookups are
available without the UI:

```js
const element = document.querySelector("[data-testid='login-submit']");
await window.__REACT_GRAB__.getSource(element);
// { filePath, lineNumber, columnNumber, componentName }
await window.__REACT_GRAB__.getStackContext(element); // component stack with locations
```

Use this to find which file renders something you can see, instead of
guessing from class names.

## The hands-free loop

Use this when the user wants their grabs handled as they make them ("watch my
grabs"), not for a single pasted grab.

`npx react-grab@latest pull` waits for new grabs and prints each as one line of
JSON, starting a background clipboard watcher the first time. The watcher is
React Grab's own CLI; it reads what vpk-grab copies, so it works unchanged.

Repeat until the user says stop:

1. Wait for the next grab:

```bash
npx react-grab@latest pull --max-age 0
```

It blocks until the user grabs something, then prints the new grab or grabs,
one JSON object per line. `--max-age 0` delivers every grab whatever its age,
so one made while you were busy is not dropped as stale. Act on every line. If
your shell cancels the command before a grab arrives, run it again; the watcher
keeps capturing and `pull` resumes where it left off.

2. Act on the grab. Each has `content` (the element's source references) and,
   when the user typed an instruction with it, `prompt`.
   - With a `prompt`, that instruction is the task. Carry it out against the
     source that `content` points to.
   - Without one, apply the standing instruction the user gave when starting
     the loop. If there is none, summarise the component and its `file:line`
     and wait for direction.

3. Go back to step 1.

A new grab while you are working wins: the user is redirecting you. So run
anything slow (dev servers, builds, installs, tests) in the background, and
between steps check without blocking:

```bash
npx react-grab@latest pull --max-age 0 --wait 0
```

Empty output means nothing new. If it prints a grab, stop the current task,
cancel the background processes you started for it, and act on the new grab.

When the user says stop, run this and do not pull again:

```bash
npx react-grab@latest stop
```

The watcher reads the clipboard of the machine it runs on, so run it where the
browser is, not over SSH or in a remote container.
