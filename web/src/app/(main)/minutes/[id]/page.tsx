import { OfficialMinuteView } from "@/features/official-records/server/components/official-minute-view";

export default async function MinutePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <OfficialMinuteView id={id} />;
}
