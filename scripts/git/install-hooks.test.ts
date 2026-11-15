import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const { installHooks } = createRequire(import.meta.url)("./install-hooks.cjs");
function checkout() {
  const root = mkdtempSync(path.join(tmpdir(), "mishima-hooks-"));
  execFileSync("git", ["init", root], { stdio: "ignore" });
  return root;
}
afterEach(() => vi.unstubAllEnvs());
describe("Git hook installation", () => {
  it("installs through a real linked worktree without treating .git as a directory", () => {
    vi.stubEnv("CI", "");
    vi.stubEnv("VERCEL", "");
    const root = checkout();
    execFileSync(
      "git",
      [
        "-C",
        root,
        "-c",
        "user.name=Test",
        "-c",
        "user.email=test@example.com",
        "commit",
        "--allow-empty",
        "-m",
        "init",
      ],
      { stdio: "ignore" }
    );
    const worktree = path.join(root, "linked");
    execFileSync(
      "git",
      ["-C", root, "worktree", "add", "-b", "linked", worktree],
      { stdio: "ignore" }
    );
    installHooks(worktree);
    expect(
      readFileSync(path.join(root, ".git/hooks/pre-commit"), "utf8")
    ).toContain("mirai-gikai managed pre-commit");
    expect(readFileSync(path.join(worktree, ".git"), "utf8")).toContain(
      "gitdir:"
    );
  });
  it("preserves an existing custom hook", () => {
    vi.stubEnv("CI", "");
    vi.stubEnv("VERCEL", "");
    const root = checkout();
    const target = path.join(root, ".git/hooks/pre-commit");
    writeFileSync(target, "#!/bin/sh\necho custom\n");
    installHooks(root);
    expect(readFileSync(target, "utf8")).toBe("#!/bin/sh\necho custom\n");
  });
  it("skips hooks in CI and Vercel", () => {
    const root = checkout();
    vi.stubEnv("CI", "true");
    installHooks(root);
    expect(existsSync(path.join(root, ".git/hooks/pre-commit"))).toBe(false);
    vi.stubEnv("CI", "");
    vi.stubEnv("VERCEL", "1");
    installHooks(root);
    expect(existsSync(path.join(root, ".git/hooks/pre-commit"))).toBe(false);
  });
  it("honors core.hooksPath", () => {
    vi.stubEnv("CI", "");
    vi.stubEnv("VERCEL", "");
    const root = checkout();
    execFileSync("git", [
      "-C",
      root,
      "config",
      "core.hooksPath",
      ".custom-hooks",
    ]);
    installHooks(root);
    expect(existsSync(path.join(root, ".custom-hooks/pre-commit"))).toBe(true);
  });
});
