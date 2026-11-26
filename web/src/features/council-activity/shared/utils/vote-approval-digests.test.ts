import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import archive from "@/features/official-records/server/data/2026/bills.json";
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
import type { ActivityData } from "../types/council-activity";
import {
  getActivityApprovalDigests,
  getReviewEvidenceDigest,
  getReviewedEventDigests,
  getSourceApprovalDigest,
  hashReviewedFacts,
} from "./vote-approval-digests";
import type { VoteData } from "./vote-data";

const fixture = () =>
  structuredClone({
    events,
    resultChecks,
    references,
    affiliations,
    votes,
    cellEvidence,
  }) as Pick<
    VoteData,
    | "events"
    | "references"
    | "affiliations"
    | "votes"
    | "cellEvidence"
    | "resultChecks"
  >;
const activity = () =>
  structuredClone({ members, sources }) as Pick<
    ActivityData,
    "members" | "sources"
  >;
describe("reviewed vote digests", () => {
  it("uses SHA-256 over canonical JSON independent of object key order", () => {
    expect(hashReviewedFacts({ b: 2, a: 1 })).toBe(
      createHash("sha256").update('{"a":1,"b":2}').digest("hex")
    );
    expect(hashReviewedFacts({ a: 1, b: 2 })).toBe(
      hashReviewedFacts({ b: 2, a: 1 })
    );
  });
  it("recomputes all nine approved event hashes and the original evidence report", () => {
    expect(getReviewedEventDigests(fixture(), activity(), archive)).toEqual(
      verification.qualityApproval.reviewedEvents
    );
    expect(
      getReviewEvidenceDigest(verification as VoteData["verification"])
    ).toBe(verification.qualityApproval.evidenceSha256);
  });
  it("changes only the affected event scope for a same-count vote change", () => {
    const d = fixture(),
      before = getReviewedEventDigests(d, activity(), archive);
    d.votes[0].choice = "no";
    const after = getReviewedEventDigests(d, activity(), archive);
    expect(d.votes).toHaveLength(198);
    expect(
      after
        .filter((scope, i) => scope.sha256 !== before[i].sha256)
        .map((s) => s.eventId)
    ).toEqual([d.votes[0].eventId]);
  });
  it("detects evidence changes without changing the cell count", () => {
    const d = fixture(),
      before = getReviewedEventDigests(d, activity(), archive);
    d.cellEvidence[0].imageMark = "×";
    expect(getReviewedEventDigests(d, activity(), archive)).not.toEqual(before);
  });
  it("binds event-time factions and official source bytes", () => {
    const d = fixture(),
      a = activity(),
      before = getReviewedEventDigests(d, a, archive);
    d.affiliations[0].groups[0].name = "synthetic changed faction";
    expect(getReviewedEventDigests(d, a, archive)).not.toEqual(before);
    const source = a.sources.find((s) => s.id === "may-votes");
    if (!source) throw Error("missing source");
    source.sha256 = "0".repeat(64);
    expect(getReviewedEventDigests(fixture(), a, archive)).not.toEqual(before);
  });
  it("preserves scopes for unrelated source notes and approval metadata", () => {
    const a = activity(),
      before = getReviewedEventDigests(fixture(), a, archive);
    const source = a.sources.find((s) => s.id === "nov-bills");
    if (!source) throw Error("missing source");
    source.usage += " synthetic additional source note";
    a.sources[0].review.operatorReview = "pending";
    expect(getReviewedEventDigests(fixture(), a, archive)).toEqual(before);
  });
  it("detects changes to the independent comparison record", () => {
    const v = structuredClone(verification);
    v.independentAiComparison.postCorrection.basis += " changed report";
    expect(getReviewEvidenceDigest(v as VoteData["verification"])).not.toBe(
      verification.qualityApproval.evidenceSha256
    );
  });
});

it("binds each source approval independently of other source revisions", () => {
  const a = activity();
  for (const source of a.sources)
    expect(getSourceApprovalDigest(source)).toBe(
      source.review.operatorApproval?.reviewedSha256
    );
  const before = a.sources.map(getSourceApprovalDigest);
  a.sources[0].sha256 = "0".repeat(64);
  const changed = a.sources
    .map(getSourceApprovalDigest)
    .filter((h, i) => h !== before[i]);
  expect(changed).toHaveLength(1);
});

it("binds a reviewed bill's result-check source revision as well as its result", () => {
  const d = fixture(),
    a = activity();
  d.resultChecks.push({
    billId: d.events[0].billId,
    sourceId: "nov-bills",
    checkedAt: "2026-11-27T00:00:00.000Z",
    result: "可決",
    date: d.events[0].date,
    status: "published",
  });
  const before = getReviewedEventDigests(d, a, archive);
  const source = a.sources.find((s) => s.id === "nov-bills");
  if (!source) throw Error("missing source");
  source.sha256 = "0".repeat(64);
  expect(getReviewedEventDigests(d, a, archive)).not.toEqual(before);
});

it("binds member and dated snapshot facts in separate scopes", () => {
  const input = {
    members: structuredClone(members),
    snapshots: structuredClone(snapshots),
    coverage,
  };
  const before = getActivityApprovalDigests(input as unknown as ActivityData);
  expect(before).toEqual(coverage.operatorApproval.reviewedData);
  input.snapshots.rosters[0].entries[0].termsServed += 1;
  const changed = getActivityApprovalDigests(
    input as unknown as ActivityData
  ).filter((s, i) => s.sha256 !== before[i].sha256);
  expect(changed.map((s) => s.scopeId)).toEqual([
    `roster:${input.snapshots.rosters[0].id}`,
  ]);
});
it("invalidates event approval if the displayed bill title changes", () => {
  const changed = structuredClone(archive);
  const ref = references.find((r) => r.id === events[0].billId);
  const bill = changed.sessions
    .find((s) => s.sourceUrl === ref?.sessionSourceUrl)
    ?.bills.find((b) => b.number === ref?.number);
  if (!bill) throw Error("missing bill");
  bill.title = "synthetic changed title";
  expect(getReviewedEventDigests(fixture(), activity(), changed)).not.toEqual(
    verification.qualityApproval.reviewedEvents
  );
});

it("binds every separately cited bill coverage source revision", () => {
  const d = fixture(),
    a = activity();
  const ref = d.references.find((r) => r.id === d.events[0].billId);
  if (!ref) throw Error("missing reference");
  ref.coverageSourceId = "nov-bills";
  const before = getReviewedEventDigests(d, a, archive),
    source = a.sources.find((s) => s.id === "nov-bills");
  if (!source) throw Error("missing source");
  source.sha256 = "0".repeat(64);
  expect(getReviewedEventDigests(d, a, archive)).not.toEqual(before);
});
