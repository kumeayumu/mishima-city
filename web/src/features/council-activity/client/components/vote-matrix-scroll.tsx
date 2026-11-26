"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";

export function VoteMatrixScroll({ children }: { children: ReactNode }) {
  const top = useRef<HTMLDivElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const upper = top.current,
      lower = viewport.current;
    if (!upper || !lower) return;
    const syncUpper = () => {
      if (Math.abs(upper.scrollLeft - lower.scrollLeft) > 1)
        upper.scrollLeft = lower.scrollLeft;
    };
    const syncLower = () => {
      if (Math.abs(upper.scrollLeft - lower.scrollLeft) > 1)
        lower.scrollLeft = upper.scrollLeft;
    };
    const measure = () => {
      setWidth(lower.scrollWidth + upper.clientWidth - lower.clientWidth);
      syncUpper();
    };
    const observer = new ResizeObserver(measure);
    observer.observe(lower);
    if (lower.firstElementChild) observer.observe(lower.firstElementChild);
    lower.addEventListener("scroll", syncUpper, { passive: true });
    upper.addEventListener("scroll", syncLower, { passive: true });
    measure();
    return () => {
      observer.disconnect();
      lower.removeEventListener("scroll", syncUpper);
      upper.removeEventListener("scroll", syncLower);
    };
  }, []);

  return (
    <section
      aria-label="賛否マトリクス"
      className="rounded-xl border border-mirai-border bg-card"
    >
      <div className="sticky top-24 z-30 rounded-t-xl border-b border-mirai-border bg-card p-2">
        <p id="matrix-legend" className="text-xs leading-relaxed">
          <strong className="vote-symbol-strong">○</strong>賛成／
          <strong className="vote-symbol-strong">×</strong>
          反対／会派?：当時会派未確認／欠：欠席／退：退席／棄：棄権／除：除斥／議：議長不参加／?：不明／未：個人票未掲載／結：議決結果未掲載／外：条件外
        </p>
        <p className="text-xs text-mirai-text-secondary">
          議案番号は詳細へ。「議案名」で全文を表示。上のバーでも横スクロールできます。
        </p>
        <div
          // biome-ignore lint/a11y/noNoninteractiveTabindex: The named horizontal scroll region supports keyboard access.
          tabIndex={0}
          role="region"
          aria-label="表上部の横スクロール"
          aria-describedby="matrix-legend"
          ref={top}
          className="h-6 overflow-x-scroll overflow-y-hidden rounded border border-mirai-border bg-mirai-surface"
        >
          <div className="h-px" style={{ width }} />
        </div>
      </div>
      <div
        // biome-ignore lint/a11y/noNoninteractiveTabindex: The named table region supports keyboard scrolling and links.
        tabIndex={0}
        role="region"
        aria-label="賛否マトリクス・縦横スクロール"
        aria-describedby="matrix-legend"
        ref={viewport}
        className="max-h-[55vh] overflow-auto rounded-b-xl"
      >
        {children}
      </div>
    </section>
  );
}
