import { describe, expect, it } from "vitest";
import source from "../../server/data/2026/bills.json";
import {
  billResultOptions,
  filterBillSessions,
  matchesBillQuery,
  normalizeBillSearchText,
  parseBillSearchFilters,
} from "./bill-search";

type SourceBill = (typeof source.sessions)[number]["bills"][number];

const keys = source.sessions.map((session) => session.sourceUrl);
const bill = {
  number: "議第68号",
  title: "令和8年度三島市一般会計補正予算案（第6号）",
  result: "",
};
const search = (params: Record<string, string | string[] | undefined>) =>
  filterBillSessions(source.sessions, parseBillSearchFilters(params, keys));
const allBills = (params: Record<string, string | string[] | undefined>) =>
  search(params).flatMap<SourceBill>((s) => s.bills);

describe("bill keyword matching", () => {
  it("normalizes Unicode width, case and surrounding/repeated whitespace", () => {
    expect(normalizeBillSearchText("　ＡＢＣ  １２３　")).toBe("abc 123");
  });
  it.each([
    "68",
    "６８",
    "議第68号",
    "議第６８号",
    "議68",
    "議案第68号",
    "第068号",
    "　議　第　６８　号　",
  ])("finds bill number variant %s", (q) => {
    expect(matchesBillQuery(bill, q)).toBe(true);
  });
  it("does not confuse distinct bill numbers or prefixes", () => {
    expect(matchesBillQuery(bill, "議第6号")).toBe(false);
    expect(matchesBillQuery(bill, "承第68号")).toBe(false);
    expect(
      matchesBillQuery(
        { ...bill, number: "議第168号", title: "工事契約" },
        "68"
      )
    ).toBe(false);
  });
  it("still matches numeric phrases in a subject", () => {
    expect(matchesBillQuery(bill, "第6号")).toBe(true);
  });
  it("requires every keyword, including full-width separators", () => {
    expect(matchesBillQuery(bill, "一般会計　補正予算 68")).toBe(true);
    expect(matchesBillQuery(bill, "一般会計 水道")).toBe(false);
    expect(matchesBillQuery(bill, "　")).toBe(true);
  });
  it("handles non-議 bill types", () => {
    expect(
      matchesBillQuery(
        { ...bill, number: "陳情第1号", title: "要望" },
        "陳情１"
      )
    ).toBe(true);
  });
});

describe("filter parsing and real 2026 snapshot", () => {
  it("has all 62 bills in their original order by default", () => {
    expect(search({})).toEqual(source.sessions);
    expect(allBills({})).toHaveLength(62);
  });
  it("handles empty and repeated URL parameters deterministically", () => {
    expect(
      parseBillSearchFilters(
        { q: ["　６８　", "99"], session: [], result: [] },
        keys
      )
    ).toEqual({ query: "68", session: "", result: "", ignoredFilters: false });
  });
  it("ignores invalid URL filters without suppressing results", () => {
    expect(
      parseBillSearchFilters({ session: "unknown", result: "denied" }, keys)
    ).toMatchObject({ session: "", result: "", ignoredFilters: true });
    expect(allBills({ session: "unknown", result: "denied" })).toHaveLength(62);
  });
  it.each(source.sessions)("selects just $title", (session) => {
    expect(search({ session: session.sourceUrl })).toEqual([session]);
  });
  it.each(billResultOptions)("filters the exact result $label", (option) => {
    const expected = source.sessions
      .flatMap<SourceBill>((s) => s.bills)
      .filter((b) =>
        option.value === "unpublished"
          ? b.result === ""
          : b.result === option.value
      );
    expect(expected.length).toBeGreaterThan(0);
    expect(allBills({ result: option.value })).toEqual(expected);
  });
  it("combines query, session and unpublished result", () => {
    const found = allBills({
      q: "６８ 一般会計",
      session: keys[0],
      result: "unpublished",
    });
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({
      number: "議第68号",
      documentUrls: [
        "https://www.city.mishima.shizuoka.jp/uploaded/attachment/17869.pdf",
      ],
    });
    expect(
      allBills({ q: "68", session: keys[0], result: "可決" })
    ).toHaveLength(0);
  });
  it("returns no groups for zero results and restores all after clearing", () => {
    expect(search({ q: "存在しない検索語" })).toEqual([]);
    expect(search({ q: "", session: "", result: "" })).toEqual(source.sessions);
  });
  it("preserves source warnings, links, order and original snapshot", () => {
    const before = JSON.stringify(source);
    const filtered = allBills({ q: "予算" });
    expect(filtered.length).toBeGreaterThan(0);
    expect(filtered).toEqual(
      source.sessions
        .flatMap<SourceBill>((s) => s.bills)
        .filter((b) => b.title.includes("予算"))
    );
    const fixture = [
      {
        sourceUrl: "fixture",
        bills: [
          {
            ...bill,
            sourceWarnings: ["番号を要確認"],
            documentUrls: ["https://example.com/source.pdf"],
          },
        ],
      },
    ];
    expect(
      filterBillSessions(
        fixture,
        parseBillSearchFilters({ q: "68" }, ["fixture"])
      )[0].bills[0]
    ).toBe(fixture[0].bills[0]);
    expect(JSON.stringify(source)).toBe(before);
  });
});
