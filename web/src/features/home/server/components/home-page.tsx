import "server-only";
import { Container } from "@/components/layouts/container";
import { About } from "@/components/top/about";
import { Hero } from "@/components/top/hero";
import { OfficialRecordsView } from "@/features/official-records/server/components/official-records-view";

export function HomePage() {
  return (
    <>
      <Hero />
      <Container className="py-10">
        <OfficialRecordsView />
        <About />
      </Container>
    </>
  );
}
