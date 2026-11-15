import type { Metadata } from "next";
import { Container } from "@/components/layouts/container";
import {
  LegalPageLayout,
  LegalParagraph,
  LegalSectionTitle,
} from "@/components/layouts/legal-page-layout";
import { siteConfig } from "@/config/site.config";

export const metadata: Metadata = {
  title: `よくあるご質問 | ${siteConfig.siteName}`,
};
const faqs = [
  [
    "どのようなサイトですか？",
    "三島市議会の2026年度の議案の件名・議決結果と、公式資料・会議録へのリンクを案内する、テスト公開中の非公式サイトです。掲載範囲は取得済み資料に限られ、年度内の全資料や最新の状態を保証するものではありません。",
  ],
  [
    "三島市やチームみらいの公式サービスですか？",
    "いいえ。三島市・三島市議会およびチームみらいの公式サイトではありません。公開ソフトウェア「みらい議会」をもとに、久米歩が独立して運営しています。",
  ],
  [
    "情報の出典はどこですか？",
    "三島市公式サイトの議案・議決結果と、三島市議会の公式会議録検索です。各資料のリンクから原文を確認できます。最新・正確な情報は公式サイトを優先してください。",
  ],
  [
    "会議録の本文は掲載していますか？",
    "全文の転載条件を確認できていないため、このテスト版では開催日・会議名と公式会議録へのリンクのみを案内しています。",
  ],
  [
    "AI解説、チャット、インタビューは使えますか？",
    "現在は提供していません。掲載内容にAIによる要約・評価は含まれません。利用者の対話履歴を収集・保存する機能も稼働していません。",
  ],
  [
    "利用者の情報はどのように扱われますか？",
    "会員登録・ログイン・投稿フォームはありません。アクセス解析と外部のふりがなスクリプトは無効です。文字サイズの設定のみブラウザ内に保存します。ホスティング基盤のログとメールでのお問い合わせについてはプライバシーポリシーをご確認ください。",
  ],
];
export default function FaqPage() {
  return (
    <LegalPageLayout
      title="よくあるご質問"
      description="テスト公開版の機能と運営について"
      className="pt-24 md:pt-12"
    >
      <Container className="space-y-8">
        {faqs.map(([q, a]) => (
          <section key={q} className="space-y-3">
            <LegalSectionTitle>{q}</LegalSectionTitle>
            <LegalParagraph>{a}</LegalParagraph>
          </section>
        ))}
        <section className="space-y-3">
          <LegalSectionTitle>問い合わせ先</LegalSectionTitle>
          <LegalParagraph>
            運営者：{siteConfig.operator.name} ／{" "}
            <a className="underline" href={siteConfig.operator.contactUrl}>
              kume@soma-wood.jp
            </a>
            。誤記・権利侵害・プライバシーに関するご連絡もこちらへお願いします。三島市やチームみらいの公式窓口へ本サイトの不具合をご連絡いただく必要はありません。
          </LegalParagraph>
        </section>
        <LegalParagraph>
          <a className="underline" href="/privacy">
            プライバシーポリシー
          </a>{" "}
          ／{" "}
          <a className="underline" href="/terms">
            利用規約
          </a>
        </LegalParagraph>
      </Container>
    </LegalPageLayout>
  );
}
