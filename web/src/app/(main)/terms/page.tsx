import type { Metadata } from "next";
import { Container } from "@/components/layouts/container";
import {
  LegalPageLayout,
  LegalParagraph,
  LegalSectionTitle,
} from "@/components/layouts/legal-page-layout";
import { siteConfig } from "@/config/site.config";

export const metadata: Metadata = {
  title: `利用規約 | ${siteConfig.siteName}`,
};
export default function TermsPage() {
  return (
    <LegalPageLayout
      title="利用規約"
      description="非公式・テスト公開版の利用条件"
      className="pt-24 md:pt-12"
    >
      <Container className="space-y-8">
        <section className="space-y-3">
          <LegalSectionTitle>1. 運営と公開範囲</LegalSectionTitle>
          <LegalParagraph>
            本サイトは{siteConfig.operator.name}
            が運営するテスト公開中の非公式サイトです。三島市・三島市議会およびチームみらいが運営・承認する公式サービスではありません。2026年度の取得済み議案情報と公式資料・会議録へのリンクを案内しています。AIチャット、投稿、会員登録は提供していません。
          </LegalParagraph>
        </section>
        <section className="space-y-3">
          <LegalSectionTitle>2. 出典と情報の確認</LegalSectionTitle>
          <LegalParagraph>
            掲載内容の正確性・完全性・最新性は保証しません。重要な判断では各出典先の公式情報をご確認ください。外部サイトにはそれぞれの利用条件が適用されます。会議録本文は本サイトに転載していません。
          </LegalParagraph>
        </section>
        <section className="space-y-3">
          <LegalSectionTitle>3. ソフトウェアと資料の権利</LegalSectionTitle>
          <LegalParagraph>
            本サイトのソフトウェアはGNU Affero General Public License version
            3（AGPL
            v3）に基づいて提供します。本規約は、同ライセンスにより認められる利用・複製・改変・再配布等の権利を制限しません。
          </LegalParagraph>
          <LegalParagraph>
            <a className="underline" href={siteConfig.sourceUrl}>
              対応するソースコードとビルド手順
            </a>{" "}
            ／{" "}
            <a
              className="underline"
              href="https://github.com/kumeayumu/mishima-city/blob/mishima-migration/LICENSE"
            >
              LICENSE
            </a>
          </LegalParagraph>
          <LegalParagraph>
            出典先の文書・データ・画像等の権利は各権利者に帰属します。ソフトウェアのAGPL
            v3が、第三者の資料にも一律に適用されるという意味ではありません。資料の再利用は、出典先の条件と適用法令をご確認ください。
          </LegalParagraph>
        </section>
        <section className="space-y-3">
          <LegalSectionTitle>4. 利用にあたって</LegalSectionTitle>
          <LegalParagraph>
            不正アクセス、権利侵害、サービスを妨害する行為、過剰な負荷をかける行為、掲載情報を改ざんして公式情報と誤認させる行為は行わないでください。
          </LegalParagraph>
        </section>
        <section className="space-y-3">
          <LegalSectionTitle>5. 変更・停止と免責</LegalSectionTitle>
          <LegalParagraph>
            テスト公開のため、内容や提供範囲を変更・停止する場合があります。運営者は、適用法令により認められる範囲で、本サイトの利用に伴う損害について責任を負わないものとします。本規約は、法令上排除できない責任や利用者の権利を排除するものではありません。
          </LegalParagraph>
        </section>
        <section className="space-y-3">
          <LegalSectionTitle>6. 問い合わせ</LegalSectionTitle>
          <LegalParagraph>
            運営者：{siteConfig.operator.name} ／{" "}
            <a className="underline" href={siteConfig.operator.contactUrl}>
              kume@soma-wood.jp
            </a>
            。情報の訂正、権利・プライバシーに関するご連絡を受け付けます。本規約は必要に応じて見直し、このページでお知らせします。
          </LegalParagraph>
        </section>
      </Container>
    </LegalPageLayout>
  );
}
