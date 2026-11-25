import "server-only";
import type { ActivityData } from "../../shared/types/council-activity";
import { isMemberDataApproved } from "../../shared/utils/member-publication";

export function CoverageNotice({ data }: { data: ActivityData }) {
  const roster = data.snapshots.rosters.find(
    (r) => r.id === data.coverage.rosterSnapshotId
  );
  const factions = data.snapshots.factions.find(
    (f) => f.id === data.coverage.factionSnapshotId
  );
  const retrievedAt = [...data.sources.map((s) => s.retrievedAt)]
    .sort()
    .at(-1)
    ?.slice(0, 10);
  return (
    <aside
      aria-label="掲載範囲と確認状況"
      className="space-y-2 rounded-xl border border-mirai-border bg-card p-4 text-sm text-mirai-text-secondary"
    >
      <p className="font-bold text-mirai-text">
        公式資料の基準日時点の情報です
      </p>
      <p>
        議員名簿：{roster?.asOf} ／ 会派：{factions?.asOf}
        。現在の所属や過去の在籍期間を示すものではありません。委員会は各欄に基準日を表示しています。
      </p>
      <p>
        取得日：{retrievedAt}。確認状況：公式資料と照合済み
        {!isMemberDataApproved(data)
          ? "・運営者による確認前"
          : "・運営者確認済み"}
        。
      </p>
      <p>
        議案賛否・一般質問・行政答弁の活動データは整備中です。未取得を0件として集計せず、議員の優劣を評価する順位やスコアは掲載しません。
      </p>
    </aside>
  );
}
