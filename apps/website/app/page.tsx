import type { ReactNode } from "react";
import { GithubLink } from "@/components/github-link";
import { InstallCommand } from "@/components/install-command";
import { PlaygroundCard } from "@/components/playground-card";
import { AccentLink } from "@/components/prose";
import { ReactGrabLoader } from "@/components/react-grab-loader";
import { ThemeSwitch } from "@/components/theme-switch";
import { VPK_GRAB_INSTALL_DOCS_URL, VPK_GRAB_VERSION } from "@/lib/constants";

interface Feature {
  name: string;
  description: ReactNode;
}

interface KbdProps {
  children: ReactNode;
}

const Kbd = ({ children }: KbdProps) => (
  <kbd className="rounded border border-line bg-code px-1.5 py-px font-mono text-xs text-code-ink">
    {children}
  </kbd>
);

Kbd.displayName = "Kbd";

const FEATURES: Feature[] = [
  {
    name: "Specs",
    description: (
      <>
        Applied styles and the token behind each one. Hold <Kbd>Shift</Kbd> to pin and edit.
      </>
    ),
  },
  {
    name: "Spacing",
    description: (
      <>
        Size and spacing to siblings. Hold <Kbd>Alt</Kbd> to measure between two elements.
      </>
    ),
  },
  {
    name: "Pen & Text",
    description: (
      <>
        Draw or drop notes on the page. <Kbd>⌃</Kbd> cycles the tools, <Kbd>Shift</Kbd> draws
        straight.
      </>
    ),
  },
  {
    name: "Changes",
    description: "Every style tweak, listed by element. Inline only, gone on reload.",
  },
];

const HomePage = () => (
  <div className="flex min-h-dvh flex-col bg-canvas text-body text-prose">
    <ReactGrabLoader />
    <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 pt-6">
      <div className="flex items-baseline gap-2">
        <span className="font-semibold text-title">vpk-grab</span>
        <span className="font-mono text-xs text-faint">v{VPK_GRAB_VERSION}</span>
      </div>
      <div className="flex items-center gap-5">
        <ThemeSwitch />
        <GithubLink />
      </div>
    </header>

    <main className="page-fade-in mx-auto grid w-full max-w-5xl flex-1 items-center gap-12 px-6 pt-10 pb-24 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)] lg:gap-16 lg:py-0">
      <section className="flex min-w-0 flex-col gap-7">
        <div className="flex flex-col gap-3">
          <h1 className="text-display font-semibold tracking-tight text-balance text-title">
            Inspect any UI, then hand it to your agent.
          </h1>
          <p className="max-w-md text-pretty">
            <AccentLink href="https://github.com/aidenybai/react-grab">React Grab</AccentLink> with
            a design inspector built in. Use the toolbar at the bottom of this page.
          </p>
        </div>

        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-[auto_minmax(0,1fr)]">
          {FEATURES.map((feature) => (
            <div key={feature.name} className="contents">
              <dt className="font-medium text-label">{feature.name}</dt>
              <dd className="-mt-2 sm:mt-0">{feature.description}</dd>
            </div>
          ))}
        </dl>

        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-4 text-sm">
            <span className="text-label">Paste into your coding agent</span>
            <AccentLink href={VPK_GRAB_INSTALL_DOCS_URL}>Other ways to install</AccentLink>
          </div>
          <InstallCommand />
        </div>
      </section>

      <section aria-label="Playground" className="flex min-w-0 flex-col gap-3">
        <p className="text-sm text-meta">
          Try it here: hover <Kbd>⋯</Kbd> to open its menu, then hold <Kbd>⌘C</Kbd> to freeze it
          open.
        </p>
        <PlaygroundCard />
      </section>
    </main>
  </div>
);

export default HomePage;
