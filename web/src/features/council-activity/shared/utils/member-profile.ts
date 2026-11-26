import type {
  ActivityData,
  MemberFilters,
  MemberSearchParams,
} from "../types/council-activity";

export function getMemberProfiles(data: ActivityData) {
  const roster = data.snapshots.rosters.find(
    (r) => r.id === data.coverage.rosterSnapshotId
  );
  const factions = data.snapshots.factions.find(
    (f) => f.id === data.coverage.factionSnapshotId
  );
  if (!roster || !factions) throw new Error("表示用の名簿が見つかりません");
  return roster.entries.map((entry) => {
    const member = data.members.find((m) => m.id === entry.memberId);
    if (!member) throw new Error("議員IDが見つかりません");
    const faction = factions.groups.find((f) =>
      f.memberIds.includes(member.id)
    );
    const term = data.snapshots.terms.find((t) => t.id === entry.termId);
    return {
      member,
      entry,
      roster,
      faction: faction
        ? {
            id: faction.id,
            name: faction.name,
            asOf: factions.asOf,
            sourceId: factions.sourceId,
          }
        : null,
      term: term ?? null,
      committees: data.snapshots.committees
        .filter((s) => data.coverage.committeeSnapshotIds.includes(s.id))
        .flatMap((s) =>
          s.committees
            .filter((c) => c.memberIds.includes(member.id))
            .map((c) => ({
              id: c.id,
              name: c.name,
              asOf: s.asOf,
              sourceId: s.sourceId,
              role:
                c.chairId === member.id
                  ? "委員長"
                  : c.viceChairId === member.id
                    ? "副委員長"
                    : "委員",
            }))
        ),
    };
  });
}

export type MemberProfile = ReturnType<typeof getMemberProfiles>[number];

function normalize(value: string) {
  return value
    .normalize("NFKC")
    .replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60))
    .replace(/\s/g, "");
}

export function parseMemberFilters(
  params: MemberSearchParams,
  factions: string[]
): MemberFilters {
  const first = (key: string) =>
    Array.isArray(params[key]) ? (params[key][0] ?? "") : (params[key] ?? "");
  const rawFaction = first("faction");
  const rawOrder = first("order");
  const query = first("q");
  return {
    query: query.slice(0, 100).trim(),
    faction: factions.includes(rawFaction) ? rawFaction : "",
    order: rawOrder === "kana" ? "kana" : "seat",
    ignoredFilters: Boolean(
      (rawFaction && !factions.includes(rawFaction)) ||
        (rawOrder && !["seat", "kana"].includes(rawOrder)) ||
        query.length > 100 ||
        ["q", "faction", "order"].some((k) => Array.isArray(params[k]))
    ),
  };
}

export function filterMemberProfiles(
  profiles: MemberProfile[],
  filters: MemberFilters
) {
  const words = filters.query.split(/\s+/u).filter(Boolean).map(normalize);
  return profiles
    .filter((p) => {
      const haystack = [p.member.name, p.member.kana, ...p.member.nameVariants]
        .map(normalize)
        .join(" ");
      return (
        (!filters.faction || p.faction?.id === filters.faction) &&
        words.every((w) => haystack.includes(w))
      );
    })
    .sort((a, b) =>
      filters.order === "kana"
        ? a.member.kana.localeCompare(b.member.kana, "ja") ||
          a.entry.seatNumber - b.entry.seatNumber
        : a.entry.seatNumber - b.entry.seatNumber
    );
}
