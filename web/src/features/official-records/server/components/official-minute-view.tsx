import "server-only";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/components/layouts/container";
import { getOfficialMinute } from "../repositories/official-records-repository";

export async function OfficialMinuteView({ id }: { id: string }) {
  const meeting = await getOfficialMinute(id);
  if (!meeting) notFound();
  return (
    <Container className="space-y-6 pt-28 pb-10 md:py-10">
      <Link
        href="/#official-minutes"
        className="text-sm underline text-mirai-text"
      >
        会議録一覧へ
      </Link>
      <h1 className="text-xl font-bold text-mirai-text">
        {meeting.name} {meeting.date}
      </h1>
      <p className="text-sm text-mirai-text-secondary">
        会議録本文はこのサイトには掲載していません。全文は三島市議会の公式会議録検索サイトでご確認ください。
      </p>
      <a
        href={meeting.sourceUrl}
        target="_blank"
        rel="noreferrer"
        className="inline-block text-sm underline text-mirai-text"
      >
        公式の会議録を確認する
      </a>
    </Container>
  );
}
