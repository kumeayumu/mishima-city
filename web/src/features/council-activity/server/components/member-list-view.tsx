import "server-only";
import { ArrowRight, UsersRound } from "lucide-react";
import Link from "next/link";
import { Container } from "@/components/layouts/container";
import { Button } from "@/components/ui/button";
import type { MemberSearchParams } from "../../shared/types/council-activity";
import {
  filterMemberProfiles,
  getMemberProfiles,
  parseMemberFilters,
} from "../../shared/utils/member-profile";
import { getCouncilActivity } from "../repositories/council-activity-repository";
import { CoverageNotice } from "./coverage-notice";
import { SourceReference } from "./source-reference";

export function MemberListView({
  searchParams = {},
}: {
  searchParams?: MemberSearchParams;
}) {
  const data = getCouncilActivity();
  const profiles = getMemberProfiles(data);
  const groups =
    data.snapshots.factions.find(
      (f) => f.id === data.coverage.factionSnapshotId
    )?.groups ?? [];
  const filters = parseMemberFilters(
    searchParams,
    groups.map((g) => g.id)
  );
  const visible = filterMemberProfiles(profiles, filters);
  const active = Boolean(filters.query || filters.faction);
  const officialSource = data.sources.find((s) => s.id === "roster-page");
  return (
    <Container className="space-y-6 pt-28 pb-10 md:py-10">
      <Link
        href="/"
        className="inline-block py-2 text-sm text-mirai-text underline"
      >
        トップページへ
      </Link>
      <header className="space-y-3">
        <div className="flex items-center gap-2">
          <UsersRound
            aria-hidden="true"
            className="size-6 text-primary-accent"
          />
          <h1 className="text-2xl font-bold text-mirai-text">議員から探す</h1>
        </div>
        <p className="text-sm text-mirai-text-secondary">
          氏名・かな・会派から三島市議会の議員を探せます。初期表示は公式名簿の議席番号順です。
        </p>
        {officialSource && <SourceReference source={officialSource} />}
      </header>
      <CoverageNotice data={data} />
      <form
        key={JSON.stringify([filters.query, filters.faction, filters.order])}
        action="/members"
        method="get"
        aria-label="議員の検索と絞り込み"
        className="space-y-4 rounded-2xl border border-mirai-border bg-card p-4"
      >
        <div className="space-y-1">
          <label
            htmlFor="member-query"
            className="block text-sm font-bold text-mirai-text"
          >
            氏名・かな
          </label>
          <input
            id="member-query"
            name="q"
            type="search"
            defaultValue={filters.query}
            maxLength={100}
            placeholder="例：秋山、あきやま"
            className="min-h-11 w-full min-w-0 rounded-lg border border-mirai-border bg-background px-3 text-base text-mirai-text focus-visible:outline-primary-accent"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <label
              htmlFor="member-faction"
              className="block text-sm font-bold text-mirai-text"
            >
              会派（資料基準日時点）
            </label>
            <select
              id="member-faction"
              name="faction"
              defaultValue={filters.faction}
              className="min-h-11 w-full min-w-0 rounded-lg border border-mirai-border bg-background px-3 text-base text-mirai-text"
            >
              <option value="">すべての会派</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label
              htmlFor="member-order"
              className="block text-sm font-bold text-mirai-text"
            >
              表示順
            </label>
            <select
              id="member-order"
              name="order"
              defaultValue={filters.order}
              className="min-h-11 w-full min-w-0 rounded-lg border border-mirai-border bg-background px-3 text-base text-mirai-text"
            >
              <option value="seat">公式名簿の議席番号順</option>
              <option value="kana">五十音順</option>
            </select>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" size="sm">
            検索・絞り込む
          </Button>
          <Button asChild variant="link">
            <Link href="/members">条件をすべて解除</Link>
          </Button>
        </div>
        <p role="status" className="text-sm font-bold text-mirai-text">
          該当{visible.length}人／全{profiles.length}人
          {active ? "（絞り込み中）" : ""}
        </p>
        {filters.ignoredFilters && (
          <p className="text-sm text-mirai-text-secondary">
            未対応・重複した検索条件は、最初の値または既定の条件で表示しています。
          </p>
        )}
      </form>
      {visible.length === 0 ? (
        <p className="rounded-xl border border-mirai-border p-5 text-mirai-text">
          条件に一致する議員が見つかりません。氏名や会派を変更するか、条件をすべて解除してください。
        </p>
      ) : (
        <ul aria-label="議員一覧" className="grid gap-4 sm:grid-cols-2">
          {visible.map((profile) => (
            <li
              key={profile.member.id}
              className="min-w-0 rounded-2xl border border-mirai-border bg-card p-5"
            >
              <p className="text-xs text-mirai-text-secondary">
                議席番号 {profile.entry.seatNumber}（{profile.roster.asOf}）
              </p>
              <h2 className="mt-2 text-xl font-bold text-mirai-text">
                <Link
                  href={`/members/${profile.member.id}`}
                  className="flex min-h-11 items-center justify-between gap-2 hover:text-primary-accent"
                >
                  <span>{profile.member.name}</span>
                  <ArrowRight aria-hidden="true" className="size-4 shrink-0" />
                </Link>
              </h2>
              <p className="mt-1 text-sm text-mirai-text-secondary">
                {profile.member.kana}
              </p>
              <p className="mt-3 text-sm text-mirai-text">
                {profile.faction?.name ?? "会派未確認"}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Container>
  );
}
