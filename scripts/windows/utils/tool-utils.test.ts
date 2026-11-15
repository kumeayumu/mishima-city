import { describe, expect, it } from "vitest";
import tools from "./tool-utils.cjs";

const { readExpectedChecksum, createProjectEnvironment } = tools;
const hash = "a".repeat(64);
const filename = "node-v24.22.3-win-x64.zip";

describe("Node.js archive checksums", () => {
  it("selects the exact filename across CRLF lines", () => {
    expect(
      readExpectedChecksum(
        `${"b".repeat(64)}  other.zip\r\n${hash}  ${filename}\r\n`,
        filename
      )
    ).toBe(hash);
  });
  it("accepts uppercase hashes and binary markers", () => {
    expect(
      readExpectedChecksum(`${hash.toUpperCase()} *${filename}`, filename)
    ).toBe(hash);
  });
  it("rejects a missing entry, malformed hash and duplicate entries", () => {
    expect(() =>
      readExpectedChecksum(`${hash}  other.zip`, filename)
    ).toThrow();
    expect(() => readExpectedChecksum(`123  ${filename}`, filename)).toThrow();
    expect(() =>
      readExpectedChecksum(`${hash}  ${filename}\n`.repeat(2), filename)
    ).toThrow();
  });
});

describe("project-local tool environment", () => {
  it("prepends tools only in a copied environment", () => {
    const original = { Path: "C:\\Program Files\\nodejs", OTHER: "keep" };
    const result = createProjectEnvironment(
      original,
      "F:\\project\\.tools\\node",
      "F:\\project\\.tools\\pnpm"
    );
    expect(result.Path).toBe(
      "F:\\project\\.tools\\node;F:\\project\\.tools\\pnpm;C:\\Program Files\\nodejs"
    );
    expect(result.OTHER).toBe("keep");
    expect(original.Path).toBe("C:\\Program Files\\nodejs");
  });
  it("avoids duplicate PATH keys on Windows", () => {
    const result = createProjectEnvironment(
      { PATH: "existing", Path: "preferred" },
      "node24",
      "pnpm10"
    );
    expect(result.Path).toBe("node24;pnpm10;preferred");
    expect(Object.hasOwn(result, "PATH")).toBe(false);
  });
  it("works without an existing PATH", () => {
    expect(createProjectEnvironment({}, "node24", "pnpm10").Path).toBe(
      "node24;pnpm10"
    );
  });
});
