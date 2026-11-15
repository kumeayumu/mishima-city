"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { spawnSync } = require("node:child_process");
const {
  readExpectedChecksum,
  createProjectEnvironment,
} = require("./utils/tool-utils.cjs");

const root = path.resolve(__dirname, "../..");
const tools = path.join(root, ".tools");
const nodeVersion = fs
  .readFileSync(path.join(root, ".node-version"), "utf8")
  .trim();
const pkg = JSON.parse(
  fs.readFileSync(path.join(root, "package.json"), "utf8")
);
const pnpmVersion = pkg.packageManager.match(/^pnpm@(\d+\.\d+\.\d+)$/)?.[1];
if (!/^24\.\d+\.\d+$/.test(nodeVersion) || !pnpmVersion?.startsWith("10.")) {
  throw new Error("Expected a pinned Node.js 24 and pnpm 10 version.");
}
if (process.platform !== "win32" || !["x64", "arm64"].includes(process.arch)) {
  throw new Error(
    "mishima.cmd supports Windows x64/arm64. Use the pinned tools directly on other platforms."
  );
}
const nodeName = `node-v${nodeVersion}-win-${process.arch}`;
const nodeDirectory = path.join(tools, nodeName);
const nodeExe = path.join(nodeDirectory, "node.exe");
const pnpmDirectory = path.join(tools, `pnpm-${pnpmVersion}`);
const pnpmEntry = path.join(pnpmDirectory, "node_modules/pnpm/bin/pnpm.cjs");
const pnpmBin = path.join(pnpmDirectory, "node_modules/.bin");
const environment = createProjectEnvironment(
  process.env,
  nodeDirectory,
  pnpmBin
);

function run(executable, args, extraEnvironment = {}) {
  const result = spawnSync(executable, args, {
    cwd: root,
    env: { ...environment, ...extraEnvironment },
    stdio: "inherit",
    windowsHide: true,
  });
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error(`Command failed (${result.status}): ${args.join(" ")}`);
}

function verifyTools() {
  if (!fs.existsSync(nodeExe) || !fs.existsSync(pnpmEntry)) {
    throw new Error(
      "Project tools are not installed. Run .\\mishima.cmd setup first."
    );
  }
  const node = spawnSync(nodeExe, ["--version"], {
    encoding: "utf8",
    windowsHide: true,
  });
  const pnpm = spawnSync(nodeExe, [pnpmEntry, "--version"], {
    env: environment,
    encoding: "utf8",
    windowsHide: true,
  });
  if (
    node.status !== 0 ||
    node.stdout.trim() !== `v${nodeVersion}` ||
    pnpm.status !== 0 ||
    pnpm.stdout.trim() !== pnpmVersion
  ) {
    throw new Error(
      "Project tool versions do not match .node-version/packageManager. Run setup."
    );
  }
}

async function setup() {
  if (fs.existsSync(tools) && fs.lstatSync(tools).isSymbolicLink()) {
    throw new Error("Refusing to install through a .tools symlink/junction.");
  }
  fs.mkdirSync(path.join(tools, "downloads"), { recursive: true });
  if (!fs.existsSync(nodeExe)) {
    const filename = `${nodeName}.zip`;
    const base = `https://nodejs.org/dist/v${nodeVersion}/`;
    console.log(
      `Downloading and verifying Node.js ${nodeVersion} into .tools ...`
    );
    const checksumResponse = await fetch(`${base}SHASUMS256.txt`, {
      signal: AbortSignal.timeout(60000),
    });
    if (!checksumResponse.ok)
      throw new Error(
        `Node checksum download: HTTP ${checksumResponse.status}`
      );
    const expected = readExpectedChecksum(
      await checksumResponse.text(),
      filename
    );
    const archive = path.join(tools, "downloads", filename);
    if (!fs.existsSync(archive)) {
      const response = await fetch(base + filename, {
        signal: AbortSignal.timeout(120000),
      });
      if (!response.ok)
        throw new Error(`Node download: HTTP ${response.status}`);
      fs.writeFileSync(archive, Buffer.from(await response.arrayBuffer()));
    }
    const actual = crypto
      .createHash("sha256")
      .update(fs.readFileSync(archive))
      .digest("hex");
    if (actual !== expected)
      throw new Error(
        "Node archive checksum mismatch; no archive was extracted."
      );
    run(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        "Expand-Archive -LiteralPath $env:MISHIMA_NODE_ARCHIVE -DestinationPath $env:MISHIMA_TOOLS_DIRECTORY -Force",
      ],
      { MISHIMA_NODE_ARCHIVE: archive, MISHIMA_TOOLS_DIRECTORY: tools }
    );
  }
  if (
    !fs.existsSync(pnpmEntry) ||
    JSON.parse(
      fs.readFileSync(
        path.join(pnpmDirectory, "node_modules/pnpm/package.json"),
        "utf8"
      )
    ).version !== pnpmVersion
  ) {
    console.log(`Installing project-local pnpm ${pnpmVersion} ...`);
    run(nodeExe, [
      path.join(nodeDirectory, "node_modules/npm/bin/npm-cli.js"),
      "install",
      "--prefix",
      pnpmDirectory,
      "--cache",
      path.join(tools, "npm-cache"),
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
      "--save-exact",
      `pnpm@${pnpmVersion}`,
    ]);
  }
  verifyTools();
  if (!fs.existsSync(path.join(root, ".env"))) {
    fs.copyFileSync(
      path.join(root, ".env.example"),
      path.join(root, ".env"),
      fs.constants.COPYFILE_EXCL
    );
    console.log(
      "Created .env from .env.example. Existing .env files are never overwritten."
    );
  }
  run(nodeExe, [pnpmEntry, "install", "--frozen-lockfile"]);
  console.log(
    "Setup complete. Windows Node.js, PATH, profiles and global npm packages were not changed."
  );
}

async function main() {
  const [command = "help", ...args] = process.argv.slice(2);
  if (command === "help") {
    console.log(
      "Mishima project tools: setup | info | node <args> | pnpm <args> | dev | dev:all | lint | typecheck | test | build"
    );
    return;
  }
  if (command === "setup") {
    if (args.length) throw new Error("setup does not accept arguments.");
    await setup();
    return;
  }
  verifyTools();
  if (command === "info") {
    console.log(`Project Node: ${nodeExe}`);
    run(nodeExe, ["--version"]);
    console.log(`Project pnpm: ${pnpmEntry}`);
    run(nodeExe, [pnpmEntry, "--version"]);
    console.log(
      "Only child processes use the project tools; Windows PATH remains unchanged."
    );
    return;
  }
  if (command === "node") return run(nodeExe, args);
  if (command === "pnpm") return run(nodeExe, [pnpmEntry, ...args]);
  const scripts = {
    dev: "dev:web",
    "dev:all": "dev",
    lint: "lint",
    typecheck: "typecheck",
    test: "test",
    "test:tools": "test:windows-tools",
    "test:coverage": "test:coverage",
    build: "build:web",
  };
  if (!Object.hasOwn(scripts, command))
    throw new Error("Unknown command. Run .\\mishima.cmd help.");
  run(nodeExe, [pnpmEntry, "run", scripts[command], ...args]);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
