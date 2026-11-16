import { Container } from "@/components/layouts/container";
import { siteConfig } from "@/config/site.config";

export function Hero() {
  return (
    <div className="w-full bg-mirai-gradient pt-28 pb-12 md:py-16 text-mirai-text">
      <Container>
        <p className="mb-3 text-sm font-bold">テスト公開中・非公式サイト</p>
        <p className="mb-4 text-sm">
          三島市・三島市議会の公式サイトではありません。最新・正確な情報は公式資料をご確認ください。
        </p>
        <p className="font-bold text-xl md:text-2xl leading-relaxed">
          {siteConfig.councilName}で議論されていること
          <br />
          議案・会議録を出典付きで確認できます
        </p>
      </Container>
    </div>
  );
}
