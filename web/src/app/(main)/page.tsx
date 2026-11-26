import { HomePage } from "@/features/home/server/components/home-page";
import type { BillSearchParams } from "@/features/official-records/shared/types/bill-search";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<BillSearchParams>;
}) {
  return <HomePage searchParams={await searchParams} />;
}
