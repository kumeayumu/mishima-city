import type { z } from "zod";
import type { activityDataSchema } from "../utils/validate-activity-data";

export type ActivityData = z.infer<typeof activityDataSchema>;
export type OfficialSource = ActivityData["sources"][number];
export type MemberSearchParams = Record<string, string | string[] | undefined>;
export interface MemberFilters {
  query: string;
  faction: string;
  order: "seat" | "kana";
  ignoredFilters: boolean;
}
