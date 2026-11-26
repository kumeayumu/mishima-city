import { describe, expect, it } from "vitest";
import coverage from "../../server/data/2026/coverage.json";
import members from "../../server/data/members.json";
import snapshots from "../../server/data/roster-snapshots.json";
import sources from "../../server/data/sources.json";
import {
  filterMemberProfiles,
  getMemberProfiles,
  parseMemberFilters,
} from "./member-profile";
import { parseActivityData } from "./validate-activity-data";

const data = parseActivityData({ members, sources, snapshots, coverage });
const profiles = getMemberProfiles(data);
const factionIds = snapshots.factions[0].groups.map((g) => g.id);
const filter = (params: Parameters<typeof parseMemberFilters>[0]) =>
  filterMemberProfiles(profiles, parseMemberFilters(params, factionIds));

describe("member profiles and filters", () => {
  it("defaults to all 22 members in official seat order without mutating the input", () => {
    const out = filter({});
    expect(out).toHaveLength(22);
    expect(out.map((p) => p.entry.seatNumber)).toEqual(
      Array.from({ length: 22 }, (_, i) => i + 1)
    );
    expect(profiles[0].entry.seatNumber).toBe(1);
  });
  it("searches name and hiragana", () => {
    expect(filter({ q: "秋山" })[0].member.name).toBe("秋山恭亮");
    expect(filter({ q: "あきやま" })).toHaveLength(1);
  });
  it("normalizes katakana and half-width kana", () => {
    expect(filter({ q: "アキヤマ" })).toHaveLength(1);
    expect(filter({ q: "ｱｷﾔﾏ" })).toHaveLength(1);
  });
  it("matches verified name variants", () => {
    expect(filter({ q: "高田" })[0].member.name).toBe("髙田康子");
  });
  it("does not silently make an unconfirmed spelling an alias", () => {
    expect(filter({ q: "涼子" })).toHaveLength(0);
    expect(
      profiles.find((p) => p.member.name === "野村諒子")?.member.notes[0].text
    ).toContain("野村涼子");
  });
  it("supports multiple words with AND and whitespace", () => {
    expect(filter({ q: "　秋山　恭亮　" })).toHaveLength(1);
    expect(filter({ q: "秋山 本間" })).toHaveLength(0);
  });
  it("filters each faction with its snapshot membership", () => {
    expect(filter({ faction: "shinpu" })).toHaveLength(5);
    expect(filter({ faction: "independent" })).toHaveLength(3);
    expect(filter({ faction: "jcp" })).toHaveLength(2);
  });
  it("combines faction and name conditions", () => {
    expect(filter({ q: "秋山", faction: "kaikaku" })).toHaveLength(1);
    expect(filter({ q: "秋山", faction: "jcp" })).toHaveLength(0);
  });
  it("sorts by kana without changing stable member IDs", () => {
    const sorted = filter({ order: "kana" });
    expect(sorted[0].member.name).toBe("秋山恭亮");
    expect(sorted.at(-1)?.member.name).toBe("横山雅人");
    expect(new Set(sorted.map((p) => p.member.id))).toEqual(
      new Set(profiles.map((p) => p.member.id))
    );
  });
  it("ignores unknown filters visibly", () => {
    expect(
      parseMemberFilters({ faction: "missing", order: "score" }, factionIds)
    ).toMatchObject({ faction: "", order: "seat", ignoredFilters: true });
  });
  it("handles duplicate URL parameters without crashing", () => {
    expect(
      parseMemberFilters({ q: ["秋山", "本間"] }, factionIds)
    ).toMatchObject({ query: "秋山", ignoredFilters: true });
  });
  it("caps very long URL queries", () => {
    expect(
      parseMemberFilters({ q: "a".repeat(101) }, factionIds)
    ).toMatchObject({ query: "a".repeat(100), ignoredFilters: true });
  });
  it("treats whitespace-only query as no filter", () => {
    expect(filter({ q: "　 " })).toHaveLength(22);
  });
  it("provides source-backed roles and unknown personal term dates", () => {
    const akiyama = profiles.find((p) => p.member.name === "秋山恭亮");
    expect(akiyama?.faction).toMatchObject({
      name: "改革みしま",
      asOf: "2026-05-20",
    });
    expect(akiyama?.committees).toContainEqual(
      expect.objectContaining({
        name: "福祉教育委員会",
        role: "委員長",
        asOf: "2026-05-15",
      })
    );
    expect(akiyama?.term?.startsOn).toBeNull();
    expect(akiyama?.term?.scheduledEnd).toBe("2027-04-30");
    expect(data.coverage.activities.votes).toBe("partial");
  });
  it("keeps IDs when names or seats change", () => {
    const changed = structuredClone(data);
    changed.members[0].name = "表示名変更";
    changed.snapshots.rosters[0].entries[0].seatNumber = 99;
    expect(getMemberProfiles(changed)[0].member.id).toBe(profiles[0].member.id);
  });
  it("does not replace selected historical factions with another snapshot", () => {
    const changed = structuredClone(data);
    changed.snapshots.factions.push({
      ...structuredClone(changed.snapshots.factions[0]),
      id: "future",
      asOf: "2027-01-01",
      groups: [
        {
          id: "new",
          name: "新しい会派",
          memberIds: changed.members.map((m) => m.id),
        },
      ],
    });
    expect(getMemberProfiles(changed)[0].faction?.name).toBe("改革みしま");
  });
});
