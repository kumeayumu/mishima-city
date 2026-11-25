import "server-only";
import { ExternalLink } from "lucide-react";
import type { OfficialSource } from "../../shared/types/council-activity";

export function SourceReference({
  source,
  label,
}: {
  source: OfficialSource;
  label?: string;
}) {
  return (
    <a
      href={source.url}
      target="_blank"
      rel="noreferrer"
      className="inline-flex min-h-10 items-center gap-1 break-words text-sm text-mirai-text underline underline-offset-4 hover:text-primary-accent"
    >
      {label ?? source.title}
      <ExternalLink aria-hidden="true" className="size-3 shrink-0" />
      <span className="sr-only">（公式サイト・新しいタブ）</span>
    </a>
  );
}
