// Releases the fork from GitHub alone, with no npm publish.
//
// A release is a tag plus a GitHub release:
// - the tag points at a commit one step off the branch that carries the built
//   browser bundle, so jsDelivr can serve it for script-tag installs;
// - the GitHub release carries the package tarball for dependency installs.
//
// Usage: node scripts/release-fork.mjs   (from a clean checkout of main)
// VPK pins one release; after releasing, run `pnpm run update:vpk-grab` in VPK.
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const REPOSITORY = "eevennsoh/vpk-grab";
const PACKAGE_DIRECTORY = "packages/react-grab";
const BUNDLE_SOURCE_PATH = path.join(PACKAGE_DIRECTORY, "dist/index.global.js");
const BUNDLE_RELEASE_PATH = "dist/vpk-grab.global.js";

const run = (command, commandArguments, options = {}) =>
  execFileSync(command, commandArguments, { stdio: "inherit", ...options });

const read = (command, commandArguments) =>
  execFileSync(command, commandArguments, { encoding: "utf8" }).trim();

const { version } = JSON.parse(readFileSync(path.join(PACKAGE_DIRECTORY, "package.json"), "utf8"));
const tag = `v${version}`;

if (read("git", ["status", "--porcelain"]) !== "") {
  throw new Error("Commit or stash your changes before releasing.");
}
if (read("git", ["tag", "--list", tag]) !== "") {
  throw new Error(`${tag} already exists. Bump the version in ${PACKAGE_DIRECTORY}/package.json.`);
}
const branch = read("git", ["branch", "--show-current"]);
if (!branch) throw new Error("Release from a branch, not a detached HEAD.");

run("pnpm", ["build"]);

const tarballDirectory = mkdtempSync(path.join(tmpdir(), "vpk-grab-release-"));
run("pnpm", ["pack", "--pack-destination", tarballDirectory], { cwd: PACKAGE_DIRECTORY });
const tarballName = readdirSync(tarballDirectory).find((fileName) => fileName.endsWith(".tgz"));
if (!tarballName) throw new Error("pnpm pack produced no tarball.");

mkdirSync(path.dirname(BUNDLE_RELEASE_PATH), { recursive: true });
copyFileSync(BUNDLE_SOURCE_PATH, BUNDLE_RELEASE_PATH);

run("git", ["checkout", "--detach"]);
try {
  // dist is ignored on the branch; only the tagged commit carries the bundle.
  run("git", ["add", "--force", BUNDLE_RELEASE_PATH]);
  run("git", ["commit", "--message", `Release ${tag}`]);
  run("git", ["tag", tag]);
  run("git", ["push", "origin", tag]);
} finally {
  run("git", ["checkout", branch]);
}

run("gh", [
  "release",
  "create",
  tag,
  path.join(tarballDirectory, tarballName),
  "--repo",
  REPOSITORY,
  "--title",
  tag,
  "--generate-notes",
]);

console.log(`\nReleased ${tag}`);
console.log(`Script tag: https://cdn.jsdelivr.net/gh/${REPOSITORY}@${tag}/${BUNDLE_RELEASE_PATH}`);
console.log(`Package:    https://github.com/${REPOSITORY}/releases/download/${tag}/${tarballName}`);
console.log(
  "\nNext: in the VPK repo, run `pnpm run update:vpk-grab` and ship it, so VPK moves to this release.",
);
