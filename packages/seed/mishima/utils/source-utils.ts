import { parse, type DefaultTreeAdapterMap } from "parse5";

type Node = DefaultTreeAdapterMap["node"];
type Element = DefaultTreeAdapterMap["element"];

export function elements(node: Node, tag: string): Element[] {
  const found: Element[] = [];
  if ("tagName" in node && node.tagName === tag) found.push(node);
  if ("childNodes" in node) {
    for (const child of node.childNodes) found.push(...elements(child, tag));
  }
  return found;
}

export function textContent(node: Node): string {
  if ("value" in node) return node.value;
  if ("tagName" in node && node.tagName === "br") return "\n";
  if ("childNodes" in node) return node.childNodes.map(textContent).join("");
  return "";
}

export function plainText(html: string): string {
  return textContent(parse(html))
    .replace(/[\u200b\ufeff]/g, "")
    .trim();
}

export function attribute(node: Element, name: string): string | undefined {
  return node.attrs.find((attr) => attr.name === name)?.value;
}

export function sourceLinks(html: string, base: string) {
  return elements(parse(html), "a").flatMap((a) => {
    const href = attribute(a, "href");
    if (!href) return [];
    const url = new URL(href, base);
    if (url.protocol !== "https:") return [];
    return [{ title: textContent(a).trim(), url: url.href }];
  });
}

export function parseJapaneseDate(value: string): string | null {
  const text = value.normalize("NFKC").replace(/\s/g, "");
  const match = text.match(/(令和|平成|昭和)(元|\d+)年(\d+)月(\d+)日/);
  if (!match) return null;
  const offsets = { 令和: 2018, 平成: 1988, 昭和: 1925 };
  const year =
    offsets[match[1] as keyof typeof offsets] +
    (match[2] === "元" ? 1 : Number(match[2]));
  const month = Number(match[3]);
  const day = Number(match[4]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  )
    return null;
  return date.toISOString().slice(0, 10);
}

export interface OfficialBill {
  number: string;
  title: string;
  decisionDate: string | null;
  decisionDateRaw: string;
  result: string;
  sourceUrl: string;
  documentUrls: string[];
  sourceWarnings: string[];
}

export function parseBills(html: string, sourceUrl: string): OfficialBill[] {
  const bills: OfficialBill[] = [];
  for (const table of elements(parse(html), "table")) {
    const rows = elements(table, "tr");
    const heading = rows.findIndex((row) => {
      const text = textContent(row).replace(/\s/g, "");
      return text.includes("件名") && text.includes("結果");
    });
    if (heading < 0) continue;
    const carried = new Map<number, { node: Element; remaining: number }>();
    for (const row of rows.slice(heading + 1)) {
      const cells: Element[] = [];
      for (const [index, carry] of carried) {
        cells[index] = carry.node;
        carry.remaining -= 1;
        if (carry.remaining === 0) carried.delete(index);
      }
      let column = 0;
      const rowCells = row.childNodes.filter(
        (node): node is Element =>
          "tagName" in node && ["td", "th"].includes(node.tagName)
      );
      for (const cell of rowCells) {
        while (cells[column]) column += 1;
        const colspan = Number(attribute(cell, "colspan") || 1);
        const rowspan = Number(attribute(cell, "rowspan") || 1);
        for (let offset = 0; offset < colspan; offset += 1) {
          cells[column + offset] = cell;
          if (rowspan > 1)
            carried.set(column + offset, {
              node: cell,
              remaining: rowspan - 1,
            });
        }
        column += colspan;
      }
      if (cells.length < 4) continue;
      const number = textContent(cells[0])
        .normalize("NFKC")
        .replace(/[\s\u200b\ufeff]/g, "");
      if (!/第\d+号/.test(number)) continue;
      const title = textContent(cells[1])
        .replace(/\[PDF[^\]]*\]/gi, "")
        .replace(/[\u200b\ufeff]/g, "")
        .replace(/\s+/g, " ")
        .trim();
      const decisionDateRaw = textContent(cells[2]).trim();
      const documentUrls = sourceLinks(
        elements(cells[1], "a")
          .map((a) => '<a href="' + (attribute(a, "href") || "") + '"></a>')
          .join(""),
        sourceUrl
      )
        .filter(
          (link) =>
            new URL(link.url).hostname === "www.city.mishima.shizuoka.jp"
        )
        .map((link) => link.url);
      const titleNumber = title
        .normalize("NFKC")
        .match(/^([^\s\d]+第\d+号)/)?.[1];
      const sourceWarnings =
        titleNumber && titleNumber !== number
          ? [
              "公式一覧の議案番号と件名中の番号が一致していません。原文を確認してください。",
            ]
          : [];
      bills.push({
        number,
        title,
        sourceWarnings,
        decisionDate: parseJapaneseDate(decisionDateRaw),
        decisionDateRaw,
        result: textContent(cells[3]).trim(),
        sourceUrl,
        documentUrls,
      });
    }
  }
  if (bills.length === 0)
    throw new Error("議案表を解析できません: " + sourceUrl);
  return bills;
}

export function parseJsonp(text: string): unknown {
  const match = text.trim().match(/^callback\(([\s\S]*)\);?$/);
  if (!match) throw new Error("公開会議録APIの応答形式が不正です");
  return JSON.parse(match[1]);
}

/** 会議の開催年月で年度を判定する。議案名の「令和○年度」は使わない。 */
export function isInFiscalYear(
  year: number,
  month: number,
  fiscalYear: number
): boolean {
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    month < 1 ||
    month > 12
  )
    return false;
  return (month >= 4 ? year : year - 1) === fiscalYear;
}

export function meetingMonth(name: string): number | null {
  const match = name.normalize("NFKC").match(/(\d+)月/);
  return match ? Number(match[1]) : null;
}
