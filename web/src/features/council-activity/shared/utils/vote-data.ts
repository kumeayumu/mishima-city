import { z } from "zod";
import type { ActivityData } from "../types/council-activity";
import {
  getReviewEvidenceDigest,
  getReviewedEventDigests,
} from "./vote-approval-digests";
import {
  getPresiderAtSequence,
  normalizeSourceMark,
  resolveEvidenceMark,
} from "./vote-evidence";

const id = z.string().min(1),
  date = z.iso.date();
const eventDigests = z.array(
  z.object({ eventId: id, sha256: z.string().regex(/^[a-f0-9]{64}$/) }).strict()
);
export const voteStates = [
  "voted",
  "absent",
  "left",
  "abstained",
  "recused",
  "chair_not_voting",
  "unknown",
] as const;
const schema = z
  .object({
    references: z.array(
      z
        .object({
          id,
          session: z.number().int(),
          number: id,
          sessionSourceUrl: z.url(),
          availability: z.enum(["recorded", "unreported", "result_unreported"]),
          coverageSourceId: id,
        })
        .strict()
    ),
    events: z.array(
      z
        .object({
          id,
          billId: id,
          date,
          result: id,
          sourceId: id,
          affiliationSnapshotId: id,
          memberIds: z.array(id),
          verificationId: id,
          minutesContext: z
            .object({
              sourceId: id,
              decisionMinuteId: z.number().int().positive(),
              resultMinuteId: z.number().int().positive(),
              presiders: z.array(
                z
                  .object({
                    fromMinuteId: z.number().int().positive(),
                    memberId: id,
                  })
                  .strict()
              ),
            })
            .strict()
            .optional(),
        })
        .strict()
    ),
    cellEvidence: z.array(
      z
        .object({
          eventId: id,
          memberId: id,
          sourceId: id,
          row: z.number().int().positive(),
          column: z.number().int().positive(),
          textMark: id.nullable(),
          imageMark: id.nullable(),
        })
        .strict()
    ),
    votes: z.array(
      z
        .object({
          eventId: id,
          memberId: id,
          choice: z.enum(["yes", "no"]).nullable(),
          participation: z.enum(voteStates),
          observedMark: id,
          sourceId: id,
          locator: z
            .object({
              pdfPage: z.number().int().positive(),
              printedPage: id,
              row: z.number().int().positive(),
              column: z.number().int().positive(),
            })
            .strict(),
          verificationId: id,
        })
        .strict()
    ),
    affiliations: z.array(
      z
        .object({
          id,
          sourceId: id,
          basis: id,
          validFrom: date.nullable(),
          validTo: date.nullable(),
          groups: z.array(
            z.object({ name: id, memberIds: z.array(id) }).strict()
          ),
        })
        .strict()
    ),
    verification: z
      .object({
        id,
        cells: z.number().int(),
        methodComparison: z
          .object({
            textAndImageMatched: z.number().int(),
            mismatches: z.number().int(),
            imageOnlyMatched: z.number().int().nonnegative(),
            methods: z.array(id),
          })
          .strict(),
        independentAiComparison: z
          .object({
            status: z.literal("completed_reported"),
            cells: z.number().int(),
            matched: z.number().int(),
            mismatches: z.number().int(),
            basis: id,
            postCorrectionStatus: z.enum(["pending", "completed_reported"]),
            postCorrection: z
              .object({
                cells: z.number().int().nonnegative(),
                matched: z.number().int().nonnegative(),
                mismatches: z.number().int().nonnegative(),
                basis: id,
              })
              .strict()
              .optional(),
          })
          .strict(),
        correctionHistory: z.array(
          z
            .object({
              date,
              reason: id,
              withdrawnVerification: z.record(z.string(), z.unknown()),
              changes: z.array(
                z
                  .object({
                    eventId: id,
                    memberId: id,
                    before: z.record(z.string(), z.unknown()),
                    after: z.record(z.string(), z.unknown()),
                    sourceIds: z.array(id),
                  })
                  .strict()
              ),
            })
            .strict()
        ),
        qualityApproval: z
          .object({
            policy: z.literal("three-stage-v1"),
            digestVersion: z.literal("event-facts-v1"),
            reviewedEvents: eventDigests.optional(),
            evidenceSha256: z
              .string()
              .regex(/^[a-f0-9]{64}$/)
              .optional(),
            approver: id.optional(),
            date: date.optional(),
            independentAcceptance: z
              .object({
                approver: id,
                date,
                reviewedEvents: eventDigests,
                evidenceSha256: z.string().regex(/^[a-f0-9]{64}$/),
                method: z.literal(
                  "別AIによる公式資料のみからの独立抽出・全件照合"
                ),
              })
              .strict()
              .optional(),
            baselineCommit: z.string().regex(/^[a-f0-9]{40}$/),
            independentReviewMeaning: z.literal("別AI独立再照合結果の受入承認"),
            humanMethod: z.literal("公式原表と実装データの目視比較").optional(),
            blindHumanExtraction: z.literal(false).optional(),
            cells: z.literal(198),
            matched: z.literal(198).optional(),
            mismatches: z.literal(0).optional(),
            held: z.literal(0).optional(),
          })
          .strict()
          .optional(),
        independentReview: z.enum(["pending", "approved"]),
        operatorReview: z.enum(["pending", "approved"]),
        note: id,
        checkedAt: z.iso.datetime(),
      })
      .strict(),
    resultChecks: z.array(
      z
        .object({
          billId: id,
          sourceId: id,
          checkedAt: z.iso.datetime(),
          result: z.string().nullable(),
          date: date.nullable(),
          status: z.enum(["unreported", "published"]),
        })
        .strict()
    ),
  })
  .strict();
export type VoteData = z.infer<typeof schema>;
export type Vote = VoteData["votes"][number];
export interface OriginalBill {
  number: string;
  title: string;
  result: string;
  decisionDate: string | null;
  documentUrls: string[];
  sourceUrl: string;
}
export interface BillArchive {
  sessions: { title: string; sourceUrl: string; bills: OriginalBill[] }[];
}

export function parseVoteData(
  input: unknown,
  activity: ActivityData,
  archive: BillArchive
): VoteData {
  const data = schema.parse(input),
    errors: string[] = [];
  if (
    activity.coverage.activities.votes !==
    (data.votes.length ? "partial" : "not_collected")
  )
    errors.push("採決取得範囲と実データが不一致");
  const members = new Set(activity.members.map((m) => m.id)),
    sources = new Set(activity.sources.map((s) => s.id));
  const unique = (values: string[], label: string) => {
    if (new Set(values).size !== values.length) errors.push(`${label}が重複`);
  };
  unique(
    data.references.map((r) => r.id),
    "議案ID"
  );
  unique(
    data.events.map((e) => e.id),
    "採決ID"
  );
  unique(
    data.events.map((e) => e.billId),
    "議案と採決の対応"
  );
  unique(
    data.affiliations.map((a) => a.id),
    "当時会派ID"
  );
  unique(
    data.resultChecks.map((c) => c.billId),
    "最新確認"
  );
  unique(
    data.votes.map((v) => `${v.eventId}:${v.memberId}`),
    "採決セル"
  );
  const original = archive.sessions.flatMap((s) =>
    s.bills.map((b) => ({ number: b.number, sessionSourceUrl: s.sourceUrl }))
  );
  const keys = data.references.map((r) => `${r.sessionSourceUrl}:${r.number}`);
  unique(keys, "原本議案対応");
  if (
    original.length !== data.references.length ||
    original.some((b) => !keys.includes(`${b.sessionSourceUrl}:${b.number}`))
  )
    errors.push("原本議案の欠落・余分な対応");
  for (const r of data.references) {
    if (!sources.has(r.coverageSourceId)) errors.push("議案範囲の出典不明");
    const event = data.events.find((e) => e.billId === r.id);
    if ((r.availability === "recorded") !== Boolean(event))
      errors.push("個人票の取得範囲と採決が不一致");
  }
  for (const a of data.affiliations) {
    const ids = a.groups.flatMap((g) => g.memberIds);
    unique(ids, "当時会派所属");
    if (ids.some((i) => !members.has(i)) || !sources.has(a.sourceId))
      errors.push("当時会派の参照不明");
  }
  for (const e of data.events) {
    const ref = data.references.find((r) => r.id === e.billId);
    const originalBill = archive.sessions
      .find((s) => s.sourceUrl === ref?.sessionSourceUrl)
      ?.bills.find((b) => b.number === ref?.number);
    if (
      originalBill &&
      (e.date !== originalBill.decisionDate || e.result !== originalBill.result)
    )
      errors.push("採決日・結果が原本と不一致");

    const reference = data.references.find((r) => r.id === e.billId);
    if (
      !reference ||
      !sources.has(e.sourceId) ||
      e.verificationId !== data.verification.id
    )
      errors.push("採決の参照不明");
    unique(e.memberIds, "当時議員");
    if (e.memberIds.some((i) => !members.has(i))) errors.push("当時議員ID不明");
    const cells = data.votes.filter((v) => v.eventId === e.id);
    if (
      cells.length !== e.memberIds.length ||
      e.memberIds.some((i) => !cells.some((v) => v.memberId === i))
    )
      errors.push("採決セルの欠損");
    if (e.minutesContext) {
      const ctx = e.minutesContext;
      const presider = getPresiderAtSequence(
        ctx.presiders,
        ctx.decisionMinuteId
      );
      if (
        !sources.has(ctx.sourceId) ||
        ctx.presiders.some((r) => !e.memberIds.includes(r.memberId)) ||
        ctx.resultMinuteId < ctx.decisionMinuteId ||
        !presider ||
        getPresiderAtSequence(ctx.presiders, ctx.resultMinuteId) !== presider ||
        cells.filter((v) => v.participation === "chair_not_voting").length !==
          1 ||
        cells.find((v) => v.participation === "chair_not_voting")?.memberId !==
          presider
      ) {
        errors.push("採決時点の議事進行と議長セルが不一致");
      }
    }
    const a = data.affiliations.find((a) => a.id === e.affiliationSnapshotId);
    if (
      !a ||
      a.sourceId !== e.sourceId ||
      e.memberIds.some((i) => !a.groups.some((g) => g.memberIds.includes(i)))
    )
      errors.push("採決当時の会派が不整合");
  }
  for (const v of data.votes) {
    const expected =
      v.observedMark === "○" || v.observedMark === "〇"
        ? "yes"
        : v.observedMark === "×"
          ? "no"
          : null;
    if (expected !== v.choice) errors.push("原記号と賛否の不一致");
    const states: Record<string, string> = {
      "○": "voted",
      〇: "voted",
      "×": "voted",
      斜線: "chair_not_voting",
      退: "left",
      欠: "absent",
      棄: "abstained",
      除: "recused",
      "?": "unknown",
    };
    if (
      (!states[v.observedMark] && v.participation !== "unknown") ||
      (states[v.observedMark] && states[v.observedMark] !== v.participation)
    )
      errors.push("原記号と参加状態の不一致");

    const e = data.events.find((e) => e.id === v.eventId);
    if (
      !e ||
      !e.memberIds.includes(v.memberId) ||
      v.sourceId !== e.sourceId ||
      v.verificationId !== data.verification.id
    )
      errors.push("票の人物・出典参照不明");
    if (e && e.memberIds[v.locator.column - 1] !== v.memberId)
      errors.push("原表の列と人物が不一致");
    if ((v.participation === "voted") !== (v.choice !== null))
      errors.push("賛否と参加状態が矛盾");
  }
  unique(
    data.cellEvidence.map((c) => `${c.eventId}:${c.memberId}`),
    "原表照合セル"
  );
  let textImage = 0,
    imageOnly = 0;
  if (data.cellEvidence.length !== data.votes.length)
    errors.push("原表照合の欠損");
  for (const v of data.votes) {
    const c = data.cellEvidence.find(
      (c) => c.eventId === v.eventId && c.memberId === v.memberId
    );
    if (
      !c ||
      c.sourceId !== v.sourceId ||
      c.row !== v.locator.row ||
      c.column !== v.locator.column
    ) {
      errors.push("人物と原表照合位置が不一致");
      continue;
    }
    const result = resolveEvidenceMark(c.textMark, c.imageMark);
    if (
      !c.imageMark ||
      result.status !== "confirmed" ||
      result.mark !== normalizeSourceMark(v.observedMark)
    )
      errors.push("原表の個人セルと採決データが不一致");
    if (result.basis === "text_and_image") textImage++;
    if (result.basis === "image_only") imageOnly++;
  }
  if (
    textImage !== data.verification.methodComparison.textAndImageMatched ||
    imageOnly !== data.verification.methodComparison.imageOnlyMatched
  )
    errors.push("照合方式別の件数が不整合");
  const ai = data.verification.independentAiComparison;
  const approval = data.verification.qualityApproval;
  const latestCorrection = data.verification.correctionHistory
    .map((c) => c.date)
    .sort()
    .at(-1);
  if (
    data.verification.independentReview === "approved" &&
    approval?.independentAcceptance &&
    latestCorrection &&
    approval.independentAcceptance.date < latestCorrection
  )
    errors.push("承認順序の日付が不整合：別AI受入が対象の訂正日より前");
  if (
    data.verification.operatorReview === "approved" &&
    approval?.date &&
    approval.independentAcceptance &&
    approval.date < approval.independentAcceptance.date
  )
    errors.push("承認順序の日付が不整合：本人最終承認が別AI受入より前");
  if (
    data.verification.independentReview === "approved" &&
    !approval?.independentAcceptance
  )
    errors.push("別AI受入承認の記録が不足");
  if (
    data.verification.operatorReview === "approved" &&
    (!approval?.approver ||
      !approval.date ||
      !approval.humanMethod ||
      approval.blindHumanExtraction !== false ||
      approval.matched !== data.votes.length ||
      approval.mismatches !== 0 ||
      approval.held !== 0)
  )
    errors.push("本人目視最終承認の記録が不足");
  if (
    data.verification.operatorReview === "approved" &&
    data.verification.independentReview !== "approved"
  )
    errors.push("三段階の承認順序が不整合：別AI受入前の本人最終承認");
  if (
    data.verification.independentReview === "approved" ||
    data.verification.operatorReview === "approved"
  ) {
    const currentEvents = getReviewedEventDigests(data, activity, archive);
    const currentEvidence = getReviewEvidenceDigest(data.verification);
    for (const stage of [
      {
        name: "別AI",
        approved: data.verification.independentReview === "approved",
        scope: approval?.independentAcceptance,
      },
      {
        name: "本人",
        approved: data.verification.operatorReview === "approved",
        scope: approval,
      },
    ]) {
      if (
        stage.approved &&
        (!stage.scope ||
          JSON.stringify(stage.scope.reviewedEvents) !==
            JSON.stringify(currentEvents) ||
          stage.scope.evidenceSha256 !== currentEvidence)
      )
        errors.push(`${stage.name}承認対象データ・照合証拠のハッシュが不一致`);
    }
  }
  if (
    (data.verification.independentReview === "approved" ||
      data.verification.operatorReview === "approved") &&
    (!data.verification.qualityApproval ||
      ai.postCorrectionStatus !== "completed_reported" ||
      ai.postCorrection?.matched !== data.votes.length ||
      ai.postCorrection?.mismatches !== 0)
  )
    errors.push("三段階承認の根拠・独立確認が不足");
  if (
    ai.postCorrectionStatus === "completed_reported" &&
    (!ai.postCorrection ||
      ai.postCorrection.cells !== data.votes.length ||
      ai.postCorrection.matched + ai.postCorrection.mismatches !==
        ai.postCorrection.cells)
  )
    errors.push("訂正後の別AI照合報告が不整合");
  if (
    ai.postCorrection?.mismatches &&
    data.verification.independentReview === "approved"
  )
    errors.push("別AIの未解決不一致を残した承認");
  if (ai.matched + ai.mismatches !== ai.cells || ai.cells !== data.votes.length)
    errors.push("別AI照合の報告件数が不整合");
  if (
    data.verification.cells !== data.votes.length ||
    data.verification.methodComparison.textAndImageMatched +
      data.verification.methodComparison.imageOnlyMatched +
      data.verification.methodComparison.mismatches !==
      data.votes.length
  )
    errors.push("照合件数が不整合");
  if (
    data.verification.methodComparison.mismatches > 0 &&
    data.verification.independentReview === "approved"
  )
    errors.push("不一致を残した承認");
  if (
    activity.coverage.voteIndependentReview !==
    (data.verification.independentReview === "approved" &&
    data.verification.operatorReview === "approved"
      ? "approved"
      : "pending")
  )
    errors.push("独立確認状態が不整合");
  for (const c of data.resultChecks) {
    if (
      !data.references.some((r) => r.id === c.billId) ||
      !sources.has(c.sourceId)
    )
      errors.push("最新確認の参照不明");
    if ((c.status === "published") !== Boolean(c.result))
      errors.push("最新確認の結果が不整合");
  }
  for (const r of data.references.filter(
    (r) => r.availability === "result_unreported"
  ))
    if (!data.resultChecks.some((c) => c.billId === r.id))
      errors.push("未掲載議案の最新確認が欠落");
  if (errors.length) throw new Error(errors.join("、"));
  return data;
}

export function getVoteBills(data: VoteData, archive: BillArchive) {
  return data.references.map((r) => {
    const session = archive.sessions.find(
      (s) => s.sourceUrl === r.sessionSourceUrl
    );
    const bill = session?.bills.find((b) => b.number === r.number);
    if (!bill || !session) throw new Error("議案が見つかりません");
    const latest = data.resultChecks.find((c) => c.billId === r.id);
    return {
      ...r,
      bill,
      sessionTitle: session.title,
      result:
        latest?.status === "published" ? (latest.result ?? "") : bill.result,
      decisionDate:
        latest?.status === "published" ? latest.date : bill.decisionDate,
      availability:
        latest?.status === "published" && r.availability === "result_unreported"
          ? ("unreported" as const)
          : r.availability,
      latest,
    };
  });
}
export type VoteBill = ReturnType<typeof getVoteBills>[number];
export function getVoteEvent(data: VoteData, billId: string) {
  return data.events.find((e) => e.billId === billId);
}
export function getEventFaction(
  data: VoteData,
  eventId: string,
  memberId: string
) {
  const e = data.events.find((e) => e.id === eventId);
  return (
    data.affiliations
      .find((a) => a.id === e?.affiliationSnapshotId)
      ?.groups.find((g) => g.memberIds.includes(memberId))?.name ?? "未確認"
  );
}
export function getVoteSummary(votes: Vote[]) {
  const yes = votes.filter((v) => v.choice === "yes").length,
    no = votes.filter((v) => v.choice === "no").length;
  const counts = Object.fromEntries(
    voteStates
      .filter((s) => s !== "voted")
      .map((s) => [s, votes.filter((v) => v.participation === s).length])
  );
  return {
    yes,
    no,
    other: votes.length - yes - no,
    total: votes.length,
    explicit: yes + no,
    yesPercent: yes + no ? (yes / (yes + no)) * 100 : null,
    counts,
    divided: yes > 0 && no > 0,
  };
}
export const voteLabels: Record<
  Vote["participation"],
  { symbol: string; label: string }
> = {
  voted: { symbol: "", label: "表決" },
  absent: { symbol: "欠", label: "欠席" },
  left: { symbol: "退", label: "退席" },
  abstained: { symbol: "棄", label: "棄権" },
  recused: { symbol: "除", label: "除斥" },
  chair_not_voting: { symbol: "議", label: "議長による採決不参加" },
  unknown: { symbol: "?", label: "不明" },
};
export function describeVote(
  vote: Vote | undefined,
  availability: VoteBill["availability"],
  eligible = true
) {
  if (!eligible)
    return { symbol: "外", label: "当時の対象外", kind: "neutral" };
  if (!vote)
    return availability === "result_unreported"
      ? {
          symbol: "結",
          label: "議決結果は保存済み議案一覧に未掲載",
          kind: "neutral",
        }
      : { symbol: "未", label: "個人別賛否は資料未掲載", kind: "neutral" };
  if (vote.choice)
    return {
      symbol: vote.choice === "yes" ? "○" : "×",
      label: vote.choice === "yes" ? "賛成" : "反対",
      kind: vote.choice,
    };
  return { ...voteLabels[vote.participation], kind: "neutral" };
}
export function selectVoteBills(
  bills: VoteBill[],
  data: VoteData,
  params: Record<string, string | string[] | undefined>
) {
  const first = (k: string) =>
    Array.isArray(params[k]) ? (params[k][0] ?? "") : (params[k] ?? "");
  const coverage = first("coverage") === "all" ? "all" : "recorded",
    view = first("view") === "matrix" ? "matrix" : "list",
    session = ["5", "6", "9", "11"].includes(first("session"))
      ? first("session")
      : "",
    divided = first("divided") === "1";
  const factions = [
    ...new Set(data.affiliations.flatMap((a) => a.groups.map((g) => g.name))),
  ];
  const faction = factions.includes(first("faction")) ? first("faction") : "";
  return {
    coverage,
    view,
    session,
    divided,
    faction,
    bills: bills.filter(
      (b) =>
        (coverage === "all" || b.availability === "recorded") &&
        (!session || b.session === Number(session)) &&
        (!divided ||
          getVoteSummary(
            data.votes.filter((v) => v.eventId === getVoteEvent(data, b.id)?.id)
          ).divided)
    ),
  };
}

export function getVoteReviewLabel(v: VoteData["verification"]) {
  if (v.independentReview === "approved" && v.operatorReview === "approved")
    return "別AI独立照合受入・本人目視最終承認済み";
  if (v.independentReview === "approved")
    return "別AI独立照合受入済み・本人目視最終承認待ち";
  return "機械・画像照合値・別AI照合受入／本人目視最終承認待ち";
}
export function getVoteCoverage(data: VoteData) {
  const recorded = data.references.filter(
    (r) => r.availability === "recorded"
  ).length;
  const resultUnreported = data.references.filter(
    (r) =>
      r.availability === "result_unreported" &&
      data.resultChecks.find((c) => c.billId === r.id)?.status !== "published"
  ).length;
  const days = [
    ...new Set(data.resultChecks.map((c) => c.checkedAt.slice(0, 10))),
  ].sort();
  return {
    total: data.references.length,
    recorded,
    unreported: data.references.length - recorded - resultUnreported,
    resultUnreported,
    firstCheck: days[0] ?? null,
    lastCheck: days.at(-1) ?? null,
  };
}
export function getFactionScope(
  data: VoteData,
  eventId: string | undefined,
  memberId: string,
  faction: string
) {
  if (!faction) return "match";
  if (!eventId) return "unknown";
  const name = getEventFaction(data, eventId, memberId);
  return name === "未確認" ? "unknown" : name === faction ? "match" : "outside";
}

export function getIndependentAiReviewLabel(v: VoteData["verification"]) {
  const a = v.independentAiComparison;
  const before = `別AI照合は実施済み（運営者報告：訂正前${a.matched}一致・${a.mismatches}不一致）。`;
  if (a.postCorrectionStatus === "completed_reported" && a.postCorrection)
    return (
      before +
      `訂正後の別AI再比較報告：${a.postCorrection.matched}一致・${a.postCorrection.mismatches}不一致。`
    );
  return `${before}訂正後の別AI再比較は未完了です。`;
}

export function applyVoteResultsToSessions<
  T extends { sourceUrl: string; bills: OriginalBill[] },
>(sessions: readonly T[], bills: VoteBill[]): T[] {
  return sessions.map((session) => ({
    ...session,
    bills: session.bills.map((bill) => {
      const current = bills.find(
        (b) =>
          b.sessionSourceUrl === session.sourceUrl && b.number === bill.number
      );
      return current?.latest?.status === "published"
        ? {
            ...bill,
            result: current.result,
            decisionDate: current.decisionDate,
          }
        : bill;
    }),
  }));
}
