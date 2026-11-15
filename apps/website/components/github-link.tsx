import { IconGithub } from "@/components/icons/icon-github";
import { VPK_GRAB_REPOSITORY_URL } from "@/lib/constants";

interface GithubLinkProps {
  className?: string;
}

export const GithubLink = ({ className = "" }: GithubLinkProps) => (
  <a
    href={VPK_GRAB_REPOSITORY_URL}
    target="_blank"
    rel="noopener noreferrer"
    aria-label="vpk-grab on GitHub"
    className={`text-faint transition-colors hover:text-ink ${className}`}
  >
    <IconGithub />
  </a>
);

GithubLink.displayName = "GithubLink";
