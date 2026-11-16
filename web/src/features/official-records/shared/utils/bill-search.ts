import type {
  BillSearchFilters,
  BillSearchParams,
  SearchableBill,
} from "../types/bill-search";

export const billResultOptions = [
  { value: "可決", label: "可決" },
  { value: "認定", label: "認定" },
  { value: "同意", label: "同意" },
  { value: "一部採択", label: "一部採択" },
  { value: "承認", label: "承認" },
  { value: "unpublished", label: "公式資料に未掲載" },
] as const;

export function normalizeBillSearchText(value: string): string {
  return value.normalize("NFKC").toLowerCase().trim().replace(/\s+/g, " ");
}

export function parseBillSearchFilters(
  params: BillSearchParams,
  sessionKeys: readonly string[]
): BillSearchFilters {
  const first = (value: string | string[] | undefined) =>
    Array.isArray(value) ? value[0] || "" : value || "";
  const session = first(params.session);
  const result = first(params.result);
  const validSession = sessionKeys.includes(session);
  const validResult = billResultOptions.some(
    (option) => option.value === result
  );
  return {
    query: normalizeBillSearchText(first(params.q)),
    session: validSession ? session : "",
    result: validResult ? result : "",
    ignoredFilters: Boolean(
      (session && !validSession) || (result && !validResult)
    ),
  };
}

export function matchesBillQuery(bill: SearchableBill, query: string): boolean {
  const text = normalizeBillSearchText(`${bill.number} ${bill.title}`);
  const number = normalizeBillSearchText(bill.number).replace(/\s/g, "");
  const actualNumber = number.match(/^(.*?)(?:第)?(\d+)号?$/);
  return normalizeBillSearchText(query)
    .split(" ")
    .filter(Boolean)
    .every((word) => {
      const requestedNumber = word.match(
        /^(議案|議|承|報|陳情|請願|諮問)?(?:第)?(\d+)(?:号)?$/
      );
      if (requestedNumber && actualNumber) {
        const prefix =
          requestedNumber[1] === "議案" ? "議" : requestedNumber[1];
        return (
          ((!prefix || actualNumber[1].replace(/第$/, "") === prefix) &&
            Number(actualNumber[2]) === Number(requestedNumber[2])) ||
          normalizeBillSearchText(bill.title).includes(word)
        );
      }
      return text.includes(word);
    });
}

export function filterBillSessions<
  T extends { sourceUrl: string; bills: SearchableBill[] },
>(sessions: readonly T[], filters: BillSearchFilters): T[] {
  return sessions
    .filter(
      (session) => !filters.session || session.sourceUrl === filters.session
    )
    .map((session) => ({
      ...session,
      bills: session.bills.filter(
        (bill) =>
          matchesBillQuery(bill, filters.query) &&
          (!filters.result ||
            (filters.result === "unpublished"
              ? !bill.result.trim()
              : bill.result === filters.result))
      ),
    }))
    .filter((session) => session.bills.length > 0);
}
