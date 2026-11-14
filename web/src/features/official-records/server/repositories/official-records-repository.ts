import "server-only";
import bills from "../data/2026/bills.json";
import minutes from "../data/2026/minutes-index.json";
import manifest from "../data/2026/manifest.json";

export function getOfficialRecords() {
  return { bills, minutes, manifest };
}

export async function getOfficialMinute(id: string) {
  if (!minutes.meetings.some((meeting) => meeting.id === id)) return null;
  const data = await import(`../data/2026/minutes/${id}.json`);
  return data.default as {
    name: string;
    date: string;
    sourceUrl: string;
    minutes: { id: number; title: string; text: string }[];
  };
}
