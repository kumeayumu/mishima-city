import { describe, expect, it } from "vitest";
import coverage from "../../server/data/2026/coverage.json";
import members from "../../server/data/members.json";
import snapshots from "../../server/data/roster-snapshots.json";
import sources from "../../server/data/sources.json";
import { parseActivityData } from "./validate-activity-data";
import { getSourceApprovalDigest } from "./vote-approval-digests";

const fixture = () =>
  structuredClone({ members, sources, snapshots, coverage });

describe("official member data validation", () => {
  it.each([
    "pending",
    "approved",
  ])("accepts valid operator review state %s", (state) => {
    const d = fixture();
    d.coverage.operatorReview = state;
    for (const source of d.sources) source.review.operatorReview = state;
    expect(() => parseActivityData(d)).not.toThrow();
  });

  it("rejects aliases owned by another member", () => {
    const d = fixture();
    d.members[0].nameVariants = [d.members[1].name];
    expect(() => parseActivityData(d)).toThrow("衝突");
  });
  it("allows multiple equivalent spellings for the same member", () => {
    const d = fixture();
    d.coverage.operatorReview = "pending"; // Valid spelling change is not silently approved.
    d.members[0].nameVariants = [d.members[0].name];
    expect(() => parseActivityData(d)).not.toThrow();
  });

  it("rejects snapshot dates that contradict their official source", () => {
    const d = fixture();
    d.snapshots.rosters[0].asOf = "2026-05-16";
    expect(() => parseActivityData(d)).toThrow("基準日が不一致");
  });

  it("accepts 22 unique members and all source-backed snapshots without private fields", () => {
    const data = parseActivityData(fixture());
    expect(data.members).toHaveLength(22);
    expect(new Set(data.members.map((m) => m.id)).size).toBe(22);
    expect(data.sources).toHaveLength(11);
    expect(
      data.snapshots.factions[0].groups.map((g) => g.memberIds.length)
    ).toEqual([5, 4, 3, 3, 2, 2, 3]);
    expect(data.snapshots.committees.flatMap((s) => s.committees)).toHaveLength(
      6
    );
    expect(data.snapshots.terms[0].startsOn).toBeNull();
  });
  it("matches the independently checked official seat order and terms served", () => {
    const data = parseActivityData(fixture());
    const byId = new Map(data.members.map((m) => [m.id, m.name]));
    expect(
      data.snapshots.rosters[0].entries.map((e) => [
        e.seatNumber,
        byId.get(e.memberId),
        e.termsServed,
      ])
    ).toEqual([
      [1, "秋山恭亮", 1],
      [2, "沈久美", 2],
      [3, "村田耕一", 3],
      [4, "堀江和雄", 4],
      [5, "鈴木文子", 5],
      [6, "石井真人", 2],
      [7, "本間雄次郎", 1],
      [8, "弓場重明", 5],
      [9, "服部正平", 3],
      [10, "河野月江", 2],
      [11, "甲斐幸博", 3],
      [12, "佐野淳祥", 4],
      [13, "藤江康儀", 4],
      [14, "古長谷稔", 3],
      [15, "髙田康子", 1],
      [16, "永田裕二", 1],
      [17, "土屋利絵", 4],
      [18, "横山雅人", 1],
      [19, "野村諒子", 4],
      [20, "川原章寛", 6],
      [21, "宮下知朗", 2],
      [22, "岡田美喜子", 4],
    ]);
  });
  it("rejects duplicate member IDs", () => {
    const d = fixture();
    d.members[1].id = d.members[0].id;
    expect(() => parseActivityData(d)).toThrow("議員IDの重複");
  });
  it("rejects missing member IDs", () => {
    const d = fixture();
    d.members[0].id = "";
    expect(() => parseActivityData(d)).toThrow();
  });
  it("rejects a missing official source", () => {
    const d = fixture();
    d.members[0].officialSourceId = "missing";
    expect(() => parseActivityData(d)).toThrow("参照先が不明");
  });
  it("rejects a stale note source", () => {
    const d = fixture();
    d.members[18].notes[0].sourceIds = ["missing"];
    expect(() => parseActivityData(d)).toThrow();
  });
  it("rejects duplicate seats", () => {
    const d = fixture();
    d.snapshots.rosters[0].entries[1].seatNumber = 1;
    expect(() => parseActivityData(d)).toThrow("議席番号の重複");
  });
  it("rejects wrong roster counts", () => {
    const d = fixture();
    d.snapshots.rosters[0].entries.pop();
    expect(() => parseActivityData(d)).toThrow("対象議員数");
  });
  it("rejects missing faction memberships", () => {
    const d = fixture();
    d.snapshots.factions[0].groups[0].memberIds.pop();
    expect(() => parseActivityData(d)).toThrow("欠損");
  });
  it("rejects multiple factions for the same member at the same snapshot", () => {
    const d = fixture();
    d.snapshots.factions[0].groups[1].memberIds.push(
      d.snapshots.factions[0].groups[0].memberIds[0]
    );
    expect(() => parseActivityData(d)).toThrow("会派所属の重複");
  });
  it("rejects unknown committee members", () => {
    const d = fixture();
    d.snapshots.committees[0].committees[0].memberIds.push("missing");
    expect(() => parseActivityData(d)).toThrow();
  });
  it("rejects chair assignments outside the committee", () => {
    const d = fixture();
    d.snapshots.committees[0].committees[0].chairId = d.members[0].id;
    expect(() => parseActivityData(d)).toThrow("委員長");
  });
  it("rejects unknown selected snapshots", () => {
    const d = fixture();
    d.coverage.rosterSnapshotId = "missing";
    expect(() => parseActivityData(d)).toThrow("選択議員名簿");
  });
  it("rejects inconsistent known affiliation periods", () => {
    const d = fixture();
    const input = {
      ...d,
      snapshots: {
        ...d.snapshots,
        factions: d.snapshots.factions.map((f) => ({
          ...f,
          validFrom: "2026-06-01",
        })),
      },
    };
    expect(() => parseActivityData(input)).toThrow("所属期間");
  });
  it("rejects invalid term periods", () => {
    const d = fixture();
    const input = {
      ...d,
      snapshots: {
        ...d.snapshots,
        terms: d.snapshots.terms.map((t) => ({ ...t, startsOn: "2028-01-01" })),
      },
    };
    expect(() => parseActivityData(input)).toThrow("逆転");
  });
  it.each([
    "address",
    "age",
    "phone",
    "photo",
    "rawText",
  ])("rejects unexpected member field %s", (field) => {
    const d = fixture();
    const m = { ...d.members[0], [field]: "private" };
    expect(() =>
      parseActivityData({ ...d, members: [m, ...d.members.slice(1)] })
    ).toThrow();
  });
  it.each([
    "http://www.city.mishima.shizuoka.jp/",
    "https://example.com/",
    "https://ssp.kaigiroku.net/tenant/other/SpMinuteView.html?tenant_id=406&council_id=452&schedule_id=1",
    "https://ssp.kaigiroku.net/tenant/mishima/SpMinuteView.html?tenant_id=999&council_id=452&schedule_id=1",
  ])("rejects non-official URL %s", (url) => {
    const d = fixture();
    d.sources[0].url = url;
    expect(() => parseActivityData(d)).toThrow();
  });
  it("rejects malformed dates and source hashes", () => {
    const d = fixture();
    d.sources[0].sha256 = "wrong";
    expect(() => parseActivityData(d)).toThrow();
    d.sources[0].asOf = "2026-02-30";
    expect(() => parseActivityData(d)).toThrow();
  });
  it("does not silently treat activity data as collected", () => {
    const d = fixture();
    expect(() =>
      parseActivityData({
        ...d,
        coverage: {
          ...d.coverage,
          activities: {
            votes: "complete",
            questionsAndAnswers: "not_collected",
          },
        },
      })
    ).toThrow();
  });
});

it("rejects source approval without its operator evidence", () => {
  const d = fixture();
  const source = d.sources[0] as Omit<(typeof d.sources)[number], "review"> & {
    review: Omit<(typeof d.sources)[number]["review"], "operatorApproval"> & {
      operatorApproval?: (typeof d.sources)[number]["review"]["operatorApproval"];
    };
  };
  delete source.review.operatorApproval;
  expect(() => parseActivityData(d)).toThrow("出典承認の根拠");
});

it.each([
  "sha256",
  "url",
  "usage",
] as const)("rejects a revised approved source %s under its old acceptance", (field) => {
  const d = fixture(),
    source = d.sources.find((s) => s.id === "nov-bills");
  if (!source) throw Error("missing source");
  source[field] =
    field === "sha256"
      ? "0".repeat(64)
      : field === "url"
        ? "https://www.city.mishima.shizuoka.jp/site/gikai/39043.html"
        : `${source.usage} changed scope`;
  expect(() => parseActivityData(d)).toThrow("出典承認の資料版ハッシュ");
});

it("rejects swapping valid seats under old roster approval", () => {
  const d = fixture(),
    rows = d.snapshots.rosters[0].entries;
  [rows[0].seatNumber, rows[1].seatNumber] = [
    rows[1].seatNumber,
    rows[0].seatNumber,
  ];
  expect(() => parseActivityData(d)).toThrow("議員・名簿の承認対象ハッシュ");
});
it("rejects member facts changed without renewing their review scope", () => {
  const d = fixture();
  d.members[0].kana += "あ";
  expect(() => parseActivityData(d)).toThrow("議員・名簿の承認対象ハッシュ");
});

it("rejects a changed November annotation under its old source approval", () => {
  const d = fixture(),
    source = d.sources.find((s) => s.id === "nov-bills");
  if (!source?.notice) throw Error("missing notice");
  source.notice.passed = 16;
  expect(() => parseActivityData(d)).toThrow("出典承認の資料版ハッシュ");
});

it("allows missing supplemental notes while pending but requires them for November approval", () => {
  const d = fixture(),
    source = d.sources.find((s) => s.id === "nov-bills");
  if (!source) throw Error("missing source");
  delete source.notice;
  source.review.operatorReview = "pending";
  expect(() => parseActivityData(d)).not.toThrow();
  source.review.operatorReview = "approved";
  source.review.operatorApproval.reviewedSha256 =
    getSourceApprovalDigest(source);
  expect(() => parseActivityData(d)).toThrow("承認済み11月出典の注記");
});
