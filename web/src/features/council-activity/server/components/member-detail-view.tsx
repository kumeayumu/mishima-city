import "server-only";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/components/layouts/container";
import { getMemberProfiles } from "../../shared/utils/member-profile";
import { getCouncilActivity } from "../repositories/council-activity-repository";
import { CoverageNotice } from "./coverage-notice";
import { MemberVoteHistory } from "./member-vote-history";
import { SourceReference } from "./source-reference";

export function getStaticMemberParams() {
  return getCouncilActivity().members.map((m) => ({ memberId: m.id }));
}

export function getMemberMetadata(memberId: string): Metadata {
  const member = getCouncilActivity().members.find((m) => m.id === memberId);
  return {
    title: member
      ? `${member.name}｜議員情報｜みらい議会@三島市（非公式）`
      : "議員が見つかりません｜みらい議会@三島市",
    description:
      "三島市議会の公式名簿に基づく、資料基準日時点の議員情報。非公式・テスト公開中のサイトです。",
  };
}

export function MemberDetailView({ memberId }: { memberId: string }) {
  const data = getCouncilActivity();
  const profile = getMemberProfiles(data).find((p) => p.member.id === memberId);
  if (!profile) notFound();
  const { member, entry, roster, faction, term, committees } = profile;
  const source = (id: string) => {
    const found = data.sources.find((s) => s.id === id);
    if (!found) throw new Error("出典が見つかりません");
    return found;
  };
  const usedIds = new Set([
    member.officialSourceId,
    roster.sourceId,
    ...(faction ? [faction.sourceId] : []),
    ...(term ? [term.sourceId] : []),
    ...committees.map((c) => c.sourceId),
    ...member.notes.flatMap((n) => n.sourceIds),
  ]);
  return (
    <Container className="space-y-6 pt-28 pb-10 md:py-10">
      <Link
        href="/members"
        className="inline-block py-2 text-sm text-mirai-text underline"
      >
        議員一覧へ
      </Link>
      <header className="space-y-2">
        <p className="text-sm text-mirai-text-secondary">
          三島市議会・公式名簿に基づく議員情報
        </p>
        <h1 className="text-3xl font-bold text-mirai-text">{member.name}</h1>
        <p className="text-sm text-mirai-text-secondary">{member.kana}</p>
        <SourceReference
          source={source(member.officialSourceId)}
          label="公式の議員紹介・名簿（共通ページ）"
        />
      </header>
      <CoverageNotice data={data} />
      <section
        aria-labelledby="member-profile"
        className="space-y-4 rounded-2xl border border-mirai-border bg-card p-5"
      >
        <h2 id="member-profile" className="text-xl font-bold text-mirai-text">
          基本情報
        </h2>
        <dl className="space-y-4 text-sm text-mirai-text">
          <div>
            <dt className="font-bold">議席番号・期数</dt>
            <dd className="mt-1">
              {entry.seatNumber}番・{entry.termsServed}期
              {entry.councilRole ? `／${entry.councilRole}` : ""}
              <span className="mt-1 block text-mirai-text-secondary">
                基準日：{roster.asOf}。期数は公式名簿の記載です。
              </span>
            </dd>
          </div>
          <div>
            <dt className="font-bold">所属会派</dt>
            <dd className="mt-1">
              {faction?.name ?? "未確認"}
              <span className="mt-1 block text-mirai-text-secondary">
                {faction
                  ? "基準日：" +
                    faction.asOf +
                    "。所属開始日・終了日は未確認です。"
                  : "確認できる資料を整備中です。"}
              </span>
            </dd>
          </div>
          <div>
            <dt className="font-bold">任期</dt>
            <dd className="mt-1">
              {term
                ? `市議会議員の任期満了日：${term.scheduledEnd}`
                : "任期情報は未確認"}
              <span className="mt-1 block text-mirai-text-secondary">
                {term?.startsOn
                  ? `確認済みの任期開始日：${term.startsOn}`
                  : "個人の就任日・途中異動は未確認です。"}
              </span>
            </dd>
          </div>
          <div>
            <dt className="font-bold">所属委員会</dt>
            <dd className="mt-2">
              {committees.length ? (
                <ul className="space-y-3">
                  {committees.map((c) => (
                    <li key={c.id}>
                      {c.name}・{c.role}
                      <span className="block text-mirai-text-secondary">
                        基準日：{c.asOf}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                "未確認"
              )}
            </dd>
          </div>
        </dl>
        {member.notes.map((note) => (
          <p
            key={note.text}
            className="rounded-lg bg-mirai-surface p-3 text-sm text-mirai-text-secondary"
          >
            資料の表記について：{note.text}
          </p>
        ))}
      </section>
      <MemberVoteHistory memberId={memberId} />
      <section
        aria-labelledby="member-questions"
        className="space-y-2 rounded-2xl border border-mirai-border p-5"
      >
        <h2 id="member-questions" className="text-xl font-bold text-mirai-text">
          一般質問・答弁
        </h2>
        <p className="font-bold text-mirai-text">データ整備中</p>
        <p className="text-sm text-mirai-text-secondary">
          登壇履歴・質問・行政答弁は未集計です。未取得を0回と扱わず、公式会議録へのリンクを中心に今後整理します。
        </p>
        <Link
          href="/#official-minutes"
          className="inline-block min-h-10 py-2 text-sm text-mirai-text underline"
        >
          既存の会議録案内を見る
        </Link>
      </section>
      <section aria-labelledby="member-sources" className="space-y-3">
        <h2 id="member-sources" className="text-xl font-bold text-mirai-text">
          公式出典と確認状況
        </h2>
        <p className="text-sm text-mirai-text-secondary">
          各資料の該当箇所と取得日を示しています。全文や議員写真は転載していません。
        </p>
        <ul className="divide-y divide-mirai-border">
          {data.sources
            .filter((s) => usedIds.has(s.id))
            .map((s) => (
              <li key={s.id} className="py-3">
                <SourceReference source={s} />
                <p className="text-xs text-mirai-text-secondary">
                  {s.locator} ／ 取得日：{s.retrievedAt.slice(0, 10)} ／
                  公式資料と照合済み
                  {s.review.operatorReview === "pending"
                    ? "・運営者確認前"
                    : ""}
                </p>
              </li>
            ))}
        </ul>
      </section>
    </Container>
  );
}
