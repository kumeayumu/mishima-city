import type { Metadata } from "next";
import { MemberListView } from "@/features/council-activity/server/components/member-list-view";
import type { MemberSearchParams } from "@/features/council-activity/shared/types/council-activity";

export const metadata: Metadata = {
  title: "議員から探す｜みらい議会@三島市（非公式）",
  description:
    "公式名簿に基づく三島市議会議員22人の情報。資料基準日と出典を確認できます。非公式・テスト公開中のサイトです。",
};

export default async function MembersPage({
  searchParams,
}: {
  searchParams: Promise<MemberSearchParams>;
}) {
  return <MemberListView searchParams={await searchParams} />;
}
