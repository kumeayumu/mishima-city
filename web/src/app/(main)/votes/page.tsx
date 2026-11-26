import type { Metadata } from "next";
import { VoteListView } from "@/features/council-activity/server/components/vote-list-view";
import type { MemberSearchParams } from "@/features/council-activity/shared/types/council-activity";
export const metadata: Metadata = {
  title: "議案賛否｜みらい議会@三島市（非公式）",
  description: "公式資料の個人別賛否。テスト公開中・独立確認待ち。",
};
export default async function VotesPage({
  searchParams,
}: {
  searchParams: Promise<MemberSearchParams>;
}) {
  return <VoteListView searchParams={await searchParams} />;
}
