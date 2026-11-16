import "server-only";
import bills from "../data/2026/bills.json";
import manifest from "../data/2026/manifest.json";
import minutes from "../data/2026/minutes-index.json";

export function getOfficialRecords() {
  return { bills, minutes, manifest };
}

// Public pages read index metadata only; full source JSON remains in the repository.
export async function getOfficialMinute(id: string) {
  return minutes.meetings.find((meeting) => meeting.id === id) ?? null;
}
