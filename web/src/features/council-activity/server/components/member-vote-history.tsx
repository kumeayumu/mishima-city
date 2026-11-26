import "server-only";
import Link from "next/link";
import {
  describeVote,
  getEventFaction,
  getVoteReviewLabel,
  getVoteSummary,
} from "../../shared/utils/vote-data";
import { getCouncilVotes } from "../repositories/council-votes-repository";
export function MemberVoteHistory({ memberId }: { memberId: string }) {
  const { data, bills } = getCouncilVotes(),
    votes = data.votes.filter((v) => v.memberId === memberId),
    summary = getVoteSummary(votes);
  return (
    <section
      aria-labelledby="member-votes"
      className="space-y-3 rounded-2xl border border-mirai-border bg-card p-5"
    >
      <h2 id="member-votes" className="text-xl font-bold text-mirai-text">
        議案賛否
      </h2>
      <p className="text-sm">
        個人表のある{votes.length}議案の範囲：賛成{summary.yes}、反対
        {summary.no}、その他{summary.other}。
      </p>
      <p className="text-sm text-mirai-text-secondary">
        {getVoteReviewLabel(data.verification)}
        。全62議案の完全な投票履歴ではありません。未掲載分を賛成0／反対0として集計していません。
      </p>
      <ul className="divide-y divide-mirai-border">
        {votes.map((v) => {
          const event = data.events.find((e) => e.id === v.eventId),
            bill = bills.find((b) => b.id === event?.billId);
          if (!bill || !event) throw new Error("履歴の議案不明");
          const d = describeVote(v, bill.availability);
          return (
            <li key={v.eventId} className="space-y-1 py-3">
              <Link
                href={`/bills/${bill.id}#vote-${memberId}`}
                className="font-bold underline"
              >
                {bill.number} {bill.bill.title}
              </Link>
              <p className="text-sm">
                {event.date}／{d.symbol} {d.label}
              </p>
              <p className="text-xs text-mirai-text-secondary">
                採決資料の会派：{getEventFaction(data, event.id, memberId)}
              </p>
            </li>
          );
        })}
      </ul>
      <Link
        href={`/votes?member=${memberId}`}
        className="inline-block min-h-10 py-2 text-sm underline"
      >
        この議員の賛否・公式出典を確認
      </Link>
    </section>
  );
}
