import { readdirSync } from "node:fs";
import path from "node:path";
import { expect, it } from "vitest";

it("registers only archive and informational routes, without database or AI endpoints", () => {
  function routes(directory: string, segments: string[] = []): string[] {
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
      if (entry.isDirectory()) {
        if (entry.name.startsWith("_")) return [];
        return routes(
          path.join(directory, entry.name),
          entry.name.startsWith("(") ? segments : [...segments, entry.name]
        );
      }
      return entry.name === "page.tsx" || entry.name === "route.ts"
        ? [`/${segments.join("/")}`]
        : [];
    });
  }
  expect(routes(path.resolve("src/app")).sort()).toEqual([
    "/",
    "/faq",
    "/members",
    "/members/[memberId]",
    "/minutes/[id]",
    "/privacy",
    "/terms",
  ]);
});
