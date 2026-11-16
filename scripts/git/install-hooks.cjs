const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

function installHooks(root = process.cwd()) {
  if (process.env.CI || process.env.VERCEL) {
    console.log("Git hooks are only installed in local development.");
    return;
  }
  let hooks;
  try {
    hooks = execFileSync("git", ["rev-parse", "--git-path", "hooks"], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    console.log("No Git checkout; skipping local hook installation.");
    return;
  }
  const directory = path.resolve(root, hooks);
  const target = path.join(directory, "pre-commit");
  const marker = "# mirai-gikai managed pre-commit";
  if (
    fs.existsSync(target) &&
    !fs.readFileSync(target, "utf8").includes(marker)
  ) {
    console.log("Existing pre-commit hook preserved; run checks manually.");
    return;
  }
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(
    target,
    [
      "#!/bin/sh",
      marker,
      'if [ "$SKIP_SIMPLE_GIT_HOOKS" = "1" ]; then exit 0; fi',
      'if [ "$OS" = "Windows_NT" ] && [ -f mishima.cmd ]; then',
      '  MSYS_NO_PATHCONV=1 exec cmd.exe /d /c "mishima.cmd pnpm exec lint-staged"',
      "fi",
      "exec pnpm exec lint-staged",
      "",
    ].join("\n"),
    { mode: 0o755 }
  );
  console.log("Installed pre-commit hook using Git-resolved hooks directory.");
}
if (require.main === module) installHooks();
module.exports = { installHooks };
