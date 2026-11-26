export type BillSearchParams = Record<string, string | string[] | undefined>;

export interface SearchableBill {
  number: string;
  title: string;
  result: string;
}

export interface BillSearchFilters {
  query: string;
  session: string;
  result: string;
  ignoredFilters: boolean;
}
