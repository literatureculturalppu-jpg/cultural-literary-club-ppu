import { useEffect, useRef, useState } from "react";

/**
 * Renders long lists incrementally instead of mounting every item at once.
 *
 * Unlike route-level `React.lazy()` (which only splits code per *page*),
 * this actually defers the *rendering* of off-screen list items — including
 * their images — until the user scrolls near them. It uses an
 * IntersectionObserver on a small "sentinel" element placed after the
 * currently-rendered items; whenever the sentinel enters the viewport, the
 * next batch is revealed.
 *
 * Usage:
 *   const { visibleCount, sentinelRef } = useInfiniteReveal(items.length);
 *   items.slice(0, visibleCount).map(...)
 *   <div ref={sentinelRef} />
 */
export function useInfiniteReveal(totalCount: number, batchSize = 9) {
  const [visibleCount, setVisibleCount] = useState(Math.min(batchSize, totalCount || batchSize));
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // If the underlying data set shrinks/changes (e.g. after a search filter),
  // don't keep showing a stale, too-large count.
  useEffect(() => {
    setVisibleCount((prev) => Math.min(Math.max(prev, batchSize), totalCount || batchSize));
  }, [totalCount, batchSize]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return;
    if (visibleCount >= totalCount) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisibleCount((c) => Math.min(c + batchSize, totalCount));
        }
      },
      { rootMargin: "400px 0px" } // start loading a bit before it's actually visible
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [visibleCount, totalCount, batchSize]);

  return { visibleCount, sentinelRef };
}
