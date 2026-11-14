import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  isInFiscalYear,
  meetingMonth,
  type OfficialBill,
} from "./source-utils";

const folder = resolve(
  import.meta.dirname,
  "../../../../web/src/features/official-records/server/data/2026"
);
function read<T>(name: string): T {
  return JSON.parse(readFileSync(resolve(folder, name), "utf8")) as T;
}

describe("公開用の公式資料スナップショット", () => {
  it("議案の対象会議を2026年度に限定し、公式へのリンクを保持する", () => {
    const data = read<{
      sessions: { title: string; sourceUrl: string; bills: OfficialBill[] }[];
    }>("bills.json");
    expect(data.sessions.length).toBeGreaterThan(0);
    for (const session of data.sessions) {
      const year = Number(session.title.match(/(\d{4})年/)?.[1]);
      expect(isInFiscalYear(year, meetingMonth(session.title) || 0, 2026)).toBe(
        true
      );
      expect(new URL(session.sourceUrl).hostname).toBe(
        "www.city.mishima.shizuoka.jp"
      );
      expect(new Set(session.bills.map((bill) => bill.number)).size).toBe(
        session.bills.length
      );
      for (const bill of session.bills) {
        expect(bill.number).not.toMatch(/[\u200b\ufeff]/);
        for (const url of bill.documentUrls)
          expect(new URL(url).hostname).toBe("www.city.mishima.shizuoka.jp");
      }
    }
  });
  it("会議録の実開催日と原文件数を確認する", () => {
    const data = read<{
      meetings: { id: string; date: string; entryCount: number }[];
    }>("minutes-index.json");
    const manifest = read<{ meetings: number; minuteEntries: number }>(
      "manifest.json"
    );
    let entries = 0;
    for (const meeting of data.meetings) {
      const [year, month] = meeting.date.split("-").map(Number);
      expect(isInFiscalYear(year, month, 2026)).toBe(true);
      const body = read<{
        date: string;
        sourceUrl: string;
        minutes: { id: number; text: string }[];
      }>("minutes/" + meeting.id + ".json");
      expect(body.date).toBe(meeting.date);
      expect(new URL(body.sourceUrl).searchParams.get("tenant_id")).toBe("406");
      expect(body.minutes.length).toBe(meeting.entryCount);
      entries += body.minutes.length;
    }
    expect(data.meetings.length).toBe(manifest.meetings);
    expect(entries).toBe(manifest.minuteEntries);
  });
});
