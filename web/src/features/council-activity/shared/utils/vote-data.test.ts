import { describe, expect, it } from "vitest";
import archive from "@/features/official-records/server/data/2026/bills.json";
import { filterBillSessions } from "@/features/official-records/shared/utils/bill-search";
import references from "../../server/data/2026/bill-references.json";
import coverage from "../../server/data/2026/coverage.json";
import votes from "../../server/data/2026/member-votes.json";
import resultChecks from "../../server/data/2026/result-checks.json";
import affiliations from "../../server/data/2026/vote-affiliations.json";
import cellEvidence from "../../server/data/2026/vote-cell-evidence.json";
import verification from "../../server/data/2026/vote-verifications.json";
import events from "../../server/data/2026/voting-events.json";
import members from "../../server/data/members.json";
import snapshots from "../../server/data/roster-snapshots.json";
import sources from "../../server/data/sources.json";
import { parseActivityData } from "./validate-activity-data";
import {
  applyVoteResultsToSessions,
  describeVote,
  getEventFaction,
  getFactionScope,
  getIndependentAiReviewLabel,
  getVoteBills,
  getVoteCoverage,
  getVoteEvent,
  getVoteReviewLabel,
  getVoteSummary,
  parseVoteData,
  selectVoteBills,
  type Vote,
} from "./vote-data";

const activity = parseActivityData({ members, sources, snapshots, coverage });
const fixture = () =>
  structuredClone({
    references,
    events,
    votes,
    affiliations,
    verification,
    resultChecks,
    cellEvidence,
  });
const data = parseVoteData(fixture(), activity, archive),
  bills = getVoteBills(data, archive);
const bill = (number: string) => {
  const found = bills.find((b) => b.number === number);
  if (!found) throw Error(number);
  return found;
};
const cells = (number: string) =>
  data.votes.filter(
    (v) => v.eventId === getVoteEvent(data, bill(number).id)?.id
  );
const memberId = (name: string) => {
  const m = members.find((m) => m.name === name);
  if (!m) throw Error(name);
  return m.id;
};
describe("source-backed voting data", () => {
  it("contains exactly 9 events, 198 real cells and 62 stable bill references", () => {
    expect(data.events).toHaveLength(9);
    expect(data.votes).toHaveLength(198);
    expect(bills).toHaveLength(62);
    expect(new Set(data.votes.map((v) => v.eventId + v.memberId)).size).toBe(
      198
    );
  });
  it("covers all 22 members on each event", () => {
    for (const e of data.events)
      expect(data.votes.filter((v) => v.eventId === e.id)).toHaveLength(22);
  });
  it("does not invent votes for 35 unreported and 18 result-unreported bills", () => {
    expect(bills.filter((b) => b.availability === "recorded")).toHaveLength(9);
    expect(bills.filter((b) => b.availability === "unreported")).toHaveLength(
      35
    );
    expect(
      bills.filter((b) => b.availability === "result_unreported")
    ).toHaveLength(18);
    expect(22 * bills.length).toBe(1364);
  });
  it("records matching methods while keeping human independent review pending", () => {
    expect(data.verification.methodComparison.textAndImageMatched).toBe(189);
    expect(data.verification.methodComparison.mismatches).toBe(0);
    expect(data.verification.independentReview).toBe("pending");
  });
  it.each([
    ["承第5号", 19, 2, 1],
    ["認第1号", 17, 3, 2],
    ["認第2号", 19, 2, 1],
    ["認第3号", 19, 2, 1],
    ["認第4号", 19, 2, 1],
    ["認第8号", 19, 2, 1],
    ["議第54号", 19, 2, 1],
    ["議第62号", 19, 2, 1],
    ["議第63号", 19, 2, 1],
  ])("matches the checked counts for %s", (number, yes, no, other) => {
    expect(getVoteSummary(cells(String(number)))).toMatchObject({
      yes,
      no,
      other,
      total: 22,
      divided: true,
    });
  });
  it("preserves May and September affiliations rather than applying the current faction", () => {
    const id = memberId("土屋利絵");
    expect(
      getEventFaction(
        data,
        getVoteEvent(data, bill("承第5号").id)?.id ?? "",
        id
      )
    ).toBe("無会派");
    expect(
      getEventFaction(
        data,
        getVoteEvent(data, bill("認第1号").id)?.id ?? "",
        id
      )
    ).toBe("新風会");
  });
  it("keeps leaving, negative votes and chair non-voting distinct", () => {
    const a = cells("認第1号");
    expect(
      a.find((v) => v.memberId === memberId("弓場重明"))?.participation
    ).toBe("left");
    expect(a.find((v) => v.memberId === memberId("本間雄次郎"))?.choice).toBe(
      "no"
    );
    expect(
      a.find((v) => v.memberId === memberId("岡田美喜子"))?.participation
    ).toBe("chair_not_voting");
  });
  it("uses explicit yes/no as ratio denominator and retains the 22-person composition", () => {
    const s = getVoteSummary(cells("認第1号"));
    expect(s.explicit).toBe(20);
    expect(s.yesPercent).toBe(85);
    expect(s.counts.left).toBe(1);
    expect(s.counts.chair_not_voting).toBe(1);
  });
  it("keeps both decision months and fiscal years from their sources", () => {
    expect(getVoteEvent(data, bill("認第1号").id)?.date).toBe("2026-10-02");
    expect(bill("認第1号").session).toBe(9);
    expect(bill("認第1号").bill.title).toContain("令和7年度");
  });
  it("keeps latest November result checks explicit and dated", () => {
    expect(data.resultChecks).toHaveLength(18);
    expect(
      data.resultChecks.every(
        (c) =>
          c.status === "unreported" &&
          c.result === null &&
          c.checkedAt.length > 10
      )
    ).toBe(true);
  });
  it("can show a newly published official result without rewriting the original archive", () => {
    const copy = structuredClone(data);
    const c = copy.resultChecks[0];
    c.status = "published";
    c.result = "可決";
    c.date = "2026-11-25";
    const b = getVoteBills(copy, archive).find((b) => b.id === c.billId);
    expect(b?.result).toBe("可決");
    expect(b?.availability).toBe("unreported");
    expect(archive.sessions[0].bills[0].result).toBe("");
  });
  it("rejects missing cells", () => {
    const d = fixture();
    d.votes.pop();
    expect(() => parseVoteData(d, activity, archive)).toThrow("欠損");
  });
  it("rejects duplicate cells", () => {
    const d = fixture();
    d.votes.push(d.votes[0]);
    expect(() => parseVoteData(d, activity, archive)).toThrow("重複");
  });
  it("rejects unknown member references", () => {
    const d = fixture();
    d.votes[0].memberId = "missing";
    expect(() => parseVoteData(d, activity, archive)).toThrow();
  });
  it("rejects unknown bill IDs", () => {
    const d = fixture();
    d.events[0].billId = "missing";
    expect(() => parseVoteData(d, activity, archive)).toThrow();
  });
  it("rejects unknown sources", () => {
    const d = fixture();
    d.votes[0].sourceId = "missing";
    expect(() => parseVoteData(d, activity, archive)).toThrow();
  });
  it("rejects a result-count mismatch in verification", () => {
    const d = fixture();
    d.verification.cells = 197;
    expect(() => parseVoteData(d, activity, archive)).toThrow("照合件数");
  });
  it("rejects pretending an independent review is complete", () => {
    const d = fixture();
    d.verification.independentReview = "approved";
    d.verification.operatorReview = "approved";
    expect(() => parseVoteData(d, activity, archive)).toThrow("独立確認");
  });
  it("rejects a missing latest-result check", () => {
    const d = fixture();
    d.resultChecks.pop();
    expect(() => parseVoteData(d, activity, archive)).toThrow("最新確認が欠落");
  });
  it("rejects an invalid yes plus absence", () => {
    const d = fixture();
    d.votes[0].participation = "absent";
    expect(() => parseVoteData(d, activity, archive)).toThrow("矛盾");
  });
  it("rejects a broken historical affiliation", () => {
    const d = fixture();
    d.affiliations[0].groups[0].memberIds.pop();
    expect(() => parseVoteData(d, activity, archive)).toThrow("会派");
  });
  it("rejects wrongly assigned columns", () => {
    const d = fixture();
    d.votes[0].locator.column = 2;
    expect(() => parseVoteData(d, activity, archive)).toThrow("列");
  });
  it("rejects a date contradicting the original decision", () => {
    const d = fixture();
    d.events[0].date = "2026-01-01";
    expect(() => parseVoteData(d, activity, archive)).toThrow("採決日");
  });
  it("rejects converting the source symbol to another vote", () => {
    const d = fixture();
    d.votes[0].choice = "no";
    expect(() => parseVoteData(d, activity, archive)).toThrow("原記号");
  });
});
describe("neutral voting views", () => {
  it.each([
    "absent",
    "left",
    "abstained",
    "recused",
    "chair_not_voting",
    "unknown",
  ] as const)("keeps %s distinct", (state) => {
    const v = { ...data.votes[0], choice: null, participation: state } as Vote;
    expect(describeVote(v, "recorded").label).not.toBe("反対");
    expect(describeVote(v, "recorded").symbol).not.toBe("×");
  });
  it("does not turn missing data into zero votes", () => {
    expect(describeVote(undefined, "unreported").symbol).toBe("未");
    expect(describeVote(undefined, "result_unreported").symbol).toBe("結");
    expect(getVoteSummary([]).yesPercent).toBeNull();
  });
  it("does not call unknown results unanimous", () => {
    expect(getVoteSummary([]).divided).toBe(false);
  });
  it("defaults to 9 and supports all 62", () => {
    expect(selectVoteBills(bills, data, {}).bills).toHaveLength(9);
    expect(
      selectVoteBills(bills, data, { coverage: "all", view: "matrix" }).bills
    ).toHaveLength(62);
  });
  it("filters sessions and divided outcomes without inventing votes", () => {
    expect(selectVoteBills(bills, data, { session: "5" }).bills).toHaveLength(
      1
    );
    expect(
      selectVoteBills(bills, data, { coverage: "all", divided: "1" }).bills
    ).toHaveLength(9);
    expect(
      selectVoteBills(bills, data, {
        coverage: "all",
        session: "11",
        divided: "1",
      }).bills
    ).toHaveLength(0);
  });
  it("uses safe defaults for unknown and repeated URL filters", () => {
    expect(
      selectVoteBills(bills, data, {
        coverage: ["all", "recorded"],
        view: "bad",
        session: "bad",
      })
    ).toMatchObject({ coverage: "all", view: "list", session: "" });
  });
});

it("rejects a different participation reason than the source mark", () => {
  const d = fixture();
  const chair = d.votes.find((v) => v.participation === "chair_not_voting");
  if (!chair) throw Error("chair missing");
  chair.participation = "left";
  expect(() => parseVoteData(d, activity, archive)).toThrow("参加状態");
});
it("does not consider independent review alone final operator approval", () => {
  const d = fixture();
  d.verification.independentReview = "approved";
  expect(() => parseVoteData(d, activity, archive)).not.toThrow();
});

it("rejects an unmapped mark posing as a definite absence", () => {
  const d = fixture();
  const v = d.votes.find((v) => v.choice === null);
  if (!v) throw Error("missing");
  v.observedMark = "不鮮明";
  v.participation = "absent";
  expect(() => parseVoteData(d, activity, archive)).toThrow("参加状態");
});
it("keeps an unmapped mark explicitly unknown", () => {
  const d = fixture();
  const v = d.votes.find((v) => v.choice === "yes");
  if (!v) throw Error("missing");
  v.choice = null;
  v.observedMark = "不鮮明";
  v.participation = "unknown";
  const c = d.cellEvidence.find(
    (c) => c.eventId === v.eventId && c.memberId === v.memberId
  );
  if (!c) throw Error("missing evidence");
  c.textMark = "不鮮明";
  c.imageMark = "不鮮明";
  expect(() => parseVoteData(d, activity, archive)).not.toThrow();
});
it("derives the outstanding count and date range from actual latest checks", () => {
  const d = structuredClone(data);
  d.resultChecks[0].status = "published";
  d.resultChecks[0].result = "可決";
  d.resultChecks[0].checkedAt = "2026-11-26T00:00:00.000Z";
  expect(getVoteCoverage(d)).toMatchObject({
    unreported: 36,
    resultUnreported: 17,
    lastCheck: "2026-11-26",
  });
});
it("uses event-time factions for matching and distinguishes outside from unknown", () => {
  const id = memberId("土屋利絵");
  const may = getVoteEvent(data, bill("承第5号").id)?.id,
    sep = getVoteEvent(data, bill("認第1号").id)?.id;
  expect(getFactionScope(data, may, id, "新風会")).toBe("outside");
  expect(getFactionScope(data, sep, id, "新風会")).toBe("match");
  expect(getFactionScope(data, undefined, id, "新風会")).toBe("unknown");
  expect(selectVoteBills(bills, data, { faction: "新風会" }).faction).toBe(
    "新風会"
  );
});
it("does not leave stale review-pending labels after approval", () => {
  const v = structuredClone(data.verification);
  expect(getVoteReviewLabel(v)).toContain("待ち");
  v.independentReview = "approved";
  expect(getVoteReviewLabel(v)).toContain("運営者校閲待ち");
  v.operatorReview = "approved";
  expect(getVoteReviewLabel(v)).toBe("独立二次照合・運営者校閲済み");
});

describe("2026-05-15 correction preserves named individual votes", () => {
  const okada = "msh-9c4f751d-9ffa-4169-85c8-a2b5eb6657a4";
  const horie = "msh-9a91fd31-771d-499b-a653-61a08a4fb7b8";
  const eventId = "vote-msh-2026-5-sho-5";
  it("records Okada's affirmative vote at original column 11", () => {
    expect(
      data.votes.find((v) => v.eventId === eventId && v.memberId === okada)
    ).toMatchObject({
      choice: "yes",
      participation: "voted",
      observedMark: "○",
      locator: { column: 11 },
    });
  });
  it("records Horie's non-participation as presiding chair at column 12", () => {
    expect(
      data.votes.find((v) => v.eventId === eventId && v.memberId === horie)
    ).toMatchObject({
      choice: null,
      participation: "chair_not_voting",
      observedMark: "斜線",
      locator: { column: 12 },
    });
  });
  it("rejects a personal vote swap even though aggregate counts remain identical", () => {
    const d = structuredClone(data),
      a = d.votes.find((v) => v.eventId === eventId && v.memberId === okada),
      b = d.votes.find((v) => v.eventId === eventId && v.memberId === horie);
    if (!a || !b) throw Error("missing cells");
    const before = getVoteSummary(d.votes.filter((v) => v.eventId === eventId));
    Object.assign(a, {
      choice: null,
      participation: "chair_not_voting",
      observedMark: "斜線",
    });
    Object.assign(b, {
      choice: "yes",
      participation: "voted",
      observedMark: "○",
    });
    expect(
      getVoteSummary(d.votes.filter((v) => v.eventId === eventId))
    ).toEqual(before);
    expect(() => parseVoteData(d, activity, archive)).toThrow(
      /原表の個人セル|採決時点/
    );
  });
  it("rejects a later same-day chair substituted into the decision context", () => {
    const d = structuredClone(data),
      e = d.events.find((e) => e.id === eventId);
    if (!e?.minutesContext) throw Error("no context");
    e.minutesContext.decisionMinuteId = 101;
    e.minutesContext.resultMinuteId = 103;
    expect(() => parseVoteData(d, activity, archive)).toThrow("採決時点");
  });
  it("does not fill missing graphic evidence from the day-level roster", () => {
    const d = structuredClone(data),
      c = d.cellEvidence.find(
        (c) => c.eventId === eventId && c.memberId === horie
      );
    if (!c) throw Error("no evidence");
    c.imageMark = null;
    expect(c.textMark).toBeNull();
    expect(() => parseVoteData(d, activity, archive)).toThrow("原表の個人セル");
  });
  it("requires the correct member-column pair for every source cell", () => {
    const d = structuredClone(data);
    d.cellEvidence[0].column = 2;
    expect(() => parseVoteData(d, activity, archive)).toThrow("原表照合位置");
  });
  it("preserves the withdrawn record and distinguishes reported AI review from human approval", () => {
    expect(
      data.verification.correctionHistory[0].withdrawnVerification
        .methodComparison
    ).toMatchObject({ textAndImageMatched: 198, mismatches: 0 });
    expect(data.verification.correctionHistory[0].changes).toHaveLength(2);
    expect(data.verification.independentAiComparison).toMatchObject({
      status: "completed_reported",
      matched: 196,
      mismatches: 2,
      postCorrectionStatus: "completed_reported",
    });
    expect(data.verification.independentReview).toBe("pending");
    expect(data.verification.operatorReview).toBe("pending");
  });
  it("checks all 198 source cells with missing text explicitly separated", () => {
    expect(data.cellEvidence).toHaveLength(198);
    expect(data.cellEvidence.filter((c) => c.textMark === null)).toHaveLength(
      9
    );
    expect(data.verification.methodComparison).toMatchObject({
      textAndImageMatched: 189,
      imageOnlyMatched: 9,
      mismatches: 0,
    });
  });
});

it("can record a reported post-correction AI comparison without approving human review", () => {
  const d = structuredClone(data);
  d.verification.independentAiComparison.postCorrectionStatus =
    "completed_reported";
  d.verification.independentAiComparison.postCorrection = {
    cells: 198,
    matched: 198,
    mismatches: 0,
    basis: "synthetic test only",
  };
  expect(() => parseVoteData(d, activity, archive)).not.toThrow();
  expect(getIndependentAiReviewLabel(d.verification)).toContain(
    "訂正後の別AI再比較報告：198一致"
  );
  expect(d.verification.operatorReview).toBe("pending");
  expect(d.verification.independentReview).toBe("pending");
});
it("rejects a completed AI comparison report without its counts", () => {
  const d = structuredClone(data);
  d.verification.independentAiComparison.postCorrectionStatus =
    "completed_reported";
  delete d.verification.independentAiComparison.postCorrection;
  expect(() => parseVoteData(d, activity, archive)).toThrow("訂正後の別AI");
});

it("records the operator-reported independent recheck without human approval", () => {
  expect(
    data.verification.independentAiComparison.postCorrection
  ).toMatchObject({ cells: 198, matched: 198, mismatches: 0 });
  expect(data.verification.independentReview).toBe("pending");
  expect(data.verification.operatorReview).toBe("pending");
  expect(getIndependentAiReviewLabel(data.verification)).toContain(
    "訂正後の別AI再比較報告：198一致・0不一致"
  );
});

it("does not approve unresolved post-correction AI discrepancies", () => {
  const d = structuredClone(data);
  d.verification.independentAiComparison.postCorrection = {
    cells: 198,
    matched: 197,
    mismatches: 1,
    basis: "synthetic negative test",
  };
  d.verification.independentReview = "approved";
  expect(() => parseVoteData(d, activity, archive)).toThrow(
    "別AIの未解決不一致"
  );
});

it("rejects populated vote records mislabeled as not collected even with member approvals", () => {
  const a = structuredClone(activity);
  a.coverage.activities.votes = "not_collected";
  a.coverage.operatorReview = "approved";
  for (const source of a.sources) source.review.operatorReview = "approved";
  expect(() => parseVoteData(fixture(), a, archive)).toThrow(
    "採決取得範囲と実データが不一致"
  );
});
it("overlays published results before homepage result filtering without editing the original archive", () => {
  const d = structuredClone(data),
    c = d.resultChecks[0];
  c.status = "published";
  c.result = "可決";
  c.date = "2026-11-30";
  const b = getVoteBills(d, archive),
    target = b.find((b) => b.id === c.billId);
  if (!target) throw Error("missing");
  const sessions = applyVoteResultsToSessions(archive.sessions, b);
  const filters = {
    query: "",
    session: target.sessionSourceUrl,
    result: "可決",
    ignoredFilters: false,
  };
  expect(
    filterBillSessions(sessions, filters).some((s) =>
      s.bills.some((x) => x.number === target.number)
    )
  ).toBe(true);
  expect(
    filterBillSessions(sessions, { ...filters, result: "unpublished" }).some(
      (s) => s.bills.some((x) => x.number === target.number)
    )
  ).toBe(false);
  expect(
    sessions
      .find((s) => s.sourceUrl === target.sessionSourceUrl)
      ?.bills.find((x) => x.number === target.number)
  ).toMatchObject({ result: "可決", decisionDate: "2026-11-30" });
  expect(
    archive.sessions
      .find((s) => s.sourceUrl === target.sessionSourceUrl)
      ?.bills.find((x) => x.number === target.number)?.result
  ).toBe("");
});
it("does not replace original results with an unpublished check", () => {
  expect(applyVoteResultsToSessions(archive.sessions, bills)).toEqual(
    archive.sessions
  );
});
