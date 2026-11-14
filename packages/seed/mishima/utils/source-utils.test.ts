import { describe, expect, it } from "vitest";
import {
  parseBills,
  parseJapaneseDate,
  parseJsonp,
  plainText,
  sourceLinks,
} from "./source-utils";

describe("三島市公式資料の解析", () => {
  it("元年・全角数字を変換し、存在しない日付を拒否する", () => {
    expect(parseJapaneseDate("令和元年５月１日")).toBe("2019-05-01");
    expect(parseJapaneseDate("平成２３年６月１７日")).toBe("2011-06-17");
    expect(parseJapaneseDate("令和8年2月30日")).toBeNull();
    expect(parseJapaneseDate("未定")).toBeNull();
  });
  it("表の結合セルと出典リンクを保持する", () => {
    const html =
      "<table><tr><th>議案番号</th><th>件名</th><th>議決日</th><th>結果</th></tr>" +
      '<tr><td>議第１号</td><td><a href="/uploaded/1.pdf">条例 [PDFファイル／90KB]</a></td><td rowspan="2">令和8年9月4日</td><td>原案可決</td></tr>' +
      "<tr><td>議第2号</td><td>予算</td><td>否決</td></tr></table>";
    const bills = parseBills(
      html,
      "https://www.city.mishima.shizuoka.jp/site/gikai/1.html"
    );
    expect(bills).toHaveLength(2);
    expect(bills[0].title).toBe("条例");
    expect(bills[0].documentUrls).toEqual([
      "https://www.city.mishima.shizuoka.jp/uploaded/1.pdf",
    ]);
    expect(bills[1].decisionDate).toBe("2026-09-04");
    expect(bills[1].result).toBe("否決");
  });
  it("未掲載の議決結果を推測しない", () => {
    const html =
      "<table><tr><th>議案番号</th><th>件名</th><th>議決日</th><th>結果</th></tr>" +
      "<tr><td>認第1号</td><td>決算</td><td>&nbsp;</td><td></td></tr></table>";
    expect(
      parseBills(html, "https://www.city.mishima.shizuoka.jp/")[0].decisionDate
    ).toBeNull();
    expect(() =>
      parseBills("<p>メンテナンス中</p>", "https://example.com")
    ).toThrow();
  });
  it("HTMLは実行せずプレーンテキストとして取り出す", () => {
    expect(plainText("<pre>質問&amp;回答<br>本文</pre>")).toBe(
      "質問&回答\n本文"
    );
    expect(
      sourceLinks(
        '<a href="javascript:alert(1)">不可</a>',
        "https://example.com"
      )
    ).toEqual([]);
  });
  it("JSONPはコードとして評価しない", () => {
    expect(parseJsonp('callback({"view_years":[]});')).toEqual({
      view_years: [],
    });
    expect(() => parseJsonp("callback({});alert(1)")).toThrow();
  });
});

import { isInFiscalYear, meetingMonth } from "./source-utils";

describe("2026年度の抽出境界", () => {
  it("2026年4月から2027年3月だけを対象にする", () => {
    expect(isInFiscalYear(2026, 3, 2026)).toBe(false);
    expect(isInFiscalYear(2026, 4, 2026)).toBe(true);
    expect(isInFiscalYear(2027, 3, 2026)).toBe(true);
    expect(isInFiscalYear(2027, 4, 2026)).toBe(false);
    expect(isInFiscalYear(2026, 13, 2026)).toBe(false);
    expect(meetingMonth("令和　８年　　６月　定例会")).toBe(6);
  });
});

it("公式一覧の番号の不一致を自動修正せず通知する", () => {
  const html =
    "<table><tr><th>議案番号</th><th>件名</th><th>議決日</th><th>結果</th></tr>" +
    "<tr><td>議第53号</td><td>認第8号_決算認定について</td><td></td><td></td></tr></table>";
  const bill = parseBills(html, "https://www.city.mishima.shizuoka.jp/")[0];
  expect(bill.number).toBe("議第53号");
  expect(bill.title).toBe("認第8号_決算認定について");
  expect(bill.sourceWarnings).toHaveLength(1);
});
