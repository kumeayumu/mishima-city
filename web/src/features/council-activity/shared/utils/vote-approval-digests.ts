import { createHash } from "node:crypto";
import type { ActivityData } from "../types/council-activity";
import type { BillArchive, VoteData } from "./vote-data";

/** Deterministic JSON facts: object key formatting does not invalidate a review. */
function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, v]) => v !== undefined)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([k, v]) => [k, canonicalize(v)])
    );
  }
  return value;
}

/** Server-executed pure SHA-256 over structured facts, not file whitespace. */
export function hashReviewedFacts(value: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(canonicalize(value)))
    .digest("hex");
}

/** One scope per voting event; unrelated bills and approval metadata are excluded. */
export function getReviewedEventDigests(
  data: Pick<
    VoteData,
    | "events"
    | "references"
    | "affiliations"
    | "votes"
    | "cellEvidence"
    | "resultChecks"
  >,
  activity: Pick<ActivityData, "members" | "sources">,
  archive: BillArchive
) {
  return data.events
    .map((event) => {
      const reference = data.references.find((r) => r.id === event.billId);
      const affiliation = data.affiliations.find(
        (a) => a.id === event.affiliationSnapshotId
      );
      const sourceIds = new Set([
        event.sourceId,
        ...(reference ? [reference.coverageSourceId] : []),
        ...(affiliation ? [affiliation.sourceId] : []),
        ...data.votes
          .filter((v) => v.eventId === event.id)
          .map((v) => v.sourceId),
        ...data.cellEvidence
          .filter((v) => v.eventId === event.id)
          .map((v) => v.sourceId),
        ...data.resultChecks
          .filter((c) => c.billId === event.billId)
          .map((c) => c.sourceId),
        ...(event.minutesContext ? [event.minutesContext.sourceId] : []),
      ]);
      const memberIds = new Set(event.memberIds);
      const byMember = <T extends { memberId: string }>(items: T[]) =>
        [...items].sort((a, b) =>
          a.memberId < b.memberId ? -1 : a.memberId > b.memberId ? 1 : 0
        );
      const sourceFacts = activity.sources
        .filter((s) => sourceIds.has(s.id))
        .map((s) => ({
          id: s.id,
          url: s.url,
          sha256: s.sha256,
          asOf: s.asOf,
          locator: s.locator,
        }))
        .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
      const memberFacts = activity.members
        .filter((m) => memberIds.has(m.id))
        .map((m) => ({ id: m.id, name: m.name, nameVariants: m.nameVariants }))
        .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
      const session = archive.sessions.find(
        (s) => s.sourceUrl === reference?.sessionSourceUrl
      );
      return {
        eventId: event.id,
        sha256: hashReviewedFacts({
          event,
          archivedBill: session?.bills.find(
            (b) => b.number === reference?.number
          ),
          sessionTitle: session?.title,
          resultChecks: data.resultChecks.filter(
            (c) => c.billId === event.billId
          ),
          reference: data.references.find((r) => r.id === event.billId),
          affiliation: data.affiliations.find(
            (a) => a.id === event.affiliationSnapshotId
          ),
          members: memberFacts,
          sources: sourceFacts,
          votes: byMember(data.votes.filter((v) => v.eventId === event.id)),
          evidence: byMember(
            data.cellEvidence.filter((v) => v.eventId === event.id)
          ),
        }),
      };
    })
    .sort((a, b) =>
      a.eventId < b.eventId ? -1 : a.eventId > b.eventId ? 1 : 0
    );
}

export function getReviewEvidenceDigest(
  verification: Pick<
    VoteData["verification"],
    "methodComparison" | "independentAiComparison" | "correctionHistory"
  >
) {
  return hashReviewedFacts({
    methodComparison: verification.methodComparison,
    independentAiComparison: verification.independentAiComparison,
    correctionHistory: verification.correctionHistory,
  });
}

/** Each accepted source revision is independent of other sources and review flags. */
export function getSourceApprovalDigest(
  source: Pick<
    ActivityData["sources"][number],
    "id" | "title" | "url" | "sha256" | "asOf" | "locator" | "usage" | "notice"
  >
) {
  return hashReviewedFacts({
    id: source.id,
    title: source.title,
    url: source.url,
    sha256: source.sha256,
    asOf: source.asOf,
    locator: source.locator,
    usage: source.usage,
    notice: source.notice,
  });
}

/** Keep each member/snapshot review scope independently reusable if unchanged. */
export function getActivityApprovalDigests(
  data: Pick<ActivityData, "members" | "snapshots" | "coverage">
) {
  const scopes = [
    ...data.members.map((member) => ({
      scopeId: `member:${member.id}`,
      sha256: hashReviewedFacts(member),
    })),
    ...data.snapshots.rosters.map((snapshot) => ({
      scopeId: `roster:${snapshot.id}`,
      sha256: hashReviewedFacts(snapshot),
    })),
    ...data.snapshots.factions.map((snapshot) => ({
      scopeId: `faction:${snapshot.id}`,
      sha256: hashReviewedFacts(snapshot),
    })),
    ...data.snapshots.committees.map((snapshot) => ({
      scopeId: `committee:${snapshot.id}`,
      sha256: hashReviewedFacts(snapshot),
    })),
    ...data.snapshots.terms.map((term) => ({
      scopeId: `term:${term.id}`,
      sha256: hashReviewedFacts(term),
    })),
    {
      scopeId: "coverage-selection",
      sha256: hashReviewedFacts({
        scope: data.coverage.scope,
        expectedMembers: data.coverage.expectedMembers,
        rosterSnapshotId: data.coverage.rosterSnapshotId,
        factionSnapshotId: data.coverage.factionSnapshotId,
        committeeSnapshotIds: data.coverage.committeeSnapshotIds,
      }),
    },
  ];
  return scopes.sort((a, b) =>
    a.scopeId < b.scopeId ? -1 : a.scopeId > b.scopeId ? 1 : 0
  );
}
