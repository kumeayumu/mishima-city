import "server-only";
import Link from "next/link";
import { getOfficialRecords } from "../repositories/official-records-repository";

export function OfficialRecordsView() {
  const { bills, minutes, manifest } = getOfficialRecords();
  return (
    <div className="space-y-10">
      <section className="space-y-3">
        <h1 className="text-2xl font-bold text-mirai-text">
          三島市議会 2026年度
        </h1>
        <p className="text-sm text-mirai-text-secondary">
          対象期間：2026年4月1日〜2027年3月31日。
          {manifest.collectedAt.slice(0, 10)}
          に整理した公開資料を掲載しています。
          議案の件名・議決結果と、公式会議録へのリンクを確認できます。
          AIによる要約・評価は含みません。
        </p>
        <p className="text-sm font-bold text-mirai-text">
          議案 {manifest.bills}件 ／ 会議録 {manifest.meetings}日分
        </p>
      </section>
      <section className="space-y-6" aria-labelledby="official-bills">
        <h2
          id="official-bills"
          className="scroll-mt-28 text-xl font-bold text-mirai-text"
        >
          議案・議決結果
        </h2>
        {bills.sessions.map((session) => (
          <section key={session.sourceUrl} className="space-y-3">
            <h3 className="font-bold text-mirai-text">{session.title}</h3>
            <a
              href={session.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="text-sm underline text-mirai-text-secondary"
            >
              公式の議案一覧を確認する
            </a>
            <ul className="divide-y divide-mirai-border">
              {session.bills.map((bill) => (
                <li key={bill.number} className="space-y-2 py-4">
                  <p className="text-sm text-mirai-text-secondary">
                    {bill.number}
                  </p>
                  <p className="font-bold text-mirai-text">{bill.title}</p>
                  <p className="text-sm text-mirai-text-secondary">
                    {bill.result || "議決結果は公式資料に未掲載"}
                    {bill.decisionDate ? `（${bill.decisionDate}）` : ""}
                  </p>
                  {bill.sourceWarnings.map((warning) => (
                    <p
                      key={warning}
                      className="text-sm text-mirai-text-secondary"
                    >
                      {warning}
                    </p>
                  ))}
                  {bill.documentUrls.map((url, index) => (
                    <a
                      key={url}
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="mr-4 inline-block text-sm underline text-mirai-text"
                    >
                      議案の原文PDF
                      {bill.documentUrls.length > 1 ? ` ${index + 1}` : ""}
                    </a>
                  ))}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </section>
      <section className="space-y-3" aria-labelledby="official-minutes">
        <h2
          id="official-minutes"
          className="scroll-mt-28 text-xl font-bold text-mirai-text"
        >
          会議録
        </h2>
        <p className="text-sm text-mirai-text-secondary">
          会議録は開催日と公式サイトへのリンクを案内しています。本文は転載していません。
        </p>
        <ul className="divide-y divide-mirai-border">
          {minutes.meetings.map((meeting) => (
            <li key={meeting.id} className="py-4">
              <Link
                href={`/minutes/${meeting.id}`}
                className="font-bold text-mirai-text underline"
              >
                {meeting.date} {meeting.name}
              </Link>
              <p className="mt-1 text-sm text-mirai-text-secondary">
                {meeting.kind}・{meeting.entryCount}件の記録
              </p>
            </li>
          ))}
        </ul>
        <a
          href={manifest.minutesIndexUrl}
          target="_blank"
          rel="noreferrer"
          className="text-sm underline text-mirai-text"
        >
          公式の会議録検索を開く
        </a>
      </section>
    </div>
  );
}
