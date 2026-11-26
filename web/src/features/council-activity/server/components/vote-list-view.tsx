import "server-only";
import Link from "next/link";
import { Container } from "@/components/layouts/container";
import { Button } from "@/components/ui/button";
import { VoteMatrixScroll } from "../../client/components/vote-matrix-scroll";
import type { MemberSearchParams } from "../../shared/types/council-activity";
import { getMemberProfiles } from "../../shared/utils/member-profile";
import {
  describeVote,
  getEventFaction,
  getFactionScope,
  getVoteEvent,
  getVoteSummary,
  selectVoteBills,
} from "../../shared/utils/vote-data";
import { getCouncilActivity } from "../repositories/council-activity-repository";
import { getCouncilVotes } from "../repositories/council-votes-repository";
import { VoteCoverage, VoteSource } from "./vote-shared";
export function VoteListView({
  searchParams = {},
}: {
  searchParams?: MemberSearchParams;
}) {
  const { data, bills } = getCouncilVotes(),
    activity = getCouncilActivity(),
    filters = selectVoteBills(bills, data, searchParams);
  const raw = Array.isArray(searchParams.member)
    ? searchParams.member[0]
    : searchParams.member;
  const member = activity.members.some((m) => m.id === raw) ? (raw ?? "") : "";
  const profiles = getMemberProfiles(activity).filter(
    (p) =>
      (!member || p.member.id === member) &&
      (!!member ||
        !filters.faction ||
        filters.bills.some(
          (b) =>
            getFactionScope(
              data,
              getVoteEvent(data, b.id)?.id,
              p.member.id,
              filters.faction
            ) !== "outside"
        ))
  );
  const query = new URLSearchParams({
    coverage: filters.coverage,
    session: filters.session,
    faction: filters.faction,
    ...(member ? { member } : {}),
    ...(filters.divided ? { divided: "1" } : {}),
  });
  return (
    <Container wide className="space-y-6 pt-28 pb-10 md:py-10">
      <Link href="/" className="text-sm underline">
        トップページへ
      </Link>
      <header className="space-y-2">
        <h1 className="text-2xl font-bold">議員別の議案賛否</h1>
        <p className="text-sm text-mirai-text-secondary">
          採決資料から確認できる個人票と、資料未掲載の範囲を分けて表示します。
        </p>
      </header>
      <VoteCoverage data={data} />
      <form
        key={JSON.stringify([
          filters.coverage,
          filters.session,
          filters.view,
          filters.divided,
          filters.faction,
          member,
        ])}
        action="/votes"
        method="get"
        className="space-y-4 rounded-xl border border-mirai-border bg-card p-4"
        aria-label="賛否の絞り込み"
      >
        <input type="hidden" name="view" value={filters.view} />
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1 text-sm font-bold">
            対象議案
            <select
              name="coverage"
              defaultValue={filters.coverage}
              className="block min-h-11 w-full min-w-0 rounded-lg border border-mirai-border bg-background p-2 text-base"
            >
              <option value="recorded">個人表あり9議案</option>
              <option value="all">全62議案（未掲載を含む）</option>
            </select>
          </label>
          <label className="space-y-1 text-sm font-bold">
            会期
            <select
              name="session"
              defaultValue={filters.session}
              className="block min-h-11 w-full min-w-0 rounded-lg border border-mirai-border bg-background p-2 text-base"
            >
              <option value="">すべて</option>
              {[5, 6, 9, 11].map((m) => (
                <option value={m} key={m}>
                  {m}月
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm font-bold">
            議員
            <select
              name="member"
              defaultValue={member}
              className="block min-h-11 w-full min-w-0 rounded-lg border border-mirai-border bg-background p-2 text-base"
            >
              <option value="">全議員</option>
              {getMemberProfiles(activity).map((p) => (
                <option key={p.member.id} value={p.member.id}>
                  {p.member.name}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm font-bold">
            採決資料の当時会派
            <select
              name="faction"
              defaultValue={filters.faction}
              className="block min-h-11 w-full min-w-0 rounded-lg border border-mirai-border bg-background p-2 text-base"
            >
              <option value="">すべての当時会派</option>
              {[
                ...new Set(
                  data.affiliations.flatMap((a) => a.groups.map((g) => g.name))
                ),
              ].map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="divided"
            value="1"
            defaultChecked={filters.divided}
          />
          賛否が分かれた議案のみ（議案全体に明示的な賛成・反対あり）
        </label>
        <div className="flex flex-wrap gap-3">
          <Button size="sm" type="submit">
            条件を反映
          </Button>
          <Button asChild variant="link">
            <Link href="/votes">条件をすべて解除</Link>
          </Button>
        </div>
      </form>
      <nav aria-label="表示方式" className="flex flex-wrap gap-4">
        <Link
          className="min-h-10 py-2 underline"
          href={`/votes?${query.toString()}&view=list`}
        >
          カード・一覧表示
        </Link>
        <Link
          className="min-h-10 py-2 underline"
          href={`/votes?${query.toString()}&view=matrix`}
        >
          賛否マトリクス
        </Link>
      </nav>
      <p role="status" className="font-bold">
        表示{filters.bills.length}議案／全62議案
        {member ? "（議員を絞り込み中）" : ""}
      </p>
      {filters.faction && (
        <p className="text-sm">
          当時会派：{filters.faction}
          。会派条件外の票は「外」、当時会派が分からないセルは「?」です。欠席や資料未掲載へ変換しません。
        </p>
      )}
      {filters.bills.length === 0 ? (
        <p>
          条件に一致する議案がありません。条件を解除してください。資料未掲載を0票とみなしていません。
        </p>
      ) : filters.view === "matrix" ? (
        <VoteMatrixScroll key={query.toString()}>
          <table className="border-collapse whitespace-nowrap text-sm">
            <caption className="sr-only">
              議員を行、議案を列とした公式資料の個人別賛否
            </caption>
            <thead className="sticky top-0 z-20 bg-mirai-surface">
              <tr>
                <th
                  scope="col"
                  className="sticky left-0 z-30 min-w-32 border border-mirai-border bg-mirai-surface p-2"
                >
                  議員
                </th>
                {filters.bills.map((b) => (
                  <th
                    key={b.id}
                    scope="col"
                    className="min-w-20 border border-mirai-border p-2"
                  >
                    <Link href={`/bills/${b.id}`} className="underline">
                      {b.session}月<br />
                      {b.number}
                    </Link>
                    <details className="mt-1 text-xs font-normal">
                      <summary
                        aria-label={`${b.number}の議案名を表示`}
                        className="min-h-8 cursor-pointer py-1"
                      >
                        議案名
                      </summary>
                      <p className="w-36 whitespace-normal py-2 text-left sm:w-48">
                        {b.bill.title}
                      </p>
                    </details>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {profiles.map((p) => (
                <tr key={p.member.id}>
                  <th
                    scope="row"
                    className="sticky left-0 z-10 min-w-32 whitespace-nowrap border border-mirai-border bg-card px-2 py-1 text-left"
                  >
                    <Link
                      href={`/members/${p.member.id}`}
                      className="underline"
                    >
                      {p.member.name}
                    </Link>
                  </th>
                  {filters.bills.map((b) => {
                    const event = getVoteEvent(data, b.id),
                      vote = data.votes.find(
                        (v) =>
                          v.eventId === event?.id && v.memberId === p.member.id
                      ),
                      baseDescription = describeVote(
                        vote,
                        b.availability,
                        !event || event.memberIds.includes(p.member.id)
                      );
                    const scope = getFactionScope(
                      data,
                      event?.id,
                      p.member.id,
                      filters.faction
                    );
                    const d =
                      scope === "outside"
                        ? {
                            symbol: "外",
                            label: "会派条件の対象外（当時の所属が異なる）",
                            kind: "neutral",
                          }
                        : scope === "unknown"
                          ? {
                              symbol: baseDescription.symbol,
                              label:
                                "採決当時の会派未確認／" +
                                baseDescription.label,
                              kind: "neutral",
                            }
                          : baseDescription;
                    return (
                      <td
                        key={b.id}
                        className={`border border-mirai-border p-0 text-center ${d.kind === "yes" ? "bg-stance-for-bg text-stance-for" : d.kind === "no" ? "bg-stance-against-bg text-stance-against" : "bg-mirai-surface-grouped text-mirai-text-secondary"}`}
                      >
                        <Link
                          className="flex min-h-11 flex-col items-center justify-center px-2 py-1 font-black"
                          aria-label={`${p.member.name}・${b.number}・${d.label}${event ? `・採決資料の会派：${getEventFaction(data, event.id, p.member.id)}` : ""}`}
                          href={`/bills/${b.id}${event ? `#vote-${p.member.id}` : ""}`}
                        >
                          <span
                            className={
                              d.kind === "yes" || d.kind === "no"
                                ? "vote-symbol-strong text-lg"
                                : "font-bold"
                            }
                          >
                            {d.symbol}
                          </span>
                          {scope === "unknown" && (
                            <span
                              aria-hidden="true"
                              className="text-xs font-normal"
                            >
                              会派?
                            </span>
                          )}
                        </Link>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </VoteMatrixScroll>
      ) : (
        <ul className="space-y-4">
          {filters.bills.map((b) => {
            const e = getVoteEvent(data, b.id),
              all = data.votes.filter((v) => v.eventId === e?.id),
              scoped = all.filter(
                (v) =>
                  (!member || v.memberId === member) &&
                  getFactionScope(data, e?.id, v.memberId, filters.faction) ===
                    "match"
              ),
              s = getVoteSummary(scoped),
              v = member ? all.find((v) => v.memberId === member) : undefined;
            return (
              <li
                key={b.id}
                className="space-y-2 rounded-xl border border-mirai-border bg-card p-4"
              >
                <h2 className="font-bold">
                  <Link href={`/bills/${b.id}`} className="underline">
                    {b.session}月 {b.number} {b.bill.title}
                  </Link>
                </h2>
                <p className="text-sm">
                  公式結果：{b.result || "保存済み議案一覧に未掲載"}
                  {b.decisionDate ? `／${b.decisionDate}` : ""}
                </p>
                {filters.faction && !e && (
                  <p className="text-sm text-mirai-text-secondary">
                    採決当時の会派は未確認です。会派条件に一致したと確認できた議案ではありません。
                  </p>
                )}
                {e && scoped.length ? (
                  <p className="text-sm">
                    条件内の対象{s.total}人：賛成{s.yes}・反対{s.no}・その他
                    {s.other}
                    {v
                      ? `／選択議員：${describeVote(v, b.availability).label}`
                      : ""}
                  </p>
                ) : (
                  <p className="text-sm text-mirai-text-secondary">
                    {e
                      ? "この採決では選択条件の対象外です"
                      : describeVote(undefined, b.availability).label}
                    。個人票は推定しません。
                  </p>
                )}
                <VoteSource sourceId={b.coverageSourceId} />
              </li>
            );
          })}
        </ul>
      )}
    </Container>
  );
}
