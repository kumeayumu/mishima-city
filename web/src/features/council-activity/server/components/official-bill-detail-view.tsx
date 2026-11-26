import "server-only";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/components/layouts/container";
import {
  describeVote,
  getEventFaction,
  getVoteEvent,
} from "../../shared/utils/vote-data";
import { getCouncilActivity } from "../repositories/council-activity-repository";
import { getCouncilVotes } from "../repositories/council-votes-repository";
import { VoteCoverage, VoteSource, VoteSummary } from "./vote-shared";
export function getStaticBillParams() {
  return getCouncilVotes().bills.map((b) => ({ billId: b.id }));
}
export function getBillMetadata(id: string): Metadata {
  const b = getCouncilVotes().bills.find((b) => b.id === id);
  return {
    title: `${b?.number ?? "議案"}｜みらい議会@三島市（非公式）`,
    description:
      "公式資料に基づく議案と個人別賛否。テスト公開中・独立確認待ち。",
  };
}
export function OfficialBillDetailView({ billId }: { billId: string }) {
  const { data, bills } = getCouncilVotes(),
    activity = getCouncilActivity();
  const b = bills.find((b) => b.id === billId);
  if (!b) notFound();
  const event = getVoteEvent(data, billId),
    votes = data.votes.filter((v) => v.eventId === event?.id);
  return (
    <Container className="space-y-6 pt-28 pb-10 md:py-10">
      <Link href="/votes" className="text-sm underline">
        賛否一覧へ
      </Link>
      <header className="space-y-2">
        <p>{b.sessionTitle}</p>
        <h1 className="text-2xl font-bold text-mirai-text">
          {b.number} {b.bill.title}
        </h1>
        <p>
          公式結果：{b.result || "公式資料に未掲載"}
          {b.decisionDate ? `（${b.decisionDate}）` : ""}
        </p>
        {b.latest && (
          <p className="text-sm text-mirai-text-secondary">
            議決結果の掲載確認日：{b.latest.checkedAt.slice(0, 10)}
          </p>
        )}
        <div className="flex flex-wrap gap-3">
          {b.bill.documentUrls.map((url) => (
            <a
              key={url}
              href={url}
              target="_blank"
              rel="noreferrer"
              className="inline-block min-h-10 py-2 text-sm underline"
            >
              公式PDFを確認する
            </a>
          ))}
          <a
            href={b.bill.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-block min-h-10 py-2 text-sm underline"
          >
            公式の議案一覧
          </a>
        </div>
      </header>
      <VoteCoverage data={data} />
      <section
        aria-labelledby="bill-votes"
        className="space-y-4 rounded-xl border border-mirai-border bg-card p-4"
      >
        <h2 id="bill-votes" className="text-xl font-bold">
          議員別賛否
        </h2>
        {event ? (
          <>
            <VoteSummary votes={votes} verification={data.verification} />
            {event.minutesContext && (
              <div className="space-y-2">
                <p className="text-sm">
                  採決時の議長は堀江和雄氏です。承第5号の採決（発言64・65）は、岡田美喜子氏の議長当選・着席（発言99・101）より前です。
                </p>
                <VoteSource sourceId={event.minutesContext.sourceId} />
              </div>
            )}
            <ul className="divide-y divide-mirai-border">
              {event.memberIds.map((id) => {
                const m = activity.members.find((m) => m.id === id);
                const vote = votes.find((v) => v.memberId === id),
                  d = describeVote(vote, b.availability);
                return (
                  <li id={`vote-${id}`} key={id} className="scroll-mt-28 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Link
                        href={`/members/${id}`}
                        className="font-bold underline"
                      >
                        {m?.name}
                      </Link>
                      <span
                        className={
                          d.kind === "yes"
                            ? "font-bold text-stance-for"
                            : d.kind === "no"
                              ? "font-bold text-stance-against"
                              : "font-bold text-mirai-text"
                        }
                      >
                        {d.symbol} {d.label}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-mirai-text-secondary">
                      採決資料の会派：{getEventFaction(data, event.id, id)}
                      ／出典：印刷{vote?.locator.printedPage}頁・
                      {vote?.locator.row}行・{vote?.locator.column}列
                    </p>
                  </li>
                );
              })}
            </ul>
          </>
        ) : (
          <p className="text-sm">
            {b.availability === "result_unreported"
              ? "議決日・結果は最新確認時も公式資料に未掲載です。個人別賛否も未確認です。"
              : "全会一致の記載があっても個人票は推定しません。この議案の個人別賛否は資料未掲載です。"}
          </p>
        )}
        <VoteSource sourceId={b.coverageSourceId} />
      </section>
    </Container>
  );
}
