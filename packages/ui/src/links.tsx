import { useState, type ReactNode } from 'react';
import { Link2, ExternalLink } from 'lucide-react';
import { cn } from './cn';
import { safeHref } from './url';

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/** Favicon from Google's s2 service (spec §14.4): no storage used. Falls back to a link icon. */
export function Favicon({ url, size = 16, className }: { url: string; size?: number; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <Link2 className={cn('shrink-0 text-muted', className)} style={{ width: size, height: size }} />;
  return (
    <img
      src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostOf(url))}&sz=${size * 2}`}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      onError={() => setFailed(true)}
      className={cn('shrink-0 rounded-[3px]', className)}
    />
  );
}

export function LinkCard({ label, url, description, actions, badge }: { label: string; url: string; description?: string | null; actions?: ReactNode; badge?: ReactNode }) {
  return (
    <div className="group flex items-start gap-3 rounded-md border border-border bg-surface p-3 shadow-sm transition-shadow hover:shadow-md">
      <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-md bg-bg-subtle">
        <Favicon url={url} size={16} />
      </span>
      <a href={safeHref(url)} target="_blank" rel="noreferrer noopener" className="min-w-0 flex-1">
        {/* Wraps so the badges (kind, team) move to the next line instead of being cut off. */}
        <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[13.5px] font-medium">
          <span className="min-w-0 break-words">{label}</span>
          <ExternalLink className="size-3 shrink-0 text-faint opacity-0 transition-opacity group-hover:opacity-100" />
          {badge}
        </p>
        <p className="truncate text-[12px] text-faint">{hostOf(url)}</p>
        {description && <p className="mt-1 line-clamp-2 text-[12.5px] text-muted">{description}</p>}
      </a>
      {actions && <div className="flex shrink-0 items-center gap-0.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100">{actions}</div>}
    </div>
  );
}
