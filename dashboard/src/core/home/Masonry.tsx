import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';

/**
 * Home's card layout: each card goes into whichever column is shortest so far, so columns fill evenly and there are
 * never empty holes (a plain grid makes every row as tall as its tallest card). Cards keep their order left to right,
 * stay mounted when the layout changes, and cards that render nothing take no space.
 */
export function Masonry({ items, minColumn = 340, maxColumns = 3, gap = 16 }: { items: { key: string; node: ReactNode }[]; minColumn?: number; maxColumns?: number; gap?: number }) {
  const box = useRef<HTMLDivElement>(null);
  const refs = useRef(new Map<string, HTMLDivElement>());
  const [width, setWidth] = useState(0);
  const [heights, setHeights] = useState<Record<string, number>>({});

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  useLayoutEffect(() => {
    const ro = new ResizeObserver(() => {
      const next: Record<string, number> = {};
      refs.current.forEach((el, k) => (next[k] = el.offsetHeight));
      setHeights((prev) => (Object.keys(next).length === Object.keys(prev).length && Object.entries(next).every(([k, h]) => prev[k] === h) ? prev : next));
    });
    refs.current.forEach((el) => ro.observe(el));
    return () => ro.disconnect();
  }, [items.map((i) => i.key).join('|')]);

  const columns = Math.max(1, Math.min(maxColumns, Math.floor((width + gap) / (minColumn + gap))));
  const colWidth = columns ? (width - gap * (columns - 1)) / columns : width;
  const tops = new Array<number>(columns).fill(0);
  const pos = new Map<string, { left: number; top: number }>();
  for (const { key } of items) {
    const h = heights[key] ?? 0;
    if (!h) continue;
    const col = tops.indexOf(Math.min(...tops));
    pos.set(key, { left: col * (colWidth + gap), top: tops[col] });
    tops[col] += h + gap;
  }
  const total = Math.max(0, ...tops.map((t) => t - gap));

  return (
    <div ref={box} className="relative" style={{ height: width ? total : undefined }}>
      {items.map(({ key, node }) => {
        const p = pos.get(key);
        return (
          <div
            key={key}
            ref={(el) => {
              if (el) refs.current.set(key, el);
              else refs.current.delete(key);
            }}
            className="absolute left-0 top-0 transition-transform duration-200 motion-reduce:transition-none"
            style={{ width: width ? colWidth : '100%', transform: p ? `translate(${p.left}px, ${p.top}px)` : undefined, visibility: p ? 'visible' : 'hidden' }}
          >
            {node}
          </div>
        );
      })}
    </div>
  );
}
