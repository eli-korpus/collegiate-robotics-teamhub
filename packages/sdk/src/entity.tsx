import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { Ban } from 'lucide-react';
import { Favicon, cn, hostOf } from '@teamhub/ui';
import { getModule } from './runtime';
import { useSupabase } from './hooks';
import { parseRef } from './refs';

// ── Entity links (spec §10.4) ──────────────────────────────────────────────
/** Renders a reference to an item in any module; degrades to a neutral chip when unavailable. Never throws. */
export function EntityLink({ refStr, className }: { refStr: string | null | undefined; className?: string }) {
  const sb = useSupabase();
  const ref = parseRef(refStr);
  const def = ref ? getModule(ref.module)?.client.entities?.[ref.type] : undefined;
  const q = useQuery({
    queryKey: ['entity', refStr],
    enabled: !!def,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      try {
        return await def!.fetch(sb, ref!.id);
      } catch {
        return null;
      }
    },
  });
  if (refStr && /^https?:\/\//.test(refStr)) {
    return (
      <a href={refStr} target="_blank" rel="noreferrer noopener" className={cn('inline-flex items-center gap-1.5 text-[13px] text-accent hover:underline', className)}>
        <Favicon url={refStr} size={14} /> {hostOf(refStr)}
      </a>
    );
  }
  if (!def || (!q.isLoading && !q.data)) {
    return (
      <span className={cn('inline-flex items-center gap-1 rounded-md bg-bg-subtle px-1.5 py-0.5 text-[12px] text-faint', className)}>
        <Ban className="size-3" /> Unavailable item
      </span>
    );
  }
  if (q.isLoading) return <span className={cn('inline-block h-5 w-24 animate-pulse rounded bg-bg-subtle', className)} />;
  const Icon = def.icon ?? getModule(ref!.module)?.client.icon;
  return (
    <Link to={q.data!.href} className={cn('inline-flex max-w-full items-center gap-1.5 rounded-md border border-border bg-surface px-1.5 py-0.5 text-[12.5px] font-medium hover:bg-bg-subtle', className)}>
      {Icon && <Icon className="size-3.5 shrink-0" />}
      <span className="truncate">{q.data!.title}</span>
    </Link>
  );
}
