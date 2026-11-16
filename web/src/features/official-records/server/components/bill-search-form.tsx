import "server-only";
import Form from "next/form";
import { Button } from "@/components/ui/button";
import type { BillSearchFilters } from "../../shared/types/bill-search";
import { billResultOptions } from "../../shared/utils/bill-search";

interface Props {
  filters: BillSearchFilters;
  sessions: { title: string; sourceUrl: string }[];
  count: number;
  total: number;
}

export function BillSearchForm({ filters, sessions, count, total }: Props) {
  const active = Boolean(filters.query || filters.session || filters.result);
  const fieldClass =
    "min-h-11 w-full min-w-0 rounded-md border border-mirai-border bg-background px-3 py-2 text-base text-mirai-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";
  return (
    <div
      key={JSON.stringify([filters.query, filters.session, filters.result])}
      className="space-y-3 rounded-lg border border-mirai-border p-4"
    >
      <Form
        action="/#official-bills"
        prefetch={false}
        aria-label="議案検索"
        className="space-y-4"
      >
        <div>
          <label htmlFor="bill-query" className="mb-1 block font-bold">
            議案番号・件名
          </label>
          <input
            id="bill-query"
            name="q"
            type="search"
            defaultValue={filters.query}
            placeholder="例：議第68号、補正予算"
            aria-describedby="bill-search-help"
            className={fieldClass}
          />
          <p
            id="bill-search-help"
            className="mt-1 text-sm text-mirai-text-secondary"
          >
            空白で区切ると、すべてのキーワードを含む議案を検索します。PDF・会議録の本文は検索しません。
          </p>
        </div>
        <div className="grid min-w-0 gap-4 md:grid-cols-2">
          <div className="min-w-0">
            <label htmlFor="bill-session" className="mb-1 block font-bold">
              会議
            </label>
            <select
              id="bill-session"
              name="session"
              defaultValue={filters.session}
              className={fieldClass}
            >
              <option value="">すべての会議</option>
              {sessions.map((session) => (
                <option key={session.sourceUrl} value={session.sourceUrl}>
                  {session.title}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-0">
            <label htmlFor="bill-result" className="mb-1 block font-bold">
              議決結果
            </label>
            <select
              id="bill-result"
              name="result"
              defaultValue={filters.result}
              className={fieldClass}
            >
              <option value="">すべての結果</option>
              {billResultOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button type="submit">検索・絞り込み</Button>
          <Button variant="outline" asChild>
            <a href="/#official-bills">条件をすべて解除</a>
          </Button>
        </div>
      </Form>
      <p id="bill-search-count" className="font-bold text-mirai-text">
        該当{count}件／全{total}件{active ? "（絞り込み中）" : ""}
      </p>
      {filters.ignoredFilters && (
        <p className="text-sm text-mirai-text-secondary">
          URLで指定された会議または議決結果が見つからないため、その条件を解除しました。
        </p>
      )}
      {count === 0 && (
        <p className="text-mirai-text">
          該当する議案はありません。キーワードや条件を変更するか、条件をすべて解除してください。
        </p>
      )}
    </div>
  );
}
