import { useNavigate } from 'react-router';
import { NewMenu, PurposeHint } from '@teamhub/ui';
import type { NotForEntry } from './define';
import { allQuickActions, getModule } from './runtime';
import { canWith, useSession } from './session';
import { resolveSlotLinks, useLinks, useTeamScope } from './hooks';

const CORE_PAGES: Record<string, { label: string; href: string }> = {
  'request-info': { label: 'Request info', href: '/people?tab=request-info' },
  people: { label: 'People', href: '/people' },
  positions: { label: 'Positions', href: '/people?tab=positions' },
};
/** Resolves a manifest `notFor` target to a link, or null when that tab/tool isn't available. */
export function useNotForLinks(entries: NotForEntry[]) {
  const links = useLinks();
  const scope = useTeamScope();
  return entries.map((n) => {
    if (n.goTo.startsWith('link:')) {
      const slot = n.goTo.slice(5);
      const l = resolveSlotLinks(links.data ?? [], [slot], scope)[0];
      return { text: n.text, href: l?.url ?? null, label: l?.label ?? undefined, external: true };
    }
    if (n.goTo.startsWith('core:')) {
      const p = CORE_PAGES[n.goTo.slice(5)];
      return { text: n.text, href: p?.href ?? null, label: p?.label };
    }
    const m = getModule(n.goTo);
    return { text: n.text, href: m ? `/${n.goTo}` : null, label: m?.manifest.name };
  });
}

export function ModulePurpose({ moduleId, compact, className }: { moduleId: string; compact?: boolean; className?: string }) {
  const m = getModule(moduleId);
  const nf = useNotForLinks(m?.manifest.notFor ?? []);
  if (!m) return null;
  return <PurposeHint purpose={m.manifest.purpose} notFor={nf} compact={compact} className={className} />;
}

/** "New …" with typed shortcuts into other enabled tabs (spec P6). */
export function ModuleNewMenu({ moduleId, label, onNew }: { moduleId: string; label: string; onNew: () => void }) {
  const nav = useNavigate();
  const { me } = useSession();
  const shortcuts = allQuickActions()
    .filter((q) => q.newMenuFor?.includes(moduleId) && (!q.perm || canWith(me, q.perm)))
    .map((q) => ({ label: q.label, hint: q.hint, icon: q.icon ? <q.icon /> : undefined, onSelect: () => nav(q.href) }));
  return <NewMenu label={label} onNew={onNew} shortcuts={shortcuts} />;
}
