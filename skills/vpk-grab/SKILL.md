---
name: vpk-grab
description: >-
  Use when installing vpk-grab (the React Grab fork with a design inspector) in
  a React project, and when the user brings something back from it: a pasted
  grab, a style value or design token read from its specs panel, a property
  they switched off there, a spacing measurement, or a screenshot with drawn
  annotations. Triggers: "install vpk-grab", "add vpk-grab", "set up the grab
  tool", "the specs panel says", "I turned off the padding and it looks right",
  "the gap measures 12".
---

# vpk-grab

vpk-grab is React Grab plus a design inspector. In the browser the user hovers
an element and holds ⌘C (Ctrl+C on Windows and Linux): the page freezes, the
element is selected, and clicking it copies the element with its component and
source location. The fork adds a specs panel, spacing redlines, measuring
between two elements, and pen and text annotations.

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
   load both.

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

5. Tell the user how to use it (next section). They will not find the inspector
   unless they know about the toolbar toggles.

## What the user can do with it

- **Hold ⌘C / Ctrl+C** over an element: activate. Click to copy it. Esc leaves.
- **Specs** (toolbar toggle): a panel of the hovered element's applied styles,
  with the design token under each value that came from one.
- **Redlines** (toolbar toggle): the element's size and its distance to
  neighbours and container edges.
- **Hold Shift** with Specs on: pins the panel so they can click a property to
  switch it off and on in the page.
- **Hold Alt** with Redlines on: anchors on the hovered element; moving to
  another element shows the distances between the two.
- **Pen**, **Text**: draw and write on the page. **Move** and **Clear** appear
  once something is drawn.

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

The `react-grab` skill in this repository watches for grabs and feeds each one
to you as a task, with no pasting. It works unchanged with vpk-grab.
