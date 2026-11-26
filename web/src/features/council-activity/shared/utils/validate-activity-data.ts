import { z } from "zod";

const id = z.string().min(1);
const date = z.iso.date();
const review = z
  .object({
    status: z.literal("source_checked"),
    reviewer: z.string().min(1),
    checkedAt: z.iso.datetime(),
    operatorReview: z.enum(["pending", "approved"]),
  })
  .strict();
const period = { validFrom: date.nullable(), validTo: date.nullable() };
const source = z
  .object({
    id,
    title: z.string().min(1),
    url: z.url().refine((value) => {
      const url = new URL(value);
      return (
        url.protocol === "https:" &&
        (["www.city.mishima.shizuoka.jp", "www.pref.shizuoka.jp"].includes(
          url.hostname
        ) ||
          (url.hostname === "ssp.kaigiroku.net" &&
            url.pathname === "/tenant/mishima/SpMinuteView.html" &&
            url.searchParams.get("tenant_id") === "406" &&
            /^\d+$/.test(url.searchParams.get("council_id") ?? "") &&
            /^\d+$/.test(url.searchParams.get("schedule_id") ?? "")))
      );
    }, "公式のHTTPS出典URLが必要です"),
    asOf: date.nullable(),
    locator: z.string().min(1),
    retrievedAt: z.iso.datetime(),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    review,
    usage: z.string().min(1),
  })
  .strict();
const member = z
  .object({
    id: z.string().regex(/^msh-[a-f0-9-]{36}$/),
    name: z.string().min(1),
    kana: z.string().min(1),
    officialSourceId: id,
    nameVariants: z.array(z.string().min(1)),
    notes: z.array(
      z
        .object({ text: z.string().min(1), sourceIds: z.array(id).min(1) })
        .strict()
    ),
  })
  .strict();
const roster = z
  .object({
    id,
    asOf: date,
    sourceId: id,
    entries: z
      .array(
        z
          .object({
            memberId: id,
            seatNumber: z.number().int().positive(),
            termsServed: z.number().int().positive(),
            councilRole: z.string().nullable(),
            termId: id,
          })
          .strict()
      )
      .min(1),
  })
  .strict();
const faction = z
  .object({
    id,
    asOf: date,
    sourceId: id,
    ...period,
    groups: z
      .array(
        z
          .object({
            id,
            name: z.string().min(1),
            memberIds: z.array(id).min(1),
          })
          .strict()
      )
      .min(1),
  })
  .strict();
const committee = z
  .object({
    id,
    asOf: date,
    sourceId: id,
    ...period,
    committees: z
      .array(
        z
          .object({
            id,
            name: z.string().min(1),
            memberIds: z.array(id).min(1),
            chairId: id,
            viceChairId: id,
          })
          .strict()
      )
      .min(1),
  })
  .strict();
export const activityDataSchema = z
  .object({
    members: z.array(member).min(1),
    sources: z.array(source).min(1),
    snapshots: z
      .object({
        version: z.literal(1),
        rosters: z.array(roster).min(1),
        factions: z.array(faction).min(1),
        committees: z.array(committee).min(1),
        terms: z
          .array(
            z
              .object({
                id,
                startsOn: date.nullable(),
                scheduledEnd: date,
                sourceId: id,
                note: z.string().min(1),
              })
              .strict()
          )
          .min(1),
      })
      .strict(),
    coverage: z
      .object({
        schemaVersion: z.literal(1),
        scope: z.string().min(1),
        expectedMembers: z.number().int().positive(),
        rosterSnapshotId: id,
        factionSnapshotId: id,
        committeeSnapshotIds: z.array(id).min(1),
        reviewStatus: z.literal("source_checked"),
        operatorReview: z.enum(["pending", "approved"]),
        voteIndependentReview: z.enum(["pending", "approved"]).optional(),
        activities: z
          .object({
            votes: z.enum(["not_collected", "partial"]),
            questionsAndAnswers: z.literal("not_collected"),
          })
          .strict(),
      })
      .strict(),
  })
  .strict();

/** Validate public facts only. Unexpected fields (including address/raw text) fail closed. */
export function parseActivityData(input: unknown) {
  const data = activityDataSchema.parse(input);
  const errors: string[] = [];
  function unique(values: (string | number)[], label: string) {
    if (new Set(values).size !== values.length) errors.push(`${label}の重複`);
  }
  const memberIds = new Set(data.members.map((m) => m.id));
  const owners = new Map<string, string>();
  for (const member of data.members) {
    for (const spelling of [member.name, ...member.nameVariants]) {
      const key = spelling.normalize("NFKC").replace(/\s/g, "");
      const owner = owners.get(key);
      if (owner && owner !== member.id)
        errors.push("別名・表示名が異なる議員IDで衝突");
      owners.set(key, member.id);
    }
  }
  const sourceIds = new Set(data.sources.map((s) => s.id));
  const termIds = new Set(data.snapshots.terms.map((t) => t.id));
  function refs(values: string[], known: Set<string>, label: string) {
    if (values.some((value) => !known.has(value)))
      errors.push(`${label}の参照先が不明`);
  }
  unique([...data.members.map((m) => m.id)], "議員ID");
  unique(
    data.members.map((m) => m.name),
    "表示氏名"
  );
  unique(
    data.sources.map((s) => s.id),
    "出典ID"
  );
  unique(
    data.snapshots.terms.map((t) => t.id),
    "任期ID"
  );
  unique(data.coverage.committeeSnapshotIds, "選択委員会名簿");
  for (const m of data.members)
    refs(
      [m.officialSourceId, ...m.notes.flatMap((n) => n.sourceIds)],
      sourceIds,
      "議員の出典"
    );
  for (const list of [
    data.snapshots.rosters,
    data.snapshots.factions,
    data.snapshots.committees,
  ]) {
    unique(
      list.map((s) => s.id),
      "名簿ID"
    );
    refs(
      list.map((s) => s.sourceId),
      sourceIds,
      "名簿の出典"
    );
  }
  for (const snapshot of [
    ...data.snapshots.rosters,
    ...data.snapshots.factions,
    ...data.snapshots.committees,
  ]) {
    const officialSource = data.sources.find(
      (source) => source.id === snapshot.sourceId
    );
    if (officialSource?.asOf && officialSource.asOf !== snapshot.asOf)
      errors.push("名簿と出典の基準日が不一致");
  }
  for (const r of data.snapshots.rosters) {
    unique(
      r.entries.map((e) => e.memberId),
      "名簿内議員ID"
    );
    unique(
      r.entries.map((e) => e.seatNumber),
      "名簿内議席番号"
    );
    refs(
      r.entries.map((e) => e.memberId),
      memberIds,
      "名簿内議員"
    );
    refs(
      r.entries.map((e) => e.termId),
      termIds,
      "名簿内任期"
    );
  }
  for (const f of data.snapshots.factions) {
    unique(
      f.groups.map((g) => g.id),
      "会派ID"
    );
    const ids = f.groups.flatMap((g) => g.memberIds);
    unique(ids, "同一基準日の会派所属");
    refs(ids, memberIds, "会派所属議員");
  }
  for (const s of [...data.snapshots.factions, ...data.snapshots.committees]) {
    if (
      (s.validFrom && s.validFrom > s.asOf) ||
      (s.validTo && s.validTo < s.asOf)
    )
      errors.push("所属期間と基準日の不整合");
  }
  for (const snapshot of data.snapshots.committees) {
    unique(
      snapshot.committees.map((c) => c.id),
      "委員会ID"
    );
    for (const c of snapshot.committees) {
      unique(c.memberIds, "委員会内議員ID");
      refs(c.memberIds, memberIds, "委員会所属議員");
      if (
        !c.memberIds.includes(c.chairId) ||
        !c.memberIds.includes(c.viceChairId) ||
        c.chairId === c.viceChairId
      )
        errors.push("委員長・副委員長の不整合");
    }
  }
  for (const term of data.snapshots.terms) {
    refs([term.sourceId], sourceIds, "任期の出典");
    if (term.startsOn && term.startsOn > term.scheduledEnd)
      errors.push("任期の開始・満了日が逆転");
  }
  refs(
    [data.coverage.rosterSnapshotId],
    new Set(data.snapshots.rosters.map((s) => s.id)),
    "選択議員名簿"
  );
  refs(
    [data.coverage.factionSnapshotId],
    new Set(data.snapshots.factions.map((s) => s.id)),
    "選択会派名簿"
  );
  refs(
    data.coverage.committeeSnapshotIds,
    new Set(data.snapshots.committees.map((s) => s.id)),
    "選択委員会名簿"
  );
  const selectedRoster = data.snapshots.rosters.find(
    (s) => s.id === data.coverage.rosterSnapshotId
  );
  const selectedFactions = data.snapshots.factions.find(
    (s) => s.id === data.coverage.factionSnapshotId
  );
  if (
    selectedRoster &&
    selectedRoster.entries.length !== data.coverage.expectedMembers
  )
    errors.push("対象議員数の不整合");
  if (selectedRoster && selectedFactions) {
    const ids = new Set(selectedFactions.groups.flatMap((g) => g.memberIds));
    if (
      ids.size !== selectedRoster.entries.length ||
      selectedRoster.entries.some((e) => !ids.has(e.memberId))
    )
      errors.push("選択名簿と会派所属の欠損・不整合");
  }
  if (errors.length)
    throw new Error(`議員データの整合性: ${errors.join("、")}`);
  return data;
}
