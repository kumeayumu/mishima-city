import type { Metadata } from "next";
import { Container } from "@/components/layouts/container";
import {
  LegalPageLayout,
  LegalParagraph,
  LegalSectionTitle,
} from "@/components/layouts/legal-page-layout";
import { siteConfig } from "@/config/site.config";

export const metadata: Metadata = {
  title: `プライバシーポリシー | ${siteConfig.siteName}`,
};
export default function PrivacyPage() {
  return (
    <LegalPageLayout
      title="プライバシーポリシー"
      description="テスト公開版における情報の取り扱い"
      className="pt-24 md:pt-12"
    >
      <Container className="space-y-8">
        <section className="space-y-3">
          <LegalSectionTitle>1. 運営者と対象</LegalSectionTitle>
          <LegalParagraph>
            運営者は{siteConfig.operator.name}
            です。この方針は三島市・三島市議会およびチームみらいとは独立した、本サイトのテスト公開版に適用します。
          </LegalParagraph>
        </section>
        <section className="space-y-3">
          <LegalSectionTitle>2. 現在の機能</LegalSectionTitle>
          <LegalParagraph>
            会員登録、ログイン、投稿、AIチャット、インタビュー機能は提供していません。これらの入力情報や対話履歴を、本サイトが収集・DBへ保存することはありません。Google
            Analytics、Vercel Speed
            Insights、外部のふりがなスクリプトはテスト版では読み込みません。
          </LegalParagraph>
        </section>
        <section className="space-y-3">
          <LegalSectionTitle>3. ブラウザ内の設定</LegalSectionTitle>
          <LegalParagraph>
            文字サイズの設定を端末のlocalStorageに保存します。この設定はアクセス解析には使いません。ブラウザのサイトデータ削除で消去できます。
          </LegalParagraph>
        </section>
        <section className="space-y-3">
          <LegalSectionTitle>4. ホスティングと外部サイト</LegalSectionTitle>
          <LegalParagraph>
            配信・障害対応・不正アクセス対策のため、ホスティング基盤がIPアドレス、アクセス日時、URL、エラー等を処理・記録する場合があります。保存期間やアクセス制御は提供元の仕様と設定によります。認証付きテスト公開では、ホスティング提供元による認証が行われます。
          </LegalParagraph>
          <LegalParagraph>
            公式資料等への外部リンクを開いた後は、リンク先の利用条件・プライバシーポリシーが適用されます。
          </LegalParagraph>
        </section>
        <section className="space-y-3">
          <LegalSectionTitle>5. お問い合わせ</LegalSectionTitle>
          <LegalParagraph>
            メールでご連絡いただいた場合、メールアドレス、氏名、本文等を返信・事実確認・問題対応のために利用します。機微な個人情報は必要以上に送らないでください。対応に必要な期間保管し、不要になった情報は適切に削除します。
          </LegalParagraph>
        </section>
        <section className="space-y-3">
          <LegalSectionTitle>6. 公開資料と訂正・削除のご相談</LegalSectionTitle>
          <LegalParagraph>
            議案の件名・議決結果等は公開された公式資料を出典としています。会議録本文はこのテスト版には転載せず、公式サイトへのリンクを案内します。誤記、権利侵害、個人情報の掲載についてお気付きの場合は、対象URLと内容をご連絡ください。事実を確認し、必要な対応を検討します。
          </LegalParagraph>
          <LegalParagraph>
            窓口：{siteConfig.operator.name} ／{" "}
            <a className="underline" href={siteConfig.operator.contactUrl}>
              kume@soma-wood.jp
            </a>
            。ご自身のお問い合わせ情報についての確認・訂正・削除のご相談も受け付けます。
          </LegalParagraph>
        </section>
        <section className="space-y-3">
          <LegalSectionTitle>7. 方針の更新</LegalSectionTitle>
          <LegalParagraph>
            機能や取り扱いを変更する際は、このページの内容も見直します。
          </LegalParagraph>
        </section>
      </Container>
    </LegalPageLayout>
  );
}
