"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { COPY_FEEDBACK_MS, VPK_GRAB_AGENT_INSTALL_PROMPT } from "@/lib/constants";

export const InstallCommand = () => {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard?.writeText(VPK_GRAB_AGENT_INSTALL_PROMPT).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), COPY_FEEDBACK_MS);
  };

  return (
    <div className="relative flex w-full cursor-text items-center justify-between gap-3 overflow-hidden rounded-md border border-line bg-canvas px-4 py-3">
      <div className="flex min-w-0 items-start font-mono text-sm">
        <div className="relative min-w-0">
          <div className="scrollbar-none overflow-x-auto whitespace-nowrap pr-6 text-ink">
            {VPK_GRAB_AGENT_INSTALL_PROMPT}
          </div>
          <div className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-linear-to-l from-canvas to-transparent" />
        </div>
      </div>
      <button
        type="button"
        aria-label={copied ? "Copied install prompt" : "Copy install prompt"}
        onClick={copy}
        className="-m-2 shrink-0 p-2 text-faint transition-colors hover:text-ink"
      >
        {copied ? <Check size={16} /> : <Copy size={16} />}
      </button>
      <span role="status" className="sr-only">
        {copied ? "Copied to clipboard" : ""}
      </span>
    </div>
  );
};
