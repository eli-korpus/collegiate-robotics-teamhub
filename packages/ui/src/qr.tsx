import { useMemo } from 'react';
import { encode } from 'uqr';

/** QR code rendered as a single SVG path (uqr is ~10 KB). */
export function QRCode({ value, size = 200, className, label }: { value: string; size?: number; className?: string; label?: string }) {
  const { path, n } = useMemo(() => {
    const q = encode(value, { ecc: 'M', border: 2 });
    let d = '';
    q.data.forEach((row, y) =>
      row.forEach((on, x) => {
        if (on) d += `M${x},${y}h1v1h-1z`;
      }),
    );
    return { path: d, n: q.size };
  }, [value]);
  return (
    <svg viewBox={`0 0 ${n} ${n}`} width={size} height={size} className={className} role="img" aria-label={label ?? `QR code for ${value}`} shapeRendering="crispEdges">
      <rect width={n} height={n} fill="#fff" />
      <path d={path} fill="#000" />
    </svg>
  );
}
