import { Container } from "@/components/layouts/container";
import { siteConfig } from "@/config/site.config";

export function Hero() {
  return (
    <div className="w-full bg-mirai-gradient pt-28 pb-12 md:py-16 text-mirai-text">
      <Container>
        <p className="font-bold text-xl md:text-2xl leading-relaxed">
          {siteConfig.councilName}で議論されていること
          <br />
          議案・会議録を出典付きで確認できます
        </p>
      </Container>
    </div>
  );
}
