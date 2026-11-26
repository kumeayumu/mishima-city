import "server-only";
import type { Vote, VoteData } from "../../shared/utils/vote-data";
import {
  getIndependentAiReviewLabel,
  getVoteCoverage,
  getVoteReviewLabel,
  getVoteSummary,
  voteLabels,
} from "../../shared/utils/vote-data";
import { getCouncilActivity } from "../repositories/council-activity-repository";
import { SourceReference } from "./source-reference";
export function VoteSource({ sourceId }: { sourceId: string }) {
  const source = getCouncilActivity().sources.find((s) => s.id === sourceId);
  if (!source) throw new Error("採決の出典不明");
  return (
    <div className="text-xs text-mirai-text-secondary">
      <SourceReference source={source} />
      <p>
        {source.locator}／取得日：{source.retrievedAt.slice(0, 10)}
      </p>
    </div>
  );
}
export function VoteCoverage({ data }: { data: VoteData }) {
  const coverage = getVoteCoverage(data);
  return (
    <aside className="space-y-2 rounded-xl border border-mirai-border bg-card p-4 text-sm text-mirai-text-secondary">
      <p className="font-bold text-mirai-text">
        テスト公開中・三島市／三島市議会の非公式サイト
      </p>
      <p>
        個人表あり{coverage.recorded}議案・{data.votes.length}セル／全
        {coverage.total}議案。個人票未掲載{coverage.unreported}議案、結果未掲載
        {coverage.resultUnreported}
        議案です。未採決とは断定しません。結果確認日：{coverage.firstCheck}
        {coverage.lastCheck !== coverage.firstCheck
          ? `〜${coverage.lastCheck}`
          : ""}
        （議案別の日付は詳細へ）。
      </p>
      <p>
        訂正後の再照合：文字抽出と原表画像が
        {data.verification.methodComparison.textAndImageMatched}
        セル一致、文字未取得を画像で確認
        {data.verification.methodComparison.imageOnlyMatched}セル、不一致
        {data.verification.methodComparison.mismatches}件。
        {getVoteReviewLabel(data.verification)}
        。同一Codexによる別方式の一致を、別担当による独立確認済みとは扱いません。
      </p>
      <p>
        {getIndependentAiReviewLabel(data.verification)}
        承第5号の2セルを訂正しました。旧「198一致・不一致0」の報告は撤回しています。
        {getVoteReviewLabel(data.verification)}。
      </p>
      <p>
        会派は採決資料の見出しに基づく当時の情報です。全会一致や会派態度から個人票を推定せず、順位・スコアを付けません。
      </p>
    </aside>
  );
}
export function VoteSummary({
  votes,
  verification,
}: {
  votes: Vote[];
  verification: VoteData["verification"];
}) {
  const s = getVoteSummary(votes);
  if (!s.total) return <p>個人別賛否は未確認です。</p>;
  const pct = (n: number) => ((n / s.total) * 100).toFixed(1);
  return (
    <div className="space-y-3">
      <h3 className="font-bold text-mirai-text">
        {getVoteReviewLabel(verification)}
      </h3>
      <p className="text-sm">
        対象{s.total}人：賛成{s.yes}人（{pct(s.yes)}%）／反対{s.no}人（
        {pct(s.no)}%）／その他{s.other}人（{pct(s.other)}%）
      </p>
      <div
        role="img"
        aria-label={`対象${s.total}人の構成：賛成${s.yes}、反対${s.no}、その他${s.other}`}
        className="flex h-5 overflow-hidden rounded-full bg-mirai-surface-muted"
      >
        <div className="bg-stance-for" style={{ width: `${pct(s.yes)}%` }} />
        <div className="bg-stance-against" style={{ width: `${pct(s.no)}%` }} />
        <div
          className="bg-stance-neutral"
          style={{ width: `${pct(s.other)}%` }}
        />
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-mirai-text-secondary">
        {Object.entries(s.counts)
          .filter(([, n]) => n > 0)
          .map(([state, n]) => (
            <li key={state}>
              {voteLabels[state as Vote["participation"]].label}：{n}人
            </li>
          ))}
      </ul>
      <p className="text-xs text-mirai-text-secondary">
        上の割合は当該表の{s.total}人を分母とする構成です。明示的な賛否
        {s.explicit}人のみでは賛成{s.yesPercent?.toFixed(1) ?? "未確認"}
        %です。法定議決要件を意味せず、結果は公式資料に従います。
      </p>
    </div>
  );
}
