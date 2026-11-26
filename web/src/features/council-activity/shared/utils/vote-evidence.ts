export interface PresiderRecord {
  fromMinuteId: number;
  memberId: string;
}

// The source sequence, rather than a day-level roster, determines the presider.
export function getPresiderAtSequence(
  records: PresiderRecord[],
  minuteId: number
) {
  if (
    !Number.isInteger(minuteId) ||
    minuteId < 1 ||
    records.some(
      (r, i) =>
        !Number.isInteger(r.fromMinuteId) ||
        r.fromMinuteId < 1 ||
        !r.memberId ||
        (i > 0 && r.fromMinuteId <= records[i - 1].fromMinuteId)
    )
  ) {
    throw new Error("議事進行順序が不正です");
  }
  return records.filter((r) => r.fromMinuteId <= minuteId).at(-1)?.memberId;
}

export function normalizeSourceMark(mark: string | null) {
  return mark === "〇" ? "○" : mark;
}

// Missing graphic/text evidence stays missing. No roster or assumed chair is used.
export function resolveEvidenceMark(
  textMark: string | null,
  imageMark: string | null
) {
  const text = normalizeSourceMark(textMark),
    image = normalizeSourceMark(imageMark);
  if (!text && !image)
    return { status: "missing" as const, mark: null, basis: null };
  if (text && image && text !== image)
    return { status: "conflict" as const, mark: null, basis: null };
  return {
    status: "confirmed" as const,
    mark: image || text,
    basis:
      text && image ? "text_and_image" : image ? "image_only" : "text_only",
  };
}
