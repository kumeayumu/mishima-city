import { describe, expect, it } from "vitest";
import {
  getPresiderAtSequence,
  normalizeSourceMark,
  resolveEvidenceMark,
} from "./vote-evidence";

describe("direct source evidence without missing-symbol inference", () => {
  it("normalizes the two circle glyphs only", () => {
    expect(normalizeSourceMark("〇")).toBe("○");
    expect(normalizeSourceMark("斜線")).toBe("斜線");
    expect(normalizeSourceMark(null)).toBeNull();
  });
  it("accepts explicit text-image agreement", () => {
    expect(resolveEvidenceMark("〇", "○")).toEqual({
      status: "confirmed",
      mark: "○",
      basis: "text_and_image",
    });
  });
  it("requires explicit image evidence for a missing PDF graphic", () => {
    expect(resolveEvidenceMark(null, "斜線")).toEqual({
      status: "confirmed",
      mark: "斜線",
      basis: "image_only",
    });
  });
  it("leaves a missing graphic unknown rather than guessing a chair", () => {
    expect(resolveEvidenceMark(null, null)).toEqual({
      status: "missing",
      mark: null,
      basis: null,
    });
  });
  it("does not resolve conflicting methods by majority or roster", () => {
    expect(resolveEvidenceMark("○", "斜線")).toEqual({
      status: "conflict",
      mark: null,
      basis: null,
    });
  });
  it("identifies text-only evidence instead of calling it image checked", () => {
    expect(resolveEvidenceMark("○", null).basis).toBe("text_only");
  });
});
describe("same-day changes in presiding officer", () => {
  const records = [
    { fromMinuteId: 3, memberId: "horie" },
    { fromMinuteId: 76, memberId: "miyashita" },
    { fromMinuteId: 101, memberId: "okada" },
  ];
  it("uses the officer at the decision, not the end-of-day roster", () => {
    expect(getPresiderAtSequence(records, 64)).toBe("horie");
    expect(getPresiderAtSequence(records, 65)).toBe("horie");
    expect(getPresiderAtSequence(records, 85)).toBe("miyashita");
    expect(getPresiderAtSequence(records, 101)).toBe("okada");
  });
  it("does not backdate the first observed officer", () => {
    expect(getPresiderAtSequence(records, 1)).toBeUndefined();
  });
  it("rejects ambiguous or reversed source order", () => {
    expect(() => getPresiderAtSequence([...records].reverse(), 64)).toThrow();
    expect(() => getPresiderAtSequence([records[0], records[0]], 64)).toThrow();
  });
  it("rejects an invalid decision position", () => {
    expect(() => getPresiderAtSequence(records, 0)).toThrow();
  });
});
