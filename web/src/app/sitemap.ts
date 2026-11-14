import type { MetadataRoute } from "next";
import { env } from "@/lib/env";
import { getOfficialRecords } from "@/features/official-records/server/repositories/official-records-repository";

export default function sitemap(): MetadataRoute.Sitemap {
  const { minutes, manifest } = getOfficialRecords();
  const lastModified = new Date(manifest.collectedAt);
  return [
    { url: env.webUrl, lastModified, changeFrequency: "weekly", priority: 1 },
    ...minutes.meetings.map((meeting) => ({
      url: `${env.webUrl}/minutes/${meeting.id}`,
      lastModified,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
  ];
}
